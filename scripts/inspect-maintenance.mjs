import {chromium} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const base=process.env.OCV_BASE_URL||'http://127.0.0.1:8080';
const reports=process.env.OCV_DEPS_ROOT?path.join(process.env.OCV_DEPS_ROOT,'runtime/reports'):path.resolve('.test-results');
fs.mkdirSync(reports,{recursive:true});
const browser=await chromium.launch();
const results=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/');
 assert.equal(await page.locator('.wrong-windows').getAttribute('inert'),'');
 assert.equal(await page.locator('.wrong-windows').evaluate(el=>getComputedStyle(el).opacity),'0');
 await page.screenshot({path:path.join(reports,'maintenance-cover.png')});
 await page.getByRole('link',{name:'进入主页',exact:true}).click();
 await page.waitForFunction(()=>window.__ocvReactor?.frames>1,{},{timeout:30000});
 for(const [name,url] of [['home',null],['settings','/maze/offices/settings/'],['cache','/maze/cache/'],['table','/maze/table/']]){
  if(url)await page.goto(base+url);
  await page.waitForTimeout(300);
  const actual=await page.evaluate(()=>{
   const nodes=[...document.querySelectorAll('.wrong-window,.maze-panel')];
   const panels=nodes.map(el=>({class:el.className,rotate:getComputedStyle(el).rotate,transform:getComputedStyle(el).transform}));
   const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
   const table=document.querySelector('.result-container'),row=table.querySelector('.result-body>a');
   const column=document.querySelector('.column-right');
   return {url:location.pathname,panels,fragments:document.querySelectorAll('.maintenance-fragments').length,unfinishedCells:document.querySelectorAll('.unfinished-cell').length,tableContainer:rect('.result-container'),tableRow:rect('.result-body>a'),actualTableOverflow:row.getBoundingClientRect().right>table.getBoundingClientRect().right,compressedSidebar:{height:column.clientHeight,contentHeight:column.scrollHeight},blankFrame:rect('.panel_v2'),oldRenderer:window.__ocvOptics?.renderer,newRenderer:window.__ocvReactor?.renderer};
  });
  fs.writeFileSync(path.join(reports,`maintenance-${name}-layout.json`),JSON.stringify(actual,null,2));
  assert.ok(actual.panels.every(p=>['0deg','none'].includes(p.rotate)&&p.transform==='none'),JSON.stringify(actual.panels));
  assert.equal(actual.fragments,1);assert.equal(actual.unfinishedCells,2);
  if(name!=='home')assert.equal(actual.actualTableOverflow,true);
  await page.screenshot({path:path.join(reports,`maintenance-${name}.png`)});
  results.push({name,...actual,screenshot:path.join(reports,`maintenance-${name}.png`)});
 }
 assert.equal(errors.length,0);
 fs.writeFileSync(path.join(reports,'maintenance-layout-proof.json'),JSON.stringify({results,errors},null,2));
 console.log('PASS: actual production UI keeps both optical layers, ordinary frames are upright, half-built frames and oversized rows are present; no page errors.');
}finally{await browser.close();}
