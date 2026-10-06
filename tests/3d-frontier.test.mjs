import {test,expect} from 'vitest';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {createGiants} from '../config/apps/portal/src/styles/f0.mjs';
import {createField} from '../config/apps/portal/src/styles/g4.mjs';
import {createBossState,BOSS_SPEC} from '../config/apps/portal/src/p2/f8.mjs';
import {createGameAwards,GAME_AWARDS,GAME_AWARDS_KEY,cleanGameAwards} from '../pinia/h3.mjs';
import {CITIES} from '../pcakage/build2/c0.mjs';
import {GROVES,EXTRA_HILLS} from '../config/apps/portal/src/3d/field-data.mjs';
import {stepGiantMotion,angleDelta} from '../config/apps/portal/src/3d/giant-motion.mjs';
import {GIANT_ROLES} from '../pcakage/build2/r6.mjs';
import {createSpatialIndex} from '../pinia/idx3.mjs';
import {createGiantCombat} from '../config/apps/portal/src/styles/c2.mjs';
const req=createRequire(new URL('../config/apps/portal/package.json',import.meta.url));
const THREE=await import(pathToFileURL(path.join(path.dirname(req.resolve('three')),'three.module.js')).href);
const world={groundAt:()=>10,isBlocked:()=>false,obstructRay:(_a,_b,d)=>d,restStations:[]};
test('Wind blade matrices change, surveyed obstacles occlude shots, and resources dispose once',()=>{
 const scene=new THREE.Scene(),field=createField(scene,world);try{const before=field.snapshot();expect(before.turbines).toBeGreaterThan(60);expect(before.anomalies).toBeGreaterThan(20);expect(before.groves).toBe(6);field.update(4);expect(field.snapshot().rotors[0].angle).not.toBe(before.rotors[0].angle);const r=before.rotors[0],p=new THREE.Vector3(r.x-50,40,r.z-15);expect(field.obstructRay(p,new THREE.Vector3(1,0,0),100)).toBeLessThan(50);expect(field.isBlocked(r.x,r.z-15,.5,10)).toBe(true);expect(field.isBlocked(r.x,r.z-15,.5,1000)).toBe(false);}finally{field.dispose();field.dispose();}expect(scene.children.length).toBe(0);expect(GROVES.every(g=>g.radius<140)).toBe(true);expect(EXTRA_HILLS.length).toBe(18);
});
test('Moving giant species have real distinct targets, friendly behavior, once-only defeat and bounded respawn',()=>{
 const scene=new THREE.Scene(),events=[],giants=createGiants(scene,world,e=>events.push(e));try{const before=giants.snapshot();expect(before.total).toBeGreaterThan(45);expect(before.species).toHaveLength(10);expect(before.species.every(s=>s.count>0)).toBe(true);for(let j=0;j<60;j++)giants.update({x:0,y:10,z:180,health:1},j*.05,.05);const after=giants.snapshot();expect(after.actors.filter(a=>a.walked>0).length).toBeGreaterThan(40);const friendly=giants.targets().find(m=>!m.userData.giant.role.hostile&&m.userData.giantWeak);expect(friendly).toBeTruthy();const actor=friendly.userData.giant;let damage=0;for(let j=0;j<220;j++)giants.update({x:actor.x+40,y:10,z:actor.z,health:1},3+j*.05,.05,()=>damage++);expect(actor.pending).toBe(0);for(let j=0;j<20&&actor.alive;j++)giants.hit(friendly,20+j*.22);expect(actor.alive).toBe(false);expect(events).toHaveLength(1);expect(events[0]).toMatchObject({hostile:false,giant:true});expect(giants.hit(friendly,30)).toBe(false);giants.update({x:0,y:10,z:180,health:1},actor.respawnAt+.1,.05);expect(actor.alive).toBe(true);expect(actor.hp).toBe(actor.role.hp);expect(giants.snapshot().projectiles).toBeLessThanOrEqual(48);}finally{giants.dispose();giants.dispose();}expect(scene.children.length).toBe(0);
});
test('Hostile giants telegraph, fire actual projectiles and respect protected spawn',()=>{
 const giants=createGiants(new THREE.Scene(),world);try{const target=giants.targets().find(m=>m.userData.giant.role.kind==='leviathan'),a=target.userData.giant;for(let j=0;j<220;j++)giants.update({x:a.x+100,y:10,z:a.z,health:1},j*.05,.05);expect(giants.snapshot().attacks).toBeGreaterThan(0);expect(giants.snapshot().projectilePeak).toBeGreaterThan(0);expect(giants.snapshot().projectilePeak).toBeLessThanOrEqual(48);let damage=0;for(let j=0;j<120;j++)giants.update({x:0,y:10,z:180,health:1},12+j*.05,.05,()=>damage++);expect(damage).toBe(0);}finally{giants.dispose();}
});
test('Game awards persist actual kill/city events, keep neutral kills out of enemy counts and survive unavailable storage',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)},unlocks=[];const store=createGameAwards(storage,ids=>unlocks.push(...ids));store.defeat({kind:'manta',flying:true,hostile:false,giant:true});expect(store.snapshot().values.kills||0).toBe(0);for(let j=0;j<10;j++)store.defeat({kind:'walker',hostile:true,giant:true});const c=CITIES[0];store.explore({x:c.x,y:c.ground,z:c.z},4,{grove:true,wind:true,objects:['object-1']});store.flush();const loaded=createGameAwards(storage).snapshot();expect(loaded.earned).toEqual(expect.arrayContaining(['kills-10','city-city','grove','wind','giant-manta']));expect(new Set(unlocks).size).toBe(unlocks.length);expect(map.has(GAME_AWARDS_KEY)).toBe(true);expect(GAME_AWARDS.length).toBeGreaterThan(40);expect(cleanGameAwards('a'.repeat(17000))).toBe(null);expect(cleanGameAwards({version:1,earned:['bogus'],values:{token:9,kills:-1}})).toMatchObject({earned:[],values:{}});const memory=createGameAwards(()=>{throw Error('refused');});memory.add('boss');memory.flush();expect(memory.snapshot()).toMatchObject({persistent:false,earned:['boss']});
});
test('Expanded boss swept attack is damaging, jumpable, bounded and cleared by retreat',()=>{
 const boss=createBossState(),p={x:BOSS_SPEC.x+85,y:BOSS_SPEC.floorY,z:BOSS_SPEC.z,health:1};boss.update(p,0,.05);boss.state.pending={at:1,type:'sweep',phase:3,x:p.x,z:p.z,y:p.y+1};let damage=0;for(let j=0;j<65;j++)boss.update(p,1+j*.05,.05,v=>damage+=v);expect(damage).toBeGreaterThan(0);expect(boss.state.sweeps.length).toBeLessThanOrEqual(BOSS_SPEC.sweepCap);boss.state.pending={at:5,type:'sweep',phase:3,x:p.x,z:p.z,y:p.y+1};damage=0;for(let j=0;j<65;j++)boss.update({...p,y:p.y+2},5+j*.05,.05,v=>damage+=v,()=>0);expect(damage).toBe(0);boss.update({...p,y:10},9,.05);expect(boss.state.sweeps).toEqual([]);expect(boss.state.hp).toBe(BOSS_SPEC.hp);
});
test('Giant steering limits angular acceleration and retains engagement across the distance boundary',()=>{
 const a={x:4000,z:4000,y:66,floor:10,floorX:4000,floorZ:4000,homeX:4000,homeZ:4000,phase:0,heading:0,walked:0,scale:1,role:GIANT_ROLES[0],engaged:false,avoidUntil:0,avoidSide:1};
 stepGiantMotion(a,{x:4259,z:4000,y:10},0,.05,world);expect(a.engaged).toBe(true);expect(Math.abs(angleDelta(a.heading,0))).toBeLessThanOrEqual(.036001);
 stepGiantMotion(a,{x:4262,z:4000,y:10},.05,.05,world);expect(a.engaged).toBe(true);
 stepGiantMotion(a,{x:4335,z:4000,y:10},.1,.05,world);expect(a.engaged).toBe(false);
 const blocked={...world,isBlocked:()=>true};stepGiantMotion(a,{x:4260,z:4000,y:10},.2,.05,blocked);const avoid=a.avoidHeading;stepGiantMotion(a,{x:4260,z:4000,y:10},.25,.05,blocked);expect(a.avoidHeading).toBe(avoid);expect(Number.isFinite(a.y)).toBe(true);
});
test('All six giant attacks execute separately, damage or heal cannot originate from cleared owners, and pools stay bounded',()=>{
 const shapes={sphere:new THREE.SphereGeometry(1),ring:new THREE.TorusGeometry(1,.1),leg:new THREE.CylinderGeometry(1,1,1)},material=new THREE.MeshBasicMaterial(),root=new THREE.Group(),combat=createGiantCombat(root,shapes,material,world),p={x:5020,y:10,z:5000,health:1};
 try{for(const role of GIANT_ROLES.filter(r=>r.hostile)){const a={role,x:5000,y:10+role.height,z:5000,floor:10,scale:1,alive:true,phase:0,cooldown:0,pending:0,warning:{position:new THREE.Vector3(),scale:{setScalar(){}},visible:false}};combat.prepare(a,p,0,.05,true);expect(a.pending).toBeGreaterThan(0);combat.prepare(a,p,2,.05,true);expect(combat.snapshot().attacksByType[role.attack]).toBe(1);if(role.attack==='charge')expect(a.charge).toBeTruthy();combat.clearOwner(a);let damage=0;combat.update(p,2,.05,false,()=>damage++);expect(damage).toBe(0);}
  expect(Object.keys(combat.snapshot().attacksByType)).toHaveLength(6);expect(combat.snapshot()).toMatchObject({projectiles:0,fields:0,beams:0});
  const a={role:GIANT_ROLES[0],x:5000,y:66,z:5000,floor:10,scale:1,alive:true,phase:0,cooldown:0,pending:0,warning:{position:new THREE.Vector3(),scale:{setScalar(){}},visible:false}};
  combat.prepare(a,p,0,.05,true);combat.prepare(a,p,2,.05,true);let damage=0;for(let i=0;i<20;i++)combat.update({...p},2+i*.05,.05,false,v=>damage+=v);expect(damage).toBeGreaterThan(0);combat.clearOwner(a);
  a.cooldown=0;combat.prepare(a,p,3,.05,true);combat.prepare(a,p,5,.05,true);damage=0;for(let i=0;i<20;i++)combat.update({...p,y:15},5+i*.05,.05,false,v=>damage+=v);expect(damage).toBe(0);
 }finally{for(const g of Object.values(shapes))g.dispose();material.dispose();}
});
test('Tree spatial index conservatively preserves boundary and ray candidates and releases streamed items',()=>{
 const index=createSpatialIndex(64),items=Array.from({length:1000},(_,i)=>({x:i*8,z:i%7*32,radius:3}));for(const item of items)index.add(item);
 for(const [x,z,r]of [[64,32,.5],[400,64,18],[7900,64,2]]){const found=new Set(index.query(x-r,z-r,x+r,z+r));for(const item of items)if(Math.hypot(item.x-x,item.z-z)<item.radius+r)expect(found.has(item)).toBe(true);}
 expect([...index.query(0,0,64,64)].length).toBeLessThan(30);for(const item of items)index.remove(item);expect(index.size).toBe(0);expect([...index.query(0,0,8000,300)]).toEqual([]);
});
test('Batch rendering preserves exact target matrices and old progress unlocks new counters once',()=>{
 const scene=new THREE.Scene(),giants=createGiants(scene,world);try{giants.update({x:0,y:10,z:180,health:1},2,.05);const targets=giants.targets();expect(targets.length).toBeGreaterThan(100);const m=targets[0],expected=new THREE.Matrix4().multiplyMatrices(m.userData.giant.group.matrix,m.matrix);expect(m.matrixWorld.elements).toEqual(expected.elements);expect(giants.snapshot().renderBatches).toBeLessThan(giants.snapshot().modelParts/8);}finally{giants.dispose();}
 const data={version:1,earned:['kills-1'],values:{kills:1},visited:[],objects:[]},map=new Map([[GAME_AWARDS_KEY,JSON.stringify(data)]]),events=[],awards=createGameAwards({getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)},ids=>events.push(...ids));for(const kind of GIANT_ROLES.map(r=>r.kind)){awards.see(kind);awards.see(kind);}awards.add('jumps',10);awards.flush();expect(awards.snapshot().earned).toEqual(expect.arrayContaining(['kills-1','species-10','jumps-10']));expect(events.filter(id=>id==='seen-ram')).toHaveLength(1);expect(GAME_AWARDS.length).toBeGreaterThan(80);
});
test('Distinct giant attacks produce swept, tracking, delayed, pulling and charging damage, with finite effect pools',()=>{
 const shapes={sphere:new THREE.SphereGeometry(1),ring:new THREE.TorusGeometry(1,.1),leg:new THREE.CylinderGeometry(1,1,1)},material=new THREE.MeshBasicMaterial();
 try{for(const kind of ['leviathan','prism','orchid','bell','ram']){const role=GIANT_ROLES.find(r=>r.kind===kind),combat=createGiantCombat(new THREE.Group(),shapes,material,world),a={role,x:5000,y:10+role.height,z:5000,floor:10,scale:1,alive:true,phase:0,cooldown:0,pending:0,warning:{position:new THREE.Vector3(),scale:{setScalar(){}},visible:false}},p={x:5020,y:10,z:5000};combat.prepare(a,p,0,.05,true);combat.prepare(a,p,2,.05,true);let damage=0;
   if(kind==='prism'){p.x=5020+Math.sin(.1*1.8)*22;p.z=5000+Math.cos(.1*1.8)*22;combat.update(p,2.1,.1,false,v=>damage+=v);}
   if(kind==='orchid'){p.x=5044;for(let i=0;i<40;i++)combat.update(p,2+i*.05,.05,false,v=>damage+=v);}
   if(kind==='bell'){p.x=5030;for(let i=0;i<30;i++)combat.update(p,2+i*.05,.05,false,v=>damage+=v);expect(p.x).toBeLessThan(5030);}
   if(kind==='leviathan')for(let i=0;i<100;i++)combat.update(p,2+i*.05,.05,false,v=>damage+=v);
   if(kind==='ram'){combat.charge(a,{oldX:5000,oldZ:5000},p,2.1,v=>damage+=v);combat.charge(a,{oldX:5000,oldZ:5000},p,2.2,v=>damage+=v);expect(damage).toBe(.23);}
   expect(damage,kind).toBeGreaterThan(0);
   for(let i=0;i<80;i++){a.cooldown=0;combat.prepare(a,p,3,.05,true);combat.prepare(a,p,5,.05,true);}const state=combat.snapshot();expect(state.projectiles).toBeLessThanOrEqual(48);expect(state.fields).toBeLessThanOrEqual(24);expect(state.beams).toBeLessThanOrEqual(8);
  }
 }finally{for(const g of Object.values(shapes))g.dispose();material.dispose();}
});
