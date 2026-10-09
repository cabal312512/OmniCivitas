import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {reports} from './report-location.mjs';
const {marked}=createRequire(path.resolve('config/apps/portal/package.json'))('marked');
async function keyClick(locator){await locator.focus();await locator.press('Enter');}
async function nativeAudioProbe(page){
 await page.addInitScript(()=>{const Original=window.Audio;window.__nativeMedia=[];window.Audio=function(...args){const element=new Original(...args);window.__nativeMedia.push(element);return element;};window.Audio.prototype=Original.prototype;});
}
for(const route of ['/legal/','/legal/code/'])test(`Real GPU layers and six movable, closable, restorable panes: ${route}`,async({page})=>{
 const shaderErrors=[];page.on('console',message=>{if(message.type()==='error'&&/Shader Error|VALIDATE_STATUS/.test(message.text()))shaderErrors.push(message.text());});
 await page.goto(route);await expect.poll(()=>page.evaluate(()=>window.__ocvN9GPU?.mode)).toBe('webgl');
 await expect.poll(()=>page.evaluate(()=>window.__ocvN9GPU.frames)).toBeGreaterThan(2);
 const panes=page.locator('.n9-pane-field [data-n9-window]');await expect(panes).toHaveCount(6);
 const pane=panes.first(),grip=pane.locator('[data-n9-handle]'),before=await pane.boundingBox();
 await grip.focus();await grip.press('ArrowRight');await grip.press('ArrowDown');const keyed=await pane.boundingBox();expect(keyed.x-before.x).toBe(16);expect(keyed.y-before.y).toBe(16);
 const handle=await grip.boundingBox();await page.mouse.move(handle.x+35,handle.y+15);await page.mouse.down();await page.mouse.move(handle.x-105,handle.y-35,{steps:8});await page.mouse.up();
 const dragged=await pane.boundingBox();expect(dragged.x-keyed.x).toBeCloseTo(-140,0);expect(dragged.y-keyed.y).toBeCloseTo(-50,0);
 await keyClick(pane.locator('[data-n9-close]'));await expect(pane).toBeHidden();
 for(let i=1;i<6;i++)await keyClick(panes.nth(i).locator('[data-n9-close]'));
 await expect(page.locator('.n9-pane-field [data-n9-window]:visible')).toHaveCount(0);
 await page.getByRole('button',{name:'恢复特效窗口',exact:true}).click();await expect(page.locator('.n9-pane-field [data-n9-window]:visible')).toHaveCount(6);
 expect(shaderErrors).toEqual([]);
 if(route==='/legal/'){
  const html=marked.parse(fs.readFileSync('MEDIA_NOTICE.md','utf8'));expect(await page.evaluate(html=>{const div=document.createElement('div');div.innerHTML=html;const clean=value=>value.replace(/\s+/g,' ').trim();return clean(div.textContent)===clean(document.querySelector('article').textContent);},html)).toBe(true);
 }
 await page.screenshot({path:path.join(reports,route==='/legal/'?'media-legal.png':'media-code.png'),fullPage:false});
});
for(const [route,label] of [['/maze/cache/l1/l2/','打开附件'],['/maze/','春日影'],['/media/','春日影']])test(`Image drawer and actual one-shot spring audio on activation: ${route}`,async({page})=>{
 await nativeAudioProbe(page);const audioRequests=[];page.on('request',r=>{if(r.url().endsWith('/audio/spring.mp3'))audioRequests.push(r.url());});
 await page.goto(route);await expect(page.locator('#forgotten-drawer')).toBeHidden();expect(audioRequests).toHaveLength(0);
 await keyClick(page.getByRole('button',{name:label,exact:true}));await expect(page.locator('#forgotten-drawer')).toBeVisible();
 await expect(page.locator('.drawer-images img')).toHaveCount(2);await expect.poll(()=>page.evaluate(()=>[...document.querySelectorAll('.drawer-images img')].every(img=>img.complete&&img.naturalWidth>0))).toBe(true);
 await expect.poll(()=>page.evaluate(()=>window.__nativeMedia.some(audio=>audio.src.endsWith('/audio/spring.mp3')&&!audio.paused&&audio.currentTime>0))).toBe(true);
 expect(await page.evaluate(()=>window.__nativeMedia.find(a=>a.src.endsWith('/audio/spring.mp3')).loop)).toBe(false);
 expect(audioRequests.length).toBeGreaterThan(0);
 await keyClick(page.getByRole('button',{name:'收起附件',exact:true}));await expect(page.locator('#forgotten-drawer')).toBeHidden();
});
for(const route of ['/maze/empty/','/maze/','/media/'])test(`The discoverable old GIF retains its no-close twelve-second contract: ${route}`,async({page})=>{
 await page.goto(route);const trigger=page.getByRole('button',{name:'老吴',exact:true});await keyClick(trigger);
 await expect(page.locator('.laowu-visit img')).toBeVisible();expect(await page.locator('.laowu-visit button').count()).toBe(0);
 const first=await page.evaluate(()=>({...window.__ocvLaowu}));expect(first.duration).toBe(12000);await keyClick(trigger);expect(await page.evaluate(()=>window.__ocvLaowu.expiresAt)).toBe(first.expiresAt);
 if(route==='/maze/')await expect(page.locator('.laowu-visit')).toBeHidden({timeout:17000});
});
for(const route of ['/functions/sweep/'])test(`Sweep opens the supplied GIF in a draggable and closable centered frame: ${route}`,async({page})=>{
 await page.goto(route);if(route.startsWith('/#'))await expect(page.locator('body')).toHaveAttribute('data-cover','false',{timeout:30000});
 await expect(page.locator('.sweep-corner-bg')).toHaveCSS('background-image',/forgotten-cache\/corner\.jpg/);const corner=await page.locator('.sweep-corner-bg').boundingBox();expect(corner.width).toBe(116);expect(corner.x).toBe(18);
 const frame=page.locator('.sweep-window');await expect(frame).toBeHidden();await keyClick(page.getByRole('button',{name:'扫除霉运',exact:true}));await expect(frame.locator('img')).toBeVisible();
 await expect.poll(()=>frame.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
 expect(await frame.evaluate(node=>node.parentElement===document.body)).toBe(true);
 const before=await frame.boundingBox();expect(before.x+before.width/2).toBeCloseTo(720,0);
 const grip=frame.locator('[data-n9-handle]');await grip.focus();await grip.press('ArrowLeft');const after=await frame.boundingBox();expect(after.x-before.x).toBe(-16);
 await page.screenshot({path:path.join(reports,'media-sweep.png')});await keyClick(page.getByRole('button',{name:'关闭扫除霉运',exact:true}));await expect(frame).toBeHidden();
});
test('Home selects only the four specified tracks, replaces playback and ends without looping (native ending after seek)',async({page})=>{
 await nativeAudioProbe(page);await page.goto('/#systems');await expect(page.locator('body')).toHaveAttribute('data-cover','false',{timeout:30000});
 expect(await page.evaluate(()=>window.__nativeMedia.every(audio=>audio.paused&&!audio.getAttribute('src')))).toBe(true);
 const button=page.getByRole('button',{name:'背景音乐',exact:true});
 for(let i=1;i<=4;i++){
  await keyClick(button);await expect.poll(()=>page.evaluate(()=>window.__ocvSound.music.playing)).toBe(true);
  const selected=await page.evaluate(()=>({...window.__ocvSound.music}));expect(selected.requests).toBe(i);expect(selected.src).toMatch(/^\/forgotten-cache\/audio\/[0-3]\.mp3$/);
  await expect.poll(()=>page.evaluate(()=>window.__nativeMedia.find(a=>/\/audio\/[0-3]\.mp3$/.test(a.src))?.currentTime||0)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.__nativeMedia.filter(a=>!a.paused).length)).toBe(1);
 }
 expect(await page.evaluate(()=>window.__nativeMedia.find(a=>/\/audio\/[0-3]\.mp3$/.test(a.src)).loop)).toBe(false);
 await page.evaluate(()=>{const audio=window.__nativeMedia.find(a=>/\/audio\/[0-3]\.mp3$/.test(a.src));audio.currentTime=audio.duration-.25;});
 await expect.poll(()=>page.evaluate(()=>window.__nativeMedia.find(a=>/\/audio\/[0-3]\.mp3$/.test(a.src)).ended),{timeout:12000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>window.__ocvSound.music.playing)).toBe(false);expect(await page.evaluate(()=>window.__ocvSound.music.requests)).toBe(4);
});
test('Large upper-right supplied background and actual decoded user-played video',async({page})=>{
 await page.goto('/media/');await expect(page.locator('.media-right-bg')).toHaveCSS('background-image',/forgotten-cache\/right\.jpg/);
 const imageBox=await page.locator('.media-right-bg').boundingBox();expect(imageBox.x+imageBox.width).toBeCloseTo(1440,0);expect(imageBox.width).toBeGreaterThan(500);
 const video=page.locator('.media-video video');expect(await video.evaluate(v=>({paused:v.paused,loop:v.loop,preload:v.preload,controls:v.controls}))).toEqual({paused:true,loop:false,preload:'none',controls:true});
 for(const close of await page.locator('.n9-pane-field [data-n9-close]').all())await keyClick(close);
 await page.getByRole('button',{name:'播放视频',exact:true}).click();
 await expect.poll(()=>video.evaluate(v=>v.currentTime),{timeout:15000}).toBeGreaterThan(0);expect(await video.evaluate(v=>v.videoWidth)).toBeGreaterThan(0);
 await keyClick(page.getByRole('button',{name:'关闭视频窗口',exact:true}));await expect(page.locator('.media-video')).toBeHidden();expect(await video.evaluate(v=>v.paused)).toBe(true);
});
test('New media entries are in the functional site search',async({page})=>{
 await page.goto('/search/?q='+encodeURIComponent('扫除霉运'));await expect(page.locator('a[href="/functions/sweep/"]').filter({hasText:'扫除霉运'})).toBeVisible();
});
test('Reduced motion renders sweep as a static canvas and the real GPU scene remains initialized',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/functions/sweep/');await expect.poll(()=>page.evaluate(()=>window.__ocvN9GPU?.mode)).toBe('webgl');
 await keyClick(page.getByRole('button',{name:'扫除霉运',exact:true}));await expect(page.locator('[data-sweep-picture] canvas')).toBeVisible();await expect(page.locator('[data-sweep-picture] img')).toHaveCount(0);
});
test('Exactly one hundred distinct languages all switch the complete statement locally; RTL and Chinese restore work',async({page,request,baseURL})=>{
 test.setTimeout(120000);
 const manifest=JSON.parse(fs.readFileSync('config/apps/portal/src/n9/languages.json','utf8'));
 expect(manifest.languages).toHaveLength(100);expect(new Set(manifest.languages.map(item=>item.code)).size).toBe(100);
 const entranceOrigin=new URL(baseURL).origin,external=[];page.on('request',r=>{if(new URL(r.url()).origin!==entranceOrigin)external.push(r.url());});
 await page.goto('/legal/');const buttons=page.locator('[data-legal-language]');await expect(buttons).toHaveCount(100);
 const article=page.locator('[data-legal-statement]');
 for(const item of manifest.languages){
  const file=JSON.parse(fs.readFileSync(`config/apps/portal/public/legal-languages/${item.code}.json`,'utf8'));
  expect(file.sourceSha256).toBe(manifest.sourceSha256);expect(file.blocks).toHaveLength(15);
  const http=await request.get(`/legal-languages/${item.code}.json`);expect(http.status()).toBe(200);expect(await http.json()).toEqual(file);
  await keyClick(page.locator(`[data-legal-language="${item.code}"]`));await expect(article).toHaveAttribute('lang',item.code);await expect(article).toHaveAttribute('dir',item.dir);
  expect(await article.locator(':scope > *').allTextContents()).toEqual(file.blocks.map(block=>block.text));
  await expect(page.locator('[data-legal-language][aria-pressed=true]')).toHaveCount(1);
 }
 await keyClick(page.locator('[data-legal-language="zh"]'));await expect(article).toHaveAttribute('lang','zh');
 expect(await page.locator('html').getAttribute('lang')).toBe('zh-CN');expect(external).toEqual([]);
 await page.screenshot({path:path.join(reports,'media-hundred-languages.png'),fullPage:false});
 await page.goto('/legal/code/');await expect(page.locator('[data-legal-language]')).toHaveCount(0);
});

