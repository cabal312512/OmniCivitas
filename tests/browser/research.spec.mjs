import {testDeps} from '../runtime-location.mjs';
import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const reportRoot=path.join(testDeps,'runtime/reports/research-site');fs.mkdirSync(reportRoot,{recursive:true});
test('compact headers and fixed-view overview respond to hover and click',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/research/');const canvas=page.locator('[data-research-hero]');await expect(canvas).toHaveAttribute('data-render-mode','webgl');
 const compact=async(selector)=>{const gap=await page.locator(selector).evaluate(el=>el.getBoundingClientRect().top-document.querySelector('.research-header').getBoundingClientRect().bottom);expect(gap).toBeLessThan(40);};
 await compact('.hero-copy .eyebrow');expect((await page.locator('.research-metrics').boundingBox()).y).toBeLessThan(580);
 await canvas.hover();await expect.poll(()=>canvas.evaluate(c=>Number(c.dataset.hoverStrength))).toBeGreaterThan(.5);await expect.poll(()=>canvas.evaluate(c=>Number(c.dataset.latticeResponse))).toBeGreaterThan(.3);
 await canvas.click();await expect(canvas).toHaveAttribute('data-click-pulses','1');await expect(canvas).toHaveAttribute('data-view-yaw','-0.26');
 const box=await canvas.boundingBox();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.75,box.y+box.height*.6,{steps:3});await page.mouse.up();await expect(canvas).toHaveAttribute('data-view-yaw','-0.26');
 await page.screenshot({path:path.join(reportRoot,'compact-overview.png')});await page.mouse.move(10,85);await expect.poll(()=>canvas.evaluate(c=>Number(c.dataset.hoverStrength))).toBeLessThan(.1);
 for(const name of ['Explore','Atlas']){await page.evaluate(()=>{window.researchNavigationReady=false;document.addEventListener('astro:page-load',()=>window.researchNavigationReady=true,{once:true});});await page.locator('.research-header nav').getByRole('link',{name,exact:true}).click();await page.waitForFunction(()=>window.researchNavigationReady);await page.locator('.intro-copy').hover();await compact('.intro-copy .eyebrow');await page.locator('.page-intro-visual').screenshot({path:path.join(reportRoot,'compact-'+name.toLowerCase()+'.png')});}
 expect(errors).toEqual([]);
});
test('first entry survives repeated readiness events and each section renders its distinct accent',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/research/');
 const hero=page.locator('[data-research-hero]');
 await expect(hero).toHaveAttribute('data-render-mode','webgl');
 await expect.poll(()=>hero.evaluate(c=>Number(c.dataset.renderedFrames))).toBeGreaterThan(1);
 const first=await hero.elementHandle();
 await page.evaluate(()=>{document.dispatchEvent(new Event('astro:page-load'));document.dispatchEvent(new Event('DOMContentLoaded'));document.dispatchEvent(new Event('astro:page-load'));});
 expect(await first.evaluate(c=>c===document.querySelector('[data-research-hero]')&&!c.getContext('webgl2').isContextLost())).toBe(true);
 await page.reload();await expect(hero).toHaveAttribute('data-render-mode','webgl');
 for(const [name,kind] of [['Explore','explore'],['Atlas','atlas'],['Library','library']]){
  await page.evaluate(()=>{window.researchNavigationReady=false;document.addEventListener('astro:page-load',()=>{window.researchNavigationReady=true;},{once:true});});
  await page.locator('.research-header nav').getByRole('link',{name,exact:true}).click();
  await page.waitForFunction(()=>window.researchNavigationReady===true);
  await expect(hero).toHaveAttribute('data-research-scene',kind);
  await expect(hero).toHaveAttribute('data-render-mode','webgl');
  await expect.poll(()=>hero.evaluate(c=>Number(c.dataset.renderedFrames))).toBeGreaterThan(1);
  expect(await hero.evaluate(c=>!c.getContext('webgl2').isContextLost()&&c.width>0&&c.height>0)).toBe(true);
  await hero.hover();const box=await hero.boundingBox();expect(box.height).toBeGreaterThan(400);
  await page.mouse.move(box.x+box.width*.45,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.58,{steps:5});await page.mouse.up();
  await expect.poll(()=>hero.evaluate(c=>Number(c.dataset.viewYaw))).toBeGreaterThan(.5);
  await page.mouse.wheel(0,-170);await expect.poll(()=>hero.evaluate(c=>Number(c.dataset.zoom))).toBeGreaterThan(1.1);
  await hero.click();await expect(hero).toHaveAttribute('data-expanded','true');
  if(kind==='library'){await expect(page.locator('.accent-inspector')).toBeVisible();expect(await page.locator('[data-accent-document-link]').getAttribute('href')).toMatch(/^\/research\/read\//);}
  await hero.press('Escape');await expect(hero).toHaveAttribute('data-expanded','false');await expect(hero).toHaveAttribute('data-zoom','1');
  if(kind==='library')await expect(page.locator('.accent-inspector')).toBeHidden();
  await page.locator('.page-intro-visual').screenshot({path:path.join(reportRoot,'accent-'+kind+'.png')});
 }
 await page.locator('.research-header nav').getByRole('link',{name:'Overview',exact:true}).click();await expect(hero).toHaveAttribute('data-render-mode','webgl');
 await page.goBack();await expect(hero).toHaveAttribute('data-research-scene','library');await expect(hero).toHaveAttribute('data-render-mode','webgl');
 expect(errors).toEqual([]);
});
test('professional overview, actual WebGL, entrances and persistent single-track playback',async({page,request})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 for(const route of ['/#systems','/maze/cache/','/maze/table/','/maze/route/a/b/c/d/e/']){const response=await request.get(route);expect(response.ok()).toBeTruthy();expect(await response.text()).toContain('href="/research/"');}
 await page.goto('/research/');await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.locator('[data-research-hero]')).toHaveAttribute('data-render-mode','webgl');
 await expect(page.getByRole('heading',{name:'A bit of feedback. A world of outcomes.'})).toBeVisible();
 await expect.poll(()=>page.locator('[data-research-audio]').evaluate(audio=>audio.dataset.initialized)).toBe('true');
 const source=await page.locator('[data-research-audio]').getAttribute('src');expect(source).toMatch(/research\/audio\/.+\.(mp3|ogg)$/);
 await page.locator('.hero-copy').click();await expect.poll(()=>page.locator('[data-research-audio]').evaluate(audio=>audio.currentTime)).toBeGreaterThan(0);
 expect(await page.locator('[data-research-audio]').evaluate(audio=>audio.loop)).toBe(true);
 await page.screenshot({path:path.join(reportRoot,'overview.png')});
 await page.locator('.research-header nav').getByRole('link',{name:'Library'}).click();await expect(page).toHaveURL(/research\/library/);
 expect(await page.locator('[data-research-audio]').getAttribute('src')).toBe(source);
 await page.locator('[data-research-volume]').focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');expect(await page.locator('[data-research-audio]').evaluate(audio=>audio.volume)).toBe(.01);
 await page.locator('[data-research-sound]').click();expect(await page.locator('[data-research-audio]').evaluate(audio=>audio.paused)).toBe(true);
 expect(errors).toEqual([]);
});
test('interactive lab samples real occupancy, normalized kernels, exact laws and certificate excerpts',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/research/explore/');
 await page.locator('[data-demo-step]').click();await expect(page.locator('[data-adsorption-canvas]')).toHaveAttribute('data-attempts','100');
 const coverage=Number(await page.locator('[data-demo-coverage]').textContent());expect(coverage).toBeGreaterThan(0);
 await page.locator('[data-demo-run]').click();await page.waitForTimeout(250);await page.locator('[data-demo-run]').click();expect(Number(await page.locator('[data-adsorption-canvas]').getAttribute('data-attempts'))).toBeGreaterThan(100);
 await page.locator('[data-demo-reset]').click();await expect(page.locator('[data-adsorption-canvas]')).toHaveAttribute('data-attempts','0');
 await page.locator('[data-demo-policy]').selectOption('temporal');await expect(page.locator('[data-alpha-label]')).toHaveText('H → V probability');
 await page.locator('[data-kernel-query]').fill('HV');await expect(page.locator('[data-kernel-probability]')).toContainText('P = 1.000000');
 await page.locator('[data-terminal-policy]').selectOption('0');expect(Number(await page.locator('[data-terminal-canvas]').getAttribute('data-atom-count'))).toBeGreaterThan(9);
 await page.locator('[data-support-mu]').focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');await expect(page.locator('[data-support-mu-value]')).toHaveText('0.01');
 await page.locator('[data-prefix-depth]').focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await expect(page.locator('[data-prefix-depth-value]')).toHaveText('5');expect(Number(await page.locator('[data-prefix-canvas]').getAttribute('data-visible-nodes'))).toBeGreaterThan(10);
 await page.locator('#support').screenshot({path:path.join(reportRoot,'support.png')});expect(errors).toEqual([]);
});
test('atlas enlarges original figures and reader opens complete papers and original source',async({page,request})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/research/atlas/');await page.locator('[data-lightbox-src]').first().click();await expect(page.locator('dialog')).toBeVisible();expect(await page.locator('[data-lightbox-image]').evaluate(image=>image.naturalWidth)).toBeGreaterThan(0);await page.locator('[data-lightbox-close]').click();
 await page.locator('[data-atlas-filter="Exact finite system"]').click();expect(await page.locator('[data-figure-category]:visible').count()).toBe(4);
 await page.goto('/research/read/manuscript/');await expect(page.locator('.research-paper')).toContainText('Research disclosure');expect((await page.locator('.research-paper').textContent()).length).toBeGreaterThan(20000);
 await page.screenshot({path:path.join(reportRoot,'reader.png')});
 await page.goto('/research/code/word/');await expect(page.locator('#research-source')).toContainText('count*BigInt');
 const md=await request.get('/research/files/stage5/paper/FINAL_MANUSCRIPT.md');expect(md.ok()).toBeTruthy();expect(await md.text()).toContain('## Abstract');expect(errors).toEqual([]);
});
test('complete downloadable evidence index and published audio byte identity',async({request})=>{
 const index=await (await request.get('/research/asset-manifest.json')).json();expect(index.totalFiles).toBe(1271);expect(index.archives.reduce((sum,row)=>sum+row.files,0)).toBe(1271);
 for(const archive of index.archives){const response=await request.head(archive.url);expect(response.ok()).toBeTruthy();expect(Number(response.headers()['content-length'])).toBe(archive.bytes);}
 for(const file of ['mutant-club.mp3','machines-with-feelings.ogg','dear-mr-super-computer.ogg']){const response=await request.get('/research/audio/'+file);expect(response.ok()).toBeTruthy();const bytes=await response.body(),source=fs.readFileSync(path.join('config/apps/portal/public/research/audio',file));expect(bytes.equals(source)).toBe(true);}
});
