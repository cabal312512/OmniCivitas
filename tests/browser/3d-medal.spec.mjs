import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {reports} from './report-location.mjs';
import {MEDAL_KEY,TROPHY_ID} from '../../config/apps/portal/src/3d/medal.mjs';

const state=page=>page.evaluate(()=>window.__ocvAeroMedal?.snapshot());
const proof=(name,value)=>fs.writeFileSync(path.join(reports,`3d-medal-${name}.json`),JSON.stringify(value,null,2));
const selectors={open:'[data-aero-medal-open]',dialog:'[data-aero-medal-dialog]',art:'[data-aero-medal-art]',download:'[data-aero-medal-download]',empty:'[data-aero-medal-empty]',close:'[data-aero-medal-close]'};

async function enterHome(page){
 await page.goto('/');await expect.poll(()=>state(page),{timeout:30000}).toBeTruthy();
 await expect(page.locator('body')).toHaveAttribute('data-cover','true');
 await expect(page.locator(selectors.open)).toBeHidden();await expect(page.locator(selectors.dialog)).toBeHidden();
 expect(await state(page)).toMatchObject({earned:false,covered:true,open:false});
 await page.locator('#main-identity').click();
 await expect(page.locator('body')).toHaveAttribute('data-cover','false',{timeout:30000});
 await expect(page.locator(selectors.open)).toBeVisible();expect((await state(page)).covered).toBe(false);
}

async function expectLockedDialog(page){
 await page.locator(selectors.open).click();await expect(page.locator(selectors.dialog)).toBeVisible();
 await expect(page.locator(selectors.empty)).toHaveText('尚未获得');await expect(page.locator(selectors.empty)).toBeVisible();
 await expect(page.locator(selectors.art)).toBeHidden();await expect(page.locator(selectors.download)).toBeHidden();
 expect(await state(page)).toMatchObject({earned:false,open:true});
}

test('A fresh homepage keeps the medal out of the cover and native activation only shows a locked reward',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await enterHome(page);expect(await page.evaluate(key=>localStorage.getItem(key),MEDAL_KEY)).toBeNull();
 await expectLockedDialog(page);const opened=await state(page);
 await page.screenshot({path:path.join(reports,'3d-medal-locked-home.png')});
 await page.locator(selectors.close).click();await expect(page.locator(selectors.dialog)).toBeHidden();
 await expectLockedDialog(page);await page.keyboard.press('Escape');await expect(page.locator(selectors.dialog)).toBeHidden();
 await expectLockedDialog(page);const box=await page.locator(selectors.dialog).boundingBox();expect(box.x).toBeGreaterThan(15);expect(box.y).toBeGreaterThan(15);
 await page.mouse.click(8,8);await expect(page.locator(selectors.dialog)).toBeHidden();
 const closed=await state(page);expect(closed).toMatchObject({earned:false,open:false,writes:0});expect(errors).toEqual([]);
 expect(await page.evaluate(key=>localStorage.getItem(key),MEDAL_KEY)).toBeNull();
 proof('native-locked',{opened,closed,errors,claim:'Native logo click enters the homepage. Native medal click, close button, Escape and backdrop click exercise the real dialog. No valid reward record or game progress is injected.'});
});

test('Injected SecurityError storage refusal keeps native homepage medal controls working without an earned claim',async({browser,baseURL})=>{
 test.setTimeout(120000);const results=[];
 for(const mode of ['property','methods']){
  const context=await browser.newContext({baseURL,viewport:{width:1440,height:1000}});
  try{
   await context.addInitScript(mode=>{
    const calls=window.__medalStorageRefusal={property:0,get:0,set:0};
    const fail=method=>{calls[method]++;throw new DOMException('Storage unavailable in the test environment','SecurityError');};
    if(mode==='property')Object.defineProperty(window,'localStorage',{configurable:true,get:()=>fail('property')});
    else Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:()=>fail('get'),setItem:()=>fail('set'),removeItem:()=>fail('set'),clear:()=>fail('set'),key:()=>null,length:0}});
   },mode);
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await enterHome(page);await expectLockedDialog(page);const opened=await state(page);expect(opened).toMatchObject({status:'memory',persistent:false,earned:false,writes:0});
   await page.locator(selectors.close).click();await expect(page.locator(selectors.dialog)).toBeHidden();
   await expectLockedDialog(page);await page.keyboard.press('Escape');await expect(page.locator(selectors.dialog)).toBeHidden();
   const refusal=await page.evaluate(()=>{
    const observed={};for(const method of ['getItem','setItem'])try{localStorage[method]('ocv.test.refused-medal',method==='setItem'?'unused':undefined);observed[method]='unexpected success';}catch(error){observed[method]=error.name;}
    return {observed,calls:{...window.__medalStorageRefusal}};
   });
   expect(refusal.observed).toEqual({getItem:'SecurityError',setItem:'SecurityError'});
   if(mode==='property')expect(refusal.calls.property).toBeGreaterThan(2);else{expect(refusal.calls.get).toBeGreaterThan(0);expect(refusal.calls.set).toBeGreaterThan(0);}
   expect(await state(page)).toMatchObject({earned:false,open:false,persistent:false,writes:0});expect(errors).toEqual([]);
   results.push({mode,opened,closed:await state(page),refusal,errors});
  }finally{await context.close();}
 }
 proof('refused-storage',{results,claim:'The test environment deliberately throws native DOMException SecurityError from localStorage access or getItem/setItem. Native homepage activation and closing still work; the explicit storage probes confirm refusal only and never create an award. This is not a real browser privacy-policy or actual boss-completion test.'});
});

test('Broken oversized and unknown-version medal storage never displays or downloads an award',async({browser,baseURL})=>{
 test.setTimeout(180000);const results=[];
 const samples=[{kind:'broken-json',raw:'{'},{kind:'oversized',raw:' '.repeat(2048)},{kind:'future-version',raw:JSON.stringify({version:2,trophyId:TROPHY_ID,earnedAt:1791014400000})},{kind:'unknown-trophy',raw:JSON.stringify({version:1,trophyId:'unknown.reward',earnedAt:1791014400000})}];
 for(const sample of samples){
  const context=await browser.newContext({baseURL,viewport:{width:1440,height:1000}});
  try{
   await context.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key:MEDAL_KEY,raw:sample.raw});
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await enterHome(page);await expectLockedDialog(page);const opened=await state(page);
   expect(opened).toMatchObject({status:'invalid',earned:false,persistent:false,writes:0});
   await page.locator(selectors.close).click();await expect(page.locator(selectors.dialog)).toBeHidden();
   expect(await page.evaluate(key=>localStorage.getItem(key),MEDAL_KEY)).toBe(sample.raw);expect(errors).toEqual([]);
   results.push({kind:sample.kind,bytes:sample.raw.length,opened,closed:await state(page),errors});
  }finally{await context.close();}
 }
 proof('invalid-records',{results,claim:'Only invalid records are supplied by the harness. No legitimate earned medal, boss death or checkpoint is injected, and the application neither displays an award nor replaces damaged data with a fabricated reward.'});
});
