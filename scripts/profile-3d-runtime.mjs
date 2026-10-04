// Optional hardware browser comparison; reads state and uses native controls only.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

const basename=process.argv[2]||'3d-performance';
assert.match(basename,/^3d[-a-z0-9]+$/);
const root=path.join(process.env.OCV_DEPS_ROOT,'runtime/reports',basename);
fs.mkdirSync(root,{recursive:true});
const base=process.env.OCV_BASE_URL||'http://127.0.0.1:8080';
const browser=await chromium.launch({channel:'chromium'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const live=()=>page.evaluate(()=>window.__ocv3D.tracking());
const wait=async predicate=>{const start=Date.now();while(!await predicate()){assert.ok(Date.now()-start<30000,'Native control did not reach the expected state');await page.waitForTimeout(50);}};
const report={at:new Date().toISOString(),baseURL:base,viewport:{width:1440,height:1000},sampleMs:12000,scenarios:[],errors};
async function sample(id){
 await page.waitForTimeout(2000);
 const measurement=await page.evaluate(()=>new Promise(resolve=>{
  const before=window.__ocv3D.tracking(),start=performance.now(),intervals=[];let previous=start;
  function read(now){intervals.push(now-previous);previous=now;if(now-start<12000){requestAnimationFrame(read);return;}
   const after=window.__ocv3D.tracking();resolve({elapsedMs:now-start,renderedFrames:after.frames-before.frames,frameIntervalsMs:intervals,before,after});}
  requestAnimationFrame(read);
 }));
 const world=await page.evaluate(()=>window.__ocv3D.snapshot()),sorted=measurement.frameIntervalsMs.slice(1).sort((a,b)=>a-b);
 const at=q=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*q))];
 const result={id,fps:measurement.renderedFrames*1000/measurement.elapsedMs,medianFrameMs:at(.5),p95FrameMs:at(.95),elapsedMs:measurement.elapsedMs,renderedFrames:measurement.renderedFrames,position:world.player,yaw:world.yaw,pitch:world.pitch,renderer:world.renderer,world:{buildings:world.world.buildings,cityDistricts:world.world.cityDistricts,activeChunks:world.world.activeChunks},raw:measurement.frameIntervalsMs};
 report.scenarios.push(result);await page.screenshot({path:path.join(root,id+'.png')});
 fs.writeFileSync(path.join(root,'measurement.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({id,fps:result.fps,medianFrameMs:result.medianFrameMs,p95FrameMs:result.p95FrameMs,calls:result.renderer.calls,triangles:result.renderer.triangles}));
}
try{
 await page.goto(new URL('/functions/3d-world/',base).href);
 await wait(()=>page.evaluate(()=>window.__ocv3D?.snapshot().mode==='webgl'));
 if(await page.locator('[data-music]').count()){await page.locator('[data-music]').focus();await page.locator('[data-music]').press('Enter');}
 report.hardware=await page.locator('#world').evaluate(canvas=>{const gl=canvas.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),drawingBuffer:{width:gl.drawingBufferWidth,height:gl.drawingBufferHeight},pixelRatio:devicePixelRatio};});
 await sample('avenue');
 await page.locator('#world').focus();await page.keyboard.down('KeyW');
 try{await wait(async()=>Math.abs((await live()).player.z-166)<7.5);}finally{await page.keyboard.up('KeyW');}
 const portals=await page.evaluate(()=>window.__ocv3D.snapshot().portals),last=portals.findIndex(p=>p.id==='capital');
 assert.ok(last>1);
 for(let step=1;step<=last;step++){
  if(step>1)await page.waitForTimeout(1300);
  await page.keyboard.press('KeyE');await wait(async()=>(await live()).warps===step);
  if(['city','horizon-city','capital'].includes(portals[step].id))await sample(portals[step].id);
 }
 assert.equal(errors.length,0);report.finishedAt=new Date().toISOString();report.status='complete';
 report.claim='Four fixed native portal views, same window and browser, 12-second steady samples after two-second warmups. RAF intervals and actual application render-frame deltas use wall-clock time; no position, camera, quality or combat state setters. Short samples do not establish sustained peak or minimum FPS.';
 fs.writeFileSync(path.join(root,'measurement.json'),JSON.stringify(report,null,2)+'\n');
}finally{await context.close();await browser.close();}
