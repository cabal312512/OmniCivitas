import fs from 'node:fs';
import path from 'node:path';
import { stageRoot, hash } from './preservation.mjs';
import { loadControllers } from './run-experiment.mjs';
import { chooseSurvivors,pareto } from '../src/frontier.mjs';
const protocol=JSON.parse(fs.readFileSync(path.join(stageRoot,'experiments/search-protocol.json'),'utf8'));
const sourcePath=path.join(stageRoot,'results/coarse-groups.json');
const source=JSON.parse(fs.readFileSync(sourcePath,'utf8')), controllers=loadControllers(), selection=[],arms=[];
for(const k of protocol.coarse.k) {
  const groups=source.groups.filter(g=>g.k===k);
  const selected=chooseSurvivors(groups,controllers,protocol.selection);
  selection.push({k,...selected,completeCoarseFrontier:pareto(groups)});
  for(const L of protocol.middle.L) for(const p of selected.chosen) arms.push({controller:p.controller,L,k,
    repetitions:protocol.middle.repetitions,seedStart:protocol.middle.seedStart+(k===8?100000:0)+(L===64?10000:0)});
}
const plan={name:'middle',kind:'exploratory',sourceCoarseSha256:hash(fs.readFileSync(sourcePath)),arms};
for(const [relative,data] of [['results/coarse-selection.json',{source:plan.sourceCoarseSha256,selection}],['experiments/middle.plan.json',plan]]) {
 const p=path.join(stageRoot,relative);if(fs.existsSync(p))throw new Error('Existing selection retained');fs.writeFileSync(p,JSON.stringify(data,null,2)+'\n');
}
console.log(JSON.stringify({arms:arms.length,runs:arms.length*protocol.middle.repetitions,perK:selection.map(s=>({k:s.k,chosen:s.chosen.length,pruned:s.prunedByCap.length}))}));
