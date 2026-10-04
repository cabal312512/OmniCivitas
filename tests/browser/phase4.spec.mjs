import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {reports} from './report-location.mjs';
const round=async page=>({name:await page.locator('#round-name').textContent(),password:await page.locator('#round-password').textContent()});
async function activate(page,locator,info){if(info.project.name==='mobile'){await locator.focus();await page.keyboard.press('Enter');}else await locator.click();}
async function enterHome(page){await expect.poll(()=>page.evaluate(()=>window.__ocvReactor?.renderer),{timeout:30000}).toBe('three-webgl2');if(await page.evaluate(()=>scrollY<innerHeight*.72))await page.getByRole('link',{name:'进入主页',exact:true}).click();await expect(page.locator('.wrong-windows')).not.toHaveAttribute('inert','',{timeout:20000});expect(await page.evaluate(()=>({visible:document.body.dataset.cover==='false',focusable:!document.querySelector('.wrong-windows').inert}))).toEqual({visible:true,focusable:true});}
async function occupy(page){await page.locator('#fiction-email').fill('fiction-probe@example.invalid');await page.locator('#fiction-name').fill('only-in-this-page');await page.locator('#fiction-password').fill('OriginalCanary!NeverReal73');await page.locator('#fiction-confirm').fill('OriginalCanary!NeverReal73');await page.locator('#identity-submit').click();await expect(page.locator('#round-name')).toBeVisible();return round(page);}
test('Swapped normal identity pages generate stable fictional occupation, discard originals and never transmit or persist them',async({page},info)=>{
 const requests=[],errors=[];page.on('request',r=>requests.push({url:r.url(),method:r.method(),body:r.postData()}));page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/identity/login/');await expect(page.getByRole('heading',{name:'创建账户'})).toBeVisible();await expect(page.locator('.form-bottom')).toHaveText('没有账户？ 登录');
 expect(await page.locator('#fiction-form [name]').count()).toBe(0);await page.locator('#fiction-email').fill('A1!@example.invalid');await expect(page.locator('#email-strength')).toHaveText('强');
 const initial=await occupy(page);expect(initial.name).toMatch(/^ocv_[a-f0-9]{8}$/);expect(initial.password).toMatch(/^Ocv!/);await expect(page.locator('#fiction-password')).toHaveValue('');await expect(page.locator('#fiction-name')).toHaveValue('');
 await expect(page.locator('#name-occupied')).toContainText('@example.invalid');await expect(page.locator('#name-occupied')).toContainText(initial.password);await expect(page.locator('#password-occupied')).toContainText('占用用户');await expect(page.locator('#gender-occupied')).toContainText('被占用');await expect(page.locator('#confirm-error')).toContainText('不一致');await expect(page.locator('#captcha-error')).toContainText('敏感词');
 await page.locator('#fiction-name').fill('different');await page.locator('#fiction-password').fill('wrong-again');await page.locator('#identity-submit').click();expect(await round(page)).toEqual(initial);
 await page.reload();expect(await round(page)).toEqual(initial);await expect(page.locator('#human-state')).toHaveText('验证就绪');
 const stored=await page.evaluate(()=>JSON.stringify({session:{...sessionStorage},local:{...localStorage}}));expect(stored).not.toContain('OriginalCanary');expect(stored).not.toContain('only-in-this-page');expect(stored).not.toContain(initial.password);
 expect(requests.every(r=>r.method==='GET'&&!/OriginalCanary|only-in-this-page|fiction-probe/.test(r.url+(r.body||'')))).toBe(true);expect(requests.every(r=>new URL(r.url).origin===new URL(page.url()).origin)).toBe(true);expect(errors).toEqual([]);
 await page.screenshot({path:path.join(reports,`phase4-${info.project.name}-identity.png`),fullPage:true});
 await page.locator('.form-bottom a').click();await expect(page.getByRole('heading',{name:'欢迎回来'})).toBeVisible();await expect(page.locator('.form-bottom')).toHaveText('已有账户？ 注册');
});
test('Manually retyping the generated pair completes entry, persists only fictional identity, refresh/back and logout work',async({page},info)=>{
 await page.goto('/identity/login/');const generated=await occupy(page);
 await page.locator('#fiction-name').fill(generated.name);await page.locator('#fiction-password').fill(generated.password);await page.locator('#fiction-password').press('Enter');await expect(page).toHaveURL(/\/#systems$/);
 await expect(page.locator('[data-fiction-badge]')).toHaveText(generated.name);await expect(page.locator('[data-fiction-badge]')).toHaveAttribute('title',/自动进行了合并/);
 const stored=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('ocv:fiction-identity:v1')));expect(stored.kind).toBe('fictional');expect(stored.name).toBe(generated.name);expect(stored).not.toHaveProperty('password');
 await page.reload();await expect(page.locator('[data-fiction-badge]')).toHaveText(generated.name);
 await page.locator('.portal-nav-bar').getByRole('link',{name:'全部功能',exact:true}).click();await expect(page.getByRole('heading',{name:'新版统一门户'})).toBeVisible();await expect(page.locator('[data-fiction-badge]')).toHaveText(generated.name);
 await page.goBack();await expect(page).toHaveURL(/\/#systems$/);if(info.project.name==='mobile'){await page.locator('[data-fiction-out]').focus();await page.keyboard.press('Enter');}else await page.locator('[data-fiction-out]').click();await expect(page.locator('[data-fiction-badge]')).toHaveText('');expect(await page.evaluate(()=>sessionStorage.getItem('ocv:fiction-identity:v1'))).toBeNull();
});
test('Temporary card and helpers are absent; inline occupation and manual entry work despite fake verification',async({page})=>{
 await page.goto('/identity/register/');const generated=await occupy(page);
 await expect(page.locator('#round-credentials,#round-new,#round-copy,#round-fill,#round-note')).toHaveCount(0);
 await expect(page.locator('#name-occupied #round-name')).toHaveText(generated.name);await expect(page.locator('#name-occupied #round-password')).toHaveText(generated.password);
 await page.locator('#fiction-name').fill(generated.name);await page.locator('#fiction-password').fill(generated.password);
 await expect(page.locator('#fiction-confirm')).toHaveValue('');await page.locator('#fiction-captcha').fill('');
 await page.locator('#identity-submit').click();await expect(page).toHaveURL(/\/#systems$/);await expect(page.locator('[data-fiction-badge]')).toHaveText(generated.name);
});
test('Identity works with storage unavailable and reduced motion; disabled JS cannot submit input through native forms',async({page,browser,baseURL})=>{
 await page.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('unavailable');};Storage.prototype.setItem=()=>{throw Error('unavailable');};});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/identity/login/');const fake=await occupy(page);
 expect(await page.locator('.captcha-loader').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');await page.locator('#fiction-name').fill(fake.name);await page.locator('#fiction-password').fill(fake.password);await page.locator('#identity-submit').click();await expect(page).toHaveURL(/\/#systems$/);
 const context=await browser.newContext({javaScriptEnabled:false,baseURL}),bare=await context.newPage(),requests=[];bare.on('request',r=>requests.push(r.url()));await bare.goto('/identity/login/');await expect(bare.getByRole('heading',{name:'创建账户'})).toBeVisible();expect(await bare.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')).toContain("form-action 'none'");await bare.locator('#fiction-password').fill('NoJsCanary!77');await bare.locator('#identity-submit').click();await bare.locator('#fiction-password').press('Enter');await bare.waitForTimeout(200);expect(requests.some(url=>url.includes('NoJsCanary'))).toBe(false);await expect(bare).toHaveURL(/\/identity\/login\/$/);await context.close();
});
test('Classic home keeps its layers while entries vary, recommendations use name length and overflow stays local',async({page},info)=>{
 await page.goto('/');await expect(page.locator('.wrong-windows')).toHaveAttribute('inert','');await enterHome(page);
 await expect(page.locator('.portal-nav-bar')).toBeVisible();await expect(page.locator('.window-ghost')).toBeAttached();await expect(page.locator('.maintenance-fragments')).toBeAttached();await expect(page.locator('#optical-field')).toBeAttached();await expect(page.locator('#reactor-field')).toBeAttached();
 const rec=await page.locator('.portal-recommend a').allTextContents(),lengths=rec.map(t=>Array.from(t).length);expect(lengths).toEqual([...lengths].sort((a,b)=>a-b));
 const spill=await page.locator('.portal-spill').evaluate(el=>el.scrollWidth-el.clientWidth);expect(spill).toBeGreaterThanOrEqual(20);expect(spill).toBeLessThanOrEqual(40);
 const positions=[];for(let i=0;i<4;i++){positions.push(await page.locator('.portal-weather,.portal-news,.portal-login-card').evaluateAll(nodes=>nodes.map(n=>n.style.top)));await page.reload();await enterHome(page);}expect(positions.every(v=>new Set(v).size===3)).toBe(true);
 await page.screenshot({path:path.join(reports,`phase4-${info.project.name}-home.png`)});
 await activate(page,page.locator('.portal-nav-bar').getByRole('link',{name:'登录',exact:true}),info);await expect(page.getByRole('heading',{name:'创建账户'})).toBeVisible();
});
test('Feature search has real links, odd explanation first, permanent advice, no microphone request and safe query restoration',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/portals/unified/');await page.locator('#portal-search').fill('图片压缩');await page.locator('#portal-search').press('Enter');
 await expect(page.locator('.search-result').first()).toContainText('关于图片压缩功能搜索结果的说明');await expect(page.locator('.search-result a').first()).toHaveAttribute('href','/functions/image-compress/#search-notice');await expect(page.locator('.search-advice')).toHaveText('您可能不需要搜索这个');
 const compressionResult=page.locator('.search-results').getByRole('link',{name:'图片压缩',exact:true});await expect(compressionResult).toHaveCount(1);await expect(compressionResult).toHaveAttribute('href','/functions/image-compress/');
 await activate(page,compressionResult,info);await expect(page.getByRole('heading',{name:'图片压缩'})).toBeVisible();await expect(page.locator('#tool-form')).toBeAttached();await expect(page.locator('#tool-form [name=file]')).toBeAttached();await expect(page.getByText('尚未开放',{exact:true})).toHaveCount(0);await page.goBack();await expect(page.locator('#portal-search')).toHaveValue('图片压缩');await expect(page.locator('.search-result')).toHaveCount(2);
 await activate(page,page.locator('[data-voice]'),info);await expect(page.locator('.voice-note')).toHaveText('当前环境过于安静，语音功能暂不可用');
 await page.locator('#portal-search').fill('缓存');await page.locator('#portal-search').press('Enter');await expect(page.locator('.search-result a').first()).toHaveAttribute('href','/maze/cache/');
 await page.locator('#portal-search').fill('<img src=x onerror="window.pwned=1">');await page.locator('#portal-search').press('Enter');await expect(page.locator('.search-advice')).toBeVisible();await expect(page.locator('.search-empty')).toHaveText('没有结果');expect(await page.evaluate(()=>window.pwned)).toBeUndefined();await expect(page.locator('.search-results img')).toHaveCount(0);await page.reload();await expect(page.locator('#portal-search')).toHaveValue('<img src=x onerror="window.pwned=1">');expect(errors).toEqual([]);
 await page.screenshot({path:path.join(reports,`phase4-${info.project.name}-search.png`)});
});
test('Three portals are distinct real pages; light version actually transfers the most JS and all its framework islands work',async({browser,baseURL},info)=>{
 const proof=[];for(const [name,url] of [['classic','/'],['unified','/portals/unified/'],['light','/portals/light/']]){
  const context=await browser.newContext({baseURL,viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
  if(name==='classic')await expect.poll(()=>page.evaluate(()=>window.__ocvReactor?.renderer)).toBe('three-webgl2');
  if(name==='light'){await expect(page.locator('.light-islands astro-island[ssr]')).toHaveCount(0);await page.getByRole('button',{name:'领票',exact:true}).click();await expect(page.getByTestId('pinia-count')).toContainText('1 张');await page.getByRole('button',{name:'再停一次'}).click();await expect(page.getByTestId('svelte-count')).toHaveText('1');await page.getByRole('button',{name:'翻面',exact:true}).click();await expect(page.getByTestId('solid-word')).toHaveText('不在。');await expect.poll(()=>page.evaluate(()=>window.__ocvLight?.frames)).toBeGreaterThan(0);}
  await page.waitForTimeout(400);const assets=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/\.m?js(?:\?|$)/.test(r.name)).map(r=>({url:new URL(r.name).pathname,bytes:r.decodedBodySize})));proof.push({name,assets,bytes:assets.reduce((n,r)=>n+r.bytes,0),errors});expect(errors).toEqual([]);await page.screenshot({path:path.join(reports,`phase4-${info.project.name}-${name}-portal.png`)});await context.close();
 }
 expect(proof[2].bytes).toBeGreaterThan(proof[0].bytes);expect(proof[2].bytes).toBeGreaterThan(proof[1].bytes);fs.writeFileSync(path.join(reports,`phase4-${info.project.name}-js-size.json`),JSON.stringify(proof,null,2));
});
