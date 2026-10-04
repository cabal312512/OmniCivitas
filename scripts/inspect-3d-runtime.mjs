// Optional local acceptance helper, never part of application startup.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {composeCall,dockerCall} from './docker-child.mjs';
const sha=data=>createHash('sha256').update(data).digest('hex');
const base=process.env.OCV_BASE_URL||'http://127.0.0.1:8080';
const dist='config/apps/portal/dist';
const report={at:new Date().toISOString(),routes:[],chunks:[],licenseResources:[]};
const html=await (await fetch(new URL('/functions/3d-world/',base))).text();
assert.equal(sha(html),sha(fs.readFileSync(path.join(dist,'functions/3d-world/index.html'))));report.htmlSha256=sha(html);
for(const url of ['/functions/3d-world/','/functions/games/','/functions/','/search/?q=3D%E6%B8%B8%E6%88%8F','/legal/','/legal/code/','/media/','/maze/display/','/maze/notifications/unread/']){
 const response=await fetch(new URL(url,base));assert.equal(response.status,200,url);report.routes.push({url,status:response.status});await response.arrayBuffer();
}
for(const [,url] of html.matchAll(/<script[^>]+src="([^"]+)"/g)){
 const response=await fetch(new URL(url,base)),bytes=Buffer.from(await response.arrayBuffer());assert.equal(response.status,200,url);assert.equal(sha(bytes),sha(fs.readFileSync(path.join(dist,url))));report.chunks.push({url,status:response.status,bytes:bytes.length,sha256:sha(bytes)});
}
assert.ok(report.chunks.length>0);
if(process.argv[3]){
 assert.match(process.argv[3],/^3d[-a-z0-9]*\.json$/);
 const frozen=JSON.parse(fs.readFileSync(path.join(process.env.OCV_DEPS_ROOT,'runtime/reports',process.argv[3]),'utf8'));report.mediaAssets=[];
 for(const asset of frozen.assets){const response=await fetch(new URL(asset.url,base)),bytes=Buffer.from(await response.arrayBuffer());assert.equal(response.status,200,asset.url);assert.equal(sha(bytes),asset.sha256,asset.url);assert.equal(bytes.length,asset.bytes,asset.url);report.mediaAssets.push({url:asset.url,status:response.status,bytes:bytes.length,sha256:sha(bytes)});}
}
const original=JSON.parse(fs.readFileSync('docs/media-additions-acceptance.json','utf8')).runtime.licenseResources;
for(const resource of original){
 const response=await fetch(new URL(resource.url,base)),bytes=Buffer.from(await response.arrayBuffer());assert.equal(response.status,200,resource.url);assert.equal(sha(bytes),resource.sha256,resource.url);assert.equal(sha(bytes),sha(fs.readFileSync(path.join(dist,resource.url))));report.licenseResources.push({url:resource.url,status:response.status,sha256:sha(bytes)});
}
const ids=composeCall(['ps','-q']).stdout.trim().split(/\s+/).filter(Boolean);
const containers=JSON.parse(dockerCall(['inspect',...ids]).stdout);
report.core=containers.map(c=>({service:c.Config.Labels['com.docker.compose.service'],health:c.State.Health?.Status??c.State.Status,capMiB:c.HostConfig.Memory/1048576})).sort((a,b)=>a.service.localeCompare(b.service));
assert.deepEqual(report.core.map(c=>c.service),['edge','gateway','next','portal','postgres','redis']);assert.ok(report.core.every(c=>c.health==='healthy'&&c.capMiB>0));report.totalCapsMiB=report.core.reduce((n,c)=>n+c.capMiB,0);
report.builderStopped=!JSON.parse(dockerCall(['inspect','buildx_buildkit_ocv-budget-builder0']).stdout)[0].State.Running;assert.equal(report.builderStopped,true);
const filename=process.argv[2]||'3d-expanded-runtime.json';assert.match(filename,/^3d[-a-z0-9]*\.json$/);
const folder=path.join(process.env.OCV_DEPS_ROOT,'runtime/reports');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,filename),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({routes:report.routes.length,chunks:report.chunks.length,assets:report.mediaAssets?.length??0,licenses:report.licenseResources.length,core:report.core.length,totalCapsMiB:report.totalCapsMiB,builderStopped:report.builderStopped}));
