import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { stageRoot,researchRoot } from './preservation.mjs';
import { geometry,distinguishingWitness } from '../src/operational.mjs';
const output=path.join(stageRoot,'results/activation-randomized-lower-bound.json');
if(fs.existsSync(output))throw new Error('Refuse to overwrite activation certificate');
const catalogue=JSON.parse(fs.readFileSync(path.join(researchRoot,'stage3/data/classification/feedback-4.json'))).classes;
const target=catalogue.find(x=>x.id===124),smallRealization=catalogue.find(x=>x.id===6),parameters={L:3,k:2,boundary:'periodic'},g=geometry(parameters);
const histories=[];
for(const anchors of [[0,0],[0,3,0]]){
  let mask=0n,q=0;const events=[];
  for(const anchor of anchors){const action=target.outputs[q],p=g.placements[action][anchor],success=(p&mask)===0n;
    if(success)mask|=p;q=target.transitions[q][Number(success)];events.push({action,anchorIndex:anchor,outcome:success?'S':'F',mask:mask.toString()});}
  assert(g.placements.some(row=>row.some(p=>(p&mask)===0n)));
  histories.push({events,nextAction:target.outputs[q],specificProbability:{numerator:'1',denominator:(BigInt(g.M)**BigInt(anchors.length)).toString()}});
}
assert.deepEqual(histories.map(x=>x.nextAction),[1,0]);
const small=distinguishingWitness(target,smallRealization,{L:2,k:2,boundary:'periodic'});assert.equal(small.status,'equivalent');
fs.writeFileSync(output,JSON.stringify({schemaVersion:1,controller:target.classId,realization:target,parameters,histories,
  minimalOperationalStates:{L2:2,L3:3,randomizedFeedbackAllowed:true},
  smallSystemRealization:smallRealization.classId,smallEquivalence:small,
  lowerBound:'The target prescribes deterministic H and V actions on positive histories. Any two-state randomized realization must therefore have one H-only and one V-only emission state. Both histories immediately before their final failure prescribe H, hence concentrate on the same hidden H-only state. Given H and F, its outcome-dependent next-state kernel is identical for both histories: anchor failure likelihood cancels. It cannot prescribe V after SF and H after SSF. Thus two states are impossible, even for edge-emitting randomized feedback.',
  oneStateLowerBound:'Initial action is surely H, but a positive SF history requires V before jam. A stationary one-state emission cannot do both.',
  threeStateUpperBound:'The displayed deterministic3-state controller is itself a valid realization.',
  minimalGeometry:'For fixed k2, smallest admissible L is2. Two states suffice there and fail atL3, so activation threshold is exactly3 under periodic boundaries.',
  scope:'This strengthens one explicit threshold to randomized operational memory. Complete catalogue histograms remain deterministic-realization minima; no general stochastic positive-realization minimization is claimed.'},null,2)+'\n');
console.log(JSON.stringify({status:'certified-randomized-memory-activation',minimumL2:2,minimumL3:3}));
