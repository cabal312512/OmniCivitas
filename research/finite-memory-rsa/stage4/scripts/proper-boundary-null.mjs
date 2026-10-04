import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { temporalController, exactController, universalTemporalLiveness } from '../src/temporal.mjs';
import { stageRoot } from './preservation.mjs';
const output=path.join(stageRoot,'results/proper-boundary-null.json');
if(fs.existsSync(output))throw new Error('Refuse to overwrite proper-boundary certificate');
const policy=temporalController({name:'H-once-V-forever',H:[[0,1],[0,0]],V:[[0,0],[0,1]]});
const parameters={L:3,k:2,boundary:'periodic'};
const result=exactController(policy,parameters,{retainBellmanCertificate:true});
assert.equal(result.metrics.coverage.numerator,'8');assert.equal(result.metrics.coverage.denominator,'9');
assert.equal(result.metrics.absOrder.numerator,'1');assert.equal(result.metrics.absOrder.denominator,'2');
assert.equal(result.metrics.attemptsPerParticle.numerator,'37');assert.equal(result.metrics.attemptsPerParticle.denominator,'10');
fs.writeFileSync(output,JSON.stringify({...result,realization:{initial:[1,0],H:[[0,1],[0,0]],V:[[0,0],[0,1]]},
  abstractLiveness:universalTemporalLiveness(policy),fixedGeometryProper:true,
  densityOnlyGlobalOptimum:true,
  theorem:'On the periodic3x3 domino lattice the first H leaves two columns with exactly two free cells and one empty column. V-only sampling accepts exactly one rod per column, then geometrically jams at4 rods. Coverage<=8/9 for every controller, so the complete <=4-state stochastic temporal density envelope equals8/9, attained with2 states.',
  independentKineticCalculation:'First trial1 plus coupon waiting9+9+3-9/2-9/4-9/4+9/5=69/5; total74/5, divide by4 gives37/10.',
  constraints:'The tight density-only result does not determine the joint imbalance/cost envelope. The same H-once-V-forever schedule is not proper on open3x3; no open-boundary equality is claimed.'},null,2)+'\n');
console.log(JSON.stringify({status:'tight-global-density-envelope',coverage:result.metrics.coverage.value,cost:result.metrics.attemptsPerParticle.value,abs:result.metrics.absOrder.value}));
