import { readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
import './guard-paths.mjs';
const deps=process.env.OCV_DEPS_ROOT;
const readJson=async file=>JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
const runtime=await readJson(path.join(deps,'runtime/reports/runtime-verification.json'));
const browser=await readJson(path.join(deps,'runtime/reports/playwright.json'));
const doctor=await readJson(path.join(deps,'runtime/reports/doctor.json'));
if(browser.stats.unexpected || runtime.databaseVerified || doctor.docker !== 'not-installed') throw new Error('This checkpoint is specifically the pre-reboot local verification; reconcile changed conditions before recording.');
const ledger=await readJson('docs/requirements.json');
const set=(id,status,implementation,verification,notes='')=>Object.assign(ledger.requirements.find(r=>r.id===id),{status,implementation,verification,notes});
set('A064','verified',['services/gateway/src/main.ts'],['F:/OCVdeps/runtime/reports/runtime-verification.json: actual NestJS response through Nginx'],'第一阶段真实网关已运行；后续调用链逐项单独验收。');
set('A094','verified',['services/gateway/src/main.ts'],['F:/OCVdeps/runtime/reports/runtime-verification.json: parsed JSON response']);
set('A098','verified',['services/gateway/src/main.ts'],['F:/OCVdeps/runtime/reports/runtime-verification.json','F:/OCVdeps/runtime/reports/playwright.json'],'成功消息确实使用 errorMessage 字段。');
set('A117','partial',['infra/postgres/001-core.sql'],['tests/runtime-policy.test.mjs'],'mall_goods schema 已写，实际 PostgreSQL 初始化待 Docker 验证。');
set('A118','partial',['services/gateway/src/runtime-store.ts'],['F:/OCVdeps/runtime/reports/runtime-verification.json'],'product_name 表示虚构文明名称；SQL 真实写入尚待验证。');
set('A234','verified',['nx.json','config/apps/portal/package.json','services/gateway/package.json'],['pnpm build: Nx ran gateway:build and portal:build sequentially; both passed']);
set('A235','verified',['turbo.json'],['Scoped configuration inspection: turbo.json retained; no turbo runtime or task script installed'],'原文明确要求废弃配置，不需要下载 Turborepo。');
set('A240','verified',['scripts/generate-ledgers.mjs'],['pnpm ledger:sync executes native ESM']);
set('A241','verified',['services/gateway/tsconfig.json','services/gateway/dist/main.js'],['F:/OCVdeps/runtime/reports/runtime-verification.json: CommonJS gateway executes']);
set('A242','verified',['services/gateway/src/main.ts','scripts/runtime-policy.mjs'],['pnpm build and pnpm test: TypeScript/JavaScript both execute']);
set('A342','partial',['services/gateway/src/runtime-store.ts','config/apps/portal/src/pages/index.astro'],['tests/browser/core.spec.mjs: request failure releases button and retry succeeds'],'当前核心验证通过，未来所有模块持续核对。');
set('A343','partial',['services/gateway/src/runtime-store.ts','config/apps/portal/src/pages/index.astro'],['HTTP/DB/Redis connect, command and browser abort timeouts configured'],'仅当前实现范围；未来请求必须继续逐条核对。');
set('A364','partial',['services/gateway/src/runtime-store.ts'],['tests/store-fallback.test.mjs: memory contains only 64 of 100 records'],'PostgreSQL 256 条保留逻辑已写，实际数据库保留验证待 Docker。');
set('A365','partial',['services/gateway/src/main.ts'],['F:/OCVdeps/runtime/reports/runtime-verification.json: 201-char/20KB rejected'],'当前接口有长度和请求体上限；全站在后续阶段持续检查。');
set('A366','partial',['services/gateway/src/runtime-store.ts'],['Code inspection: PostgreSQL INSERT uses $1/$2/$3 parameters'],'实际 SQL 路径等待 Docker；后续所有数据库也必须参数化。');
set('A367','partial',['config/apps/portal/src/pages/index.astro'],['tests/browser/core.spec.mjs: HTML payload displayed via textContent, no script executed'],'当前页面验证通过；未来模板继续核对。');
set('A370','partial',['tests/runtime-policy.test.mjs','tests/store-fallback.test.mjs'],['pnpm test: 5 meaningful Vitest tests passed'],'核心有可靠测试；Jest 与后续功能测试尚未实现。');
set('A371','partial',['playwright.config.mjs','tests/browser/core.spec.mjs'],['F:/OCVdeps/runtime/reports/playwright.json: 4 desktop/mobile tests passed'],'Playwright 已使用；Cypress 尚未到安装阶段。');
set('A374','partial',['pnpm-lock.yaml','README.md','ocv.ps1'],['pnpm install --frozen-lockfile --offline passed','pnpm build passed','Nginx/Astro/Nest local runtime and browser checks passed'],'当前已实现范围可安装构建启动；完整 Docker 验收等待重启，未来全栈仍需复验。');
set('A375','partial',['compose.yaml'],['tests/runtime-policy.test.mjs: all five core services have healthcheck'],'尚未实际启动容器。');
set('A376','partial',['compose.yaml','services/gateway/src/runtime-store.ts'],['tests/store-fallback.test.mjs: required DB mode cannot succeed in memory fallback'],'Compose 健康依赖的真实启动顺序待 Docker 验证。');
await writeFile('docs/requirements.json',JSON.stringify(ledger,null,2)+'\n');
const technologies=await readJson('docs/technologies.json');
const versions={ 'pnpm workspace':'10.34.6',Nx:'23.2.1',Astro:'7.3.5',NestJS:'12.1.2',Nginx:'1.30.5',TypeScript:'5.9.3',Vitest:'5.0.3',Playwright:'1.63.0',RxJS:'7.8.2' };
const used={
 'pnpm workspace':['pnpm-workspace.yaml','pnpm install --frozen-lockfile --offline'],
 Nx:['nx.json','pnpm build'],Astro:['config/apps/portal/src/pages/index.astro','build + runtime + browser checks'],
 NestJS:['services/gateway/src/main.ts','HTTP runtime verification'],Nginx:['scripts/local-runtime.mjs','nginx -t + entrance/API tests'],
 TypeScript:['services/gateway/tsconfig.json','gateway:build'],Vitest:['tests/runtime-policy.test.mjs','tests/store-fallback.test.mjs; 5 passed'],
 Playwright:['playwright.config.mjs','4 desktop/mobile browser tests passed'],
 '普通 CSS':['config/apps/portal/src/pages/index.astro','desktop/mobile screenshots inspected'],
 fetch:['config/apps/portal/src/pages/index.astro','button request and retry tests'],
 '原生 Date':['services/gateway/src/main.ts','ISO time returned from actual endpoint'],
 'Turborepo 配置':['turbo.json','Intentionally dormant configuration inspected'],
 ESM:['scripts/generate-ledgers.mjs','ledger generation executed'],CommonJS:['services/gateway/dist/main.js','actual gateway process'],
 JavaScript:['scripts/runtime-policy.mjs','Vitest executes policy'],YAML:['compose.yaml','actual YAML parser + policy tests'],
 REST:['services/gateway/src/main.ts','HTTP GET/POST integration verified']
};
for(const technology of technologies.technologies) {
  if(versions[technology.name])technology.version=versions[technology.name];
  if(used[technology.name]){technology.status='verified-current-role';technology.implementation=[used[technology.name][0]];technology.verification=[used[technology.name][1]];}
  if(technology.name==='RxJS'){technology.status='installed-not-yet-dedicated-use';technology.implementation=['services/gateway/package.json'];technology.verification=[];}
  if(['Docker Compose','PostgreSQL','Redis','裸 SQL'].includes(technology.name)){technology.status='configured-not-runtime-verified';technology.implementation=['compose.yaml','infra/postgres/001-core.sql','services/gateway/src/runtime-store.ts'];}
}
await writeFile('docs/technologies.json',JSON.stringify(technologies,null,2)+'\n');
const checkpoint={phase:1,status:'awaiting-user-reboot',nextPhaseAuthorized:false,updatedAt:new Date().toISOString(),verified:{requirements:732,technicalCategories:34,individualTechnologies:146,promptParagraphs:51,screenshotRequirements:12,unitTests:5,browserTests:browser.stats.expected,install:'frozen-offline-passed',build:'nx-portal-and-gateway-passed',localRuntime:runtime.observations,dependencyPaths:doctor.paths,wslBinary:'F:\\OCVdeps\\wsl-app\\wslservice.exe'},outstanding:['User saves work and restarts Windows','Continue Docker installation at F: and launch Desktop','Verify active F: VHDX/dataFolder/swap and real memory ceiling before any pull/build','Pull only core images, build with bounded builder, start core and verify PostgreSQL/Redis + actual containers'],reportsRoot:path.join(deps,'runtime/reports'),sourceScope:'Only phase 1; later technologies and functions remain in ledger.'};
await writeFile('docs/phase-state.json',JSON.stringify(checkpoint,null,2)+'\n');
console.log('Phase 1 checkpoint recorded honestly: local verification passed; Docker evidence remains outstanding until reboot.');

