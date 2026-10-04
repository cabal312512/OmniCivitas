import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { stageRoot,hash } from './preservation.mjs';
import { verifyWordCertificate,verifyParameterCertificate,rawPlacements } from '../src/verify-certificates.mjs';
import { checkBellmanCertificate } from '../../stage4/src/bellman-check.mjs';
import { temporalController } from '../../stage4/src/temporal.mjs';
import { rational,Fraction,ZERO,ONE,sum,compare,json } from '../../stage4/src/rational.mjs';
import { SCALE } from '../src/fixed-point.mjs';
const output=path.join(stageRoot,'results/certificate-verification.json');if(fs.existsSync(output))throw new Error('Refuse overwrite');
const read=f=>JSON.parse(fs.readFileSync(path.join(stageRoot,f))),checked=[];
for(const studyName of ['word-supports','parameter-supports'])for(const result of read(`results/${studyName}.json`).results){
  if(!result.file)continue;const certificate=read(result.file);assert.equal(hash(fs.readFileSync(path.join(stageRoot,result.file))),result.sha256);
  const verification=studyName==='word-supports'?verifyWordCertificate(certificate):verifyParameterCertificate(certificate);
  checked.push({file:result.file,sha256:result.sha256,...verification});console.log(JSON.stringify({file:result.file,...verification}));
}
const lowerStudy=read('results/lower-supports.json'),lowerChecks=[];
for(const direction of lowerStudy.directions)if(direction.newExactCandidateFile){const file=direction.newExactCandidateFile,candidate=read(file);
  lowerChecks.push({file,sha256:hash(fs.readFileSync(path.join(stageRoot,file))),...checkBellmanCertificate(temporalController(candidate.realization),candidate)});}
const negative=read('results/periodic-negative.json');for(const entry of negative.rows){
  assert(sum(entry.components.map(x=>rational(x.weight))).eq(ONE));if(!entry.feedbackMetrics)continue;
  const actual=['coverage','absOrder','attemptsPerParticle'].map(name=>sum(entry.components.map(x=>rational(x.weight).mul(rational(`${x.metrics[name].numerator}/${x.metrics[name].denominator}`)))));
  const target=['coverage','absOrder','attemptsPerParticle'].map(name=>rational(`${entry.feedbackMetrics[name].numerator}/${entry.feedbackMetrics[name].denominator}`));
  assert(compare(actual[0],target[0])>=0&&compare(actual[1],target[1])<=0&&compare(actual[2],target[2])<=0);
}
for(const geometry of read('results/density-limit.json').geometries){
  const anchors=rawPlacements(geometry.parameters),byKey=new Map(geometry.rows.map(x=>[`${x.mask}:${x.h}`,x]));
  for(const row of geometry.rows){if(row.jam){assert.equal(row.n,4);continue;}
    const legal=anchors.map(list=>list.filter(p=>!(p&row.mask))),a=legal[1].length?1:0;assert.equal(a,row.action);
    for(const p of legal[a])assert(byKey.has(`${p|row.mask}:${row.h+(a===0?1:0)}`));
  }
}
const word=read('results/word-supports.json'),parameter=read('results/parameter-supports.json'),archive=JSON.parse(fs.readFileSync(path.join(stageRoot,'../stage4/results/capability-search.json')));
const supports=lowerStudy.directions.map(d=>{
  const density=d.imbalance==='0'&&d.cost==='0',lower=density?rational('8/9'):rational(d.lower),upper=density?rational('8/9'):
    [rational(word.results.find(x=>x.index===d.index).upper),rational(parameter.results.find(x=>x.index===d.index).upper)].reduce((a,b)=>compare(a,b)<0?a:b);
  assert(compare(lower,upper)<=0);const mu=rational(d.imbalance),nu=rational(d.cost);
  const feedback=archive.outcomes.find(x=>x.parameters.boundary===d.boundary).feedback.filter(x=>x.structuralStates<=2).map(x=>{
    const Q=y=>rational(`${y.numerator}/${y.denominator}`),score=Q(x.metrics.coverage).sub(mu.mul(Q(x.metrics.absOrder))).sub(nu.mul(Q(x.metrics.attemptsPerParticle)));
    return {controller:x.policy,reward:json(score),feedbackMinusTemporalSupport:{lower:json(score.sub(upper)),upper:json(score.sub(lower))},strictCrossing:compare(score,upper)>0};
  });
  return {index:d.index,boundary:d.boundary,mu:d.imbalance,nu:d.cost,lower:json(lower),upper:json(upper),width:json(upper.sub(lower)),feedback,
    lowerKind:density?'Supremum lower from proper approximating family; finite attainment not asserted on open':'Exact feasible <=2-state realization',
    status:density?'certified-equality':d.boundary==='periodic'?'certified-feedback-support-negative; temporal support interval unresolved':'certified-unresolved-interval'};
});
const report={schemaVersion:1,status:'passed',checked,lowerChecks,supports,
  prefixBoundsChecked:checked.reduce((n,x)=>n+(x.prefixBounds??0),0),parameterLeafBoundsReplayed:checked.reduce((n,x)=>n+(x.replayedLeafBounds??0),0),
  lowerBellmanScalarEquations:lowerChecks.reduce((n,x)=>n+x.exactScalarEquations,0),strictSupportSeparationFound:supports.some(x=>x.feedback.some(f=>f.strictCrossing)),
  scope:'Periodic all-nonnegative-direction negative theorem is separate from support intervals. Open order/cost frontier and arbitrary stochastic feedback remain unresolved.'};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'passed',supports:supports.length,strictSeparation:report.strictSupportSeparationFound}));
