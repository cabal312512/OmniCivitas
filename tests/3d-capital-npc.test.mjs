import {test,expect} from 'vitest';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {createEntities} from '../config/apps/portal/src/3d/entities.mjs';
const require=createRequire(new URL('../config/apps/portal/package.json',import.meta.url));
const THREE=await import(pathToFileURL(path.join(path.dirname(require.resolve('three')),'three.module.js')).href);

const original=['city','north-city','white-plaza','arcade','spires'];
const additional=['terrace-city','lagoon-city','horizon-city','capital'];
const ground=()=>55;
const landmarks=original.map((id,index)=>({id,position:new THREE.Vector3(index*800,55,0)}));
const records=[...original,...additional].map((id,index)=>({id,x:index*800,z:0,
 npcSites:Array.from({length:8},(_,site)=>({x:index*800+560+site*13,z:120+site*9}))}));

test('Expanded districts get distinct independent NPCs on their surveyed safe sites',()=>{
 const scene=new THREE.Scene(),inhabitants=createEntities(scene,landmarks,ground,()=>false,records);
 try{
  const state=inhabitants.snapshot();expect(state.npcCount).toBe(72);
  expect(new Set(state.npcs.map(npc=>npc.id)).size).toBe(72);
  expect(new Set(state.npcs.map(npc=>npc.city)).size).toBe(9);
  for(const id of additional){
   const people=state.npcs.filter(npc=>npc.city===id),city=records.find(record=>record.id===id);
   expect(people).toHaveLength(8);
   for(const npc of people){
    expect(city.npcSites.some(site=>Math.hypot(site.x-npc.homeX,site.z-npc.homeZ)<.01)).toBe(true);
    expect(npc.homeX-city.x).toBeGreaterThan(530);
    expect(npc).toMatchObject({proactive:false,hostile:false,attacks:0,damageEvents:0});
   }
  }
  expect(Object.values(state.npcKinds).every(count=>count>=12)).toBe(true);
 }finally{inhabitants.dispose();}
});

test('Added city inhabitants remain harmless after damage and wandering, then release their resources',()=>{
 const scene=new THREE.Scene(),inhabitants=createEntities(scene,landmarks,ground,()=>false,records);
 try{
  const target=inhabitants.targets().find(mesh=>mesh.userData.entity?.city==='capital');
  expect(target).toBeTruthy();expect(inhabitants.hit(target,0)).toBe(true);
  const player={x:target.userData.entity.homeX,z:target.userData.entity.homeZ,y:55,health:1};
  // No hostile enemy is near this separate district; wounded NPCs cannot attack.
  for(let frame=1;frame<=240;frame++)inhabitants.update(player,frame*.05,.05,()=>{throw Error('Harmless district attacked');},false);
  const npc=inhabitants.snapshot().npcs.find(npc=>npc.id===target.userData.entity.id);
  expect(npc.walked).toBeGreaterThan(0);expect(npc).toMatchObject({attacks:0,damageEvents:0,hostile:false});
 }finally{inhabitants.dispose();}
 expect(scene.children).toHaveLength(0);expect(inhabitants.snapshot().disposed).toBe(true);
});
