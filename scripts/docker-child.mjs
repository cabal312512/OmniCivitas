import { spawnSync } from 'node:child_process';
import path from 'node:path';
import './guard-paths.mjs';
const local=process.env.OCV_LOCAL_STORAGE_GUARD==='1'&&process.platform==='win32';
export const docker=process.env.OCV_DOCKER_CLI||(local?path.join(process.env.OCV_DEPS_ROOT,'docker-app/resources/bin/docker.exe'):'docker');
export function dockerCall(args,{allowFailure=false}={}){const root=process.env.OCV_DEPS_ROOT;const overrides=local?{USERPROFILE:path.join(root,'docker-desktop'),APPDATA:path.join(root,'docker-desktop/appdata/Roaming'),LOCALAPPDATA:path.join(root,'docker-desktop/appdata/Local')}:{};const r=spawnSync(docker,args,{encoding:'utf8',maxBuffer:16*1024*1024,env:{...process.env,...overrides,COMPOSE_PARALLEL_LIMIT:'1'}});if(r.error||r.status!==0&&!allowFailure)throw Error(r.error?.message||[r.stdout?.slice(-14000),r.stderr?.slice(-14000)].filter(Boolean).join('\n'));return r;}
export function composeCall(args,opts){return dockerCall(['compose','-p',process.env.COMPOSE_PROJECT_NAME||'omnicivitas','-f','compose.yaml','--profile','*',...args],opts);}
