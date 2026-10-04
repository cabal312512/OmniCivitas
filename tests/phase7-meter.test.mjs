import {describe,it,expect} from 'vitest';
import {restoreMeasurement,meterStep} from '../pinia/p.mjs';
describe('Phase 7 anonymous site meter',()=>{
 it('restores only six bounded aggregates and rejects coordinates, expired and corrupt history',()=>{
  const now=100000000,state=restoreMeasurement(null,now);
  expect(restoreMeasurement(JSON.stringify({...state,pixels:12,wheelEvents:3}),now).pixels).toBe(12);
  for(const v of [{...state,x:5},{...state,enteredAt:now+1},{...state,enteredAt:1},{...state,pixels:NaN},{...state,wheelEvents:1.2},{...state,pointerEvents:1e16}])expect(restoreMeasurement(JSON.stringify(v),now)).toEqual(state);
 });
 it('counts real Euclidean mouse distance without retaining coordinates in persisted totals',()=>{
  let s={state:restoreMeasurement(null,1),last:null};
  s=meterStep(s.state,s.last,{type:'pointermove',pointerType:'mouse',clientX:10,clientY:20});
  s=meterStep(s.state,s.last,{type:'pointermove',pointerType:'mouse',clientX:13,clientY:24});
  expect(s.state.pixels).toBe(5);expect(s.state.pointerEvents).toBe(2);expect(Object.keys(s.state)).toHaveLength(6);
  expect(meterStep(s.state,s.last,{type:'pointermove',pointerType:'touch',clientX:100,clientY:300}).state).toEqual(s.state);
 });
 it('normalizes wheel lines and pages, ignores nonfinite data, and caps accumulation',()=>{
  const state=restoreMeasurement(null,1);
  expect(meterStep(state,null,{type:'wheel',deltaX:3,deltaY:4,deltaMode:0}).state.wheelPixels).toBe(5);
  expect(meterStep(state,null,{type:'wheel',deltaY:2,deltaMode:1}).state.wheelPixels).toBe(32);
  expect(meterStep(state,null,{type:'wheel',deltaY:2,deltaMode:2,pageHeight:700}).state.wheelPixels).toBe(1400);
  expect(meterStep(state,null,{type:'wheel',deltaY:Infinity}).state).toEqual(state);
  expect(meterStep({...state,wheelPixels:1e15-1},null,{type:'wheel',deltaY:100}).state.wheelPixels).toBe(1e15);
 });
});
