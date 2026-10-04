import test from 'node:test';
import assert from 'node:assert/strict';
import { Fraction } from '../../src/exact.mjs';
import { Polynomial, RationalFunction, determinantPolynomial, phaseTypeMoments, phaseTypeAt,
  phaseTypeSurvival, certifyKernel, forestMeanCertificate, consecutiveExplorationKernel,
  persistentExplorationKernel, rareEntryKernel, rational } from '../src/phase-type.mjs';

test('polynomial arithmetic has exact cancellation and rational-function Laurent coefficients',()=>{
  const e=new Polynomial([0,1]),a=new Polynomial([1,-2,1]);
  assert(a.exactDiv([1,-1]).eq([1,-1]));
  assert(new RationalFunction(e.mul([1,-1]),e).eq([1,-1]));
  const x=new RationalFunction([0,3],[0,0,2]);
  assert.equal(x.leading().power,-1);assert.equal(x.leading().constant.numerator,'3');
  assert.equal(x.leading().constant.denominator,'2');
  assert(x.evaluate('1/10').eq(new Fraction(15n)));
  assert(rational('-2.5e-3').eq(new Fraction(-1n,400n)));
});

test('fraction-free determinant uses row pivots and matches independent permutation expansion',()=>{
  const a=[[0,[0,1],1],[1,[1,-1],0],[[0,1],0,2]];
  let reference=new Polynomial(0);
  const permutations=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  for(const p of permutations){let inversions=0;for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)if(p[i]>p[j])inversions++;let w=new Polynomial([inversions%2?-1:1]);for(let i=0;i<3;i++)w=w.mul(a[i][p[i]]);reference=reference.add(w);}
  assert(determinantPolynomial(a).eq(reference));
});

test('Bernstein certificate verifies polynomial stochastic constraints rather than a floating grid',()=>{
  assert(certifyKernel({kernel:consecutiveExplorationKernel(3)}).certifiedOnUnitInterval);
  assert(certifyKernel({kernel:rareEntryKernel({entryPower:2,escapePower:3})}).certifiedOnUnitInterval);
  assert.equal(certifyKernel({kernel:[[[1,1]]]}).certifiedOnUnitInterval,false);
  assert.throws(()=>phaseTypeMoments({kernel:[[[1,1]]]}),/certificate/);
});

test('one-state geometric absorption moments agree with independent closed formulas',()=>{
  const x=phaseTypeMoments({kernel:[[[1,-1]]],maxOrder:4});
  const p=new Polynomial([0,1]);
  assert(x.moments[0].eq(new RationalFunction(1,p)));
  assert(x.moments[1].eq(new RationalFunction([2,-1],p.mul(p))));
  assert(x.moments[2].eq(new RationalFunction([6,-6,1],p.mul(p).mul(p))));
  assert(x.moments[3].eq(new RationalFunction([24,-36,14,-1],p.mul(p).mul(p).mul(p))));
  assert.equal(phaseTypeAt({kernel:[[[1,-1]]],epsilon:0}).almostSure,false);
  assert.equal(phaseTypeSurvival({kernel:[[[1,-1]]],epsilon:'1/2',attempts:5}).value,1/32);
});

test('persistent progress is a counterexample to shortest-exploration-path exponent',()=>{
  const kernel=persistentExplorationKernel(2),x=phaseTypeMoments({kernel});
  assert(x.moments[0].eq(new RationalFunction([2,2],[0,1])));
  const forest=forestMeanCertificate({kernel});
  assert.equal(forest.shortestEscapeWeight[0],2);
  assert.equal(forest.meanLeading[0].poleOrder,1);
  assert.equal(forest.meanLeading[0].constant.value,2);
  assert.equal(forest.tree.valuation,2);assert.equal(forest.meanNumerators[0].valuation,1);
  assert.deepEqual(x.moments.map(m=>m.leading().constant.value),[2,6,24,120]);
});

