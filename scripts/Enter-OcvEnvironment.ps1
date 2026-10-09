$ErrorActionPreference = 'Stop'
$ocvProjectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$ocvConfigPath = if ($env:OCV_RUNTIME_CONFIG) { $env:OCV_RUNTIME_CONFIG } else { Join-Path $ocvProjectRoot 'config/runtime.local.json' }
if (-not [IO.Path]::IsPathRooted($ocvConfigPath)) { $ocvConfigPath = Join-Path $ocvProjectRoot $ocvConfigPath }
$ocvRuntimeConfig = if (Test-Path -LiteralPath $ocvConfigPath) { Get-Content -LiteralPath $ocvConfigPath -Raw | ConvertFrom-Json } else { [PSCustomObject]@{} }
if ($env:OCV_RUNTIME_CONFIG -and -not (Test-Path -LiteralPath $ocvConfigPath)) { throw 'The explicitly selected runtime configuration does not exist.' }
$ocvDependencyRoot = if ($env:OCV_DEPS_ROOT) { $env:OCV_DEPS_ROOT } elseif ($ocvRuntimeConfig.depsRoot) { [string]$ocvRuntimeConfig.depsRoot } else { Join-Path $ocvProjectRoot '.ocv-runtime' }
if (-not [IO.Path]::IsPathRooted($ocvDependencyRoot)) { $ocvDependencyRoot = Join-Path $ocvProjectRoot $ocvDependencyRoot }
$ocvDependencyRoot = [IO.Path]::GetFullPath($ocvDependencyRoot)
$ocvStorageGuard = $ocvRuntimeConfig.storageGuard -eq $true -or $env:OCV_LOCAL_STORAGE_GUARD -eq '1'
$ocvDirectories = @('tools', 'downloads', 'tmp', 'pnpm\bin', 'pnpm\store', 'pnpm\virtual-store\omnicivitas', 'pnpm\modules\root', 'pnpm\modules\portal', 'pnpm\modules\gateway', 'cache\npm', 'cache\node-gyp', 'cache\node-compile', 'cache\nx\native', 'cache\nx\workspace', 'cache\nx\tasks', 'cache\corepack', 'cache\xdg', 'cache\playwright', 'cache\cypress', 'cache\pip', 'cache\pycache', 'cache\go\mod', 'cache\go\build', 'cache\gradle', 'cache\maven', 'cache\nuget', 'cache\dotnet', 'cache\composer', 'cache\gems', 'docker-config', 'docker-data', 'wsl', 'runtime\logs', 'runtime\reports', 'runtime\backups')
if ($ocvStorageGuard -and -not (Test-Path -LiteralPath ([IO.Path]::GetPathRoot($ocvDependencyRoot)))) { throw 'The configured dependency drive is unavailable; no storage fallback is permitted.' }
foreach ($ocvDirectory in $ocvDirectories) { New-Item -ItemType Directory -Path (Join-Path $ocvDependencyRoot $ocvDirectory) -Force | Out-Null }
$ocvEnvironment = @{
    OCV_DEPS_ROOT = $ocvDependencyRoot
    OCV_LOCAL_STORAGE_GUARD = $(if ($ocvStorageGuard) {'1'} else {'0'})
    OCV_LOG_DIR = "$ocvDependencyRoot\runtime\logs"
    OCV_STORE_DIR = "$ocvDependencyRoot\pnpm\store"
    OCV_VIRTUAL_STORE_DIR = "$ocvDependencyRoot\pnpm\virtual-store\omnicivitas"
    npm_config_store_dir = "$ocvDependencyRoot\pnpm\store"
    npm_config_virtual_store_dir = "$ocvDependencyRoot\pnpm\virtual-store\omnicivitas"
    PNPM_HOME = "$ocvDependencyRoot\pnpm\bin"
    npm_config_cache = "$ocvDependencyRoot\cache\npm"
    npm_config_devdir = "$ocvDependencyRoot\cache\node-gyp"
    COREPACK_HOME = "$ocvDependencyRoot\cache\corepack"
    TEMP = "$ocvDependencyRoot\tmp"
    TMP = "$ocvDependencyRoot\tmp"
    NODE_COMPILE_CACHE = "$ocvDependencyRoot\cache\node-compile"
    NX_DAEMON = 'false'
    NX_NATIVE_FILE_CACHE_DIRECTORY = "$ocvDependencyRoot\cache\nx\native"
    NX_WORKSPACE_DATA_DIRECTORY = "$ocvDependencyRoot\cache\nx\workspace"
    NX_CACHE_DIRECTORY = "$ocvDependencyRoot\cache\nx\tasks"
    NX_TASKS_RUNNER_DYNAMIC_OUTPUT = 'false'
    ASTRO_TELEMETRY_DISABLED = '1'
    NEXT_TELEMETRY_DISABLED = '1'
    XDG_CACHE_HOME = "$ocvDependencyRoot\cache\xdg"
    XDG_CONFIG_HOME = "$ocvDependencyRoot\cache\xdg-config"
    XDG_DATA_HOME = "$ocvDependencyRoot\cache\xdg-data"
    XDG_STATE_HOME = "$ocvDependencyRoot\cache\xdg-state"
    JITI_CACHE_DIR = "$ocvDependencyRoot\cache\jiti"
    PLAYWRIGHT_BROWSERS_PATH = "$ocvDependencyRoot\cache\playwright"
    CYPRESS_CACHE_FOLDER = "$ocvDependencyRoot\cache\cypress"
    PIP_CACHE_DIR = "$ocvDependencyRoot\cache\pip"
    PYTHONPYCACHEPREFIX = "$ocvDependencyRoot\cache\pycache"
    GOMODCACHE = "$ocvDependencyRoot\cache\go\mod"
    GOCACHE = "$ocvDependencyRoot\cache\go\build"
    GRADLE_USER_HOME = "$ocvDependencyRoot\cache\gradle"
    NUGET_PACKAGES = "$ocvDependencyRoot\cache\nuget"
    DOTNET_CLI_HOME = "$ocvDependencyRoot\cache\dotnet"
    COMPOSER_HOME = "$ocvDependencyRoot\cache\composer"
    COMPOSER_CACHE_DIR = "$ocvDependencyRoot\cache\composer"
    BUNDLE_USER_HOME = "$ocvDependencyRoot\cache\gems"
    GEM_HOME = "$ocvDependencyRoot\cache\gems"
    MAVEN_OPTS = "-Dmaven.repo.local=$ocvDependencyRoot\cache\maven"
}
if ($ocvRuntimeConfig.dockerDesktopHome) { $ocvEnvironment.DOCKER_CONFIG = Join-Path $ocvDependencyRoot 'docker-config' }
foreach ($ocvEntry in $ocvEnvironment.GetEnumerator()) { [Environment]::SetEnvironmentVariable($ocvEntry.Key, $ocvEntry.Value, 'Process') }
$env:Path = "$ocvDependencyRoot\tools\node;$ocvDependencyRoot\docker-app\resources\bin;$ocvDependencyRoot\pnpm\bin;" + $env:Path
# PNPM_HOME must contain a real launcher, otherwise Windows can continue down
# PATH to an unrelated installation despite the selected cache root.
$ocvPortableNode = Join-Path $ocvDependencyRoot 'tools\node\node.exe'
$ocvPortablePnpm = Join-Path $ocvDependencyRoot 'tools\pnpm\bin\pnpm.cjs'
if ((Test-Path -LiteralPath $ocvPortableNode) -and (Test-Path -LiteralPath $ocvPortablePnpm)) {
    $ocvLauncher = "@echo off`r`n`"$ocvPortableNode`" `"$ocvPortablePnpm`" %*`r`n"
    $ocvLauncherPath = Join-Path $ocvDependencyRoot 'pnpm\bin\pnpm.cmd'
    if (-not (Test-Path -LiteralPath $ocvLauncherPath) -or [IO.File]::ReadAllText($ocvLauncherPath).TrimEnd() -ne $ocvLauncher.TrimEnd()) {
        $ocvLauncher | Set-Content -LiteralPath $ocvLauncherPath -Encoding ASCII
    }
}

