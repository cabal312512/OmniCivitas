import {testDeps} from '../runtime-location.mjs';
import {test,expect} from '@playwright/test';
import path from 'node:path';
const artifacts=path.join(testDeps,'runtime/reports');
test('all twenty designs appear across actual routes, links resolve, research and game stay clean',async({page,request})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 const found=new Set(),targets=new Set();
 for(const route of ['/maze/','/maze/display/','/maze/table/','/functions/json/','/lab/','/functions/','/incidents/','/media/']){
  await page.goto(route);await expect(page.locator('[data-n3-layer]')).toHaveAttribute('data-n3-mounted','true');
  for(const id of await page.locator('[data-n3-kind]').evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.n3Kind))))found.add(id);
  for(const href of await page.locator('[data-n3-layer] a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href'))))targets.add(href);
 }
 expect([...found].sort((a,b)=>a-b)).toEqual(Array.from({length:20},(_,i)=>i));
 for(const href of targets)expect((await request.get(href)).status(),href).toBe(200);
 for(const route of ['/research/','/research/explore/','/research/atlas/','/research/library/','/functions/3d-world/']){
  const response=await request.get(route);expect(response.status()).toBe(200);expect(await response.text()).not.toContain('data-n3-kind');
 }
});
test('calm cover stays clear; new window closes, drags, and opens a real tool',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/');await expect(page.locator('[data-n3-kind="0"]')).not.toBeVisible();
 await page.goto('/maze/table/');
 const pane=page.locator('[data-n3-kind="0"]'),handle=pane.locator('[data-n3-handle]');
 await expect(pane).toBeVisible();const before=await pane.boundingBox();
 const bounds=await handle.boundingBox();await page.mouse.move(bounds.x+30,bounds.y+12);await page.mouse.down();await page.mouse.move(bounds.x+142,bounds.y+55,{steps:4});await page.mouse.up();
 const after=await pane.boundingBox();expect(after.x-before.x).toBeCloseTo(112,0);expect(after.y-before.y).toBeCloseTo(43,0);
 await pane.locator('[data-n3-close]').click();await expect(pane).toBeHidden();
 await page.locator('[data-n3-kind="17"] .n3-dialog-submit').click();await expect(page).toHaveURL(/\/functions\/calculator\//);await expect(page.locator('#tool-form')).toBeVisible();
});
test('autonomous trajectories, jumps and spasms really move without input',async({page})=>{
 await page.goto('/functions/json/');
 await expect(page.locator('[data-n3-layer]')).toHaveAttribute('data-n3-mounted','true');
 const snapshot=()=>page.locator('[data-n3-motion]').evaluateAll(nodes=>nodes.map(n=>[n.dataset.n3Kind,n.style.getPropertyValue('--n3-x'),n.style.getPropertyValue('--n3-y')]));
 const before=await snapshot();await page.waitForTimeout(1500);const after=await snapshot();expect(after).not.toEqual(before);
 await page.goto('/maze/display/');const orbit=page.locator('[data-n3-kind="4"]');
 const start=await orbit.boundingBox();await page.waitForTimeout(500);const end=await orbit.boundingBox();expect(Math.abs(end.x-start.x)+Math.abs(end.y-start.y)).toBeGreaterThan(5);
 await page.screenshot({path:path.join(artifacts,'windows20-display.png')});
 await page.goto('/maze/table/');await page.screenshot({path:path.join(artifacts,'windows20-table.png')});
});
test('bare form works, counter updates, motion stops under reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/maze/table/');
 const naked=page.locator('[data-n3-kind="5"]');await naked.locator('input[type="checkbox"]').check();await expect(naked.locator('input[type="checkbox"]')).toBeChecked();
 await page.goto('/maze/');const counter=page.locator('[data-n3-kind="10"]');
 await counter.locator('[data-n3-add]').click();await expect(counter.locator('[data-n3-count]')).toHaveText('05');
 const orbit=page.locator('[data-n3-kind="4"]');const start=await orbit.boundingBox();await page.waitForTimeout(250);expect(await orbit.boundingBox()).toEqual(start);
});
