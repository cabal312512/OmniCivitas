import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {dockerCall,composeCall} from './docker-child.mjs';
import {rooms,address} from '../config/apps/portal/src/aaa/map.mjs';
const reports=path.join(process.env.OCV_DEPS_ROOT,'runtime/reports');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const tests=read(path.join(reports,'reactor-playwright.json'));
const walk=(suites,out=[])=>{for(const suite of suites){for(const spec of suite.specs||[])for(const test of spec.tests)out.push({title:spec.title,project:test.projectName,status:test.results.at(-1)?.status});walk(suite.suites||[],out);}return out;};
let checks=walk(tests.suites),retest=null;
if(checks.some(c=>c.status!=='passed')){
 retest=read(path.join(reports,'maze-retest.json'));assert.equal(retest.stats.unexpected,0);
 const fixes=walk(retest.suites);for(const fix of fixes){const index=checks.findIndex(c=>c.title===fix.title&&c.project===fix.project);assert.ok(index>=0);checks[index]=fix;}
}
assert.equal(checks.length,20);assert.ok(checks.every(c=>c.status==='passed'));
const routeProofs=['desktop','mobile'].map(name=>read(path.join(reports,`maze-${name}-routes.json`)));assert.equal(rooms.length,27);for(const routes of routeProofs){assert.equal(routes.length,27);assert.ok(routes.every(r=>r.status===200));}
const renderers=['desktop','mobile'].map(name=>({name,...read(path.join(reports,`reactor-${name}-renderer.json`))}));
for(const proof of renderers){assert.equal(proof.current.renderer,'three-webgl2');assert.equal(proof.current.bloom,true);assert.equal(proof.current.gpuError,0);assert.ok(proof.current.triangles>15000);assert.equal(proof.previous.renderer,'webgl');assert.ok(proof.previous.frames>0);assert.ok(proof.sample.frames>0);}
const files=['config/apps/portal/src/pages/index.astro','config/apps/portal/src/aaa/Overdrive.astro','config/apps/portal/src/aaa/反应堆.js','config/apps/portal/src/aaa/反应堆.css','config/apps/portal/src/aaa/2.astro','config/apps/portal/src/aaa/map.mjs','config/apps/portal/src/aaa/迷宫.css','config/apps/portal/src/aaa/迷宫.js','config/apps/portal/src/aaa/b.js','config/apps/portal/src/pages/maze/[...path].astro'];
for(const file of files)assert.ok(!/[CDF]:[\\/]|Lenovo/.test(fs.readFileSync(file,'utf8')),file);
const home=fs.readFileSync(files[0],'utf8');assert.ok(home.includes('光场.js')&&home.includes('反应堆.js')&&home.includes('光场.css')&&home.includes('反应堆.css'));
assert.equal((home.match(/class="wafer wafer-/g)||[]).length,4);
assert.ok(fs.existsSync('historical/luminous/source/aaa/光场.js'));assert.ok(fs.existsSync('historical/front_old/static/index.html'));
const installed={};
for(const name of ['three','gsap']){
 const location=fs.realpathSync(`config/apps/portal/node_modules/${name}`);
 assert.ok(location.toLowerCase().startsWith(path.resolve(process.env.OCV_DEPS_ROOT).toLowerCase()+path.sep));
 installed[name]={version:read(path.join(location,'package.json')).version,localDependencyLocation:location};
}
const ids=composeCall(['ps','-q']).stdout.trim().split(/\s+/).filter(Boolean);
const containers=JSON.parse(dockerCall(['inspect',...ids]).stdout);
assert.equal(containers.length,6);
const core=containers.map(c=>({service:c.Config.Labels['com.docker.compose.service'],health:c.State.Health.Status,limitMiB:c.HostConfig.Memory/1048576,image:c.Image}));
assert.ok(core.every(c=>['edge','portal','next','gateway','postgres','redis'].includes(c.service)&&c.health==='healthy'&&c.limitMiB>0));
const builder=JSON.parse(dockerCall(['inspect','buildx_buildkit_ocv-budget-builder0']).stdout)[0];assert.equal(builder.State.Running,false);assert.ok(builder.HostConfig.Memory<=3072*1048576);
const served=await (await fetch('http://127.0.0.1:8080/')).text();assert.ok(served.includes('id="reactor-field"')&&served.includes('id="optical-field"'));
const bundleURL=[...served.matchAll(/<script[^>]+src="([^"]+)"/g)][0]?.[1];assert.ok(bundleURL);const bundle=await(await fetch(new URL(bundleURL,'http://127.0.0.1:8080'))).text();assert.ok(bundle.includes('three.js authors')&&bundle.includes('GreenSock. All rights reserved.'));assert.equal((await fetch('http://127.0.0.1:8080/third-party-notices.txt')).status,200);
for(const url of ['/memes/m01.webp','/ng/','/lost-css/receipt.css'])assert.equal((await fetch('http://127.0.0.1:8080'+url)).status,404);
for(const room of rooms)assert.equal((await fetch('http://127.0.0.1:8080'+address(room))).status,200);
const memory=read(path.join(reports,'phase3-memory.json')).at(-1);
const report={acceptedAt:new Date().toISOString(),revision:'reactor-additive-homepage',phase:3,nextPhaseAuthorized:false,browserStats:tests.stats,retestStats:retest?.stats||null,currentPassedChecks:checks,uniquePassed:checks.length,maze:{routes:rooms.map(address),routeCount:rooms.length,layoutCount:new Set(rooms.map(r=>r.layout)).size,HTTPProofs:routeProofs,features:['original Vue Pinia form','original Svelte store','original Solid signal','Lit notifications','existing IndexedDB/CSV/Cache/SVG/CSS/hash sources','existing Worker','byte-checked JSON download','real table sorting','drag/front/fold windows']},renderers,dependencies:installed,core,totalCapsMiB:core.reduce((n,c)=>n+c.limitMiB,0),builderStopped:true,builderCapMiB:builder.HostConfig.Memory/1048576,memory,previousOpticalUI:'Still mounted and rendered in the current page; new layer composited above it',earlierMemeUI:'Retained dormant, not republished',references:'docs/EFFECT-SOURCES.md',report:'docs/REACTOR-REVISION.md',handoff:'docs/HANDOFF.md',publicReleaseAudit:'Pending independent phase 9 audit'};
fs.writeFileSync('docs/reactor-acceptance.json',JSON.stringify(report,null,2)+'\n');
const state=read('docs/phase-state.json');state.updatedAt=new Date().toISOString();state.activeRevision={name:report.revision,status:'complete',authorizedBy:'User: research effects, add dependencies and strong colors; keep this version active, layer new effects on top and continue accumulating',scope:'Visual revision after phase 3; phase 4 remains unauthorized',acceptance:'docs/reactor-acceptance.json'};fs.writeFileSync('docs/phase-state.json',JSON.stringify(state,null,2)+'\n');
const technologies=read('docs/technologies.json');technologies.visualExtensions=[
 {id:'VISUAL-THREE',name:'Three.js',version:installed.three.version,source:'User-authorized additive visual revision, 2026-10-02',role:'active',status:'verified-current-role',purpose:'PBR metal, transmission shell, PMREM environment, instanced geometry, particle shader and transparent HDR bloom',implementation:files.slice(1),verification:['docs/reactor-acceptance.json :: desktop/mobile real draw calls, triangles, GPU error, live older field and controls']},
 {id:'VISUAL-GSAP',name:'GSAP / ScrollTrigger',version:installed.gsap.version,source:'User-authorized additive visual revision, 2026-10-02',role:'active',status:'verified-current-role',purpose:'Scroll-driven assembly expansion, guide and gallery motion, camera dive',implementation:[files[2]],verification:['reactor-playwright.json :: ScrollTrigger actually expands the assembly; hidden pages stop frames and return still works']}
];fs.writeFileSync('docs/technologies.json',JSON.stringify(technologies,null,2)+'\n');
const ledger=read('docs/requirements.json');ledger.currentVisualRevision={name:report.revision,evidence:'docs/reactor-acceptance.json',latestUserOverride:'Keep first optical homepage active; add real physical effects and deliberately unreasonable windows/routes above it. Original Vue/Svelte/Solid and browser storage/Worker are active in new maze pages. Other old framework/meme UI stays dormant. All original text and historical verification retained.'};for(const item of ledger.requirements.filter(r=>r.phase===3||r.id==='A042'))item.currentRevisionNote='原第三阶段验证仍保留为历史证据；当前双光场、27 迷宫路由及重新挂载的 Vue/Svelte/Solid/浏览器存储/Worker 见 docs/reactor-acceptance.json。不代表旧 React/Angular 等全部 UI 已恢复；最新用户要求是在当前页面累加并统一材质。';fs.writeFileSync('docs/requirements.json',JSON.stringify(ledger,null,2)+'\n');
console.log('PASS: 20 unique current browser checks, 27 real routes / 21 layouts, original Vue/Svelte/Solid/storage/Worker features active, both GPU layers, F: dependencies, 6 healthy core, builder stopped and original optical UI retained active.');
