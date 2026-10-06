import * as THREE from 'three';
const cap=(v,a,b)=>Math.max(a,Math.min(b,v));
export function segmentDistance(p,a,b){const x=b.x-a.x,y=b.y-a.y,z=b.z-a.z,n=x*x+y*y+z*z,t=n?cap(((p.x-a.x)*x+(p.y-a.y)*y+(p.z-a.z)*z)/n,0,1):0;return Math.hypot(p.x-a.x-x*t,p.y-a.y-y*t,p.z-a.z-z*t);}
export function createGiantCombat(root,shapes,material,world){
 const make=shape=>{const mesh=new THREE.Mesh(shapes[shape],material);mesh.visible=false;root.add(mesh);return mesh;};
 const shots=Array.from({length:48},()=>({mesh:make('sphere'),life:0}));
 const fields=Array.from({length:24},()=>({mesh:make('ring'),life:0}));
 const beams=Array.from({length:8},()=>({mesh:make('leg'),life:0}));
 const start=new THREE.Vector3(),end=new THREE.Vector3(),direction=new THREE.Vector3(),chest=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),axis=new THREE.Vector3(0,1,0);
 const stats={attacks:0,attacksByType:{},projectilePeak:0,damageEvents:0};
 const clearOwner=a=>{for(const pool of [shots,fields,beams])for(const e of pool)if(e.owner===a){e.life=0;e.mesh.visible=false;}a.charge=null;a.pending=0;a.warning.visible=false;};
 function field(a,type,x,z){const e=fields.find(e=>e.life<=0);if(!e)return;Object.assign(e,{owner:a,type,x,z,y:world.groundAt(x,z)+.25,life:type==='stomp'?2.6:9,age:0,cooldown:0,hit:false});e.mesh.rotation.set(-Math.PI/2,0,0);e.mesh.position.set(x,e.y,z);e.mesh.visible=true;}
 function launch(a,p,spread,homing){const s=shots.find(e=>e.life<=0);if(!s)return;start.set(a.x,a.y-a.role.height*.3,a.z);direction.set(p.x-start.x,p.y+1.3-start.y,p.z-start.z).normalize().applyAxisAngle(axis,spread);Object.assign(s,{owner:a,life:9,x:start.x,y:start.y,z:start.z,vx:direction.x*78,vy:direction.y*78,vz:direction.z*78,homing});s.mesh.scale.setScalar(1.7);s.mesh.position.copy(start);s.mesh.visible=true;}
 function fire(a,p,time){const type=a.role.attack;stats.attacks++;stats.attacksByType[type]=(stats.attacksByType[type]||0)+1;
  if(type==='stomp')field(a,'stomp',a.x,a.z);
  if(type==='salvo')for(const spread of [-.2,-.1,0,.1,.2])launch(a,p,spread,true);
  if(type==='mines')for(let j=0;j<3;j++)field(a,'mine',a.warning.position.x+Math.cos(j*2.094+a.phase)*24,a.warning.position.z+Math.sin(j*2.094+a.phase)*24);
  if(type==='well')field(a,'well',a.warning.position.x,a.warning.position.z);
  if(type==='charge')a.charge={until:time+2.8,angle:Math.atan2(a.warning.position.x-a.x,a.warning.position.z-a.z),hit:false};
  if(type==='beam'){const e=beams.find(e=>e.life<=0);if(e)Object.assign(e,{owner:a,life:2.6,age:0,x:a.warning.position.x,z:a.warning.position.z,cooldown:0});}
 }
 function prepare(a,p,time,dt,engaged){a.cooldown=Math.max(0,a.cooldown-dt);if(!engaged){if(a.pending||a.charge)clearOwner(a);return;}if(!a.pending&&!a.charge&&a.cooldown<=0){a.pending=time+(a.role.attack==='charge'?1.3:1.7);a.warning.position.set(p.x,world.groundAt(p.x,p.z)+.2,p.z);a.warning.visible=true;}
  if(a.pending){const size=a.role.attack==='charge'?12:a.role.attack==='well'?28:20;a.warning.scale.setScalar(size*(.88+.12*Math.sin(time*9)));if(time>=a.pending){fire(a,p,time);a.pending=0;a.warning.visible=false;a.cooldown=a.role.attack==='salvo'?5:7;}}
 }
 function update(p,time,dt,protectedPlayer,onDamage){const damage=v=>{onDamage(v);stats.damageEvents++;};let active=0;chest.set(p.x,p.y+1.3,p.z);
  for(const s of shots){if(s.life<=0)continue;if(!s.owner.alive||protectedPlayer){s.life=0;s.mesh.visible=false;continue;}if(s.homing){direction.set(p.x-s.x,p.y+1.3-s.y,p.z-s.z).normalize().multiplyScalar(78);const t=1-Math.exp(-dt*.42);s.vx+=(direction.x-s.vx)*t;s.vy+=(direction.y-s.vy)*t;s.vz+=(direction.z-s.vz)*t;}
   start.set(s.x,s.y,s.z);end.set(s.x+s.vx*dt,s.y+s.vy*dt,s.z+s.vz*dt);direction.copy(end).sub(start);const length=direction.length();if(length)direction.divideScalar(length);s.life-=dt;
   if(world.obstructRay(start,direction,length)<length-.05||end.y<world.groundAt(end.x,end.z)+.1){s.life=0;}else if(segmentDistance(chest,start,end)<2){damage(.075);s.life=0;}
   s.x=end.x;s.y=end.y;s.z=end.z;s.mesh.position.copy(end);s.mesh.visible=s.life>0;if(s.life>0)active++;
  }stats.projectilePeak=Math.max(stats.projectilePeak,active);
  for(const e of fields){if(e.life<=0)continue;e.life-=dt;e.age+=dt;e.cooldown-=dt;if(!e.owner.alive||protectedPlayer)e.life=0;const d=Math.hypot(p.x-e.x,p.z-e.z),nearFloor=Math.abs(p.y-e.y)<2;
   const radius=e.type==='stomp'?e.age*65:e.type==='well'?28:18;e.mesh.scale.setScalar(Math.max(.1,radius));e.mesh.visible=e.life>0&&(e.type!=='mine'||e.age<1.6||Math.floor(time*8)%2===0);
   if(e.life<=0)continue;
   if(e.type==='stomp'&&!e.hit&&nearFloor&&Math.abs(d-radius)<3+65*dt){damage(.16);e.hit=true;}
   if(e.type==='mine'&&e.age>=1.6&&d<18&&Math.abs(p.y-e.y)<6&&e.cooldown<=0){damage(.065);e.cooldown=.8;}
   if(e.type==='well'&&e.age>=.5&&d<28&&nearFloor){if(d>2){const move=Math.min(d-2,dt*10),x=p.x+(e.x-p.x)/d*move,z=p.z+(e.z-p.z)/d*move,y=world.groundAt(x,z);if(!world.isBlocked(x,z,.65,p.y)&&Math.abs(y-p.y)<1.8){p.x=x;p.z=z;}}if(e.cooldown<=0){damage(.045);e.cooldown=.9;}}
  }
  for(const e of beams){if(e.life<=0)continue;e.life-=dt;e.age+=dt;e.cooldown-=dt;if(!e.owner.alive||protectedPlayer)e.life=0;start.set(e.owner.x,e.owner.y,e.owner.z);end.set(e.x+Math.sin(e.age*1.8)*22,world.groundAt(e.x,e.z)+.7,e.z+Math.cos(e.age*1.8)*22);direction.copy(end).sub(start);const length=direction.length();direction.normalize();const visibleLength=world.obstructRay(start,direction,length);end.copy(start).addScaledVector(direction,visibleLength);e.mesh.position.copy(start).add(end).multiplyScalar(.5);e.mesh.quaternion.setFromUnitVectors(up,direction);e.mesh.scale.set(1.2,visibleLength,1.2);e.mesh.visible=e.life>0;if(e.life>0&&e.cooldown<=0&&segmentDistance(chest,start,end)<2.8){damage(.075);e.cooldown=.45;}}
 }
 function charge(a,motion,p,time,onDamage){if(!a.charge)return;if(time>=a.charge.until){a.charge=null;return;}start.set(motion.oldX,p.y+1.3,motion.oldZ);end.set(a.x,p.y+1.3,a.z);chest.set(p.x,p.y+1.3,p.z);if(!a.charge.hit&&Math.abs(p.y-a.floor)<8&&segmentDistance(chest,start,end)<30*a.scale){a.charge.hit=true;onDamage(.23);stats.damageEvents++;}}
 return{prepare,update,charge,clearOwner,snapshot(){return{...stats,attacksByType:{...stats.attacksByType},projectileCap:48,fieldCap:24,beamCap:8,projectiles:shots.filter(e=>e.life>0).length,fields:fields.filter(e=>e.life>0).length,beams:beams.filter(e=>e.life>0).length};}};
}
