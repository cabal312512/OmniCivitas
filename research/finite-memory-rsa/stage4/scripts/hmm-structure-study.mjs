import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { stageRoot } from './preservation.mjs';
import { temporalController,temporalEquivalence } from '../src/temporal.mjs';
import { hankelRank,similarTemporal } from '../src/hmm-structure.mjs';
import { rational } from '../src/rational.mjs';
const output=path.join(stageRoot,'results/hmm-structure.json');
if(fs.existsSync(output))throw new Error('Refuse to overwrite HMM structure');
const main=JSON.parse(fs.readFileSync(path.join(stageRoot,'results/capability-search.json')));
const examples=main.outcomes[0].temporal.filter(x=>x.policy.startsWith('edge-')||x.policy==='IID-fair').map(row=>{
  const policy=temporalController(row.realization);return {name:row.policy,...hankelRank(policy)};});
const base=temporalController({name:'positive-edge-2',initial:['1/2','1/2'],H:[['3/10','1/10'],['1/10','1/10']],V:[['1/10','5/10'],['2/10','6/10']]});
const S=[['9/10','1/10'],['1/10','9/10']].map(row=>row.map(rational));
const transformed=similarTemporal(base,S),equivalence=temporalEquivalence(base,transformed);assert.equal(equivalence.equivalent,true);
const serialize=p=>({initial:p.initial.map(x=>`${x.n}/${x.d}`),H:p.success[0].map(row=>row.map(x=>`${x.n}/${x.d}`)),V:p.success[1].map(row=>row.map(x=>`${x.n}/${x.d}`))});
fs.writeFileSync(output,JSON.stringify({schemaVersion:1,computedAtUTC:new Date().toISOString(),
  fullFamilyDegreesOfFreedom:[1,2,3,4].map(n=>({states:n,parameters:2*n*n-1})),examples,
  nonPermutationEquivalence:{base:serialize(base),transformed:serialize(transformed),similarity:S.map(row=>row.map(x=>`${x.n}/${x.d}`)),equivalence,rank:hankelRank(base)},
  universalOperationalEquivalence:'For fixed k and all sufficiently large valid square geometries, any finite orientation word can be paired with a positive-probability all-success anchor history. Its process-trace probability is the orientation-word probability times M^(-length). Thus universal RSA operational equivalence of temporal HMMs is exactly their planned-word law equivalence.',
  fullPositiveMinimalitySolved:false},null,2)+'\n');
console.log(JSON.stringify({status:'complete',ranks:examples,nonPermutationEquivalent:equivalence.equivalent}));
