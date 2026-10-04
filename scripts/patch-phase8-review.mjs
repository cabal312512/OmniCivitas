import fs from 'node:fs';import assert from 'node:assert/strict';
function edit(file,from,to){let s=fs.readFileSync(file,'utf8');assert.ok(s.includes(from),file+' missing edit target');fs.writeFileSync(file,s.replace(from,to));}
const ui='config/apps/portal/src/report/index.astro';
edit(ui,'<span id="notification-count">1+</span>','<output id="closed-windows">0</output><span id="notification-count">1+</span>');
edit(ui,'<p>由于系统性能较高，部分功能可能表现为缓慢。</p>','<p id="reading-line">由于系统性能较高，部分功能可能表现为缓慢。</p><output id="reading-seconds">0 秒</output>');
const code='config/apps/portal/src/report/report.js';
edit(code,"if(floor==='layout'){","if(floor==='layout'){\n let closedWindows=Number($('#closed-windows').textContent)||0;");
edit(code,".close();award('closed');", ".close();text('#closed-windows',++closedWindows);award('closed');");
edit(code,"messages%3===0?", "messages%MAKEUP_EXAM_ATTEMPTS===0?");
edit(code,"if(floor==='announcements'){let version=1;",`if(floor==='announcements'){
 let reading=false,last=performance.now(),elapsed=0;
 const observer=new IntersectionObserver(entries=>{reading=Boolean(entries[0]?.isIntersecting);last=performance.now();});observer.observe($('#reading-line'));
 repeat(500,()=>{const now=performance.now();if(reading&&!document.hidden)elapsed+=Math.min(1000,now-last);last=now;text('#reading-seconds',(elapsed/1000).toFixed(1)+' 秒');});
 on(document,'visibilitychange',()=>{last=performance.now();});on(window,'pagehide',()=>observer.disconnect());
 let version=1;`);
const css='config/apps/portal/src/report/2.css';
fs.appendFileSync(css,'\n.support-card{position:fixed;right:28px;bottom:84px;margin:0;width:340px;z-index:610}\n');
const test='tests/browser/phase8.spec.mjs';
edit(test,"await open(page,'announcements');const before=", "await page.clock.install();await open(page,'announcements');const before=");
edit(test,'await page.clock.install();await page.clock.fastForward(15000);','await page.clock.fastForward(15000);');
edit(test,"await act(page,'#local-config-set');await expect(page.locator('#configuration-sources')).toContainText('browserChoice');", "await page.locator('#local-config-value').focus();await page.keyboard.press('Home');for(let i=0;i<71;i++)await page.keyboard.press('ArrowRight');await act(page,'#local-config-set');await expect.poll(async()=>JSON.parse(await page.locator('#configuration-sources').textContent()).browserChoice).toBe(71);");
edit(test,"await act(page,'#tutorial-next');await expect(page.locator('#tutorial-step')).toHaveText('点击下一步');", "const mask=await page.locator('.tutorial-mask').boundingBox(),next=await page.locator('#tutorial-next').boundingBox();expect(Math.abs(mask.x-next.x)).toBeLessThan(1);expect(Math.abs(mask.y-next.y)).toBeLessThan(1);expect(Math.abs(mask.height-next.height/2)).toBeLessThan(1);await act(page,'#tutorial-next');await expect(page.locator('#tutorial-step')).toHaveText('点击下一步');");
console.log('Review fixes: native SVG hidden attribute, real old constant reuse, local display counters, lifecycle restart, and stronger native configuration/mask evidence.');
