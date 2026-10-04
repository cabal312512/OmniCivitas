# Local audit harness only. Public application commands never invoke this file.
param([ValidateSet('install','build','build-next','test','test-calculation','dev')][string]$Action='install')
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Enter-OcvEnvironment.ps1')
$ocvAuditRoot=Join-Path $env:OCV_DEPS_ROOT 'runtime\phase9-public-audit'
$ocvClone=Join-Path $ocvAuditRoot 'clean-windows'
$ocvReportRoot=Join-Path $env:OCV_DEPS_ROOT 'runtime\reports'
$ocvToolRoot=Join-Path $ocvAuditRoot 'clean-tools'
foreach($ocvFolder in @('tmp','pnpm-store','virtual-store','npm','nx-native','node-compile','user','xdg')){New-Item -ItemType Directory -Path (Join-Path $ocvToolRoot $ocvFolder) -Force | Out-Null}
$ocvNode=Join-Path $env:OCV_DEPS_ROOT 'tools\node\node.exe'
$ocvPnpm=Join-Path $env:OCV_DEPS_ROOT 'tools\pnpm\bin\pnpm.cjs'
Set-Location -LiteralPath $ocvClone
# Start the public command without any OCV environment variable or real .env.
Get-ChildItem Env: | Where-Object Name -Like 'OCV*' | ForEach-Object {Remove-Item -LiteralPath ('Env:\'+$_.Name)}
foreach($ocvName in @('NX_WORKSPACE_DATA_DIRECTORY','NX_CACHE_DIRECTORY','JITI_CACHE_DIR','PLAYWRIGHT_BROWSERS_PATH','CYPRESS_CACHE_FOLDER','MAVEN_OPTS','OCV_DEPS_ROOT')){if(Test-Path -LiteralPath ('Env:\'+$ocvName)){Remove-Item -LiteralPath ('Env:\'+$ocvName)}}
$env:TEMP=Join-Path $ocvToolRoot 'tmp';$env:TMP=$env:TEMP
$env:USERPROFILE=Join-Path $ocvToolRoot 'user'
$env:LOCALAPPDATA=Join-Path $ocvToolRoot 'user\local'
$env:APPDATA=Join-Path $ocvToolRoot 'user\roaming'
$env:npm_config_store_dir=Join-Path $ocvToolRoot 'pnpm-store'
$env:npm_config_virtual_store_dir=Join-Path $ocvToolRoot 'virtual-store'
$env:npm_config_cache=Join-Path $ocvToolRoot 'npm'
$env:NX_NATIVE_FILE_CACHE_DIRECTORY=Join-Path $ocvToolRoot 'nx-native'
$env:NODE_COMPILE_CACHE=Join-Path $ocvToolRoot 'node-compile'
$env:XDG_CACHE_HOME=Join-Path $ocvToolRoot 'xdg'
$env:NX_DAEMON='false';$env:NX_SKIP_NX_CACHE='true';$env:NG_BUILD_MAX_WORKERS='1'
if($Action -eq 'dev'){
 $env:OCV_WEB_PORT='8094';$env:OCV_PORTAL_PORT='4344';$env:OCV_NEXT_PORT='3244';$env:OCV_GATEWAY_PORT='3044'
 $PID | Set-Content -LiteralPath (Join-Path $ocvAuditRoot 'clean-dev.pid')
}
[string[]]$ocvArguments=switch($Action){'install'{@('install','--frozen-lockfile')};'build'{@('build')};'build-next'{@('--filter','@omnicivitas/web2','build')};'test'{@('test')};'test-calculation'{@('exec','vitest','run','tests/phase5-calculation.test.mjs','--maxWorkers=1')};'dev'{@('dev')}}
& $ocvNode $ocvPnpm @ocvArguments *> (Join-Path $ocvReportRoot ('phase9-clean-windows-'+$Action+'.log'))
if($LASTEXITCODE -eq 0 -and $Action -eq 'test-calculation'){
 & $ocvNode --test tests/research-display.test.mjs *> (Join-Path $ocvReportRoot 'phase9-clean-windows-node-tests.log')
}
exit $LASTEXITCODE
