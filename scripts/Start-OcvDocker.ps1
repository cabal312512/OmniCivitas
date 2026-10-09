$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Enter-OcvEnvironment.ps1')
$ocvNode = Resolve-OcvTool 'node'
& $ocvNode (Join-Path $PSScriptRoot 'start-docker.mjs')
exit $LASTEXITCODE