function Resolve-OcvTool {
    param([Parameter(Mandatory=$true)][string]$Name)
    $ocvToolEnv = @{node='OCV_NODE_CLI';pnpm='OCV_PNPM_CLI';docker='OCV_DOCKER_CLI';dockerDesktop='OCV_DOCKER_DESKTOP';nginx='OCV_NGINX_CLI'}
    $ocvConfigured = [Environment]::GetEnvironmentVariable($ocvToolEnv[$Name], 'Process')
    if (-not $ocvConfigured -and $ocvRuntimeConfig.tools) { $ocvConfigured = [string]$ocvRuntimeConfig.tools.$Name }
    if ($ocvConfigured) {
        if ($ocvConfigured -match '[\\/]') {
            if (-not [IO.Path]::IsPathRooted($ocvConfigured)) { $ocvConfigured = Join-Path $ocvProjectRoot $ocvConfigured }
            if (-not (Test-Path -LiteralPath $ocvConfigured -PathType Leaf)) { throw "Configured $Name executable is missing: $ocvConfigured" }
            return [IO.Path]::GetFullPath($ocvConfigured)
        }
        $ocvCommand = Get-Command $ocvConfigured -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $ocvCommand) { throw "Configured $Name command is not on PATH: $ocvConfigured" }
        return $ocvCommand.Source
    }
    $ocvPortable = @{node='tools/node/node.exe';pnpm='tools/pnpm/bin/pnpm.cjs';docker='docker-app/resources/bin/docker.exe';dockerDesktop='docker-app/Docker Desktop.exe';nginx='tools/nginx-1.30.5/nginx.exe'}
    if ($ocvPortable.ContainsKey($Name)) {
        $ocvCandidate = Join-Path $ocvDependencyRoot $ocvPortable[$Name]
        if (Test-Path -LiteralPath $ocvCandidate -PathType Leaf) { return $ocvCandidate }
    }
    $ocvCommand = Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $ocvCommand) { throw "$Name is not on PATH. Install the documented prerequisite or set tools.$Name in config/runtime.local.json." }
    return $ocvCommand.Source
}

