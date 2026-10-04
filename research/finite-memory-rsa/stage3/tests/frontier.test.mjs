import test from 'node:test';
import assert from 'node:assert/strict';
import { dominates,pareto,chooseSurvivors } from '../src/frontier.mjs';
import { directionalTest } from '../scripts/analyze-confirmation.mjs';
import { temporalMixtureDominates } from '../src/convex-frontier.mjs';

test('density alone cannot remove an isotropy/cost tradeoff',()=>{
 const a={coverage:.85,abs_order:.1,cost:50},b={coverage:.86,abs_order:.3,cost:60},c={coverage:.8,abs_order:.2,cost:70};
 assert.equal(dominates(a,b),false);assert.equal(dominates(b,a),false);assert.deepEqual(pareto([a,b,c]),[a,b]);
});
test('a temporal mixture can cover a point that no individual temporal point dominates',()=>{
 const target={coverage:.8,abs_order:.2,cost:10},points=[{controller:'a',coverage:.9,abs_order:.4,cost:10},{controller:'b',coverage:.7,abs_order:0,cost:10}];
 assert.ok(points.every(p=>!dominates(p,target)));
 const mix=temporalMixtureDominates(target,points);assert.ok(mix);assert.ok(Math.abs(mix.coverage-.8)<1e-8);
 assert.equal(temporalMixtureDominates({coverage:.95,abs_order:.1,cost:9},points),null);
});
test('memory strata and all temporal references survive a feedback cap',()=>{
 const groups=[{controller:'fair',kind:'iid-reference',states:1,coverage:.8,abs_order:.1,cost:10},
 {controller:'temporal',kind:'temporal',states:4,coverage:.81,abs_order:.1,cost:10},
 {controller:'one',kind:'feedback',states:2,coverage:.79,abs_order:.2,cost:10},
 {controller:'four',kind:'feedback',states:4,coverage:.9,abs_order:.1,cost:8}];
 const cs=new Map(groups.map(g=>[g.controller,{temporalEquivalent:false}]));
 groups[0].controller='iid-fair';cs.set('iid-fair',{temporalEquivalent:false});
 const selected=chooseSurvivors(groups,cs,{minimumStateStrata:[2,3,4],absOrderBudgets:[.1,.2],costMultipliersVsFair:[1],topPerBudgetCell:2,capFeedbackPerK:1});
 assert.deepEqual(selected.chosen.map(p=>p.controller),['iid-fair','temporal','one']);
 assert.equal(selected.prunedByCap[0].controller,'four');
});
test('directional inference respects sign and uncertainty',()=>{
 const positive=directionalTest([.1,.2,.3,.4,.5],.05,300),negative=directionalTest([-.1,-.2,-.3,-.4,-.5],.05,300);
 assert.ok(positive.pRaw<.05);assert.ok(negative.pRaw>.95);assert.ok(positive.simultaneousCiLow<positive.ciLow);
 assert.equal(directionalTest([0,0,0]).pRaw,1);
});
