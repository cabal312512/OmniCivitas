import test from 'node:test';import assert from 'node:assert/strict';
import {simulate} from '../src/simulate.mjs';import {simulateRRSA} from '../src/rrsa.mjs';import {rescueSnapshot} from '../src/rescue.mjs';
test('RRSA retains original particle labels and diagnoses the held-direction terminal exactly',()=>{
 for(let seed=1;seed<=60;seed++){const r=simulateRRSA({L:8,k:3,seed,snapshot:true});assert.equal([r.legal_h,r.legal_v][r.lattice.finalState],0);assert.equal(r.attempts,r.failures+r.particles);assert.equal(r.attempted_h+r.attempted_v,r.attempts);assert.equal(r.deadlock,Number(r.legal_h+r.legal_v>0));}
});
test('Diagnostic rescue preserves every original occupied cell, completes geometric jam, and cannot lose coverage',()=>{
 let observed=0;
 for(let seed=1;seed<=30;seed++){const r=simulate({L:10,k:3,controller:38,seed,snapshot:true}),s=rescueSnapshot(r.lattice,seed+100);assert.ok(s.coverage>=r.coverage);assert.ok(Math.abs(s.addedParticles-(s.coverage-r.coverage)*100/3)<1e-12);for(let i=0;i<100;i++)if(r.lattice.occupancy[i])assert.equal(s.lattice.occupancy[i],r.lattice.occupancy[i]);observed+=s.addedParticles>0;}
 assert.ok(observed>0);
});
test('Temporal diagnostics require actual trial trajectories and retain exact feedback switching rules',()=>{
 assert.throws(()=>simulate({L:8,k:2,trace:true}),/direct/);
 for(const [controller,onFailure,onSuccess]of [[35,1,1],[38,0,1],[41,1,0]]){
  const r=simulate({L:8,k:2,controller,engine:'direct',trace:true,seed:273});for(const t of r.trajectory)if(t.previousOutcome!==null)assert.equal(Number(t.orientation!==t.previousOrientation),t.previousOutcome?onSuccess:onFailure);
 }
});
