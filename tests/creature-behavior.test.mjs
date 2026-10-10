import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {createCreatureStage,creatureFieldDeflection,residentFieldDeflection,creatureSpeechDuration} from '../config/apps/portal/src/q8/creature.mjs';

const dataKey=name=>name.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());
function fixture({reduced=false,hidden=false,resident=false,count=1}={}){
 const view=new EventTarget(),doc=new EventTarget(),media=new EventTarget(),fields=[];
 const roots=Array.from({length:count},(_,id)=>{
  const values=new Map(),root=new EventTarget();fields.push(values);
  root.dataset={q8Actor:resident?'resident':'hidden',q8Form:resident?'assembly':['shard','ring','lattice','rift','orbit','prism'][id%6],q8Action:'idle',id:String(id)};root.hidden=hidden;
  root.style={setProperty:(key,value)=>values.set(key,value)};root.closest=()=>root.hidden?root:null;
  root.hasAttribute=name=>Object.hasOwn(root.dataset,dataKey(name));root.removeAttribute=name=>delete root.dataset[dataKey(name)];
  root.getClientRects=()=>root.hidden?[]:[root.getBoundingClientRect()];root.getBoundingClientRect=()=>({left:100+id*300,top:100,width:72,height:88});
  return root;
 });
 let intersectionCallback;const intersection={targets:new Set(),disconnected:false};
 view.IntersectionObserver=class{
  constructor(callback){intersectionCallback=callback;}
  observe(root){intersection.targets.add(root);}
  disconnect(){intersection.disconnected=true;intersection.targets.clear();}
 };
 media.matches=reduced;view.matchMedia=()=>media;view.performance={now:()=>Date.now()};view.setTimeout=setTimeout;view.clearTimeout=clearTimeout;
 view.getComputedStyle=()=>({visibility:'visible',display:'block'});doc.defaultView=view;doc.visibilityState='visible';doc.body={dataset:{cover:'false'}};
 doc.querySelectorAll=selector=>selector==='[data-q8-actor]'?roots:[];
 const controller=new AbortController(),stage=createCreatureStage({document:doc,signal:controller.signal});
 const emit=(target,type,detail={})=>{const event=new Event(type);Object.assign(event,detail);target.dispatchEvent(event);};
 const intersect=(root,isIntersecting)=>intersectionCallback([{target:root,isIntersecting}]);
 return{root:roots[0],roots,view,doc,media,controller,stage,values:fields[0],fields,emit,intersect,intersection};
}
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-10T00:00:00Z'));});afterEach(()=>vi.useRealTimers());

