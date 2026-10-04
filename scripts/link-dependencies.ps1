$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Enter-OcvEnvironment.ps1')
$ocvProject = Split-Path $PSScriptRoot -Parent
$ocvLinks = @{
    'node_modules' = 'F:\OCVdeps\pnpm\modules\root'
    'config/apps\portal\node_modules' = 'F:\OCVdeps\pnpm\modules\portal'
    'services\gateway\node_modules' = 'F:\OCVdeps\pnpm\modules\gateway'
    'services\archive\node_modules' = 'F:\OCVdeps\pnpm\modules\archive'
    'config/apps\portal\.astro' = 'F:\OCVdeps\cache\astro\portal'
}
foreach ($ocvLink in $ocvLinks.GetEnumerator()) {
    $ocvLinkPath = Join-Path $ocvProject $ocvLink.Key
    New-Item -ItemType Directory -Path $ocvLink.Value -Force | Out-Null
    New-Item -ItemType Directory -Path (Split-Path $ocvLinkPath -Parent) -Force | Out-Null
    if (Test-Path -LiteralPath $ocvLinkPath) {
        $ocvExisting = Get-Item -LiteralPath $ocvLinkPath -Force
        if ($ocvExisting.LinkType -ne 'Junction' -or $ocvExisting.Target -notcontains $ocvLink.Value) { throw "Existing path is not the expected F: junction: $ocvLinkPath" }
    } else { New-Item -ItemType Junction -Path $ocvLinkPath -Target $ocvLink.Value | Out-Null }
}
