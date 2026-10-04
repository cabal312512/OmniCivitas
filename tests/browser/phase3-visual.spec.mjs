import {test,expect} from '@playwright/test';
import fs from 'node:fs';import path from 'node:path';
const reports=process.env.OCV_DEPS_ROOT?path.join(process.env.OCV_DEPS_ROOT,'runtime/reports'):path.resolve('.test-results');
test('All sixteen local originals decode; WebGL renders, controls affect motion, airborne decorations are bounded',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await expect(page.locator('#storage-note')).toHaveText('抽屉已打开');
 await expect.poll(()=>page.evaluate(()=>window.__ocvScene?.frames||0)).toBeGreaterThan(2);expect(await page.evaluate(()=>window.__ocvScene.renderer)).toBe('webgl');
 await page.locator('img[src^="/memes/"]').evaluateAll(images=>images.forEach(img=>img.loading='eager'));
 await expect.poll(()=>page.locator('img[src^="/memes/"]').evaluateAll(images=>images.filter(img=>img.complete&&img.naturalWidth>0).length)).toBe(16);
 const sources=await page.locator('img[src^="/memes/"]').evaluateAll(images=>images.map(img=>img.getAttribute('src')));expect(new Set(sources).size).toBe(16);
 await page.locator('#local-gravity').evaluate(el=>{el.value='1.8';el.dispatchEvent(new Event('input',{bubbles:true}));});await expect(page.locator('#gravity-value')).toHaveText('1.8');expect(await page.evaluate(()=>window.__ocvScene.gravity)).toBe(1.8);
 await page.locator('#throw-civilization').evaluate(el=>{for(let i=0;i<14;i++)el.click();});await expect(page.locator('.thrown-civilization')).toHaveCount(8);await expect(page.locator('#airborne-count')).toHaveText('8');await expect(page.locator('.thrown-civilization')).toHaveCount(0);await expect(page.locator('#airborne-count')).toHaveText('0');
 await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:path.join(reports,`phase3-visual-${info.project.name}-hero.png`)});
 const proof=await page.evaluate(()=>({...window.__ocvScene,canvas:[document.querySelector('#civilization-core').width,document.querySelector('#civilization-core').height],horizontalOverflow:document.documentElement.scrollWidth>innerWidth+2}));expect(proof.horizontalOverflow).toBe(false);fs.writeFileSync(path.join(reports,`phase3-visual-${info.project.name}-renderer.json`),JSON.stringify(proof,null,2));expect(errors).toEqual([]);
});
test('Horizontal chapters advance, scroll odometer and path track real movement, masks reveal and renderer rests offscreen',async({page},info)=>{
 await page.goto('/');await expect(page.locator('#storage-note')).toHaveText('抽屉已打开');await page.locator('#chapter-forward').scrollIntoViewIfNeeded();await page.getByRole('button',{name:'下一章节'}).click();await expect.poll(()=>page.locator('#chapter-track').evaluate(el=>el.scrollLeft)).toBeGreaterThan(100);await page.getByRole('button',{name:'上一章节'}).click();await expect.poll(()=>page.locator('#chapter-track').evaluate(el=>el.scrollLeft)).toBeLessThan(10);
 await page.locator('.stacking-sector').scrollIntoViewIfNeeded();await expect.poll(()=>page.locator('#depth-odometer').getAttribute('aria-label')).toMatch(/页面滚动 [1-9]\d+ 像素/);await expect.poll(()=>page.locator('#drawn-circuit').evaluate(el=>Number(el.style.strokeDashoffset))).toBeLessThan(1000);await expect(page.locator('.chapter-heading h2')).toHaveClass(/is-revealed/);
 await expect.poll(()=>page.evaluate(()=>window.__ocvScene.visible)).toBe(false);const a=await page.evaluate(()=>window.__ocvScene.frames);await page.waitForTimeout(180);expect(await page.evaluate(()=>window.__ocvScene.frames)).toBe(a);
 await page.screenshot({path:path.join(reports,`phase3-visual-${info.project.name}-layers.png`),fullPage:true});
});
test('Reduced motion freezes animated media and scene while tools and decorative fallback still work',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await expect(page.locator('#storage-note')).toHaveText('抽屉已打开');await page.locator('img[src^="/memes/"]').evaluateAll(images=>images.forEach(img=>img.loading='eager'));
 await expect.poll(()=>page.locator('.meme-media[data-animated][data-frozen=true]').count()).toBe(5);expect(await page.evaluate(()=>getComputedStyle(document.querySelector('.flight-ticker>div')).animationName)).toBe('none');await expect(page.getByRole('button',{name:'停止乱动'})).toHaveCount(0);
 const frames=await page.evaluate(()=>window.__ocvScene.frames);await page.waitForTimeout(150);expect(await page.evaluate(()=>window.__ocvScene.frames)).toBe(frames);await page.getByRole('button',{name:'计算 2 + 2'}).click();await expect(page.locator('#worker-output')).toContainText('workerAnswer');
 await page.emulateMedia({reducedMotion:'no-preference'});await expect(page.locator('.meme-media[data-frozen=true]')).toHaveCount(0);
});
test('No WebGL remains a usable CSS scene; no image, canvas or decorative layer blocks navigation',async({page})=>{
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'?null:original.call(this,type,...args);};});await page.goto('/');await expect(page.locator('#storage-note')).toHaveText('抽屉已打开');expect(await page.evaluate(()=>window.__ocvScene.renderer)).toBe('css');await expect(page.locator('.orb-fallback')).toBeVisible();await page.getByRole('link',{name:'进入现场'}).click();await expect(page.locator('#districts')).toBeInViewport();await page.getByRole('link',{name:'① 厨房 / 领票 / 停机'}).click();await expect(page.getByRole('heading',{name:'厨房 / 排队 / 0 号'})).toBeVisible();
});

