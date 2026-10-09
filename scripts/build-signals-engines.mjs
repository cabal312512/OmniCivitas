import { spawn } from 'node:child_process';
import { mkdtemp,mkdir,rm } from 'node:fs/promises';
import { resolve,dirname,join,relative,isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { docker } from './docker-child.mjs';
import './guard-paths.mjs';

const repository=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const local=process.platform==='win32'&&process.env.OCV_LOCAL_STORAGE_GUARD==='1';
const builder=process.env.OCV_SIGNALS_BUILDER||'ocv-after-builder';
if(!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(builder))throw new Error('Invalid signals builder name.');
const builderContainer=`buildx_buildkit_${builder}0`;
const maximumBuilderBytes=3072*1048576;
const configuredBudget=Number(process.env.OCV_SIGNALS_BUILD_BUDGET_MIB||process.env.OCV_RUNNER_BUDGET_MIB||6144);
const reserveMiB=Number(process.env.OCV_SIGNALS_BUILD_RESERVE_MIB||1536);
if(!Number.isFinite(configuredBudget)||configuredBudget<3072||!Number.isFinite(reserveMiB)||reserveMiB<512)throw new Error('Invalid builder admission budget or host reserve.');
const timeoutMs=Number(process.env.OCV_SIGNALS_BUILD_TIMEOUT_MS||1200000);
if(!Number.isFinite(timeoutMs)||timeoutMs<10000||timeoutMs>3600000)throw new Error('Build timeout must be between 10 seconds and one hour.');
const env={...process.env,COMPOSE_PARALLEL_LIMIT:'1'};
if(local){const root=process.env.OCV_DEPS_ROOT;env.USERPROFILE=join(root,'docker-desktop');env.APPDATA=join(root,'docker-desktop/appdata/Roaming');env.LOCALAPPDATA=join(root,'docker-desktop/appdata/Local');}
function command(file,args,{inherit=false,allowFailure=false}={}){
  return new Promise((accept,reject)=>{
    const child=spawn(file,args,{cwd:repository,env,windowsHide:true,stdio:inherit?['ignore','inherit','inherit']:['ignore','pipe','pipe']});
    const deadline=setTimeout(()=>{child.kill();reject(new Error(`Signals build command exceeded ${timeoutMs} ms.`));},timeoutMs);
    let stdout='',stderr='';
    if(!inherit){child.stdout.on('data',chunk=>{stdout+=chunk;if(stdout.length>16777216)child.kill();});child.stderr.on('data',chunk=>{stderr+=chunk;if(stderr.length>16777216)child.kill();});}
    child.once('error',error=>{clearTimeout(deadline);reject(error);});child.once('exit',(status,signal)=>{clearTimeout(deadline);if(status===0||allowFailure)accept({stdout,stderr,status,signal});else reject(new Error(`${file} ${args[0]||''} failed: ${stderr.slice(-10000)||`exit ${status}, ${signal||'no signal'}`}`));});
  });
}
const dc=(args,options)=>command(docker,args,options);
async function admission(){
  const info=JSON.parse((await dc(['info','--format','{{json .}}'])).stdout);
  const ceiling=Math.min(configuredBudget,Math.floor(Number(info.MemTotal)/1048576)-reserveMiB);
  if(!Number.isFinite(ceiling)||ceiling<=3072)throw new Error('Docker has insufficient memory after the configured host reserve.');
  const ids=(await dc(['ps','-q'])).stdout.trim().split(/\s+/).filter(Boolean);
  let active=0;
  if(ids.length){const containers=JSON.parse((await dc(['inspect',...ids])).stdout);for(const container of containers){if(container.Name===`/${builderContainer}`)continue;const cap=Number(container.HostConfig?.Memory);if(!(cap>0))throw new Error(`Running container ${container.Name} is uncapped. Stop it or cap it before building engines.`);active+=cap/1048576;}}
  if(active+3072>ceiling)throw new Error(`Engine builder plus all active container caps require ${active+3072} MiB, exceeding the ${ceiling} MiB admission budget. Stop optional services before rebuilding.`);
  console.log(`Signals build admitted: ${active} MiB active caps + 3072 MiB builder <= ${ceiling} MiB.`);
}
async function storage(){if(local)await command('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',join(repository,'scripts/Confirm-DockerStorage.ps1')],{inherit:true});}
const externalRoot=process.env.OCV_DEPS_ROOT?join(resolve(process.env.OCV_DEPS_ROOT),'tmp'):tmpdir();
const inRepository=relative(repository,resolve(externalRoot));
if(!isAbsolute(inRepository)&&!inRepository.startsWith('..'))throw new Error('Compiler output must be outside the repository.');
let temporary,bootstrapped=false;
try{
  await storage();await admission();
  const exists=await dc(['buildx','inspect',builder],{allowFailure:true});
  if(exists.status!==0)await dc(['buildx','create','--name',builder,'--driver','docker-container','--driver-opt','memory=3g','--driver-opt','memory-swap=3g','--driver-opt','cpu-quota=200000']);
  bootstrapped=true;await dc(['buildx','inspect',builder,'--bootstrap'],{inherit:true});
  const actual=JSON.parse((await dc(['inspect',builderContainer])).stdout)[0];
  if(!(actual.HostConfig.Memory>0&&actual.HostConfig.Memory<=maximumBuilderBytes))throw new Error('BuildKit must have a real memory limit no larger than 3 GiB.');
  if(!(actual.HostConfig.MemorySwap>0&&actual.HostConfig.MemorySwap<=maximumBuilderBytes))throw new Error('BuildKit must have an explicit total memory/swap limit no larger than 3 GiB.');
  await admission();
  await dc(['buildx','build','--builder',builder,'--target','native-runtime','-f','pinia/receipt2/Dockerfile','-t','omnicivitas/signals-native:stage10','--load','--progress','plain','.'],{inherit:true});
  await storage();await admission();await mkdir(externalRoot,{recursive:true});temporary=await mkdtemp(join(externalRoot,'signals-engines-'));
  await dc(['buildx','build','--builder',builder,'--target','wasm-artifacts','-f','pinia/receipt2/Dockerfile','--output',`type=local,dest=${temporary}`,'--progress','plain','.'],{inherit:true});
  await command(process.execPath,[join(repository,'scripts/signals-artifacts.mjs'),'--from',temporary],{inherit:true});
  await command(process.execPath,[join(repository,'scripts/signals-artifacts.mjs'),'--check'],{inherit:true});
  console.log('Signals native image and browser engines rebuilt. Optional services were not started.');
}finally{
  if(bootstrapped)await dc(['buildx','stop',builder],{allowFailure:true}).catch(()=>{});
  if(temporary){const inside=relative(resolve(externalRoot),resolve(temporary));if(inside&&!inside.startsWith('..')&&!isAbsolute(inside)&&inside.startsWith('signals-engines-'))await rm(temporary,{recursive:true,force:true});}
}
