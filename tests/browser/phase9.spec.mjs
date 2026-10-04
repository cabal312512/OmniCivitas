import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';

test('real JSON output/export stays exact across repeated submit, refresh and Back',async({page})=>{
 await page.goto('/functions/json/');
 const input='{"n":3,"payload":"<script>window.canary=1</script>"}';
 await page.locator('#tool-form textarea').first().fill(input);
 await page.locator('#tool-form button[type=submit]').press('Enter');
 await page.locator('#tool-form button[type=submit]').press('Enter');
 await expect(page.locator('#tool-status')).toHaveText('完成');
 expect(JSON.parse(await page.locator('#tool-output').inputValue())).toEqual(JSON.parse(input));
 expect(await page.evaluate(()=>window.canary)).toBeUndefined();
 const download=page.waitForEvent('download');await page.locator('#tool-export').press('Enter');
 const result=await download;expect(JSON.parse(await fs.readFile(await result.path(),'utf8'))).toEqual(JSON.parse(input));
 await page.reload();await expect(page.locator('#tool-form')).toBeVisible();
 await page.goto('/functions/');await expect(page).toHaveURL(/\/functions\/$/);await page.goBack();await expect(page.locator('#tool-form')).toBeVisible();
});

test('blocked IndexedDB and Cache Storage still permit real Lit save and truthful session fallback',async({page})=>{
 await page.addInitScript(()=>{
  Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(){throw new DOMException('Blocked','SecurityError')}}});
  Object.defineProperty(window,'caches',{configurable:true,value:{open(){throw new DOMException('Blocked','SecurityError')}}});
 });
 await page.goto('/maze/cache/l1/l2/');
 const cache=page.locator('ocv-cache');await expect(cache.locator('textarea')).toBeVisible();
 await cache.locator('textarea').fill('phase9 session-only <script>inert</script>');
 await cache.getByRole('button',{name:'保存',exact:true}).press('Enter');
 await expect(cache.locator('.cache-body')).toHaveText('phase9 session-only <script>inert</script>');
 await expect(cache.locator('[role=status]')).toHaveText('已保存（仅本页）');
 await cache.locator('summary').press('Enter');await expect(cache.locator('pre')).toContainText('session memory fallback');
});

test('fictional entry discards originals, transmits no credentials and accepts the generated pair',async({page})=>{
 const traffic=[];page.on('request',request=>traffic.push(request.url()+(request.postData()||'')));
 await page.goto('/identity/login/');
 await page.locator('#fiction-name').fill('phase9-original-name');
 await page.locator('#fiction-password').fill('NeverARealPassword!Phase9');
 await page.locator('#identity-submit').press('Enter');
 const username=await page.locator('#round-name').textContent(),password=await page.locator('#round-password').textContent();
 await expect(page.locator('#fiction-password')).toHaveValue('');
 const storage=await page.evaluate(()=>JSON.stringify({session:{...sessionStorage},local:{...localStorage}}));
 expect(storage).not.toContain('NeverARealPassword');expect(storage).not.toContain('phase9-original-name');expect(storage).not.toContain(password);
 expect(traffic.join('\n')).not.toContain('NeverARealPassword');expect(traffic.join('\n')).not.toContain('phase9-original-name');
 await page.locator('#fiction-name').fill(username);await page.locator('#fiction-password').fill(password);
 await page.locator('#identity-submit').press('Enter');await expect(page).toHaveURL(/\/#systems$/);
 await page.goto('/functions/base64/');await expect(page.locator('#tool-form')).toBeVisible();
});

test('denied local and session storage keep tools and native exit usable',async({page})=>{
 await page.addInitScript(()=>{for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{configurable:true,get(){throw new DOMException('Blocked','SecurityError')}})});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/functions/base64/');
 await page.locator('#tool-form textarea').first().fill('phase9');
 await page.locator('#tool-form button[type=submit]').press('Enter');
 await expect(page.locator('#tool-status')).toHaveText('完成');
 await page.locator('.maze-index').press('Enter');await expect(page).toHaveURL(/\/functions\/$/);
 expect(errors).toEqual([]);
});
