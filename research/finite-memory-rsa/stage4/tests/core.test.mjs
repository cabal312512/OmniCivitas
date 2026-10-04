import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { universalOperational, physicalMachine, distinguishingWitness, constructiveWitness } from '../src/operational.mjs';
import { temporalController, switchingTemporal, temporalEquivalence, orientationWordProbability, exactController } from '../src/temporal.mjs';
import { checkBellmanCertificate } from '../src/bellman-check.mjs';
import { hankelRank, similarTemporal } from '../src/hmm-structure.mjs';
import { certifiedEnvelope, replayPrefixUpper, fullInformationTail, supportSpecification } from '../src/envelope.mjs';
import { geometryModel } from '../src/geometry-model.mjs';
import { graphMomentValuations } from '../src/moment-graphs.mjs';
import { splitContribution, productLevelRelativeVariance } from '../src/splitting.mjs';
import { Polynomial, RationalFunction, phaseTypeMoments } from '../../stage3/src/phase-type.mjs';
import { enumeratePlacements } from '../../src/exact.mjs';
import { Fraction, rational, ZERO, ONE, compare, sum } from '../src/rational.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const catalogue=JSON.parse(fs.readFileSync(path.join(root,'../stage3/data/classification/feedback-4.json'))).classes;
const find=id=>catalogue.find(x=>x.id===id),periodic={L:3,k:2,boundary:'periodic'};

