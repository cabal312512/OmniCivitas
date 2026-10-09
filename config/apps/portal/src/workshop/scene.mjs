import * as THREE from 'three';
let canvas,renderer,scene,camera,root,observer,cleanup,angle=.65,lift=.52;
const blue=new THREE.Color('#397bdd');
function clear(){if(!root)return;for(const mesh of [...root.children]){root.remove(mesh);mesh.geometry?.dispose();if(mesh.material)for(const m of(Array.isArray(mesh.material)?mesh.material:[mesh.material]))m.dispose()}}
function paint(){if(!renderer||!canvas?.isConnected)return;root.rotation.set(lift,angle,0);const w=Math.max(200,canvas.clientWidth),h=Math.max(130,canvas.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera)}
function start(target){
 canvas=target;renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;scene=new THREE.Scene();scene.background=new THREE.Color('#f5faff');camera=new THREE.PerspectiveCamera(32,1,.1,250);camera.position.set(0,3.5,23);camera.lookAt(0,2,0);root=new THREE.Group();scene.add(root);scene.add(new THREE.HemisphereLight('#e3f0ff','#93aacc',3));const lamp=new THREE.DirectionalLight('#ffffff',3.5);lamp.position.set(4,12,10);scene.add(lamp);
 const life=new AbortController();let drag;
 canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,angle,lift};canvas.setPointerCapture(e.pointerId)},{signal:life.signal});canvas.addEventListener('pointermove',e=>{if(!drag)return;angle=drag.angle+(e.clientX-drag.x)*.009;lift=Math.max(-1,Math.min(1.2,drag.lift+(e.clientY-drag.y)*.006));paint()},{signal:life.signal});for(const event of['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>drag=undefined,{signal:life.signal});canvas.addEventListener('dblclick',()=>{angle=.65;lift=.52;paint()},{signal:life.signal});observer=new ResizeObserver(paint);observer.observe(canvas);cleanup=()=>life.abort();
}
export function appearance(project,settings,target){
 if(!target)return;if(target!==canvas){disposeAppearance();try{start(target)}catch{target.dataset.unavailable='true';return}}clear();scene.background.set(settings.background==='sky'?'#daeaff':'#f5faff');const bodies=project?.world?.bodies||[],depth=Math.max(.05,Math.min(5,Number(settings.depth)||.35));
 for(const part of bodies.slice(0,64)){
  const round=['ball','wheel','gear','pulley'].includes(part.kind),radius=Math.max(.02,part.radius||.35);let geometry;
  if(part.kind==='ball')geometry=new THREE.SphereGeometry(radius,24,16);else if(round){geometry=new THREE.CylinderGeometry(radius,radius,depth,part.kind==='gear'?16:32);geometry.rotateX(Math.PI/2)}else geometry=new THREE.BoxGeometry(Math.max(.02,part.width||1),Math.max(.02,part.height||.3),depth);
  const glass=settings.material==='glass',material=new THREE.MeshPhysicalMaterial({color:new THREE.Color(/^#[\da-f]{6}$/i.test(part.colour)?part.colour:blue),metalness:settings.material==='alloy'?.65:0,roughness:glass?.08:.25,transmission:glass?.8:0,thickness:glass?depth:0,ior:1.45,transparent:true,opacity:part.mode==='fixed'?.72:1,wireframe:!!settings.wireframe});const mesh=new THREE.Mesh(geometry,material);mesh.position.set(part.x,part.y-2.5,(part.layer||0)*.045);mesh.rotation.z=part.angle||0;root.add(mesh);
  if(round&&part.kind!=='ball'){const rim=new THREE.Mesh(new THREE.TorusGeometry(radius*.8,.022,8,48),new THREE.MeshBasicMaterial({color:'#bcdcff'}));rim.position.copy(mesh.position);rim.position.z+=depth*.51;root.add(rim)}
 }
 if(bodies.length){const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());camera.position.set(center.x,center.y+2,Math.max(14,Math.max(size.x,size.y)*2.1));camera.lookAt(center)}paint();
}
export function disposeAppearance(){cleanup?.();observer?.disconnect();clear();renderer?.dispose();renderer?.forceContextLoss();renderer=canvas=root=undefined;observer=cleanup=undefined}
