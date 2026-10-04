import {test,expect} from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import {reports} from './report-location.mjs';
test('Quiet cover keeps the previous field mounted and the new layer reveals real PBR and bloom after entry',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await expect.poll(()=>page.evaluate(()=>window.__ocvReactor?.renderer),{timeout:30000}).toBe('three-webgl2');
 await expect(page.getByRole('heading',{name:'OMNICIVITAS',exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>window.__ocvOptics?.frames||0)).toBeGreaterThan(0);
 expect(await page.evaluate(()=>window.__ocvReactor.cover)).toBe(true);
 expect(await page.locator('#reactor-field').evaluate(el=>getComputedStyle(el).opacity)).toBe('0');
 await expect(page.locator('.systems-sticky .wafer')).toHaveCount(4);await expect(page.locator('form,input[type=password],iframe')).toHaveCount(0);await expect(page.locator('img')).toHaveCount(1);expect(await page.locator('.home-image-note').evaluate(el=>el.closest('.wrong-windows').inert&&getComputedStyle(el.closest('.wrong-windows')).opacity==='0')).toBe(true);await expect(page.locator('#portal-search')).toHaveCount(1);
 await page.screenshot({path:path.join(reports,`reactor-${info.project.name}-cover.png`)});
 await page.getByRole('link',{name:'进入主页',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__ocvReactor.frames),{timeout:30000}).toBeGreaterThan(2);
 const proof=await page.evaluate(()=>({current:{...window.__ocvReactor},previous:{...window.__ocvOptics},canvas:[document.querySelector('#reactor-field').width,document.querySelector('#reactor-field').height],overflow:document.documentElement.scrollWidth-innerWidth}));
 expect(proof.current.bloom).toBe(true);expect(proof.current.triangles).toBeGreaterThan(15000);expect(proof.current.drawCalls).toBeGreaterThan(10);expect(proof.current.gpuError).toBe(0);expect(proof.current.materials).toContain('physical-transmission');expect(proof.previous.renderer).toBe('webgl');expect(proof.previous.frames).toBeGreaterThan(0);expect(Math.max(...proof.canvas)).toBeLessThanOrEqual(1920);expect(proof.overflow).toBeLessThan(3);
 const start=await page.evaluate(()=>({time:performance.now(),frames:window.__ocvReactor.frames}));await page.waitForTimeout(1000);const end=await page.evaluate(()=>({time:performance.now(),frames:window.__ocvReactor.frames,quality:window.__ocvReactor.quality}));
 proof.sample={milliseconds:Math.round(end.time-start.time),frames:end.frames-start.frames,observedFPS:Number(((end.frames-start.frames)*1000/(end.time-start.time)).toFixed(1)),quality:end.quality,note:'Observed headless rendering, not a hardware frame-rate guarantee.'};
 await page.screenshot({path:path.join(reports,`reactor-${info.project.name}-home.png`)});
 fs.writeFileSync(path.join(reports,`reactor-${info.project.name}-renderer.json`),JSON.stringify(proof,null,2));expect(errors).toEqual([]);
});
test('Existing controls command both old and new geometry, pointer moves the new camera and gallery stays usable',async({page},info)=>{
 await page.goto('/');await page.locator('.geometry-controls').scrollIntoViewIfNeeded();
 await expect.poll(()=>page.evaluate(()=>window.__ocvReactor?.renderer),{timeout:30000}).toBe('three-webgl2');
 const activate=async button=>{
  if(info.project.name==='mobile'){
   // Accepted mobile overlays can intercept pointers. Use the real native keyboard completion path.
   await expect(button).toBeVisible();await expect(button).toBeEnabled();await button.focus();await expect(button).toBeFocused();await page.keyboard.press('Enter');
  }else await button.click();
 };
 for(const [name,mode] of [['流线',2],['阵列',3],['环形',0]]){
  await activate(page.getByRole('button',{name,exact:true}));await expect.poll(()=>page.evaluate(()=>window.__ocvReactor.mode)).toBe(mode);await expect.poll(()=>page.evaluate(()=>window.__ocvOptics.activeGeometry)).toBe(mode);await expect(page.getByRole('button',{name,exact:true})).toHaveAttribute('aria-pressed','true');
 }
 if(info.project.name==='desktop'){await page.mouse.move(1200,210);await expect.poll(()=>page.evaluate(()=>window.__ocvReactor.pointer.x)).toBeGreaterThan(.3);}
 // Exercise actual gallery controls with OS reduced motion; software GPU timing must not decide snap completion.
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.locator('#gallery-next').scrollIntoViewIfNeeded();await activate(page.getByRole('button',{name:'下一组图形'}));await expect.poll(()=>page.locator('#geometry-gallery').evaluate(el=>el.scrollLeft)).toBeGreaterThan(100);
 await activate(page.getByRole('button',{name:'上一组图形'}));await expect.poll(()=>page.locator('#geometry-gallery').evaluate(el=>el.scrollLeft)).toBeLessThan(15);
 const card=page.locator('.specimen').first();await card.focus();await page.keyboard.press('Enter');await expect(card).toHaveAttribute('aria-pressed','true');await expect.poll(()=>page.evaluate(()=>window.__ocvReactor.mode)).toBe(0);
 await page.screenshot({path:path.join(reports,`reactor-${info.project.name}-gallery.png`)});
});
test('ScrollTrigger actually expands the assembly; hidden pages stop frames and return still works',async({page},info)=>{
 await page.goto('/');await page.getByRole('link',{name:'进入主页',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__ocvReactor?.frames||0),{timeout:30000}).toBeGreaterThan(1);
 await page.evaluate(()=>scrollTo({top:document.querySelector('#systems').offsetTop+innerHeight*.65,behavior:'instant'}));
 await expect.poll(()=>page.evaluate(()=>window.__ocvReactor.explosion),{timeout:15000}).toBeGreaterThan(.4);
 await page.screenshot({path:path.join(reports,`reactor-${info.project.name}-expanded.png`)});
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 const before=await page.evaluate(()=>({new:window.__ocvReactor.frames,old:window.__ocvOptics.frames}));await page.waitForTimeout(200);expect(await page.evaluate(()=>({new:window.__ocvReactor.frames,old:window.__ocvOptics.frames}))).toEqual(before);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});await expect.poll(()=>page.evaluate(()=>window.__ocvReactor.frames)).toBeGreaterThan(before.new);
 await page.getByRole('link',{name:'返回顶部'}).click();await expect(page.getByRole('heading',{name:'OMNICIVITAS',exact:true})).toBeInViewport();
});
test('Reduced motion stays still with both layers present and icon navigation remains operable',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.getByRole('link',{name:'进入主页',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__ocvReactor?.frames||0),{timeout:30000}).toBeGreaterThan(0);await page.waitForTimeout(1000);
 const before=await page.evaluate(()=>({new:window.__ocvReactor.frames,old:window.__ocvOptics.frames}));await page.waitForTimeout(250);expect(await page.evaluate(()=>({new:window.__ocvReactor.frames,old:window.__ocvOptics.frames}))).toEqual(before);
 expect(await page.locator('.circuit-current').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 await page.getByRole('button',{name:'阵列',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__ocvReactor.mode)).toBe(3);
 await page.getByRole('link',{name:'图形',exact:true}).click();await expect(page.locator('#geometry-gallery')).toBeInViewport();await page.getByRole('link',{name:'返回顶部'}).click();await expect(page.getByRole('heading',{name:'OMNICIVITAS',exact:true})).toBeInViewport();
});
test('GPU unavailable uses both fallbacks without blocking entry, status or old route redirects',async({page,request})=>{
 await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args);};});
 await page.goto('/');await expect.poll(()=>page.evaluate(()=>window.__ocvReactor?.renderer)).toBe('css');await expect(page.locator('.css-fallback')).toBeAttached();await expect(page.locator('.reactor-fallback')).toBeAttached();
 await page.getByRole('link',{name:'进入主页',exact:true}).click();await page.getByRole('link',{name:'运行状态',exact:true}).click();await expect(page.locator('#status')).toContainText('accountSystem');await expect(page.locator('#refresh')).toBeEnabled();
 expect((await request.get('/memes/m01.webp')).status()).toBe(404);await page.goto('/borrowed');await expect(page).toHaveURL(/\/#systems$/);await expect(page.locator('form,iframe')).toHaveCount(0);
});
