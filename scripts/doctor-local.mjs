import './guard-paths.mjs';
import { stat, realpath, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
const deps=process.env.OCV_DEPS_ROOT;
const report={time:new Date().toISOString(),node:process.version,executable:process.execPath,hostMemoryGiB:Math.round(os.totalmem()/1024**3*100)/100,freeMemoryGiB:Math.round(os.freemem()/1024**3*100)/100,dependencyRoot:deps,paths:{},docker:'not-installed',stage:1};
for(const name of ['node_modules','config/apps/portal/node_modules','services/gateway/node_modules','config/apps/portal/.astro']) {
  const actual=await realpath(name); report.paths[name]=actual;
  if(!actual.toLowerCase().startsWith('f:\\ocvdeps\\')) throw new Error(`Dependency/cache escaped F: ${name} => ${actual}`);
}
for(const key of ['OCV_STORE_DIR','OCV_VIRTUAL_STORE_DIR','npm_config_cache','TEMP','TMP','NX_NATIVE_FILE_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY','NX_CACHE_DIRECTORY','DOCKER_CONFIG']) {
  if(!process.env[key]?.toLowerCase().startsWith('f:\\ocvdeps\\')) throw new Error(`Unsafe ${key}`); report.paths[key]=process.env[key];
}
try {
  await stat(path.join(deps,'docker-app/resources/bin/docker.exe'));
  const confirmation=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/Confirm-DockerStorage.ps1'],{encoding:'utf8',windowsHide:true,timeout:60000});
  report.docker=confirmation.status===0?'storage-verified':'installed-storage-unverified';
  if(confirmation.status!==0)report.storageError=confirmation.error?.message || confirmation.stderr;
} catch(error) {if(error.code!=='ENOENT')throw error;}
try { report.storageAttestation=JSON.parse((await readFile(path.join(deps,'runtime/reports/docker-storage.json'),'utf8')).replace(/^\uFEFF/,'')); } catch(error) {if(error.code!=='ENOENT')throw error;}
await writeFile(path.join(deps,'runtime/reports/doctor.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

