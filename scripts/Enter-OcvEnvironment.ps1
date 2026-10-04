$ErrorActionPreference = 'Stop'
$ocvDependencyRoot = 'F:\OCVdeps'
$ocvDirectories = @('tools', 'downloads', 'tmp', 'pnpm\bin', 'pnpm\store', 'pnpm\virtual-store\omnicivitas', 'pnpm\modules\root', 'pnpm\modules\portal', 'pnpm\modules\gateway', 'cache\npm', 'cache\node-gyp', 'cache\node-compile', 'cache\nx\native', 'cache\nx\workspace', 'cache\nx\tasks', 'cache\corepack', 'cache\xdg', 'cache\playwright', 'cache\cypress', 'cache\pip', 'cache\pycache', 'cache\go\mod', 'cache\go\build', 'cache\gradle', 'cache\maven', 'cache\nuget', 'cache\dotnet', 'cache\composer', 'cache\gems', 'docker-config', 'docker-data', 'wsl', 'runtime\logs', 'runtime\reports', 'runtime\backups')
if (-not (Test-Path -LiteralPath 'F:\')) { throw 'F: is unavailable. Dependencies must not fall back to C:.' }
foreach ($ocvDirectory in $ocvDirectories) { New-Item -ItemType Directory -Path (Join-Path $ocvDependencyRoot $ocvDirectory) -Force | Out-Null }
$ocvEnvironment = @{
    OCV_DEPS_ROOT = $ocvDependencyRoot
    OCV_LOCAL_STORAGE_GUARD = '1'
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
    DOCKER_CONFIG = "$ocvDependencyRoot\docker-config"
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
foreach ($ocvEntry in $ocvEnvironment.GetEnumerator()) { [Environment]::SetEnvironmentVariable($ocvEntry.Key, $ocvEntry.Value, 'Process') }
$env:Path = "$ocvDependencyRoot\tools\node;$ocvDependencyRoot\docker-app\resources\bin;$ocvDependencyRoot\pnpm\bin;" + $env:Path
# PNPM_HOME must contain a real launcher, otherwise Windows can continue down
# PATH to the unrelated Codex fallback even though all cache variables are F:.
$ocvPortableNode = Join-Path $ocvDependencyRoot 'tools\node\node.exe'
$ocvPortablePnpm = Join-Path $ocvDependencyRoot 'tools\pnpm\bin\pnpm.cjs'
if ((Test-Path -LiteralPath $ocvPortableNode) -and (Test-Path -LiteralPath $ocvPortablePnpm)) {
    $ocvLauncher = "@echo off`r`n`"$ocvPortableNode`" `"$ocvPortablePnpm`" %*`r`n"
    $ocvLauncher | Set-Content -LiteralPath (Join-Path $ocvDependencyRoot 'pnpm\bin\pnpm.cmd') -Encoding ASCII
}

