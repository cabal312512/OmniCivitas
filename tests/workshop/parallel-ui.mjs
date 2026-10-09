import {testDeps,testBase} from '../runtime-location.mjs';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {setTimeout as pause} from 'node:timers/promises';

const base=process.env.OCV_WORKSHOP_BASE_URL||testBase;
const folder=join(testDeps,'runtime/reports/labs-parallel');
await mkdir(folder,{recursive:true});
const report={schema:'ocv.labs.parallel-ui/1',startedAt:new Date().toISOString(),passed:false,checks:[],errors:[]};
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(e.message));
const jobs=[];
async function check(name,run){const start=Date.now();try{const evidence=await run();report.checks.push({name,passed:true,elapsedMs:Date.now()-start,...evidence});console.log(JSON.stringify({check:report.checks.length,passed:true,elapsedMs:Date.now()-start}))}catch(error){report.checks.push({name,passed:false,error:error.message.slice(0,600)});throw error}}
async function launch(locator,domain){
 const response=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/${domain}/jobs`&&r.request().method()==='POST');
 await locator.click();const r=await response;assert.ok(r.ok(),`Job creation: HTTP ${r.status()}`);
 const job=await r.json();jobs.push({domain,id:job.id,ticket:job.ticket});
 return{job,request:r.request().postDataJSON().request};
}
async function finish(domain,job){
 const deadline=Date.now()+190000,states=[];
 while(Date.now()<deadline){
  const r=await page.request.post(`${base}/api/${domain}/jobs/${job.id}/read`,{data:{ticket:job.ticket},timeout:12000});
  assert.ok(r.ok(),`Job read: HTTP ${r.status()}`);const row=await r.json();
  if(states.at(-1)!==row.state)states.push(row.state);
  if(['done','failed','cancelled','timed_out'].includes(row.state)){assert.equal(row.state,'done',`Job failed: ${String(row.error||row.result?.reason||row.state).slice(0,180)}`);return{row,states}}
  await pause(800);
 }
 throw Error('Bounded background deadline exceeded');
}
async function bytes(locator){const pending=page.waitForEvent('download');await locator.click();return readFile(await(await pending).path())}
let mechanical;
try{
 await page.goto(base+'/workshop/');const app=page.frameLocator('#workshop-ui');
 await page.waitForFunction(()=>window.__ocvWorkshopResults?.[0]?.result?.frames?.length>0,{timeout:30000});
 await check('Compact nameless workshop and four actual editable component presets',async()=>{
  assert.equal(await app.locator('.part-label').count(),0);assert.equal(await app.locator('.example-card p').count(),0);
  assert.equal(await app.locator('[data-preset]').count(),4);
  const initial=await page.evaluate(()=>window.__ocvWorkshopProject.world.bodies.length);
  for(const name of ['flywheel','counterweight','roller','buffer'])await app.locator(`[data-preset="${name}"]`).click();
  await page.waitForFunction(n=>window.__ocvWorkshopProject.world.bodies.length===n+4,initial);
  const added=await page.evaluate(()=>window.__ocvWorkshopProject.world.bodies.slice(-4));
  assert.deepEqual(added.map(b=>b.label),['飞轮','配重','滚轮','缓冲块']);assert.equal(added[1].mass,12);assert.equal(added[3].restitution,.75);
  await app.getByRole('button',{name:'六摆相位阵列',exact:true}).click();
  await page.waitForFunction(()=>window.__ocvWorkshopResults[0].project.world.bodies.length===13);
  assert.equal(await app.locator('body').innerText().then(t=>t.includes('服务器')),false);
  return{presets:added.map(({label,kind,mass})=>({label,kind,mass})),parts:13};
 });
 await check('Normal workshop run launches both paths, retains local view, then explicitly shows finer native data',async()=>{
  await app.getByRole('button',{name:'保存版本',exact:true}).click();
  await app.locator('.record-meta').filter({hasText:'版本 1'}).waitFor();
  const mass=app.getByLabel('质量 / kg',{exact:true});await mass.fill(String(Number(await mass.inputValue())+.1));await mass.press('Tab');
  const launched=await launch(app.getByRole('button',{name:'▶ 运行',exact:true}),'workshop');
  await expect(app.getByRole('button',{name:'▶ 运行',exact:true})).toBeEnabled();
  await page.waitForFunction(expected=>JSON.stringify(window.__ocvWorkshopResults[0]?.request?.world?.bodies)===JSON.stringify(expected),launched.request.world.bodies);
  await app.locator('.server-record[data-result-source="local"]').waitFor();
  const front=await page.evaluate(()=>window.__ocvWorkshopResults[0]);
  const {row,states}=await finish('workshop',launched.job);
  await app.locator('.server-record[data-review="ready"]').waitFor();
  assert.deepEqual(await page.evaluate(()=>window.__ocvWorkshopResults[0]),front,'Native completion must not replace the local view');
  assert.ok(launched.request.world.stepS<front.request.world.stepS);
  assert.deepEqual(launched.request.world.bodies,front.request.world.bodies);
  assert.equal(launched.request.world.seed,front.request.world.seed);
  const outputBytes=Buffer.byteLength(JSON.stringify(row.result.engine));assert.ok(outputBytes>16384,'Exercise the original 413 failure with a rich actual result');
  await app.locator('[data-native-result]').click();
  await app.locator('.server-record[data-result-source="review"]').waitFor();
  await page.waitForFunction(dt=>window.__ocvWorkshopResults[0].request.world.stepS===dt,launched.request.world.stepS);
  const selected=await page.evaluate(()=>window.__ocvWorkshopResults[0]);
  assert.deepEqual(selected.result.frames,row.result.engine.frames);assert.deepEqual(selected.request,launched.request);
  const exported=JSON.parse(await bytes(page.locator('#workshop-replay').getByRole('button',{name:'回放包 ↓',exact:true})));
  assert.deepEqual(exported.request,launched.request);assert.deepEqual(exported.result.frames,row.result.engine.frames);
  mechanical={front,native:row.result.engine,request:launched.request};
  await app.locator('.example-library').screenshot({path:join(folder,'workshop-examples.png')});
  return{job:row.id,states,outputBytes,localStepS:front.request.world.stepS,nativeStepS:launched.request.world.stepS,localFrames:front.result.frames.length,nativeFrames:row.result.engine.frames.length,explicitView:true,exportMatches:true};
 });
 await check('Parameter experiment exists locally and in the native path without relabelling simulation records',async()=>{
  await app.getByLabel('实验参数',{exact:true}).selectOption('gravityY');
  await app.getByLabel('实验取值',{exact:true}).fill('-9.81,-4');await app.getByLabel('实验取值',{exact:true}).press('Tab');
  const launched=await launch(app.locator('[data-native-scan]'),'workshop');
  await app.locator('.scan-panel tbody tr').nth(1).waitFor();
  assert.equal(await app.locator('.scan-panel tbody tr').count(),2);
  assert.equal(await app.locator('.server-record').getAttribute('data-result-source'),'local');
  const frontExperiment=JSON.parse(await bytes(app.getByRole('button',{name:'实验结果 ↓',exact:true})));
  assert.equal(frontExperiment.request.op,'scan');assert.equal(frontExperiment.result.scan.runs.length,2);
  const {row,states}=await finish('workshop',launched.job);
  await app.locator('.server-record[data-review="ready"]').waitFor();await app.locator('[data-native-result]').click();
  await app.locator('.server-record[data-result-source="review"]').waitFor();
  const nativeExperiment=JSON.parse(await bytes(app.getByRole('button',{name:'实验结果 ↓',exact:true})));
  assert.deepEqual(nativeExperiment.request,launched.request);assert.deepEqual(nativeExperiment.result.scan,row.result.engine.scan);
  const replay=JSON.parse(await bytes(app.getByRole('button',{name:'回放 ↓',exact:true})));
  assert.equal(replay.request.op,'simulate');assert.deepEqual(replay.result.frames,mechanical.native.frames);
  return{job:row.id,states,localRuns:2,nativeRuns:row.result.engine.scan.runs.length,sourceFramesRetained:true};
 });
 await page.goto(base+'/signals/');const signal=page.frameLocator('#signals-ui');
 await signal.locator('[data-testid=lab-status]').filter({hasText:/Complete/i}).waitFor({timeout:30000});
 await check('Circuit normal run keeps coarse frontend results until a finer native record is explicitly selected',async()=>{
  assert.equal(await signal.locator('[data-network-node] text').count(),0);assert.equal(await signal.locator('.part-id,.terminal-name').count(),0);
  await signal.locator('[data-testid=template-rc]').click();
  const originalStep=Number(await signal.getByLabel('Step / s',{exact:true}).inputValue());
  const launched=await launch(signal.locator('[data-testid=run-circuit]'),'signals');
  await signal.locator('[data-testid=recorded-time-step]').waitFor();
  const originalReadout=await signal.locator('[data-testid=recorded-time-step]').innerText();
  const {row,states}=await finish('signals',launched.job);
  await expect(signal.locator('[data-testid=server-circuit]')).toBeEnabled();
  assert.equal(await signal.locator('[data-testid=recorded-time-step]').innerText(),originalReadout);
  assert.equal(await signal.locator('[data-testid=native-analysis]').count(),0);
  assert.ok(launched.request.analysis.stepS<originalStep);
  await signal.locator('[data-testid=server-circuit]').click();await signal.locator('[data-testid=native-analysis]').waitFor();
  assert.notEqual(await signal.locator('[data-testid=recorded-time-step]').innerText(),originalReadout);
  const verification=JSON.parse(await bytes(signal.locator('.native-analysis').getByRole('button',{name:'Data ↗',exact:true})));
  assert.deepEqual(verification,row.result.analysis);
  await signal.locator('.native-analysis').screenshot({path:join(folder,'circuit-review.png')});
  return{job:row.id,states,localStepS:originalStep,nativeStepS:launched.request.analysis.stepS,checks:row.result.analysis.summary.checks,explicitView:true};
 });
 await check('Network normal run also uses the shared backend, with explicit results and stale-view protection',async()=>{
  const launched=await launch(signal.locator('[data-testid=run-network]'),'signals');
  const {row,states}=await finish('signals',launched.job);
  await expect(signal.locator('[data-testid=server-network]')).toBeEnabled();
  assert.equal(await signal.locator('[data-testid=native-analysis]').count(),0);
  await signal.locator('[data-testid=server-network]').click();await signal.locator('[data-testid=native-analysis]').waitFor();
  const csv=await bytes(signal.locator('[data-testid=export-analysis]'));assert.ok(csv.toString().includes('check'));
  assert.equal(await signal.locator('.network-timeline').getAttribute('data-playback-mode'),'continuous');
  const horizon=signal.getByLabel('Horizon / ms',{exact:true});await horizon.fill(String(Number(await horizon.inputValue())+1));await horizon.press('Tab');
  assert.equal(await signal.locator('[data-testid=native-analysis]').count(),0);
  assert.equal(await signal.locator('[data-testid=server-network]').isDisabled(),true);
  await signal.locator('.server-section').getByRole('button',{name:'Read',exact:true}).click();
  await signal.locator('[data-testid=review-status]').filter({hasText:/完成|就绪/}).waitFor();
  assert.equal(await signal.locator('[data-testid=server-network]').isDisabled(),true);
  return{job:row.id,states,checks:row.result.analysis.summary.checks,csvBytes:csv.length,staleCacheNotApplied:true};
 });
 assert.equal(report.errors.length,0);report.passed=true;
}catch(error){report.error=error.message.slice(0,700);await page.screenshot({path:join(folder,'failure.png')}).catch(()=>{});process.exitCode=1;
}finally{
 for(const job of jobs)await page.request.post(`${base}/api/${job.domain}/jobs/${job.id}/cancel`,{data:{ticket:job.ticket},timeout:12000}).catch(()=>{});
 report.finishedAt=new Date().toISOString();await writeFile(join(folder,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,error:report.error||null,report:join(folder,'report.json')}));await browser.close();
}
