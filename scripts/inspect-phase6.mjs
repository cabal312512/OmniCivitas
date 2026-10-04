import {chromium} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {reports} from '../tests/browser/report-location.mjs';

const baseURL=process.env.OCV_BASE_URL||'http://127.0.0.1:8080';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',baseURL});
const observations=[];
try{
  const page=await context.newPage();
  page.setDefaultTimeout(60000);
  for(const id of ['directory','image-crop','countdown','orbit']){
    const errors=[],handler=error=>errors.push(error.message);
    page.on('pageerror',handler);
    const response=await page.goto(id==='directory'?'/functions/':`/functions/${id}/`);
    if(response.status()!==200)throw Error(`${id}: HTTP ${response.status()}`);
    if(id==='directory')await page.locator('a[href="/functions/orbit/"]').first().waitFor();
    else{
      await page.waitForFunction(id=>window.__ocvTools?.id===id,id);
      await page.locator('[data-tool-front]').focus();await page.keyboard.press('Enter');
      await page.locator('#tool-run').focus();await page.keyboard.press('Enter');
      await page.waitForFunction(()=>window.__ocvTools.successes===1&&!window.__ocvTools.busy);
    }
    const filename=path.join(reports,`${id}.png`);
    await page.screenshot({path:filename,fullPage:true});
    const record=await page.evaluate(()=>({
      title:document.title,
      diagnostic:window.__ocvTools||null,
      status:document.querySelector('#tool-status')?.textContent||null,
      labElements:document.querySelector('#tool-lab')?.childElementCount||0,
      cropperContainers:document.querySelectorAll('.cropper-container').length,
      orbitDiagrams:document.querySelectorAll('[data-orbit-diagram]').length,
      clockState:document.querySelector('[data-clock-state]')?.dataset.clockState||null,
      directoryLinks:Array.from(document.querySelectorAll('a[href^="/functions/"]')).length,
    }));
    observations.push({id,url:page.url(),filename,errors,...record});
    page.off('pageerror',handler);
    if(errors.length)throw Error(`${id}: ${errors.join('; ')}`);
  }
  fs.writeFileSync(path.join(reports,'observations.json'),JSON.stringify(observations,null,2));
  console.log(JSON.stringify(observations,null,2));
}finally{await context.close();await browser.close();}
