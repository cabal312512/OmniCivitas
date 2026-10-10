param([switch]$CheckOnly, [switch]$NoOpen, [switch]$NoRunner)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Enter-OcvEnvironment.ps1')
$ocvNode = Resolve-OcvTool 'node'
$ocvIdentity = [Security.Cryptography.SHA256]::Create()
$ocvHash = [BitConverter]::ToString($ocvIdentity.ComputeHash([Text.Encoding]::UTF8.GetBytes($ocvProjectRoot.ToLowerInvariant()))).Replace('-', '').Substring(0, 24)
$ocvIdentity.Dispose()
$ocvMutex = [Threading.Mutex]::new($false, ('Local\OmniCivitasWebsite-' + $ocvHash))
$ocvLocked = $false
try {
    try { $ocvLocked = $ocvMutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $ocvLocked = $true }
    if (-not $ocvLocked) { Write-Output 'OmniCivitas is already starting in another window.'; return }
    Push-Location $ocvProjectRoot
    try {
        $ocvArguments = @((Join-Path $PSScriptRoot 'start-website.mjs'))
        if ($CheckOnly) { $ocvArguments += '--check' }
        if ($NoOpen) { $ocvArguments += '--no-open' }
        if ($NoRunner) { $ocvArguments += '--no-runner' }
        & $ocvNode @ocvArguments
        if ($LASTEXITCODE -ne 0) { throw ('Website startup failed with exit code ' + $LASTEXITCODE + '. Persistent data has been preserved.') }
    } finally { Pop-Location }
} finally {
    if ($ocvLocked) { $ocvMutex.ReleaseMutex() }
    $ocvMutex.Dispose()
}
