import {tools as allTools,phase5Tools,phase6Tools,phase7Tools} from '../../config/apps/portal/src/tool/data.mjs';
import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {reports} from './report-location.mjs';
const key='ocv.mileage.v1';
const proof=(info,name,data)=>{fs.mkdirSync(reports,{recursive:true});fs.writeFileSync(path.join(reports,`phase7-${info.project.name}-${name}.json`),JSON.stringify(data,null,2));};
test('Phase 7 site meter starts before tool, crosses real navigation, and retains only anonymous totals',async({page},info)=>{
 await page.goto('/identity/login/');await expect.poll(()=>page.evaluate(key=>sessionStorage.getItem(key),key)).not.toBeNull();
 await page.mouse.move(40,60);await page.mouse.move(43,64);await page.mouse.move(55,80);
 // Native wheel dispatch is asynchronous; navigate only after its actual listener ran.
 await page.evaluate(()=>{window.__ocvTestWheelReceived=null;window.addEventListener('wheel',event=>{window.__ocvTestWheelReceived={x:event.deltaX,y:event.deltaY,mode:event.deltaMode};},{once:true});});
 await page.mouse.wheel(0,100);await expect.poll(()=>page.evaluate(()=>window.__ocvTestWheelReceived)).not.toBeNull();
 const deliveredWheel=await page.evaluate(()=>window.__ocvTestWheelReceived);expect(deliveredWheel.mode).toBe(0);expect(deliveredWheel.y).toBeGreaterThan(0);
 await page.goto('/status');await page.mouse.move(70,70);await page.mouse.move(73,74);
 await page.evaluate(()=>{window.__ocvTestWheelReceived=null;window.addEventListener('wheel',event=>{window.__ocvTestWheelReceived={x:event.deltaX,y:event.deltaY,mode:event.deltaMode};},{once:true});});
 await page.mouse.wheel(0,50);await expect.poll(()=>page.evaluate(()=>window.__ocvTestWheelReceived)).not.toBeNull();
 const statusWheel=await page.evaluate(()=>window.__ocvTestWheelReceived);expect(statusWheel.mode).toBe(0);expect(statusWheel.y).toBeGreaterThan(0);
 await page.goto('/functions/mouse-mileage/');
 const before=await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)),key);
 expect(Object.keys(before).sort()).toEqual(['enteredAt','pixels','pointerEvents','version','wheelEvents','wheelPixels']);
 expect(before.pixels).toBeGreaterThanOrEqual(30);expect(before.pointerEvents).toBeGreaterThanOrEqual(5);expect(before.wheelEvents).toBe(2);expect(before.wheelPixels).toBe(Math.hypot(deliveredWheel.x,deliveredWheel.y)+Math.hypot(statusWheel.x,statusWheel.y));
 await page.locator('[data-tool-front]').focus();await page.keyboard.press('Enter');await page.locator('#tool-run').focus();await page.keyboard.press('Enter');
 await expect(page.locator('#tool-output')).not.toHaveValue('');
 const output=await page.locator('#tool-output').inputValue();
 expect(output).toMatch(/纳米|nm/);expect(output).toMatch(/像素|px/);
 await page.locator('#tool-cancel').focus();await page.keyboard.press('Enter');
 proof(info,'meter-navigation',{before,output,realMouseAndWheel:true,realNavigation:true,entryRoutes:['/identity/login/','/status','/functions/mouse-mileage/'],persistedKeys:Object.keys(before),requestedWheelDelta:150,deliveredWheel,statusWheel});
});
test('Phase 7 site meter rejects poisoned history and still works when session storage writes fail',async({page},info)=>{
 await page.addInitScript(()=>{sessionStorage.setItem('ocv.mileage.v1',JSON.stringify({version:1,enteredAt:Date.now(),pixels:999,x:123}));const native=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='ocv.mileage.v1')throw new DOMException('blocked','QuotaExceededError');return native.call(this,k,v);};});
 await page.goto('/functions/mouse-mileage/');await page.locator('[data-tool-front]').focus();await page.keyboard.press('Enter');
 await page.locator('#tool-run').focus();await page.keyboard.press('Enter');await expect(page.locator('#tool-output')).not.toHaveValue('');
 await page.mouse.move(70,70);await page.mouse.move(100,110);
 await expect.poll(()=>page.locator('#tool-output').inputValue()).toMatch(/内存|memory/);
 const output=await page.locator('#tool-output').inputValue();await page.locator('#tool-cancel').focus();await page.keyboard.press('Enter');
 proof(info,'meter-fallback',{output,poisonRejected:true,writeDenied:true,claim:'No coordinates from corrupt session data were used; fallback does not promise refresh persistence.'});
});
test('Phase 7 game directory, all new groups and earlier tools have real navigation paths',async({page},info)=>{
 await page.goto('/functions/games/');await expect(page.locator('main')).toContainText('小游戏');expect(await page.locator('main a[href^="/functions/"]').count()).toBe(allTools.filter(t=>t.group==='游戏').length);
 await page.goto('/functions/');const groups=await page.locator('.tool-group h2').allTextContents();expect(groups).toEqual(['文本','开发','计算','转换','检测','图片','时间','学习','科学','文件','游戏','日常','生成器']);
 expect(phase5Tools.length+phase6Tools.length+phase7Tools.length).toBe(101);expect(await page.locator('.tool-group a').count()).toBe(allTools.length);
 await page.locator('.tool-group a[href="/functions/tic-tac-toe/"]').focus();await page.keyboard.press('Enter');await expect(page.locator('body')).toHaveAttribute('data-tool','tic-tac-toe');
 await page.locator('.maze-exit').focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(/\/#systems$/);
 proof(info,'directory',{groups,tools:allTools.length,originalTools:101,games:allTools.filter(t=>t.group==='游戏').length,originalGames:10,previousTools:54,genuineKeyboardNavigation:true});
});
