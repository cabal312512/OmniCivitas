import * as THREE from 'three';
import {TURBINES,ANOMALIES,GROVES} from '../../../../../pinia/laf84ejfa.mjs';
import {riverShapeAt} from '../../../../../pinia/j7.mjs';

export function createField(scene,world){
 const root=new THREE.Group();root.name='wind-survey';scene.add(root);
 const geometries=new Set(),materials=new Set(),batches=[],rotors=[],obstacles=[],objects=[];
 const geo=g=>(geometries.add(g),g),mat=m=>(materials.add(m),m);
 const white=mat(new THREE.MeshStandardMaterial({color:0xf4f8fb,metalness:.32,roughness:.23}));
 const silver=mat(new THREE.MeshStandardMaterial({color:0xc3d8e2,metalness:.65,roughness:.17}));
 const glass=mat(new THREE.MeshPhysicalMaterial({color:0x9eddf5,metalness:.18,roughness:.12,clearcoat:1,transmission:.18,thickness:6}));
 const pearl=mat(new THREE.MeshPhysicalMaterial({color:0xdceae8,metalness:.42,roughness:.19,clearcoat:1}));
 const light=mat(new THREE.MeshBasicMaterial({color:0xc0ffe9}));
 const box=geo(new THREE.BoxGeometry(1,1,1)),cylinder=geo(new THREE.CylinderGeometry(.65,1,1,12)),sphere=geo(new THREE.SphereGeometry(1,24,16)),torus=geo(new THREE.TorusGeometry(1,.075,8,64));
 const shape=new THREE.Shape();shape.moveTo(-.02,0);shape.lineTo(.058,.16);shape.bezierCurveTo(.068,.44,.014,.87,.003,1);shape.lineTo(-.009,1);shape.bezierCurveTo(-.018,.76,-.051,.35,-.02,0);
 const blade=geo(new THREE.ExtrudeGeometry(shape,{depth:.012,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.003,bevelThickness:.002,curveSegments:10}));
 const temp=new THREE.Object3D(),scratch=new THREE.Matrix4();
 const turbines=TURBINES.filter(s=>riverShapeAt(s.x,s.z).mask<.25&&!world.isBlocked(s.x,s.z,12));
 function batch(g,m,n){const mesh=new THREE.InstancedMesh(g,m,n);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);batches.push(mesh);return mesh;}
 const stems=batch(cylinder,white,turbines.length),bases=batch(cylinder,silver,turbines.length),nacelles=batch(box,white,turbines.length),hubs=batch(sphere,silver,turbines.length),blades=batch(blade,white,turbines.length*3);
 blades.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 const set=(mesh,index,x,y,z,sx,sy,sz,ry=0)=>{temp.position.set(x,y,z);temp.rotation.set(0,ry,0);temp.scale.set(sx,sy,sz);temp.updateMatrix();mesh.setMatrixAt(index,temp.matrix);};
 turbines.forEach((s,i)=>{const y=world.groundAt(s.x,s.z);set(stems,i,s.x,y+s.height/2,s.z,6,s.height,6);set(bases,i,s.x,y+1,s.z,13,2,13);set(nacelles,i,s.x,y+s.height,s.z,12,8,22);set(hubs,i,s.x,y+s.height,s.z+13,5,5,5);rotors.push({...s,y:y+s.height,z:s.z+15,index:i,angle:s.phase});obstacles.push({x:s.x,z:s.z,r:6,minY:y,maxY:y+s.height});});
 for(const s of ANOMALIES){if(riverShapeAt(s.x,s.z).mask>.45)continue;const g=new THREE.Group(),y=world.groundAt(s.x,s.z)+s.altitude;g.position.set(s.x,y,s.z);root.add(g);objects.push({id:s.id,kind:s.kind,x:s.x,y,z:s.z,scale:s.scale});const size=s.scale;
  const part=(geometry,material,x,y,z,sx,sy,sz)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=material!==glass;mesh.receiveShadow=true;g.add(mesh);return mesh;};
  if(s.kind===0){for(let j=0;j<7;j++){const ring=part(torus,j%2?white:glass,0,size*.45+j*size*.12,0,size*(.7-j*.05),size*(.7-j*.05),size*.7);ring.rotation.x=Math.PI/2+j*.07;}}
  else if(s.kind===1){part(box,silver,0,size*.6,0,size*.8,size*1.2,size*.09);part(box,glass,0,size*.6,8,size*.63,size,size*.025);}
  else if(s.kind===2){for(let j=0;j<9;j++){const a=j*Math.PI*2/9;const arch=part(box,pearl,Math.cos(a)*size*.55,size*.9,Math.sin(a)*size*.55,size*.1,size*1.8,size*.1);arch.rotation.y=a;}part(torus,white,0,size*1.8,0,size*.55,size*.55,size*.55).rotation.x=Math.PI/2;}
  else if(s.kind===3){part(sphere,glass,0,size*.25,0,size,size*.25,size);for(let j=0;j<12;j++)part(box,white,Math.cos(j*Math.PI/6)*size*.7,0,Math.sin(j*Math.PI/6)*size*.7,size*.05,size*.45,size*.05);}
  else if(s.kind===4){for(let j=0;j<13;j++){const m=part(box,j%3?white:light,(j-6)*size*.11,j*size*.04,0,size*.105,size*.03,size*.55);m.rotation.z=j*.035;}}
  else if(s.kind===5){part(cylinder,pearl,0,size*.3,0,size*.5,size*.6,size*.5);part(sphere,silver,0,size*.95,0,size*.48,size*.48,size*.48);part(torus,glass,0,size*.95,0,size*.75,size*.75,size*.75).rotation.x=.6;}
  else if(s.kind===6){for(let j=0;j<5;j++){const m=part(box,glass,0,size*.5,0,size*.75,size*(1.5-j*.15),size*.07);m.rotation.y=j*Math.PI/5;}}
  else if(s.kind===7){const t=part(torus,pearl,0,size*.65,0,size*.7,size*.7,size*.7);t.rotation.y=.4;part(box,white,0,size*.65,0,size*.06,size*1.6,size*.06);}
  else{for(let j=0;j<6;j++){const a=j*Math.PI/3;part(sphere,j%2?glass:silver,Math.cos(a)*size*.5,size*.4,Math.sin(a)*size*.5,size*.17,size*.4,size*.17);}}
  if(s.altitude<=0)obstacles.push({x:s.x,z:s.z,r:size*.32,minY:y,maxY:y+size*.45});
 }
 const staticBatches=new Map();root.updateMatrixWorld(true);for(const group of [...root.children])if(group.isGroup){for(const m of group.children){const key=m.geometry.uuid+':'+m.material.uuid+':'+m.castShadow;let list=staticBatches.get(key);if(!list){list=[];staticBatches.set(key,list);}list.push(m);}group.removeFromParent();}
 for(const list of staticBatches.values()){const m=list[0],inst=batch(m.geometry,m.material,list.length);inst.castShadow=m.castShadow;list.forEach((source,i)=>inst.setMatrixAt(i,source.matrixWorld));inst.matrixAutoUpdate=false;}
 const obstacleGrid=new Map(),cell=256;for(const o of obstacles)for(let x=Math.floor((o.x-o.r)/cell);x<=Math.floor((o.x+o.r)/cell);x++)for(let z=Math.floor((o.z-o.r)/cell);z<=Math.floor((o.z+o.r)/cell);z++){const key=x+':'+z,list=obstacleGrid.get(key)||[];list.push(o);obstacleGrid.set(key,list);}
 let disposed=false;
 function update(time){if(disposed)return;for(const s of rotors){s.angle=time*s.speed+s.phase;for(let k=0;k<3;k++){const a=s.angle+k*Math.PI*2/3,c=Math.cos(a)*s.blade,n=Math.sin(a)*s.blade;scratch.set(c,-n,0,s.x,n,c,0,s.y,0,0,s.blade,s.z,0,0,0,1);blades.setMatrixAt(s.index*3+k,scratch);}}blades.instanceMatrix.needsUpdate=true;}
 update(0);root.updateMatrixWorld(true);
 return{update,nearby(player){return{wind:rotors.some(s=>Math.hypot(player.x-s.x,player.z-s.z)<90&&Math.abs(player.y-(s.y-s.height))<30),grove:GROVES.some(s=>Math.hypot(player.x-s.x,player.z-s.z)<s.radius),objects:objects.filter(s=>Math.hypot(player.x-s.x,player.z-s.z)<s.scale+180).map(s=>s.id)};},
  isBlocked(x,z,r=.4,y=world.groundAt(x,z)){for(let cx=Math.floor((x-r)/cell);cx<=Math.floor((x+r)/cell);cx++)for(let cz=Math.floor((z-r)/cell);cz<=Math.floor((z+r)/cell);cz++)for(const o of obstacleGrid.get(cx+':'+cz)||[])if(y<o.maxY&&y+2.2>o.minY&&Math.hypot(x-o.x,z-o.z)<o.r+r)return true;return false;},
  obstructRay(origin,direction,distance){let nearest=distance;for(const o of obstacles){const dx=origin.x-o.x,dz=origin.z-o.z,a=direction.x**2+direction.z**2,b=dx*direction.x+dz*direction.z,c=dx*dx+dz*dz-o.r**2,disc=b*b-a*c;if(a<1e-10||disc<0)continue;const t=(-b-Math.sqrt(disc))/a;if(t<0||t>=nearest)continue;const y=origin.y+direction.y*t;if(y>=o.minY&&y<=o.maxY)nearest=t;}return nearest;},
  snapshot(){return{disposed,turbines:rotors.length,anomalies:objects.length,groves:GROVES.length,bladeCount:rotors.length*3,renderBatches:batches.length,staticParts:[...staticBatches.values()].reduce((n,a)=>n+a.length,0),rotors:rotors.slice(0,4).map(s=>({x:s.x,y:s.y,z:s.z,angle:s.angle})),objects:objects.map(s=>({...s})),geometryCount:geometries.size};},
  dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const b of batches)b.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();root.clear();}
 };
}