test('Developer directory placement, daily category, clean old labels and compact home music corner',async({page})=>{
 await page.goto('/functions/');const developer=page.locator('.tool-group').filter({has:page.locator('h2').filter({hasText:/^开发$/})});await expect(developer.locator('a[href="/functions/sweep/"]')).toHaveCount(1);await expect(page.locator('h2').filter({hasText:/^日常$/})).toHaveCount(1);await expect(page.locator('h2').filter({hasText:/^奇葩$/})).toHaveCount(0);
 await page.goto('/incidents/old/');expect(await page.locator('body').innerText()).not.toContain('1998');
 await page.goto('/#systems');await expect(page.locator('body')).toHaveAttribute('data-cover','false',{timeout:30000});await expect(page.locator('[data-sweep]')).toHaveCount(0);await expect(page.locator('.sweep-window')).toHaveCount(0);const button=page.getByRole('button',{name:'背景音乐',exact:true}),box=await button.boundingBox();expect(box.width).toBeLessThan(90);expect(box.height).toBeLessThan(32);expect(box.x+box.width).toBeCloseTo(1416,0);expect(box.y+box.height).toBeCloseTo(982,0);await expect(page.locator('.n9-home-controls')).toHaveCSS('position','fixed');await page.screenshot({path:path.join(reports,'media-home-corner.png')});
});
