import {chromium,devices} from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
const reports=process.env.OCV_DEPS_ROOT?path.join(process.env.OCV_DEPS_ROOT,'runtime/reports'):path.resolve('.test-results');
const browser=await chromium.launch();
try{
 const page=await browser.newPage({...devices['Pixel 7']});
 await page.goto((process.env.OCV_BASE_URL||'http://127.0.0.1:8080')+'/maze/');
 const proof=await page.evaluate(()=>{const e=document.querySelector('.maze-exit'),r=e.getBoundingClientRect(),s=getComputedStyle(e),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {inner:[innerWidth,innerHeight],visual:[visualViewport.width,visualViewport.height,visualViewport.scale],scroll:[scrollX,scrollY],rect:r.toJSON(),exitCSS:{position:s.position,zIndex:s.zIndex,pointer:s.pointerEvents,translate:s.translate,transform:s.transform},hit:hit?.outerHTML.slice(0,250),mainCSS:{zIndex:getComputedStyle(document.querySelector('main')).zIndex,isolation:getComputedStyle(document.querySelector('main')).isolation},meta:document.querySelector('meta[name=viewport]')?.content};});
 await page.screenshot({path:path.join(reports,'maze-mobile-inspect.png')});fs.writeFileSync(path.join(reports,'maze-inspect.json'),JSON.stringify(proof,null,2));console.log(proof);
}finally{await browser.close();}
