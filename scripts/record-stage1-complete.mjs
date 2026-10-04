import { readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import './guard-paths.mjs';
const deps=process.env.OCV_DEPS_ROOT;
const readJson=async file=>JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
const report=name=>readJson(path.join(deps,'runtime/reports',name));
const runtime=await report('runtime-verification.json');
const core=await report('core-storage-verification.json');
const browser=await report('playwright.json');
const doctor=await report('doctor.json');
const physical=await report('physical-paths.json');
const memory=await report('memory-snapshot.json');
const recycling=await report('docker-crash-recycling.json');
const caches=await report('docker-old-cache-recycling.json');
assert.equal(runtime.databaseVerified,true);
assert.equal(browser.stats.unexpected,0);assert.equal(browser.stats.expected,4);
assert.equal(doctor.docker,'storage-verified');assert.equal(core.builderStopped,true);
assert.equal(core.limits.length,5);assert.equal(core.retainedRows,256);
assert.ok(core.observations.some(x=>x.startsWith('Stopped redis')));
assert.equal(recycling.OriginalExists,false);assert.deepEqual(caches.Remaining,[]);
assert.ok(doctor.storageAttestation.actualVmMemoryBytes<=9*1024**3);
for(const [name,entry] of Object.entries(physical.paths)) {
  if(!['wslMaintenanceCache','wslConfig','dockerInstallSettings'].includes(name))assert.ok(entry.physical.startsWith('\\\\?\\F:\\OCVdeps\\'));
}
const ledger=await readJson('docs/requirements.json');
const update=(id,status,implementation,verification,notes)=>Object.assign(ledger.requirements.find(x=>x.id===id),{status,implementation,verification,notes});
const evidence=['F:/OCVdeps/runtime/reports/core-storage-verification.json','F:/OCVdeps/runtime/reports/runtime-verification.json'];
update('A117','partial',['infra/postgres/001-core.sql'],evidence,'真实 mall_goods 已初始化并保留数据；其他旧表随后续语言接入。');
update('A118','verified',['services/gateway/src/runtime-store.ts'],evidence,'product_name 实际保存虚构文明名称，SQL 与 Redis 内容逐字段核对。');
update('A232','verified',['config/apps/portal/package.json','config/apps/portal/dist'],['Actual Astro build log executes Vite 8.3.2'],'随当前 Astro 构建提前验证；历史构建模块仍在阶段 8。');
update('A342','partial',['services/gateway/src/runtime-store.ts','config/apps/portal/src/pages/index.astro'],evidence,'当前核心依赖停用时保存/readiness 有限 503，主页与 ping 可用；浏览器失败后可重试。后续模块继续检查。');
update('A364','partial',['services/gateway/src/runtime-store.ts'],evidence,'内存最多 64 条；真实 SQL 批量超限后实际保留 256 条。后续缓存、监听与计时器继续检查。');
update('A366','partial',['services/gateway/src/runtime-store.ts'],evidence,'SQL 语法字符串作为精确文本保存，表仍可查询；未来所有 ORM/语言继续检查参数化。');
update('A374','partial',['pnpm-lock.yaml','README.md','ocv.ps1','compose.yaml'],evidence.concat(['pnpm frozen install, Nx build, bounded sequential Docker build; all passed']),'第一阶段范围完成安装、构建与真实运行；未来完整技术栈和模块尚待后续阶段。');
update('A375','partial',['compose.yaml'],evidence,'五个当前核心容器的真实健康检查均通过；后续可选服务继续核对。');
update('A376','partial',['compose.yaml','services/gateway/src/runtime-store.ts'],evidence,'真实 Compose 健康依赖顺序、必要依赖停用时拒绝保存、重启恢复通过；后续调用链继续核对。');
await writeFile('docs/requirements.json',JSON.stringify(ledger,null,2)+'\n');
const technologies=await readJson('docs/technologies.json');
for(const technology of technologies.technologies) {
  if(['Docker Compose','PostgreSQL','Redis','裸 SQL','Vite'].includes(technology.name)) {
    technology.status='verified-current-role';
    technology.version=({'Docker Compose':'5.5.1',PostgreSQL:'17.6',Redis:'7.4.2',Vite:'8.3.2'})[technology.name] || null;
    technology.implementation=technology.name==='Vite'?['config/apps/portal/package.json']:['compose.yaml','infra/postgres/001-core.sql','services/gateway/src/runtime-store.ts'];
    technology.verification=technology.name==='Vite'?['Actual Astro/Vite build succeeded']:evidence;
  }
}
await writeFile('docs/technologies.json',JSON.stringify(technologies,null,2)+'\n');
const checkpoint={phase:1,status:'complete',nextPhaseAuthorized:false,updatedAt:new Date().toISOString(),recorded:{numberedRequirements:732,technicalCategories:34,individualTechnologies:146,promptParagraphs:51,screenshotRequirements:12},verified:{unitTests:5,browserTests:4,build:'Nx and sequential bounded Docker builds passed',runtime:runtime.observations,infrastructure:core.observations,containerLimits:core.limits,dependencyPaths:doctor.paths,physicalPathsReport:'F:/OCVdeps/runtime/reports/physical-paths.json',wslCeilingGiB:9,actualVmMemoryBytes:doctor.storageAttestation.actualVmMemoryBytes,memorySnapshot:memory,oldCrashRecycled:true},outstanding:[],reportsRoot:path.join(deps,'runtime/reports'),sourceScope:'Phase 1 acceptance only. Remaining technologies, profiles and functions stay planned/partial until their authorized phases. Stop here.'};
await writeFile('docs/phase-state.json',JSON.stringify(checkpoint,null,2)+'\n');
console.log('Phase 1 acceptance complete; phase 2 is not authorized.');
