$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Enter-OcvEnvironment.ps1')
Start-Transcript -Path 'F:\OCVdeps\runtime\logs\docker-cli-migration.log' -Append | Out-Null
trap { $_.Exception.Message | Set-Content 'F:\OCVdeps\runtime\reports\docker-cli-migration-error.txt' -Encoding UTF8; Stop-Transcript -ErrorAction SilentlyContinue | Out-Null; exit 1 }
$ocvSource = [IO.Path]::GetFullPath('C:\Program Files\Docker\cli-plugins')
$ocvDestination = [IO.Path]::GetFullPath('F:\OCVdeps\docker-desktop\global-cli-plugins')
if ($ocvSource -ne 'C:\Program Files\Docker\cli-plugins' -or $ocvDestination -ne 'F:\OCVdeps\docker-desktop\global-cli-plugins') { throw 'Unexpected migration paths.' }
$ocvItem = Get-Item -LiteralPath $ocvSource
if ($ocvItem.LinkType -eq 'Junction') {
    if ([string]$ocvItem.Target -ne $ocvDestination) { throw 'Unexpected existing junction.' }
} else {
    foreach ($ocvFile in @(Get-ChildItem -LiteralPath $ocvSource -File)) {
        $ocvInstalled = Join-Path 'F:\OCVdeps\docker-app\resources\cli-plugins' $ocvFile.Name
        if (-not (Test-Path -LiteralPath $ocvInstalled) -or (Get-FileHash -LiteralPath $ocvFile.FullName).Hash -ne (Get-FileHash -LiteralPath $ocvInstalled).Hash) { throw 'Unexpected global plugin; stop rather than moving unrelated software.' }
    }
    if (Test-Path -LiteralPath $ocvDestination) {
        foreach ($ocvFile in @(Get-ChildItem -LiteralPath $ocvSource -File)) {
            $ocvTarget = Join-Path $ocvDestination $ocvFile.Name
            if (-not [IO.Path]::GetFullPath($ocvTarget).StartsWith('F:\OCVdeps\docker-desktop\global-cli-plugins\')) { throw 'Unexpected target file.' }
            if (Test-Path -LiteralPath $ocvTarget) {
                if ((Get-FileHash -LiteralPath $ocvTarget).Hash -ne (Get-FileHash -LiteralPath $ocvFile.FullName).Hash) { throw 'Existing destination differs.' }
            }
            Move-Item -LiteralPath $ocvFile.FullName -Destination $ocvTarget -Force
        }
    } else { Move-Item -LiteralPath $ocvSource -Destination $ocvDestination }
    New-Item -ItemType Junction -Path $ocvSource -Target $ocvDestination | Out-Null
}
Write-Output 'PASS: global CLI plugins physically reside on F:; C: keeps only a compatibility junction.'
Stop-Transcript | Out-Null