describe('abstract hunt fields and lifecycle limits',()=>{
 it('keeps resident gaze responsive across the whole viewport without changing hidden creature range',()=>{
  const rect={left:900,top:600,width:310,height:300};
  const remote=residentFieldDeflection({x:20,y:20},rect);
  expect(remote.x).toBeLessThan(-7);expect(remote.y).toBeLessThan(-5);expect(remote.proximity).toBe(0);
  expect(creatureFieldDeflection({x:20,y:20},rect)).toEqual({x:0,y:0,proximity:0});
  expect(residentFieldDeflection({x:1055,y:750},rect)).toEqual({x:0,y:0,proximity:1});
  for(const x of [-1e6,1e6]){const v=residentFieldDeflection({x,y:x},rect);expect(Math.abs(v.x)).toBeLessThanOrEqual(8);expect(Math.abs(v.y)).toBeLessThanOrEqual(6);}
  expect(residentFieldDeflection({x:NaN,y:0},rect)).toEqual({x:0,y:0,proximity:0});
 });
 it('updates an awake resident from distant document pointer input and preserves gaze on leave',()=>{
  const f=fixture({resident:true});
  f.emit(f.doc,'pointermove',{pointerType:'mouse',clientX:1500,clientY:900});
  expect(Number.parseFloat(f.values.get('--field-x'))).toBeGreaterThan(7);
  f.emit(f.root,'pointerenter');f.emit(f.root,'pointerleave');
  expect(Number.parseFloat(f.values.get('--field-x'))).toBeGreaterThan(7);
  f.root.getBoundingClientRect=()=>({left:1550,top:1000,width:72,height:88});f.emit(f.doc,'q8:resident-move');
  expect(Number.parseFloat(f.values.get('--field-x'))).toBeLessThan(0);f.stage.dispose();
 });
 it('deflects a local field with bounded displacement and continuous proximity',()=>{
  const rect={left:0,top:0,width:100,height:100};
  expect(creatureFieldDeflection({x:50,y:50},rect)).toEqual({x:0,y:0,proximity:1});
  const near=creatureFieldDeflection({x:75,y:75},rect),edge=creatureFieldDeflection({x:175,y:150},rect);
  expect(near.proximity).toBeGreaterThan(edge.proximity);expect(edge.proximity).toBeGreaterThan(0);
  for(const point of [{x:175,y:150},{x:-75,y:-50}]){const result=creatureFieldDeflection(point,rect);expect(Math.abs(result.x)).toBeLessThanOrEqual(8);expect(Math.abs(result.y)).toBeLessThanOrEqual(6);}
  expect(creatureFieldDeflection({x:400,y:400},rect)).toEqual({x:0,y:0,proximity:0});
  for(const [point,box] of [[{x:NaN,y:0},rect],[{x:0,y:0},{...rect,width:0}],[{x:0,y:0},{...rect,left:Infinity}],[{},rect]])expect(creatureFieldDeflection(point,box)).toEqual({x:0,y:0,proximity:0});
 });
 it('bounds explicit effects, throttles rapid requests and shares a single deadline timer',()=>{
  const f=fixture({count:6});expect(f.stage.snapshot().actors).toBe(6);expect(vi.getTimerCount()).toBe(1);
  expect(f.stage.perform(f.root,'shear',{duration:1000000})).toBe(true);expect(f.root.dataset.q8Action).toBe('shear');
  expect(f.stage.perform(f.root,'phase')).toBe(false);expect(f.stage.perform(f.root,'unrecognized',{force:true})).toBe(false);
  for(const root of f.roots.slice(1))expect(f.stage.perform(root,'resonate')).toBe(true);
  expect(vi.getTimerCount()).toBe(1);vi.advanceTimersByTime(2300);expect(f.root.dataset.q8Action).toBe('idle');
  for(const state of f.stage.snapshot().states){expect(state.coherence).toBeGreaterThanOrEqual(0);expect(state.coherence).toBeLessThanOrEqual(1);}
  f.stage.dispose();expect(vi.getTimerCount()).toBe(0);
 });
 it('cycles finite nonhuman field effects without accumulating timers',()=>{
  const f=fixture(),actions=new Set();
  for(let i=0;i<18;i++){vi.advanceTimersToNextTimer();if(f.root.dataset.q8Action!=='idle')actions.add(f.root.dataset.q8Action);expect(vi.getTimerCount()).toBe(1);}
  expect([...actions].sort()).toEqual(['phase','pulse','resonate','shear']);expect(f.stage.snapshot().states[0].form).toBe('shard');
  f.stage.dispose();
 });
 it('responds to focus, hover and local mouse input while preserving the collection hitbox',()=>{
  const f=fixture(),before=f.root.getBoundingClientRect();f.emit(f.root,'focus');expect(f.root.dataset.q8Action).toBe('pulse');expect(f.root.dataset.q8Hint).toBe('true');
  vi.advanceTimersByTime(2200);expect(f.root.dataset.q8Action).toBe('idle');expect(Number(f.values.get('--field-proximity'))).toBeGreaterThan(0);
  f.emit(f.root,'blur');expect(Number(f.values.get('--field-proximity'))).toBe(0);
  f.emit(f.doc,'pointermove',{pointerType:'mouse',clientX:220,clientY:165});expect(Number.parseFloat(f.values.get('--field-x'))).toBeGreaterThan(0);
  const deflection=f.values.get('--field-x');vi.advanceTimersByTime(80);f.emit(f.doc,'pointermove',{pointerType:'touch',clientX:20,clientY:20});expect(f.values.get('--field-x')).toBe(deflection);
  f.emit(f.root,'pointerenter');expect(f.root.dataset.q8Hint).toBe('true');f.emit(f.root,'pointerleave');expect(f.root.hasAttribute('data-q8-hint')).toBe(false);
  expect(f.root.getBoundingClientRect()).toEqual(before);expect(f.root.style.transform).toBeUndefined();f.stage.dispose();
 });
 it('keeps a locked resident dormant and refuses effects or speech until it becomes visible',()=>{
  const f=fixture({hidden:true,resident:true});expect(f.stage.snapshot().actors).toBe(1);expect(f.stage.snapshot().timers).toBe(0);
  expect(f.stage.perform(f.root,'phase',{force:true})).toBe(false);f.emit(f.root,'focus');expect(f.root.hasAttribute('data-q8-hint')).toBe(false);f.emit(f.doc,'q8:speech',{detail:{text:'接入完成。',actor:f.root}});expect(f.root.hasAttribute('data-q8-talking')).toBe(false);
  vi.advanceTimersByTime(20000);expect(vi.getTimerCount()).toBe(0);
  f.root.hidden=false;f.stage.refresh();expect(f.root.dataset.q8Awake).toBe('true');expect(vi.getTimerCount()).toBe(1);expect(f.stage.perform(f.root,'phase')).toBe(true);
  f.root.hidden=true;f.stage.refresh();expect(f.stage.snapshot().timers).toBe(0);expect(f.root.dataset.q8Awake).toBe('false');expect(Number(f.values.get('--speech-energy'))).toBe(0);f.stage.dispose();
 });
 it('uses fixed bounded speech energy and cancels stale energy when another field speaks',()=>{
  const f=fixture({resident:true,count:2});expect(creatureSpeechDuration('')).toBe(1400);expect(creatureSpeechDuration('a'.repeat(500))).toBe(6500);
  f.emit(f.doc,'q8:speech',{detail:{text:'相位保持。',actor:f.root}});const energy=Number(f.values.get('--speech-energy'));expect(energy).toBeGreaterThan(0);expect(energy).toBeLessThanOrEqual(1);
  vi.advanceTimersByTime(400);expect(Number(f.values.get('--speech-energy'))).toBe(energy);expect(vi.getTimerCount()).toBe(1);
  f.emit(f.doc,'q8:speech',{detail:{text:'残余信号仍在。',actor:f.roots[1]}});expect(f.root.hasAttribute('data-q8-talking')).toBe(false);expect(Number(f.values.get('--speech-energy'))).toBe(0);
  expect(f.roots[1].dataset.q8Talking).toBe('true');vi.advanceTimersByTime(6500);expect(f.roots[1].hasAttribute('data-q8-talking')).toBe(false);expect(Number(f.fields[1].get('--speech-energy'))).toBe(0);
  f.emit(f.doc,'q8:speech',{detail:{text:'回声。',actor:f.root}});f.emit(f.doc,'q8:speech',{detail:{active:false}});expect(f.stage.snapshot().states.every(state=>state.speechEnergy===0)).toBe(true);f.stage.dispose();
 });
 it('suspends offscreen fields and releases intersection observation when disposed',()=>{
  const f=fixture();expect(f.intersection.targets.has(f.root)).toBe(true);f.stage.perform(f.root,'resonate');
  f.intersect(f.root,false);expect(f.stage.snapshot().active).toBe(0);expect(vi.getTimerCount()).toBe(0);expect(f.root.dataset.q8Action).toBe('idle');
  expect(f.stage.perform(f.root,'pulse',{force:true})).toBe(false);f.intersect(f.root,true);expect(vi.getTimerCount()).toBe(1);
  f.stage.dispose();expect(f.intersection.disconnected).toBe(true);expect(f.stage.snapshot().active).toBe(0);expect(vi.getTimerCount()).toBe(0);
 });
 it('keeps concealed hunt fields asleep under the cover without affecting an unlocked resident',()=>{
  const f=fixture();f.doc.body.dataset.cover='true';f.stage.refresh();expect(f.stage.snapshot().active).toBe(0);expect(vi.getTimerCount()).toBe(0);expect(f.stage.perform(f.root,'shear',{force:true})).toBe(false);f.stage.dispose();
  const resident=fixture({resident:true});resident.doc.body.dataset.cover='true';resident.stage.refresh();expect(resident.stage.snapshot().active).toBe(1);expect(resident.stage.perform(resident.root,'shear')).toBe(true);resident.stage.dispose();
 });
 it('pauses hidden and bfcache pages, clears speech and restores exactly one timer',()=>{
  const f=fixture();f.stage.perform(f.root,'phase');f.emit(f.doc,'q8:speech',{detail:{text:'相位索引已交换。',actor:f.root}});f.doc.visibilityState='hidden';f.emit(f.doc,'visibilitychange');
  expect(f.stage.snapshot().paused).toBe(true);expect(vi.getTimerCount()).toBe(0);expect(f.root.dataset.q8Awake).toBe('false');expect(f.stage.snapshot().states[0].speechEnergy).toBe(0);
  f.doc.visibilityState='visible';f.emit(f.doc,'visibilitychange');expect(vi.getTimerCount()).toBe(1);
  f.emit(f.view,'pagehide');expect(vi.getTimerCount()).toBe(0);f.emit(f.view,'pageshow');expect(vi.getTimerCount()).toBe(1);f.emit(f.view,'pageshow');expect(vi.getTimerCount()).toBe(1);
  f.controller.abort();expect(vi.getTimerCount()).toBe(0);expect(f.stage.snapshot().disposed).toBe(true);f.emit(f.view,'pageshow');expect(vi.getTimerCount()).toBe(0);
 });
 it('honors reduced motion without autonomous effects and retains finite explicit interaction',()=>{
  const f=fixture({reduced:true});expect(vi.getTimerCount()).toBe(0);vi.advanceTimersByTime(60000);expect(f.root.dataset.q8Action).toBe('idle');
  f.emit(f.doc,'pointermove',{pointerType:'mouse',clientX:220,clientY:165});expect(Number.parseFloat(f.values.get('--field-x'))).toBe(0);
  expect(f.stage.perform(f.root,'pulse')).toBe(true);expect(vi.getTimerCount()).toBe(1);vi.advanceTimersByTime(2200);expect(vi.getTimerCount()).toBe(0);
  f.media.matches=false;f.emit(f.media,'change');expect(vi.getTimerCount()).toBe(1);f.media.matches=true;f.emit(f.media,'change');expect(vi.getTimerCount()).toBe(0);f.stage.dispose();
 });
});
