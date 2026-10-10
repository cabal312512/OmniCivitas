import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {createCreatureRoaming,roamingPoint} from '../config/apps/portal/src/q8/creature-roam.mjs';

function fixture({id=0,reduced=false,awake=true,hidden=false}={}){
 const win=new EventTarget(),doc=new EventTarget(),root=new EventTarget(),media=new EventTarget(),body=new EventTarget(),properties=new Map(),callbacks=new Map();
 let serial=0;win.innerWidth=1280;win.innerHeight=800;win.performance={now:()=>Date.now()};win.setTimeout=setTimeout;win.clearTimeout=clearTimeout;
 win.requestAnimationFrame=callback=>{const handle=++serial;callbacks.set(handle,callback);return handle;};win.cancelAnimationFrame=handle=>callbacks.delete(handle);
 media.matches=reduced;win.matchMedia=()=>media;win.getComputedStyle=()=>({display:'block',visibility:'visible'});
 doc.defaultView=win;doc.body=body;doc.activeElement=null;doc.visibilityState='visible';body.dataset={cover:'false'};body.parentElement=null;
 root.ownerDocument=doc;root.parentElement=body;root.hidden=hidden;root.dataset={q8Actor:'hidden',q8Awake:String(awake),id:String(id)};
 root.style={setProperty:(name,value)=>properties.set(name,value),getPropertyValue:name=>properties.get(name)||''};
 root.closest=selector=>selector==='[hidden]'?(root.hidden?root:body.hidden?body:null):selector==='[data-cover="true"]'&&body.dataset.cover==='true'?body:null;
 root.getBoundingClientRect=()=>({left:Number.parseFloat(properties.get('left'))||240,top:Number.parseFloat(properties.get('top'))||180,width:84,height:88});
 root.getClientRects=()=>root.hidden?[]:[root.getBoundingClientRect()];
 const abort=new AbortController(),controller=createCreatureRoaming(root,{signal:abort.signal});
 const emit=(target,type,values={})=>{const event=new Event(type);Object.assign(event,values);target.dispatchEvent(event);};
 const step=(milliseconds=40)=>{vi.advanceTimersByTime(milliseconds);const pending=[...callbacks.values()];callbacks.clear();for(const callback of pending)callback(Date.now());};
 const advance=milliseconds=>{for(let remaining=milliseconds;remaining>0;remaining-=40)step(Math.min(40,remaining));};
 return{win,doc,root,media,body,properties,callbacks,abort,controller,emit,step,advance};
}
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-10T00:00:00Z'));});afterEach(()=>vi.useRealTimers());

