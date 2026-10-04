$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Enter-OcvEnvironment.ps1')
$ocvDocker = 'F:\OCVdeps\docker-app\resources\bin\docker.exe'
if (-not (Test-Path -LiteralPath $ocvDocker)) { throw 'Docker is not installed under F:\OCVdeps\docker-app. No pull/build is permitted.' }
if ($env:DOCKER_HOST -or $env:DOCKER_CONTEXT) { throw 'A Docker endpoint override is set. Verify it explicitly; it cannot use the local F: storage attestation.' }
$ocvOriginalProfile = $env:USERPROFILE
$ocvOriginalAppData = $env:APPDATA
$ocvOriginalLocalAppData = $env:LOCALAPPDATA
try {
    # Even metadata/version probes can write CLI-plugin logs. Keep those on F:
    # too, then restore the real profile before inspecting global WSL settings.
    $env:USERPROFILE='F:\OCVdeps\docker-desktop'
    $env:APPDATA='F:\OCVdeps\docker-desktop\appdata\Roaming'
    $env:LOCALAPPDATA='F:\OCVdeps\docker-desktop\appdata\Local'
    $ocvInfoText = & $ocvDocker info --format '{{json .}}' 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'Docker is not ready. Start Docker Desktop; no pull/build was attempted.' }
    $ocvInfo = $ocvInfoText | ConvertFrom-Json
    if ($ocvInfo.OSType -ne 'linux' -or $ocvInfo.OperatingSystem -notmatch 'Docker Desktop') { throw 'The active daemon is not the intended local Linux Docker Desktop engine.' }
    $ocvContextText = & $ocvDocker context inspect
    if ($LASTEXITCODE -ne 0) { throw 'Cannot identify the Docker endpoint.' }
    $ocvContext = @($ocvContextText | ConvertFrom-Json)[0]
    if ($ocvContext.Endpoints.docker.Host -notmatch '^npipe:') { throw 'The Docker endpoint is not local. Its storage needs separate verification.' }
} finally {
    $env:USERPROFILE=$ocvOriginalProfile
    $env:APPDATA=$ocvOriginalAppData
    $env:LOCALAPPDATA=$ocvOriginalLocalAppData
}
$ocvSettingsCandidates = @('F:\OCVdeps\docker-desktop\appdata\Roaming\Docker\settings-store.json')
$ocvSettingsPath = $ocvSettingsCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $ocvSettingsPath) { throw 'Cannot find active Docker Desktop settings; storage is unverified.' }
$ocvSettings = Get-Content -LiteralPath $ocvSettingsPath -Raw | ConvertFrom-Json
# Current Docker Desktop stores only user overrides in settings-store.json.
# WSL storage defaults come from the install-settings provider; dataFolder is
# also used by other backends, so verify the actual registered WSL boot disk.
$ocvInstallSettingsPath = 'C:\ProgramData\DockerDesktop\install-settings.json'
if (-not (Test-Path -LiteralPath $ocvInstallSettingsPath)) { throw 'WSL installation settings are missing.' }
$ocvInstallSettings = Get-Content -LiteralPath $ocvInstallSettingsPath -Raw | ConvertFrom-Json
$ocvDataFolder = if ($ocvSettings.wslDefaultDataRoot) { [string]$ocvSettings.wslDefaultDataRoot } else { [string]$ocvInstallSettings.wslDefaultDataRoot }
if (-not $ocvInstallSettings.wslEngineEnabled -or -not $ocvDataFolder -or [IO.Path]::GetFullPath($ocvDataFolder).TrimEnd('\') -ne 'F:\OCVdeps\docker-data') { throw "Effective WSL data root is unverified (found: $ocvDataFolder). Do not pull images." }
if ($ocvSettings.dataFolder -and [IO.Path]::GetFullPath([string]$ocvSettings.dataFolder).TrimEnd('\') -ne 'F:\OCVdeps\docker-data') { throw 'A conflicting dataFolder override exists. Investigate before pulling.' }
$ocvWslRegistration = @(Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss' | Get-ItemProperty | Where-Object DistributionName -eq 'docker-desktop')
if ($ocvWslRegistration.Count -ne 1 -or $ocvWslRegistration[0].Version -ne 2 -or ([string]$ocvWslRegistration[0].BasePath).Replace('\\?\','').TrimEnd('\') -ne 'F:\OCVdeps\docker-data\main') { throw 'The actual docker-desktop WSL registration does not point to the F: boot disk.' }
$ocvDisks = @(Get-ChildItem -LiteralPath 'F:\OCVdeps\docker-data' -Filter '*.vhdx' -Recurse -File)
if (-not (Test-Path -LiteralPath 'F:\OCVdeps\docker-data\disk\docker_data.vhdx') -or -not (Test-Path -LiteralPath 'F:\OCVdeps\docker-data\main\ext4.vhdx')) { throw 'The actual Docker data and boot VHDX files are missing at F:.' }
$ocvDefaultDockerData = Join-Path $env:LOCALAPPDATA 'Docker\wsl'
if (Test-Path -LiteralPath $ocvDefaultDockerData) {
    $ocvDefaultDisks = @(Get-ChildItem -LiteralPath $ocvDefaultDockerData -Filter '*.vhdx' -Recurse -File)
    if ($ocvDefaultDisks.Count -gt 0) { throw 'A Docker VHDX exists in the default user-profile location. Investigate before pulling images; do not delete it automatically.' }
}
$ocvWslConfigPath = Join-Path $env:USERPROFILE '.wslconfig'
if (-not (Test-Path -LiteralPath $ocvWslConfigPath)) { throw 'WSL memory and swap configuration is missing.' }
$ocvConfig = Get-Content -LiteralPath $ocvWslConfigPath -Raw
if ($ocvConfig -notmatch '(?m)^memory=(9|11)GB\s*$' -or $ocvConfig -notmatch 'swapFile=F:\\\\OCVdeps\\\\wsl\\\\swap.vhdx') { throw 'WSL memory/swap locations are not the expected bounded F: configuration.' }
$ocvMemoryMatch = [regex]::Match($ocvConfig, '(?m)^memory=(9|11)GB\s*$')
$ocvExpectedBytes = [int64]$ocvMemoryMatch.Groups[1].Value * 1GB
if ([int64]$ocvInfo.MemTotal -gt ($ocvExpectedBytes + 64MB)) { throw 'The running WSL VM exceeds its intended limit. Restart WSL explicitly and recheck before starting services.' }
$ocvReport = [ordered]@{ verifiedAt=[DateTime]::UtcNow.ToString('o'); engineId=$ocvInfo.ID; dockerRootDir=$ocvInfo.DockerRootDir; settingsPath=$ocvSettingsPath; installSettingsPath=$ocvInstallSettingsPath; registeredWslBasePath=$ocvWslRegistration[0].BasePath; dataFolder=$ocvDataFolder; disks=@($ocvDisks.FullName); wslConfig=$ocvWslConfigPath; actualVmMemoryBytes=$ocvInfo.MemTotal; imagesBeforeVerification=$ocvInfo.Images; pullPermitted=$true }
$ocvReport | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath 'F:\OCVdeps\runtime\reports\docker-storage.json' -Encoding UTF8
Write-Host 'PASS: local Docker engine, active F: dataFolder, real F: VHDX, bounded WSL config and F: swap verified. Pull/build is now permitted for selected services.'

