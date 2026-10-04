param([string]$Group='phase2', [string]$ReportName='phase2-memory.json')
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Enter-OcvEnvironment.ps1')
$ocvProcesses=@(Get-Process | Where-Object { $_.ProcessName -eq 'vmmemWSL' -or $_.ProcessName -like '*docker*' } | ForEach-Object { [pscustomobject][ordered]@{name=$_.ProcessName;id=$_.Id;workingSetMiB=[Math]::Round($_.WorkingSet64/1MB,1)} })
$ocvTotal=($ocvProcesses|Measure-Object -Property workingSetMiB -Sum).Sum
$ocvSample=[ordered]@{sampledAt=[DateTime]::UtcNow.ToString('o');group=$Group;totalWorkingSetMiB=$ocvTotal;processes=$ocvProcesses;note='Observed Windows working sets; file cache included, shared pages can be counted twice, not a long-term peak guarantee.'}
if ($ReportName -notmatch '^(phase[0-9]|names|expand)-memory\.json$') { throw 'Use an allowed memory report basename.' }
$ocvFile=Join-Path $env:OCV_DEPS_ROOT ('runtime\reports\' + $ReportName)
$ocvSamples=@();if(Test-Path -LiteralPath $ocvFile){$ocvSamples=@(Get-Content -LiteralPath $ocvFile -Raw|ConvertFrom-Json)}
foreach($ocvPast in $ocvSamples){if($null -eq $ocvPast.totalWorkingSetMiB){$ocvPast.totalWorkingSetMiB=($ocvPast.processes|Measure-Object -Property workingSetMiB -Sum).Sum}}
$ocvSamples=@($ocvSamples|Select-Object -Last 19)+@($ocvSample)
ConvertTo-Json -InputObject $ocvSamples -Depth 5 | Set-Content -LiteralPath $ocvFile -Encoding UTF8
Write-Output "Observed Docker/WSL working sets: $ocvTotal MiB ($Group)."
