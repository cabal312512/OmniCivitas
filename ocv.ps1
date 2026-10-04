param([Parameter(ValueFromRemainingArguments = $true)][string[]]$OcvArguments)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'scripts\Enter-OcvEnvironment.ps1')
$ocvNode = 'F:\OCVdeps\tools\node\node.exe'
$ocvPnpm = 'F:\OCVdeps\tools\pnpm\bin\pnpm.cjs'
if (-not (Test-Path -LiteralPath $ocvNode) -or -not (Test-Path -LiteralPath $ocvPnpm)) { throw 'Portable tools are not initialized. See README.md.' }
Push-Location $PSScriptRoot
try { & $ocvNode $ocvPnpm @OcvArguments; $ocvExit = $LASTEXITCODE }
finally { Pop-Location }
exit $ocvExit
