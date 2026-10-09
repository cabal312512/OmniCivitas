import {testDeps} from '../runtime-location.mjs';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const base=process.env.OCV_WORKSHOP_BASE_URL||`http://localhost:${process.env.OCV_WEB_PORT||8080}`;
const folder=join(testDeps,'runtime/reports/phase11-browser');await mkdir(folder,{recursive:true});
const report={schema:'ocv.workshop/browser-proof/1',startedAt:new Date().toISOString(),passed:false,checks:[],downloads:[],errors:[]};
const browser=await chromium.launch({headless:process.env.OCV_BROWSER_VISIBLE!=='1',...(process.env.OCV_BROWSER_CHANNEL?{channel:process.env.OCV_BROWSER_CHANNEL}:{}),args:['--enable-webgl','--ignore-gpu-blocklist']});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});const page=await context.newPage();page.setDefaultTimeout(15000);
page.on('pageerror',error=>report.errors.push(error.message));
page.on('console',message=>{if(message.type()==='error'&&!/favicon/.test(message.text()))report.errors.push(message.text().slice(0,300));});
const wasm=[];page.on('response',r=>{if(/\/workshop\/.*\.wasm(?:\?|$)/.test(r.url()))wasm.push({path:new URL(r.url()).pathname,status:r.status()});});
async function check(name,fn){const start=Date.now();try{const evidence=await fn();report.checks.push({name,passed:true,elapsedMs:Date.now()-start,...evidence});}catch(e){report.checks.push({name,passed:false,error:e.message.slice(0,400)});throw e;}}
async function download(locator,validate){const pending=page.waitForEvent('download');await locator.click();const item=await pending,bytes=await readFile(await item.path());assert.ok(bytes.length>0);await validate(bytes);report.downloads.push({name:item.suggestedFilename(),bytes:bytes.length});await item.saveAs(join(folder,item.suggestedFilename()));return bytes;}
async function clickResponse(locator,path){
 const pending=page.waitForResponse(r=>new URL(r.url()).pathname===path&&r.request().method()==='POST');
 await locator.click();const response=await pending;
 assert.ok(response.ok(),`${path}: HTTP ${response.status()}`);
 return response.json();
}
let app;
function verifyRecordedMotion(record){
 assert.equal(record.result.ok,true);assert.match(record.result.engine,/Rapier|ME1/);
 const frames=record.result.frames;assert.ok(frames.length>1&&frames.length<=256);
 let previous=-1;
 for(const frame of frames){assert.ok(Number.isFinite(frame.t)&&frame.t>=previous);previous=frame.t;for(const body of frame.bodies){for(const key of ['x','y','angle','vx','vy','omega'])assert.ok(Number.isFinite(body[key]),`${body.id}.${key} is finite`);}}
 return record;
}
async function loadExample(id){
 const pending=page.waitForResponse(r=>new URL(r.url()).pathname===`/workshop/examples/${id}.json`&&r.request().method()==='GET');
 await app.locator(`.example-card[data-example-id="${id}"]`).click();
 const response=await pending;assert.equal(response.status(),200);const source=await response.json();
 await page.waitForFunction(name=>window.__ocvWorkshopProject?.name===name&&window.__ocvWorkshopResults?.[0]?.project?.name===name&&window.__ocvWorkshopResults[0].result?.ok===true,source.name,{timeout:30000});
 const actual=await page.evaluate(()=>({project:window.__ocvWorkshopProject,record:window.__ocvWorkshopResults[0]}));
 assert.deepEqual(actual.project,source);assert.deepEqual(actual.record.request.world,source.world);verifyRecordedMotion(actual.record);
 await app.getByRole('button',{name:'↺ 重置',exact:true}).click();
 return {source,record:actual.record};
}
async function runEditedProject(){
 const world=await page.evaluate(()=>window.__ocvWorkshopProject.world),prior=await page.evaluate(()=>window.__ocvWorkshopResults[0].result.summary.inputChecksum);
 await app.getByRole('button',{name:'▶ 运行',exact:true}).click();
 await page.waitForFunction(({world,prior})=>{const r=window.__ocvWorkshopResults?.[0];return r?.result?.ok===true&&r.result.summary.inputChecksum!==prior&&JSON.stringify(r.request.world)===JSON.stringify(world)},{world,prior},{timeout:30000});
 const record=verifyRecordedMotion(await page.evaluate(()=>window.__ocvWorkshopResults[0]));assert.deepEqual(record.request.world,world);
 await app.getByRole('button',{name:'↺ 重置',exact:true}).click();return record;
}
async function fillNumber(locator,value){await locator.fill(String(value));await locator.press('Tab');}
try{
 await check('Shared website shell and first-entry Rust example',async()=>{await page.goto(base+'/workshop/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__ocvWorkshopResults?.[0]?.result?.ok===true,{},{timeout:60000});app=page.frames().find(frame=>new URL(frame.url()).pathname.startsWith('/workshop/ui/'));assert.ok(app,'Real Blazor workbench iframe');const initial=await page.evaluate(()=>({project:window.__ocvWorkshopProject,result:window.__ocvWorkshopResults[0].result}));assert.equal(initial.project.schema,'ocv.workshop-project/1');assert.ok(initial.result.frames.length>1);assert.match(initial.result.engine,/Rapier|ME1/);assert.match(initial.result.version,/rod-radial-1/,'The deployed browser must load the rebuilt rod solver');assert.ok(wasm.some(r=>r.path.includes('/engines/')&&r.status===200));assert.ok(await page.locator('.workshop-header .workshop-logo').isVisible());await page.locator('#workshop-search').fill('通信实验');await page.locator('[data-workshop-search]').click();await page.locator('.workshop-search-results a[href="/signals/"]').waitFor();await page.locator('#workshop-search').press('Escape');await page.screenshot({path:join(folder,'workshop-entry.png')});return{bodies:initial.project.world.bodies.length,frames:initial.result.frames.length,engine:initial.result.engine,version:initial.result.version,wasm};});
 await check('C# engineering values remain editable through undo, redo and recomputation',async()=>{
  await app.getByRole('button',{name:'↺ 重置',exact:true}).click();
  const selectedLabel=(await app.locator('.inspector-part strong').textContent()).trim();
  const originalBodies=await page.evaluate(()=>window.__ocvWorkshopProject.world.bodies);
  const input=app.getByLabel('质量 / kg',{exact:true}),original=Number(await input.inputValue()),changed=original+1;
  await input.fill(String(changed));await input.press('Tab');
  await page.waitForFunction(before=>window.__ocvWorkshopProject.world.bodies.some(b=>before.find(old=>old.id===b.id)?.mass!==b.mass),originalBodies);
  const edited=await page.evaluate(before=>window.__ocvWorkshopProject.world.bodies.filter(b=>before.find(old=>old.id===b.id)?.mass!==b.mass),originalBodies);
  assert.equal(edited.length,1);assert.equal(edited[0].mass,changed);const selected=edited[0].id;
  await app.getByRole('button',{name:'↶ 撤销',exact:true}).click();
  await page.waitForFunction(({id,value})=>window.__ocvWorkshopProject.world.bodies.find(b=>b.id===id)?.mass===value,{id:selected,value:original});
  await app.getByRole('button',{name:'↷ 重做',exact:true}).click();
  await page.waitForFunction(({id,value})=>window.__ocvWorkshopProject.world.bodies.find(b=>b.id===id)?.mass===value,{id:selected,value:changed});
  const before=await page.evaluate(id=>window.__ocvWorkshopResults[0].request.world.bodies.find(b=>b.id===id)?.mass,selected);
  await app.getByRole('button',{name:'▶ 运行',exact:true}).click();
  await page.waitForFunction(({id,value})=>window.__ocvWorkshopResults[0].request.world.bodies.find(b=>b.id===id)?.mass===value,{id:selected,value:changed});
  return{part:selected,selectedLabel,originalMass:original,newMass:changed,previousRecordedMass:before,undoRedo:true};
 });
 await check('C# project package and standalone SVG contain the real edited assembly',async()=>{const project=await page.evaluate(()=>window.__ocvWorkshopProject);await download(app.getByRole('button',{name:'工程文件 ↓',exact:true}),bytes=>{const item=JSON.parse(bytes);assert.equal(item.schema,'ocv.workshop-package/1');assert.equal(item.units,'SI');assert.deepEqual(item.project,project);});await download(app.getByRole('button',{name:'图纸 ↓',exact:true}).first(),async bytes=>{const evidence=await page.evaluate(text=>{const doc=new DOMParser().parseFromString(text,'image/svg+xml');return{error:!!doc.querySelector('parsererror'),namespace:doc.documentElement.namespaceURI,shapes:doc.querySelectorAll('rect,circle,path').length}},bytes.toString('utf8'));assert.equal(evidence.error,false);assert.equal(evidence.namespace,'http://www.w3.org/2000/svg');assert.ok(evidence.shapes>2);});return{editableProjectExported:true,standaloneSvgParsed:true};});
 await check('Reusable Vue component captures real parts and reinstantiates editable bodies',async()=>{const before=await page.evaluate(()=>window.__ocvWorkshopProject.world.bodies.length);await page.locator('#workshop-library .part-list input[type=checkbox]').first().check();await page.getByLabel('组件名称',{exact:true}).fill('参考组件');await page.getByRole('button',{name:'收进零件库',exact:true}).click();const entry=page.locator('#workshop-library .modules article').first();await entry.getByRole('button',{name:'参考组件 ↗',exact:true}).waitFor();await download(entry.getByRole('button',{name:'导出组件',exact:true}),bytes=>{const project=JSON.parse(bytes);assert.equal(project.schema,'ocv.workshop-project/1');assert.equal(project.world.bodies.length,1);});await entry.locator('.insert').click();await page.waitForFunction(count=>window.__ocvWorkshopProject.world.bodies.length===count+1,before);const ids=await page.evaluate(()=>window.__ocvWorkshopProject.world.bodies.map(b=>b.id));assert.equal(new Set(ids).size,ids.length);return{before,after:ids.length,uniqueIds:true};});
 await check('Svelte replay seeks recorded states and exports actual motion',async()=>{
  const stage=page.locator('#workshop-replay'),seek=stage.getByLabel('记录帧',{exact:true});
  await seek.focus();await seek.press('Home');await seek.press('ArrowRight');await seek.press('ArrowRight');
  await stage.getByText('3 /',{exact:false}).waitFor();assert.equal(Number(await seek.inputValue()),2);
  const history=await page.evaluate(()=>({current:window.__ocvWorkshopResults[0],previous:window.__ocvWorkshopResults[1]}));
  const traced=await stage.getByLabel('轨迹零件',{exact:true}).inputValue();
  const frame=history.current.result.frames[2],body=frame.bodies.find(b=>b.id===traced);assert.ok(body);
  const measured=[body.x,body.y,Math.hypot(body.vx,body.vy),body.omega].map(x=>x.toFixed(3));
  const probe=stage.getByLabel('运动测量',{exact:true});
  assert.deepEqual((await probe.locator('strong').allTextContents()).map(x=>x.trim()),measured);
  assert.ok(history.previous,'The earlier real run is retained for comparison');
  await stage.getByLabel('对比上次运行',{exact:true}).check();
  const table=stage.getByRole('table',{name:'两次运行差值',exact:true});await table.waitFor();
  const nearest=[...history.previous.result.frames].sort((a,b)=>Math.abs(a.t-frame.t)-Math.abs(b.t-frame.t))[0];
  const previousBodies=new Map(nearest.bodies.map(b=>[b.id,b]));
  const differences=frame.bodies.filter(b=>previousBodies.has(b.id)).slice(0,12).map(b=>{
   const prior=previousBodies.get(b.id);
   return[Math.hypot(b.x-prior.x,b.y-prior.y),Math.hypot(b.vx,b.vy)-Math.hypot(prior.vx,prior.vy),b.omega-prior.omega].map(x=>x.toFixed(3));
  });
  const observed=await table.locator('tbody tr').evaluateAll(rows=>rows.map(row=>[...row.querySelectorAll('td')].slice(1).map(cell=>cell.textContent.trim())));
  assert.ok(differences.length>0);assert.deepEqual(observed,differences);
  await download(stage.getByRole('button',{name:'轨迹表 ↓',exact:true}),bytes=>{const text=bytes.toString('utf8');assert.ok(text.startsWith('t_s,id,x_m,y_m,angle_rad,vx_m_s,vy_m_s,omega_rad_s'));assert.ok(text.trim().split('\n').length>3);});
  await download(stage.getByRole('button',{name:'回放包 ↓',exact:true}),bytes=>{const item=JSON.parse(bytes);assert.equal(item.schema,'ocv.workshop-replay/1');assert.ok(item.result.frames.length>1);assert.equal(item.result.ok,true);});
  return{recordedFrame:3,tracedBody:traced,measured,comparisonRows:differences.length,comparisonNumbers:observed,previousSampleTime:nearest.t,currentSampleTime:frame.t,originalFramesExported:true};
 });
 await check('3D appearance responds to actual pointer drag',async()=>{const detail=app.locator('details').filter({has:app.getByText('三维外观',{exact:true})});if(await detail.getAttribute('open')===null)await detail.locator('summary').click();await app.getByRole('button',{name:'刷新预览',exact:true}).click();const canvas=app.locator('#mechanical-appearance');await canvas.scrollIntoViewIfNeeded();assert.notEqual(await canvas.getAttribute('data-unavailable'),'true');const box=await canvas.boundingBox();assert.ok(box&&box.width>100);const before=await canvas.screenshot();await page.mouse.move(box.x+box.width*.45,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.66,box.y+box.height*.6,{steps:5});await page.mouse.up();const after=await canvas.screenshot();assert.notDeepEqual(before,after);await canvas.screenshot({path:join(folder,'workshop-appearance.png')});return{actualRenderedChange:true,appearanceOnly:true};});
 await check('Both challenges and actual server revision lifecycle remain usable from C# UI',async()=>{
  const challenges=[];
  for(const [button,id]of[['弹珠交付 ◇','delivery-01'],['稳定转速 ◇','steady-01']]){
   await app.getByRole('button',{name:button,exact:true}).click();
   await page.waitForFunction(challenge=>window.__ocvWorkshopResults?.[0]?.request?.challenge?.id===challenge&&window.__ocvWorkshopResults[0].result?.summary?.challengeComplete===true,id,{timeout:30000});
   await app.locator('.metrics-row').getByText('已达成',{exact:true}).waitFor();
   const record=await page.evaluate(()=>window.__ocvWorkshopResults[0]);
   assert.equal(record.result.ok,true);assert.ok(record.result.frames.length>1);
   challenges.push({id,frames:record.result.frames.length,completed:true,engine:record.result.engine});
  }
  const name=app.getByLabel('工程名称',{exact:true});await name.fill('机械工坊浏览器核对');await name.press('Tab');
  const first=await clickResponse(app.getByRole('button',{name:'保存到服务器',exact:true}),'/api/workshop/projects');
  assert.equal(first.storage,'PostgreSQL');assert.equal(first.revision,1);
  await app.locator('.record-meta').filter({hasText:'版本 1'}).waitFor();
  const mass=app.getByLabel('质量 / kg',{exact:true}),original=Number(await mass.inputValue()),changed=original+1;
  await mass.fill(String(changed));await mass.press('Tab');
  await page.waitForFunction(value=>window.__ocvWorkshopProject.world.bodies.find(b=>b.id==='wheel')?.mass===value,changed);
  const second=await clickResponse(app.getByRole('button',{name:'保存到服务器',exact:true}),'/api/workshop/projects');
  assert.equal(second.id,first.id);assert.equal(second.revision,2);assert.notEqual(second.digest,first.digest);
  await app.locator('.record-meta').filter({hasText:'版本 2'}).waitFor();
  await mass.fill(String(changed+1));await mass.press('Tab');
  const reopened=await clickResponse(app.getByRole('button',{name:'重开已保存工程',exact:true}),`/api/workshop/projects/${first.id}/read`);
  assert.equal(reopened.project.world.bodies.find(b=>b.id==='wheel').mass,changed);
  await page.waitForFunction(value=>window.__ocvWorkshopProject.world.bodies.find(b=>b.id==='wheel')?.mass===value,changed);
  const versions=await clickResponse(app.getByRole('button',{name:'历史版本',exact:true}),`/api/workshop/projects/${first.id}/versions`);
  assert.deepEqual(versions.versions.map(v=>v.revision),[2,1]);
  const revision=app.getByLabel('要恢复的版本',{exact:true});await revision.fill('1');await revision.press('Tab');
  const restored=await clickResponse(app.getByRole('button',{name:'恢复版本',exact:true}),`/api/workshop/projects/${first.id}/rollback`);
  assert.equal(restored.revision,3);assert.equal(restored.operation,'rollback');assert.equal(restored.digest,first.digest);
  assert.equal(restored.parentSnapshot,second.snapshot);assert.equal(restored.sourceSnapshot,first.snapshot);
  await page.waitForFunction(value=>window.__ocvWorkshopProject.world.bodies.find(b=>b.id==='wheel')?.mass===value,original);
  await app.locator('.record-meta').filter({hasText:'版本 3'}).waitFor();
  const retained=await clickResponse(app.getByRole('button',{name:'历史版本',exact:true}),`/api/workshop/projects/${first.id}/versions`);
  assert.deepEqual(retained.versions.map(v=>v.revision),[3,2,1]);
  const branch=await clickResponse(app.getByRole('button',{name:'新建分支',exact:true}),`/api/workshop/projects/${first.id}/branch`);
  assert.notEqual(branch.id,first.id);assert.equal(branch.revision,1);assert.equal(branch.sourceProject,first.id);assert.equal(branch.sourceSnapshot,restored.snapshot);
  await page.waitForFunction(()=>window.__ocvWorkshopProject.name==='机械工坊浏览器核对 / 分支');
  await app.locator('.record-meta').filter({hasText:'版本 1'}).waitFor();
  await app.getByRole('button',{name:'保存到服务器',exact:true}).waitFor({state:'visible'});
  await app.locator('.server-record').screenshot({path:join(folder,'workshop-project-history.png')});
  return{challenges,project:first.id,branch:branch.id,saveRevisions:[1,2],restoredNewRevision:3,retainedRevisions:[3,2,1],storage:'PostgreSQL',reopenedEditedValue:changed};
 });
 await check('Complex editable examples preserve real geared motion through viewport and joint edits',async()=>{
  const cards=app.locator('.example-card');await cards.last().waitFor();
  assert.deepEqual((await cards.evaluateAll(items=>items.map(item=>item.dataset.exampleId))).sort(),['gearbox','timing-belt','domino-line','marble-relay','pendulum-bank','tuned-damping','crank-slider','basketball'].sort());
  const {source,record:initial}=await loadExample('gearbox');
  assert.ok(source.world.joints.filter(j=>j.kind==='gear').length>=3);assert.ok(source.world.bodies.filter(b=>b.kind==='gear').length>=4);
  const sheet=app.locator('#mechanical-sheet'),readView=async()=>(await sheet.getAttribute('viewBox')).split(/\s+/).map(Number);
  await app.getByRole('button',{name:'复位视图',exact:true}).click();
  await app.waitForFunction(()=>document.querySelector('#mechanical-sheet').getAttribute('viewBox')==='0 0 1100 620');const reset=await readView();
  await app.getByRole('button',{name:'放大画布',exact:true}).click();
  await app.waitForFunction(width=>Number(document.querySelector('#mechanical-sheet').getAttribute('viewBox').split(/\s+/)[2])<width,reset[2]);const zoomed=await readView();
  await app.getByRole('button',{name:'缩小画布',exact:true}).click();
  await app.waitForFunction(width=>Number(document.querySelector('#mechanical-sheet').getAttribute('viewBox').split(/\s+/)[2])>width,zoomed[2]);
  await app.getByRole('button',{name:'显示全部',exact:true}).click();
  await app.waitForFunction(()=>document.querySelector('#mechanical-sheet').getAttribute('viewBox')!=='0 0 1100 620');const fitted=await readView();
  const visible=await sheet.evaluate(svg=>{const bounds=svg.getBoundingClientRect();return [...svg.querySelectorAll('g.body')].map(body=>{const box=body.getBoundingClientRect();return {id:body.dataset.body,inside:box.left>=bounds.left-2&&box.right<=bounds.right+2&&box.top>=bounds.top-2&&box.bottom<=bounds.bottom+2};});});
  assert.equal(visible.length,source.world.bodies.length);assert.ok(visible.every(body=>body.inside),'Show-all fits the actual rendered parts within the drawing viewport');
  const joint=source.world.joints.find(j=>j.kind==='gear'),editor=app.locator(`.constraint-editor[data-joint-id="${joint.id}"]`);
  await editor.locator('summary').click();const ratio=Number((joint.ratio*.9).toFixed(4));await fillNumber(editor.getByLabel('传动比',{exact:true}),ratio);
  await page.waitForFunction(({id,value})=>window.__ocvWorkshopProject.world.joints.find(j=>j.id===id)?.ratio===value,{id:joint.id,value:ratio});
  await app.getByRole('button',{name:'↶ 撤销',exact:true}).click();
  await page.waitForFunction(({id,value})=>window.__ocvWorkshopProject.world.joints.find(j=>j.id===id)?.ratio===value,{id:joint.id,value:joint.ratio});
  await app.getByRole('button',{name:'↷ 重做',exact:true}).click();
  await page.waitForFunction(({id,value})=>window.__ocvWorkshopProject.world.joints.find(j=>j.id===id)?.ratio===value,{id:joint.id,value:ratio});
  const rerun=await runEditedProject(),shaft=joint.b,speeds=rerun.result.frames.map(f=>f.bodies.find(b=>b.id===shaft)?.omega||0);assert.ok(speeds.some(speed=>Math.abs(speed)>.1),'The edited geared shaft actually turns');
  const before=initial.result.frames.map(f=>f.bodies.find(b=>b.id===shaft)?.omega||0);
  const changes=speeds.map((value,i)=>Math.abs(value-(before[i]??value)));assert.ok(Math.max(...changes)>.01,'Changing the real transmission ratio changes recorded shaft speed');
  await sheet.screenshot({path:join(folder,'workshop-gearbox.png')});
  return{examples:await cards.count(),selectedExample:'gearbox',bodies:source.world.bodies.length,joints:source.world.joints.length,viewports:{reset,zoomed,fitted},allRenderedPartsInside:true,editedJoint:joint.id,originalRatio:joint.ratio,newRatio:ratio,undoRedo:true,shaft,maximumRecordedSpeedDifference:Math.max(...changes),frames:rerun.result.frames.length};
 });
 await check('Timer controls, motor changes and projectile velocity produce real events and motion',async()=>{
  const {source}=await loadExample('timing-belt'),motor=source.world.motors.find(m=>m.id==='drive');assert.ok(motor);const drive=app.locator('.motor-row[data-motor-id="drive"]');
  assert.equal(motor.enabled,false);await drive.getByRole('button',{name:'启用',exact:true}).click();
  await page.waitForFunction(()=>window.__ocvWorkshopProject.world.motors.find(m=>m.id==='drive')?.enabled===true);
  await drive.getByRole('button',{name:'停用',exact:true}).click();
  await page.waitForFunction(()=>window.__ocvWorkshopProject.world.motors.find(m=>m.id==='drive')?.enabled===false);
  const torque=motor.maxTorque+5;await fillNumber(drive.getByLabel('最大转矩 / N·m',{exact:true}),torque);
  await page.waitForFunction(value=>window.__ocvWorkshopProject.world.motors.find(m=>m.id==='drive')?.maxTorque===value,torque);
  const form=app.locator('.sensor-form');await form.getByLabel('传感类型',{exact:true}).selectOption('timer');await form.getByLabel('控制电机',{exact:true}).selectOption('drive');await form.getByLabel('执行动作',{exact:true}).selectOption('reverse');
  await fillNumber(form.getByLabel('触发阈值',{exact:true}),1.25);await fillNumber(form.getByLabel('触发上限',{exact:true}),1);await form.getByRole('button',{name:'添加传感控制',exact:true}).click();
  const oldIds=source.world.controls.map(c=>c.id);
  await page.waitForFunction(ids=>window.__ocvWorkshopProject.world.controls.some(c=>!ids.includes(c.id)),oldIds);
  const control=await page.evaluate(ids=>window.__ocvWorkshopProject.world.controls.find(c=>!ids.includes(c.id)),oldIds);
  assert.deepEqual({kind:control.kind,motor:control.motor,action:control.action,threshold:control.threshold,maxFirings:control.maxFirings},{kind:'timer',motor:'drive',action:'reverse',threshold:1.25,maxFirings:1});
  await app.getByRole('button',{name:'↶ 撤销',exact:true}).click();await page.waitForFunction(id=>!window.__ocvWorkshopProject.world.controls.some(c=>c.id===id),control.id);
  await app.getByRole('button',{name:'↷ 重做',exact:true}).click();await page.waitForFunction(id=>window.__ocvWorkshopProject.world.controls.some(c=>c.id===id),control.id);
  await app.locator(`.sensor-row[data-control-id="${control.id}"]`).waitFor();const actual=await runEditedProject();
  const fired=actual.result.keyMoments.filter(e=>e.kind==='control'&&e.id===control.id);assert.equal(fired.length,1);assert.equal(fired[0].action,'reverse');assert.equal(fired[0].sequence,1);assert.ok(Math.abs(fired[0].t-control.threshold)<=actual.request.world.stepS*2);
  const nearest=actual.result.frames.reduce((best,f,i)=>Math.abs(f.t-fired[0].t)<Math.abs(actual.result.frames[best].t-fired[0].t)?i:best,0);
  const momentButtons=app.locator('.moment-button[data-kind="control"]'),times=await momentButtons.evaluateAll(items=>items.map(item=>Number(item.dataset.time))),index=times.findIndex(t=>Math.abs(t-fired[0].t)<.000001);assert.ok(index>=0);
  await momentButtons.nth(index).click();await app.waitForFunction(frame=>Number(document.querySelector('.timeline-controls input[aria-label="记录帧"]').value)===frame,nearest);
  const replay=page.locator('#workshop-replay'),moments=replay.locator('details.moments');if(await moments.getAttribute('open')===null)await moments.locator('summary').click();
  await replay.getByRole('button',{name:`定位事件 ${fired[0].t.toFixed(3)}秒`,exact:true}).first().click();
  await page.waitForFunction(frame=>Number(document.querySelector('#workshop-replay input[aria-label="记录帧"]').value)===frame,nearest);
  const checksumAfterSeeking=await page.evaluate(()=>window.__ocvWorkshopResults[0].result.summary.inputChecksum);assert.equal(checksumAfterSeeking,actual.result.summary.inputChecksum,'Event seek keeps the original computed run');
  const {source:projectile,record:originalFlight}=await loadExample('basketball'),ballId=projectile.challenge?.body||projectile.world.bodies.find(b=>b.mode==='dynamic').id;
  assert.equal(await app.locator('.inspector-part').getAttribute('data-body-id'),ballId);const ball=projectile.world.bodies.find(b=>b.id===ballId),vx=ball.vx+.4,vy=ball.vy+.8;
  await fillNumber(app.getByLabel('初始水平速度 / m·s⁻¹',{exact:true}),vx);await fillNumber(app.getByLabel('初始垂直速度 / m·s⁻¹',{exact:true}),vy);
  await page.waitForFunction(({id,vx,vy})=>{const b=window.__ocvWorkshopProject.world.bodies.find(b=>b.id===id);return b?.vx===vx&&b?.vy===vy},{id:ballId,vx,vy});const flight=await runEditedProject();
  const sample=flight.result.frames.reduce((best,f)=>Math.abs(f.t-.5)<Math.abs(best.t-.5)?f:best,flight.result.frames[0]),pose=sample.bodies.find(b=>b.id===ballId);
  const priorFrame=originalFlight.result.frames.reduce((best,f)=>Math.abs(f.t-sample.t)<Math.abs(best.t-sample.t)?f:best,originalFlight.result.frames[0]),priorPose=priorFrame.bodies.find(b=>b.id===ballId);
  assert.ok(sample.t>.3&&sample.t<.7);assert.ok(pose.x>ball.x+1&&pose.y>ball.y+1,'The edited projectile really launches');
  const movementDifference=Math.hypot(pose.x-priorPose.x,pose.y-priorPose.y);assert.ok(movementDifference>.1,'Initial velocity edits change the real early flight path');
  return{examples:['timing-belt','basketball'],motor:'drive',enabledToggle:true,torque,control,undoRedo:true,actualControlEvent:fired[0],nearestRecordedFrame:nearest,eventFrameTime:actual.result.frames[nearest].t,bothReplayEventSeek:true,noRecomputationOnSeek:true,projectile:{id:ballId,vx,vy,t:sample.t,x:pose.x,y:pose.y,earlyFlightDifference:movementDifference}};
 });
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{report.finishedAt=new Date().toISOString();await writeFile(join(folder,'report.json'),JSON.stringify(report,null,2));await context.close();await browser.close();console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,folder}));}
