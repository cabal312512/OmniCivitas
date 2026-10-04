import {chromium} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {reports} from '../tests/browser/report-location.mjs';
const baseURL=process.env.OCV_BASE_URL||'http://127.0.0.1:8080';
fs.mkdirSync(reports,{recursive:true});
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',baseURL});
const observations=[];
try{const page=await context.newPage();page.setDefaultTimeout(60000);
 for(const id of ['directory','tic-tac-toe','loading-gallery','authoritative-number']){const errors=[],onError=e=>errors.push(e.message);page.on('pageerror',onError);const response=await page.goto(id==='directory'?'/functions/':`/functions/${id}/`);if(response.status()!==200)throw Error(id+' HTTP '+response.status());
  if(id!=='directory'){await page.waitForFunction(id=>window.__ocvTools?.id===id,id);await page.locator('[data-tool-front]').focus();await page.keyboard.press('Enter');await page.locator('#tool-run').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__ocvTools?.successes>0&&!window.__ocvTools.busy);}
  await page.screenshot({path:path.join(reports,id+'.png')});observations.push({id,url:page.url(),errors,file:id+'.png',controls:id==='directory'?await page.locator('.tool-group a').count():await page.locator('#tool-lab button').count()});if(errors.length)throw Error(errors.join('\n'));page.off('pageerror',onError);
 }
 fs.writeFileSync(path.join(reports,'observations.json'),JSON.stringify(observations,null,2));
}finally{await context.close();await browser.close();}
console.log(JSON.stringify(observations));
