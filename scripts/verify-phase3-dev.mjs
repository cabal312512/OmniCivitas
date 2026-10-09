import {chromium} from '@playwright/test';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {verificationConfig} from './verification-config.mjs';
const {baseUrl:base,reportRoot}=verificationConfig();const checks=[];
fs.mkdirSync(reportRoot,{recursive:true});
const check=(name,okay)=>{assert.ok(okay,name);checks.push(name);};
const browser=await chromium.launch({headless:true}),page=await browser.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(base,{timeout:60000});await page.locator('#storage-note').waitFor({timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#storage-note')?.textContent==='抽屉已打开');
 check('Standard pnpm dev serves real Astro with browser storage',await page.locator('#storage-note').textContent()==='抽屉已打开');
 check('i18next actually renders Chinese from modular catalog',await page.locator('#translated-note').textContent()==='补票不用注册。');
 check('vue-i18n actually renders its independent Chinese catalog',(await page.locator('.vue-caption').textContent()).includes('食堂补票处'));
 await page.getByLabel('票名').fill('本地晚饭');await page.getByRole('button',{name:'领票',exact:true}).click();
 check('Vue island actually hydrates in native dev',(await page.getByTestId('pinia-count').textContent()).includes('1 张 · 本地晚饭'));
 await page.getByLabel('虚构文明名称').fill('原生有限内存演示');await page.getByLabel('虚构文明名称').press('Enter');await page.waitForFunction(()=>document.querySelector('#record-output')?.textContent.includes('bounded-memory-demonstration'));
 check('Native dev labels bounded memory truthfully rather than PostgreSQL',JSON.parse(await page.locator('#record-output').textContent()).storage==='bounded-memory-demonstration');
 await page.goto(base+'/borrowed',{timeout:90000});await page.getByTestId('redux-count').waitFor({timeout:60000});await page.getByRole('button',{name:'领一个号',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-testid="redux-count"]')?.textContent==='1');
 check('Standard dev proxies genuine Next app and React state',await page.getByTestId('redux-count').textContent()==='1');
 await page.frameLocator('iframe[title="审核小窗"]').locator('#angular-booleans').waitFor();
 check('Native dev serves actual independently built Angular iframe',await page.frameLocator('iframe[title="审核小窗"]').locator('#angular-booleans').textContent()==='看过：false；就绪：false');
 const response=await page.request.get(base+'/api/auth/login');check('Native dev does not mount account routes',response.status()===404);
 check('Dev Astro/Next hydration has no browser errors',errors.length===0);
 fs.writeFileSync(path.join(reportRoot,'phase3-dev.json'),JSON.stringify({status:'passed',updatedAt:new Date().toISOString(),base,checks,mode:'Actual standard pnpm dev, optional runtime configuration supplies local cache paths; no database claim.',browser:await browser.version()},null,2));
 console.log('PASS: '+checks.length+' native pnpm dev checks.');
}finally{await browser.close();}
