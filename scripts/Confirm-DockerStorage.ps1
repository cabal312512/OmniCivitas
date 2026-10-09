$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Enter-OcvEnvironment.ps1')
$ocvDocker = Resolve-OcvTool 'docker'
$ocvOriginalProfile = $env:USERPROFILE
$ocvOriginalAppData = $env:APPDATA
$ocvOriginalLocalAppData = $env:LOCALAPPDATA
$ocvDesktopHome = if ($ocvRuntimeConfig.dockerDesktopHome) { [string]$ocvRuntimeConfig.dockerDesktopHome } else { $null }
if ($ocvDesktopHome -and -not [IO.Path]::IsPathRooted($ocvDesktopHome)) { $ocvDesktopHome = Join-Path $ocvProjectRoot $ocvDesktopHome }
if ($ocvDesktopHome) { $ocvDesktopHome = [IO.Path]::GetFullPath($ocvDesktopHome) }
try {
    if ($ocvDesktopHome) {
        $env:USERPROFILE = $ocvDesktopHome
        $env:APPDATA = Join-Path $ocvDesktopHome 'appdata/Roaming'
        $env:LOCALAPPDATA = Join-Path $ocvDesktopHome 'appdata/Local'
    }
    $ocvInfoText = & $ocvDocker info --format '{{json .}}' 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'Docker is not ready. Start your installed engine; no pull/build was attempted.' }
    $ocvInfo = $ocvInfoText | ConvertFrom-Json
    if ($ocvInfo.OSType -ne 'linux') { throw 'The project uses Linux containers. Select a Linux engine before building.' }
    if ($ocvStorageGuard) {
        if ($env:DOCKER_HOST -or $env:DOCKER_CONTEXT) { throw 'A Docker endpoint override is set. The selected local disk policy cannot attest a different endpoint.' }
        if ($ocvInfo.OperatingSystem -notmatch 'Docker Desktop') { throw 'The configured disk policy requires the local Docker Desktop engine.' }
        $ocvContextText = & $ocvDocker context inspect
        if ($LASTEXITCODE -ne 0) { throw 'Cannot identify the Docker endpoint.' }
        $ocvContext = @($ocvContextText | ConvertFrom-Json)[0]
        if ($ocvContext.Endpoints.docker.Host -notmatch '^npipe:') { throw 'The active endpoint is not local. Its storage needs a separate policy.' }
    }
} finally {
    $env:USERPROFILE = $ocvOriginalProfile
    $env:APPDATA = $ocvOriginalAppData
    $env:LOCALAPPDATA = $ocvOriginalLocalAppData
}
if (-not $ocvStorageGuard) {
    Write-Output 'PASS: Linux Docker Engine is available. No optional host disk or WSL policy is enabled; no host settings were changed.'
    exit 0
}
$ocvPolicy = $ocvRuntimeConfig.dockerStorage
if (-not $ocvPolicy.dataRoot -or -not $ocvPolicy.swapFile -or -not @($ocvPolicy.allowedWslMemoryGiB).Count) { throw 'storageGuard requires dockerStorage.dataRoot, swapFile and allowedWslMemoryGiB in the private runtime configuration.' }
function Resolve-OcvPolicyPath([string]$Value) {
    if (-not [IO.Path]::IsPathRooted($Value)) { $Value = Join-Path $ocvProjectRoot $Value }
    return [IO.Path]::GetFullPath($Value).TrimEnd('\')
}
function Test-OcvSamePath([string]$First, [string]$Second) {
    return (Resolve-OcvPolicyPath $First) -eq (Resolve-OcvPolicyPath $Second)
}
$ocvExpectedData = Resolve-OcvPolicyPath ([string]$ocvPolicy.dataRoot)
$ocvExpectedSwap = Resolve-OcvPolicyPath ([string]$ocvPolicy.swapFile)
$ocvSettingsPath = if ($ocvPolicy.settingsPath) { Resolve-OcvPolicyPath ([string]$ocvPolicy.settingsPath) } elseif ($ocvDesktopHome) { Join-Path $ocvDesktopHome 'appdata/Roaming/Docker/settings-store.json' } else { Join-Path $env:APPDATA 'Docker/settings-store.json' }
if (-not (Test-Path -LiteralPath $ocvSettingsPath)) { throw 'Cannot find the selected Docker Desktop settings; storage remains unverified.' }
$ocvSettings = Get-Content -LiteralPath $ocvSettingsPath -Raw | ConvertFrom-Json
$ocvInstallSettingsPath = if ($ocvPolicy.installSettingsPath) { Resolve-OcvPolicyPath ([string]$ocvPolicy.installSettingsPath) } else { Join-Path $env:ProgramData 'DockerDesktop/install-settings.json' }
if (-not (Test-Path -LiteralPath $ocvInstallSettingsPath)) { throw 'Docker Desktop installation settings are missing.' }
$ocvInstallSettings = Get-Content -LiteralPath $ocvInstallSettingsPath -Raw | ConvertFrom-Json
$ocvDataFolder = if ($ocvSettings.wslDefaultDataRoot) { [string]$ocvSettings.wslDefaultDataRoot } else { [string]$ocvInstallSettings.wslDefaultDataRoot }
if (-not $ocvInstallSettings.wslEngineEnabled -or -not $ocvDataFolder -or -not (Test-OcvSamePath $ocvDataFolder $ocvExpectedData)) { throw 'The effective WSL data root does not match the configured storage policy. No pull/build is permitted.' }
if ($ocvSettings.dataFolder -and -not (Test-OcvSamePath ([string]$ocvSettings.dataFolder) $ocvExpectedData)) { throw 'A conflicting dataFolder override exists.' }
$ocvWslRegistration = @(Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss' | Get-ItemProperty | Where-Object DistributionName -eq 'docker-desktop')
$ocvExpectedBoot = Join-Path $ocvExpectedData 'main'
if ($ocvWslRegistration.Count -ne 1 -or $ocvWslRegistration[0].Version -ne 2 -or -not (Test-OcvSamePath ([string]$ocvWslRegistration[0].BasePath).Replace('\\?\','') $ocvExpectedBoot)) { throw 'The actual docker-desktop WSL registration does not point to the configured boot disk.' }
$ocvDisks = @(Get-ChildItem -LiteralPath $ocvExpectedData -Filter '*.vhdx' -Recurse -File)
if (-not (Test-Path -LiteralPath (Join-Path $ocvExpectedData 'disk/docker_data.vhdx')) -or -not (Test-Path -LiteralPath (Join-Path $ocvExpectedData 'main/ext4.vhdx'))) { throw 'The actual Docker data and boot VHDX files are missing at the configured location.' }
$ocvDefaultDockerData = Join-Path $env:LOCALAPPDATA 'Docker/wsl'
if (-not (Test-OcvSamePath $ocvDefaultDockerData $ocvExpectedData) -and (Test-Path -LiteralPath $ocvDefaultDockerData)) {
    $ocvDefaultDisks = @(Get-ChildItem -LiteralPath $ocvDefaultDockerData -Filter '*.vhdx' -Recurse -File)
    if ($ocvDefaultDisks.Count -gt 0) { throw 'Another Docker VHDX exists in the normal user profile. Investigate explicitly; no disk is deleted automatically.' }
}
$ocvWslConfigPath = if ($ocvPolicy.wslConfigPath) { Resolve-OcvPolicyPath ([string]$ocvPolicy.wslConfigPath) } else { Join-Path $env:USERPROFILE '.wslconfig' }
if (-not (Test-Path -LiteralPath $ocvWslConfigPath)) { throw 'The opted-in WSL memory and swap configuration is missing.' }
$ocvConfig = Get-Content -LiteralPath $ocvWslConfigPath -Raw
$ocvMemoryMatch = [regex]::Match($ocvConfig, '(?mi)^memory\s*=\s*(\d+)GB\s*$')
$ocvSwapMatch = [regex]::Match($ocvConfig, '(?mi)^swapFile\s*=\s*(.+?)\s*$')
$ocvAllowedMemory = @($ocvPolicy.allowedWslMemoryGiB | ForEach-Object { [int]$_ })
if (-not $ocvMemoryMatch.Success -or [int]$ocvMemoryMatch.Groups[1].Value -notin $ocvAllowedMemory -or -not $ocvSwapMatch.Success -or -not (Test-OcvSamePath $ocvSwapMatch.Groups[1].Value.Replace('\\','\') $ocvExpectedSwap)) { throw 'The active WSL memory or swap path does not match the private policy.' }
$ocvExpectedBytes = [int64]$ocvMemoryMatch.Groups[1].Value * 1GB
if ([int64]$ocvInfo.MemTotal -gt ($ocvExpectedBytes + 64MB)) { throw 'The running WSL VM exceeds its intended limit. Restart it explicitly when convenient; this script does not stop it.' }
$ocvReport = [ordered]@{ verifiedAt=[DateTime]::UtcNow.ToString('o'); engineId=$ocvInfo.ID; dockerRootDir=$ocvInfo.DockerRootDir; settingsPath=$ocvSettingsPath; installSettingsPath=$ocvInstallSettingsPath; registeredWslBasePath=$ocvWslRegistration[0].BasePath; dataFolder=$ocvDataFolder; disks=@($ocvDisks.FullName); wslConfig=$ocvWslConfigPath; actualVmMemoryBytes=$ocvInfo.MemTotal; imagesBeforeVerification=$ocvInfo.Images; pullPermitted=$true }
$ocvReport | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $ocvDependencyRoot 'runtime/reports/docker-storage.json') -Encoding UTF8
Write-Output 'PASS: the local Docker engine, actual data/boot disks and bounded WSL/swap settings match the opted-in private storage policy.'

