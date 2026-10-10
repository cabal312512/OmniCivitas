import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { testDeps } from '../runtime-location.mjs';

const reportRoot = path.join(testDeps, 'runtime/reports', process.env.OCV_POLISH_REPORT || 'site-polish');
async function shot(page, name) {
  await fs.mkdir(reportRoot, { recursive: true });
  await page.screenshot({ path: path.join(reportRoot, name + '.png') });
}

async function observeInteractionAudio(page) {
  await page.addInitScript(() => {
    const OriginalAudio = window.AudioContext;
    const contexts = [], active = new Set();
    let starts = 0;
    if (OriginalAudio) {
      function ObservedAudio(...args) {
        const context = new OriginalAudio(...args);
        contexts.push(context);
        const create = context.createOscillator.bind(context);
        context.createOscillator = () => {
          const oscillator = create(), start = oscillator.start.bind(oscillator);
          oscillator.start = (...args) => { starts++; active.add(oscillator); return start(...args); };
          oscillator.addEventListener('ended', () => active.delete(oscillator), { once: true });
          return oscillator;
        };
        return context;
      }
      ObservedAudio.prototype = OriginalAudio.prototype;
      window.AudioContext = ObservedAudio;
    }
    window.__soundTestSnapshot = () => ({ contexts: contexts.length, starts, active: active.size, states: contexts.map(context => context.state) });
  });
}

