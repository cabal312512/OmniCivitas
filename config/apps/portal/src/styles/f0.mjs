import * as THREE from 'three';
import {GIANT_SITES} from '../../../../../pinia/laf84ejfa.mjs';
import {SPAWN,riverShapeAt} from '../../../../../pinia/j7.mjs';
import {GIANT_ROLES} from '../../../../../pcakage/build2/r6.mjs';
import {stepGiantMotion} from './3.mjs';
import {createGiantCombat} from './c2.mjs';
export {GIANT_ROLES} from '../../../../../pcakage/build2/r6.mjs';

const cap=(v,a,b)=>Math.max(a,Math.min(b,v));
export function createGiants(scene,world,onDefeat=()=>{}){
 const root=new THREE.Group();root.name='field-inhabitants';scene.add(root);const geometries=new Set(),materials=new Set(),targets=[],actors=[],batches=[];
 const geo=g=>(geometries.add(g),g),mat=m=>(materials.add(m),m);
 const shapes={sphere:geo(new THREE.SphereGeometry(1,20,14)),box:geo(new THREE.BoxGeometry(1,1,1)),ring:geo(new THREE.TorusGeometry(1,.065,8,48)),leg:geo(new THREE.CylinderGeometry(.7,1,1,10)),fin:geo(new THREE.ConeGeometry(1,1,4)),body:geo(new THREE.CapsuleGeometry(1,2,6,12)),bar:geo(new THREE.PlaneGeometry(1,1))};
 const chrome=mat(new THREE.MeshStandardMaterial({color:0xd5e8f2,metalness:.7,roughness:.21})),glass=mat(new THREE.MeshPhysicalMaterial({color:0xd2f3ff,roughness:.12,metalness:.15,transmission:.22,thickness:8,clearcoat:1})),weak=mat(new THREE.MeshBasicMaterial({color:0xccfff2})),warn=mat(new THREE.MeshBasicMaterial({color:0xffb896,transparent:true,opacity:.8,depthWrite:false}));
 const surfaces=GIANT_ROLES.map(r=>mat(new THREE.MeshPhysicalMaterial({color:r.color,metalness:.25,roughness:.24,clearcoat:1,envMapIntensity:1.1})));
 for(const site of GIANT_SITES){const role=GIANT_ROLES[site.kind];if(!role.flying&&(world.isBlocked(site.x,site.z,16)||riverShapeAt(site.x,site.z).mask>.4))continue;
  const group=new THREE.Group(),body=new THREE.Group();group.add(body);group.scale.setScalar(site.scale);
  const floor=world.groundAt(site.x,site.z);
  const a={...site,role,group,body,x:site.x,z:site.z,y:floor+role.height*site.scale,floor,floorX:site.x,floorZ:site.z,homeX:site.x,homeZ:site.z,hp:role.hp,alive:true,lastHit:-Infinity,cooldown:1.5,pending:0,respawnAt:0,walked:0,hits:0,kills:0,targets:[],limbs:[],heading:site.phase,seen:false,engaged:false,avoidSide:site.phase%2<1?1:-1,avoidHeading:site.phase,avoidUntil:0,charge:null};
  const part=(shape,surface,position,scale,weakPart=false)=>{const m=new THREE.Mesh(shapes[shape],surface);m.position.set(...position);m.scale.set(...scale);m.castShadow=surface!==glass;m.receiveShadow=true;m.userData.giant=a;m.userData.giantWeak=weakPart;body.add(m);a.targets.push(m);targets.push(m);return m;};
  const surface=surfaces[site.kind];
  if(role.kind==='walker'){part('body',surface,[0,3,0],[19,9,20]);part('sphere',glass,[0,20,-6],[20,12,15]);for(let j=0;j<4;j++){const x=j%2?18:-18,z=j<2?16:-16;const limb=part('leg',chrome,[x,-25,z],[3,62,3]);limb.rotation.z=x*.005;a.limbs.push(limb);}part('sphere',weak,[0,8,21],[5,5,3],true);}
  else if(role.kind==='manta'){part('sphere',surface,[0,0,0],[48,7,24]);for(const side of [-1,1]){const fin=part('fin',glass,[side*43,0,0],[24,73,6]);fin.rotation.z=side*Math.PI/2;fin.rotation.x=.3;a.limbs.push(fin);}part('leg',chrome,[0,0,-39],[2,65,2]).rotation.x=Math.PI/2;part('sphere',weak,[0,-6,8],[6,4,6],true);}
  else if(role.kind==='leviathan'){part('body',surface,[0,0,0],[25,48,24]).rotation.x=Math.PI/2;for(let j=0;j<9;j++){const ring=part('ring',chrome,[0,0,(j-4)*15],[26,26,26]);ring.rotation.y=j*.025;}for(const side of [-1,1]){const fin=part('fin',glass,[side*29,-2,0],[11,72,3]);fin.rotation.z=side*1.2;a.limbs.push(fin);}part('sphere',weak,[0,-19,42],[7,5,7],true);}
  else if(role.kind==='snail'){part('sphere',surface,[0,-18,0],[39,10,52]);part('sphere',glass,[0,10,-8],[36,37,34]);for(let j=0;j<5;j++)part('ring',chrome,[0,8+j*2,-8],[30-j*4,30-j*4,30-j*4]).rotation.y=Math.PI/2;for(const side of [-1,1]){const eye=part('leg',surface,[side*10,8,33],[1.5,34,1.5]);eye.rotation.z=side*.14;part('sphere',weak,[side*13,26,33],[4,4,4],true);}}
  else if(role.kind==='prism'){part('fin',surface,[0,0,0],[27,92,27]);part('fin',glass,[0,0,0],[32,75,32]).rotation.z=Math.PI;for(let j=0;j<3;j++)part('ring',chrome,[0,(j-1)*24,0],[35,35,35]).rotation.x=Math.PI/2;part('sphere',weak,[0,0,28],[6,8,4],true);}
  else if(role.kind==='orchid'){part('leg',chrome,[0,-37,0],[7,77,7]);part('sphere',surface,[0,8,0],[16,18,16]);for(let j=0;j<7;j++){const angle=j*Math.PI*2/7,limb=part('fin',j%2?glass:surface,[Math.cos(angle)*33,15,Math.sin(angle)*33],[13,67,8]);limb.rotation.set(Math.sin(angle)*.8,angle,Math.cos(angle)*.8);a.limbs.push(limb);}part('sphere',weak,[0,18,19],[7,7,4],true);}
  else if(role.kind==='ram'){part('body',surface,[0,-6,0],[25,13,25]).rotation.x=Math.PI/2;part('sphere',chrome,[0,8,31],[22,19,18]);for(const side of [-1,1]){part('fin',glass,[side*20,20,35],[5,38,5]).rotation.z=side*.5;for(const z of [-23,22]){const leg=part('leg',surface,[side*20,-27,z],[4,34,4]);a.limbs.push(leg);}}part('sphere',weak,[0,10,-35],[6,6,4],true);}
  else if(role.kind==='bell'){part('sphere',glass,[0,12,0],[39,46,39]);part('ring',chrome,[0,-18,0],[41,41,41]).rotation.x=Math.PI/2;for(let j=0;j<5;j++){const ring=part('ring',surface,[0,32-j*9,0],[20+j*5,20+j*5,20+j*5]);ring.rotation.x=Math.PI/2;}const pendulum=part('leg',chrome,[0,-34,0],[3,51,3]);a.limbs.push(pendulum);part('sphere',weak,[0,-57,0],[10,10,10],true);}
  else if(role.kind==='lantern'){part('leg',surface,[0,-26,0],[5,44,5]);part('box',glass,[0,10,0],[37,47,37]);for(const x of [-19,19])for(const z of [-19,19])part('leg',chrome,[x,10,z],[1.8,51,1.8]);part('fin',surface,[0,47,0],[34,29,34]);part('sphere',weak,[0,10,0],[9,15,9],true);}
  else{for(let j=0;j<10;j++){const m=part('sphere',j%3?glass:surface,[Math.sin(j*.6)*18,Math.cos(j*.7)*8,(j-4.5)*23],[15-j*.65,9,16]);a.limbs.push(m);}part('sphere',weak,[0,0,108],[7,7,7],true);part('ring',chrome,[0,0,-107],[23,23,23]);}
  for(const limb of a.limbs)limb.userData.baseX=limb.rotation.x;
  const health=new THREE.Mesh(shapes.bar,weak);health.position.y=role.kind==='prism'?60:52;health.scale.set(48,1.1,1);health.visible=false;group.add(health);a.health=health;
  const warning=new THREE.Mesh(shapes.ring,warn);warning.rotation.x=-Math.PI/2;warning.scale.setScalar(35);warning.visible=false;root.add(warning);a.warning=warning;actors.push(a);
 }
 // Preserve every model part and material, while drawing equal parts together.
 // The original meshes remain exact raycast targets; only their rendering is batched.
 const groups=new Map(),matrix=new THREE.Matrix4();
 for(const a of actors)for(const mesh of [...a.targets,a.health]){mesh.updateMatrix();mesh.matrixAutoUpdate=a.limbs.includes(mesh)||mesh===a.health;const key=`${mesh.geometry.uuid}:${mesh.material.uuid}:${mesh.castShadow}`;let batch=groups.get(key);if(!batch){batch={parts:[],mesh:null};groups.set(key,batch);}batch.parts.push({actor:a,source:mesh});}
 for(const batch of groups.values()){const source=batch.parts[0].source;batch.mesh=new THREE.InstancedMesh(source.geometry,source.material,batch.parts.length);batch.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.mesh.castShadow=source.castShadow;batch.mesh.receiveShadow=source.receiveShadow;batch.mesh.frustumCulled=false;root.add(batch.mesh);batches.push(batch);}
 function syncModels(player,time){for(const a of actors){a.group.position.set(a.x,a.y,a.z);a.group.rotation.y=a.heading;a.group.visible=a.alive&&Math.hypot(a.x-player.x,a.z-player.z)<4600;a.group.updateMatrix();a.health.visible=a.hp<a.role.hp;a.health.scale.x=48*a.hp/a.role.hp;a.health.rotation.y=Math.atan2(player.x-a.x,player.z-a.z)-a.heading;for(let j=0;j<a.limbs.length;j++)a.limbs[j].rotation.x=a.limbs[j].userData.baseX+Math.sin(time*(a.role.flying?.7:1.8)+j*Math.PI)*.16;}
  for(const b of batches){let count=0;for(const {actor:a,source:m}of b.parts){if(!a.group.visible||!m.visible)continue;if(m.matrixAutoUpdate)m.updateMatrix();matrix.multiplyMatrices(a.group.matrix,m.matrix);m.matrixWorld.copy(matrix);b.mesh.setMatrixAt(count++,matrix);}b.mesh.count=count;b.mesh.visible=count>0;b.mesh.instanceMatrix.needsUpdate=true;}
 }
 const combat=createGiantCombat(root,shapes,warn,world),stats={kills:0,respawns:0};let disposed=false;
 const safe=p=>Math.hypot(p.x-SPAWN.x,p.z-SPAWN.z)<100||world.restStations.some(s=>Math.hypot(p.x-s.position.x,p.z-s.position.z)<s.radius+12&&Math.abs(p.y-s.position.y)<12);
 function update(player,time,dt,onDamage=()=>{},onSee=()=>{},onHeal=()=>{}){if(disposed)return;dt=cap(dt,0,.1);const protectedPlayer=safe(player);
  for(const a of actors){if(!a.alive){a.group.visible=false;a.warning.visible=false;if(time>=a.respawnAt){a.alive=true;a.hp=a.role.hp;a.lastHit=-Infinity;a.x=a.homeX;a.z=a.homeZ;a.floor=world.groundAt(a.x,a.z);a.y=a.floor+a.role.height*a.scale;a.engaged=false;a.cooldown=2;stats.respawns++;}else continue;}
   const motion=stepGiantMotion(a,player,time,dt,world,protectedPlayer);
   if(motion.range<220&&!a.seen){a.seen=true;onSee(a.role.kind);}
   combat.prepare(a,player,time,dt,motion.engaged);combat.charge(a,motion,player,time,onDamage);
   if(a.role.kind==='lantern'&&motion.range<65&&Math.abs(player.y-a.floor)<8&&player.health<1){const healed=Math.min(1-player.health,dt*.065);player.health+=healed;onHeal(healed);}
  }combat.update(player,time,dt,protectedPlayer,onDamage);syncModels(player,time);root.updateMatrixWorld(true);
 }
 update({x:SPAWN.x,y:world.groundAt(SPAWN.x,SPAWN.z),z:SPAWN.z},0,0);
 return{update,targets(){return disposed?[]:targets.filter(m=>m.userData.giant.alive&&m.userData.giant.group.visible);},hit(mesh,time){const a=mesh?.userData?.giant;if(disposed||!actors.includes(a)||!a.alive||!Number.isFinite(time)||time-a.lastHit<.16)return false;a.lastHit=time;a.hits++;a.hp=Math.max(0,a.hp-(mesh.userData.giantWeak?4:2));if(!a.hp){a.alive=false;a.group.visible=false;a.warning.visible=false;combat.clearOwner(a);a.respawnAt=time+80+a.phase%1*25;stats.kills++;a.kills++;onDefeat({kind:a.role.kind,flying:a.role.flying,hostile:a.role.hostile,giant:true});}return true;},
  hasFriendlyVisitor(player){return actors.some(a=>a.alive&&!a.role.hostile&&Math.hypot(player.x-a.x,player.z-a.z)<120);},
  snapshot(){return{disposed,...stats,...combat.snapshot(),total:actors.length,renderBatches:batches.length,modelParts:batches.reduce((n,b)=>n+b.parts.length,0),species:GIANT_ROLES.map(role=>({kind:role.kind,hostile:role.hostile,flying:role.flying,attack:role.attack,count:actors.filter(a=>a.role===role).length})),actors:actors.map(a=>({id:a.id,kind:a.role.kind,x:a.x,y:a.y,z:a.z,hp:a.hp,maxHp:a.role.hp,hostile:a.role.hostile,flying:a.role.flying,alive:a.alive,walked:a.walked,warning:!!a.pending,respawnAt:a.respawnAt}))};},
  dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const b of batches)b.mesh.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();root.clear();}
 };
}
