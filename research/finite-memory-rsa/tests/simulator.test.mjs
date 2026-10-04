import test from 'node:test';
import assert from 'node:assert/strict';
import {RNG} from '../src/rng.mjs';
import {Lattice} from '../src/lattice.mjs';
import {simulate,deterministicEvent} from '../src/simulate.mjs';
import {decodeController} from '../src/controllers.mjs';

test('Seeded uint32 RNG is repeatable and bounded sampling never leaves its domain',()=>{
 const a=new RNG(123),b=new RNG(123),values=Array.from({length:1000},()=>a.uint32());assert.deepEqual(values,Array.from({length:1000},()=>b.uint32()));assert.ok(new Set(values).size>990);
 for(const n of [1,3,8,255,10000]){const rng=new RNG(n);for(let i=0;i<10000;i++){const v=rng.integer(n);assert.ok(v>=0&&v<n);}}
});
test('Incremental legal sets match independent full footprints after every deposition across both boundaries',()=>{
 for(const boundary of ['open','periodic'])for(const L of [2,3,6,9])for(const k of [1,2,L]){
  const lat=new Lattice(L,k,boundary),rng=new RNG(L*200+k);lat.validate();
  while(lat.counts[0]+lat.counts[1]){const o=lat.counts[0]&&lat.counts[1]?rng.integer(2):Number(!lat.counts[0]);lat.place(o,lat.legal[o][rng.integer(lat.counts[o])]);lat.validate();}
 }
});
test('Monomers exactly fill every site for every controller and a memoryless baseline',()=>{
 for(const c of [...Array(64).keys(),'random-0.5'])for(const engine of ['event','direct']){const r=simulate({L:5,k:1,controller:c,seed:7,engine});assert.equal(r.coverage,1);assert.equal(r.deadlock,0);assert.equal(r.particles,25);}
});
test('No simulation declares jamming from a failure cutoff; reported deadlocks have residual placements',()=>{
 for(const c of [...Array(64).keys(),'random-0.5'])for(const boundary of ['periodic','open']){
  const r=simulate({L:8,k:3,controller:c,boundary,seed:239,validate:true});assert.equal(r.deadlock,Number(r.legal_h+r.legal_v>0));assert.equal(r.attempts,r.particles+r.failures);assert.ok(r.coverage<=1);
  if([17,19,25,27,33,35,41,43,'random-0.5'].includes(c))assert.equal(r.deadlock,0);
 }
});
test('Deterministic event cycles preserve first-success probabilities and waiting-time law',()=>{
 const c=decodeController(35),M=100,counts=[20,50],N=60000,rng=new RNG(71);let h=0,total=0;
 for(let i=0;i<N;i++){const e=deterministicEvent(c,0,counts,M,rng);h+=e.o===0;total+=e.failures[0]+e.failures[1]+1;}
 const probability=.2/(.2+.8*.5),expected=(1+.8)/(1-.8*.5);assert.ok(Math.abs(h/N-probability)<.01);assert.ok(Math.abs(total/N-expected)<.04);
});
test('Direct and exact-event engines agree in small-system distributions for feedback and null policies',()=>{
 for(const c of [17,19,22,25,'random-0.5']){
  let event=0,direct=0,ed=0,dd=0;const n=4000;
  for(let i=0;i<n;i++){const x=simulate({L:3,k:2,controller:c,seed:5000+i}),y=simulate({L:3,k:2,controller:c,seed:5000+i,engine:'direct'});event+=x.coverage;direct+=y.coverage;ed+=x.deadlock;dd+=y.deadlock;}
  assert.ok(Math.abs(event/n-direct/n)<.012);assert.ok(Math.abs(ed/n-dd/n)<.035);
 }
});