test('empty glass frames drag, pass through to the page and close independently on desktop and mobile', async ({ page, context }) => {
  await observeInteractionAudio(page);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/maze/window/');
  const frames = page.locator('[data-empty-glass-frame]');
  await expect(frames).toHaveCount(2);
  const surfaces = await frames.evaluateAll(nodes => nodes.map(node => {
    const box = node.getBoundingClientRect();
    const css = getComputedStyle(node);
    const x = box.left + box.width / 2, y = box.top + box.height / 2;
    return {
      background: css.backgroundColor,
      backdrop: css.backdropFilter,
      border: css.borderTopWidth,
      shadow: css.boxShadow,
      passthrough: !document.elementFromPoint(x, y)?.closest('[data-empty-glass-layer]'),
      text: node.textContent.trim(),
    };
  }));
  for (const surface of surfaces) {
    expect(surface.background).toBe('rgba(0, 0, 0, 0)');
    expect(surface.backdrop).toBe('none');
    expect(surface.border).toBe('1px');
    expect(surface.shadow).not.toBe('none');
    expect(surface.passthrough).toBe(true);
    expect(surface.text).toBe('');
  }
  const header = frames.first().locator('[data-empty-glass-drag]');
  const original = await frames.first().boundingBox();
  await page.mouse.move(original.x + 26, original.y + 18);
  await page.mouse.down();
  await page.mouse.move(original.x + 116, original.y + 98, { steps: 8 });
  await page.mouse.up();
  await expect(frames.first()).toHaveAttribute('data-glass-moved', 'true');
  const dragged = await frames.first().boundingBox();
  expect(dragged.x - original.x).toBeCloseTo(90, 0);
  expect(dragged.y - original.y).toBeCloseTo(80, 0);
  await header.focus();
  await page.keyboard.press('Shift+ArrowRight');
  expect((await frames.first().boundingBox()).x - dragged.x).toBeCloseTo(24, 0);
  await page.keyboard.press('Home');
  expect((await frames.first().boundingBox()).x).toBeCloseTo(original.x, 0);
  expect((await frames.first().boundingBox()).y).toBeCloseTo(original.y, 0);
  await page.mouse.move(original.x + 26, original.y + 18);
  await page.mouse.down();
  await page.mouse.move(1360, 900, { steps: 8 });
  await page.mouse.up();
  await page.setViewportSize({ width: 950, height: 700 });
  await expect.poll(async () => {
    const box = await frames.first().boundingBox();
    return box.x + box.width <= 950 && box.y + box.height <= 700;
  }).toBe(true);
  await page.setViewportSize({ width: 1440, height: 960 });
  await shot(page, 'transparent-desktop');
  await page.locator('[data-empty-glass-close]').first().click();
  await expect(frames).toHaveCount(1);
  await page.locator('[data-empty-glass-close]').press('Enter');
  await expect(page.locator('[data-empty-glass-layer]')).toHaveCount(0);
  const closeAudio = await page.evaluate(() => window.__soundTestSnapshot());
  expect(closeAudio.contexts).toBe(1);
  expect(closeAudio.starts).toBe(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/maze/window/');
  await expect(frames.first()).toBeVisible();
  await expect(frames.nth(1)).toBeHidden();
  const bounds = await frames.first().boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
  const touch = await context.newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + 22, y: bounds.y + 19 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: bounds.x + 30, y: bounds.y + 99 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(frames.first()).toHaveAttribute('data-glass-moved', 'true');
  const touchMoved = await frames.first().boundingBox();
  expect(touchMoved.y - bounds.y).toBeCloseTo(80, 0);
  await touch.detach();
  await shot(page, 'transparent-mobile');
  await page.locator('[data-empty-glass-close]').first().click();
  await expect(frames.first()).toBeHidden();
  expect(errors).toEqual([]);
  await fs.writeFile(path.join(reportRoot, 'glass-runtime.json'), JSON.stringify({ surfaces, original, dragged, mobileBounds: bounds, touchMoved, closeAudio, errors }, null, 2));
});

test('abstract forms retain real collection and the frameless resident keeps direct backend dialogue', async ({ page, request }) => {
  await observeInteractionAudio(page);
  const session=randomUUID(),profileSession=randomUUID(),report={session,errors:[],projectionRequestsObserved:0,deliberateProjectionConsole:[]};
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('console',message=>{
    if(message.type()!=='error')return;
    if(message.location().url.endsWith('/api/site/return.php')&&message.text().includes('503'))report.deliberateProjectionConsole.push(message.text());
    else report.errors.push(message.text());
  });
  await page.route('**/api/site/return.php',route=>{
    if(route.request().postDataJSON()?.kind==='projection'){
      report.projectionRequestsObserved++;
      return route.fulfill({status:503,contentType:'application/json',body:'{"error":"test: unchanged optional projection not exercised"}'});
    }
    return route.continue();
  });
  await page.addInitScript(({session,profileSession})=>{
    if(!localStorage.getItem('ocv.q8.hunt.v1'))localStorage.setItem('ocv.q8.hunt.v1',JSON.stringify({session,found:[],awarded:false}));
    if(!localStorage.getItem('ocv.desk.v1'))localStorage.setItem('ocv.desk.v1',JSON.stringify({session:profileSession,revision:0,favorites:[],pinned:[],note:'',dirty:false}));
    window.__residentSpeechStarts=0;
    speechSynthesis.speak=()=>window.__residentSpeechStarts++;
  },{session,profileSession});
  await page.goto('/maze/cache/');
  const creature=page.locator('[data-q8-creature]');
  await expect(creature).toBeVisible();
  await expect(creature).toHaveAttribute('data-q8-hidden-scene','ready',{timeout:20000});
  report.hidden3D=await page.evaluate(()=>window.__ocvHidden3D.snapshot()[0]);
  expect(report.hidden3D.form).toBe('shard');
  const collectible=await creature.boundingBox();
  await page.mouse.move(collectible.x+54,collectible.y+56);
  const collect=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/q8/collect'&&response.request().postDataJSON()?.ids?.includes(6));
  await creature.click();
  await expect.poll(()=>page.evaluate(()=>window.__ocvHunt.sound().peak||0),{intervals:[10,15,20]}).toBeGreaterThan(.025);
  report.collectSound=await page.evaluate(()=>window.__ocvHunt.sound());
  const collected=await collect;
  expect(collected.ok()).toBe(true);report.collected=await collected.json();
  expect(report.collected.storage).toBe('postgresql');
  expect(report.collected.mask&64).toBe(64);
  expect(report.collectSound.state).toBe('running');
  await expect(creature).toBeHidden();
  expect(await page.evaluate(()=>window.__ocvHidden3D.snapshot()[0].disposed)).toBe(true);
  expect(await page.evaluate(()=>window.__residentSpeechStarts)).toBe(0);
  const completed=await request.post('/api/q8/collect',{data:{session,ids:Array.from({length:30},(_,i)=>i)}});
  expect(completed.ok()).toBe(true);
  await page.goto('/favorites/');
  const resident=page.locator('[data-q8-resident]'),actor=resident.locator('[data-echo-greet]');
  await expect(resident).toBeVisible();
  const award=page.getByRole('dialog',{name:'捉迷藏成就'});
  await expect(award).toBeVisible();await award.getByRole('button',{name:'关闭',exact:true}).click();
  await expect(actor).toHaveAttribute('data-q8-scene','ready',{timeout:20000});
  await expect.poll(()=>page.evaluate(()=>window.__ocvResident3D.snapshot().drawFrames)).toBeGreaterThan(3);
  await expect(resident.locator('input,form,header,[data-echo-action],.echo-quick')).toHaveCount(0);
  report.layout=await resident.evaluate(node=>{const s=getComputedStyle(node);return{background:s.backgroundColor,border:s.borderTopWidth,shadow:s.boxShadow,buttons:node.querySelectorAll('button').length};});
  expect(report.layout).toMatchObject({background:'rgba(0, 0, 0, 0)',border:'0px',shadow:'none',buttons:1});
  await page.mouse.move(20,20);
  await expect.poll(()=>page.evaluate(()=>window.__ocvResident3D.snapshot().gaze.x)).toBeLessThan(-.25);
  report.leftGaze=await page.evaluate(()=>window.__ocvResident3D.snapshot().gaze);
  await page.mouse.move(1420,160);
  await expect.poll(()=>page.evaluate(()=>window.__ocvResident3D.snapshot().gaze.x)).toBeGreaterThan(.08);
  report.rightGaze=await page.evaluate(()=>window.__ocvResident3D.snapshot().gaze);
  await actor.hover();
  await expect.poll(()=>page.evaluate(()=>window.__ocvResident3D.snapshot().hover.power)).toBeGreaterThan(.4);
  const plays=[];
  for(const action of ['pulse','shear','phase','resonate']){
    const reply=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/q8/talk');
    await actor.click();await expect(actor).toHaveAttribute('data-q8-action',action);
    let sound;
    await expect.poll(async()=>{const sample=await page.evaluate(()=>window.__ocvHunt.sound());if(sample.peak>.025)sound=sample;return sample.peak;},{intervals:[10,15,20]}).toBeGreaterThan(.025);
    const response=await reply;expect(response.ok()).toBe(true);
    const data=await response.json();expect(data.storage).toBe('postgresql');
    await expect.poll(()=>page.evaluate(()=>window.__ocvResidentEcho.snapshot().pending)).toBe(false);
    await expect(resident.locator('[data-echo-talk]')).toBeVisible();
    expect((await resident.locator('[data-echo-talk]').textContent()).length).toBeGreaterThan(4);
    await page.waitForTimeout(180);
    const scene=await page.evaluate(()=>window.__ocvResident3D.snapshot());
    expect(scene.burst.action).toBe(action);expect(scene.effects.interactionPower).toBeGreaterThan(.2);
    expect(scene.effects.energyBands).toBe(3);expect(scene.error).toBeNull();
    plays.push({action,reply:data,scene,sound});
  }
  report.plays=plays;
  report.resident3D=await page.evaluate(()=>window.__ocvResident3D.snapshot());
  expect(report.resident3D.eyes).toBe(1);expect(report.resident3D.rings).toHaveLength(5);
  expect(new Set(report.resident3D.rings.map(r=>r.kind)).size).toBe(5);
  expect(report.resident3D.viewport.dpr).toBeLessThanOrEqual(1.5);
  await shot(page,'resident-floating-page');
  await resident.screenshot({path:path.join(reportRoot,'resident-floating-closeup.png')});
  report.speechStarts=await page.evaluate(()=>window.__residentSpeechStarts);
  expect(report.speechStarts).toBe(0);
  await expect.poll(()=>page.evaluate(()=>window.__soundTestSnapshot().active)).toBe(0);
  report.audio=await page.evaluate(()=>window.__soundTestSnapshot());
  expect(report.audio).toMatchObject({contexts:1,active:0});
  expect(report.audio.starts).toBeGreaterThanOrEqual(5);
  expect(await page.evaluate(()=>window.__ocvHunt.sound().played)).toBe(4);
  await expect.poll(()=>page.evaluate(()=>window.__ocvResident3D.snapshot().blinkCount),{timeout:12000}).toBeGreaterThan(0);
  await page.mouse.move(20,20);
  await expect(resident.locator('[data-echo-talk]')).toBeHidden({timeout:7000});
  const frames=await page.evaluate(()=>{document.querySelector('[data-q8-resident]').hidden=true;return window.__ocvResident3D.snapshot().drawFrames;});
  await expect.poll(()=>page.evaluate(()=>window.__ocvResident3D.snapshot().running)).toBe(false);
  await page.waitForTimeout(150);expect(await page.evaluate(()=>window.__ocvResident3D.snapshot().drawFrames)).toBe(frames);
  await page.evaluate(()=>{document.querySelector('[data-q8-resident]').hidden=false;});
  await expect.poll(()=>page.evaluate(()=>window.__ocvResident3D.snapshot().drawFrames)).toBeGreaterThan(frames);
  report.disposal=await page.evaluate(()=>{
    const scene=window.__ocvResident3D;
    window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
    const paused=scene.snapshot();
    window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
    const restored=scene.snapshot();
    window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));
    return{paused,restored,final:scene.snapshot(),drag:window.__ocvResidentDragging.snapshot(),bubble:window.__ocvResidentBubbles.snapshot()};
  });
  expect(report.disposal.paused.running).toBe(false);
  expect(report.disposal.restored.sceneReady).toBe(true);
  expect(report.disposal.final).toMatchObject({disposed:true,running:false,resources:null});
  expect(report.disposal.drag.disposed).toBe(true);expect(report.disposal.bubble).toMatchObject({disposed:true,timers:0});
  expect(report.errors).toEqual([]);
  report.scope='Actual PG collect/talk; optional projection intentionally intercepted; frameless layout, whole-page gaze, four click effects, short sound, no TTS, bubble expiry and unload.';
  await fs.writeFile(path.join(reportRoot,'resident-floating-runtime.json'),JSON.stringify(report,null,2));
});

