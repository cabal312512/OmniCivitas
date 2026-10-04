import {chromium} from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.OCV_BASE_URL||'http://127.0.0.1:8080';
const reports=process.env.OCV_DEPS_ROOT?path.join(process.env.OCV_DEPS_ROOT,'runtime/reports'):path.resolve('.test-results');
const html=await(await fetch(base+'/')).text();const url=[...html.matchAll(/<script[^>]+src="([^"]+)"/g)][0][1];
const code=await(await fetch(new URL(url,base))).text();assert.ok(code.includes('three.js authors')&&code.includes('GreenSock. All rights reserved.'));
const browser=await chromium.launch();
try{const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/#systems');await page.waitForFunction(()=>window.__ocvReactor?.frames>1,{},{timeout:30000});const renderer=await page.evaluate(()=>({current:window.__ocvReactor.renderer,previous:window.__ocvOptics.renderer,frames:window.__ocvReactor.frames,gpuError:window.__ocvReactor.gpuError}));assert.equal(renderer.current,'three-webgl2');assert.equal(renderer.previous,'webgl');assert.equal(renderer.gpuError,0);assert.equal(errors.length,0);fs.writeFileSync(path.join(reports,'reactor-notices-smoke.json'),JSON.stringify({bundle:url,noticesPreserved:true,errors,renderer},null,2));console.log('PASS: emitted copyright notices preserved and latest browser bundle still executes both GPU layers without page errors.');}finally{await browser.close();}
