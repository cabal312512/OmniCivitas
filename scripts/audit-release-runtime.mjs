import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import https from 'node:https';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {dockerCall} from './docker-child.mjs';

const base=process.env.OCV_BASE_URL||'http://127.0.0.1:8080';
const request=route=>fetch(base+route,{signal:AbortSignal.timeout(8000)});
const json=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const deployed=[];
const originalNotice=await request('/third-party-notices.txt');assert.equal(originalNotice.status,200);
assert.equal(sha(Buffer.from(await originalNotice.arrayBuffer())),sha(fs.readFileSync('config/apps/portal/public/third-party-notices.txt')));
deployed.push('/third-party-notices.txt');
for(const name of fs.readdirSync('config/apps/portal/public/licenses')){
  const file=path.join('config/apps/portal/public/licenses',name);
  if(!fs.statSync(file).isFile())continue;
  const response=await request('/licenses/'+name);assert.equal(response.status,200);
  assert.equal(sha(Buffer.from(await response.arrayBuffer())),sha(fs.readFileSync(file)));
  deployed.push(name);
}
const inventory=[];
for(const name of ['bundled','worker']){
  const response=await request('/licenses/'+name+'-inventory.json');assert.equal(response.status,200);
  const data=await response.json();assert.ok(data.packages.every(row=>row.files.length));
  const notices=await request('/licenses/'+name+'-notices.txt');assert.equal(notices.status,200);
  assert.match(await notices.text(),/Permission is hereby granted/);
  inventory.push({scope:name,packages:data.packages.length,chunks:data.chunks.length});
}
for(const [label,file] of [['next-client','licenses'],['next-server','server/licenses'],['next-server-chunks','server/chunks/licenses']]){
  const data=json('config/apps/web2/.next/'+file+'/next-inventory.json');
  assert.ok(data.packages.every(row=>row.files.length));
  inventory.push({scope:label,packages:data.packages.length,chunks:data.chunks.length});
}
const project=process.env.COMPOSE_PROJECT_NAME||'omnicivitas';
const ids=dockerCall(['ps','-q','--filter','label=com.docker.compose.project='+project]).stdout.trim().split(/\s+/).filter(Boolean);
const containers=JSON.parse(dockerCall(['inspect',...ids]).stdout);
const core=['edge','gateway','next','portal','postgres','redis'];
assert.deepEqual(containers.map(row=>row.Config.Labels['com.docker.compose.service']).sort(),core.sort());
assert.ok(containers.every(row=>row.State.Health?.Status==='healthy'&&!row.State.OOMKilled));
const builder=JSON.parse(dockerCall(['inspect','buildx_buildkit_ocv-budget-builder0']).stdout)[0];
assert.equal(builder.State.Running,false);
const edge=containers.find(row=>row.Config.Labels['com.docker.compose.service']==='edge');
const syntax=dockerCall(['exec',edge.Id,'nginx','-t']);
const version=dockerCall(['exec',edge.Id,'nginx','-v']);
const nginx={version:(version.stdout+version.stderr).trim(),syntaxPassed:syntax.status===0};
const redirects=[];
for(const host of [new URL(base).host,'127.0.0.1:8095'])for(const route of ['/status','/functions']){
  // Native HTTP deliberately sends this Host header; Fetch normalizes it.
  const response=await new Promise((resolve,reject)=>{const client=base.startsWith('https:')?https:http;const req=client.get(base+route,{headers:{Host:host},timeout:8000},res=>{res.resume();resolve({status:res.statusCode,location:res.headers.location})});req.on('error',reject);req.on('timeout',()=>req.destroy(Error('redirect deadline')))});
  assert.equal(response.status,301);const location=response.location;
  assert.equal(new URL(location).host,host);assert.equal(new URL(location).pathname,route+'/');
  redirects.push({route,host,location});
}
const result={status:'passed',at:new Date().toISOString(),base,originalLicenseResources:deployed.length,deployedLicenseNames:deployed,inventory,nginx,redirects,services:containers.map(row=>({service:row.Config.Labels['com.docker.compose.service'],health:row.State.Health.Status,memoryCapMiB:row.HostConfig.Memory/1048576,oomKilled:row.State.OOMKilled})),builderRunning:false};
const dir=path.join(process.env.OCV_DEPS_ROOT||os.tmpdir(),'runtime/reports');fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'phase9-release-runtime.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
