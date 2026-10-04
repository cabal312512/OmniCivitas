// Documentation only. Run after the separate phase-6 recorder has accepted the fresh evidence.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {tools,phase6Tools,groups} from '../config/apps/portal/src/tool/data.mjs';
const json=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const accepted=json('docs/phase-6-acceptance.json'),state=json('docs/phase-state.json');
assert.equal(accepted.phase,6);assert.equal(accepted.status,'complete');assert.equal(accepted.nextPhaseAuthorized,false);
assert.equal(state.phase,6);assert.equal(state.status,'complete');assert.equal(state.nextPhaseAuthorized,false);
assert.equal(state.acceptance,'docs/phase-6-acceptance.json');assert.equal(state.previousAcceptance,'docs/phase-5-acceptance.json');
assert.equal(accepted.requirementCount,19);assert.equal(accepted.requirements.length,19);assert.ok(accepted.requirements.every(item=>item.status==='verified'));
assert.equal(tools.length,54);assert.equal(phase6Tools.length,19);assert.equal(new Set(tools.map(tool=>tool.id)).size,54);
assert.equal(accepted.browser.count,212);assert.equal(accepted.browser.stats.expected,accepted.browser.count);
for(const key of ['unexpected','flaky','skipped'])assert.equal(accepted.browser.stats[key],0);
assert.equal(accepted.browser.phase6Count+accepted.browser.phase5RegressionCount+accepted.browser.earlierRegressionCount,accepted.browser.count);
assert.equal(accepted.unit.count,90);assert.equal(accepted.unit.phase6Count+accepted.unit.phase5RegressionCount,accepted.unit.count);
assert.ok(accepted.HTTP.length>0&&accepted.HTTP.every(item=>item.status===200));
assert.equal(accepted.backendRoutes.length,8);assert.ok(accepted.backendRoutes.every(item=>item.status===404));assert.equal(accepted.emptyAccountCounts,'0|0|0');
assert.equal(accepted.core.length,6);assert.ok(accepted.core.every(service=>service.health==='healthy'&&service.running));
assert.equal(accepted.totalCapsMiB,1728);assert.equal(accepted.builderCapMiB,3072);assert.equal(accepted.builderStopped,true);
assert.equal(accepted.licenseHTTP.filter(item=>item.url.startsWith('/licenses/')).length,10);assert.equal(accepted.licenseHTTP.length,11);assert.ok(accepted.licenseHTTP.every(item=>item.status===200));
assert.ok(Number.isFinite(accepted.memory.totalWorkingSetMiB)&&accepted.memory.totalWorkingSetMiB>0);
assert.equal(accepted.sourceIntegrity.numbered,732);assert.equal(accepted.sourceIntegrity.originalTechnologies,146);assert.equal(accepted.sourceIntegrity.originalCategories,34);
assert.equal(state.publicRelease.cleanCloneVerified,false,'Do not replace the pending phase-9 clean-clone audit with a phase-6 claim.');
const untouched=['PROJECT_SPEC.txt','AI写的提示词.txt','docs/requirements.json','docs/technologies.json','docs/phase-state.json','docs/phase-6-acceptance.json','docs/PHASE-6-ACCEPTANCE.md'];
const originalHashes=new Map(untouched.map(file=>[file,sha(file)]));
const read=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(accepted.acceptedAt));
const browser=accepted.browser,unit=accepted.unit,httpCount=accepted.HTTP.length;
const memoryMiB=Math.round(accepted.memory.totalWorkingSetMiB*10)/10,memoryGiB=(accepted.memory.totalWorkingSetMiB/1024).toFixed(1);
const groupCounts=groups.map(group=>({group,count:tools.filter(tool=>tool.group===group).length})).filter(item=>item.count);
const groupCount=groupCounts.length,groupText=groupCounts.map(item=>`${item.group} ${item.count}`).join('、');
const counts=`${browser.count}/${browser.count} 新完整浏览器检查（本阶段 ${browser.phase6Count}＋第五阶段回归 ${browser.phase5RegressionCount}＋原页面回归 ${browser.earlierRegressionCount}），${unit.count}/${unit.count} 合并单测（本阶段 ${unit.phase6Count}＋第五阶段 ${unit.phase5RegressionCount}）`;
const runtime=`${httpCount} 个页面 HTTP 200，8 次账户 GET/POST 均 404，真实 PostgreSQL 三张停用账户表 0|0|0。仅六个健康 core，内存 caps 合计 ${accepted.totalCapsMiB} MiB，${accepted.builderCapMiB/1024} GiB builder 已停止；Docker/WSL 最后工作集采样 ${memoryMiB} MiB（${accepted.memory.sampledAt}），不作长期峰值保证。`;
const limits='图片仅 PNG/JPEG/WebP，单文件 4 MiB、边长 4096、总计 4 MP；SVG、GIF、AVIF、BMP 与动画 WebP 拒绝。JPEG 透明区域铺白，三个压缩质量不保证每张图变小。二维码真实编解码，URL 留作文字，不自动访问。';
const boundary='PDF 是一页 A4、中央很小的中文栅格图，字体按设备变化，文字不可选择；计时基于实际单调时间，生命周期证明是合成 persisted 事件与模拟 hidden 属性，不是实际 BFCache 命中或 OS 挂起测量。只有待办使用 ocv.todo.v1 存储；写入失败会明确退回内存，其余新工具输入/文件不上传或保存。';
const history='第五阶段和此前的扉页、主页、光场、失修框、迷宫、互动及源码保留。下方旧停点只是对应历史，不覆盖当前第六阶段完成状态。第七阶段未授权；第九阶段公开发布、干净 clone、多平台及全部依赖/素材许可审计仍待办。';
const marker=(name,text)=>`<!-- phase6-${name}-start -->\n${text}\n<!-- phase6-${name}-end -->`;
function replaceMarked(document,name,text){
 const begin=`<!-- phase6-${name}-start -->`,end=`<!-- phase6-${name}-end -->`,start=document.indexOf(begin),finish=document.indexOf(end);
 if(start<0){assert.equal(finish,-1);return null;}assert.ok(finish>start);return document.slice(0,start)+marker(name,text)+document.slice(finish+end.length);
}
function afterHeading(document,heading,name,text){
 const existing=replaceMarked(document,name,text);if(existing!==null)return existing;
 const at=document.indexOf(heading);assert.ok(at>=0,'Missing document heading: '+heading);
 const end=at+heading.length;return document.slice(0,end)+'\n\n'+marker(name,text)+document.slice(end);
}
const currentHandoff=[
 '## 当前停点：第六阶段已完成并停止','',
 `${day}。19 条 B018–025、B049–058、B123 全部 verified，新增图片/二维码、计时/待办、学习/科学与单页 PDF。/functions/ 现有 ${tools.length} 个工具、${groupCount} 组；/functions/clock/ 是时间目录。${counts}通过，无失败、跳过、flaky 或重试拼接。报告 PHASE-6-ACCEPTANCE.md / phase-6-acceptance.json；停点 phase-state.json。第七阶段未授权。`,'',
 runtime,'',
 '公开归属声明和十份原许可均 HTTP 200，实际原字节/hash 一致。732 原文/行号/hash、146 原技术与 34 类别完整。新增 cropperjs 1.6.2、qrcode 1.5.4、jsqr 1.4.0、pdf-lib 1.17.1 的真实调用与原许可见 PHASE-6-SOURCES.md；依赖、缓存、临时文件和证明在本地依赖目录，应用仅使用包名和相对 URL。','',
 '### 第六阶段文件地图','',
 '| 文件/目录 | 作用 |','| --- | --- |',
 '| config/apps/portal/src/img/img.mjs、size.mjs | 8 图片/二维码描述符、Canvas 与格式头/像素边界；实际 Cropper/编码/识别 |',
 '| config/apps/portal/src/time/model.mjs、time.mjs | 倒计时、秒表、番茄钟、待办工作台；实际单调时间及严格版本化存储 |',
 '| config/apps/portal/src/δοκιμή/calc.mjs、ui.mjs | 手动课表、均分复习、随机冲突排课、二体轨道、八行星预设与 Haversine 距离 |',
 '| config/apps/portal/src/file/pdf.mjs | 实际 pdf-lib 生成一页 A4，中间很小的 Canvas 中文栅格图 |',
 '| config/apps/portal/src/tool/data.mjs、Tool.astro、run.js | 54 描述符、局部工作台、只读诊断、实际 Blob/预览/取消与生命周期；Cropper CSS 由 Astro 静态导入 |',
 '| config/apps/portal/src/pages/functions/index.astro、[slug].astro、clock.astro | 工具目录、实际工具路由与时间入口；阶段七占位仍明确未开放 |',
 '| tests/phase6-*.test.mjs、tests/browser/phase6-*.spec.mjs、playwright.phase6.config.mjs | 47 本阶段算法边界和 78 本阶段浏览器操作，加第五阶段/旧页面回归完整运行 |',
 '| scripts/record-phase6-acceptance.mjs、update-phase6-handoff.mjs | 先核对新证明/真实服务/源 hash，再接受 19 行；只在正式完成后更新交接 |',
 '| docs/PHASE-6-SOURCES.md、config/apps/portal/public/licenses/、THIRD_PARTY_NOTICES.txt | 四个新库精确版本和原许可；十份累计许可与原归属保留 |','',
 `当前分组：${groupText}。`,'',limits,'',boundary,'',
 '科学页面只作手动、均分、随机或基础公式演示，不是约束求解器、真实航天任务或物理仿真。故意错宽/叠窗/手机裁切保留，实际键盘、置顶、取消和固定出口可完成操作。','',
 `本轮完整证明在 ${browser.report.slice(0,browser.report.lastIndexOf('/')+1)}，合并单测为 runtime/reports/phase6-unit.json。初次单测冷加载超时、动态 CSS 404、裁剪端点舍入误差与首次完整 208/212 的失败报告，以及后续专项，全部独立保留。四项旧页面检查涉及同名链接定位、故意遮挡的合法键盘操作及 GPU 绘制期间的协议轮询；原断言保留，修正后重新完整运行。当前验收只用全新的完整报告，不拼接；裁剪期望从原始范围转原生整数像素后与真实下载解码精确核对。`,'',history,
].join('\n');
const updates=new Map();
let handoff=read('docs/HANDOFF.md'),marked=replaceMarked(handoff,'handoff',currentHandoff);
if(marked!==null)handoff=marked;else{
 const start=handoff.indexOf('## 当前工作：第六阶段已授权，进行中'),finish=handoff.indexOf('## 历史停点：第五阶段已完成并停止');assert.ok(start>=0&&finish>start);
 const authorization=handoff.slice(start,finish).trim().replace('## 当前工作：第六阶段已授权，进行中','## 历史授权记录：第六阶段开始');
 handoff=handoff.slice(0,start)+marker('handoff',currentHandoff)+'\n\n'+authorization+'\n\n'+handoff.slice(finish);
}
updates.set('docs/HANDOFF.md',handoff);
let readme=read('README.md');const readmeTitle='# OmniCivitas / 人类文明技术结晶',webAnchor='\n当前网页：',introEnd=readme.indexOf(webAnchor);assert.ok(readme.startsWith(readmeTitle)&&introEnd>readmeTitle.length);
const introduction=[
 `接手入口：[零上下文交接文档](docs/HANDOFF.md)。[第六阶段](docs/PHASE-6-ACCEPTANCE.md)已完成并停止，19 条逐条验收，现有 ${tools.length} 个真实工具、${groupCount} 组。${counts}通过。第七阶段未授权。`,'',
 '安静 Logo 扉页、双层光场、三维实体/辉光、27 个迷宫路由、失修 CSS、差异窗口互动和四个指定素材继续运行；早期梗图版保留停用。新工具继续叠到同色玻璃窗口里，重叠、窄栏和手机裁切保留。停点见 docs/phase-state.json。','',
 `工具入口 /functions/，时间入口 /functions/clock/。分组：${groupText}。图片本地 Canvas/成熟裁剪库，二维码真实编解码，计时、待办与 PDF 都有实际导出或操作证据。${boundary}`,'',
 `默认六个 core，caps ${accepted.totalCapsMiB} MiB，${accepted.builderCapMiB/1024} GiB builder 停止，最后 Docker/WSL 工作集约 ${memoryGiB} GiB（采样，不是峰值保证）。${httpCount} 页面与十份原许可/归属声明实际 HTTP 200。新增四库见[第六阶段来源](docs/PHASE-6-SOURCES.md)，前阶段见[第五阶段来源](docs/PHASE-5-SOURCES.md)。公开发布、干净 clone、多平台和完整许可审计仍在第九阶段。`,
].join('\n');
readme=readmeTitle+'\n\n'+introduction+'\n'+readme.slice(introEnd);updates.set('README.md',readme);
let phases=read('docs/PHASES.md');const phaseHeading='# 九阶段实施与停点',phaseEnd=phases.indexOf('\n\n',phases.indexOf(phaseHeading)+phaseHeading.length+2);assert.ok(phaseEnd>0);
const phaseStart=phases.indexOf(phaseHeading)+phaseHeading.length;
phases=phases.slice(0,phaseStart)+`\n\n${day}，第六阶段已完成并停止：19 条 verified，${counts}通过，${httpCount} 页面/真实 core/十份原许可核对完成。报告 PHASE-6-ACCEPTANCE.md / phase-6-acceptance.json；旧阶段及全部原文/hash 保留。第七阶段未授权。`+phases.slice(phaseEnd);updates.set('docs/PHASES.md',phases);
const progressText=`# 第六阶段已完成并停止\n\n${day}。19 条 B018–025、B049–058、B123 全部 verified；54 工具、时间目录和门户搜索实际接入，旧布局/光场/互动保留。${counts}通过，无失败、跳过、flaky 或重试拼接。\n\n${runtime}\n\n十份原许可及公开归属声明原字节/hash 一致；四个新库实际使用，732 原文与 146 技术/34 类别保留。PDF 中文栅格与模拟 BFCache 的实际限制看 PHASE-6-ACCEPTANCE.md。初次失败/专项报告保留，当前只接受全新完整证明。HANDOFF.md 已更新，第七阶段未授权；阶段九公开发布审计仍待办。`;
let progress=read('docs/PROGRESS.md');marked=replaceMarked(progress,'progress',progressText);
if(marked!==null)progress=marked;else{const old='# 第六阶段进行中';assert.ok(progress.startsWith(old));progress=marker('progress',progressText)+'\n\n'+progress.replace(old,'# 历史授权记录：第六阶段开始');}updates.set('docs/PROGRESS.md',progress);
updates.set('docs/TECHNOLOGIES.md',afterHeading(read('docs/TECHNOLOGIES.md'),'# 技术用途与验收账本','technologies',`第六阶段已完成：CropperJS 真拖动裁剪、qrcode 真编码、jsQR 真识别和 pdf-lib 真单页结构/下载均有桌面/手机证明。${counts}通过，详见 phase-6-acceptance.json；currentPhase6 只追加四个新库与实际用途，原 146 技术、34 来源类别及第五阶段元数据保留。十份原许可/公开归属声明实际 HTTP 200、原字节/hash 一致，见 PHASE-6-SOURCES.md。只跑六 core，没有据装包宣称其他栈重新运行；第七阶段未授权，阶段九全面审计仍待办。以下旧阶段说明为历史。`));
const requirements=read('docs/REQUIREMENTS.md'),tableAnchor='| ID | 原文行 | 阶段 | 状态 | 原始要求 | 实现 / 验证 |',tableAt=requirements.indexOf(tableAnchor);assert.ok(tableAt>=0);
const requirementUpdate=afterHeading(requirements,'# 全量需求验收账本','requirements',`第六阶段新增 19 条 B018–025、B049–058、B123 已逐条 verified；当前证据 phase-6-acceptance.json：${counts}，真实图片/二维码/PDF 下载、计时、待办及演示边界核对完成。原 732 文本/行号/hash 不变，其他阶段行和历史证明不改。第七阶段未授权，以下旧停点仅为历史；安装包或占位页面仍不能算实现。`);
assert.equal(requirementUpdate.slice(requirementUpdate.indexOf(tableAnchor)),requirements.slice(tableAt),'Only the requirement introduction may change');updates.set('docs/REQUIREMENTS.md',requirementUpdate);
updates.set('docs/DECISIONS.md',afterHeading(read('docs/DECISIONS.md'),'# 已确认的约束与冲突处理','decisions',`50. 第六阶段实际构建发现动态导入 Cropper CSS 的 preload 引用保留但文件未发布，库 CSS 改为 Astro 工具壳静态导入，Cropper JS 仍懒加载。裁剪导出用原始浮点范围，经原生 Canvas 整数尺寸转换；测试不再把 getData(true) 的端点舍入当作输出尺寸，而是独立转换后与真实下载解码精确核对，不放宽 ±1。服务验收只读查询 HTTP/core/真实 PostgreSQL；计时生命周期只以合成 persisted 事件和模拟 hidden 属性检查，不冒称真实 BFCache/OS 挂起。第一次冷加载超时、CSS 404 与专项舍入失败都保留，修正后执行全新完整 ${browser.count} 浏览器与 ${unit.count} 单测；专项 6/6 不拼成最终报告。只读诊断不记录输入，PDF 栅格字体限制明确，第七阶段未授权。`));
for(const[file,value]of updates){assert.ok(value.includes('第七阶段未授权'),file);assert.ok(!value.includes('phase9 clone 已成功'),file);}
// All transformations/guards pass before writing. Original ledgers and source documents are never touched.
for(const[file,value]of updates){const original=fs.readFileSync(file,'utf8'),eol=original.includes('\r\n')?'\r\n':'\n';fs.writeFileSync(file,value.replace(/\n/g,eol));}
for(const[file,hash]of originalHashes)assert.equal(sha(file),hash,'Documentation update touched protected source/state: '+file);
console.log(`Updated seven documentation entries from accepted phase 6: ${tools.length} tools, ${groupCount} groups, ${browser.count} browser checks, ${unit.count} units, ${httpCount} HTTP pages, ${memoryMiB} MiB sampled working set. Phase 7 remains unauthorized.`);
