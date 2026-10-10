import * as THREE from 'three';

const cabal312512=Object.freeze({fps:32,dpr:1.5,particles:32,collection:.46});
const forms=new Set(['shard','ring','lattice','rift','orbit','prism']);
const durations=Object.freeze({pulse:1.1,shear:1.25,phase:1.6,resonate:1.4});
const stages=new WeakMap(),diagnosticWindows=new WeakMap();
const clamp=(value,low=0,high=1)=>Math.max(low,Math.min(high,value));
const ease=(current,target,dt,speed=12)=>Math.abs(current-target)<.0005?target:current+(target-current)*(1-Math.exp(-dt*speed));

export function createHiddenCreatureScene(root){
 if(!root)return null;if(stages.has(root))return stages.get(root);
 const canvas=root.querySelector('[data-q8-hidden-canvas]');if(!canvas)return null;
 const doc=root.ownerDocument,win=doc.defaultView,form=forms.has(root.dataset.q8Form)?root.dataset.q8Form:'shard';
 const life=new AbortController(),reduced=win.matchMedia('(prefers-reduced-motion: reduce)'),geometries=new Set(),materials=new Set(),instances=new Set();
 const scene=new THREE.Scene(),model=new THREE.Group();scene.add(model);
 const camera=new THREE.PerspectiveCamera(35,1,.1,20);camera.position.set(0,.08,6.6);camera.lookAt(0,0,0);
 const pieces=[],grid=[],bands=[],errors=[],powers={pulse:0,shear:0,phase:0,resonate:0};
 const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),direction=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
 let renderer=null,particleMaterial=null,particlePositions=null,particleAttribute=null,gridMesh=null,raf=0,lastFrame=0,time=0,drift=0,frames=0,width=0,height=0,visible=true,pagePaused=false,disposed=false,lost=false,mode='pending',shaderFailed=false;
 let hovered=root.matches?.(':hover')||false,focused=doc.activeElement===root,hoverPower=0,action=root.dataset.q8Action||'idle',effect='idle',actionStarted=0,interactionPower=0,collecting=false,collectionStarted=0,collectionProgress=0,gazeX=0,gazeY=0,builtMeshes=0;
 const geo=value=>(geometries.add(value),value),mat=value=>(materials.add(value),value);
 const on=(target,event,handler,options={})=>target?.addEventListener(event,handler,{...options,signal:life.signal});
 const value=(name,fallback=0)=>{const number=Number.parseFloat(root.style.getPropertyValue(name));return Number.isFinite(number)?number:fallback;};
 const recordError=error=>{const text=String(error?.message||error).slice(0,400);if(errors.at(-1)!==text){if(errors.length===3)errors.shift();errors.push(text);}};
 function canDraw(){
  if(disposed||lost||pagePaused||doc.visibilityState==='hidden'||!visible||root.hidden||root.closest('[hidden]')||doc.body?.dataset.cover==='true'||root.dataset.q8Awake!=='true'&&!collecting)return false;
  const style=win.getComputedStyle(root);if(style.display==='none'||style.visibility==='hidden'||!root.getClientRects().length)return false;
  const rect=root.getBoundingClientRect();return rect.width>0&&rect.height>0&&rect.bottom>0&&rect.top<win.innerHeight&&rect.right>0&&rect.left<win.innerWidth;
 }
 function beginAction(name){if(!durations[name]||collecting||reduced.matches)return;effect=name;actionStarted=time;}
 function beginCollection(){if(collecting)return;collecting=true;collectionStarted=time;collectionProgress=0;effect='idle';}
 function add(geometry,surface,x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1,spin=0){
  const mesh=new THREE.Mesh(geometry,surface);mesh.position.set(x,y,z);mesh.rotation.set(rx,ry,rz);mesh.scale.set(sx,sy,sz);model.add(mesh);
  pieces.push({mesh,base:new THREE.Vector3(x,y,z),tilt:new THREE.Vector3(rx,ry,rz),size:new THREE.Vector3(sx,sy,sz),spin,phase:pieces.length*2.39996});builtMeshes++;return mesh;
 }
 function build(){
  const metal=mat(new THREE.MeshStandardMaterial({color:0xe5f5ff,metalness:.58,roughness:.23,emissive:0x124b65,emissiveIntensity:.12,transparent:true}));
  const blue=mat(new THREE.MeshStandardMaterial({color:0x6fc1e7,metalness:.65,roughness:.27,emissive:0x145a82,emissiveIntensity:.2,transparent:true}));
  const glow=mat(new THREE.MeshBasicMaterial({color:0x7cefe8,transparent:true,opacity:.85,depthWrite:false}));
  scene.add(new THREE.HemisphereLight(0xeeffff,0x2d5780,2.1));
  const key=new THREE.DirectionalLight(0xffffff,3.1);key.position.set(-3,4,5);scene.add(key);
  const fill=new THREE.DirectionalLight(0x73ddff,1.9);fill.position.set(4,-2,2);scene.add(fill);
  const box=geo(new THREE.BoxGeometry(1,1,1)),crystal=geo(new THREE.OctahedronGeometry(1,0));
  if(form==='shard'){
   add(crystal,metal,0,0,0,.18,.45,-.25,.59,1.18,.48,.18);
   for(let i=0;i<7;i++){const a=i*2.39996,r=.77+(i%3)*.15;add(crystal,i%2?blue:metal,Math.cos(a)*r,Math.sin(a)*r*.84,Math.sin(i*1.7)*.38,i*.7,a,i*.4,.15+(i%2)*.07,.32,.12,(i%2?1:-1)*.23);}
  }else if(form==='ring'){
   const torus=geo(new THREE.TorusGeometry(.94,.065,6,40)),fine=geo(new THREE.TorusGeometry(1.015,.012,5,40));
   for(let i=0;i<3;i++){const x=[.25,1.1,-.65][i],y=[.7,-.3,.9][i],z=i*.65;add(torus,i===1?blue:metal,0,0,0,x,y,z,1,1,1,(i%2?-1:1)*.25);add(fine,glow,0,0,.025,x,y,z,1,1,1,(i%2?-1:1)*.25);}
   for(let i=0;i<6;i++){const a=i*Math.PI/3;add(box,blue,Math.cos(a)*1.05,Math.sin(a)*1.05,Math.sin(a*2)*.25,.2,a,a,.19,.12,.16,.16);}
  }else if(form==='lattice'){
   const cube=geo(new THREE.BoxGeometry(.17,.17,.17));gridMesh=new THREE.InstancedMesh(cube,metal,27);gridMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);instances.add(gridMesh);model.add(gridMesh);builtMeshes++;
   for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)grid.push({x:x*.57,y:y*.57,z:z*.57,phase:grid.length*2.39996});
   for(let i=0;i<3;i++){const dimensions=[.025,.025,.025];dimensions[i]=1.55;add(box,glow,0,0,0,0,0,0,...dimensions);}
   for(let i=0;i<8;i++){const x=i&1?.74:-.74,y=i&2?.74:-.74,z=i&4?.74:-.74;add(box,blue,x,y,z,.15,.15,.15,.13,.13,.13,.08);}
  }else if(form==='rift'){
   for(let side=-1;side<=1;side+=2)for(let i=0;i<3;i++)add(box,i===1?metal:blue,side*(.49+i*.075),(i-1)*.49,side*.16+(i-1)*.11,.06,side*.28,side*(i-1)*.07,.27,.42,.19,.045*side);
   for(let i=0;i<4;i++){const side=i%2?1:-1;add(box,metal,side*.25,i<2?.84:-.84,side*.10,.12,side*.18,side*.09,.52,.13,.28,.04);}
   add(box,glow,-.06,0,.05,0,.32,.07,.035,1.35,.035);add(box,glow,.10,0,-.12,0,-.38,-.08,.025,1.04,.025);
  }else if(form==='orbit'){
   add(geo(new THREE.IcosahedronGeometry(.48,1)),metal,0,0,0,.25,.25,0,1,1,1,.2);
   const orbit=geo(new THREE.TorusGeometry(1.12,.027,5,44));
   for(let i=0;i<3;i++)add(orbit,i===1?blue:glow,0,0,0,.2+i*.65,-.35+i*.36,i*.7,1,.67,1,(i%2?-1:1)*.12);
   for(let i=0;i<6;i++){const a=i*Math.PI/3;add(crystal,i%2?metal:blue,Math.cos(a)*1.2,Math.sin(a)*.86,Math.sin(a*1.7)*.51,a,i*.7,.3,.115,.115,.115,(i%2?-1:1)*.35);}
  }else{
   const prism=geo(new THREE.CylinderGeometry(.62,.62,1.25,3,1,false));
   add(prism,metal,0,0,0,.35,.4,-.27,1,1,1,.16);
   for(let i=0;i<2;i++)add(prism,blue,(i?1:-1)*.66,(i?1:-1)*.43,(i?1:-1)*.30,-.3,i*.85,.3,.38,.53,.38,(i?1:-1)*.18);
   for(let i=0;i<3;i++){const a=i*Math.PI*2/3;add(box,glow,Math.cos(a)*.73,0,Math.sin(a)*.73,.35,.4,-.27,.025,1.42,.025);}
  }
  const arcGeometry=geo(new THREE.TorusGeometry(.86,.018,5,44,Math.PI*1.7));
  for(let i=0;i<2;i++){const surface=mat(new THREE.MeshBasicMaterial({color:i?0xb5dfff:0x7af4e8,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})),mesh=new THREE.Mesh(arcGeometry,surface);mesh.rotation.set(i*.85,.25+i*.5,i*2.0);mesh.visible=false;model.add(mesh);bands.push({mesh,surface,angle:i*2,scale:1});builtMeshes++;}
  particlePositions=new Float32Array(cabal312512.particles*3);particleAttribute=new THREE.BufferAttribute(particlePositions,3);particleAttribute.setUsage(THREE.DynamicDrawUsage);
  const particleGeometry=geo(new THREE.BufferGeometry());particleGeometry.setAttribute('position',particleAttribute);
  particleMaterial=mat(new THREE.PointsMaterial({color:0x75d9ef,size:1.6,transparent:true,opacity:.45,depthWrite:false,sizeAttenuation:false}));model.add(new THREE.Points(particleGeometry,particleMaterial));
 }
 function resize(){
  if(!renderer)return;const rect=root.getBoundingClientRect(),w=Math.round(rect.width),h=Math.round(rect.height);if(!w||!h||w===width&&h===height)return;
  width=w;height=h;renderer.setPixelRatio(Math.min(win.devicePixelRatio||1,cabal312512.dpr));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
 }
 function init(){
  if(renderer||mode==='fallback'||!canDraw())return;
  try{
   renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
   renderer.debug.onShaderError=(gl,program)=>{shaderFailed=true;const message=`Hidden creature shader linking failed: ${gl.getProgramInfoLog(program)||'unknown error'}`.slice(0,400);recordError(message);throw new Error(message);};
   renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;build();resize();renderer.compile(scene,camera);
   if(shaderFailed){fallback();return;}mode='ready';root.dataset.q8HiddenScene='ready';canvas.dataset.sceneReady='true';
  }catch(error){recordError(error);fallback();}
 }
 function release(){
  for(const instance of instances)instance.dispose();instances.clear();for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();geometries.clear();materials.clear();scene.clear();model.clear();pieces.length=0;grid.length=0;bands.length=0;gridMesh=null;particlePositions=null;particleAttribute=null;particleMaterial=null;renderer?.dispose();renderer?.forceContextLoss();renderer=null;
 }
 function fallback(){if(disposed||mode==='fallback')return;stop();mode='fallback';root.dataset.q8HiddenScene='fallback';canvas.dataset.sceneReady='false';release();}
 function draw(dt){
  if(!renderer||mode!=='ready'||!canDraw())return;resize();const minimal=reduced.matches,step=Math.max(dt,1/cabal312512.fps);if(!minimal){time+=dt;drift+=dt;}
  const nextAction=root.dataset.q8Action||'idle';if(nextAction!==action){action=nextAction;beginAction(action);}if(root.dataset.q8Collecting==='true')beginCollection();
  if(minimal)effect='idle';const progress=durations[effect]?clamp((time-actionStarted)/durations[effect]):1;
  const wave=progress===1?0:effect==='resonate'?Math.pow(Math.sin(progress*Math.PI*2),2):Math.pow(Math.sin(progress*Math.PI),.8),target=minimal||collecting?0:wave;
  hoverPower=minimal||collecting?0:ease(hoverPower,hovered||focused?1:0,step,9);interactionPower=minimal?0:ease(interactionPower,target,step,15);
  for(const name of Object.keys(powers))powers[name]=minimal?0:ease(powers[name],effect===name?target:0,step,15);
  collectionProgress=collecting?(minimal?1:clamp((time-collectionStarted)/cabal312512.collection)):0;
  const {pulse,shear,phase,resonate}=powers,dissolve=collectionProgress*collectionProgress,burst=collecting?Math.sin(collectionProgress*Math.PI):interactionPower,energy=clamp(interactionPower*.7+hoverPower*.22+value('--speech-energy')*.45+burst*.65),opacity=collecting?1-Math.pow(collectionProgress,.8):1-phase*.42;
  gazeX=minimal||collecting?0:ease(gazeX,clamp(value('--field-x')/8,-1,1)*.30,step,8);gazeY=minimal||collecting?0:ease(gazeY,clamp(value('--field-y')/6,-1,1)*.24,step,8);
  model.rotation.set(minimal?0:Math.sin(drift*.31)*.12+gazeY,minimal?0:drift*.21+gazeX,minimal?0:Math.sin(drift*.23)*.08);model.scale.setScalar(1+pulse*.11+hoverPower*.035);
  for(const [i,item]of pieces.entries()){
   const radial=1+shear*.35+hoverPower*.05+dissolve*.8,extra=dissolve*.82,scan=Math.sin(drift*16+i)*phase*.04;
   item.mesh.position.set(item.base.x*radial+Math.cos(item.phase)*extra+scan,item.base.y*radial+Math.sin(item.phase)*extra,item.base.z*radial+(i%2?1:-1)*(shear*.18+dissolve*.62));
   item.mesh.rotation.set(item.tilt.x+Math.sin(item.phase)*shear*.35+dissolve*.8,item.tilt.y+Math.cos(item.phase)*hoverPower*.12+dissolve*.55,item.tilt.z+drift*item.spin+resonate*Math.sin(item.phase)*.18+dissolve*(i%2?1:-1));
   item.mesh.scale.copy(item.size).multiplyScalar(1+pulse*.10+hoverPower*.04-dissolve*.94);
  }
  if(gridMesh){
   const radial=1+shear*.48+hoverPower*.07+dissolve*.95;
   for(const [i,item]of grid.entries()){position.set(item.x*radial+Math.cos(item.phase)*dissolve*.45,item.y*radial+Math.sin(item.phase)*dissolve*.45,item.z*radial+(i%2?1:-1)*dissolve*.36);direction.copy(position);if(direction.lengthSq()>0)direction.normalize();else direction.set(0,1,0);rotation.setFromAxisAngle(direction,shear*.22+dissolve*.7);scale.setScalar(1+pulse*.22-dissolve*.94);matrix.compose(position,rotation,scale);gridMesh.setMatrixAt(i,matrix);}gridMesh.instanceMatrix.needsUpdate=true;
  }
  for(const material of materials)if(material.isMeshStandardMaterial)material.opacity=opacity;
  for(const [i,band]of bands.entries()){
   if(!minimal)band.angle+=dt*(i?-.6:.75)*(1+resonate);
   const targetScale=collecting?.9+collectionProgress*1.3:1+hoverPower*.18+interactionPower*.75;band.scale=minimal?1:ease(band.scale,targetScale,step,10);band.mesh.scale.setScalar(band.scale);band.mesh.rotation.set(i*.85+shear*.4,.25+i*.5,band.angle);band.surface.opacity=minimal?0:clamp(burst*.9+hoverPower*.08);band.mesh.visible=band.surface.opacity>.001;
  }
  for(let i=0;i<cabal312512.particles;i++){const angle=i*2.39996+drift*.13,r=.58+(i%7)*.09+hoverPower*.09+interactionPower*.32+dissolve*1.15;particlePositions[i*3]=Math.cos(angle)*r;particlePositions[i*3+1]=Math.sin(angle)*r;particlePositions[i*3+2]=Math.sin(i*1.7)*(.40+shear*.25+dissolve*.45);}
  particleAttribute.needsUpdate=true;particleMaterial.opacity=minimal?0:collecting?burst:.28+energy*.55;particleMaterial.size=1.6+burst*1.1;
  try{renderer.render(scene,camera);frames++;}catch(error){recordError(error);fallback();}
 }
 function stop(){if(raf)win.cancelAnimationFrame(raf);raf=0;lastFrame=0;}
 function frame(stamp){
  raf=0;if(mode!=='ready'||!canDraw()||reduced.matches){stop();return;}raf=win.requestAnimationFrame(frame);
  if(lastFrame&&stamp-lastFrame<1000/cabal312512.fps)return;const dt=lastFrame?Math.min((stamp-lastFrame)/1000,.08):0;lastFrame=stamp;draw(dt);
 }
 function refresh(){
  if(root.hidden){dispose();return;}if(root.dataset.q8Collecting==='true')beginCollection();if(!canDraw()){stop();return;}init();if(mode!=='ready')return;
  if(reduced.matches){stop();draw(0);}else if(!raf){lastFrame=0;draw(0);if(mode==='ready'&&canDraw())raf=win.requestAnimationFrame(frame);}
 }
 function dispose(){
  if(disposed)return;disposed=true;stop();observer.disconnect();intersection?.disconnect();sizer?.disconnect();life.abort();mode='disposed';root.dataset.q8HiddenScene='disposed';canvas.dataset.sceneReady='false';release();
 }
 const observer=new win.MutationObserver(records=>{
  if(records.some(record=>record.target===root&&record.attributeName==='data-q8-action')){action=root.dataset.q8Action||'idle';beginAction(action);}refresh();
 });observer.observe(root,{attributes:true,attributeFilter:['hidden','style','data-q8-awake','data-q8-action','data-q8-collecting']});if(doc.body)observer.observe(doc.body,{attributes:true,attributeFilter:['data-cover']});
 const intersection=win.IntersectionObserver?new win.IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting!==false;refresh();}):null;intersection?.observe(root);
 const sizer=win.ResizeObserver?new win.ResizeObserver(()=>{width=0;refresh();}):null;sizer?.observe(root);
 on(root,'pointerenter',()=>{hovered=true;refresh();});on(root,'pointerleave',()=>{hovered=false;refresh();});on(root,'focus',()=>{focused=true;refresh();});on(root,'blur',()=>{focused=false;refresh();});
 on(doc,'visibilitychange',refresh);on(reduced,'change',refresh);on(win,'resize',()=>{width=0;refresh();});
 on(win,'pagehide',event=>{if(event.persisted){pagePaused=true;stop();}else dispose();});on(win,'pageshow',()=>{pagePaused=false;refresh();});
 on(canvas,'webglcontextlost',event=>{event.preventDefault();if(disposed||mode==='fallback')return;lost=true;mode='lost';root.dataset.q8HiddenScene='fallback';canvas.dataset.sceneReady='false';stop();});
 on(canvas,'webglcontextrestored',()=>{win.queueMicrotask(()=>{if(disposed||mode==='fallback'||!renderer)return;lost=false;mode='ready';root.dataset.q8HiddenScene='ready';canvas.dataset.sceneReady='true';width=0;refresh();});});
 const controller={refresh,dispose,snapshot:()=>({id:Number(root.dataset.id),form,mode,ready:mode==='ready',mesh:mode==='ready'?builtMeshes:0,builtMeshes,frames,running:!!raf,paused:!canDraw()||reduced.matches,collecting,collectionProgress,disposed,reduced:reduced.matches,activeTime:time,hover:{active:hovered,focused,power:hoverPower},gaze:{x:gazeX,y:gazeY},action,effect,interactionPower,particles:cabal312512.particles,errors:[...errors],geometry:geometries.size,materials:materials.size,instances:instances.size,viewport:{width,height,dpr:renderer?.getPixelRatio()??0},resources:renderer?{geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles}:null})};
 stages.set(root,controller);let diagnostics=diagnosticWindows.get(win);if(!diagnostics){const entries=new Set();diagnostics={entries,api:{snapshot:()=>[...entries].map(stage=>stage.snapshot()),refresh:()=>{for(const stage of entries)stage.refresh();},dispose:()=>{for(const stage of entries)stage.dispose();}}};diagnosticWindows.set(win,diagnostics);Object.defineProperty(win,'__ocvHidden3D',{value:diagnostics.api,configurable:true});}diagnostics.entries.add(controller);
 if(root.dataset.q8Collecting!=='true')beginAction(action);refresh();return controller;
}
