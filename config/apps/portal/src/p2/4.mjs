import * as THREE from 'three';
import {CITIES,cityHalf} from '../../../../../pcakage/build2/c0.mjs';
import {TOWNS} from '../../../../../pinia/tt9.mjs';
import {npcLine} from '../../../../../pinia/r0.mjs';
import {createSpatialIndex} from '../../../../../pinia/idx3.mjs';
export function createResidents(scene,world,onTalk=()=>{}){
 const root=new THREE.Group();root.name='residents';scene.add(root);const geometry=[],materials=[],actors=[],batches=[],index=createSpatialIndex(256),story={mail:0};let disposed=false,spoken=0,defeated=0;
 const g=x=>(geometry.push(x),x),m=x=>(materials.push(x),x),shapes={box:g(new THREE.BoxGeometry(1,1,1)),sphere:g(new THREE.SphereGeometry(1,12,8)),leg:g(new THREE.CylinderGeometry(.08,.08,1,6)),capsule:g(new THREE.CapsuleGeometry(.3,.7,3,8)),ring:g(new THREE.TorusGeometry(.5,.05,6,20))};
 const white=m(new THREE.MeshStandardMaterial({color:0xe4eced,roughness:.28,metalness:.3})),dark=m(new THREE.MeshStandardMaterial({color:0x62899d,roughness:.24,metalness:.5})),glass=m(new THREE.MeshPhysicalMaterial({color:0xb9e8ef,roughness:.12,metalness:.1,transmission:.2,thickness:.2,clearcoat:1}));
 const colors=[0x9adace,0xd8bcdd,0xb4d8f1,0xe4dda6,0xb9d1c3,0xede5e4,0x9ec3d6,0xc2c7e4].map(color=>m(new THREE.MeshStandardMaterial({color,roughness:.22,metalness:.24})));
 const districts=[...CITIES.map(c=>({...c,count:36,span:Math.min(cityHalf(c)-80,650)})),...TOWNS.map(t=>({...t,count:30,span:170,town:true})),{id:'avenue',x:0,z:-170,ground:10,count:20,span:18,town:true,lanes:1,rows:15,spacing:42,laneSpacing:146},{id:'village',x:-3000,z:2500,ground:22,count:20,span:18,town:true,lanes:1,rows:9,spacing:39,laneSpacing:146},{id:'east-village',x:4200,z:2600,ground:28,count:20,span:18,town:true,lanes:1,rows:9,spacing:41,laneSpacing:146}];
 function build(d,j,di){let x,z;
  if(d.town){x=d.x+(j%d.lanes-(d.lanes-1)/2)*d.laneSpacing+(j%2?16:-16);z=d.z+(Math.floor(j/d.lanes)%d.rows-(d.rows-1)/2)*d.spacing;}
  else{x=d.x+((j%6)-2.5)*d.span/3;z=d.z+(Math.floor(j/6)-2.5)*d.span/3;if(d.clearing&&Math.hypot(x-d.x,z-d.z)<d.clearing+25){x=d.x+d.clearing+45;z=d.z+(j-18)*9;}}
  let clear=false;for(let k=0;k<100;k++){const px=x+Math.sin(k*2.399)*Math.floor(k/10)*8,pz=z+Math.cos(k*2.399)*Math.floor(k/10)*8,y=world.groundAt(px,pz);if(!world.isBlocked(px,pz,1,y)){x=px;z=pz;clear=true;break;}}if(!clear)return;
  const kind=(di*3+j)%8,a={id:2000+di*100+j,kind,district:d.id,x,z,y:world.groundAt(x,z),homeX:x,homeZ:z,radius:38,hp:3+j%3,maxHp:3+j%3,alive:true,until:0,lastHit:-Infinity,talkAt:0,talks:0,close:false,parts:[],limbs:[],group:new THREE.Group(),heading:j*.37,avoidUntil:0,walked:0};
  const part=(shape,mat,at,scale,limb=false)=>{const mesh=new THREE.Mesh(shapes[shape],mat);mesh.position.set(...at);mesh.scale.set(...scale);mesh.userData.resident=a;mesh.castShadow=true;mesh.receiveShadow=true;mesh.updateMatrix();a.group.add(mesh);a.parts.push(mesh);if(limb)a.limbs.push(mesh);return mesh;},color=colors[kind];
  if(kind===0||kind===2||kind===5){part('capsule',color,[0,1.02,0],[1,1.1,1]);part('sphere',kind===2?glass:white,[0,1.95,0],[.28,.32,.28]);part('box',dark,[0,1.96,.24],[.36,.09,.07]);for(const side of [-1,1]){part('leg',white,[side*.2,.36,0],[1,.7,1],true);part('leg',color,[side*.43,1.03,0],[1,.75,1],true);}if(kind===5)part('box',glass,[0,1.15,-.35],[.6,.6,.4]);if(kind===2)part('ring',dark,[0,2.2,0],[1,1,1]).rotation.x=Math.PI/2;}
  else if(kind===1){part('box',color,[0,.75,0],[1.15,1.1,.7]);part('box',white,[0,1.4,0],[.9,.1,.8]);part('box',dark,[0,1.03,.37],[.75,.1,.03]);for(const s of [-1,1])part('sphere',dark,[s*.48,.17,0],[.2,.2,.2],true);}
  else if(kind===3){part('box',color,[0,.8,0],[1.3,1,.8]);part('box',white,[0,1.6,0],[.5,.65,.4]);part('box',dark,[0,1.67,.22],[.3,.2,.03]);for(const s of [-1,1])part('leg',dark,[s*.4,.2,0],[1,.4,1],true);}
  else if(kind===4){part('box',color,[0,.75,0],[1.4,.3,.9]);part('sphere',glass,[0,1.3,0],[.6,.45,.45]);for(const x of [-.58,.58])for(const z of [-.34,.34])part('ring',dark,[x,.32,z],[.5,.5,.5],true).rotation.y=Math.PI/2;}
  else if(kind===6){part('capsule',color,[0,.65,0],[1.2,.6,1]);part('sphere',white,[0,1.05,.43],[.28,.3,.3]);for(const x of [-.27,.27])for(const z of [-.4,.4])part('leg',dark,[x,.25,z],[1,.45,1],true);}
  else{part('ring',glass,[0,1.4,0],[1.25,1.25,1.25]);part('sphere',color,[0,1.4,0],[.24,.24,.24]);part('leg',white,[0,.62,0],[1,1.1,1]);part('box',dark,[0,.1,0],[.6,.2,.6]);}
  for(const p of a.parts)p.updateMatrix();actors.push(a);index.add({x,z,radius:70,actor:a});
 }
 districts.forEach((d,di)=>{for(let j=0;j<d.count;j++)build(d,j,di);});
 const grouped=new Map();for(const a of actors)for(const p of a.parts){const key=p.geometry.uuid+':'+p.material.uuid;let list=grouped.get(key);if(!list){list=[];grouped.set(key,list);}list.push({actor:a,part:p});}
 for(const list of grouped.values()){const p=list[0].part,mesh=new THREE.InstancedMesh(p.geometry,p.material,list.length);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);batches.push({mesh,list});}
 const matrix=new THREE.Matrix4(),active=new Set();
 function say(a,time,reason){a.talks++;a.talkAt=time+8;spoken++;onTalk({id:a.id,kind:a.kind,x:a.x,y:a.y+2.5,z:a.z,until:time+2.8,text:npcLine(a.kind,a.id,a.talks-1,reason,story)});}
 function update(player,time,dt){if(disposed)return;active.clear();for(const cell of index.query(player.x-850,player.z-850,player.x+850,player.z+850)){const a=cell.actor,d=Math.hypot(a.x-player.x,a.z-player.z);if(d>850)continue;if(!a.alive){if(time<a.until)continue;a.alive=true;a.hp=a.maxHp;a.x=a.homeX;a.z=a.homeZ;a.close=false;}active.add(a);
   const angle=a.heading,speed=1.1+(a.id%5)*.35,dx=Math.sin(angle)*speed*dt,dz=Math.cos(angle)*speed*dt,x=a.x+dx,z=a.z+dz;
   if(Math.hypot(x-a.homeX,z-a.homeZ)>35&&time>a.avoidUntil){a.heading=Math.atan2(a.homeX-a.x,a.homeZ-a.z);a.avoidUntil=time+2;}
   const y=world.groundAt(x,z);if(!world.isBlocked(x,z,.6,a.y)&&Math.abs(y-a.y)<1.5){a.x=x;a.z=z;a.y=y;a.walked+=Math.hypot(dx,dz);}else if(time>a.avoidUntil){a.heading+=1.4;a.avoidUntil=time+1.8;}
   const nearby=d<9&&Math.abs(player.y-a.y)<5;if(nearby&&!a.close&&time>=a.talkAt)say(a,time,'near');a.close=nearby;
   a.group.position.set(a.x,a.y,a.z);a.group.rotation.y=a.heading;a.group.updateMatrix();for(let j=0;j<a.limbs.length;j++){const p=a.limbs[j];p.rotation.x=Math.sin(time*3.2+a.id+j*Math.PI)*.2;p.updateMatrix();}
  }
  for(const b of batches){let count=0;for(const {actor:a,part:p}of b.list){if(!active.has(a))continue;matrix.multiplyMatrices(a.group.matrix,p.matrix);p.matrixWorld.copy(matrix);b.mesh.setMatrixAt(count++,matrix);}b.mesh.count=count;b.mesh.visible=count>0;b.mesh.instanceMatrix.needsUpdate=true;}root.updateMatrixWorld(true);
 }
 return{update,targets:()=>disposed?[]:[...active].flatMap(a=>a.parts),hit(mesh,time){const a=mesh?.userData?.resident;if(disposed||!a||!active.has(a)||!a.alive||!Number.isFinite(time)||time-a.lastHit<.16)return false;a.lastHit=time;a.hp--;if(a.hp<=0){a.alive=false;active.delete(a);a.until=time+55;defeated++;say(a,time,'down');}else say(a,time,'hit');return true;},snapshot(){return{total:actors.length,visible:active.size,kinds:8,spoken,defeated,renderBatches:batches.length,story:{...story},districts:districts.map(d=>({id:d.id,count:actors.filter(a=>a.district===d.id).length})),actors:[...active].map(a=>({id:a.id,kind:a.kind,district:a.district,x:a.x,y:a.y,z:a.z,hp:a.hp,alive:a.alive,walked:a.walked}))};},dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const b of batches)b.mesh.dispose();for(const g of geometry)g.dispose();for(const m of materials)m.dispose();index.clear();active.clear();}};
}