test('universal minimum formula equals independent minimum over the complete frozen catalogue',()=>{
  const minima=new Map(),descriptors=[];
  for(const c of catalogue){const d=universalOperational(c);descriptors.push(d);minima.set(d.key,Math.min(minima.get(d.key)??5,c.minimalStateCount));}
  assert.equal(minima.size,22077);
  descriptors.forEach(d=>assert.equal(d.minimalDeterministicOperationalStates,minima.get(d.key)));
});
test('initial failure branch is deleted only when it is not revisited after success',()=>{
  const a={outputs:[0,0,1],transitions:[[0,1],[2,2],[1,1]]},b={...a,transitions:[[2,1],[2,2],[1,1]]};
  assert.equal(universalOperational(a).key,universalOperational(b).key);
  const c={outputs:[0,1],transitions:[[0,1],[0,0]]},d={...c,transitions:[[1,1],[0,0]]};
  assert.notEqual(universalOperational(c).key,universalOperational(d).key);
});
test('a nonreusable forced initial action requires one additional stationary state',()=>{
  const d=universalOperational({outputs:[0,1],transitions:[[0,1],[1,1]]});
  assert.equal(d.continuationStates,1);assert.equal(d.initialReusableStates.length,0);assert.equal(d.minimalDeterministicOperationalStates,2);
});
test('Stage III structurally3-state example is universally exactly2-state operational',()=>{
  assert.equal(universalOperational(find(206)).key,universalOperational(find(9)).key);
  assert.equal(universalOperational(find(206)).minimalDeterministicOperationalStates,2);
});
test('geometry activation has a two-state realization at L2 and distinguishes every <=2-state controller at L3',()=>{
  const c=find(124),small={L:2,k:2,boundary:'periodic'};
  assert.equal(distinguishingWitness(c,find(6),small).status,'equivalent');
  assert.equal(physicalMachine(c,small).encoding,physicalMachine(find(6),small).encoding);
  for(const lower of catalogue.filter(x=>x.minimalStateCount<=2))assert.equal(distinguishingWitness(c,lower,periodic).status,'distinguished');
  assert.equal(universalOperational(c).minimalDeterministicOperationalStates,3);
});
test('constructive finite distinguishing witnesses exist for all distinct live one-bit laws',()=>{
  const small=catalogue.filter(x=>x.minimalStateCount<=2&&x.universalLiveness);
  for(let i=0;i<small.length;i++)for(let j=i+1;j<small.length;j++){
    const w=constructiveWitness(small[i],small[j]);assert.equal(w.status,'distinguished');
    assert.notEqual(...w.firstDifferingActions);assert(w.historyProbability.denominator!=='0');
  }
});
test('edge-emitting family includes action/next-state correlations missing from factorized HMMs',()=>{
  const p=temporalController({H:[['3/10','1/10'],['1/10','1/10']],V:[['1/10','5/10'],['2/10','6/10']]});
  assert(p.success[0][0][0].div(sum(p.success[0][0])).eq(new Fraction(3n,4n)));
  assert(p.success[1][0][0].div(sum(p.success[1][0])).eq(new Fraction(1n,6n)));
  assert.throws(()=>temporalController({H:[[1]],V:[[1]]}),/row/);
});
test('causal policy validation rejects an action coin that changes with the next outcome',()=>{
  const p=temporalController({H:[['1/2']],V:[['1/2']]});
  const invalid={...p,temporal:false,failure:[[[ONE]],[[ZERO]]]};
  assert.throws(()=>exactController(invalid,periodic),/Action probability/);
  assert.throws(()=>exactController({...p,initial:[ZERO]},periodic),/compiled/);
});
test('Hankel rank certifies positive minimality and a nonpermutation similarity preserves the law',()=>{
  const p=temporalController({initial:['1/2','1/2'],H:[['3/10','1/10'],['1/10','1/10']],V:[['1/10','5/10'],['2/10','6/10']]});
  const S=[['9/10','1/10'],['1/10','9/10']].map(row=>row.map(rational));
  assert.equal(hankelRank(p).minimumPositiveStatesExactly,2);
  const other=similarTemporal(p,S);assert.equal(temporalEquivalence(p,other).equivalent,true);
  assert(!other.success[0][0][0].eq(p.success[0][0][0]));
  assert.throws(()=>similarTemporal(p,[[ONE,ONE],[ZERO,ONE]]),/S1/);
});
test('rational row-span equivalence accepts a redundant IID realization and supplies a real witness for inequality',()=>{
  const fair=temporalController({H:[['1/2']],V:[['1/2']]}),redundant=temporalController({initial:['1/2','1/2'],H:[['1/2','1/2'],[0,0]],V:[[0,0],['1/2','1/2']]});
  assert.equal(temporalEquivalence(fair,redundant).equivalent,true);
  const biased=temporalController({H:[['3/5']],V:[['2/5']]}),w=temporalEquivalence(fair,biased);
  assert.equal(w.equivalent,false);assert.equal(w.witnessWord.length,1);
  assert(!orientationWordProbability(fair,w.witnessWord).eq(orientationWordProbability(biased,w.witnessWord)));
});
test('unreachable closed hidden states do not invalidate exact proper absorption',()=>{
  const p=temporalController({initial:[1,0],H:[['1/2',0],[0,1]],V:[['1/2',0],[0,0]]});
  const value=exactController(p,periodic,{retainBellmanCertificate:true});
  const fair=exactController(temporalController({H:[['1/2']],V:[['1/2']]}),periodic);
  for(const metric of ['coverage','absOrder','attemptsPerParticle'])assert.equal(value.metrics[metric].numerator,fair.metrics[metric].numerator);
  assert.equal(checkBellmanCertificate(p,value).status,'passed');
});
test('the independent general stochastic solver matches the frozen deterministic alternation point',()=>{
  const result=exactController(switchingTemporal(1,1),periodic);
  assert.equal(result.metrics.coverage.numerator,'21304');assert.equal(result.metrics.coverage.denominator,'24219');
  assert.equal(result.metrics.attemptsPerParticle.numerator,'84944179');assert.equal(result.metrics.attemptsPerParticle.denominator,'19310616');
});
test('the periodic density optimum is proper while the same open-boundary temporal schedule is not',()=>{
  const p=temporalController({H:[[0,1],[0,0]],V:[[0,0],[0,1]]});
  const value=exactController(p,periodic,{retainBellmanCertificate:true});
  assert.equal(value.metrics.coverage.numerator,'8');assert.equal(value.metrics.coverage.denominator,'9');
  assert.equal(value.metrics.attemptsPerParticle.numerator,'37');assert.equal(value.metrics.attemptsPerParticle.denominator,'10');
  assert.equal(checkBellmanCertificate(p,value).status,'passed');
  assert.throws(()=>exactController(p,{...periodic,boundary:'open'}),/Nonabsorbing/);
});
test('Bellman residual validation rejects a changed exact metric',()=>{
  const p=temporalController({H:[['1/2']],V:[['1/2']]}),value=exactController(p,{L:2,k:2},{retainBellmanCertificate:true});
  value.metrics.coverage.numerator='2';assert.throws(()=>checkBellmanCertificate(p,value));
});
test('three/four-state edge HMMs have independently verifiable rational absorption and reward laws',()=>{
  for(const n of [3,4]){
    const matrix=Array.from({length:n},()=>Array.from({length:n},()=>`1/${2*n}`));
    const p=temporalController({H:matrix,V:matrix}),value=exactController(p,{L:2,k:2},{retainBellmanCertificate:true});
    assert.equal(checkBellmanCertificate(p,value).status,'passed');
    assert.equal(value.metrics.coverage.numerator,'1');
  }
});
test('raw anchor-tree enumeration independently reproduces a finite-prefix upper value',()=>{
  const word='0101',model=geometryModel(periodic),specification={imbalance:'1/10',cost:'1/20'},spec=supportSpecification(model,specification);
  const tail=fullInformationTail(model,specification,word.length),lookup=new Map(model.nodes.map((x,i)=>[`${x.mask}:${x.h}`,i]));
  const placements=enumeratePlacements(3,2),M=placements[0].length;
  const walk=(mask,h,t)=>{
    const i=lookup.get(`${mask}:${h}`),node=model.nodes[i];
    if(node.jam)return spec.reward(node,t);
    if(t===word.length)return tail[i];
    return sum(placements[Number(word[t])].map(p=>(mask&p)?walk(mask,h,t+1):walk(mask|p,h+Number(word[t]==='0'),t+1))).div(new Fraction(BigInt(M)));
  };
  assert(walk(0,0,0).eq(replayPrefixUpper(periodic,word,specification,{informedTail:true})));
});
test('finite-prefix certificates enumerate every prefix and tighten the cruder global relaxation',()=>{
  const configuration={horizons:[4],multipliers:[{imbalance:'1/10',cost:'1/20'}]},loose=certifiedEnvelope(periodic,configuration),informed=certifiedEnvelope(periodic,{...configuration,informedTail:true});
  assert.equal(informed.leaves[4].length,8);assert.equal(new Set(informed.leaves[4].map(x=>x.word)).size,8);
  assert(compare(rational(`${informed.bounds[0].supportUpper.numerator}/${informed.bounds[0].supportUpper.denominator}`),rational(`${loose.bounds[0].supportUpper.numerator}/${loose.bounds[0].supportUpper.denominator}`))<=0);
  const point=exactController(switchingTemporal(1,1),periodic),Q=x=>rational(`${x.numerator}/${x.denominator}`);
  const score=Q(point.metrics.coverage).sub(rational('1/10').mul(Q(point.metrics.absOrder))).sub(rational('1/20').mul(Q(point.metrics.attemptsPerParticle)));
  assert(compare(score,Q(informed.bounds[0].supportUpper))<=0);
});
test('certificate construction refuses unsafe path counts and invalid dual multipliers',()=>{
  assert.throws(()=>certifiedEnvelope(periodic,{horizons:[17],multipliers:[{imbalance:0,cost:0}]}),/safe/);
  assert.throws(()=>certifiedEnvelope(periodic,{horizons:[2],multipliers:[{imbalance:-1,cost:0}]}),/nonnegative/);
});
test('higher-moment forest valuation yields geometric factorial constants',()=>{
  const graph=graphMomentValuations({kernel:[[new Polynomial([1,0,-1])]],maxOrder:6});
  let factorial=1n;graph.moments.forEach((x,j)=>{factorial*=BigInt(j+1);assert.equal(x.poleOrder,2*(j+1));assert.equal(x.constant.numerator,factorial.toString());});
  assert.equal(graph.determinantCalls,0);
});
test('rare-entry graphs capture moment thresholds and critical leading-constant addition',()=>{
  const kernel=[[new Polynomial(0),new Polynomial([0,0,0,0,1])],[new Polynomial(0),new Polynomial([1,0,-1])]];
  const graph=graphMomentValuations({kernel,maxOrder:3}),truth=phaseTypeMoments({kernel,maxOrder:3});
  assert.deepEqual(graph.moments.map(x=>x.poleOrder),[0,0,2]);assert.equal(graph.moments[1].constant.numerator,'3');
  graph.moments.forEach((x,j)=>assert.equal(x.constant.numerator,truth.moments[j].leading().constant.numerator));
});
test('rational kernels and support pruning have graph certificates without determinants',()=>{
  const hazard=new RationalFunction(new Polynomial([0,0,1]),new Polynomial([1,1]));
  assert.equal(graphMomentValuations({kernel:[[new RationalFunction(1).sub(hazard)]],maxOrder:2}).moments[1].poleOrder,4);
  const graph=graphMomentValuations({kernel:[[new Polynomial([1,0,-1]),new Polynomial(0)],[new Polynomial(0),new Polynomial(1)]]});
  assert.deepEqual(graph.states,[0]);assert.throws(()=>graphMomentValuations({kernel:[[new Polynomial(1)]]}),/sink tree/);
  assert.throws(()=>graphMomentValuations({kernel:[[new Polynomial([1,1])]]}),/Probability/);
});
test('unknown-entry splitting uses sampled survival weights and terminal marks only',()=>{
  const marks=[],rng={integer:()=>0};
  const value=splitContribution({particles:4,levels:3,initialState:()=>0,advanceLevel:s=>s+1,terminalMark:()=>8,rng,recordMark:(i,x)=>marks.push(x)});
  assert.equal(value.contribution,8);assert.deepEqual(value.survivorCounts,[4,4,4]);assert.equal(value.oracleCalls,16);assert.equal(marks.length,4);
});
test('particle extinction contributes zero and does not invent a conditional dwell',()=>{
  let marks=0;const value=splitContribution({particles:3,levels:2,initialState:()=>0,advanceLevel:()=>null,terminalMark:()=>{marks++;return 1;},rng:{integer:()=>0}});
  assert.equal(value.contribution,0);assert.equal(value.oracleCalls,3);assert.equal(marks,0);assert.equal(value.extinct,true);
});
test('independent exact binomial enumeration verifies unknown-entry product unbiasedness and variance',()=>{
  const ps=[new Fraction(1n,2n),new Fraction(1n,3n)],law=p=>[ONE.sub(p).mul(ONE.sub(p)),p.mul(ONE.sub(p)).mul(new Fraction(2n)),p.mul(p)];
  let mean=ZERO,second=ZERO;
  for(let i=0;i<=2;i++)for(let j=0;j<=2;j++){
    const probability=law(ps[0])[i].mul(law(ps[1])[j]),value=new Fraction(BigInt(i*j),4n);
    mean=mean.add(probability.mul(value));second=second.add(probability.mul(value.mul(value)));
  }
  assert(mean.eq(new Fraction(1n,6n)));
  const relative=second.div(mean.mul(mean)).sub(ONE),formula=ps.reduce((x,p)=>x.mul(ONE.add(ONE.sub(p).div(new Fraction(2n).mul(p)))),ONE).sub(ONE);
  assert(relative.eq(formula));assert(productLevelRelativeVariance({conditionalProbabilities:[.5,1/3],particles:2,geometricHazard:1})>0);
});
