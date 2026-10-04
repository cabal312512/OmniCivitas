import fs from 'node:fs';import assert from 'node:assert/strict';
const model='config/apps/portal/src/report/price.mjs',s=fs.readFileSync(model,'utf8');assert.ok(s.includes('Array.from({length:12},(_,i)=>'));fs.writeFileSync(model,s.replace('Array.from({length:12},(_,i)=>','Array.from({length:16},(_,i)=>'));
const test='tests/browser/phase8.spec.mjs',t=fs.readFileSync(test,'utf8');assert.ok(t.includes('expect(copied.length).toBeGreaterThan(300);'));fs.writeFileSync(test,t.replace('expect(copied.length).toBeGreaterThan(300);','expect(copied.length).toBeGreaterThan(visible.length*10);'));
