$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Enter-OcvEnvironment.ps1')
$ocvProjectRoot = Split-Path $PSScriptRoot -Parent
# This is local development setup, never imported by public application code.
$ocvThirdPhaseLinks = @{
    'config\apps\web2\node_modules' = 'pnpm\modules\next-but-was-excel'
    'config\apps\ng\node_modules' = 'pnpm\modules\angular-1999'
    'config\apps\web2\.next' = 'cache\next\next-but-was-excel'
    'config\apps\ng\.angular' = 'cache\angular\angular-1999'
}
foreach ($ocvLocalLink in $ocvThirdPhaseLinks.GetEnumerator()) {
    $ocvDestination = Join-Path $env:OCV_DEPS_ROOT $ocvLocalLink.Value
    $ocvSource = Join-Path $ocvProjectRoot $ocvLocalLink.Key
    New-Item -ItemType Directory -Path $ocvDestination -Force | Out-Null
    New-Item -ItemType Directory -Path (Split-Path $ocvSource -Parent) -Force | Out-Null
    if (Test-Path -LiteralPath $ocvSource) {
        $ocvExisting = Get-Item -LiteralPath $ocvSource -Force
        if ($ocvExisting.LinkType -ne 'Junction' -or $ocvExisting.Target -notcontains $ocvDestination) { throw "Unexpected existing path: $ocvSource" }
    } else { New-Item -ItemType Junction -Path $ocvSource -Target $ocvDestination | Out-Null }
}
