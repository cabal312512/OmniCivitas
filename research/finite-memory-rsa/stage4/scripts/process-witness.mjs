import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { geometry, universalOperational } from '../src/operational.mjs';
import { stageRoot, researchRoot } from './preservation.mjs';
const output=path.join(stageRoot,'results/process-law-gap.json');
if(fs.existsSync(output))throw new Error('Refuse to overwrite process witness');
const controller=JSON.parse(fs.readFileSync(path.join(researchRoot,'stage3/data/classification/feedback-2.json'))).classes.find(x=>x.id===6);
const parameters={L:3,k:2,boundary:'periodic'},g=geometry(parameters);
const histories=[];
for(const secondSuccess of [true,false]){
  let q=0,mask=0n;const events=[];
  for(const [step,anchor] of [0,secondSuccess?3:0].entries()){
    const action=controller.outputs[q],p=g.placements[action][anchor],success=(p&mask)===0n;
    if(step===1)assert.equal(success,secondSuccess);
    if(success)mask|=p;q=controller.transitions[q][Number(success)];
    events.push({action,anchorIndex:anchor,outcome:success?'S':'F',mask:mask.toString()});
  }
  assert(g.placements.some(row=>row.some(p=>(p&mask)===0n)));
  histories.push({events,nextAction:controller.outputs[q],specificHistoryProbability:{numerator:'1',denominator:'81'}});
}
assert.deepEqual(histories.map(x=>x.nextAction),[0,1]);
fs.writeFileSync(output,JSON.stringify({schemaVersion:1,controller:controller.classId,realization:controller,parameters,histories,
  operational:universalOperational(controller),
  theorem:'Given the same planned action prefix HH, every outcome-blind orientation process has the same next-action conditional law under both positive-probability anchor/outcome histories. The feedback controller requires H after SS and V after SF; no outcome-blind law of any state count can match its full process.',
  minimumStates:2,minimumScope:'Deterministic or randomized stationary feedback realizations with actions emitted only from internal state; one-state realization has no stored outcome.',
  objectiveGapClaimed:false,observationalScope:'Full action/outcome/occupancy process, before geometric jam. This conditional-law obstruction is not a Pareto or packing advantage.'},null,2)+'\n');
console.log(JSON.stringify({status:'certified-process-law-gap',minimumStates:2,objectiveGapClaimed:false}));
