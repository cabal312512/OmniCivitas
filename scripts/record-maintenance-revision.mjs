import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {composeCall,dockerCall} from './docker-child.mjs';
import {rooms,address} from '../config/apps/portal/src/aaa/map.mjs';
const root=process.env.OCV_DEPS_ROOT;
const reports=root?path.join(root,'runtime/reports'):path.resolve('.test-results');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const suite=read(path.join(reports,'maintenance-playwright.json'));
const checks=[];
function walk(suites){for(const s of suites){for(const spec of s.specs||[])for(const t of spec.tests)checks.push({title:spec.title,project:t.projectName,status:t.results.at(-1)?.status});walk(s.suites||[]);}}
walk(suite.suites);assert.equal(checks.length,20);assert.ok(checks.every(c=>c.status==='passed'));assert.equal(suite.stats.unexpected,0);
const layouts=read(path.join(reports,'maintenance-layout-proof.json'));
assert.equal(layouts.errors.length,0);assert.equal(layouts.results.length,4);
for(const p of layouts.results){assert.ok(p.panels.every(x=>['none','0deg'].includes(x.rotate)&&x.transform==='none'));assert.equal(p.unfinishedCells,2);}
const ids=composeCall(['ps','-q']).stdout.trim().split(/\s+/).filter(Boolean);
const core=JSON.parse(dockerCall(['inspect',...ids]).stdout).map(c=>({service:c.Config.Labels['com.docker.compose.service'],health:c.State.Health?.Status,limitMiB:c.HostConfig.Memory/1048576,image:c.Image}));
assert.equal(core.length,6);assert.ok(core.every(c=>['edge','portal','next','gateway','postgres','redis'].includes(c.service)&&c.health==='healthy'&&c.limitMiB>0));
const builder=JSON.parse(dockerCall(['inspect','buildx_buildkit_ocv-budget-builder0']).stdout)[0];assert.equal(builder.State.Running,false);assert.equal(builder.HostConfig.Memory/1048576,3072);
const HTTP=[];const base=process.env.OCV_BASE_URL||'http://127.0.0.1:8080';
for(const room of rooms){const response=await fetch(base+address(room));const status=response.status;await response.arrayBuffer();assert.equal(status,200);HTTP.push({url:address(room),status});}
const sources=['config/apps/portal/src/aaa/tmp.astro','config/apps/portal/src/aaa/临时修一下.css','config/apps/portal/src/pages/index.astro','config/apps/portal/src/pages/maze/[...path].astro','config/apps/portal/src/aaa/2.astro'];
for(const file of sources)assert.ok(!/[CDF]:[\\/]|Lenovo/.test(fs.readFileSync(file,'utf8')),file);
const oldCSS=fs.readFileSync('config/apps/portal/src/aaa/迷宫.css','utf8');assert.ok(oldCSS.includes('rotate:-10deg')&&oldCSS.includes('rotate:3deg'));
const home=fs.readFileSync(sources[2],'utf8');for(const text of ['光场.js','反应堆.js','<Overdrive','<WrongWindows'])assert.ok(home.includes(text));
const report={revision:'maintenance-css-collision',acceptedAt:new Date().toISOString(),phase:3,nextPhaseAuthorized:false,previousAcceptance:'docs/reactor-acceptance.json',browserStats:suite.stats,passedChecks:checks,layoutEvidence:layouts,HTTP,core,totalCapsMiB:core.reduce((n,c)=>n+c.limitMiB,0),builderStopped:true,builderCapMiB:3072,memory:read(path.join(reports,'phase3-memory.json')).at(-1),newDependencies:[],oldRules:'Retained in 迷宫.css; extra cascade corrects theatrical window rotations without deleting previous code or optical layers.',scope:'Append broken directory/file panes and unfinished frames; keep quiet cover, all 27 routes and existing completion paths. Phase 4 remains unauthorized.',limitations:['Aesthetic judgment is subjective; screenshots are evidence, not a user approval claim.','Mobile intentional cropping remains.','Portability clean-clone audit still pending in phase 9.']};
fs.writeFileSync('docs/maintenance-acceptance.json',JSON.stringify(report,null,2)+'\n');
const state=read('docs/phase-state.json');state.updatedAt=report.acceptedAt;state.activeRevision={name:report.revision,status:'complete',authorizedBy:'User: keep prior layers, straighten artificial crooked windows, add realistic neglected CSS, overlapping content and unfinished frames.',scope:report.scope,acceptance:'docs/maintenance-acceptance.json'};fs.writeFileSync('docs/phase-state.json',JSON.stringify(state,null,2)+'\n');
const ledger=read('docs/requirements.json');ledger.currentVisualRevision={name:report.revision,evidence:'docs/maintenance-acceptance.json',previousEvidence:'docs/reactor-acceptance.json',latestUserOverride:'Do not treat chaos as artfully rotated frames. Existing optical and effect layers stay active; ordinary upright panes now have mismatched widths, stale line heights, overflowing columns and unfinished frames. Previous source and original requirement text retained.'};fs.writeFileSync('docs/requirements.json',JSON.stringify(ledger,null,2)+'\n');
console.log('PASS: new production revision, 20 regression checks, upright ordinary windows, 27 HTTP routes, old layers/rules retained, 6 healthy core, builder stopped; no new dependencies.');
