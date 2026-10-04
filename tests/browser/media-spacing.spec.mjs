import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {reports} from './report-location.mjs';

const intersect=(a,b)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
const inside=(box,viewport)=>box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+.1&&box.y+box.height<=viewport.height+.1;
for(const route of ['/maze/','/media/'])for(const viewport of [{width:1440,height:1000},{width:617,height:391}]){
 test(`Separate native media shortcuts and open drawer retain spacing: ${route} ${viewport.width}x${viewport.height}`,async({page})=>{
  await page.setViewportSize(viewport);await page.goto(route);
  const spring=page.locator('.n9-shortcuts [data-attachment-toggle]'),laowu=page.locator('.n9-shortcuts [data-laowu]'),media=page.locator('.n9-shortcuts a[href="/media/"]'),drawer=page.locator('.n9-shortcuts #forgotten-drawer');
  for(const control of [spring,laowu,media])await expect(control).toBeVisible();await expect(drawer).toBeHidden();
  const initial={spring:await spring.boundingBox(),laowu:await laowu.boundingBox(),media:await media.boundingBox()};
  for(const [name,box]of Object.entries(initial))expect(inside(box,viewport),`${name} remains within ${viewport.width}x${viewport.height}`).toBe(true);
  expect(intersect(initial.spring,initial.laowu)).toBe(0);expect(intersect(initial.spring,initial.media)).toBe(0);expect(intersect(initial.laowu,initial.media)).toBe(0);
  expect(await page.locator('.n9-shortcuts').evaluate(node=>({background:getComputedStyle(node).backgroundColor,border:getComputedStyle(node).borderTopWidth,filter:getComputedStyle(node).backdropFilter}))).toEqual({background:'rgba(0, 0, 0, 0)',border:'0px',filter:'none'});
  await spring.click();await expect(drawer).toBeVisible();await expect(spring).toHaveAttribute('aria-expanded','true');await expect(drawer.locator('.drawer-images img')).toHaveCount(2);
  await expect.poll(()=>drawer.locator('.drawer-images img').evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth>0))).toBe(true);
  const expanded={drawer:await drawer.boundingBox(),spring:await spring.boundingBox(),laowu:await laowu.boundingBox(),media:await media.boundingBox()};
  expect(intersect(expanded.drawer,expanded.laowu)).toBe(0);expect(intersect(expanded.drawer,expanded.media)).toBe(0);expect(intersect(expanded.spring,expanded.laowu)).toBe(0);expect(intersect(expanded.spring,expanded.media)).toBe(0);expect(intersect(expanded.laowu,expanded.media)).toBe(0);
  const basename=`media-spacing-${route==='/maze/'?'maze':'media'}-${viewport.width}`;
  await page.screenshot({path:path.join(reports,`${basename}.png`)});
  await drawer.locator('[data-attachment-close]').click();await expect(drawer).toBeHidden();await expect(spring).toHaveAttribute('aria-expanded','false');
  fs.writeFileSync(path.join(reports,`${basename}.json`),JSON.stringify({route,viewport,initial,expanded,claim:'Native spring-button click loads both original images. Actual rendered rectangles show independent trigger positions and no drawer overlap with the Laowu or media controls. Their selectors, labels and original media behavior remain intact.'},null,2));
 });
}