test('twenty blank-button presses unlock a draggable frameless resident without altering hunt progress', async ({ page }) => {
  await observeInteractionAudio(page);
  const session=randomUUID(),errors=[],talks=[],projections=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{
    const pathname=new URL(request.url()).pathname;
    if(pathname==='/api/q8/talk')talks.push(pathname);
    if(pathname==='/api/site/return.php')projections.push(pathname);
  });
  await page.addInitScript(session=>{
    if(!localStorage.getItem('ocv.q8.hunt.v1'))localStorage.setItem('ocv.q8.hunt.v1',JSON.stringify({session,found:[],awarded:false}));
    window.__residentSpeechStarts=0;speechSynthesis.speak=()=>window.__residentSpeechStarts++;
  },session);
  await page.goto('/maze/window/under/');
  const button=page.locator('[data-q8-resident-preview]'),resident=page.locator('[data-q8-resident]'),actor=resident.locator('[data-echo-greet]');
  await expect(button).toBeVisible();await expect(button).toHaveText('');await expect(resident).toBeHidden();
  for(let i=0;i<19;i++)await button.click();
  await expect(resident).toBeHidden();
  const watcher=await page.context().newPage();await watcher.goto('/maze/aside/');
  await expect(watcher.locator('[data-q8-resident]')).toBeHidden();
  await expect.poll(()=>watcher.evaluate(()=>Boolean(window.__ocvHunt))).toBe(true);
  await button.click();
  await expect(resident).toBeVisible();await expect(watcher.locator('[data-q8-resident]')).toBeVisible();await watcher.close();
  await expect(actor).toHaveAttribute('data-q8-scene','ready',{timeout:20000});
  const before=await page.evaluate(()=>window.__ocvHunt.snapshot());
  expect(before).toMatchObject({count:0,found:[],residentPreview:true});
  await expect(resident.locator('input,form,header')).toHaveCount(0);
  await actor.hover();
  const origin=await resident.boundingBox();
  const turn=await page.evaluate(()=>window.__ocvResidentEcho.snapshot().turn);
  await page.mouse.move(origin.x+origin.width*.5,origin.y+origin.height*.5);
  await page.mouse.down();await page.mouse.move(origin.x+origin.width*.5-240,origin.y+origin.height*.5-140,{steps:8});await page.mouse.up();
  await expect(resident).toHaveAttribute('data-resident-moved','true');
  const moved=await resident.boundingBox();
  expect(moved.x-origin.x).toBeCloseTo(-240,0);expect(moved.y-origin.y).toBeCloseTo(-140,0);
  expect(await page.evaluate(()=>window.__ocvResidentEcho.snapshot().turn)).toBe(turn);
  expect(await page.evaluate(()=>window.__ocvResidentDragging.snapshot().suppressedClicks)).toBeGreaterThan(0);
  await actor.focus();await page.keyboard.press('Shift+ArrowLeft');
  expect((await resident.boundingBox()).x-moved.x).toBeCloseTo(-16,0);
  const actions=[];
  for(const action of ['pulse','shear','phase','resonate']){
    await actor.click();await expect(actor).toHaveAttribute('data-q8-action',action);
    await expect(resident.locator('[data-echo-talk]')).toBeVisible();
    actions.push({action,line:await resident.locator('[data-echo-talk]').textContent()});
    await page.waitForTimeout(220);
  }
  await shot(page,'resident-floating-preview-page');
  await expect.poll(()=>page.evaluate(()=>window.__soundTestSnapshot().active)).toBe(0);
  const audio=await page.evaluate(()=>window.__soundTestSnapshot());
  expect(audio).toMatchObject({contexts:1,active:0});
  expect(audio.starts).toBeGreaterThanOrEqual(25);
  expect(await page.evaluate(()=>window.__ocvHunt.sound().played)).toBe(24);
  expect(await page.evaluate(()=>window.__residentSpeechStarts)).toBe(0);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ocv.q8.hunt.v1')).awarded)).toBe(false);
  await page.setViewportSize({width:390,height:844});
  await expect.poll(async()=>{const r=await resident.boundingBox();return r.x>=0&&r.y>=0&&r.x+r.width<=390&&r.y+r.height<=844;}).toBe(true);
  const mobileStart=await resident.boundingBox(),touch=await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:mobileStart.x+90,y:mobileStart.y+120}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:mobileStart.x+105,y:mobileStart.y+40}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();
  const mobileEnd=await resident.boundingBox();
  expect(mobileEnd.y-mobileStart.y).toBeCloseTo(-80,0);
  await shot(page,'resident-floating-mobile');
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect.poll(()=>page.evaluate(()=>window.__ocvResident3D.snapshot().running)).toBe(false);
  const reduced=await page.evaluate(()=>window.__ocvResident3D.snapshot());
  await page.goto('/favorites/');await expect(resident).toBeVisible();
  expect(await page.evaluate(()=>window.__ocvHunt.snapshot())).toMatchObject({count:0,residentPreview:true});
  await expect(button).toHaveCount(0);
  expect(talks).toEqual([]);expect(projections).toEqual([]);expect(errors).toEqual([]);
  await fs.writeFile(path.join(reportRoot,'resident-floating-preview-runtime.json'),JSON.stringify({route:'/maze/window/under/',threshold:20,before,origin,moved,mobileStart,mobileEnd,actions,audio,reduced,realAchievementGranted:false,alreadyOpenOtherTabUpdates:true,persistsAcrossRoutes:true,talks,projections,errors},null,2));
});