test('resetting consecutive exploration has exact orders two and three within at most four states',()=>{
  for(const r of [1,2,3]){
    const kernel=consecutiveExplorationKernel(r),x=phaseTypeMoments({kernel});
    const numerator=Array(r+1).fill(1);numerator[r]=2;
    const denominator=Array(r+1).fill(0);denominator[r]=1;
    assert(x.moments[0].eq(new RationalFunction(numerator,denominator)));
    assert.deepEqual(x.moments.map(m=>m.leading().poleOrder),[r,2*r,3*r,4*r]);
    assert.deepEqual(x.moments.map(m=>m.leading().constant.value),[1,2,6,24]);
    assert(forestMeanCertificate({kernel}).identityVerified);
    assert.equal(phaseTypeAt({kernel,epsilon:0}).almostSure,false);
  }
});

test('rare entry changes initial-state moment poles and zero-endpoint reachability',()=>{
  for(const [s,r] of [[1,1],[2,2],[3,2],[1,2]]){
    const kernel=rareEntryKernel({entryPower:s,escapePower:r}),x=phaseTypeMoments({kernel});
    const ePower=Array(s+1).fill(0);ePower[s]='1/2';
    const exit=Array(r+1).fill(0);exit[r]=1;
    assert(x.moments[0].eq(new RationalFunction(1).add(new RationalFunction(ePower,exit))));
    const at0=phaseTypeAt({kernel,epsilon:0});assert.equal(at0.almostSure,true);assert.deepEqual(at0.states,[0]);assert.equal(at0.moments[0].value,1);
    assert(forestMeanCertificate({kernel}).identityVerified);
    assert.equal(x.moments[0].leading().poleOrder,Math.max(0,r-s));
  }
  const balanced=phaseTypeMoments({kernel:rareEntryKernel({entryPower:2,escapePower:2})});
  assert.equal(balanced.moments[0].leading().constant.value,1.5);
  assert.equal(balanced.moments[1].leading().poleOrder,2);assert.equal(balanced.moments[1].leading().constant.value,1);
});

test('endpoint failure branches that lead to both success and closed deadlock have exact absorption probability',()=>{
  const kernel=[[0,'1/2'],[0,1]];
  const x=phaseTypeAt({kernel,epsilon:0});
  assert.equal(x.almostSure,false);assert.equal(x.absorptionProbability.value,.5);
  assert(x.moments.every(m=>m===null));
  assert.throws(()=>phaseTypeMoments({kernel}),/nonabsorbing/);
  const unused=phaseTypeAt({kernel:[[0,0],[0,1]],epsilon:0});assert(unused.almostSure);assert.equal(unused.moments[0].value,1);
});

test('two-root forests and determinants agree for independently selected complete four-state kernel',()=>{
  const kernel=[['1/8',[0,'1/8'],'1/4',0],['1/8','1/4',0,[0,'1/4']],[0,'1/8','1/8','1/4'],[[0,'1/8'],0,'1/8','1/4']];
  const f=forestMeanCertificate({kernel}),x=phaseTypeMoments({kernel});
  assert.equal(f.identityVerified,true);assert(f.treeCount>1);
  for(let i=0;i<4;i++)assert(x.stateMoments[0][i].eq(new RationalFunction(f.meanNumerators[i],f.tree)));
});

test('moments agree with an independent finite-prefix attempt recurrence and rigorously bounded geometric tail',()=>{
  const kernel=[['1/4','1/4'],['1/8','1/8']],x=phaseTypeAt({kernel,epsilon:'1/2'});
  const F=kernel.map(row=>row.map(NumberFraction));let state=[1,0],mean=0,second=0;
  for(let t=1;t<=80;t++){let absorbed=0;for(let i=0;i<2;i++)absorbed+=state[i]*(1-F[i].reduce((a,b)=>a+b,0));mean+=t*absorbed;second+=t*t*absorbed;state=[state[0]*F[0][0]+state[1]*F[1][0],state[0]*F[0][1]+state[1]*F[1][1]];}
  // Row sums <=1/2, so the unenumerated contribution is less than 1e-18.
  assert(Math.abs(mean-x.moments[0].value)<1e-12);assert(Math.abs(second-x.moments[1].value)<1e-12);
});
function NumberFraction(x){return rational(x).number();}
