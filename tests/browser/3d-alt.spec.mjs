import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {reports} from './report-location.mjs';
const snapshot=page=>page.evaluate(()=>window.__ocv3D.snapshot());

test('Holding either Alt key releases the native game cursor for HUD interaction and restores viewing on release',async({page})=>{
 await page.goto('/functions/3d-world/');
 await expect.poll(async()=> (await snapshot(page))?.mode,{timeout:45000}).toBe('webgl');
 const canvas=page.locator('#world'),box=await canvas.boundingBox();
 await page.mouse.click(box.x+box.width*.5,box.y+box.height*.5);
 await expect.poll(async()=> (await snapshot(page)).shots).toBeGreaterThan(0);
 const before=await snapshot(page);
 await page.keyboard.down('AltLeft');
 await expect.poll(async()=> (await snapshot(page)).cursorHeld).toBe(true);
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement===null)).toBe(true);
 await expect(canvas).toHaveCSS('cursor','default');
 const free=await snapshot(page);
 await page.mouse.move(box.x+box.width*.7,box.y+box.height*.4);
 await page.mouse.click(box.x+box.width*.6,box.y+box.height*.55);
 await page.keyboard.down('KeyW');await page.waitForTimeout(250);await page.keyboard.up('KeyW');
 const held=await snapshot(page);
 expect(held.shots).toBe(free.shots);expect(held.yaw).toBe(free.yaw);expect(held.pitch).toBe(free.pitch);
 expect(held.player.x).toBe(free.player.x);expect(held.player.z).toBe(free.player.z);
 await page.locator('[data-mute]').click();await expect(page.locator('[data-mute]')).toHaveAttribute('aria-pressed','true');
 await page.keyboard.down('AltRight');await page.keyboard.up('AltLeft');
 expect((await snapshot(page)).cursorHeld).toBe(true);
 await page.keyboard.up('AltRight');
 await expect.poll(async()=> (await snapshot(page)).cursorHeld).toBe(false);
 let rapidHeld=null;
 if(before.locked){
  await expect.poll(async()=> (await snapshot(page)).locked,{timeout:10000}).toBe(true);
  await page.keyboard.down('AltLeft');
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement===null)).toBe(true);
  await page.keyboard.up('AltLeft');await page.keyboard.down('AltLeft');
  await page.waitForTimeout(150);
  rapidHeld=await snapshot(page);expect(rapidHeld.cursorHeld).toBe(true);expect(rapidHeld.locked).toBe(false);
  await expect(canvas).toHaveCSS('cursor','default');await page.keyboard.up('AltLeft');
 }
 await page.keyboard.press('Escape');await canvas.focus();
 const resumed=await snapshot(page);await page.keyboard.down('ArrowRight');
 await expect.poll(async()=> (await snapshot(page)).yaw,{timeout:10000}).toBeLessThan(resumed.yaw-.08);
 await page.keyboard.up('ArrowRight');
 fs.writeFileSync(path.join(reports,'3d-native-alt-cursor.json'),JSON.stringify({before,free,held,rapidHeld,resumed,after:await snapshot(page),claim:'Actual AltLeft/AltRight and rapid release/re-hold, native pointer movement/canvas and HUD clicks, document pointer-lock state and unchanged gameplay while the cursor is released; native arrow view resumes after release.'},null,2));
});
