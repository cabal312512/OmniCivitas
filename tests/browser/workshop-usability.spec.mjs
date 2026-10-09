import {testDeps} from '../runtime-location.mjs';
import {test,expect} from '@playwright/test';
import {copyFile,mkdir,writeFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';

const deps=testDeps;
const folder=path.join(deps,'runtime/reports'),reportFile=path.join(folder,'workshop-usability.json');
const redact=value=>String(value).replace(/[a-f0-9]{64}/gi,'[digest-or-capability]').slice(0,320);
const boxNumbers=value=>value.split(/\s+/).map(Number);

test('Workshop local playback, scoped controls, selection and captured mouse edits',async({page})=>{
  const report={schema:'ocv.workshop/usability-proof/1',startedAt:new Date().toISOString(),passed:false,checks:[],pageErrors:[],consoleErrors:[],submittedJobs:0,
    maximumPages:1,maximumWorkers:1,interceptedResponses:false,injectedProject:false,backendSubmissionRequested:false,
    scope:'Real DOM events and read-only project publications. This proof replays existing local frames; it does not submit native jobs or start services. In-flight initial-computation cancellation is timing-dependent and is not claimed here.'};
  let app;
  page.on('pageerror',error=>report.pageErrors.push(redact(error.message)));
  page.on('console',message=>{if(message.type()==='error'&&report.consoleErrors.length<5)report.consoleErrors.push(redact(message.text()))});
  page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname==='/api/workshop/jobs')report.submittedJobs++});
  const project=()=>page.evaluate(()=>window.__ocvWorkshopProject);
  const body=id=>page.evaluate(id=>window.__ocvWorkshopProject?.world.bodies.find(body=>body.id===id),id);
  const count=()=>page.evaluate(()=>window.__ocvWorkshopProject?.world.bodies.length);
  const view=async svg=>boxNumbers(await svg.getAttribute('viewBox'));
  async function check(name,fn){await test.step(name,async()=>{const start=Date.now();try{const evidence=await fn();report.checks.push({name,passed:true,elapsedMs:Date.now()-start,...evidence})}catch(error){report.checks.push({name,passed:false,elapsedMs:Date.now()-start,error:redact(error.message)});throw error}})}
  async function svgPoint(svg,rx,ry){return svg.evaluate((element,{rx,ry})=>{const rect=element.getBoundingClientRect(),p=element.createSVGPoint();p.x=rect.left+rect.width*rx;p.y=rect.top+rect.height*ry;const q=p.matrixTransform(element.getScreenCTM().inverse());return [(q.x-550)/55,(470-q.y)/55]},{rx,ry})}
  async function canvasMouse(svg,rx=.5,ry=.5){await svg.scrollIntoViewIfNeeded();const rect=await svg.boundingBox();expect(rect).not.toBeNull();const point={x:rect.x+rect.width*rx,y:rect.y+rect.height*ry};await page.mouse.move(point.x,point.y);return point}
  async function nudge(svg,id,key,field,delta){const before=await body(id);await svg.press(key);await expect.poll(async()=>Math.abs((await body(id))[field]-before[field]-delta)).toBeLessThan(1e-8);return body(id)}
  try{
    await check('First entry computes a real local example without a backend task',async()=>{
      await page.goto('/workshop/',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.__ocvWorkshopResults?.[0]?.result?.ok===true,null,{timeout:45000});
      app=page.frames().find(frame=>new URL(frame.url()).pathname.startsWith('/workshop/ui/'));
      expect(app,'The real workbench iframe is mounted').toBeTruthy();
      const source=await project(),result=await page.evaluate(()=>window.__ocvWorkshopResults[0].result);
      expect(source.schema).toBe('ocv.workshop-project/1');expect(result.frames.length).toBeGreaterThan(1);expect(result.frames.length).toBeLessThanOrEqual(256);
      expect(report.submittedJobs).toBe(0);
      return {bodies:source.world.bodies.length,frames:result.frames.length,initialBackendTasks:report.submittedJobs};
    });
    const svg=app.locator('#mechanical-sheet'),run=app.locator('.play-button'),name=app.getByRole('textbox',{name:'工程名称',exact:true});
    const probes=app.locator('.probe-overlay[data-probe-body]'),probe=id=>app.locator(`.probe-overlay[data-probe-body="${id}"]`);
    const metric=(id,key)=>probe(id).locator(`strong[data-probe-value="${key}"]`);
    await check('Playback locks edits; Space pauses and resumes without another computation',async()=>{
      await app.getByRole('button',{name:'从头重放',exact:true}).click();
      await expect(svg).toHaveAttribute('data-canvas-lock','true');await expect(run).toHaveAttribute('data-run-state','running');await expect(run).toBeDisabled();await expect(name).toBeDisabled();
      const before=await project();await svg.focus();await svg.press('ArrowRight');await svg.press('r');await svg.press('d');await svg.press('Delete');
      expect(await project()).toEqual(before);
      await expect(app.locator('details.probe-picker [data-probe-key]').first()).toBeDisabled();
      await svg.press('Space');await expect(svg).toHaveAttribute('data-canvas-lock','false');await expect(run).toHaveAttribute('data-run-state','paused');await expect(run).toHaveText('重新运行');await expect(run).toBeEnabled();await expect(name).toBeEnabled();
      await svg.press('Space');await expect(svg).toHaveAttribute('data-canvas-lock','true');await expect(run).toHaveAttribute('data-run-state','running');
      await svg.press('Space');await expect(svg).toHaveAttribute('data-canvas-lock','false');expect(await project()).toEqual(before);
      return {lockedProjectUnchanged:true,pauseResumeLocal:true};
    });
    await check('Two starter measurements follow actual frames and display physical quantities',async()=>{
      await expect(probes).toHaveCount(2);await expect(probe('marble')).toHaveCount(1);await expect(probe('wheel')).toHaveCount(1);
      await expect(probe('marble').locator('[data-probe-value]')).toHaveCount(4);await expect(probe('wheel').locator('[data-probe-value]')).toHaveCount(3);
      const record=await page.evaluate(()=>window.__ocvWorkshopResults[0]),index=Math.min(8,record.result.frames.length-1),sample=record.result.frames[index];
      const frameInput=app.getByRole('spinbutton',{name:'记录帧',exact:true});await frameInput.fill(String(index));await frameInput.press('Tab');
      await expect.poll(async()=>Number((await probe('marble').locator('.probe-heading small').textContent()).replace(/\s*s$/,''))).toBeCloseTo(sample.t,5);
      const pose=sample.bodies.find(body=>body.id==='marble'),world=record.request.world,source=world.bodies.find(body=>body.id==='marble');
      const speed=Math.hypot(pose.vx,pose.vy),linear=.5*source.mass*speed*speed,potential=-source.mass*(world.gravityX*pose.x+world.gravityY*pose.y);
      const rotational=.25*source.mass*source.radius*source.radius*pose.omega*pose.omega;
      for(const[key,value]of Object.entries({speed,linearKinetic:linear,potential,totalEnergy:linear+rotational+potential})){
        await expect.poll(async()=>Number(await metric('marble',key).textContent())).toBeCloseTo(value,2);
      }
      const leader=await probe('marble').locator(':scope > path:not([data-probe-path])').getAttribute('d'),start=/^M([-\d.eE+]+)\s+([-\d.eE+]+)/.exec(leader);
      expect(start,'A leader starts at the tracked body centre').not.toBeNull();expect(Number(start[1])).toBeCloseTo(550+55*pose.x,4);expect(Number(start[2])).toBeCloseTo(470-55*pose.y,4);
      const before=await probe('marble').locator(':scope > g[transform]').getAttribute('transform');await frameInput.fill('0');await frameInput.press('Tab');
      await expect(probe('marble').locator(':scope > g[transform]')).not.toHaveAttribute('transform',before);
      return {defaultTrackedBodies:2,quantitiesComparedToActualFrame:index,leaderMatchesPose:true,boxFollowsTime:true};
    });
    await check('The picker changes measurements and vector visibility; fixed bodies allow only position and angle',async()=>{
      const initial=await project(),dynamic=initial.world.bodies.find(body=>body.id==='marble'),fixed=initial.world.bodies.find(body=>body.mode==='fixed');
      expect(dynamic&&fixed,'The starter contains dynamic and fixed parts').toBeTruthy();
      await app.locator(`g.body[data-body="${dynamic.id}"]`).click();const picker=app.locator('details.probe-picker');await expect(picker).toBeVisible();
      await picker.locator('[data-probe-key="ax"]').check();await picker.locator('[data-probe-key="ay"]').check();await expect(metric(dynamic.id,'ax')).toHaveCount(1);await expect(metric(dynamic.id,'ay')).toHaveCount(1);
      const frames=await page.evaluate(()=>window.__ocvWorkshopResults[0].result.frames),first=frames[0].bodies.find(body=>body.id===dynamic.id),second=frames[1].bodies.find(body=>body.id===dynamic.id),dt=frames[1].t-frames[0].t;
      await expect.poll(async()=>Number(await metric(dynamic.id,'ax').textContent())).toBeCloseTo((second.vx-first.vx)/dt,2);
      await expect.poll(async()=>Number(await metric(dynamic.id,'ay').textContent())).toBeCloseTo((second.vy-first.vy)/dt,2);
      await picker.locator('[data-probe-vectors]').uncheck();await expect(probe(dynamic.id).locator('[data-probe-path]')).toHaveCount(0);
      await picker.locator('[data-probe-vectors]').check();await expect(probe(dynamic.id).locator('[data-probe-path="speed"]')).toHaveCount(1);
      await picker.getByRole('button',{name:'关闭测量框',exact:true}).click();await expect(probe(dynamic.id)).toHaveCount(0);
      await picker.locator('[data-probe-key="speed"]').check();await expect(probe(dynamic.id)).toHaveCount(1);await expect(probe(dynamic.id).locator('[data-probe-value]')).toHaveCount(1);
      await app.locator(`g.body[data-body="${fixed.id}"]`).click();
      for(const key of ['x','y','angle'])await expect(picker.locator(`[data-probe-key="${key}"]`)).toBeEnabled();
      for(const key of ['speed','vx','ax','omega','linearKinetic','potential'])await expect(picker.locator(`[data-probe-key="${key}"]`)).toBeDisabled();
      await picker.locator('[data-probe-key="x"]').check();await expect(metric(fixed.id,'x')).toHaveCount(1);expect(Number(await metric(fixed.id,'x').textContent())).toBeCloseTo(fixed.x,2);
      return {finiteDifferenceUsesRealAdjacentSamples:true,vectorToggle:true,fixedChoices:['x','y','angle'],clearDoesNotRestoreDefaults:true};
    });
    await check('Wheel zoom stays anchored to its cursor; middle and right mouse drag pan',async()=>{
      const rx=.63,ry=.38;await canvasMouse(svg,rx,ry);const before=await view(svg);
      await svg.evaluate(element=>element.ownerDocument.defaultView.addEventListener('wheel',event=>{const p=element.createSVGPoint();p.x=event.clientX;p.y=event.clientY;const q=p.matrixTransform(element.getScreenCTM().inverse());window.__ocvUsabilityWheel={x:event.clientX,y:event.clientY,world:[(q.x-550)/55,(470-q.y)/55]};},{capture:true,once:true,passive:true}));
      await page.mouse.wheel(0,-120);await expect.poll(async()=>(await view(svg))[2]).toBeLessThan(before[2]);
      const observed=await app.evaluate(()=>window.__ocvUsabilityWheel),anchored=observed.world;
      const after=await svg.evaluate((element,point)=>{const p=element.createSVGPoint();p.x=point.x;p.y=point.y;const q=p.matrixTransform(element.getScreenCTM().inverse());return [(q.x-550)/55,(470-q.y)/55]},observed);
      expect(Math.abs(after[0]-anchored[0])).toBeLessThan(.002);expect(Math.abs(after[1]-anchored[1])).toBeLessThan(.002);
      for(const button of ['middle','right']){
        const from=await canvasMouse(svg,.47,.42),prior=await view(svg);await page.mouse.down({button});await page.mouse.move(from.x+70,from.y+28,{steps:5});await page.mouse.up({button});
        await expect.poll(async()=>Math.abs((await view(svg))[0]-prior[0])).toBeGreaterThan(1);const current=await view(svg);expect(current[2]).toBeCloseTo(prior[2],5);
      }
      const displaced=JSON.stringify(await view(svg));await svg.press('f');await expect.poll(async()=>JSON.stringify(await view(svg))).not.toBe(displaced);
      return {cursorInvariantToleranceM:.002,panButtons:['middle','right']};
    });
    await check('Fit and plain plus/minus change only the view',async()=>{
      const source=await project();await svg.press('f');const initial=await view(svg);expect(initial.every(Number.isFinite)).toBe(true);
      await svg.press('Shift+Equal');await expect.poll(async()=>(await view(svg))[2]).toBeCloseTo(initial[2]*.8,4);
      await svg.press('Minus');await expect.poll(async()=>(await view(svg))[2]).toBeCloseTo(initial[2],4);expect(await project()).toEqual(source);
      return {fitWidth:initial[2],viewOnly:true};
    });
    const source=await project(),chosen=source.world.bodies.find(item=>item.id==='marble')||source.world.bodies.find(item=>item.mode==='dynamic'),other=source.world.bodies.find(item=>item.id!==chosen.id&&item.mode==='dynamic');
    const part=()=>app.locator(`g.body[data-body="${chosen.id}"]`);
    await check('Shift selection is additive and toggles individual parts',async()=>{
      await part().click();await expect(app.locator('g.body.picked')).toHaveCount(1);
      expect(other,'The initial example supplies another selectable part').toBeTruthy();
      const second=app.locator(`g.body[data-body="${other.id}"]`);
      await page.keyboard.down('Shift');try{await second.click()}finally{await page.keyboard.up('Shift')}
      await expect(app.locator('g.body.picked')).toHaveCount(2);
      await page.keyboard.down('Shift');try{await second.click()}finally{await page.keyboard.up('Shift')}
      await expect(app.locator('g.body.picked')).toHaveCount(1);await expect(part()).toHaveClass(/picked/);
      return {selected:chosen.id,additive:true,toggle:true};
    });
    await check('Arrow nudges, reversible rotation, duplicate, delete and Undo use the real editor model',async()=>{
      await svg.focus();await nudge(svg,chosen.id,'ArrowRight','x',.25);await nudge(svg,chosen.id,'Shift+ArrowUp','y',1);
      const before=await body(chosen.id);await svg.press('r');await expect.poll(async()=>Math.sin((await body(chosen.id)).angle-before.angle)).toBeCloseTo(1,6);
      await svg.press('Shift+r');await expect.poll(async()=>(await body(chosen.id)).angle).toBeCloseTo(before.angle,6);
      const prior=await project(),total=prior.world.bodies.length;await svg.press('d');await expect.poll(count).toBe(total+1);
      const duplicate=(await project()).world.bodies.find(item=>!prior.world.bodies.some(old=>old.id===item.id));expect(duplicate).toBeTruthy();expect(duplicate.kind).toBe(chosen.kind);
      await svg.press('Delete');await expect.poll(count).toBe(total);expect(await body(duplicate.id)).toBeUndefined();
      await app.getByRole('button',{name:'↶ 撤销',exact:true}).click();await expect.poll(count).toBe(total+1);expect((await body(duplicate.id)).kind).toBe(chosen.kind);
      return {smallNudgeM:.25,largeNudgeM:1,rotationRadians:Math.PI/2,duplicate:duplicate.id,undoRestored:true};
    });
    await check('Captured body dragging ends outside the SVG; Escape rolls an unfinished move back',async()=>{
      await svg.press('f');await part().click();const before=await body(chosen.id),start=await part().boundingBox(),sheet=await svg.boundingBox();expect(start).not.toBeNull();expect(sheet).not.toBeNull();
      await page.mouse.move(start.x+start.width/2,start.y+start.height/2);await page.mouse.down();await page.mouse.move(sheet.x+sheet.width+25,sheet.y+sheet.height*.45,{steps:8});await page.mouse.up();
      await expect.poll(async()=>Math.abs((await body(chosen.id)).x-before.x)+Math.abs((await body(chosen.id)).y-before.y)).toBeGreaterThan(.25);
      await app.getByRole('button',{name:'↶ 撤销',exact:true}).click();await expect.poll(async()=>(await body(chosen.id)).x).toBeCloseTo(before.x,6);await svg.press('f');await part().click();
      const restored=await body(chosen.id),rect=await part().boundingBox(),transform=await part().getAttribute('transform');
      await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+65,rect.y+rect.height/2-30,{steps:4});
      await expect(part()).not.toHaveAttribute('transform',transform);await page.keyboard.press('Escape');
      await expect.poll(async()=>(await body(chosen.id)).x).toBeCloseTo(restored.x,6);await expect.poll(async()=>(await body(chosen.id)).y).toBeCloseTo(restored.y,6);await page.mouse.up();await expect(app.locator('g.body.picked')).toHaveCount(0);
      return {releasedOutsideSvg:true,escapeRestoresOrigin:true};
    });
    await check('Text fields retain Space and arrow editing; Ctrl shortcuts are not intercepted',async()=>{
      const initial=await name.inputValue();await name.focus();await name.press('End');await name.press('Space');await expect(name).toHaveValue(initial+' ');await name.press('ArrowLeft');
      await expect(svg).toHaveAttribute('data-canvas-lock','false');expect(await run.getAttribute('data-run-state')).not.toBe('running');
      await name.fill(initial);await svg.focus();
      await app.evaluate(()=>{window.__ocvUsabilityNative=[];window.addEventListener('keydown',event=>{if(event.ctrlKey&&event.key.toLowerCase()==='z')window.__ocvUsabilityNative.push({prevented:event.defaultPrevented,key:event.key})})});
      const before=await project();await svg.press('Control+z');await expect.poll(()=>app.evaluate(()=>window.__ocvUsabilityNative.length)).toBe(1);
      expect((await app.evaluate(()=>window.__ocvUsabilityNative))[0].prevented).toBe(false);expect(await project()).toEqual(before);
      return {spaceTyped:true,arrowNative:true,ctrlZPrevented:false};
    });
    await check('Distinct examples load their own compact measurement presets through local simulation',async()=>{
      const expectations=[{id:'gearbox',bodies:['gear0','gear3']},{id:'pendulum-bank',bodies:['bob0','bob5']},{id:'tuned-damping',bodies:['cart0','cart1','cart2']}],observed=[];
      for(const example of expectations){
        const response=page.waitForResponse(response=>new URL(response.url()).pathname===`/workshop/examples/${example.id}.json`&&response.request().method()==='GET');
        await app.locator(`.example-card[data-example-id="${example.id}"]`).click();const actual=await response;expect(actual.status()).toBe(200);const source=await actual.json();
        await page.waitForFunction(name=>window.__ocvWorkshopResults?.[0]?.project?.name===name&&window.__ocvWorkshopResults[0].result?.ok===true,source.name,{timeout:30000});
        await expect(run).toHaveAttribute('data-run-state','running');await svg.focus();await svg.press('Space');await expect(svg).toHaveAttribute('data-canvas-lock','false');
        await expect(probes).toHaveCount(example.bodies.length);
        for(const id of example.bodies){await expect(probe(id)).toHaveCount(1);const rows=probe(id).locator('[data-probe-value]');expect(await rows.count()).toBeGreaterThanOrEqual(2);expect(await rows.count()).toBeLessThanOrEqual(4)}
        observed.push({example:example.id,trackedBodies:example.bodies.length});
      }
      return {localExampleRuns:expectations.length,observed};
    });
    await check('All controls completed without a hidden native submission or page error',async()=>{
      expect(report.submittedJobs).toBe(0);expect(report.pageErrors).toEqual([]);expect(report.consoleErrors).toEqual([]);const source=await project();expect(source.world.bodies.length).toBeLessThanOrEqual(64);
      expect(source.world.bodies.every(item=>Number.isFinite(item.x+item.y+item.angle)&&Math.abs(item.x)<=100&&Math.abs(item.y)<=100)).toBe(true);
      return {backendTasks:0,finiteBoundedModel:true};
    });
    report.passed=true;
  }finally{
    report.finishedAt=new Date().toISOString();await mkdir(folder,{recursive:true});
    try{await copyFile(reportFile,path.join(folder,`workshop-usability.previous-${Date.now()}.json`),constants.COPYFILE_EXCL)}catch(error){if(error.code!=='ENOENT')throw error}
    await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');
  }
});
