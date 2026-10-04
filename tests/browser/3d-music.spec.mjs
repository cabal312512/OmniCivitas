import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {reports} from './report-location.mjs';

const route='/functions/3d-world/';
const snapshot=page=>page.evaluate(()=>window.__ocv3D?.snapshot());
const music=async page=>(await snapshot(page))?.music;
const proof=(name,data)=>fs.writeFileSync(path.join(reports,`3d-music-${name}.json`),JSON.stringify(data,null,2));
const keyClick=async locator=>{await locator.focus();await locator.press('Enter');};
async function ready(page){await page.goto(route);await expect.poll(async()=> (await snapshot(page))?.mode,{timeout:45000}).toBe('webgl');await expect.poll(async()=> (await snapshot(page))?.frames,{timeout:30000}).toBeGreaterThan(2);}
async function audioProbe(page){
 await page.addInitScript(()=>{
  const Original=window.Audio;window.__aeroOriginalAudio=Original;window.__aeroMusicAudio=[];window.__aeroMusicEnds=0;
  window.Audio=function(...args){const audio=new Original(...args);window.__aeroMusicAudio.push(audio);audio.addEventListener('ended',()=>window.__aeroMusicEnds++);return audio;};window.Audio.prototype=Original.prototype;
 });
}
async function startNative(page){await page.locator('#world').focus();await page.keyboard.press('KeyW');await expect.poll(async()=> (await music(page)).playing,{timeout:20000}).toBe(true);await expect.poll(async()=> (await music(page)).currentTime,{timeout:20000}).toBeGreaterThan(0);}

test('Seven original OGG files retain exact HTTP bytes and expose real browser audio metadata',async({page,request})=>{
 test.setTimeout(180000);await audioProbe(page);await ready(page);
 expect(await music(page)).toMatchObject({allocated:false,unlocked:false,track:1,tracks:7,volume:.32,enabled:true});
 expect(await page.evaluate(()=>window.__aeroMusicAudio.length)).toBe(0);const assets=[];
 for(let index=1;index<=7;index++){
  const url=`/aero-music/${index}.ogg`,response=await request.get(url),body=await response.body(),original=fs.readFileSync(path.resolve(`config/apps/portal/public${url}`));
  expect(response.status()).toBe(200);expect(body.equals(original)).toBe(true);expect(body.subarray(0,4).toString()).toBe('OggS');
  const metadata=await page.evaluate(async url=>{
   const audio=new window.__aeroOriginalAudio();audio.preload='metadata';audio.src=url;
   try{
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('OGG metadata timed out')),20000);audio.addEventListener('loadedmetadata',()=>{clearTimeout(timer);resolve();},{once:true});audio.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('OGG metadata unavailable'));},{once:true});audio.load();});
    return {duration:audio.duration,readyState:audio.readyState,src:audio.src};
   }finally{audio.pause();audio.removeAttribute('src');audio.load();}
  },url);
  expect(Number.isFinite(metadata.duration)).toBe(true);expect(metadata.duration).toBeGreaterThan(0);expect(metadata.readyState).toBeGreaterThanOrEqual(1);
  assets.push({index,url,bytes:body.length,sha256:crypto.createHash('sha256').update(body).digest('hex'),metadata});
 }
 expect(await music(page)).toMatchObject({allocated:false,unlocked:false,playing:false});expect(await page.evaluate(()=>window.__aeroMusicAudio.length)).toBe(0);
 proof('originals-metadata',{assets,claim:'Seven actual HTTP bodies match the repository copies of original user-provided OGG bytes. Temporary native Audio objects only inspect metadata and never play; the real game soundtrack remains unallocated and silent until a trusted gesture.'});
});

test('Native gameplay starts one soundtrack and its native volume toggle and global mute controls work independently',async({page})=>{
 await audioProbe(page);await ready(page);expect((await page.locator('body').innerText()).trim()).toBe('');await startNative(page);
 const started=await music(page);expect(started).toMatchObject({track:1,enabled:true,volume:.32,loop:false});expect(await page.evaluate(()=>window.__aeroMusicAudio.length)).toBe(1);
 const slider=page.locator('[data-music-volume]');await slider.focus();await slider.press('Home');await expect.poll(async()=> (await music(page)).volume).toBe(0);await slider.press('End');await slider.press('ArrowLeft');await expect.poll(async()=> (await music(page)).volume).toBe(.99);expect(await page.evaluate(()=>window.__aeroMusicAudio[0].volume)).toBe(.99);
 await keyClick(page.locator('[data-mute]'));await expect.poll(async()=> (await music(page)).muted).toBe(true);expect(await page.evaluate(()=>window.__aeroMusicAudio[0].muted)).toBe(true);expect((await music(page)).volume).toBe(.99);
 await keyClick(page.locator('[data-mute]'));await expect.poll(async()=> (await music(page)).muted).toBe(false);expect((await music(page)).volume).toBe(.99);
 await keyClick(page.locator('[data-music]'));await expect.poll(async()=> (await music(page)).enabled).toBe(false);const off=await music(page);expect(off.audioPaused).toBe(true);await page.waitForTimeout(250);expect((await music(page)).currentTime).toBe(off.currentTime);
 await keyClick(page.locator('[data-music]'));await expect.poll(async()=> (await music(page)).playing).toBe(true);const resumed=await music(page);expect(resumed.track).toBe(off.track);expect(resumed.currentTime).toBeGreaterThanOrEqual(off.currentTime);expect(await page.evaluate(()=>window.__aeroMusicAudio.length)).toBe(1);
 await page.screenshot({path:path.join(reports,'3d-music-controls.png')});proof('native-controls',{started,off,resumed,claim:'Real keyboard gameplay unlocks the actual HTMLAudio. Native range Home/End/ArrowLeft changes volume; global mute leaves the slider setting intact; native BGM off/on pauses and resumes the same track and sole Audio object. No visible game text or menu is added.'});
});