test('six hidden 3d forms animate, roam safely, output audible PCM and retain real collection', async ({ page }) => {
  await observeInteractionAudio(page);
  const session=randomUUID(),errors=[],forms=[],captures=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{
    if(message.type()==='error'&&!(message.location().url.endsWith('/api/site/return.php')&&message.text().includes('503')))errors.push(message.text());
  });
  await page.route('**/api/site/return.php',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"test: unchanged optional projection not exercised"}'}));
  await page.addInitScript(session=>{
    if(!localStorage.getItem('ocv.q8.hunt.v1'))localStorage.setItem('ocv.q8.hunt.v1',JSON.stringify({session,found:[],awarded:false}));
    window.__residentSpeechStarts=0;speechSynthesis.speak=()=>window.__residentSpeechStarts++;
  },session);
  for(const [id,form,route] of [[6,'shard','/maze/cache/'],[7,'ring','/maze/cache/l1/'],[8,'lattice','/maze/cache/l1/l2/'],[9,'rift','/maze/offices/settings/'],[10,'orbit','/maze/approval/'],[11,'prism','/maze/display/']]){
    await page.mouse.move(20,20);await page.goto(route);
    const actor=page.locator('[data-q8-creature]');
    await expect(actor).toHaveAttribute('data-q8-hidden-scene','ready',{timeout:20000});
    await expect.poll(()=>page.evaluate(()=>window.__ocvHidden3D.snapshot()[0].frames)).toBeGreaterThan(3);
    const scene=await page.evaluate(()=>window.__ocvHidden3D.snapshot()[0]);
    expect(scene.form).toBe(form);expect(scene.mesh).toBeLessThanOrEqual(14);expect(scene.viewport.dpr).toBeLessThanOrEqual(1.5);
    expect(scene.resources.calls).toBeGreaterThan(0);expect(scene.errors).toEqual([]);
    const before=await actor.boundingBox();
    if(id%3!==2){
      await expect.poll(async()=>{const b=await actor.boundingBox();return Math.hypot(b.x-before.x,b.y-before.y);},{timeout:6000,intervals:[200,300,400]}).toBeGreaterThan(3);
    }else{await page.waitForTimeout(120);const b=await actor.boundingBox();expect(b.x).toBeCloseTo(before.x,1);expect(b.y).toBeCloseTo(before.y,1);}
    const moving=await actor.boundingBox();await page.mouse.move(moving.x+54,moving.y+56);
    if(id%3!==2)await expect(actor).toHaveAttribute('data-q8-roam-state','paused');
    await expect.poll(()=>page.evaluate(()=>window.__ocvHidden3D.snapshot()[0].hover.power)).toBeGreaterThan(.35);
    const held=await actor.boundingBox();await page.waitForTimeout(120);const stable=await actor.boundingBox();
    expect(stable.x).toBeCloseTo(held.x,1);expect(stable.y).toBeCloseTo(held.y,1);
    const roaming=await page.evaluate(()=>window.__ocvCreatureRoaming.snapshot());
    // Capture the real WebGL canvas at its production size before collection.
    const png=await actor.screenshot({path:path.join(reportRoot,`hidden3d-${form}.png`)});
    captures.push({form,png:png.toString('base64')});
    const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/q8/collect'&&r.request().postDataJSON()?.ids?.includes(id));
    await actor.click();await expect(actor).toHaveAttribute('data-q8-collecting','true');
    let sound;
    await expect.poll(async()=>{const sample=await page.evaluate(()=>window.__ocvHunt.sound());if(sample.peak>.025)sound=sample;return sample.peak;},{intervals:[10,15,20]}).toBeGreaterThan(.025);
    expect(sound.state).toBe('running');expect(sound.destination).toBe(true);expect(sound.rms).toBeGreaterThan(.005);expect(sound.analysisSamples).toBe(512);
    const data=await (await response).json();expect(data.storage).toBe('postgresql');expect(data.mask&(1<<id)).toBe(1<<id);
    await expect(actor).toBeHidden();const disposed=await page.evaluate(()=>window.__ocvHidden3D.snapshot()[0]);
    expect(disposed).toMatchObject({disposed:true,running:false,resources:null,geometry:0,materials:0,instances:0});
    await expect.poll(()=>page.evaluate(()=>window.__soundTestSnapshot().active)).toBe(0);
    expect(await page.evaluate(()=>window.__residentSpeechStarts)).toBe(0);
    forms.push({id,form,route,scene,before,moving,held,roaming,sound,collection:data,disposed});
  }
  expect(new Set(forms.map(row=>row.form)).size).toBe(6);expect(errors).toEqual([]);
  await page.evaluate(captures=>{
    const gallery=document.createElement('section');gallery.style.cssText='position:fixed;z-index:60000;left:50%;top:50%;transform:translate(-50%,-50%);display:grid;grid-template-columns:repeat(3,220px);gap:14px;padding:28px;background:#eef6fff7;border:1px solid #a7c5df;box-shadow:0 20px 70px #1e497447;pointer-events:none';
    for(const item of captures){const box=document.createElement('article'),image=document.createElement('img'),label=document.createElement('span');box.style.cssText='height:234px;border:1px solid #b4cce0;background:#f7fbff;padding:8px';image.src='data:image/png;base64,'+item.png;image.style.cssText='width:200px;height:200px;object-fit:contain';label.textContent=item.form;label.style.cssText='display:block;text-align:center;color:#467396;font:11px monospace';box.append(image,label);gallery.append(box);}document.body.append(gallery);
  },captures);
  await shot(page,'hidden3d-forms');
  await fs.writeFile(path.join(reportRoot,'hidden3d-runtime.json'),JSON.stringify({forms,errors,scope:'Six real production WebGL scenes captured individually, actual PostgreSQL collection, native analyser PCM, bounded motion and disposal. Screenshot gallery only arranges those captures.'},null,2));
});

