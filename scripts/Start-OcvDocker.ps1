$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Enter-OcvEnvironment.ps1')
$ocvDesktop = 'F:\OCVdeps\docker-app\Docker Desktop.exe'
if (-not (Test-Path -LiteralPath $ocvDesktop)) { throw 'Install the F: runtime first.' }
$ocvOldAppData = $env:APPDATA
$ocvOldLocalAppData = $env:LOCALAPPDATA
$ocvOldUserDataOverride = $env:PINATA_USER_DATA_DIR_OVERRIDE
$ocvOldUserProfile = $env:USERPROFILE
try {
    # Docker's atomic settings writes fail when its encrypted C: settings and
    # temporary directory are on different disks. Isolate only Docker children;
    # leave the Windows profile and all other applications unchanged.
    $env:APPDATA = 'F:\OCVdeps\docker-desktop\appdata\Roaming'
    $env:LOCALAPPDATA = 'F:\OCVdeps\docker-desktop\appdata\Local'
    # The bundled Desktop frontend explicitly reads this override; its launcher
    # does not forward a Chromium --user-data-dir argument to the frontend.
    $env:PINATA_USER_DATA_DIR_OVERRIDE = 'F:\OCVdeps\docker-desktop\electron'
    # The bundled frontend builds its log/crash/extension paths from Node's
    # Windows homedir (USERPROFILE), ignoring APPDATA for those particular paths.
    # This override applies to Docker children only; it never changes the real
    # Windows account/profile, HOME, registry or another application's process.
    $env:USERPROFILE = 'F:\OCVdeps\docker-desktop'
    Copy-Item -LiteralPath (Join-Path $ocvOldUserProfile '.wslconfig') -Destination 'F:\OCVdeps\docker-desktop\.wslconfig' -Force
    New-Item -ItemType Directory -Path $env:APPDATA,$env:LOCALAPPDATA -Force | Out-Null
    Start-Process -FilePath $ocvDesktop -ArgumentList '--user-data-dir=F:\OCVdeps\docker-desktop\electron' -WindowStyle Hidden
} finally {
    $env:APPDATA = $ocvOldAppData
    $env:LOCALAPPDATA = $ocvOldLocalAppData
    $env:PINATA_USER_DATA_DIR_OVERRIDE = $ocvOldUserDataOverride
    $env:USERPROFILE = $ocvOldUserProfile
}
Write-Output 'Docker Desktop launched with F: process-specific settings, logs and caches. Storage verification is still required before pull/build.'
