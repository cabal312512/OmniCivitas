import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {reports} from './report-location.mjs';

const routes={voice:'/maze/display/',gif:'/maze/notifications/unread/'};
const state=page=>page.evaluate(()=>window.__ocvMediaFrame?.snapshot());
const proof=(name,data)=>fs.writeFileSync(path.join(reports,`media-p2-${name}.json`),JSON.stringify(data,null,2));
async function ready(page,route){await page.goto(route);await expect.poll(()=>state(page)).toBeTruthy();await expect(page.locator('[data-p2-frame]')).toBeVisible();}
async function probeAudio(page){
 await page.addInitScript(()=>{
  const Original=window.Audio;window.__p2NativeAudio=[];
  window.Audio=function(...args){const audio=new Original(...args);window.__p2NativeAudio.push(audio);return audio;};window.Audio.prototype=Original.prototype;
 });
}

test('Both new small media windows belong to separate real maze routes and preserve original image bytes',async({page,request})=>{
 const seen=[];
 for(const [kind,route]of Object.entries(routes)){
  await ready(page,route);const frame=page.locator('[data-p2-frame]'),image=frame.locator('img');
  await expect(frame).toHaveAttribute('data-p2-frame',kind==='voice'?'7':'8');await expect(image).toHaveAttribute('src',kind==='voice'?'/forgotten-cache/p2/7.jpg':'/forgotten-cache/p2/8.gif');
  await expect.poll(()=>image.evaluate(node=>node.complete&&node.naturalWidth>0)).toBe(true);
  const box=await frame.boundingBox(),render=await frame.evaluate(node=>{
   const style=getComputedStyle(node),matrix=new DOMMatrixReadOnly(style.transform==='none'?undefined:style.transform);
   return {transform:style.transform,rotate:style.rotate,transformIsIdentity:matrix.isIdentity,rotationDegrees:style.rotate==='none'?0:Number.parseFloat(style.rotate)};
  });
  expect(box.width).toBe(176);expect(box.height).toBeLessThan(230);expect(render.transformIsIdentity).toBe(true);expect(render.rotationDegrees).toBeCloseTo(0,8);
  const url=await image.getAttribute('src'),response=await request.get(url),body=await response.body(),original=fs.readFileSync(path.resolve('config/apps/portal/public'+url));
  expect(response.status()).toBe(200);expect(body.equals(original)).toBe(true);
  if(kind==='gif')expect(body.subarray(0,6).toString()).toMatch(/^GIF8[79]a$/);
  seen.push({kind,route,box,render,url,bytes:body.length,sha256:crypto.createHash('sha256').update(body).digest('hex')});
 }
 expect(seen[0].route).not.toBe(seen[1].route);await page.goto('/maze/');await expect(page.locator('[data-p2-frame]')).toHaveCount(0);
 proof('separate-routes',{seen,claim:'Different real routes render exactly one requested small upright frame each. Actual HTTP image bodies match the copied original JPG/GIF bytes; the GIF was not converted or flattened.'});
});

for(const [kind,route]of Object.entries(routes))test(`Native pointer and keyboard dragging and closing work for the ${kind} picture frame`,async({page})=>{
 await ready(page,route);const frame=page.locator('[data-p2-frame]'),handle=frame.locator('[data-p2-handle]'),initial=await frame.boundingBox();
 await handle.focus();await handle.press('ArrowRight');await handle.press('ArrowDown');const keyed=await frame.boundingBox();expect(keyed.x-initial.x).toBe(16);expect(keyed.y-initial.y).toBe(16);
 const grip=await handle.boundingBox(),dx=kind==='voice'?60:-60,dy=kind==='voice'?30:-30;await page.mouse.move(grip.x+45,grip.y+13);await page.mouse.down();await page.mouse.move(grip.x+45+dx,grip.y+13+dy,{steps:6});await page.mouse.up();
 const dragged=await frame.boundingBox();expect(dragged.x-keyed.x).toBeCloseTo(dx,0);expect(dragged.y-keyed.y).toBeCloseTo(dy,0);
 await page.screenshot({path:path.join(reports,`media-p2-${kind}-frame.png`)});
 await frame.locator('[data-p2-close]').click();await expect(frame).toBeHidden();expect(await state(page)).toMatchObject({closed:true,playing:false,paused:true});
 proof(`${kind}-native-frame`,{route,initial,keyed,dragged,closed:await state(page)});
});

