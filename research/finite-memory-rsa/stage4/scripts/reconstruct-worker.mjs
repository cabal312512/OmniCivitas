import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { universalOperational,distinguishingWitness } from '../src/operational.mjs';
import { temporalController,exactController,temporalEquivalence } from '../src/temporal.mjs';
import { certifiedEnvelope,replayPrefixUpper } from '../src/envelope.mjs';
import { checkBellmanCertificate } from '../src/bellman-check.mjs';
import { graphMomentValuations } from '../src/moment-graphs.mjs';
import { splitContribution } from '../src/splitting.mjs';
import { Polynomial,phaseTypeMoments } from '../../stage3/src/phase-type.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixture=JSON.parse(fs.readFileSync(path.join(root,'experiments/quick-fixture.json')));
const catalogue=JSON.parse(fs.readFileSync(path.join(root,'../stage3/data/classification/feedback-4.json'))).classes;
const classes=new Map();
for(const c of catalogue){const d=universalOperational(c);classes.set(d.key,d.minimalDeterministicOperationalStates);}
assert.equal(classes.size,fixture.universalClasses);
assert.deepEqual([1,2,3,4].map(n=>[...classes.values()].filter(x=>x===n).length),fixture.universalClassHistogram);
const find=id=>catalogue.find(x=>x.id===id),periodic={L:3,k:2,boundary:'periodic'};
assert.equal(universalOperational(find(206)).key,universalOperational(find(9)).key);
assert.equal(distinguishingWitness(find(124),find(6),{L:2,k:2}).status,'equivalent');
const lower=catalogue.filter(c=>c.minimalStateCount<=2);
lower.forEach(c=>assert.equal(distinguishingWitness(find(124),c,periodic).status,'distinguished'));
let supports=0;
for(const expected of fixture.envelopes){
  const actual=certifiedEnvelope(expected.parameters,{horizons:[4],multipliers:expected.multipliers,informedTail:true});
  actual.bounds.forEach((bound,i)=>{
    assert.deepEqual(bound.supportUpper,expected.bounds[i].supportUpper);
    const replay=replayPrefixUpper(expected.parameters,bound.maximizingPrefix,expected.multipliers[i],{informedTail:true});
    assert.equal(`${replay.n}/${replay.d}`,`${bound.supportUpper.numerator}/${bound.supportUpper.denominator}`);supports++;
  });
}
const edge=temporalController(fixture.edge.realization),edgeLaw=exactController(edge,periodic,{retainBellmanCertificate:true});
assert.deepEqual(edgeLaw.metrics,fixture.edge.metrics);assert.deepEqual(edgeLaw.law,fixture.edge.law);
checkBellmanCertificate(edge,edgeLaw);
const proper=temporalController({H:[[0,1],[0,0]],V:[[0,0],[0,1]]});
const law=exactController(proper,periodic,{retainBellmanCertificate:true});
assert.deepEqual(law.metrics,fixture.proper.metrics);assert.deepEqual(law.law,fixture.proper.law);
checkBellmanCertificate(proper,law);
assert.throws(()=>exactController(proper,{...periodic,boundary:'open'}),/Nonabsorbing/);
const iid=temporalController({H:[['1/2']],V:[['1/2']]}),redundant=temporalController({initial:['1/2','1/2'],H:[['1/2','1/2'],[0,0]],V:[[0,0],['1/2','1/2']]});
assert.equal(temporalEquivalence(iid,redundant).equivalent,true);
let momentTerms=0;
for(const entryPower of [3,4]){
  const entry=Array(entryPower+1).fill(0);entry[entryPower]=1;
  const kernel=[[new Polynomial(0),new Polynomial(entry)],[new Polynomial(0),new Polynomial([1,0,-1])]];
  const graph=graphMomentValuations({kernel,maxOrder:6}),algebra=phaseTypeMoments({kernel,maxOrder:6});
  graph.moments.forEach((x,j)=>{const y=algebra.moments[j].leading();assert.equal(x.power,y.power);assert.equal(x.constant.numerator,y.constant.numerator);assert.equal(x.constant.denominator,y.constant.denominator);momentTerms++;});
}
const split=splitContribution({particles:8,levels:3,initialState:()=>0,advanceLevel:s=>s+1,terminalMark:()=>2,rng:{integer:()=>0}});
assert.equal(split.contribution,2);
const extinct=splitContribution({particles:8,levels:3,initialState:()=>0,advanceLevel:()=>null,terminalMark:()=>{throw new Error('not reached');},rng:{integer:()=>0}});
assert.equal(extinct.contribution,0);
const report={status:'passed',scope:'clean-source quick reconstruction, not full rerun or website clean-clone audit',
  archivedCatalogueClasses:catalogue.length,recomputedUniversalClasses:classes.size,
  lowerStateWitnesses:lower.length,recomputedCertifiedSupports:supports,
  exactJointLaws:2,bellmanChecks:2,higherMomentLeadingTerms:momentTerms,
  splittingDeterministicChecks:2};
fs.writeFileSync(path.join(root,'quick-result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
