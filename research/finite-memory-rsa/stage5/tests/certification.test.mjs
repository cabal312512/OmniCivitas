import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCALE,ceilDiv,upperQ } from '../src/fixed-point.mjs';
import { MaxHeap } from '../src/heap.mjs';
import { rowUpper,rootBox,splitBox,tighten,DENOMINATOR,parameterBoundEngine } from '../src/parameter-bound.mjs';
import { rowDual,rawPlacements } from '../src/verify-certificates.mjs';
import { geometryModel } from '../../stage4/src/geometry-model.mjs';
import { fullInformationTail,supportSpecification } from '../../stage4/src/envelope.mjs';
import { rational,Fraction,ZERO,ONE,sum,compare } from '../../stage4/src/rational.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f))),Q=x=>rational(`${x.numerator}/${x.denominator}`);

test('signed division always rounds upward, including negative rewards',()=>{
  assert.equal(ceilDiv(5n,2n),3n);assert.equal(ceilDiv(-5n,2n),-2n);assert.equal(ceilDiv(-6n,2n),-3n);
  assert.equal(upperQ(rational('-1/3')),ceilDiv(-SCALE,3n));assert.throws(()=>ceilDiv(1n,0n));
});
test('max heap retains the largest unresolved certificate, including negative bounds',()=>{
  const heap=new MaxHeap();for(const x of [-8n,0n,-2n,20n,20n,-100n])heap.push({upper:x});
  assert.deepEqual(Array.from({length:6},()=>heap.pop().upper),[20n,20n,0n,-2n,-8n,-100n]);assert.equal(heap.size,0);
});
test('simplex tightening rejects infeasible boxes and dyadic splitting covers the parent',()=>{
  const root=rootBox(),children=splitBox(root);assert.equal(children.length,2);assert.equal(children[0].hi[0],children[1].lo[0]);
  assert.equal(children[0].hi[0],DENOMINATOR/2);
  const invalid=rootBox();invalid.lo[0]=DENOMINATOR;invalid.lo[1]=1;assert.equal(tighten(invalid),null);
});
test('greedy bounded-simplex reward equals an independent LP dual for signed coefficients',()=>{
  let boxes=[rootBox()];for(let depth=0;depth<5;depth++)boxes=boxes.flatMap(splitBox);
  for(let i=0;i<boxes.length;i++)for(const start of [0,4]){
    const coefficients=[BigInt(-3*i-7),BigInt(5*i+2),BigInt(i%3-4),BigInt(-i)];
    assert.equal(rowUpper(coefficients,boxes[i],start),rowDual(coefficients,boxes[i],start));
  }
});
test('raw geometric anchor counts and footprint multiplicities match both tiny physical models',()=>{
  for(const boundary of ['periodic','open']){
    const p={L:3,k:2,boundary},model=geometryModel(p),raw=rawPlacements(p);assert.equal(raw[0].length,boundary==='periodic'?9:6);
    for(const node of model.nodes)assert.deepEqual(raw.map(row=>row.filter(mask=>!(mask&node.mask)).length),node.legal);
  }
  assert.equal(new Set(rawPlacements({L:2,k:2,boundary:'periodic'})[0]).size,2);
});
test('fixed-parameter finite-horizon upper agrees with a raw anchor/hidden-state tree',()=>{
  const p={L:2,k:2,boundary:'periodic'},specification={imbalance:'1/10',cost:'1/20'},T=2,model=geometryModel(p),spec=supportSpecification(model,specification),tail=fullInformationTail(model,specification,T);
  const lookup=new Map(model.nodes.map((x,i)=>[`${x.mask}:${x.h}`,i])),raw=rawPlacements(p),walk=(mask,h,t)=>{
    const i=lookup.get(`${mask}:${h}`);if(model.nodes[i].jam)return spec.reward(model.nodes[i],t);if(t===T)return tail[i];
    return sum(raw.flatMap((row,a)=>row.map(rod=>{const s=!(mask&rod);return walk(s?mask|rod:mask,h+(s&&a===0?1:0),t+1);}))).div(new Fraction(BigInt(2*raw[0].length)));
  };
  const box={lo:Array(8).fill(DENOMINATOR/4),hi:Array(8).fill(DENOMINATOR/4)},upper=parameterBoundEngine(p,specification,T).bound(box),truth=walk(0,0,0);
  assert(compare(new Fraction(upper,SCALE),truth)>=0);assert(compare(new Fraction(upper,SCALE).sub(truth),rational('1/1000000000000'))<0);
});
test('a nested parameter box cannot increase its rounded Bellman upper',()=>{
  const engine=parameterBoundEngine({L:2,k:2,boundary:'open'},{imbalance:'1',cost:'1/5'},3),root=rootBox(),parent=engine.bound(root);
  for(const child of splitBox(root))assert(engine.bound(child)<=parent);
});
test('periodic convex-dominance certificate proves every nonnegative support comparison',()=>{
  const certificate=read('results/periodic-negative.json');assert.equal(certificate.rows.length,5);
  for(const row of certificate.rows){assert(sum(row.components.map(x=>rational(x.weight))).eq(ONE));
    if(!row.feedbackMetrics)continue;
    for(const [mu,nu] of [['0','0'],['1','3/25'],['17/3','59/7']]){
      const score=m=>Q(m.coverage).sub(rational(mu).mul(Q(m.absOrder))).sub(rational(nu).mul(Q(m.attemptsPerParticle)));
      const mixture=sum(row.components.map(x=>rational(x.weight).mul(score(x.metrics))));assert(compare(mixture,score(row.feedbackMetrics))>=0);
    }
  }
});
test('density macro certificates include every first-H placement and all allowed successful paths',()=>{
  for(const g of read('results/density-limit.json').geometries){
    const raw=rawPlacements(g.parameters),lookup=new Map(g.rows.map(x=>[`${x.mask}:${x.h}`,x]));
    raw[0].forEach(rod=>assert(lookup.has(`${rod}:1`)));
    for(const node of g.rows){const legal=raw.map(row=>row.filter(rod=>!(rod&node.mask)));
      assert.equal(node.jam,legal.every(row=>!row.length));
      if(node.jam){assert.equal(node.n,4);continue;}
      const a=legal[1].length?1:0;assert.equal(a,node.action);
      legal[a].forEach(rod=>assert(lookup.has(`${rod|node.mask}:${node.h+(a===0?1:0)}`)));
    }
  }
});
test('properness audit includes all structural one-bit classes and removes real deadlocks',()=>{
  const scope=read('results/feedback-scope.json');assert.equal(scope.structuralClasses,13);
  assert.deepEqual(scope.results.map(x=>x.properPhysicalClasses.length),[5,4]);
  for(const geometry of scope.results){assert.equal(geometry.rows.length,13);assert.equal(geometry.rows.find(x=>x.controller==='feedback-4-00000').fixedGeometryProper,false);
    geometry.rows.filter(x=>x.fixedGeometryProper).forEach(x=>assert.equal(x.randomizedOperationalMinimum,2));}
});
test('each reported complete-null support is an exact ordered interval, not an optimizer optimum',()=>{
  const report=read('results/certificate-verification.json');assert.equal(report.supports.length,8);
  for(const row of report.supports){assert(compare(Q(row.lower),Q(row.upper))<=0);assert(Q(row.width).eq(Q(row.upper).sub(Q(row.lower))));}
  assert.equal(report.strictSupportSeparationFound,false);assert.equal(report.parameterLeafBoundsReplayed,9000);assert.equal(report.prefixBoundsChecked,240006);
});
