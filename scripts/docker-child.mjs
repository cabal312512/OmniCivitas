import { spawnSync } from 'node:child_process';
import path from 'node:path';
import './guard-paths.mjs';
import {projectRoot,resolveRuntimePaths,resolveRuntimeTool} from './runtime-paths.mjs';
try{process.loadEnvFile(path.join(projectRoot,'.env'));}catch(error){if(error.code!=='ENOENT')throw error;}
const local=process.env.OCV_LOCAL_STORAGE_GUARD==='1'&&process.platform==='win32';
export const docker=resolveRuntimeTool('docker');
export function dockerEnvironment(){const root=resolveRuntimePaths().depsRoot;return {...process.env,...(local?{USERPROFILE:path.join(root,'docker-desktop'),APPDATA:path.join(root,'docker-desktop/appdata/Roaming'),LOCALAPPDATA:path.join(root,'docker-desktop/appdata/Local')}:{}),COMPOSE_PARALLEL_LIMIT:'1'};}
export function composeArguments(args,{allProfiles=true}={}){const files=process.env.OCV_COMPOSE_FILES?.split(path.delimiter).filter(Boolean)||['compose.yaml'];return ['compose','-p',process.env.COMPOSE_PROJECT_NAME||'omnicivitas',...files.flatMap(file=>['-f',file]),...(allProfiles?['--profile','*']:[]),...args];}
export function dockerCall(args,{allowFailure=false,input,timeout,maxBuffer=16*1024*1024,cwd=projectRoot}={}){const r=spawnSync(docker,args,{cwd,input,timeout,encoding:'utf8',maxBuffer,env:dockerEnvironment()});if(r.error||r.status!==0&&!allowFailure)throw Error(r.error?.message||[r.stdout?.slice(-14000),r.stderr?.slice(-14000)].filter(Boolean).join('\n'));return r;}
export function composeCall(args,opts){return dockerCall(composeArguments(args),opts);}
