import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {currentPath} from './current-paths.mjs';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,'')),write=(f,x)=>fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n'),sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const mapping=read('docs/naming-paths.json'),ledger=read('docs/requirements.json'),technology=read('docs/technologies.json'),state=read('docs/phase-state.json');
assert.equal(state.phase,8);assert.equal(state.status,'complete');assert.equal(state.nextPhaseAuthorized,false);
assert.notEqual(state.namingRevision?.status,'complete','Naming revision already accepted; do not reset its records.');
for(const r of mapping.originalSources)assert.equal(sha(r.file),r.sha256);
const immutable=ledger.requirements.map(({id,text,sourceLine,source,phase,status})=>({id,text,sourceLine,source,phase,status}));
for(const row of ledger.requirements)row.implementation=row.implementation.map(currentPath);
for(const row of technology.technologies)row.implementation=row.implementation.map(currentPath);
assert.deepEqual(ledger.requirements.map(({id,text,sourceLine,source,phase,status})=>({id,text,sourceLine,source,phase,status})),immutable);
ledger.currentNamingRevision={revision:'names-1',scope:'Physical names and references only; original requirement text and historical acceptance preserved.',paths:'docs/naming-paths.json',acceptance:'docs/naming-acceptance.json'};
technology.currentNamingRevision=ledger.currentNamingRevision;
write('docs/requirements.json',ledger);write('docs/technologies.json',technology);
const screenshots=read('docs/screenshot-requirements.json');
for(const row of screenshots.requirements)row.implementation=row.implementation.map(currentPath);
write('docs/screenshot-requirements.json',screenshots);
// These are current source-asset locators, not acceptance snapshots.
for(const file of ['docs/user-supplied-assets.json','docs/phase-8-direct-licenses.json']){
 const data=read(file);const walk=x=>{if(Array.isArray(x))return x.map(walk);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,k==='file'&&typeof v==='string'?currentPath(v):walk(v)]));return x;};write(file,walk(data));
}
const escape=v=>String(v).replaceAll('|','\\|').replaceAll('\n','<br>');
const table=fs.readFileSync('docs/REQUIREMENTS.md','utf8').replace(/\r\n/g,'\n'),anchor='| ID | 原文行 | 阶段 | 状态 | 原始要求 | 实现 / 验证 |',at=table.indexOf(anchor);assert.ok(at>=0);
fs.writeFileSync('docs/REQUIREMENTS.md',table.slice(0,at)+[anchor,'| --- | --- | --- | --- | --- | --- |',...ledger.requirements.map(r=>`| ${r.id} | ${r.sourceLine} | ${r.phase} | ${r.status} | ${escape(r.text)} | ${[...r.implementation,...r.verification].map(escape).join('<br>')} |`)].join('\n')+'\n');
state.namingRevision={revision:'names-1',status:'validating',requestedBy:'User: 文件夹和文件的名字也都大改一下；不仅提到的其他也多改一点',paths:'docs/naming-paths.json',nextPhaseAuthorized:false};write('docs/phase-state.json',state);
const examples=[['config/apps/portal','Astro 主应用'],['config/apps/web2','Next 应用'],['config/apps/ng','Angular 应用'],['pcakage/comon','共享类型'],['pcakage/build2','Gulp/Babel/Webpack 与局部检查'],['pinia/p.mjs','匿名页面里程模型及浏览器状态'],['config/apps/portal/src/aaa','主页光场、反应堆、叠窗和迷宫'],['config/apps/portal/src/report','18 个事故页面及模型/成就'],['config/apps/portal/src/tool','101 工具目录与执行器'],['config/apps/portal/src/δοκιμή','科学模型与界面'],['services/archive/src/api/main.mjs','Hono/多协议入口'],['historical/旧业务','原创停用业务'],['historical/front_old','旧前端快照'],['historical/luminous','上一版光效源码'],['historical/phase4_临时信息窗已停用','保留原名的停用身份窗']];
const note='# 命名调整 / names-1\n\n用户授权的命名调整，属于第八阶段之后的局部修订，第九阶段未开始。去掉解释笑点的文件名，改用短名、备份名、拼错和不一致的存放位置。源码及配置在项目内；现有依赖、缓存和备份仍在本地依赖根，没有新增依赖。\n\n正常入口仍是 pnpm install、pnpm dev、pnpm build 和 docker compose up。工作区、Docker COPY/CMD、相对引用、Vue/Svelte/Solid 入口、TS/JS、CSS、worker、测试和当前需求账本的实现位置一并调整。package.json、page.tsx、layout.tsx、Prisma 已应用的真实时间戳迁移等约定文件名保留。\n\n## 当前文件地图\n\n| 位置 | 作用 |\n| --- | --- |\n'+examples.map(([p,d])=>`| ${p} | ${d} |`).join('\n')+'\n\n## 路径转换\n\n旧验收报告的 JSON/Markdown 保留原字节，里面的旧路径是当时的记录，不要替换旧 hash 或冒充新证明。读取旧记录时可调用 scripts/current-paths.mjs 的 currentPath。naming-paths.json 记录逐文件前后 hash 和明确路径对照；本次真实验证单独写 naming-acceptance.json。原 732 条文字、行号、阶段和状态不因改名而改变。原文提到的 login_2019_backup.js 现为 login_bak.js，遵从此次用户命名要求，调用顺序与逻辑保留。\n\n| 原位置 | 当前位置 |\n| --- | --- |\n'+mapping.pairs.map(r=>`| ${r.before} | ${r.after} |`).join('\n')+'\n\nrename-workspace.mjs 和 finish-name-paths.mjs 是本次一次性迁移记录，不属于安装/启动步骤，不要对已迁移目录再执行。第九阶段仍需完整独立审计、完整栈按需实测和公开部署审计。\n';
fs.writeFileSync('docs/NAMING-REVISION.md',note);
const section='<!-- names-current-start -->\n本次用户授权命名大改，当前验证中。apps 已移入 config/apps，packages 改为 pcakage，里程模型放在根目录 pinia；详细文件地图和 118 项路径转换见 docs/NAMING-REVISION.md / naming-paths.json。下方阶段记录说明此前实现与证据，当前物理路径以新地图为准。第九阶段未授权。\n<!-- names-current-end -->\n\n';
for(const file of ['docs/HANDOFF.md','docs/PROGRESS.md','docs/DECISIONS.md']){let text=fs.readFileSync(file,'utf8');if(text.includes('<!-- names-current-start -->'))text=text.replace(/<!-- names-current-start -->[\s\S]*?<!-- names-current-end -->\s*/,section);else text=text.replace(/^(# [^\n]+\n)\s*/,'$1\n'+section);fs.writeFileSync(file,text);}
console.log('Current implementation/asset locators and handoff updated; original numbered text and prior acceptance snapshots retained.');
