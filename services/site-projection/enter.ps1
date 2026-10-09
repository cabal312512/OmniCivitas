$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../../scripts/Enter-OcvEnvironment.ps1')
$ocvProjectionCache = Join-Path $env:OCV_DEPS_ROOT 'cache/elixir/site-projection'
$ocvProjectionLocations = @{
    MIX_HOME = (Join-Path $ocvProjectionCache 'mix')
    HEX_HOME = (Join-Path $ocvProjectionCache 'hex')
    MIX_DEPS_PATH = (Join-Path $ocvProjectionCache 'deps')
    MIX_BUILD_PATH = (Join-Path $ocvProjectionCache 'build')
}
foreach ($ocvProjectionEntry in $ocvProjectionLocations.GetEnumerator()) {
    New-Item -ItemType Directory -Path $ocvProjectionEntry.Value -Force | Out-Null
    Set-Item -Path ('Env:' + $ocvProjectionEntry.Key) -Value $ocvProjectionEntry.Value
}
$env:ERL_FLAGS = '+S 2:2 +SDcpu 1 +SDio 1 +A 2'
