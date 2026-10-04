import test from 'node:test';
import assert from 'node:assert/strict';
import {AdsorptionDemo,normalizedKernel,wordProbability,terminalAtoms,probabilityTiles,reward} from '../config/apps/portal/src/research/demo-model.mjs';
import {catalogue,recommend,searchFeatures} from '../config/apps/portal/src/main1/catalogue.mjs';
import fs from 'node:fs';

test('research is recommended and searchable without removing normal entries',()=>{
 assert.equal(recommend()[0].id,'research');assert.equal(recommend().length,7);
 assert.equal(searchFeatures('research')[0].url,'/research/');assert.equal(searchFeatures('研究')[0].id,'research');
 assert.ok(catalogue.find(item=>item.id==='3d-world'));
});
test('seeded browser adsorption is repeatable and stops only at genuine jam',()=>{
 for(const boundary of ['periodic','open']){
  const a=new AdsorptionDemo({L:8,boundary,policy:'iid'}),b=new AdsorptionDemo({L:8,boundary,policy:'iid'});
  while(!a.jammed&&!a.budgetStopped)a.step(100);while(!b.jammed&&!b.budgetStopped)b.step(100);
  assert.deepEqual(a.snapshot(),b.snapshot());assert.deepEqual(a.cells,b.cells);assert.ok(a.jammed);
  assert.equal(a.hasLegal(0),false);assert.equal(a.hasLegal(1),false);
  assert.equal([...a.cells].filter(Boolean).length,2*a.snapshot().N);
 }
});
test('a blocked constant-direction demonstration is not falsely labelled geometric jam',()=>{
 const model=new AdsorptionDemo({L:3,policy:'feedback',alpha:0,beta:0});
 // Three legal horizontal dimers leave one vertical column available.
 model.cells.set([1,1,0,1,1,0,1,1,0]);model.nH=3;
 while(!model.budgetStopped&&!model.jammed)model.step(1000);
 assert.equal(model.budgetStopped,true);assert.equal(model.jammed,false);assert.equal(model.hasLegal(1),true);
});
test('joint kernel word probabilities normalize over every word including empty word',()=>{
 const kernel=normalizedKernel([8,2,1,7,4,9,6,3]);
 for(let n=0;n<=7;n++){let sum=0;for(let bits=0;bits<2**n;bits++){let word='';for(let i=0;i<n;i++)word+=(bits>>i)&1?'V':'H';sum+=wordProbability(kernel,word);}assert.ok(Math.abs(sum-1)<1e-12);}
 assert.throws(()=>normalizedKernel([0,0,0,0,1,2,3,4]));assert.throws(()=>wordProbability(kernel,'FS'));
});
test('probability mosaic uses actual exact atoms and preserves area',()=>{
 const doc=JSON.parse(fs.readFileSync(new URL('../research/finite-memory-rsa/stage4/results/proper-boundary-null.json',import.meta.url)));
 const atoms=terminalAtoms(doc.law),tiles=probabilityTiles(atoms,1000,600);
 assert.equal(atoms.length,9);assert.ok(atoms.every(row=>row.N===4&&row.h===1));
 assert.ok(Math.abs(tiles.reduce((sum,row)=>sum+row.w*row.h,0)-600000)<1e-6);
 for(const tile of tiles)assert.ok(Math.abs(tile.w*tile.h/600000-tile.p)<1e-12);
});
test('all-direction periodic witness remains favorable across nonnegative illustrative weights',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('../research/finite-memory-rsa/stage5/results/periodic-negative.json',import.meta.url))),row=data.rows.find(row=>row.feedback==='feedback-4-00010');
 for(const mu of [0,.1,1,2])for(const nu of [0,.05,.4,1]){const f=reward(row.feedbackMetrics,mu,nu),values=row.components.map(c=>reward(c.metrics,mu,nu));assert.ok(Math.max(...values)>=.9*values[0]+.1*values[1]-1e-12);assert.ok(.9*values[0]+.1*values[1]>f);}
});
