import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,rm,copyFile} from 'node:fs/promises';
import {resolve,dirname,join,relative,isAbsolute} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {docker} from './docker-child.mjs';
import './guard-paths.mjs';
const repository=resolve(dirname(fileURLToPath(import.meta.url)),'..'),local=process.platform==='win32'&&process.env.OCV_LOCAL_STORAGE_GUARD==='1';
const builder=process.env.OCV_WORKSHOP_BUILDER||'ocv-after-builder',name=`buildx_buildkit_${builder}0`;
if(!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(builder))throw Error('Invalid workshop builder name.');
const budget=Number(process.env.OCV_WORKSHOP_BUILD_BUDGET_MIB||process.env.OCV_RUNNER_BUDGET_MIB||6144),reserve=Number(process.env.OCV_WORKSHOP_BUILD_RESERVE_MIB||1536),timeout=Number(process.env.OCV_WORKSHOP_BUILD_TIMEOUT_MS||1200000);
if(!Number.isFinite(budget)||budget<3072||!Number.isFinite(reserve)||reserve<512||!Number.isFinite(timeout)||timeout<10000||timeout>3600000)throw Error('Invalid workshop build budget, reserve or deadline.');
const env={...process.env,COMPOSE_PARALLEL_LIMIT:'1'};
if(local){const root=process.env.OCV_DEPS_ROOT;env.USERPROFILE=join(root,'docker-desktop');env.APPDATA=join(root,'docker-desktop/appdata/Roaming');env.LOCALAPPDATA=join(root,'docker-desktop/appdata/Local');}
function command(file,args,{inherit=false,allowFailure=false}={}){return new Promise((accept,reject)=>{const child=spawn(file,args,{cwd:repository,env,windowsHide:true,stdio:inherit?['ignore','inherit','inherit']:['ignore','pipe','pipe']});const deadline=setTimeout(()=>{child.kill();reject(Error('Workshop build deadline exceeded.'))},timeout);let stdout='',stderr='';if(!inherit){child.stdout.on('data',c=>{stdout+=c;if(stdout.length>16777216)child.kill()});child.stderr.on('data',c=>{stderr+=c;if(stderr.length>16777216)child.kill()})}child.once('error',e=>{clearTimeout(deadline);reject(e)});child.once('exit',(status,signal)=>{clearTimeout(deadline);if(status===0||allowFailure)accept({stdout,stderr,status});else reject(Error(`${file} ${args[0]} failed: ${stderr.slice(-10000)||`exit ${status} ${signal||''}`}`))})})}
const dc=(args,options)=>command(docker,args,options);
async function storage(){if(local)await command('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',join(repository,'scripts/Confirm-DockerStorage.ps1')],{inherit:true})}
async function admission(){const info=JSON.parse((await dc(['info','--format','{{json .}}'])).stdout),ceiling=Math.min(budget,Math.floor(Number(info.MemTotal)/1048576)-reserve);const ids=(await dc(['ps','-q'])).stdout.trim().split(/\s+/).filter(Boolean);let active=0;if(ids.length){for(const c of JSON.parse((await dc(['inspect',...ids])).stdout)){if(c.Name===`/${name}`)continue;if(!(c.HostConfig.Memory>0))throw Error(`Uncapped active container: ${c.Name}`);active+=c.HostConfig.Memory/1048576}}if(!Number.isFinite(ceiling)||active+3072>ceiling)throw Error(`Workshop build requires ${active+3072} MiB, ceiling ${ceiling} MiB.`);console.log(`Workshop build admitted: ${active} + 3072 MiB <= ${ceiling} MiB.`)}
const externalRoot=process.env.OCV_DEPS_ROOT?join(resolve(process.env.OCV_DEPS_ROOT),'tmp'):tmpdir(),inside=relative(repository,externalRoot);if(!isAbsolute(inside)&&!inside.startsWith('..'))throw Error('Build output must be outside the repository.');
let temporary,started=false;
try{
 const sourceDigest=(await command(process.execPath,[join(repository,'scripts/workshop-artifacts.mjs'),'--source-digest'])).stdout.trim();
 await storage();await admission();const present=await dc(['buildx','inspect',builder],{allowFailure:true});if(present.status!==0)await dc(['buildx','create','--name',builder,'--driver','docker-container','--driver-opt','memory=3g','--driver-opt','memory-swap=3g','--driver-opt','cpu-quota=200000']);started=true;await dc(['buildx','inspect',builder,'--bootstrap'],{inherit:true});
 const actual=JSON.parse((await dc(['inspect',name])).stdout)[0];if(!(actual.HostConfig.Memory>0&&actual.HostConfig.Memory<=3072*1048576&&actual.HostConfig.MemorySwap>0&&actual.HostConfig.MemorySwap<=3072*1048576))throw Error('BuildKit needs actual memory and total memory/swap limits <= 3 GiB.');
 await mkdir(externalRoot,{recursive:true});temporary=await mkdtemp(join(externalRoot,'workshop-engines-'));
 const sdkArg=process.env.OCV_WORKSHOP_DOTNET_SDK_IMAGE?['--build-arg',`DOTNET_SDK_IMAGE=${process.env.OCV_WORKSHOP_DOTNET_SDK_IMAGE}`]:[];
 await storage();await admission();await dc(['buildx','build','--builder',builder,'--target','browser-artifacts','-f','config/apps/aa1/Dockerfile',...sdkArg,'--output',`type=local,dest=${temporary}`,'--progress','plain','.'],{inherit:true});
 await storage();await admission();await dc(['buildx','build','--builder',builder,'--target','native-runtime','-f','pinia/folder2/Dockerfile','-t','omnicivitas/mechanics-native:stage11','--load','--progress','plain','.'],{inherit:true});
 await storage();await admission();await dc(['buildx','build','--builder',builder,'--target','wasm-artifacts','-f','pinia/folder2/Dockerfile','--output',`type=local,dest=${temporary}`,'--progress','plain','.'],{inherit:true});
 await copyFile(join(temporary,'Cargo.lock'),join(repository,'pcakage/slot7/Cargo.lock'));
 await storage();await admission();const licenseOutput=join(temporary,'runtime-notices');await dc(['buildx','build','--builder',builder,'--target','license-artifacts','-f','pinia/folder2/Dockerfile','--output',`type=local,dest=${licenseOutput}`,'--progress','plain','.'],{inherit:true});
 await command(process.execPath,[join(repository,'scripts/collect-workshop-licenses.mjs'),licenseOutput],{inherit:true});
 if((await command(process.execPath,[join(repository,'scripts/workshop-artifacts.mjs'),'--source-digest'])).stdout.trim()!==sourceDigest)throw Error('Workshop sources changed during compilation; rebuild before publishing the artifacts.');
 await command(process.execPath,[join(repository,'scripts/workshop-artifacts.mjs'),'--from',temporary],{inherit:true});await command(process.execPath,[join(repository,'scripts/workshop-artifacts.mjs'),'--check'],{inherit:true});console.log('Workshop Blazor UI, Rust browser engine and native worker rebuilt.');
}finally{if(started)await dc(['buildx','stop',builder],{allowFailure:true}).catch(()=>{});if(temporary){const rel=relative(externalRoot,temporary);if(rel.startsWith('workshop-engines-')&&!rel.includes('..')&&!isAbsolute(rel))await rm(temporary,{recursive:true,force:true})}}
