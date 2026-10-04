import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { temporalController,exactController } from '../../stage4/src/temporal.mjs';
import { checkBellmanCertificate } from '../../stage4/src/bellman-check.mjs';
import { rational,ZERO,ONE,sum,compare } from '../../stage4/src/rational.mjs';
import { wordBoundEngine } from '../src/word-bound.mjs';
import { parameterBoundEngine,rootBox,splitBox,rowUpper } from '../src/parameter-bound.mjs';
import { rawPlacements,rowDual,verifyWordCertificate,verifyParameterCertificate } from '../src/verify-certificates.mjs';
import { SCALE } from '../src/fixed-point.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),fixture=JSON.parse(fs.readFileSync(path.join(root,'experiments/quick-fixture.json')));
let equations=0;
for(const expected of fixture.candidates){
  const policy=temporalController(expected.realization),result=exactController(policy,expected.parameters,{retainBellmanCertificate:true});
  assert.deepEqual(result.metrics,expected.metrics);assert.equal(crypto.createHash('sha256').update(JSON.stringify(result.law)).digest('hex'),expected.lawSha256);
  equations+=checkBellmanCertificate(policy,result).exactScalarEquations;
}
const macroCounts=[];
for(const expected of fixture.densityExpected){
  const placements=rawPlacements(expected.parameters),queue=placements[0].map(mask=>({mask,h:1})),seen=new Set(queue.map(x=>`${x.mask}:${x.h}`));let terminalAtoms=0;
  for(let cursor=0;cursor<queue.length;cursor++){
    const node=queue[cursor],legal=placements.map(row=>row.filter(mask=>!(mask&node.mask)));
    if(!legal[0].length&&!legal[1].length){assert.equal(node.mask.toString(2).replaceAll('0','').length,8);terminalAtoms++;continue;}
    const action=legal[1].length?1:0;
    for(const rod of legal[action]){const next={mask:rod|node.mask,h:node.h+(action===0?1:0)},key=`${next.mask}:${next.h}`;if(!seen.has(key)){seen.add(key);queue.push(next);}}
  }
  assert.equal(queue.length,expected.macroStates);assert.equal(terminalAtoms,expected.terminalAtoms);macroCounts.push({boundary:expected.parameters.boundary,states:queue.length,terminalAtoms});
}
for(const row of fixture.negative.rows){assert(sum(row.components.map(x=>rational(x.weight))).eq(ONE));if(!row.feedbackMetrics)continue;
  const actual=['coverage','absOrder','attemptsPerParticle'].map(name=>sum(row.components.map(x=>rational(x.weight).mul(rational(`${x.metrics[name].numerator}/${x.metrics[name].denominator}`)))));
  const target=['coverage','absOrder','attemptsPerParticle'].map(name=>rational(`${row.feedbackMetrics[name].numerator}/${row.feedbackMetrics[name].denominator}`));
  assert(compare(actual[0],target[0])>=0&&compare(actual[1],target[1])<=0&&compare(actual[2],target[2])<=0);
}
const parameters={L:3,k:2,boundary:'open'},specification={imbalance:'5/4',cost:'2/5'},word=wordBoundEngine(parameters,specification),records=[],states=[];
function add(state,parent,action){const id=records.length,upper=word.upper(state);records.push({id,parent,action,depth:state.word.length,upper:upper.toString(),status:state.word.length<5?'expanded':'frontier'});states.push(state);return id;}
add(word.advance(word.initial,0),-1,0);
for(let id=0;id<records.length;id++)if(records[id].status==='expanded')for(const a of [0,1])add(word.advance(states[id],a),id,a);
const wordUpper=records.filter(x=>x.status==='frontier').map(x=>BigInt(x.upper)).reduce((a,b)=>a>b?a:b);
const wordCertificate={parameters,specification,lower:'-100/1',upperFixed:wordUpper.toString(),records,
  tailCertificates:[...word.tails].map(([t,values])=>({t,values:values.map(x=>`${x.n}/${x.d}`)}))};
const wordCheck=verifyWordCertificate(wordCertificate);
const parameter=parameterBoundEngine(parameters,specification,4),boxes=[rootBox(),...splitBox(rootBox())],parameterRecords=boxes.map((box,id)=>({id,parent:id?0:-1,box,upper:parameter.bound(box).toString(),status:id?'frontier':'expanded'}));
const parameterUpper=parameterRecords.slice(1).map(x=>BigInt(x.upper)).reduce((a,b)=>a>b?a:b);
const parameterCheck=verifyParameterCertificate({parameters,specification,horizon:4,lower:'-100/1',upperFixed:parameterUpper.toString(),records:parameterRecords});
const coefficients=[-10n,3n,11n,-7n];for(const box of boxes)for(const q of [0,4])assert.equal(rowUpper(coefficients,box,q),rowDual(coefficients,box,q));
const report={status:'passed',exactNewLowerCases:fixture.candidates.length,bellmanScalarEquations:equations,
  freshMacroTraversal:macroCounts,negativeCertificateRows:fixture.negative.rows.length,
  freshWordPrefixCertificate:wordCheck,freshParameterCertificate:parameterCheck,
  scope:'Current-source independent directory reconstruction of new exact cases and small fresh certificates; not replay of old experiments or all 240006 prefixes.'};
fs.writeFileSync(path.join(root,'quick-result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
