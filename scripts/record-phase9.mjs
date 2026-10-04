import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const reports=path.join(process.env.OCV_DEPS_ROOT||os.tmpdir(),'runtime/reports');
const audit=read('docs/phase9-final-audit.json');
const runtime=read(path.join(reports,'phase9-release-runtime.json'));
assert.equal(audit.status,'completed-scoped-audit');assert.equal(runtime.status,'passed');
assert.equal(runtime.originalLicenseResources,20);
const proofs=['phase9-source-baseline.json','phase9-public-source-audit.json','phase9-language-tests.json','phase9-legacy.json','phase9-everything.json','phase9-maximum-resource-snapshot.json','phase9-browser.json','phase9-cypress.log','phase9-clean-windows-install.log','phase9-clean-windows-build.log','phase9-clean-windows-test.log','phase9-clean-windows-test-calculation.log','phase9-clean-windows-node-tests.log','phase9-clean-windows-build-next.log','phase9-clean-dev-runtime-verification.json','phase9-clean-dev-websocket.json','phase9-clean-linux-build.log','phase9-clean-linux-runtime.json','phase9-clean-linux-stopped.json','phase9-clean-compose.json','phase9-clean-compose-core-storage-verification.json','phase9-clean-compose-runtime-verification.json','phase9-final-runtime-verification.json','phase9-release-runtime.json'];
const evidence=proofs.map(file=>{const bytes=fs.readFileSync(path.join(reports,file));return {file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}});
const now=new Date().toISOString();
const acceptance={phase:9,status:'complete-with-validation-limits',acceptedAt:now,nextPhaseAuthorized:false,previousAcceptance:'docs/phase-8-acceptance.json',requirementAudit:'docs/phase9-final-audit.json',requirementTable:'docs/PHASE-9-REQUIREMENTS.md',portability:'docs/PUBLIC-RELEASE.md',licenseAudit:'docs/PHASE-9-LICENSES.md',counts:audit.counts,dispositions:audit.dispositions,technologyRoles:audit.technologyRoles,tests:{legacyActualChecks:50,maximumActualChecks:80,maximumHealthyServices:24,nativeLanguageFrameworks:6,nativeAssertions:12,linuxSingleRun:{vitest:299,node:6,jest:3},windows:{initialWorkspace:{vitest:295,node:6},cleanFullRun:{passed:298,failedColdImport:1},afterTimeoutFix:{affectedGroup:17,node:6},singleFullPassingRun:false},cypress:2,productionFocusedBrowser:{passed:4,failed:0,skipped:0,flaky:0},cleanComposeStorageChecks:13,scope:'Fresh runs named separately; historical full suites and full natural game ascent were not rerun.'},runtime:{entrance:runtime.base,services:runtime.services,builderRunning:runtime.builderRunning,optionalServicesStopped:true,ownedTemporaryPreviewsStopped:true,maximumContainerCapsMiB:7840,dailyContainerCapsMiB:1728},publicRelease:{status:'completed-with-platform-validation-limits',standardInstallBuildDevVerified:true,cleanComposeFreshNamedVolumesVerified:true,windowsHostVerified:true,linuxContainerUserspaceVerified:true,linuxEngineHostVerified:false,macOSHostVerified:false,remoteCIRun:false,publishedToGitHub:false,sourceSnapshot:'Independent temporary Git repository; main workspace has no Git repository created by this task',finalTrackedFileScan:'phase9-public-final-source-audit.json',finalExactCloneComparison:'phase9-final-clone-fidelity.json'},licenseDelivery:{originalResources:20,emittedInventories:runtime.inventory,scope:'Original MIT plus required notices for actually distributed code; not clearance of third-party media'},freeze:audit.freeze,limitations:audit.limitations,evidence,evidenceRoot:'Local runtime reports selected by OCV_DEPS_ROOT; raw proofs are not copied as runtime data into the public repository'};
fs.writeFileSync('docs/phase-9-acceptance.json',JSON.stringify(acceptance,null,2)+'\n');
const state=read('docs/phase-state.json');
state.phase=9;state.status=acceptance.status;state.updatedAt=now;state.acceptance='docs/phase-9-acceptance.json';state.previousAcceptance='docs/phase-8-acceptance.json';state.nextPhaseAuthorized=false;
state.outstanding=[{item:'macOS and independent Linux Engine host execution',status:'unverified-host-unavailable'},{item:'Remote CI execution',status:'not-run-no-publication-authorized'},{item:'Full natural tower ascent and Boss win',status:'not-rerun-under-user-brief-test-scope'}];
state.publicRelease={...acceptance.publicRelease,auditPhase:9,cleanCloneVerified:true,allHostPlatformsVerified:false};
state.activeWork={...state.activeWork,status:acceptance.status,finishedAt:now};
state.mediaNotice.fullCodeLicenseAuditComplete=true;state.mediaNotice.fullCodeLicenseAuditScope='Actually distributed code/known source references; third-party media authorization not claimed';
fs.writeFileSync('docs/phase-state.json',JSON.stringify(state,null,2)+'\n');
const current='2026-10-04：网站第九阶段本轮授权工作已完成并停止（complete-with-validation-limits）。732要求独立逐条审计，146技术当前角色登记，12公开要求、干净Windows/Linux用户空间及新卷Compose验收均已记录；未验证的独立Linux/macOS宿主、远程CI和完整自然登塔另列，不冒充通过。原三账本/两源文档、1266科学文件/五封存及23科研UI/音乐源不变。仅六健康core，builder/可选服务及临时预览已停；不发布GitHub、不生成PDF、不扩展科研，不自动继续。入口 docs/PHASE-9-ACCEPTANCE.md，逐条 docs/PHASE-9-REQUIREMENTS.md，机器报告 docs/phase9-final-audit.json / phase-9-acceptance.json；公开版 docs/PUBLIC-RELEASE.md，许可 docs/PHASE-9-LICENSES.md。以下“未授权/进行中”条目仅为历史。';
for(const file of ['docs/HANDOFF.md','docs/PHASES.md','docs/PROGRESS.md','docs/DECISIONS.md']){
  let text=fs.readFileSync(file,'utf8');assert.ok(text.includes('<!-- phase9-current-start -->'));
  text=text.replace(/<!-- phase9-current-start -->[\s\S]*?<!-- phase9-current-end -->/,'<!-- phase9-current-start -->\n'+current+'\n<!-- phase9-current-end -->');
  if(file==='docs/PROGRESS.md')text=text.replace(/^# 第八阶段已完成并停止/,'# 第九阶段审计完成并停止（验证范围见报告）');
  if(file==='docs/HANDOFF.md')text=text.replace('<!-- phase9-current-end -->','<!-- phase9-current-end -->\n\n最终文件地图：公开入口 .npmrc / nx.json / scripts/dev-server.mjs；本机辅助 ocv.ps1 / scripts/Enter-OcvEnvironment.ps1；24服务 compose.yaml / config/runtime-plan.json；请求边界 services/archive/src/api/guards.mjs，存储降级 config/apps/portal/src/js/db.mjs；实际许可收集 scripts/bundle-license-notices.mjs；本轮 tests/frameworks/、tests/browser/phase9.spec.mjs、tests/archive-guards.test.mjs、tests/cabinet-fallback.test.mjs；科研交接仍见本文件 finite-memory-rsa-stage5-current 小节及 research/finite-memory-rsa/README.md（暂停Stage V，禁止自动扩展）。本轮未重做视觉；现有窗口和功能入口见之前的独立地图。');
  fs.writeFileSync(file,text);
}
console.log(JSON.stringify({status:acceptance.status,counts:audit.counts,core:runtime.services.length,researchUnchanged:audit.freeze.unchanged},null,2));
