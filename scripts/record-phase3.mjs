import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {dockerCall,composeCall} from './docker-child.mjs';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const save=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n');
const reports=path.join(process.env.OCV_DEPS_ROOT,'runtime/reports');
const report=name=>path.join(reports,name);
assert.equal(read('docs/phase-state.json').phase,3);assert.equal(read('docs/phase-state.json').status,'active');
const browser=read(report('phase3-playwright.json')),languageBrowser=read(report('phase3-language-playwright.json'));
assert.equal(browser.stats.expected,16);assert.equal(browser.stats.unexpected,0);assert.equal(browser.stats.flaky,0);
assert.equal(languageBrowser.stats.expected,2);assert.equal(languageBrowser.stats.unexpected,0);
const language=read(report('phase3-language-storage.json')),build=read(report('phase3-build-unit.json')),dev=read(report('phase3-dev.json')),regression=read(report('phase3-core-regression.json')),runtime=read(report('phase3-final-runtime.json'));
assert.equal(language.status,'passed');assert.equal(build.status,'passed');assert.equal(dev.status,'passed');assert.equal(runtime.status,'passed');assert.equal(regression.stats.expected,4);assert.equal(regression.stats.unexpected,0);
const ids=composeCall(['ps','-q']).stdout.trim().split(/\s+/).filter(Boolean);
const current=JSON.parse(dockerCall(['inspect',...ids]).stdout),names=current.map(c=>c.Config.Labels['com.docker.compose.service']).sort();
assert.deepEqual(names,['edge','gateway','next','portal','postgres','redis']);assert.ok(current.every(c=>c.State.Health.Status==='healthy'&&!c.State.OOMKilled));
const builder=JSON.parse(dockerCall(['inspect','buildx_buildkit_ocv-budget-builder0']).stdout)[0];assert.equal(builder.State.Running,false);
const physical=read(report('physical-paths.json'));for(const [name,p] of Object.entries(physical.paths))if(!['wslMaintenanceCache','wslConfig','dockerInstallSettings'].includes(name))assert.ok(p.physical.startsWith('\\\\?\\F:\\OCVdeps\\'),name);
const titles=[...new Set(browser.suites.flatMap(s=>s.specs||[]).map(s=>s.title))];assert.equal(titles.length,8);
function evidence(numbers){return numbers.map(n=>report('phase3-playwright.json')+' :: desktop + mobile :: '+titles[n-1]);}
const main='config/apps/portal/src/pages/index.astro',client='config/apps/portal/src/js/client.js',storage='config/apps/portal/src/js/db.mjs';
const vue='config/apps/portal/src/ui/饭票.vue',svelte='config/apps/portal/src/ui/停机表.svelte',solid='config/apps/portal/src/ui/main.tsx';
const react='config/apps/web2/tmp/index.tsx',angular='config/apps/ng/src/main.ts',api='config/apps/web2/app/next-api/receipt/route.ts';
const gateway='services/gateway/src/备份_别删/a_final.ts',java='services/spring/src/main/java/ocv/tmp/backup/Municipal.java';
const map=new Map(),range=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
function assign(numbers,files,tests,notes,extra=[]){for(const n of numbers){const id='A'+String(n).padStart(3,'0');assert.ok(!map.has(id),id);for(const f of files)assert.ok(fs.existsSync(f),f);map.set(id,{implementation:files,verification:[...evidence(tests),...extra],notes,status:'verified'});}}
assign([1,2],[main,react,vue,svelte,solid,angular,'infra/nginx/edge.conf'],[1,4,6,8],'同源同导航 Astro/Next 壳；独立 Angular 包在 React 小窗内实际运行，五框架各管一个区域。');
assign([3],[client],[1],'Lit 原生 custom element 实际 Shadow DOM 印章计数。');
assign([4],[main,client],[1],'Alpine 实际展开/收起，x-cloak 防初始闪烁。');
assign([5,47],[main,client,'services/gateway/src/main.ts'],[1],'htmx 自己取服务端 HTML 并真实替换公告。');
assign([6,46],[client],[1],'真实 $()、$.ajax()、show/hide；小型 Nest 请求与附件显示均已点按。');
assign([7],[client,vue],[1],'jQuery 只修改 Vue 展示文字/class/title；随后 Pinia 领票数据继续正确更新。');
assign([8,9],[react,angular],[6],'React iframe 实际 Angular 表单；五字段协议仅带两个业务布尔，严格 origin/source/token/type，伪造消息不改变状态。');
assign([10],[solid],[1],'两字翻面仍由完整 Solid createSignal 挂载。');
assign([11,12,13,14,18,19],[react],[4],'Redux 一个数字、Zustand 一布尔、MobX 一小对象、Jotai 一弹窗、RxJS 180ms 防抖、XState 两态均真实操作。');
assign([15],[vue],[1],'Pinia 更新票数/票名；无效输入不更新。');
assign([16],[svelte],[1],'Svelte writable store 实际计数并可归零。');
assign([17],[angular],[6],'Signals 实际保存签收数、显示及协议布尔。');
assign([20],[react],[4],'Redux stockTax.delivery_count / localStorage ocv_goods_delivery / query invoiceMood，参数优先并限 0–99，刷新/关闭路由后恢复已验证。');
assign([21],[react,client,storage],[2,4],'IndexedDB 主体、sessionStorage 虚构代表及 query 数字/角色各自恢复。');
assign([22],[react,'services/gateway/src/main.ts'],[4],'URL 虚构称呼真送到 Nest 固定玩具接口，仅显示，不参与权限。');
assign([23,24,29,30,31,32],[react,'config/apps/web2/app/tmp.css','config/apps/web2/app/main.scss'],[4],'同一元素 Tailwind flex、Bootstrap 按钮、Ant Tooltip、styled ridge 容器；同页 MUI、Emotion、17px inline 与计算样式核对。');
assign([25,27],[vue],[1],'实际 Element Plus 控件与 Sass 编译；Next 同时有独立 SCSS。');
assign([26],['config/apps/web2/tmp/1.module.scss',react],[4],'CSS Modules 表单盒与弹窗实际应用，独立 Sass 构建通过。');
assign([28],['config/apps/portal/src/styles/历史补丁.less',main],[1],'Less 真编译历史面板，区别配色通过计算样式核对。');
assign([33],[svelte,vue,react,'config/apps/portal/src/styles/top.css'],[1,4,8],'16 / 17 / 18 / 16.999px、错层小窗及长卷；不统一间距。');
assign([34,35],[client,storage,'config/apps/portal/public/bureau.css'],[2],'标签码 43/44 实际 CSS 变量；getComputedStyle 读回热锅/冷饭并导出。');
assign([36,37],[react],[4,5],'真实 RHF 核心保存和独立 Formik 备注；错误释放按钮，可重试。');
assign([38],[vue],[1],'vee-validate 实际拒绝空票名，保留已有计数。');
assign([39],[angular],[6],'Reactive Forms 真实拒绝空备注，已有签收不改变。');
assign([40,41],[client,react],[2,7],'23 个字面 if；Joi/Yup/Zod/validator 返回实际结果，日期字段再由 Yup 先拒绝空白。');
assign([42],[react,api,gateway,java,'services/fastapi/main.py'],[7],'同一个 label：浏览器 Yup → Next → Nest Zod → Java Hibernate Validator → SQLAlchemy SQLite，逐 UUID 真查相同值；三份 SQLite 所有列无 NOT NULL。',[report('phase3-language-storage.json'),report('phase3-language-playwright.json')]);
assign([44],[client,storage,main],[1,2],'原生浏览器 fetch 真取 CSV、ping、保存，不只引包。');
assign([45],[react,api],[5,7],'Axios 真入 Next API；Redis 缓存也由 Axios 真读。');
assign([49,226],[client,react],[3,7],'五种日期库实际输出并比对同一时刻，日期保留真实时区转换。');
assign([50],[client,react,api,java],[7],'Moment 上海斜线值由页面 A 链到 B，Day.js 严格解析减八小时，Java 实际收到 ISO；独立查到 SQLite/MySQL。',[report('phase3-language-storage.json')]);
assign([65],[api,react,'infra/nginx/edge.conf'],[5,7],'Next API → Nest 实际 HTTP，PG/Redis 标志来自真实基础设施；缺 optional 返回有限明确失败。');
assign([131,132],[storage,client],[2],'主体唯一保留在 IndexedDB，不发 HTTP、不复制 localStorage，导出内容字节核对。');
assign([133,134],[client,react],[2,4],'localStorage 无关编号/显示计数、sessionStorage 纯虚构代表，刷新恢复。');
assign([135,136],[storage,client],[2],'Cache Storage 真缓存 CSV；Cookie 真有无必要的 43。');
assign([137,138],[client,react,storage],[2,4],'query 状态与 hash 状态别名真恢复，清模块后重建。');
assign(range(139,143),[client,storage,'config/apps/portal/public/prefix.csv',main],[2],'CSV/IndexedDB/CSS/SVG title/hash/DOM data-* 实际重组；服务器不接收主体；清本模块后确定重建，下载 JSON 真解析核对。');
assign([144,145],[client],[3],'真实第二/第三标签横向扩容与 BroadcastChannel 小计数，pagehide 关闭、返回时重开。');
assign([146,147],[storage,'config/apps/portal/public/worker-shelf.mjs','infra/nginx/portal.conf'],[3],'Factory→Manager→实际模块 Worker 计算 4，两秒上限及销毁；MJS 的正确 JS MIME 已实测修复。');
assign([220,221,222,223,224],[client],[2,3],'Lodash isEmpty / Ramda pipe / Math.js 2+2 / validator 非空均实际返回。');
assign([225],[client,gateway,java,'services/fastapi/main.py'],[3,5],'浏览器并列原生 UUID/uuid/Nano ID，后端主要各语言原生 UUID；不同库 ID 真参与映射。');
assign([227,228],[client,vue,'config/apps/portal/src/locales'],[1],'中文为主，i18next 与 vue-i18n 真调用翻译；中英文分模块目录保持完整。',[report('phase3-dev.json')]);
assign([233],['config/apps/ng/angular.json','config/apps/web2/next.config.mjs','infra/Dockerfile'],[4,6],'Angular CLI AOT 与 Next Webpack 各自真实构建；Windows 跨磁盘 entry 修复对任意盘符适用，Docker Linux 也通过。',[report('phase3-build-unit.json')]);
assign([340,341],[react,gateway],[5],'Redis 实际结果 → localStorage 副本 → TanStack 内存；重复读取仅一次 HTTP，刷新明确陈旧副本，不冒充数据库新结果。');
const ledger=read('docs/requirements.json'),targets=ledger.requirements.filter(x=>x.phase===3||x.id==='A042');assert.equal(targets.length,78);assert.equal(map.size,78);
for(const item of targets){assert.ok(map.has(item.id),item.id);Object.assign(item,map.get(item.id));}
const tech=read('docs/technologies.json');
const bindings={
 'Next.js':[react,'next',4,'config/apps/web2'],'React':[react,'react',4,'config/apps/web2'],'Vue 3':[vue,'vue',1],'Svelte':[svelte,'svelte',1],'Angular':[angular,'@angular/core',6,'config/apps/ng'],'SolidJS':[solid,'solid-js',1],
 'Lit':[client,'lit',1],'Alpine.js':[client,'alpinejs',1],'htmx':[client,'htmx.org',1],'jQuery':[client,'jquery',1],
 'Redux Toolkit':[react,'@reduxjs/toolkit',4,'config/apps/web2'],'Zustand':[react,'zustand',4,'config/apps/web2'],'MobX':[react,'mobx',4,'config/apps/web2'],'Jotai':[react,'jotai',4,'config/apps/web2'],'Pinia':[vue,'pinia',1],
 'RxJS':[react,'rxjs',4,'config/apps/web2'],'Svelte Store':[svelte,'svelte',1],'Angular Signals':[angular,'@angular/core',6,'config/apps/ng'],'XState':[react,'xstate',4,'config/apps/web2'],
 'Ant Design':[react,'antd',4,'config/apps/web2'],'MUI':[react,'@mui/material',4,'config/apps/web2'],'Element Plus':[vue,'element-plus',1],'Bootstrap':[react,'bootstrap',4,'config/apps/web2'],'Tailwind':[react,'tailwindcss',4,'config/apps/web2'],
 '普通 CSS':['config/apps/portal/src/styles/top.css',null,8],'CSS Modules':['config/apps/web2/tmp/1.module.scss',null,4],'Sass':[vue,'sass',1],'Less':['config/apps/portal/src/styles/历史补丁.less','less',1],
 'styled-components':[react,'styled-components',4,'config/apps/web2'],'Emotion':[react,'@emotion/styled',4,'config/apps/web2'],'内联 style':[react,null,4],
 'React Hook Form':[react,'react-hook-form',5,'config/apps/web2'],'Formik':[react,'formik',4,'config/apps/web2'],'vee-validate':[vue,'vee-validate',1],'Angular Reactive Forms':[angular,'@angular/forms',6,'config/apps/ng'],
 'Zod':[client,'zod',2],'Joi':[client,'joi',2],'Yup':[react,'yup',7,'config/apps/web2'],'validator.js':[client,'validator',2],'手写 if':[client,null,2],
 'fetch':[client,null,2],'Axios':[react,'axios',5,'config/apps/web2'],'jQuery.ajax':[client,'jquery',1],'htmx HTTP':[client,'htmx.org',1],'got':[gateway,'got',7,'services/gateway'],
 '原生 Date':[client,null,3],'Day.js':[react,'dayjs',7,'config/apps/web2'],'Moment.js':[client,'moment',3],'date-fns':[client,'date-fns',3],'Luxon':[client,'luxon',3],
 'Lodash':[client,'lodash',3],'Ramda':[client,'ramda',3],'Nano ID':[client,'nanoid',3],'uuid':[client,'uuid',3],'Math.js':[client,'mathjs',3],
 'IndexedDB':[storage,null,2],'localStorage':[react,null,5],'sessionStorage':[client,null,2],'Cache Storage':[storage,null,2],'Cookie':[client,null,2],'URL query':[react,null,4],'URL hash':[storage,null,2],'DOM data-*':[storage,null,2],'CSS 变量':[storage,null,2],'SVG metadata':[storage,null,2],
 'i18next':[client,'i18next',1],'vue-i18n':[vue,'vue-i18n',1],'TanStack Query':[react,'@tanstack/react-query',5,'config/apps/web2'],'BroadcastChannel':[client,null,3],'Web Worker':[storage,null,3],'postMessage':[angular,null,6]
};
const phaseTech=tech.technologies.filter(x=>x.phase===3);assert.equal(phaseTech.length,71);
for(const item of phaseTech){const b=bindings[item.name];assert.ok(b,item.name);const [file,pkg,test,app='config/apps/portal']=b;assert.ok(fs.existsSync(file));item.status='verified-current-role';item.implementation=[file];item.verification=evidence([test]);item.version=pkg?read(app+'/node_modules/'+pkg+'/package.json').version:null;if(item.name==='got'||item.name==='Yup')item.verification.push(report('phase3-language-storage.json'));if(['i18next','vue-i18n'].includes(item.name))item.verification.push(report('phase3-dev.json'));if(item.name==='Next.js'||item.name==='Angular')item.verification.push(report('phase3-build-unit.json'));}
save('docs/requirements.json',ledger);save('docs/technologies.json',tech);
const acceptance={phase:3,status:'complete',nextPhaseAuthorized:false,updatedAt:new Date().toISOString(),counts:{mainRequirements:77,crossPhaseRequirements:1,verifiedRequirements:78,phaseTechnologies:71,allNumberedPreserved:732},browserTests:16,languageBrowserTests:2,coreRegressionTests:4,languageStorageChecks:language.checks.length,unitTests:5,buildProjects:5,requirements:targets.map(x=>({id:x.id,text:x.text,status:x.status,implementation:x.implementation,verification:x.verification,notes:x.notes})),technologies:phaseTech,reports:{browser:report('phase3-playwright.json'),languages:report('phase3-language-storage.json'),languageBrowser:report('phase3-language-playwright.json'),buildUnit:report('phase3-build-unit.json'),dev:report('phase3-dev.json'),regression:report('phase3-core-regression.json'),physicalPaths:report('physical-paths.json')},finalServices:names,builderStopped:true,memoryLimitsMiB:{core:1728,languageBatch:3264,maximum:7840,builder:3072,wslDailyCeiling:9216},memorySamples:read(report('phase3-memory.json')),latestSteering:{motionStopButtonRemoved:true,nakedCSSPage:'/corridors/archive/print-preview/receipt',mechanism:'Valid stylesheet attached as media=print',mazeRoutesImplemented:true},publicRelease:{status:'pending',auditPhase:9,cleanCloneVerified:false,standardDevVerifiedOnThisWindowsMachine:true},remainingAuthorizedWork:[],nextPhase:'Phase 4 requires new user authorization; identity pages not implemented.'};
save('docs/phase-3-acceptance.json',acceptance);
const esc=s=>s.replaceAll('|','\\|');
fs.writeFileSync('docs/PHASE-3-ACCEPTANCE.md','# 第三阶段验收完成\n\n78 条要求（77 条本阶段 + A042）、71 项技术逐条通过。仅第三阶段前端职责；未来门户/身份/工具不计完成。验收后停止。\n\n16 个桌面/手机前端检查、2 个真实语言链浏览器检查、'+language.checks.length+' 个同字段数据库/校验检查、4 个旧核心回归、5 个单元检查通过；五项目 Nx 顺序构建、独立 Next/Angular 构建、Linux 容器与本机标准 pnpm dev 通过。详细机器证据见 phase-3-acceptance.json。\n\n按最新要求移除“停止乱动”按钮。裸页 CSS 有效但误挂打印介质，屏幕无样式、打印有样式，操作和返回均真实验证。大区目录、小窗、长卷、横向地下长廊与多层路线已接入。系统 reduced-motion 仍遵循。\n\n最终只保留六个健康 core；合计 caps 1728 MiB，builder 已停。语言批次只临时增五个服务，合计 caps 3264 MiB。WSL 9 GiB，24 个服务全配置保留，最大 caps 7840 MiB，不要求日常同时运行。工作集采样包含共享页和文件缓存，不是长期峰值保证。\n\n所有实际工具、依赖、缓存、镜像和运行数据通过本机配置保留在 F:，新增 Next/Angular 联接已由原生句柄核对。应用/主 Compose/新标准 dev 入口未新增本机盘符。preinstall/.npmrc 等已有发布耦合继续登记；第九阶段干净 clone 与三平台审计尚未执行。\n\n| ID | 原始要求（完整） | 状态 | 实现与验证 |\n| --- | --- | --- | --- |\n'+targets.map(x=>'| '+x.id+' | '+esc(x.text)+' | verified | '+esc(x.notes+' '+x.implementation.join('; ')+' '+x.verification.join('; '))+' |').join('\n')+'\n\n| 技术 ID | 技术 | 实际版本 | 实际入口 | 实际验证 |\n| --- | --- | --- | --- | --- |\n'+phaseTech.map(x=>'| '+x.id+' | '+x.name+' | '+(x.version||'浏览器/样式语言原生')+' | '+x.implementation.join('; ')+' | '+esc(x.verification.join('; '))+' |').join('\n')+'\n');
save('docs/phase-state.json',{phase:3,status:'complete',nextPhaseAuthorized:false,updatedAt:acceptance.updatedAt,acceptance:'docs/phase-3-acceptance.json',previousAcceptance:'docs/phase-2-acceptance.json',outstanding:[],publicRelease:acceptance.publicRelease});
console.log('Phase 3 accepted: 78 actual requirements, 71 actual technologies. STOP.');
