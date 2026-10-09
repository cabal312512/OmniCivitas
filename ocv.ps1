param([Parameter(ValueFromRemainingArguments = $true)][string[]]$OcvArguments)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'scripts\Enter-OcvEnvironment.ps1')
$ocvNode = Resolve-OcvTool 'node'
$ocvPnpm = Resolve-OcvTool 'pnpm'
Push-Location $PSScriptRoot
try { if ($ocvPnpm -match '\.(cjs|mjs|js)$') { & $ocvNode $ocvPnpm @OcvArguments } else { & $ocvPnpm @OcvArguments }; $ocvExit = $LASTEXITCODE }
finally { Pop-Location }
exit $ocvExit