test('Five real audio files have valid metadata and native image clicks replace a single non-looping random voice',async({page})=>{
 test.setTimeout(120000);await probeAudio(page);const requested=[];page.on('request',request=>{if(/\/forgotten-cache\/p2\/a[0-4]\.mp3$/.test(request.url()))requested.push(request.url());});
 await ready(page,routes.voice);expect(requested).toHaveLength(0);expect(await state(page)).toMatchObject({requests:0,playing:false,paused:true,index:null,loop:false});
 const metadata=await page.evaluate(async()=>{
  const samples=[];
  for(let index=0;index<5;index++){
   const audio=new Audio();audio.preload='metadata';audio.src=`/forgotten-cache/p2/a${index}.mp3`;
   try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Audio metadata timed out')),20000);audio.addEventListener('loadedmetadata',()=>{clearTimeout(timer);resolve();},{once:true});audio.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Audio metadata failed'));},{once:true});audio.load();});samples.push({index,src:audio.src,duration:audio.duration,readyState:audio.readyState});}
   finally{audio.pause();audio.removeAttribute('src');audio.load();}
  }
  return samples;
 });
 expect(metadata).toHaveLength(5);expect(metadata.every(sample=>Number.isFinite(sample.duration)&&sample.duration>0&&sample.readyState>=1)).toBe(true);test.setTimeout(Math.max(120000,Math.ceil(Math.max(...metadata.map(sample=>sample.duration))*1000)+90000));
 const image=page.locator('[data-p2-play]'),played=[];
 for(let click=1;click<=3;click++){
  await image.click();await expect.poll(async()=> (await state(page)).requests).toBe(click);await expect.poll(async()=> (await state(page)).playing,{timeout:20000}).toBe(true);await expect.poll(async()=> (await state(page)).currentTime).toBeGreaterThan(0);
  const sample=await state(page);expect(sample.index).toBeGreaterThanOrEqual(0);expect(sample.index).toBeLessThan(5);expect(sample.loop).toBe(false);expect(sample.src).toMatch(new RegExp(`/forgotten-cache/p2/a${sample.index}\\.mp3$`));
  expect(await page.evaluate(()=>window.__p2NativeAudio.filter(audio=>/\/p2\/a[0-4]\.mp3$/.test(audio.src)&&!audio.paused).length)).toBe(1);played.push(sample);
 }
 const ending=await state(page);await expect.poll(async()=> (await state(page)).playing,{timeout:Math.ceil(ending.duration*1000)+15000,intervals:[200,500]}).toBe(false);const ended=await state(page);expect(ended.requests).toBe(3);expect(ended.loop).toBe(false);expect(ended.currentTime).toBeCloseTo(ended.duration,1);
 await image.click();await expect.poll(async()=> (await state(page)).playing,{timeout:20000}).toBe(true);
 await page.evaluate(()=>window.addEventListener('pagehide',event=>sessionStorage.setItem('ocv.test.p2.pagehide',JSON.stringify({persisted:event.persisted,state:window.__ocvMediaFrame.snapshot()})),{once:true}));
 await page.locator('.maze-index').click();await expect(page).toHaveURL(/\/maze\/$/);
 const left=await page.evaluate(()=>{const raw=sessionStorage.getItem('ocv.test.p2.pagehide');sessionStorage.removeItem('ocv.test.p2.pagehide');return JSON.parse(raw);});expect(left.state).toMatchObject({playing:false,paused:true,disposed:!left.persisted});
 proof('native-random-audio',{metadata,played,ended,left,claim:'All five originals expose actual browser metadata. Three native image clicks choose valid random files, replacing the same Audio object; one song runs to its real ended state with loop=false. A further real playback pauses on native route navigation; actual pagehide persisted determines whether owned listeners and sources are disposed or retained for browser page-cache restoration.'});
});

test('A failed audio request can be retried through the same native image button',async({page})=>{
 await probeAudio(page);await page.route('**/forgotten-cache/p2/*.mp3',route=>route.abort());await ready(page,routes.voice);
 await page.locator('[data-p2-play]').click();await expect.poll(async()=> (await state(page)).failed,{timeout:20000}).toBe(true);const failed=await state(page);expect(failed).toMatchObject({requests:1,playing:false,loop:false});
 await page.unroute('**/forgotten-cache/p2/*.mp3');await page.locator('[data-p2-play]').click();await expect.poll(async()=> (await state(page)).playing,{timeout:20000}).toBe(true);await expect.poll(async()=> (await state(page)).currentTime).toBeGreaterThan(0);
 const retried=await state(page);expect(retried).toMatchObject({requests:2,failed:false,loop:false});await page.locator('[data-p2-close]').click();expect(await state(page)).toMatchObject({closed:true,playing:false,paused:true});
 proof('failed-audio-retry',{failed,retried,closed:await state(page),claim:'The first HTTP media request is deliberately aborted by the harness; native reactivation after removing the failure plays a real original file. This does not change random selection or replace Audio.play.'});
});
