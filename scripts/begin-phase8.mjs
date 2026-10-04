import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const state=read('docs/phase-state.json'),ledger=read('docs/requirements.json');
assert.equal(state.phase,7);assert.equal(state.status,'complete');assert.equal(ledger.requirements.filter(r=>r.phase===8).length,318);
const now=new Date().toISOString(),intro='2026-10-03 用户授权第八阶段：318 条原始要求。仅补怪异交互、视觉事故、教程/成就、原创历史代码及分散构建检查；保持现有 101 工具、扉页和失修叠层，默认六 core。最新逃跑次数、手机越界及不设停止动画按钮覆盖相应旧条款。当前开发中，未验收；第九阶段未授权。';
fs.writeFileSync('docs/phase-state.json',JSON.stringify({...state,phase:8,status:'in_progress',updatedAt:now,previousAcceptance:state.acceptance,acceptance:null,nextPhaseAuthorized:false,activeWork:{name:'phase-8-accidents-and-archaeology',authorizedBy:'User: 继续下一阶段',authorizedAt:now,numberedRequirements:318,scope:'Phase 8 only; phase 9 not authorized.',status:'in_progress'}},null,2)+'\n');
for(const [file,heading]of [['docs/HANDOFF.md','# OmniCivitas：当前交接入口'],['docs/PROGRESS.md','# 第八阶段进行中']]){const old=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');fs.writeFileSync(file,heading+'\n\n<!-- phase8-current-start -->\n'+intro+'\n<!-- phase8-current-end -->\n\n'+old.replace(/^# /,'## 历史：'));}
for(const [file,heading]of [['docs/PHASES.md','# 九阶段实施与停点'],['docs/DECISIONS.md','# 已确认的约束与冲突处理']]){const old=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');fs.writeFileSync(file,old.replace(heading,heading+'\n\n<!-- phase8-current-start -->\n'+intro+'\n<!-- phase8-current-end -->'));}
console.log('Phase 8 authorized: 318 rows; original ledgers unchanged; phase 9 not authorized.');