test('Native audio ended events advance tracks one through seven and wrap to one using seek-assisted endings',async({page})=>{
 test.setTimeout(150000);await audioProbe(page);await ready(page);await startNative(page);const transitions=[];
 for(let index=1;index<=7;index++){
  await expect.poll(async()=> (await music(page)).track).toBe(index);await expect.poll(async()=> (await music(page)).duration,{timeout:20000}).toBeGreaterThan(.5);const before=await music(page);
  await page.evaluate(()=>{const audio=window.__aeroMusicAudio[0];audio.currentTime=Math.max(0,audio.duration-.12);});
  await expect.poll(async()=> (await music(page)).transitions,{timeout:20000}).toBe(index);await expect.poll(async()=> (await music(page)).track,{timeout:20000}).toBe(index%7+1);await expect.poll(async()=> (await music(page)).playing,{timeout:20000}).toBe(true);
  const after=await music(page);expect(after.src).toMatch(new RegExp(`/aero-music/${index%7+1}\\.ogg$`));expect(after.loop).toBe(false);transitions.push({before,after});
 }
 expect(await page.evaluate(()=>window.__aeroMusicEnds)).toBe(7);expect(await page.evaluate(()=>window.__aeroMusicAudio.length)).toBe(1);expect(await music(page)).toMatchObject({track:1,ended:7,transitions:7});
 proof('seek-assisted-playlist',{transitions,claim:'A real first game gesture starts native playback. The harness seeks each real Audio near its metadata duration; Chromium then emits actual ended events and the application loads the next original. This checks the sequential 1→7→1 playlist with one Audio object, not twenty minutes of uninterrupted listening.'});
});

test('Native game exit pauses soundtrack and releases its source according to the actual pagehide lifecycle',async({page})=>{
 await audioProbe(page);await ready(page);await startNative(page);const playing=await music(page);
 await page.evaluate(()=>window.addEventListener('pagehide',event=>sessionStorage.setItem('ocv.test.music.pagehide',JSON.stringify({persisted:event.persisted,music:window.__ocv3D.snapshot().music})),{once:true}));
 await keyClick(page.locator('.aero-exit'));await expect(page).toHaveURL(/\/functions\/games\/$/);
 const left=await page.evaluate(()=>{const raw=sessionStorage.getItem('ocv.test.music.pagehide');sessionStorage.removeItem('ocv.test.music.pagehide');return JSON.parse(raw);});
 expect(left.music).toMatchObject({playing:false,audioPaused:true,disposed:!left.persisted});if(!left.persisted)expect(left.music.src).toBe('');
 proof('native-exit',{playing,left,claim:'Actual native exit navigation records the read-only soundtrack state after application cleanup. The actual pagehide persisted value distinguishes release from pause for browser page-cache restoration; this is not a synthetic BFCache claim.'});
});

test('Game directory and media notice credit only the Efilheim soundtrack while the notice retains exactly one hundred languages',async({page})=>{
 for(const route of ['/functions/games/','/legal/']){
  await page.goto(route);const credit=page.locator('.aero-music-credit');await expect(credit).toContainText('3D游戏音乐');await expect(credit.getByRole('link',{name:'anamnesis — Efilheim',exact:true})).toHaveAttribute('href','https://efilheim.itch.io/anamnesis');await expect(credit.getByRole('link',{name:'CC0',exact:true})).toHaveAttribute('href','https://creativecommons.org/publicdomain/zero/1.0/');
  if(route==='/legal/'){await expect(page.locator('[data-legal-language]')).toHaveCount(100);expect(await credit.evaluate(node=>Boolean(node.closest('[data-legal-statement]')))).toBe(false);}
 }
 proof('credit-scope',{source:'https://efilheim.itch.io/anamnesis',author:'Efilheim',license:'Public Domain / CC0',noticeLanguages:100,claim:'The local soundtrack credit sits outside the translated statement and describes 3D game music only. Existing unknown images/audio receive no new CC0 claim and the original 100-language source/hash remains unchanged.'});
});
