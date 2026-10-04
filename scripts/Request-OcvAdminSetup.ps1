$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Enter-OcvEnvironment.ps1')
$ocvSetupPath = Join-Path $PSScriptRoot 'Install-OcvRuntime.ps1'
$ocvArguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"{0}"' -f $ocvSetupPath), '-AcceptSystemComponentWrites')
$ocvAdmin = Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Verb RunAs -ArgumentList $ocvArguments -WindowStyle Hidden -PassThru -Wait
Write-Output "Administrator setup exited with code $($ocvAdmin.ExitCode). Logs: F:\OCVdeps\runtime\logs\setup-admin.log"
if (Test-Path -LiteralPath 'F:\OCVdeps\runtime\reports\setup-admin-error.txt') { Get-Content -LiteralPath 'F:\OCVdeps\runtime\reports\setup-admin-error.txt' }
if (Test-Path -LiteralPath 'F:\OCVdeps\runtime\reports\setup-needs-restart.txt') { Get-Content -LiteralPath 'F:\OCVdeps\runtime\reports\setup-needs-restart.txt' }

