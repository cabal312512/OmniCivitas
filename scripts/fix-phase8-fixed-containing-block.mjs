import fs from 'node:fs';import assert from 'node:assert/strict';
const file='config/apps/portal/src/report/index.astro',s=fs.readFileSync(file,'utf8');
const before=`{id==='scroll'&&<><section class="acc-card"><button id="wrong-top">回到顶部</button>`;
assert.ok(s.includes(before));fs.writeFileSync(file,s.replace(before,`{id==='scroll'&&<><button id="wrong-top">回到顶部</button><section class="acc-card">`));
