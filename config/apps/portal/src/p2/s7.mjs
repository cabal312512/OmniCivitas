import * as THREE from 'three';
import {GUARDIANS,createGuardianState} from '../../../../../pinia/8g.mjs';
export function createCityGuardians(scene,world,store,onDefeat=()=>{}){
 const root=new THREE.Group();root.name='district-guardians';scene.add(root);
 const geometries=[],materials=[],keepG=g=>(geometries.push(g),g),keepM=m=>(materials.push(m),m);
 const shapes={box:keepG(new THREE.BoxGeometry(1,1,1)),orb:keepG(new THREE.IcosahedronGeometry(1,2)),cone:keepG(new THREE.ConeGeometry(1,1,8)),ring:keepG(new THREE.TorusGeometry(1,.075,6,32)),stem:keepG(new THREE.CylinderGeometry(.5,.5,1,8))};
 const white=keepM(new THREE.MeshStandardMaterial({color:'#eafaff',metalness:.46,roughness:.24}));
 const glass=keepM(new THREE.MeshPhysicalMaterial({color:'#a5dbee',metalness:.1,roughness:.12,clearcoat:1}));
 const weak=keepM(new THREE.MeshStandardMaterial({color:'#e4fff2',emissive:'#49cf9e',emissiveIntensity:1.3,roughness:.3}));
 const warning=keepM(new THREE.MeshBasicMaterial({color:'#eea789',transparent:true,opacity:.7,depthWrite:false}));
 const actors=[],targets=[],effects=[],shots=[];let disposed=false;
 for(const spec of GUARDIANS){
  const simulation=createGuardianState(spec,{defeated:store.has(spec.id),onDefeat:id=>{store.mark(id);onDefeat(id,store.complete);}}),state=simulation.state;
  const group=new THREE.Group();root.add(group);
  const surface=keepM(new THREE.MeshStandardMaterial({color:spec.color,metalness:.38,roughness:.27}));
  const pieces=[],rotors=[];
  function part(shape,mat,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){const m=new THREE.Mesh(shapes[shape],mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.set(rx,ry,rz);m.castShadow=true;m.receiveShadow=true;m.userData.guardian=simulation;group.add(m);pieces.push(m);return m;}
  if(spec.kind==='relay'){
   part('box',glass,0,12,0,11,11,11);for(let i=0;i<3;i++)rotors.push(part('ring',white,0,12,0,11+i*2,11+i*2,11+i*2,i*.6,i*.8));
   for(const s of [-1,1])part('stem',surface,s*7,5,0,1.3,10,1.3,0,0,s*.2);
  }else if(spec.kind==='array'){
   for(let i=0;i<4;i++){part('box',surface,0,4+i*5,0,13-i*2,3.6,9-i);rotors.push(part('box',glass,0,5+i*5,0,19,1,2,0,i*.6));}
  }else if(spec.kind==='bell'){
   part('orb',glass,0,13,0,12,15,12);part('cone',surface,0,18,0,11,18,11);
   for(let i=0;i<4;i++)part('ring',white,0,4+i*4,0,13-i*2,13-i*2,13-i*2,Math.PI/2);
   rotors.push(part('stem',white,0,7,0,.7,13,.7));
  }else if(spec.kind==='carousel'){
   part('stem',surface,0,7,0,2,14,2);for(const y of [5,15])rotors.push(part('ring',white,0,y,0,13,13,13,Math.PI/2));
   for(let i=0;i<6;i++){const a=i*Math.PI/3;rotors.push(part('orb',surface,Math.cos(a)*11,10,Math.sin(a)*11,3.1,6,3.1));}
  }else if(spec.kind==='spear'){
   part('cone',glass,0,14,0,7,28,7);part('cone',surface,0,5,0,9,10,9,Math.PI);
   for(const s of [-1,1])rotors.push(part('cone',white,s*11,16,0,2,20,2,0,0,s*.3));
  }else if(spec.kind==='ram'){
   part('box',surface,0,7,0,14,10,19);part('orb',glass,0,13,9,7,5,7);
   for(const s of [-1,1]){part('cone',white,s*6,17,10,1.5,10,1.5,0,0,s*.5);for(const z of [-6,6])part('stem',white,s*6,3,z,1.2,6,1.2);}
  }else if(spec.kind==='tide'){
   part('orb',glass,0,16,0,11,9,11);for(let i=0;i<4;i++)rotors.push(part('ring',surface,0,8+i*4,0,16-i*2,16-i*2,16-i*2,Math.PI/2,.2*i));
  }else{
   for(let i=0;i<5;i++)part('orb',surface,0,5,(i-2)*5,5,4,5);
   for(const s of [-1,1])for(const z of [-7,0,7])part('stem',white,s*7,2.5,z,.75,8,.75,0,0,s*.7);
  }
  const core=part('orb',weak,0,spec.kind==='crawler'?7:13,12,2.2,2.2,2.2);core.userData.guardianWeak=true;
  const health=part('box',weak,0,spec.kind==='spear'?32:28,0,16,.32,.32);health.userData.guardian=null;
  const ring=new THREE.Mesh(shapes.ring,warning);ring.rotation.x=-Math.PI/2;root.add(ring);
  const a={spec,simulation,state,group,core,health,ring,rotors,pieces};actors.push(a);targets.push(...pieces.filter(m=>m!==health));
 }
 for(let i=0;i<24;i++){const m=new THREE.Mesh(shapes.orb,warning);m.scale.setScalar(.6);m.visible=false;root.add(m);shots.push(m);}
 for(let i=0;i<12;i++){const m=new THREE.Mesh(shapes.ring,warning);m.visible=false;root.add(m);effects.push(m);}
 let activeShots=[],activeEffects=[];
 function update(p,time,dt,onDamage=()=>{}){
  if(disposed)return;activeShots=[];activeEffects=[];
  for(const a of actors){const s=a.state;
   a.simulation.update(p,time,dt,onDamage,world.obstructRay,world.isBlocked);
   a.group.visible=!s.defeated&&Math.hypot(p.x-s.x,p.z-s.z)<1900;
   a.group.position.set(s.x,s.y,s.z);a.group.rotation.y=Math.atan2(p.x-s.x,p.z-s.z);
   a.health.visible=s.active;a.health.scale.x=16*s.hp/s.maxHp;
   a.ring.visible=!!s.pending;a.ring.position.set(s.pending?.x??s.x,s.y+.1,s.pending?.z??s.z);a.ring.scale.setScalar(s.pending?.attack==='charge'?11:15);
   if(a.group.visible){a.rotors.forEach((m,i)=>{m.rotation.y=time*.23+i*.6;});a.core.material=weak;a.group.updateMatrixWorld(true);}
   activeShots.push(...s.shots);activeEffects.push(...s.effects);
  }
  for(let i=0;i<shots.length;i++){const m=shots[i],s=activeShots[i];m.visible=!!s;if(s)m.position.set(s.x,s.y,s.z);}
  for(let i=0;i<effects.length;i++){const m=effects[i],e=activeEffects[i];m.visible=!!e;if(!e)continue;
   if(e.kind==='beam'){m.geometry=shapes.box;m.rotation.set(0,-e.angle+Math.PI/2,0);m.position.set(e.x+Math.cos(e.angle)*e.radius/2,e.y,e.z+Math.sin(e.angle)*e.radius/2);m.scale.set(.4,.4,e.radius);}
   else{m.geometry=shapes.ring;m.rotation.set(Math.PI/2,0,0);m.position.set(e.x,e.y+.18,e.z);m.scale.set(e.radius,e.radius,1);}
  }
 }
 return{update,targets:()=>disposed?[]:targets.filter(m=>m.userData.guardian.state.active&&!m.userData.guardian.state.defeated),hit(mesh,time){const sim=mesh?.userData?.guardian;return!!sim&&sim.hit(!!mesh.userData.guardianWeak,time);},snapshot:()=>({total:actors.length,defeated:store.snapshot().defeated,flightUnlocked:store.complete,projectiles:activeShots.length,effects:activeEffects.length,actors:actors.map(a=>({...a.spec,...a.state,shots:a.state.shots.length,effects:a.state.effects.length,weak:{x:a.core.getWorldPosition(new THREE.Vector3()).x,y:a.core.getWorldPosition(new THREE.Vector3()).y,z:a.core.getWorldPosition(new THREE.Vector3()).z}}))}),dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();root.clear();}};
}
