param([switch]$AcceptSystemComponentWrites)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Enter-OcvEnvironment.ps1')
Start-Transcript -Path 'F:\OCVdeps\runtime\logs\setup-admin.log' -Append | Out-Null
trap {
    $_.Exception.Message | Set-Content -LiteralPath 'F:\OCVdeps\runtime\reports\setup-admin-error.txt' -Encoding UTF8
    Write-Error $_.Exception.Message -ErrorAction Continue
    Stop-Transcript -ErrorAction SilentlyContinue | Out-Null
    exit 1
}
$ocvIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$ocvPrincipal = New-Object Security.Principal.WindowsPrincipal($ocvIdentity)
if (-not $ocvPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Open PowerShell as Administrator and run this script. It never restarts Windows automatically.' }
if (-not $AcceptSystemComponentWrites) {
    throw 'WSL requires Windows system components, registry/service entries and Windows Installer maintenance caches on the system drive. Project binaries, downloads, data disks, swap and ordinary caches use F:. Read docs/SETUP.md before explicitly adding -AcceptSystemComponentWrites.'
}
$ocvManifestPath = 'F:\OCVdeps\downloads\runtime-installers.json'
if (-not (Test-Path -LiteralPath $ocvManifestPath)) { throw 'Installer downloads are not finished. No installation was attempted.' }
$ocvManifest = Get-Content -LiteralPath $ocvManifestPath -Raw | ConvertFrom-Json
foreach ($ocvInstaller in @($ocvManifest.files | Where-Object { $_.kind -eq 'administrator-install' })) {
    if (-not (Test-Path -LiteralPath $ocvInstaller.path)) { throw "Missing installer: $($ocvInstaller.name)" }
    if ((Get-FileHash -LiteralPath $ocvInstaller.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ocvInstaller.sha256) { throw "Installer checksum changed: $($ocvInstaller.name)" }
    $ocvSignature = Get-AuthenticodeSignature -LiteralPath $ocvInstaller.path
    if ($ocvSignature.Status -ne 'Valid') { throw "Installer signature is not valid: $($ocvInstaller.name) ($($ocvSignature.Status))" }
    if ($ocvInstaller.name -like 'wsl.*' -and $ocvSignature.SignerCertificate.Subject -notmatch 'Microsoft Corporation') { throw 'Unexpected WSL publisher.' }
    if ($ocvInstaller.name -eq 'DockerDesktopInstaller.exe' -and $ocvSignature.SignerCertificate.Subject -notmatch 'Docker') { throw 'Unexpected Docker publisher.' }
}
if (@($ocvManifest.files | Where-Object { $_.name -eq 'DockerDesktopInstaller.exe' }).Count -ne 1) { throw 'Docker installer download is not complete.' }

$ocvConfigPath = Join-Path $env:USERPROFILE '.wslconfig'
if (Test-Path -LiteralPath $ocvConfigPath) {
    $ocvOldConfig = Get-Content -LiteralPath $ocvConfigPath -Raw
    if ($ocvOldConfig -notmatch 'OmniCivitas managed configuration') { throw 'An existing unrelated .wslconfig was found. Merge explicitly rather than overwriting it.' }
    Copy-Item -LiteralPath $ocvConfigPath -Destination 'F:\OCVdeps\runtime\backups\wslconfig-before-setup.txt' -Force
}
$ocvConfig = @'
# OmniCivitas managed configuration; small unavoidable user-profile config.
[wsl2]
memory=9GB
processors=6
swap=2GB
swapFile=F:\\OCVdeps\\wsl\\swap.vhdx
guiApplications=false
maxCrashDumpCount=0

[experimental]
autoMemoryReclaim=gradual
'@
[IO.File]::WriteAllText($ocvConfigPath, $ocvConfig, (New-Object Text.UTF8Encoding($false)))

$ocvNeedsRestart = $false
$ocvFeature = Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform
if ($ocvFeature.State -ne 'Enabled') {
    $ocvFeatureResult = Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -All -NoRestart -LogPath 'F:\OCVdeps\runtime\logs\windows-feature.log' -ScratchDirectory 'F:\OCVdeps\tmp'
    $ocvNeedsRestart = [bool]$ocvFeatureResult.RestartNeeded
}
$ocvWslInstaller = @($ocvManifest.files | Where-Object { $_.name -match '^wsl\..*\.x64\.msi$' })[0]
if (-not (Test-Path -LiteralPath 'F:\OCVdeps\wsl-app\wslservice.exe')) {
    $ocvMsiArguments = @('/i', ('"{0}"' -f $ocvWslInstaller.path), 'INSTALLDIR=F:\OCVdeps\wsl-app', '/qn', '/norestart', '/L*v', 'F:\OCVdeps\runtime\logs\wsl-install.log')
    $ocvMsi = Start-Process -FilePath 'msiexec.exe' -ArgumentList $ocvMsiArguments -PassThru -Wait -WindowStyle Hidden
    if ($ocvMsi.ExitCode -notin @(0,3010)) { throw "WSL installation failed: $($ocvMsi.ExitCode). See F:\OCVdeps\runtime\logs\wsl-install.log" }
    if ($ocvMsi.ExitCode -eq 3010) { $ocvNeedsRestart = $true }
}
if (-not (Test-Path -LiteralPath 'F:\OCVdeps\wsl-app\wslservice.exe')) { throw 'WSL was not installed at the requested F: location. Stop and investigate; do not install Docker.' }
if ($ocvNeedsRestart) {
    Write-Host 'Windows needs a restart to enable WSL2. Save your work and restart manually, then run this same script again. Docker has NOT been installed and no images have been pulled.'
    [IO.File]::WriteAllText('F:\OCVdeps\runtime\reports\setup-needs-restart.txt', 'Restart Windows manually, then rerun Install-OcvRuntime.ps1 -AcceptSystemComponentWrites.')
    Stop-Transcript | Out-Null
    exit 3010
}
$ocvDockerInstaller = @($ocvManifest.files | Where-Object { $_.name -eq 'DockerDesktopInstaller.exe' })[0]
if (-not (Test-Path -LiteralPath 'F:\OCVdeps\docker-app\Docker Desktop.exe')) {
    $ocvDockerArguments = @('install', '--quiet', '--accept-license', '--installation-dir=F:\OCVdeps\docker-app', '--wsl-default-data-root=F:\OCVdeps\docker-data', '--backend=wsl-2', '--no-windows-containers')
    $ocvDockerInstall = Start-Process -FilePath $ocvDockerInstaller.path -ArgumentList $ocvDockerArguments -PassThru -Wait -WindowStyle Hidden
    if ($ocvDockerInstall.ExitCode -notin @(0,3010)) { throw "Docker installation failed: $($ocvDockerInstall.ExitCode). Do not pull images." }
    if ($ocvDockerInstall.ExitCode -eq 3010) { Write-Host 'Docker requested a restart. Save work, restart manually, then rerun this script.'; exit 3010 }
}
Write-Host 'Runtime installation is ready. Start Docker Desktop from F:\OCVdeps\docker-app\Docker Desktop.exe using your normal Windows account. No images have been pulled. Storage confirmation is still required.'
if (Test-Path -LiteralPath 'F:\OCVdeps\runtime\reports\setup-needs-restart.txt') { Remove-Item -LiteralPath 'F:\OCVdeps\runtime\reports\setup-needs-restart.txt' }
Stop-Transcript | Out-Null

