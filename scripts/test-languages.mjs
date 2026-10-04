import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {dockerCall,composeCall} from './docker-child.mjs';
const targets=process.argv.slice(2);
if(!targets.length||targets.some(t=>!['java','python','php','go','dotnet','ruby'].includes(t)))throw Error('Choose one or more of java python php go dotnet ruby; start the legacy profile first.');
const reportRoot=path.join(process.env.OCV_DEPS_ROOT||os.tmpdir(),'runtime/reports');
await fs.mkdir(reportRoot,{recursive:true});
if(process.env.OCV_LOCAL_STORAGE_GUARD==='1'&&process.platform==='win32'){
  const result=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/Confirm-DockerStorage.ps1'],{stdio:'inherit'});
  if(result.status!==0)throw Error('Storage verification failed.');
}
const config=JSON.parse(composeCall(['config','--format','json']).stdout);
const project=process.env.COMPOSE_PROJECT_NAME||config.name;
const builder=process.env.OCV_TEST_BUILDER||'ocv-budget-builder';
const builderContainer=JSON.parse(dockerCall(['inspect',`buildx_buildkit_${builder}0`]).stdout)[0];
if(builderContainer.HostConfig.Memory<=0||builderContainer.HostConfig.Memory>3072*1048576)throw Error('Test builder must have an enforced memory cap of at most 3 GiB.');
const results=[];
try{
  for(const target of targets){
    console.log('Building and running '+target+' integration tests.');
    const image='omnicivitas/test-'+target+':phase9';
    const build=dockerCall(['buildx','build','--builder',builder,'--load','--target',target,'-t',image,'-f','tests/frameworks/native/Dockerfile','.'],{allowFailure:true});
    await fs.writeFile(path.join(reportRoot,'phase9-'+target+'-build.log'),build.stdout+build.stderr);
    if(build.status!==0)throw Error(target+' test image failed; see its build log.');
    const run=dockerCall(['run','--rm','--network',project+'_default','--memory','768m','--memory-swap','768m','--cpus','1','--pids-limit','256',image],{allowFailure:true});
    await fs.writeFile(path.join(reportRoot,'phase9-'+target+'-test.log'),run.stdout+run.stderr);
    results.push({target,status:run.status===0?'passed':'failed',image});
    console.log(run.stdout);console.log(run.stderr);
    if(run.status!==0)throw Error(target+' integration tests failed.');
  }
}finally{
  dockerCall(['buildx','stop',builder],{allowFailure:true});
  await fs.writeFile(path.join(reportRoot,'phase9-language-tests.json'),JSON.stringify({updatedAt:new Date().toISOString(),results},null,2));
}
