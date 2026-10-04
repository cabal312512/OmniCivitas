import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const state=read('docs/phase-state.json'),ledger=read('docs/requirements.json');
assert.equal(state.phase,6);assert.equal(state.status,'complete');assert.equal(state.acceptance,'docs/phase-6-acceptance.json');
assert.equal(ledger.requirements.filter(r=>r.phase===7).length,69);
const now=new Date().toISOString();
fs.writeFileSync('docs/phase-state.json',JSON.stringify({...state,phase:7,status:'in_progress',updatedAt:now,previousAcceptance:state.acceptance,acceptance:null,nextPhaseAuthorized:false,activeWork:{name:'phase-7-games-odd-generators',authorizedBy:'User: 继续下一阶段',authorizedAt:now,numberedRequirements:69,scope:'Phase 7 only; phase 8 not authorized.',status:'in_progress'}},null,2)+'\n');
const intro='2026-10-03 用户授权第七阶段：69 条 B071–122、B124–140，实际小游戏、奇葩工具和模板生成器。保留第六阶段及此前页面，默认仍为六 core；不自动开启第八阶段。当前开发中，未验收。新的鼠标/滚轮里程仅保存本站同一标签页的匿名累计数，不保存坐标或输入；Cookie 工具只创建/评估明确本站演示键，不枚举其他 Cookie。';
for(const[file,header]of [['docs/HANDOFF.md','# OmniCivitas：当前交接入口'],['docs/PROGRESS.md','# 第七阶段进行中']]){
 const previous=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
 fs.writeFileSync(file,header+'\n\n<!-- phase7-current-start -->\n'+intro+'\n<!-- phase7-current-end -->\n\n'+previous.replace(/^# /,'## 历史：'));
}
let phases=fs.readFileSync('docs/PHASES.md','utf8').replace(/\r\n/g,'\n');
phases=phases.replace('# 九阶段实施与停点','# 九阶段实施与停点\n\n<!-- phase7-current-start -->\n'+intro+'\n<!-- phase7-current-end -->\n\n以下为历史与阶段定义：');fs.writeFileSync('docs/PHASES.md',phases);
let decisions=fs.readFileSync('docs/DECISIONS.md','utf8').replace(/\r\n/g,'\n');
decisions=decisions.replace('# 已确认的约束与冲突处理','# 已确认的约束与冲突处理\n\n51. 用户授权第七阶段，仅实现 69 条 B071–122、B124–140；第八阶段不自动开始。鼠标/滚轮测量为浏览器 CSS 像素匿名累计，1 px = 1,000,000 nm 仅是荒谬演示换算，不是硬件物理量。跨本站路由仅使用 sessionStorage ocv.mileage.v1 的六个固定数值/版本键，坐标仅当前上一点留内存；损坏/过期/写拒绝时从内存开始，明确不保证跨刷新。Cookie 心理测试仅允许具名本站演示 Cookie，不枚举其他 Cookie，不请求网络。游戏采用本地基础规则，加载/等待区域不阻塞退出；当前不把任何新项标为已验收。');fs.writeFileSync('docs/DECISIONS.md',decisions);
console.log('Phase 7 authorized: 69 rows; earlier source ledgers and acceptance reports untouched. Phase 8 remains unauthorized.');
