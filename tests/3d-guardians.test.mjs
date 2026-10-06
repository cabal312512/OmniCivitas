import {test,expect} from 'vitest';
import {GUARDIANS,GUARDIAN_KEY,createGuardianState,createGuardianStore,cleanGuardians} from '../pinia/8g.mjs';
import {createFlight,stepFlight} from '../pcakage/build2/5.mjs';
import {createPlayer} from '../pcakage/build2/4.mjs';
import {GAME_AWARDS,createGameAwards} from '../pinia/h3.mjs';
import {createCityGuardians} from '../config/apps/portal/src/p2/s7.mjs';
import {GAME_PROGRESS_KEYS,resetGameProgress} from '../pcakage/build2/a1.mjs';
import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';import path from 'node:path';
const req=createRequire(new URL('../config/apps/portal/package.json',import.meta.url)),THREE=await import(pathToFileURL(path.join(path.dirname(req.resolve('three')),'three.module.js')).href);
const map=new Map(),storage=()=>({getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)});
const visitor=s=>({x:s.x+40,y:s.y,z:s.z,health:1});
test('eight unique centre guardians exclude the capital and persist their exact victory set',()=>{
 map.clear();const store=createGuardianStore(storage()),flight=createFlight(),unlocks=[],awards=createGameAwards(storage(),ids=>unlocks.push(...ids));
 expect(GUARDIANS).toHaveLength(8);expect(new Set(GUARDIANS.map(g=>g.kind)).size).toBe(8);expect(new Set(GUARDIANS.map(g=>g.attack)).size).toBe(8);expect(GUARDIANS.some(g=>g.id==='capital')).toBe(false);
 for(const spec of GUARDIANS){const sim=createGuardianState(spec,{onDefeat:id=>{store.mark(id);awards.add(`guardian-${id}`);if(store.complete){flight.setUnlocked(true);awards.add('guardians');}}});sim.update(visitor(spec),0,.05);
  for(let i=0;i<spec.hp;i++)sim.hit(true,i*.2);expect(sim.state.defeated).toBe(true);expect(sim.state.completions).toBe(1);expect(sim.hit(true,50)).toBe(false);
  if(store.snapshot().defeated.length<8)expect(flight.unlocked).toBe(false);
 }awards.flush();expect(flight.unlocked).toBe(true);expect(createGuardianStore(storage()).complete).toBe(true);expect(unlocks).toContain('guardians');expect(awards.snapshot().earned.filter(id=>id.startsWith('guardian-'))).toHaveLength(8);expect(GAME_AWARDS).toHaveLength(100);
 expect(store.mark(GUARDIANS[0].id)).toBe(false);expect(map.get(GUARDIAN_KEY).length).toBeLessThan(2048);
});
test('unknown, duplicate, malformed and oversized victory records cannot unlock flight',()=>{
 expect(cleanGuardians('a'.repeat(2049))).toBe(null);expect(cleanGuardians({version:1,defeated:Array(9).fill('city')})).toBe(null);
 expect(cleanGuardians({version:1,defeated:['city','city','capital','bogus'],unlocked:true})).toEqual({version:1,defeated:['city']});
 const store=createGuardianStore({getItem:()=>JSON.stringify({version:1,defeated:['city','city','bogus'],unlocked:true}),setItem(){throw Error('refused');}});expect(store.complete).toBe(false);for(const spec of GUARDIANS)store.mark(spec.id);expect(store.complete).toBe(true);expect(store.snapshot().persistent).toBe(false);
});
test('distinct attacks have bounded pools, telegraphs and one-way victory; leaving resets only undefeated fights',()=>{
 for(const spec of GUARDIANS){const sim=createGuardianState(spec),p=visitor(spec);let maxShots=0,maxEffects=0;
  for(let i=0;i<800;i++){sim.update(p,i*.05,.05,()=>{});maxShots=Math.max(maxShots,sim.state.shots.length);maxEffects=Math.max(maxEffects,sim.state.effects.length);}
  expect(sim.state.attacks).toBeGreaterThan(3);expect(maxShots).toBeLessThanOrEqual(24);expect(maxEffects).toBeLessThanOrEqual(12);
  sim.hit(true,60);expect(sim.state.hp).toBeLessThan(spec.hp);sim.update({...p,x:spec.x+400},61,.05);expect(sim.state.hp).toBe(spec.hp);expect(sim.state.shots).toHaveLength(0);expect(sim.state.effects).toHaveLength(0);
 }
});
test('shock waves can be jumped, rays respect walls, and a charge cannot pass a blocked position',()=>{
 const spec=GUARDIANS.find(g=>g.attack==='wave'),a=createGuardianState(spec),b=createGuardianState(spec),p=visitor(spec);let low=0,high=0;
 for(let i=0;i<180;i++){a.update({...p},i*.05,.05,v=>low+=v);b.update({...p,y:p.y+4},i*.05,.05,v=>high+=v);}expect(low).toBeGreaterThan(0);expect(high).toBe(0);
 const beamSpec=GUARDIANS.find(g=>g.attack==='beam'),beam=createGuardianState(beamSpec);let beamDamage=0;for(let i=0;i<160;i++)beam.update(visitor(beamSpec),i*.05,.05,v=>beamDamage+=v,()=>0);expect(beamDamage).toBe(0);
 const chargeSpec=GUARDIANS.find(g=>g.attack==='charge'),charge=createGuardianState(chargeSpec);for(let i=0;i<160;i++)charge.update(visitor(chargeSpec),i*.05,.05,()=>{},(_a,_b,l)=>l,()=>true);expect(charge.state.x).toBe(chargeSpec.x);
});
test('flight requires a real unlock and deliberate double taps, not repeated or stale taps',()=>{
 const flight=createFlight(),p=createPlayer(0,0,()=>0);expect(flight.tap(p,0)).toBe(false);flight.setUnlocked(true);expect(flight.tap(p,10)).toBe(false);expect(flight.tap(p,250)).toBe(true);expect(p.flying).toBe(true);
 expect(flight.tap(p,900)).toBe(false);expect(flight.tap(p,1100)).toBe(true);expect(p.flying).toBe(false);flight.tap(p,1500);flight.resetTap();expect(flight.tap(p,1600)).toBe(false);
});
test('creative flight hovers, rises, descends to land, accelerates and respects walls and world bounds',()=>{
 const p={...createPlayer(0,0,()=>0),y:20,flying:true};for(let i=0;i<20;i++)stepFlight(p,{},.05,()=>0,()=>false);expect(p.y).toBe(20);
 for(let i=0;i<20;i++)stepFlight(p,{up:true},.05,()=>0,()=>false);expect(p.y).toBeCloseTo(40);
 const slow={...p,x:0,z:0,flightVX:0,flightVZ:0},fast={...slow};for(let i=0;i<20;i++){stepFlight(slow,{forward:1,yaw:0},.05,()=>0,()=>false);stepFlight(fast,{forward:1,yaw:0,fast:true},.05,()=>0,()=>false);}expect(-fast.z).toBeGreaterThan(-slow.z*2.9);
 const wall={...p,x:0,z:0,flightVX:0,flightVZ:0};for(let i=0;i<20;i++)stepFlight(wall,{forward:1},.05,()=>0,(_x,z)=>z< -4);expect(wall.z).toBeGreaterThanOrEqual(-4);
 for(let i=0;i<60&&p.flying;i++)stepFlight(p,{down:true},.05,()=>0,()=>false);expect(p).toMatchObject({flying:false,grounded:true,y:0});
 const edge={...p,x:5997,y:6199,flying:true};stepFlight(edge,{strafe:1,up:true,fast:true},.1,()=>0,()=>false);expect(edge.x).toBeLessThanOrEqual(5998);expect(edge.y).toBeLessThanOrEqual(6200);
 const roof={...p,y:10.2,flying:true};stepFlight(roof,{down:true},.05,()=>10,(_x,_z,_r,y)=>y<10);expect(roof).toMatchObject({y:10,flying:false,grounded:true});
});
test('double forward offers acceleration without requiring a browser Control shortcut',()=>{
 const f=createFlight();f.setUnlocked(true);f.forwardTap(0);expect(f.fast).toBe(false);f.releaseForward();f.forwardTap(200);expect(f.fast).toBe(true);f.releaseForward();expect(f.fast).toBe(false);f.forwardTap(900);expect(f.fast).toBe(false);f.resetTap();f.forwardTap(1000);expect(f.fast).toBe(false);
});
test('real guardian models have visible weak points, independent health, swept combat targets and owned cleanup',()=>{
 map.clear();const scene=new THREE.Scene(),store=createGuardianStore(storage()),world={obstructRay:(_a,_b,l)=>l,isBlocked:()=>false},won=[];
 const guardians=createCityGuardians(scene,world,store,id=>won.push(id));const spec=GUARDIANS[0];guardians.update(visitor(spec),0,.05);
 expect(guardians.snapshot().total).toBe(8);const target=guardians.targets().find(m=>m.userData.guardianWeak);expect(target).toBeTruthy();
 const weak=guardians.snapshot().actors.find(a=>a.id===spec.id).weak;expect(weak.y).toBeGreaterThan(spec.y+10);expect(guardians.targets().length).toBeLessThan(25);
 for(let i=0;i<spec.hp;i++)guardians.hit(target,i*.2);expect(won).toEqual([spec.id]);expect(store.has(spec.id)).toBe(true);expect(guardians.targets().length).toBe(0);
 const owned=new Set();scene.traverse(m=>{if(m.geometry)owned.add(m.geometry);if(m.material)owned.add(m.material);});let releases=0;for(const resource of owned)resource.addEventListener('dispose',()=>releases++);
 guardians.dispose();expect(scene.children).toHaveLength(0);expect(releases).toBe(owned.size);guardians.dispose();expect(releases).toBe(owned.size);
});
test('progress reset removes only the four game records and reports failed removals',()=>{
 const data=new Map(GAME_PROGRESS_KEYS.map(k=>[k,'record']));data.set('ocv.site.awards.v1','keep');data.set('ocv.profile.v1','keep');const target={removeItem:k=>data.delete(k),getItem:k=>data.get(k)??null};
 expect(resetGameProgress(target).ok).toBe(true);expect([...data.keys()]).toEqual(['ocv.site.awards.v1','ocv.profile.v1']);expect(resetGameProgress(null)).toMatchObject({ok:true,sessionOnly:true});
 expect(resetGameProgress({removeItem(){throw Error('refused');},getItem:()=>null})).toMatchObject({ok:false,failures:[...GAME_PROGRESS_KEYS]});
});
