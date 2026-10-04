import {test,expect} from '@playwright/test';
import {rooms,address} from '../../config/apps/portal/src/aaa/map.mjs';
import path from 'node:path';
import fs from 'node:fs';
import {reports} from './report-location.mjs';
async function raiseFeature(page){await page.getByRole('button',{name:'功能窗口置顶'}).focus();await page.keyboard.press('Enter');}
test('Every maze URL is real, directory reaches all 27 pages and home has overlapping cumulative windows',async({page,request},info)=>{
 const proof=[];
 for(const [index,room] of rooms.entries()){const response=await request.get(address(room));expect(response.status(),address(room)).toBe(200);const html=await response.text();expect(html).toContain(`data-room="${index}"`);expect(html).toContain('退出迷宫返回主页');proof.push({url:address(room),layout:room.layout,status:response.status()});}
 expect(new Set(rooms.map(r=>r.layout)).size).toBeGreaterThan(15);fs.writeFileSync(path.join(reports,`maze-${info.project.name}-routes.json`),JSON.stringify(proof,null,2));
 await page.goto('/maze/');await expect(page.locator('.maze-atlas a')).toHaveCount(27);await page.getByRole('link',{name:'退出迷宫返回主页'}).click();await expect(page).toHaveURL(/\/#systems$/);
 await expect(page.locator('.wrong-windows')).not.toHaveAttribute('inert','');await expect(page.locator('#optical-field')).toBeAttached();await expect(page.locator('#reactor-field')).toBeAttached();await expect(page.locator('.window-ghost')).toHaveAttribute('data-loose-window',/\d+/);await expect(page.locator('.window-ghost [data-loose-close]')).toBeAttached();
 await page.waitForTimeout(800);await page.screenshot({path:path.join(reports,`maze-${info.project.name}-home.png`)});
 await page.getByRole('link',{name:'进入路由迷宫'}).click();await expect(page).toHaveURL(/\/maze\/$/);await expect(page.getByRole('heading',{name:'目录',exact:true})).toBeVisible();
});
test('Original Vue, Svelte and Solid functions really hydrate inside the new materials and windows can be raised',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/maze/offices/settings/');
 await raiseFeature(page);await expect(page.locator('.feature-panel')).toHaveClass(/brought-forward/);
 await expect(page.locator('[data-framework=vue]')).toBeVisible();await expect(page.locator('.feature-panel astro-island')).not.toHaveAttribute('ssr','');await page.getByRole('button',{name:'领票',exact:true}).click();await expect(page.getByTestId('pinia-count')).toContainText('1 张');
 await page.screenshot({path:path.join(reports,`maze-${info.project.name}-settings.png`)});
 await page.getByRole('button',{name:'折叠功能窗口'}).click();await expect(page.locator('.feature-panel')).toHaveAttribute('data-folded','');await page.getByRole('button',{name:'折叠功能窗口'}).click();await expect(page.getByTestId('pinia-count')).toBeVisible();
 await page.goto('/maze/approval/');await raiseFeature(page);await expect(page.locator('.feature-panel astro-island')).not.toHaveAttribute('ssr','');await page.getByRole('button',{name:'再停一次'}).click();await expect(page.getByTestId('svelte-count')).toHaveText('1');await page.getByRole('button',{name:'归零',exact:true}).click();await expect(page.getByTestId('svelte-count')).toHaveText('0');
 await page.goto('/maze/display/');await page.getByRole('button',{name:'功能窗口置顶'}).focus();await page.keyboard.press('Enter');await expect(page.locator('.feature-panel astro-island')).not.toHaveAttribute('ssr','');await page.getByRole('button',{name:'翻面',exact:true}).click();await expect(page.getByTestId('solid-word')).toHaveText('不在。');expect(errors).toEqual([]);
});
test('Existing IndexedDB/Cache/SVG/hash sources survive reload and Worker plus JSON export remain correct',async({page},info)=>{
 await page.goto('/maze/cache/');await raiseFeature(page);await expect(page.locator('ocv-cache .cache-body')).not.toHaveText('—');
 const label=`迷宫-${info.project.name}`;await page.locator('ocv-cache textarea').fill(label);await page.locator('ocv-cache').getByRole('button',{name:'保存',exact:true}).click();await expect(page.locator('ocv-cache .cache-body')).toHaveText(label);
 await page.reload();await raiseFeature(page);await expect(page.locator('ocv-cache .cache-body')).toHaveText(label);
 await page.locator('ocv-cache').getByRole('button',{name:'状态',exact:true}).click();await expect(page.locator('ocv-cache .cache-alias')).toHaveText('已归档');expect(decodeURIComponent(new URL(page.url()).hash)).toContain('已归档');
 await page.locator('ocv-cache').getByRole('button',{name:'标签',exact:true}).click();await expect(page.locator('ocv-cache .cache-label')).toHaveText('冷饭');
 await page.locator('ocv-cache').getByRole('button',{name:'2 + 2',exact:true}).click();await expect(page.locator('ocv-cache .worker-result')).toHaveText('4');
 const event=page.waitForEvent('download');await page.locator('ocv-cache').getByRole('button',{name:'导出',exact:true}).click();const download=await event;const data=JSON.parse(fs.readFileSync(await download.path(),'utf8'));expect(data.version).toBe(1);expect(data.record.body).toBe(label);expect(data.record.labelCode).toBe(44);expect(data.record.description).toBe('浏览器档案');expect(data.record.source.body).toBe('IndexedDB only');expect(data.record.source.prefix).toBe('CSV + Cache Storage');
 await page.screenshot({path:path.join(reports,`maze-${info.project.name}-cache.png`)});
});
test('Lit notifications and real table sorting work, decorative confirmations do not capture essential actions',async({page})=>{
 await page.goto('/maze/notifications/');await raiseFeature(page);await expect(page.locator('ocv-notices .notice-count')).toHaveText('2');await page.locator('ocv-notices').getByRole('button',{name:'未读',exact:true}).click();await page.locator('ocv-notices').getByRole('button',{name:'全部已读',exact:true}).click();await expect(page.locator('ocv-notices .notice-count')).toHaveText('0');await expect(page.locator('ocv-notices .notice')).toHaveCount(0);await page.locator('ocv-notices').getByRole('button',{name:'恢复',exact:true}).click();await expect(page.locator('ocv-notices .notice')).toHaveCount(2);
 await page.goto('/maze/table/');await raiseFeature(page);await page.getByRole('button',{name:'层级 ↕'}).click();const levels=await page.locator('.route-table tbody tr td:nth-child(2)').allTextContents();expect(levels.map(Number)).toEqual(levels.map(Number).sort((a,b)=>a-b));await expect(page.locator('.table-note')).toHaveText('↑');
 await page.getByRole('link',{name:'退出迷宫返回主页'}).click();await expect(page).toHaveURL(/\/#systems$/);
});
test('Horizontal and unusually long rooms are intentional, keyboard movement and fixed exit survive reduced motion',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/maze/cache/l1/');expect(await page.locator('.maze-scroller').evaluate(el=>el.scrollWidth-el.clientWidth)).toBeGreaterThan(1000);
 await page.locator('.feature-panel').scrollIntoViewIfNeeded();await raiseFeature(page);await expect(page.locator('ocv-cache .cache-body')).not.toHaveText('—');
 const drag=page.getByRole('button',{name:'移动功能窗口'});await drag.focus();await page.keyboard.press('ArrowRight');expect(await page.locator('.feature-panel').evaluate(el=>el.style.getPropertyValue('--drag-x'))).toBe('24px');
 await page.screenshot({path:path.join(reports,`maze-${info.project.name}-horizontal.png`)});await expect(page.getByRole('link',{name:'退出迷宫返回主页'})).toBeInViewport();await page.getByRole('link',{name:'打开完整迷宫目录'}).click();await expect(page).toHaveURL(/\/maze\/$/);
 await page.goto('/maze/aside/');expect(await page.locator('.maze-floor').evaluate(el=>el.offsetHeight)).toBeGreaterThanOrEqual(5200);await expect(page.getByRole('link',{name:'退出迷宫返回主页'})).toBeInViewport();expect(await page.locator('.maze-halo .technical-graphic').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');await page.getByRole('link',{name:'退出迷宫返回主页'}).click();await expect(page).toHaveURL(/\/#systems$/);
});
