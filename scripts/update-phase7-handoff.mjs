import fs from 'node:fs';
import assert from 'node:assert/strict';
import {read,sha} from './inspect-phase7-runtime.mjs';
const state=read('docs/phase-state.json'),r=read('docs/phase-7-acceptance.json');
assert.equal(state.phase,7);assert.equal(state.status,'complete');assert.equal(state.nextPhaseAuthorized,false);assert.equal(r.requirementCount,69);assert.equal(r.totalTools,101);assert.equal(r.browser.count,372);assert.equal(r.unit.count,168);
const protectedFiles=['PROJECT_SPEC.txt','AI写的提示词.txt','docs/requirements.json','docs/technologies.json','docs/phase-state.json','docs/phase-7-acceptance.json','docs/phase-6-acceptance.json'];
const hashes=new Map(protectedFiles.map(file=>[file,sha(fs.readFileSync(file))]));
const counts='372/372 新完整浏览器检查（本阶段 160＋前阶段回归 212），168/168 合并单测（本阶段 78＋前阶段 90）';
const runtime=`${r.HTTP.length} 个页面 HTTP 200，8 次账户 GET/POST 均 404，真实 PostgreSQL 停用账户表 0|0|0。只运行六个健康 core，caps 合计 ${r.totalCapsMiB} MiB，3 GiB builder 已停止；Docker/WSL 最后工作集采样 ${r.memory.totalWorkingSetMiB.toFixed(1)} MiB（${r.memory.sampledAt}），不是长期峰值保证。`;
const boundary='小游戏为本地基础规则：井字棋、9×9/10 雷扫雷、2048、Canvas 蛇/一关砖块、猜数字、真实反应/打字、4×4/八对翻牌和按下清零。无排行榜或多人服务。鼠标/滚轮仅保存 ocv.mileage.v1 的六项匿名版本/累计数，同标签页跨路由；不保存坐标/输入，失败明确退内存。纳米换算不作硬件测量。Cookie 只读写本站三个具名演示键；SVG 公证无实际法律效力。';
const status=`2026-10-03，第七阶段已完成并停止。69 条 B071–122、B124–140 全部 verified，新增 10 小游戏、19 奇葩工具、18 生成器，累计 101 工具、13 组。${counts}通过，无失败、跳过、flaky 或重试拼接。报告 PHASE-7-ACCEPTANCE.md / phase-7-acceptance.json。第八阶段未授权。`;
const fileMap=[
 ['config/apps/portal/src/game/game.mjs、model.mjs、1.css','10 个真实游戏、独立规则模型、局部 Canvas/棋盘、隐藏/取消清理'],
 ['config/apps/portal/src/misc/misc.mjs、model.mjs、3.css','19 工具；十按钮/14 问题/32 loaders/120% 进度/具名 Cookie/真实 SVG/撤销/实际 15 秒'],
 ['config/apps/portal/src/gen/gen.mjs','18 模板生成器；40 行正式化、十份原话、精确六位十进制、正确原字节 TXT'],
 ['config/apps/portal/src/aaa/p.mjs、Identity.astro、pages/status.astro、pages/identity/[mode].astro','门户/迷宫/工具共享入口及独立状态/虚构身份页启动匿名里程；sessionStorage 六数值字段，损坏/写拒绝降级'],
 ['config/apps/portal/src/tool/、pages/functions/games.astro、没有开门的大厅/catalogue.mjs','101 描述符/13 组、真实游戏目录与搜索，前阶段 54 工具和原未来元数据保留'],
 ['tests/phase7-*.test.mjs、tests/browser/phase7-*.spec.mjs、playwright.phase7.config.mjs','78 新算法边界、160 新桌面/手机浏览器操作；合并前阶段完整证明'],
 ['scripts/record-phase7-acceptance.mjs、inspect-phase7-runtime.mjs、update-phase7-handoff.mjs','只在全部新证明通过后接受 69 行；只读真实 HTTP/Docker/PG/原许可检查，随后更新交接'],
 ['docs/PHASE-7-SOURCES.md、PHASE-7-ACCEPTANCE.md、phase-7-acceptance.json','明确实现范围/许可延续；69 条原文与独立语义证明、实际下载和源码 hash'],
];
const handoff=[status,'',runtime,'',boundary,'','### 第七阶段文件地图','', '| 文件/目录 | 作用 |','| --- | --- |',...fileMap.map(([file,purpose])=>`| ${file} | ${purpose} |`),'',
 '实际入口 /functions/games/ 与 /functions/；目录/搜索已开放所有本阶段页面。正式化最高 40 行每行完整保留原话；无用 TXT 只有“该文件存在”，无 BOM/换行；错误代码生成结果可实际复制进解释器；数字以 BigInt 十进制舍入六位；存在性分析结论保持未定。工具不调用大模型，不上传/保存输入。', '',
 'loading L01–L31 有限完成，L32 永久展示但不阻塞退出；真实进度仍按实际单调时间计算，超额进度必须进入 120% 并从真正显示的时刻保留至少 1.5 秒，再回退到 100%，长帧不能跳过该阶段。主动点击后实际等满 15 秒；十个相同按钮要逐个测，选择器先答完 14 个问题，轨迹须回到起点附近才可导出 SVG（终点距起点不超过包围框对角线的 30%）。桌面 SVG 有实际鼠标圆，手机为实际键盘闭合路径，不冒充真实触摸。', '',
 '计时/生命周期保留真实单调时钟；隐藏和 persisted 钩子以合成事件检查，不宣称真 BFCache 或 OS 挂起。原生鼠标/滚轮是实际输入；手机 Chromium 会缩放 CDP 滚轮量，期望从实际 WheelEvent 的 CSS 像素独立计算并精确核对，不把原始模拟器参数当作页面收到的值。', '',
 `完整证明 ${r.browser.report}，单测 ${r.unit.report}。初次 96/98 是尚未等原生 wheel 送达就导航；后续 66/68 的两个手机失败是把 CDP 参数误当 CSS 像素。原断言目的保留：等待实际事件，并独立读取原生 delta，精确核对两次累计。第一次完整回归发现忙帧能跳过短暂 120% 阶段，改为真实阶段状态机，并补状态页和虚构身份页直接进入的里程入口。旧失败与专项都独立保存，最终只接受修复后全新完整 372 项，不拼接。`, '',
 '没有新增第三方包；十份原许可/公开归属声明原字节/hash 实际 HTTP 200。原 732 文本/行号/hash、146 技术/34 类别、12 截图记录保留。真实依赖、工具、缓存、临时文件和运行证据在本地依赖根；新增应用不写本机盘符或用户名。', '',
 '安静 Logo、主页双层光场、失修重叠窗、27 迷宫和四个用户素材继续；早期梗图版停用源码保留。不是统一艺术化旋转：继续维持局部错宽、遮挡、未完成框及原生键盘/置顶/固定出口。手机不整齐属于用户要求。', '',
 '第八阶段未授权；接下来只有获得“继续”后才补交互/视觉事故/教程/成就/历史构建遗迹。第九阶段 732 原始文档逐条独立审计、完整技术栈分批实测、public release portability audit、干净 clone 和多平台/全部许可审计仍待办。',
].join('\n');
const updates=new Map(),marker=body=>'<!-- phase7-current-start -->\n'+body+'\n<!-- phase7-current-end -->';
for(const[file,body]of [['docs/HANDOFF.md',handoff],['docs/PROGRESS.md',status+'\n\n'+runtime+'\n\n'+boundary+'\n\n已有页面/源码保留，原始账本不改；第九阶段公开审计待办。'],['docs/PHASES.md',status]]){
 let text=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');assert.ok(text.includes('<!-- phase7-current-start -->'));text=text.replace(/<!-- phase7-current-start -->[\s\S]*?<!-- phase7-current-end -->/,marker(body));if(file==='docs/PROGRESS.md')text=text.replace('# 第七阶段进行中','# 第七阶段已完成并停止');updates.set(file,text);
}
let readme=fs.readFileSync('README.md','utf8').replace(/\r\n/g,'\n'),anchor=readme.indexOf('\n当前网页：');assert.ok(anchor>0);readme='# OmniCivitas / 人类文明技术结晶\n\n接手入口：[零上下文交接文档](docs/HANDOFF.md)。[第七阶段](docs/PHASE-7-ACCEPTANCE.md)已完成，69 条逐条验收，累计 101 工具、13 组。'+counts+'通过。第八阶段未授权。\n\n工具入口 /functions/，游戏 /functions/games/，时间 /functions/clock/。安静扉页、双层光场、失修重叠窗、27 个迷宫和四个素材继续运行，早期版本源码保留停用。\n\n'+boundary+'\n\n'+runtime+' 没有新增包；十份原许可/公开归属声明逐字节核对。公开发布、干净 clone、多平台和完整许可审计仍在第九阶段。\n'+readme.slice(anchor);updates.set('README.md',readme);
for(const[file,heading,body]of [['docs/TECHNOLOGIES.md','# 技术用途与验收账本','第七阶段完成：Canvas/SVG/CSS/单调时间/Web Crypto 实际用于 47 新工具，无新增第三方包。'+counts+'通过；原 146 技术、34 类别和阶段五/六库用途元数据完整，十份原许可/公开归属声明逐字节 HTTP 核对。旧阶段运行说明仅代表历史；第八阶段未授权，阶段九全栈/公开部署审计待办。'],['docs/REQUIREMENTS.md','# 全量需求验收账本',status+' 原 732 文本、行号和 hash 不变，其他阶段行及旧证据保留。没有把装包、占位入口或内存降级当作真实基础设施证据。']]){
 let text=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');assert.ok(text.includes(heading));text=text.replace(heading,heading+'\n\n<!-- phase7-accepted-start -->\n'+body+'\n<!-- phase7-accepted-end -->');updates.set(file,text);
}
let decisions=fs.readFileSync('docs/DECISIONS.md','utf8').replace(/\r\n/g,'\n');decisions=decisions.replace('# 已确认的约束与冲突处理','# 已确认的约束与冲突处理\n\n52. 第七阶段最终 69 条逐条接受；47 新工具、101 总入口。浏览器原生 wheel 异步送达，手机 Chromium 的模拟器参数会缩放为 CSS 像素；测试等待实际事件，从真实 delta 独立核对累计，不降低断言或把错误值改成宽松容差。失败报告与专项独立保留，最终 '+counts+'通过。游戏/15 秒等待/公证 SVG/精确 TXT 都真实执行，三枚本站具名 Cookie 不枚举私人内容；全局里程不保存坐标。无新包和额外基础设施；第八阶段未授权，验收后停止。');updates.set('docs/DECISIONS.md',decisions);
for(const[file,text]of updates){assert.ok(text.includes('第八阶段未授权'),file);fs.writeFileSync(file,text);}
for(const[file,hash]of hashes)assert.equal(sha(fs.readFileSync(file)),hash,'Protected data changed '+file);
console.log('Updated seven phase-7 handoff entries; original sources, ledgers, acceptance and stop state untouched. Phase 8 remains unauthorized.');
