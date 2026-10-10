import * as THREE from 'three';

const cabal312512=Object.freeze({fps:40,dpr:1.5,rings:5,frame:3.55,eyeRadius:.94,particles:80});
const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
const effectDurations=Object.freeze({pulse:1.55,shear:1.8,phase:1.75,resonate:1.8});
const ease=(current,target,dt,speed=14)=>Math.abs(current-target)<.0005?target:current+(target-current)*(1-Math.exp(-dt*speed));
const eyeVertex=`
varying vec3 vSphere;
varying vec3 vNormal;
void main(){vSphere=normalize(position);vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const eyeFragment=`
uniform float energy;
uniform float blink;
uniform float phase;
uniform float time;
uniform float activation;
varying vec3 vSphere;
varying vec3 vNormal;
void main(){
 vec3 p=normalize(vSphere);float r=length(p.xy),angle=atan(p.y,p.x);
 float front=smoothstep(.02,.13,p.z),iris=(1.-smoothstep(.575,.59,r))*front;
 float irisAngle=angle+activation*.16*sin(time*1.7);
 float fibers=sin(angle*89.+sin(angle*19.)*2.1+r*38.)*.5+.5;
 float fine=sin(angle*173.+r*81.+sin(angle*31.)*1.4)*.5+.5;
 float strata=sin(r*73.+sin(angle*17.)*.8)*.5+.5;
 vec3 irisColor=mix(vec3(.035,.12,.23),vec3(.10,.56,.70),fibers*.58+fine*.26);
 irisColor+=vec3(.10,.30,.38)*strata*.27;
 float limbal=smoothstep(.49,.56,r);irisColor=mix(irisColor,vec3(.012,.075,.13),limbal*.82);
 float pupilRadius=.207+activation*.092;
 float pupilEdge=pupilRadius+activation*.012*cos(irisAngle*12.);
 float pupil=(1.-smoothstep(pupilEdge-.012,pupilEdge,r))*front;
 float pupilRim=exp(-abs(r-pupilEdge)*170.)*front;
 float circuit=exp(-abs(r-(.433+activation*.035))*170.)*step(.52,sin(irisAngle*32.+time*activation*.6))*front;
 float irisPlates=pow(max(cos(irisAngle*12.+activation*2.4),0.),18.)*smoothstep(pupilRadius+.025,pupilRadius+.07,r)*(1.-smoothstep(.51,.57,r))*front;
 float irisHalo=exp(-abs(r-.581)*95.)*front;
 vec3 base=mix(vec3(.83,.94,.97),vec3(.98,1.,1.),pow(max(p.z,0.),.7));
 float scleraGrid=pow(abs(sin(angle*13.+r*18.)),40.)*smoothstep(.65,.85,r)*front;
 base-=vec3(.05,.018,0.)*scleraGrid*.3;
 vec3 color=mix(base,irisColor,iris);color=mix(color,vec3(.005,.018,.032),pupil);
 color+=vec3(.10,.80,.85)*(pupilRim*.48+circuit*.22+irisHalo*.22+irisPlates*activation*.42)*(1.+energy*.85);
 float aperture=mix(1.04,.025,blink);
 float lid=smoothstep(aperture-.02,aperture+.015,abs(p.y))*front;
 vec3 lidColor=mix(vec3(.32,.56,.70),vec3(.76,.94,.98),max(p.z,0.));
 float seam=exp(-abs(abs(p.y)-aperture)*160.)*front*blink;
 color=mix(color,lidColor,lid);color+=vec3(.16,.75,.87)*seam*.75;
 float light=.54+.47*max(dot(normalize(vNormal),normalize(vec3(-.6,.8,1.1))),0.);
 float spec=pow(max(dot(reflect(-normalize(vec3(-.6,.8,1.1)),normalize(vNormal)),vec3(0.,0.,1.)),0.),52.);
 float catchlight=exp(-length(p.xy-vec2(-.18,.25))*34.)*front*(1.-lid);
 color=color*light+vec3(.66,.88,1.)*spec*.6+vec3(.9,1.,1.)*catchlight*.75;
 float phaseScan=exp(-abs(p.y-(sin(time*7.3)*.83))*58.)*phase;
 color+=vec3(.06,.48,.57)*phaseScan*.55;
 gl_FragColor=vec4(color,1.-phase*.38);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
const fieldVertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fieldFragment=`
uniform float time;uniform float energy;uniform float phase;uniform float activation;varying vec2 vUv;
void main(){vec2 p=(vUv-.5)*2.;float r=length(p),a=atan(p.y,p.x);
 float halo=exp(-pow((r-.75)*19.,2.))*.095;
 float ring=exp(-abs(r-.84)*180.)*step(.3,sin(a*46.+time*.23))*.2;
 float sweep=exp(-abs(r-(.40+mod(time*.12, .48)))*140.)*energy*.42;
 float activeBand=exp(-abs(r-(.59+activation*.25))*90.)*activation*.32;
 float glitchScan=exp(-abs(p.y-sin(time*6.4)*.78)*74.)*phase*.19*step(.22,sin(a*23.+time*13.));
 float rays=pow(max(sin(a*64.+time*.16),0.),18.)*exp(-pow((r-.8)*12.,2.))*.13;
 gl_FragColor=vec4(.20,.69,.82,(halo+ring+sweep+rays+activeBand+glitchScan)*(1.-phase*.35));}`;

export function createResidentScene(root){
 if(!root)return null;
 const canvas=root.querySelector('[data-q8-resident-canvas]');if(!canvas)return null;
 const doc=root.ownerDocument,win=doc.defaultView,panel=root.closest('[data-q8-resident]'),body=root.closest('[data-echo-body]');
 const life=new AbortController(),reduce=win.matchMedia('(prefers-reduced-motion: reduce)'),geometries=new Set(),materials=new Set(),instances=new Set();
 const scene=new THREE.Scene(),model=new THREE.Group();scene.add(model);
 const camera=new THREE.OrthographicCamera(-cabal312512.frame,cabal312512.frame,cabal312512.frame,-cabal312512.frame,.1,30);camera.position.set(0,.08,10);camera.lookAt(0,0,0);
 const rings=[],satellites=[],energyBands=[],powers={pulse:0,shear:0,phase:0,resonate:0},matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),axis=new THREE.Vector3(0,0,1);
 let renderer=null,eye=null,eyeMaterial=null,fieldMaterial=null,particles=null,particleMaterial=null,raf=0,lastFrame=0,time=0,frames=0,visible=true,pagePaused=false,disposed=false,lost=false,shaderFailed=false,sceneError=null,mode='pending',lastAction='idle',actionStarted=0,blink=0,blinkStarted=-1,nextBlink=4.8,blinkCount=0,gazeX=0,gazeY=0,width=0,height=0;
 let hovered=root.matches?.(':hover')||false,focused=doc.activeElement===root,hoverPower=0,dragPower=0,interactionPower=0,interactionCount=0,effectAction='idle',effectProgress=1,lastBurst=root.dataset.residentBurst||'',driftTime=0,cameraMargin=0,particlePositions=null,particleAttribute=null,lastParticlePower=-1,lastParticlePhase=-1;
 const geo=value=>(geometries.add(value),value),mat=value=>(materials.add(value),value);
 const on=(target,event,handler,options={})=>target?.addEventListener(event,handler,{...options,signal:life.signal});
 const value=(name,fallback=0)=>{const v=Number.parseFloat(root.style.getPropertyValue(name));return Number.isFinite(v)?v:fallback;};
 const dragging=()=>root.dataset.residentDragging==='true'||panel?.dataset.residentDragging==='true';
 const canDraw=()=>{if(disposed||lost||pagePaused||doc.visibilityState==='hidden'||!visible||root.dataset.q8Awake!=='true'||root.hidden||root.closest('[hidden]')||body&&win.getComputedStyle(body).display==='none'||!root.getClientRects().length)return false;const rect=root.getBoundingClientRect();return rect.width>0&&rect.height>0&&rect.bottom>0&&rect.top<win.innerHeight&&rect.right>0&&rect.left<win.innerWidth;};
 function beginAction(action){
  if(!effectDurations[action]||reduce.matches||dragging())return;effectAction=action;actionStarted=time;effectProgress=0;interactionCount=Math.min(interactionCount+1,1000000);
 }
 function updateCamera(){
  if(!width||!height)return;const frame=(cabal312512.frame+cameraMargin)*Math.max(1,width/height);camera.left=-frame;camera.right=frame;camera.top=frame*height/width;camera.bottom=-camera.top;camera.updateProjectionMatrix();
 }
 function ringMatrices(record,expansion=0){
  if(expansion===record.expansion||expansion!==0&&Math.abs(expansion-record.expansion)<.0005)return;record.expansion=expansion;
  const radius=record.radius+expansion;
  const segmentRadius=record.kind==='faceted-cage'?radius*Math.cos(Math.PI/record.count):radius;
  for(let j=0;j<record.count;j++){
   const angle=j*Math.PI*2/record.count+record.segmentPhase;
   position.set(Math.cos(angle)*segmentRadius,Math.sin(angle)*segmentRadius,0);rotation.setFromAxisAngle(axis,angle);
   scale.set(record.dimensions.x*(j%record.majorEvery===0?record.majorScale:1),record.dimensions.y,record.dimensions.z);matrix.compose(position,rotation,scale);record.segments.setMatrixAt(j,matrix);
  }
  for(let j=0;j<record.glyphCount;j++){
   const angle=j*Math.PI*2/record.glyphCount;
   for(let k=0;k<3;k++){
    const a=angle+(k-1)*.028,r=radius-record.glyphInset;
    position.set(Math.cos(a)*r,Math.sin(a)*r,.09);rotation.setFromAxisAngle(axis,a+(k===1?Math.PI/2:0));scale.set(k===1?1.7:1,record.kind==='instrument'?.68:1,1);
    matrix.compose(position,rotation,scale);record.glyphs.setMatrixAt(j*3+k,matrix);
   }
  }
  if(record.links)for(let j=0;j<record.count;j++){
   const angle=j*Math.PI*2/record.count;position.set(Math.cos(angle)*radius,Math.sin(angle)*radius,0);rotation.setFromAxisAngle(axis,angle);scale.set(.065,.065,.44);matrix.compose(position,rotation,scale);record.links.setMatrixAt(j,matrix);
  }
  record.segments.instanceMatrix.needsUpdate=true;record.glyphs.instanceMatrix.needsUpdate=true;
  if(record.links)record.links.instanceMatrix.needsUpdate=true;
 }
 function build(){
  const metal=mat(new THREE.MeshPhysicalMaterial({color:0xccebf5,metalness:.58,roughness:.22,clearcoat:1,clearcoatRoughness:.17}));
  const rim=mat(new THREE.MeshStandardMaterial({color:0x75bad2,metalness:.55,roughness:.28,emissive:0x186b8b,emissiveIntensity:.3}));
  const glow=mat(new THREE.MeshBasicMaterial({color:0x91f5f3,transparent:true,opacity:.87,depthWrite:false}));
  const ghost=mat(new THREE.MeshBasicMaterial({color:0x4fa8cd,transparent:true,opacity:.32,depthWrite:false}));
  scene.add(new THREE.HemisphereLight(0xf4ffff,0x426c98,2.2));
  const key=new THREE.DirectionalLight(0xf6ffff,3.2);key.position.set(-3,4,6);scene.add(key);
  const side=new THREE.DirectionalLight(0x6bdfff,2.3);side.position.set(4,-1,2);scene.add(side);
  eyeMaterial=mat(new THREE.ShaderMaterial({vertexShader:eyeVertex,fragmentShader:eyeFragment,uniforms:{energy:{value:0},blink:{value:0},phase:{value:0},time:{value:0},activation:{value:0}},transparent:true}));
  eye=new THREE.Mesh(geo(new THREE.SphereGeometry(cabal312512.eyeRadius,48,32)),eyeMaterial);model.add(eye);
  const specs=[
   {kind:'gear',r:1.83,x:.30,y:.48,z:-.24,speed:.36,count:36,glyphCount:18,glyphInset:.18,dimensions:{x:.20,y:.105,z:.105},majorEvery:3,majorScale:1.4,arcCount:5,arcSpan:.22},
   {kind:'dual-rail',r:2.26,x:.96,y:-.43,z:.22,speed:-.29,count:24,glyphCount:24,glyphInset:.20,dimensions:{x:.26,y:.045,z:.14},majorEvery:6,majorScale:1,arcCount:2,arcSpan:.68},
   {kind:'faceted-cage',r:2.66,x:-.72,y:.45,z:.38,speed:.22,count:12,glyphCount:12,glyphInset:.12,dimensions:{x:.15,y:1.18,z:.24},majorEvery:1,majorScale:1,segmentPhase:Math.PI/12,arcCount:0,arcSpan:0},
   {kind:'industrial-band',r:3.03,x:1.08,y:.20,z:-.1,speed:-.18,count:24,glyphCount:12,glyphInset:.20,dimensions:{x:.052,y:.072,z:.19},majorEvery:4,majorScale:1.3,arcCount:4,arcSpan:.29},
   {kind:'instrument',r:1.45,x:-.27,y:.97,z:.61,speed:-.43,count:64,glyphCount:16,glyphInset:.19,dimensions:{x:.075,y:.018,z:.026},majorEvery:8,majorScale:2.4,arcCount:8,arcSpan:.045},
  ];
  const blockGeometry=geo(new THREE.BoxGeometry(1,1,1)),glyphGeometry=geo(new THREE.BoxGeometry(.022,.095,.023));
  const trace=mat(new THREE.LineBasicMaterial({color:0x77ddea,transparent:true,opacity:.76}));
  for(const [i,spec]of specs.entries()){
   const pivot=new THREE.Group(),wheel=new THREE.Group();pivot.rotation.set(spec.x,spec.y,spec.z);pivot.add(wheel);model.add(pivot);
   const tube=(radius,thickness,surface,z=0)=>{const mesh=new THREE.Mesh(geo(new THREE.TorusGeometry(radius,thickness,7,96)),surface);mesh.position.z=z;wheel.add(mesh);return mesh;};
   let links=null;
   if(spec.kind==='gear'){
    tube(spec.r,.065,rim);tube(spec.r-.075,.021,metal,.025);tube(spec.r+.075,.013,glow,.065);
   }else if(spec.kind==='dual-rail'){
    tube(spec.r+.11,.035,metal,.065);tube(spec.r-.11,.035,metal,-.065);tube(spec.r+.13,.013,glow,.10);tube(spec.r-.13,.013,ghost,-.09);
   }else if(spec.kind==='faceted-cage'){
    const vertices=Array.from({length:12},(_,j)=>new THREE.Vector3(Math.cos(j*Math.PI/6)*spec.r,Math.sin(j*Math.PI/6)*spec.r,0));
    const polygon=geo(new THREE.BufferGeometry().setFromPoints(vertices));
    for(const z of [-.22,.22]){const outline=new THREE.LineLoop(polygon,trace);outline.position.z=z;wheel.add(outline);}
    links=new THREE.InstancedMesh(blockGeometry,rim,spec.count);links.instanceMatrix.setUsage(THREE.DynamicDrawUsage);instances.add(links);wheel.add(links);
   }else if(spec.kind==='industrial-band'){
    const band=new THREE.Shape();band.absarc(0,0,spec.r+.14,0,Math.PI*2,false);
    const aperture=new THREE.Path();aperture.absarc(0,0,spec.r-.14,0,Math.PI*2,true);band.holes.push(aperture);
    for(let j=0;j<24;j++){
     const angle=j*Math.PI/12,slot=new THREE.Path();
     const corners=[[-.032,-.095],[-.032,.095],[.032,.095],[.032,-.095]];
     for(const [k,[radial,tangent]]of corners.entries()){const x=Math.cos(angle)*(spec.r+radial)-Math.sin(angle)*tangent,y=Math.sin(angle)*(spec.r+radial)+Math.cos(angle)*tangent;if(k===0)slot.moveTo(x,y);else slot.lineTo(x,y);}slot.closePath();band.holes.push(slot);
    }
    const housing=geo(new THREE.ExtrudeGeometry(band,{depth:.11,bevelEnabled:true,bevelSize:.014,bevelThickness:.018,bevelSegments:1,steps:1,curveSegments:48}));housing.translate(0,0,-.055);wheel.add(new THREE.Mesh(housing,metal));
    tube(spec.r+.15,.022,rim);tube(spec.r-.15,.015,glow,.073);
   }else{
    tube(spec.r-.07,.014,metal);tube(spec.r+.07,.014,rim);tube(spec.r,.007,ghost);
   }
   const segments=new THREE.InstancedMesh(blockGeometry,spec.kind==='instrument'?rim:metal,spec.count),glyphs=new THREE.InstancedMesh(glyphGeometry,glow,spec.glyphCount*3);instances.add(segments);instances.add(glyphs);segments.instanceMatrix.setUsage(THREE.DynamicDrawUsage);glyphs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);wheel.add(segments,glyphs);
   if(spec.arcCount){const arcGeometry=geo(new THREE.TorusGeometry(spec.r+(spec.kind==='industrial-band'?-.095:.025),.017,5,24,Math.PI*spec.arcSpan));for(let j=0;j<spec.arcCount;j++){const arc=new THREE.Mesh(arcGeometry,glow);arc.rotation.z=j*Math.PI*2/spec.arcCount+i*.37;arc.position.z=.085;wheel.add(arc);}}
   const record={...spec,pivot,wheel,radius:spec.r,phase:i*.83,angle:i*.83,expansion:-Infinity,segments,glyphs,links,segmentPhase:spec.segmentPhase||0};rings.push(record);ringMatrices(record);
  }
  const crystalGeometry=geo(new THREE.OctahedronGeometry(.095,0));
  for(let i=0;i<8;i++){const shard=new THREE.Mesh(crystalGeometry,i%3?metal:rim);model.add(shard);satellites.push({mesh:shard,phase:i*2.39996,radius:3.02+(i%3)*.075});}
  const energyGeometry=geo(new THREE.TorusGeometry(2.55,.017,6,96,Math.PI*1.45));
  for(let i=0;i<3;i++){
   const surface=mat(new THREE.MeshBasicMaterial({color:i===1?0xb5edff:0x65f3e7,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})),mesh=new THREE.Mesh(energyGeometry,surface);
   mesh.rotation.set((i-1)*.55,i*.49,i*2.1);mesh.visible=false;model.add(mesh);energyBands.push({mesh,surface,angle:i*2.1,scale:1,opacity:0});
  }
  fieldMaterial=mat(new THREE.ShaderMaterial({vertexShader:fieldVertex,fragmentShader:fieldFragment,uniforms:{time:{value:0},energy:{value:0},phase:{value:0},activation:{value:0}},transparent:true,depthWrite:false}));
  const field=new THREE.Mesh(geo(new THREE.PlaneGeometry(6.95,6.95)),fieldMaterial);field.position.z=-2.8;model.add(field);
  particlePositions=new Float32Array(cabal312512.particles*3);
  for(let i=0;i<cabal312512.particles;i++){const angle=i*2.39996,r=2.98+(i%7)*.035;particlePositions[i*3]=Math.cos(angle)*r;particlePositions[i*3+1]=Math.sin(angle)*r;particlePositions[i*3+2]=Math.sin(i*1.7)*.6;}
  const particleGeometry=geo(new THREE.BufferGeometry());particleAttribute=new THREE.BufferAttribute(particlePositions,3);particleAttribute.setUsage(THREE.DynamicDrawUsage);particleGeometry.setAttribute('position',particleAttribute);
  particleMaterial=mat(new THREE.PointsMaterial({color:0x61bed8,size:2.1,transparent:true,opacity:.52,depthWrite:false,sizeAttenuation:false}));particles=new THREE.Points(particleGeometry,particleMaterial);model.add(particles);
 }
 function resize(){
  if(!renderer)return;const rect=root.getBoundingClientRect(),w=Math.round(rect.width),h=Math.round(rect.height);if(!w||!h)return;
  if(w===width&&h===height)return;width=w;height=h;renderer.setPixelRatio(Math.min(win.devicePixelRatio||1,cabal312512.dpr));renderer.setSize(w,h,false);
  updateCamera();
 }
 function init(){
  if(renderer||mode==='fallback'||!canDraw())return;
  try{
   renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
   renderer.debug.onShaderError=(gl,program)=>{shaderFailed=true;sceneError=`Resident shader linking failed: ${gl.getProgramInfoLog(program)||'unknown error'}`.slice(0,500);console.error(sceneError);throw new Error(sceneError);};
   renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;build();resize();renderer.compile(scene,camera);
   if(shaderFailed){fallback();return;}mode='ready';root.dataset.q8Scene='ready';canvas.dataset.sceneReady='true';
  }catch(error){sceneError=String(error?.message||error).slice(0,500);fallback();}
 }
 function fallback(){
  if(disposed||mode==='fallback')return;stop();mode='fallback';root.dataset.q8Scene='fallback';canvas.dataset.sceneReady='false';for(const mesh of instances)mesh.dispose();instances.clear();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();geometries.clear();materials.clear();scene.clear();renderer?.dispose();renderer?.forceContextLoss();renderer=null;
 }
 function draw(dt){
  if(!renderer||mode!=='ready'||!canDraw())return;resize();const reduced=reduce.matches;if(!reduced)time+=dt;
  const action=root.dataset.q8Action||'idle';if(action!==lastAction){lastAction=action;beginAction(action);}
  const isDragging=dragging(),step=Math.max(dt,.025);if(reduced){effectAction='idle';effectProgress=1;}else effectProgress=effectDurations[effectAction]?clamp((time-actionStarted)/effectDurations[effectAction],0,1):1;
  const envelope=effectProgress>=1?0:effectAction==='resonate'?Math.pow(Math.sin(effectProgress*Math.PI*2),2):Math.pow(Math.sin(effectProgress*Math.PI),.8),targetPower=reduced||isDragging?0:envelope;
  hoverPower=reduced?0:ease(hoverPower,(hovered||focused)&&!isDragging?1:0,step,8);dragPower=reduced?0:ease(dragPower,isDragging?1:0,step,12);interactionPower=reduced?0:ease(interactionPower,targetPower,step,18);
  for(const name of Object.keys(powers))powers[name]=reduced?0:ease(powers[name],effectAction===name?targetPower:0,step,18);
  const {pulse,shear,phase,resonate}=powers,activation=clamp(hoverPower*.42+interactionPower*.75+dragPower*.2,0,1),energy=clamp(value('--speech-energy')*.65+interactionPower*.8+hoverPower*.24+dragPower*.18+value('--field-proximity')*.12,0,1);
  const targetX=isDragging?0:clamp(value('--field-x')/8,-1,1)*.45,targetY=isDragging?0:clamp(value('--field-y')/6,-1,1)*.35;
  gazeX=reduced?0:ease(gazeX,targetX,step,9);gazeY=reduced?0:ease(gazeY,targetY,step,9);eye.rotation.set(gazeY,gazeX,0);
  if(!reduced&&!isDragging&&blinkStarted<0&&time>=nextBlink){blinkStarted=time;blinkCount++;}
  if(blinkStarted>=0){const elapsed=time-blinkStarted;blink=reduced?0:Math.pow(Math.sin(clamp(elapsed/.36,0,1)*Math.PI),1.35);if(elapsed>=.36||reduced){blink=0;blinkStarted=-1;nextBlink=time+5.4+Math.sin(blinkCount*2.7)*1.2;}}
  eyeMaterial.uniforms.blink.value=blink;eyeMaterial.uniforms.energy.value=energy;eyeMaterial.uniforms.phase.value=phase;eyeMaterial.uniforms.activation.value=activation;
  const motion=1-dragPower;if(!reduced)driftTime+=dt*motion;
  eyeMaterial.uniforms.time.value=driftTime;
  model.rotation.y=reduced?0:Math.sin(driftTime*.18)*.075*motion+gazeX*.13;model.rotation.x=reduced?0:Math.sin(driftTime*.13)*.045*motion+gazeY*.1;model.scale.setScalar(1+pulse*.045);
  const nextMargin=reduced?0:ease(cameraMargin,interactionPower*.5+shear*.16+hoverPower*.12,step,8);if(nextMargin!==cameraMargin){cameraMargin=nextMargin;updateCamera();}
  for(const [i,ring]of rings.entries()){
   if(!reduced)ring.angle+=dt*ring.speed*(1+hoverPower*.35+interactionPower*1.5+resonate*1.8)*motion;ring.wheel.rotation.z=ring.angle;
   const direction=i*Math.PI*2/rings.length,side=i%2?1:-1,fan=hoverPower*.18+interactionPower*.35+shear*.65,spread=(.28+i*.11)*fan,scan=Math.sin(time*16+i*.8)*phase*.045;
   const offsetX=Math.cos(direction)*spread+scan,offsetY=Math.sin(direction)*spread-scan*.6,offsetZ=side*(hoverPower*.14+interactionPower*.45+shear*.65+phase*.25);
   const tiltX=ring.x+Math.sin(direction+.7)*fan*.42+side*phase*.12,tiltY=ring.y+Math.cos(direction-.3)*fan*.42+side*shear*.18,tiltZ=ring.z+side*(hoverPower*.1+shear*.21+phase*.1);
   ring.pivot.position.set(reduced?0:ease(ring.pivot.position.x,offsetX,step),reduced?0:ease(ring.pivot.position.y,offsetY,step),reduced?0:ease(ring.pivot.position.z,offsetZ,step));
   ring.pivot.rotation.set(reduced?ring.x:ease(ring.pivot.rotation.x,tiltX,step),reduced?ring.y:ease(ring.pivot.rotation.y,tiltY,step),reduced?ring.z:ease(ring.pivot.rotation.z,tiltZ,step));
   const wheelScale=1+(hoverPower*.024+shear*.075+pulse*.025)*(ring.kind==='industrial-band'?.65:1);ring.wheel.scale.setScalar(reduced?1:ease(ring.wheel.scale.x,wheelScale,step));
   ringMatrices(ring,0);
  }
  for(const [i,band]of energyBands.entries()){
   const progress=clamp((effectProgress-i*.12)/.76,0,1),activeBand=Math.sin(progress*Math.PI),targetScale=interactionPower>.001?.85+progress*.55:1.06;
   if(!reduced)band.angle+=dt*(i%2?-.22:.29)*(1+resonate*1.2)*motion;
   band.scale=reduced?1:ease(band.scale,targetScale,step,9);band.opacity=reduced?0:ease(band.opacity,activeBand*interactionPower*.64+hoverPower*.07+dragPower*.045,step,18);
   band.mesh.visible=band.opacity>.001;band.surface.opacity=band.opacity;band.mesh.scale.setScalar(band.scale);band.mesh.rotation.set((i-1)*.55+shear*.28*Math.sin(i+1),i*.49+phase*.18,band.angle);band.mesh.position.z=(i-1)*(interactionPower*.36+hoverPower*.08);
  }
  for(const [i,item]of satellites.entries()){const angle=item.phase+driftTime*(i%2?.13:-.11),radius=item.radius*(1+hoverPower*.02+interactionPower*.075+shear*.08);item.mesh.position.set(Math.cos(angle)*radius,Math.sin(angle)*radius*.89,Math.sin(angle*1.7)*(.7+interactionPower*.55));item.mesh.rotation.set(driftTime*.2+i,driftTime*.3+i,angle);item.mesh.scale.setScalar(1+interactionPower*.65+hoverPower*.18);}
  const particlePower=clamp(hoverPower*.12+interactionPower*.55+shear*.2,0,1);
  if(particlePower!==lastParticlePower&&(particlePower===0||Math.abs(particlePower-lastParticlePower)>.0008)||phase!==lastParticlePhase&&(phase===0||Math.abs(phase-lastParticlePhase)>.0008)||phase>.002){
   for(let i=0;i<cabal312512.particles;i++){const angle=i*2.39996+Math.sin(driftTime*11+i)*phase*.012,r=(2.98+(i%7)*.035)*(1+particlePower*.18);particlePositions[i*3]=Math.cos(angle)*r;particlePositions[i*3+1]=Math.sin(angle)*r;particlePositions[i*3+2]=Math.sin(i*1.7)*(.6+particlePower*.8);}
   lastParticlePower=particlePower;lastParticlePhase=phase;particleAttribute.needsUpdate=true;
  }
  particles.rotation.z=driftTime*.027;particleMaterial.opacity=.42+energy*.35;particleMaterial.size=2.1+interactionPower*1.45;
  fieldMaterial.uniforms.time.value=driftTime;fieldMaterial.uniforms.energy.value=energy;fieldMaterial.uniforms.phase.value=phase;fieldMaterial.uniforms.activation.value=activation;
  try{renderer.render(scene,camera);frames++;}catch(error){sceneError=String(error?.message||error).slice(0,500);fallback();}
 }
 function stop(){if(raf)win.cancelAnimationFrame(raf);raf=0;lastFrame=0;}
 function frame(stamp){
  raf=0;if(mode!=='ready'||!canDraw()||reduce.matches){stop();return;}raf=win.requestAnimationFrame(frame);
  if(lastFrame&&stamp-lastFrame<1000/cabal312512.fps)return;const dt=lastFrame?Math.min((stamp-lastFrame)/1000,.08):0;lastFrame=stamp;draw(dt);
 }
 function refresh(){
  if(!canDraw()){stop();return;}init();if(mode!=='ready')return;
  if(reduce.matches){stop();draw(0);}else if(!raf){lastFrame=0;draw(0);if(mode==='ready'&&canDraw())raf=win.requestAnimationFrame(frame);}
 }
 function dispose(){
  if(disposed)return;disposed=true;stop();observer.disconnect();intersection?.disconnect();sizer?.disconnect();life.abort();
  for(const mesh of instances)mesh.dispose();instances.clear();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();geometries.clear();materials.clear();scene.clear();renderer?.dispose();renderer?.forceContextLoss();renderer=null;mode='disposed';root.dataset.q8Scene='disposed';canvas.dataset.sceneReady='false';
 }
 const observer=new win.MutationObserver(records=>{
  const action=root.dataset.q8Action||'idle',burst=root.dataset.residentBurst||'',burstChanged=burst!==lastBurst;
  if(burstChanged||records.some(record=>record.target===root&&record.attributeName==='data-q8-action')){lastBurst=burst;lastAction=action;beginAction(action);}
  if(dragging())effectAction='idle';refresh();
 });observer.observe(root,{attributes:true,attributeFilter:['hidden','style','data-q8-awake','data-q8-action','data-q8-talking','data-resident-burst','data-resident-dragging']});if(panel)observer.observe(panel,{attributes:true,attributeFilter:['hidden','data-resident-dragging']});if(body)observer.observe(body,{attributes:true,attributeFilter:['style','hidden']});
 const intersection=win.IntersectionObserver?new win.IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting!==false;refresh();}):null;intersection?.observe(root);
 const sizer=win.ResizeObserver?new win.ResizeObserver(()=>{width=0;resize();refresh();}):null;sizer?.observe(root);
 on(root,'pointerenter',()=>{hovered=true;refresh();});on(root,'pointerleave',()=>{hovered=false;refresh();});on(root,'pointerup',()=>{hovered=root.matches?.(':hover')||false;refresh();});
 on(root,'focus',()=>{focused=true;refresh();});on(root,'blur',()=>{focused=false;refresh();});
 on(doc,'visibilitychange',refresh);on(reduce,'change',refresh);on(win,'resize',()=>{width=0;refresh();});
 on(win,'pagehide',event=>{if(event.persisted){pagePaused=true;stop();}else dispose();});on(win,'pageshow',()=>{pagePaused=false;refresh();});
 on(canvas,'webglcontextlost',event=>{event.preventDefault();if(disposed||mode==='fallback')return;lost=true;mode='lost';root.dataset.q8Scene='fallback';canvas.dataset.sceneReady='false';stop();});
 on(canvas,'webglcontextrestored',()=>{win.queueMicrotask(()=>{if(disposed||mode==='fallback')return;lost=false;mode='ready';root.dataset.q8Scene='ready';canvas.dataset.sceneReady='true';width=0;resize();refresh();});});
 const diagnostics={refresh,dispose,snapshot:()=>({
  mode,sceneReady:mode==='ready',drawFrames:frames,running:!!raf,paused:!canDraw()||reduce.matches,reduced:reduce.matches,disposed,activeTime:time,
  gaze:{x:gazeX,y:gazeY},hover:{active:hovered,focused,power:hoverPower},dragging:dragging(),dragPower,
  burst:{key:lastBurst,action:effectAction,progress:effectProgress,power:interactionPower,count:interactionCount},
  blink,blinkCount,eyes:eye?1:0,eyeRadius:cabal312512.eyeRadius,
  effects:{action:lastAction,energy:eyeMaterial?.uniforms.energy.value??0,phase:fieldMaterial?.uniforms.phase.value??0,interactionPower,ringOffset:rings[0]?.pivot.position.toArray()??[0,0,0],ringOffsets:rings.map(r=>r.pivot.position.toArray()),expansion:rings[0]?.expansion??0,eyeBlink:eyeMaterial?.uniforms.blink.value??0,irisActivation:eyeMaterial?.uniforms.activation.value??0,pupilRadius:.207+(eyeMaterial?.uniforms.activation.value??0)*.092,energyBands:energyBands.length,radialPower:Math.max(0,lastParticlePower),cameraMargin},
  error:sceneError,rings:rings.map(r=>({kind:r.kind,radius:r.radius,segments:r.count,glyphs:r.glyphCount*3,rotation:r.wheel.rotation.z,speed:r.speed,tilt:{x:r.pivot.rotation.x,y:r.pivot.rotation.y,z:r.pivot.rotation.z},offset:r.pivot.position.toArray(),scale:r.wheel.scale.x})),particles:cabal312512.particles,
  viewport:{width,height,dpr:renderer?.getPixelRatio()??0},resources:renderer?{geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles}:null
 })};
 Object.defineProperty(win,'__ocvResident3D',{value:diagnostics,configurable:true});refresh();return diagnostics;
}
