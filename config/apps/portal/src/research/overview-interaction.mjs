import * as THREE from 'three';

// Conceptual lattice response. The physical research and its data are untouched.
export function mountOverviewInteraction(canvas,camera,field,lattice,bases,geometries,materials,requestFrame){
 const pointer=new THREE.Vector2(),ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-.3),point=new THREE.Vector3(),local=new THREE.Vector3(),dummy=new THREE.Object3D(),color=new THREE.Color();
 const hover={active:false,x:0,z:0},pulses=[],listeners=[],bright=new THREE.Color(0xccfff0);let strength=0,clicks=0;
 const light=new THREE.PointLight(0x8fffe3,0,4.7);field.add(light);
 const ringGeometry=new THREE.TorusGeometry(1,.012,6,120);geometries.push(ringGeometry);
 const rings=Array.from({length:3},(_,i)=>{const material=new THREE.MeshBasicMaterial({color:i===1?0xb89df0:0xb8ffe6,transparent:true,opacity:0,depthWrite:false});materials.push(material);const ring=new THREE.Mesh(ringGeometry,material);ring.rotation.x=Math.PI/2;ring.visible=false;field.add(ring);return ring;});
 const locate=event=>{const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);ray.setFromCamera(pointer,camera);const hit=ray.intersectObject(lattice,false)[0];
  if(hit){local.copy(hit.point);field.worldToLocal(local);}else if(ray.ray.intersectPlane(plane,point)){local.copy(point);field.worldToLocal(local);}else local.set(0,0,0);
  hover.x=Math.max(-2.2,Math.min(2.2,local.x));hover.z=Math.max(-2.2,Math.min(2.2,local.z));hover.active=true;canvas.dataset.hoverCell=String(hit?.instanceId??-1);requestFrame();
 };
 const listen=(type,fn)=>{canvas.addEventListener(type,fn);listeners.push(()=>canvas.removeEventListener(type,fn));};
 const burst=()=>{if(pulses.length===3)pulses.shift();pulses.push({x:hover.x,z:hover.z,time:performance.now()});canvas.dataset.clickPulses=String(++clicks);requestFrame();};
 listen('pointerenter',locate);listen('pointermove',locate);listen('pointerleave',()=>{hover.active=false;requestFrame();});listen('click',event=>{locate(event);burst();});listen('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();burst();}});
 return {update(stamp,reduced){strength+=(Number(hover.active)-strength)*(reduced?1:.28);light.intensity=strength*9;light.position.set(hover.x,2.1,hover.z);
  const now=pulses.map(p=>({...p,age:Math.max(0,(stamp-p.time)/1000)}));
  for(let i=0;i<3;i++){const ring=rings[i],pulse=now[i];ring.visible=!!pulse&&pulse.age<2;if(ring.visible){const radius=Math.max(.08,pulse.age*2.4);ring.position.set(pulse.x,.7,pulse.z);ring.scale.setScalar(radius);ring.material.opacity=Math.max(0,.7*(1-pulse.age/2));}}
  let response=0;
  bases.forEach((base,i)=>{const distance=Math.hypot(base.x-hover.x,base.z-hover.z),focus=Math.exp(-distance*distance/1.0)*strength;
   let wave=0;for(const p of now)if(p.age<2){const d=Math.hypot(base.x-p.x,base.z-p.z);wave+=Math.exp(-((d-p.age*2.4)**2)/.13)*(1-p.age/2);}
   const amount=Math.min(1,focus*.8+wave);response=Math.max(response,amount);
   dummy.position.set(base.x,base.y+focus*.24+wave*.35,base.z);dummy.rotation.set(0,base.rotation,0);dummy.scale.set(1,base.scale*(1+amount*.65),1);dummy.updateMatrix();lattice.setMatrixAt(i,dummy.matrix);
   color.copy(base.color).lerp(bright,amount*.8);lattice.setColorAt(i,color);
  });lattice.instanceMatrix.needsUpdate=true;lattice.instanceColor.needsUpdate=true;canvas.dataset.hoverStrength=strength.toFixed(3);canvas.dataset.latticeResponse=response.toFixed(3);canvas.dataset.viewYaw='-0.26';
 },dispose(){listeners.forEach(fn=>fn());}};
}