describe('bounded hidden creature roaming',()=>{
 it('keeps every seeded mode inside the viewport below the header',()=>{
  for(const viewport of [{width:390,height:844},{width:1280,height:800},{width:320,height:240}])for(let seed=0;seed<30;seed++)for(let time=0;time<=400;time+=7.1){
   const point=roamingPoint(time,seed,viewport,{x:-500,y:9999},{width:84,height:88});
   expect(point.x).toBeGreaterThanOrEqual(12);expect(point.x+84).toBeLessThanOrEqual(viewport.width-12);
   expect(point.y).toBeGreaterThanOrEqual(76);expect(point.y+88).toBeLessThanOrEqual(viewport.height-12);
  }
 });
 it('has deterministic continuous paths, exact short stops and an unchanged initial anchor',()=>{
  const viewport={width:1280,height:800},anchor={x:240,y:180},size={width:84,height:88};
  for(const seed of [0,1,3,4,27,28]){
   expect(roamingPoint(0,seed,viewport,anchor,size)).toMatchObject(anchor);
   expect(roamingPoint(3,seed,viewport,anchor,size)).toEqual(roamingPoint(3,seed,viewport,anchor,size));
   expect(Math.hypot(roamingPoint(3,seed,viewport,anchor,size).x-anchor.x,roamingPoint(3,seed,viewport,anchor,size).y-anchor.y)).toBeGreaterThan(.5);
   let stopCount=0;
   for(let time=0;time<60;time+=.125){
    const a=roamingPoint(time,seed,viewport,anchor,size),b=roamingPoint(time+.00001,seed,viewport,anchor,size);
    expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeLessThan(.1);
    const next=roamingPoint(time+.125,seed,viewport,anchor,size);expect(Math.hypot(a.x-next.x,a.y-next.y)).toBeLessThan(150);
    if(!a.moving&&!b.moving&&a.segment===b.segment){expect(a.x).toBe(b.x);expect(a.y).toBe(b.y);stopCount++;}
   }
   expect(stopCount).toBeGreaterThan(10);
  }
  expect(roamingPoint(1000,2,viewport,anchor,size)).toMatchObject({...anchor,mode:'stationary',moving:false});
 });
 it('moves after three seconds with one frame callback, and leaves stationary actors alone',()=>{
  const f=fixture();expect(f.properties.size).toBe(0);f.step();expect(f.controller.snapshot()).toMatchObject({x:240,y:180});f.advance(3000);
  expect(Math.hypot(f.controller.snapshot().x-240,f.controller.snapshot().y-180)).toBeGreaterThan(.5);expect(f.callbacks.size).toBe(1);
  expect(f.controller.snapshot().frames).toBeLessThanOrEqual(77);expect(f.win.__ocvCreatureRoaming.snapshot().mode).toBe('roam');
  expect(createCreatureRoaming(f.root)).toBe(f.controller);f.controller.dispose();expect(f.callbacks.size).toBe(0);
  const stationary=fixture({id:2});stationary.advance(10000);expect(stationary.callbacks.size).toBe(0);expect(stationary.properties.size).toBe(0);stationary.controller.dispose();
 });
 it('stops near the mouse continuously and holds hover or keyboard focus without chasing',()=>{
  const f=fixture();f.advance(1200);const before=f.controller.snapshot();
  f.emit(f.doc,'pointermove',{pointerType:'mouse',clientX:before.x+42,clientY:before.y+44});f.advance(5000);
  expect(f.controller.snapshot()).toMatchObject({x:before.x,y:before.y,reason:'pointer',running:false});expect(f.controller.snapshot().timers).toBe(0);
  f.emit(f.doc,'pointermove',{pointerType:'mouse',clientX:4000,clientY:4000});f.advance(400);expect(f.controller.snapshot().activeTime).toBeGreaterThan(before.activeTime);
  f.emit(f.root,'pointerenter');const hovered=f.controller.snapshot();f.advance(5000);expect(f.controller.snapshot()).toMatchObject({x:hovered.x,y:hovered.y,reason:'hover'});
  f.emit(f.root,'pointerleave');expect(f.controller.snapshot()).toMatchObject({reason:'cooldown',timers:1});f.advance(1900);expect(f.controller.snapshot().running).toBe(false);
  f.advance(200);expect(f.controller.snapshot().running).toBe(true);f.doc.activeElement=f.root;f.emit(f.root,'focus');const focused=f.controller.snapshot();f.advance(5000);
  expect(f.controller.snapshot()).toMatchObject({x:focused.x,y:focused.y,reason:'focus',running:false});f.doc.activeElement=null;f.emit(f.root,'blur');f.advance(2100);expect(f.controller.snapshot().running).toBe(true);f.controller.dispose();
 });
 it('freezes under a pressed pointer and permanently stops when collection begins',()=>{
  const f=fixture();f.advance(800);f.emit(f.root,'pointerdown',{pointerId:7});const pressed=f.controller.snapshot();f.advance(3000);
  expect(f.controller.snapshot()).toMatchObject({x:pressed.x,y:pressed.y,reason:'pressed',pressed:true,running:false});
  f.win.innerWidth=320;f.win.innerHeight=240;f.emit(f.win,'resize');expect(f.controller.snapshot()).toMatchObject({x:pressed.x,y:pressed.y,reason:'pressed'});
  f.emit(f.win,'pointerup',{pointerId:8});expect(f.controller.snapshot().pressed).toBe(true);f.emit(f.win,'pointerup',{pointerId:7});f.advance(2100);expect(f.controller.snapshot().running).toBe(true);
  f.root.dataset.q8Collecting='true';f.controller.refresh();const collecting=f.controller.snapshot();f.advance(5000);expect(f.controller.snapshot()).toMatchObject({x:collecting.x,y:collecting.y,reason:'collecting',running:false,timers:0});
  delete f.root.dataset.q8Collecting;f.controller.refresh();expect(f.controller.snapshot().running).toBe(false);f.root.hidden=true;f.controller.dispose();expect(f.root.hidden).toBe(true);expect(f.callbacks.size).toBe(0);
 });
 it('honors sleep, cover, hidden pages, reduced motion and bfcache without accumulating callbacks',()=>{
  const f=fixture({awake:false});expect(f.controller.snapshot()).toMatchObject({reason:'asleep',running:false});f.root.dataset.q8Awake='true';f.controller.refresh();f.advance(400);
  f.body.dataset.cover='true';f.controller.refresh();expect(f.controller.snapshot()).toMatchObject({reason:'cover',running:false});f.body.dataset.cover='false';f.controller.refresh();
  f.doc.visibilityState='hidden';f.emit(f.doc,'visibilitychange');const suspended=f.controller.snapshot();f.advance(8000);expect(f.controller.snapshot().activeTime).toBe(suspended.activeTime);
  f.doc.visibilityState='visible';f.emit(f.doc,'visibilitychange');f.media.matches=true;f.emit(f.media,'change');expect(f.controller.snapshot()).toMatchObject({reason:'reduced',running:false,timers:0});
  f.media.matches=false;f.emit(f.media,'change');f.emit(f.win,'pagehide',{persisted:true});expect(f.callbacks.size).toBe(0);f.emit(f.win,'pageshow');f.emit(f.win,'pageshow');expect(f.callbacks.size).toBe(1);
  f.root.hidden=true;f.controller.refresh();expect(f.controller.snapshot()).toMatchObject({reason:'hidden',running:false});f.root.hidden=false;f.controller.refresh();expect(f.callbacks.size).toBe(1);
  f.abort.abort();expect(f.controller.snapshot()).toMatchObject({disposed:true,reason:'disposed',running:false,timers:0});f.emit(f.win,'pageshow');f.emit(f.doc,'pointermove',{clientX:0,clientY:0});expect(f.callbacks.size).toBe(0);
 });
 it('bounds the last position on resize and ignores touch motion',()=>{
  const f=fixture();f.advance(3000);f.emit(f.doc,'pointermove',{pointerType:'touch',clientX:0,clientY:0});expect(f.controller.snapshot().reason).toBe(null);
  f.win.innerWidth=320;f.win.innerHeight=240;f.emit(f.win,'resize');expect(f.controller.snapshot().x).toBeLessThanOrEqual(224);expect(f.controller.snapshot().y).toBeLessThanOrEqual(140);expect(f.controller.snapshot().y).toBeGreaterThanOrEqual(76);
  f.controller.dispose();
 });
});