test('solar starts at thirty days per second with orbit paths and remembers a separate rate from sky', async ({ page }) => {
  const errors = [], api = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) api.push(request.url()); });
  await page.goto('/planetarium/');
  const canvas = page.locator('#planetarium-canvas'), root = page.locator('#planetarium');
  const speed = page.locator('.time-speed');
  await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
  await expect(speed).toHaveValue('60');
  await page.locator('button[data-view="solar"]').click();
  await expect(root).toHaveAttribute('data-view', 'solar', { timeout: 20000 });
  await expect(speed).toHaveValue('2592000');
  await expect(page.locator('[data-option="orbits"]')).toBeChecked();
  const firstFrame = Number(await canvas.getAttribute('data-frames'));
  await expect.poll(async () => Number(await canvas.getAttribute('data-frames')) - firstFrame, { timeout: 15000 }).toBeGreaterThan(20);
  await shot(page, 'solar-default-orbits');
  await speed.selectOption('86400');
  await page.locator('button[data-view="sky"]').click();
  await expect(root).toHaveAttribute('data-view', 'sky');
  await expect(speed).toHaveValue('60');
  await speed.selectOption('600');
  await page.locator('button[data-view="solar"]').click();
  await expect(root).toHaveAttribute('data-view', 'solar');
  await expect(speed).toHaveValue('86400');
  await page.locator('button[data-view="sky"]').click();
  await expect(root).toHaveAttribute('data-view', 'sky');
  await expect(speed).toHaveValue('600');
  expect(errors).toEqual([]);
  expect(api).toEqual([]);
  await fs.writeFile(path.join(reportRoot, 'solar-playback-runtime.json'), JSON.stringify({ solarDefault: 2592000, skyDefault: 60, defaultOrbits: true, independentRates: { sky: 600, solar: 86400 }, errors, api }, null, 2));
});
