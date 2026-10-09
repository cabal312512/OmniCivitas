// Additive visual layer. References and license notes: docs/EFFECT-SOURCES.md.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { desktopView } from '../q7/view.mjs';

gsap.registerPlugin(ScrollTrigger);
const canvas = document.querySelector('#reactor-field');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const lifetime = new AbortController();
const listen = (node, type, fn, options = {}) => node?.addEventListener(type, fn, {...options, signal:lifetime.signal});
const small = innerWidth < 700;
let desktop = desktopView(innerWidth, innerHeight);
const state = window.__ocvReactor = {
  renderer:'pending', three:THREE.REVISION, gsap:gsap.version, frames:0,
  mode:1, cover:true, bloom:false, suspended:false, reduced:reduce.matches,
  instances:small?84:144, drawCalls:0, triangles:0, explosion:0, quality:1,
  pointer:{x:0,y:0}, gpuError:0, elapsed:0, turns:0, pulses:0, picks:0,
  spin:{x:0,y:0}, waveScale:0, pickedInstance:null
};
const view = {chapter:1, explosion:0, dive:0};
const pointer = {x:0, y:0, tx:0, ty:0};
let renderer, scene, camera, world, shell, core, knots=[], rings=[], tubes=[], tiles, ticks, dust, wave;
let composer, bloom, output, capture, baseTarget, environmentTarget, environment, pmrem;
let raf=0, last=0, seconds=0, dirty=true, disposed=false, override=null, lastSection=-1, context;
const geometries = new Set(), materials = new Set();
const keepGeometry = value => (geometries.add(value), value);
const keepMaterial = value => (materials.add(value), value);
const dummy = new THREE.Object3D();
const origin = new THREE.Vector3();
const targets = Array.from({length:state.instances},()=>new THREE.Vector3());
const current = targets.map(()=>new THREE.Vector3());
const hand={x:0,y:0,kick:0,progress:1},raycaster=new THREE.Raycaster(),screenPoint=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,0,1),0),wavePoint=new THREE.Vector3(),projected=new THREE.Vector3();
let grabbed=null;

function mesh(geometry, material, parent=world) {
  const value = new THREE.Mesh(keepGeometry(geometry), material); parent.add(value); return value;
}

function init() {
  renderer = new THREE.WebGLRenderer({canvas,alpha:true,antialias:!small,premultipliedAlpha:false,powerPreference:'low-power'});
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000,0);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.transmissionResolutionScale = small?.35:.5;
  renderer.info.autoReset = false;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(36,innerWidth/innerHeight,.1,60);
  camera.position.set(0,.1,small?12.2:9.8);
  pmrem = new THREE.PMREMGenerator(renderer);
  environment = new RoomEnvironment();
  environmentTarget = pmrem.fromScene(environment,.04);
  scene.environment = environmentTarget.texture;
  environment.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xdceaff,0x12204a,.8));
  const key = new THREE.DirectionalLight(0xffffff,2); key.position.set(4,6,5); scene.add(key);
  const blue = new THREE.PointLight(0x1d50ff,14,12); blue.position.set(-3,1,3); scene.add(blue);
  const rim = new THREE.DirectionalLight(0x78d5ff,1.5); rim.position.set(-5,-2,-3); scene.add(rim);
  world = new THREE.Group(); scene.add(world);
  const chrome = keepMaterial(new THREE.MeshPhysicalMaterial({color:0x233553,metalness:1,roughness:.18,clearcoat:0,envMapIntensity:.45}));
  const ink = keepMaterial(new THREE.MeshStandardMaterial({color:0x030715,metalness:.25,roughness:.45,envMapIntensity:.15}));
  const cobalt = keepMaterial(new THREE.MeshPhysicalMaterial({color:0x083aff,metalness:.25,roughness:.24,clearcoat:.55,envMapIntensity:.3,emissive:0x0825a0,emissiveIntensity:.18}));
  const electric = keepMaterial(new THREE.MeshBasicMaterial({color:new THREE.Color(.045,.65,6),toneMapped:false}));
  const cyan = keepMaterial(new THREE.MeshBasicMaterial({color:new THREE.Color(.07,2.1,5),toneMapped:false}));
  core = mesh(new THREE.IcosahedronGeometry(.65,2),cobalt);
  const coreEdges = new THREE.LineSegments(keepGeometry(new THREE.EdgesGeometry(core.geometry)),keepMaterial(new THREE.LineBasicMaterial({color:0x2673ff,transparent:true,opacity:.7})));
  core.add(coreEdges);
  shell = mesh(new THREE.IcosahedronGeometry(.91,1),keepMaterial(new THREE.MeshPhysicalMaterial({color:0xffffff,metalness:0,roughness:.04,transmission:.94,thickness:.2,ior:1.45,clearcoat:.5,envMapIntensity:.6})));
  for(let i=0;i<3;i++){
    const knot = mesh(new THREE.TorusKnotGeometry(1.05+i*.12,.12-i*.016,small?90:140,10,2,3),i===1?cobalt:i===2?ink:chrome);
    knot.rotation.set(i*.95,i*.72,i*.63); knot.userData.base=knot.rotation.clone(); knots.push(knot);
  }
  for(let i=0;i<8;i++){
    const group=new THREE.Group(); world.add(group);
    const radius=1.42+i*.115;
    mesh(new THREE.TorusGeometry(radius,i%3===0?.042:.013,6,small?72:110,Math.PI*(i%2===0?1.72:1.44)),i%3===0?chrome:i%2?electric:ink,group);
    mesh(new THREE.TorusGeometry(radius+.055,.007,4,small?64:100,Math.PI*1.2),i%3?cyan:ink,group);
    group.rotation.set(i*.38+.35,i*.26-.5,i*.71);
    group.userData.base=group.rotation.clone(); rings.push(group);
  }
  // Solid branching conduits, with moving emissive packets, rather than a uniform wire ball.
  const packetGeometry=keepGeometry(new THREE.OctahedronGeometry(.045));
  for(let i=0;i<10;i++){
    const a=i*Math.PI*2/10;
    const points=Array.from({length:7},(_,j)=>{
      const r=.85+j*.43;
      const angle=a+Math.sin(j*.75+i*.6)*.37;
      return new THREE.Vector3(Math.cos(angle)*r,Math.sin(angle)*r*.72,Math.sin(j*.9+i)*.7-.35);
    });
    const curve=new THREE.CatmullRomCurve3(points);
    const tube=mesh(new THREE.TubeGeometry(curve,small?38:70,i%3===0?.024:.009,4,false),i%3===0?chrome:electric);
    const packet=mesh(packetGeometry,i%2?cyan:electric);
    tubes.push({tube,packet,curve,offset:i*.113});
  }
  tiles = new THREE.InstancedMesh(keepGeometry(new THREE.BoxGeometry(.14,.06,.25)),cobalt,state.instances);
  tiles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); tiles.frustumCulled=false; world.add(tiles);
  for(let i=0;i<state.instances;i++) tiles.setColorAt(i,new THREE.Color(i%5===0?0x174eff:i%3===0?0x101e39:0xc7d8ef));
  ticks = new THREE.InstancedMesh(keepGeometry(new THREE.BoxGeometry(.024,.12,.05)),ink,96);
  for(let i=0;i<96;i++){
    const a=i/96*Math.PI*2;
    dummy.position.set(Math.cos(a)*2.22,Math.sin(a)*2.22,0);
    dummy.rotation.set(0,0,a-Math.PI/2); dummy.scale.set(1,i%4===0?1.8:1,1); dummy.updateMatrix(); ticks.setMatrixAt(i,dummy.matrix);
  }
  ticks.rotation.set(.85,.2,-.35); world.add(ticks);
  const particleCount=small?600:1500;
  const positions=new Float32Array(particleCount*3),seeds=new Float32Array(particleCount);
  let seed=83216; const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  for(let i=0;i<particleCount;i++){
    const a=random()*Math.PI*2,r=1.2+random()*3.6;
    positions.set([Math.cos(a)*r,Math.sin(a)*r*.65,(random()-.5)*3],i*3); seeds[i]=random();
  }
  const dustGeometry=keepGeometry(new THREE.BufferGeometry());dustGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));dustGeometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));
  const dustMaterial=keepMaterial(new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:{value:0},uPointer:{value:new THREE.Vector2()}},vertexShader:`attribute float aSeed;uniform float uTime;uniform vec2 uPointer;varying float vSeed;void main(){vec3 p=position;p.xy+=vec2(sin(uTime*.3+aSeed*30.),cos(uTime*.24+aSeed*20.))*.09;vec2 delta=p.xy-uPointer*2.;p.xy+=normalize(delta+.001)*exp(-dot(delta,delta))* .2;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=(1.8+step(.9,aSeed)*2.5)*8./max(1.,-mv.z);vSeed=aSeed;}`,fragmentShader:`varying float vSeed;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;vec3 color=mix(vec3(.02,.12,.8),vec3(.03,1.1,3.),step(.88,vSeed));gl_FragColor=vec4(color,(1.-d)*.7);}`}));
  dust=new THREE.Points(dustGeometry,dustMaterial);world.add(dust);
  // One reusable luminous ring; repeated clicks never allocate new GPU objects.
  wave=mesh(new THREE.RingGeometry(.91,1,small?64:128),keepMaterial(new THREE.MeshBasicMaterial({color:0x167dff,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending})),scene);wave.visible=false;
  baseTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType});
  composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
  // Copy the base color/alpha before bloom with one fullscreen quad, rather than render the whole world twice.
  const captureMaterial=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{tDiffuse:{value:null}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform sampler2D tDiffuse;varying vec2 vUv;void main(){gl_FragColor=texture2D(tDiffuse,vUv);}`});
  const captureQuad=new FullScreenQuad(captureMaterial);
  capture=new Pass();capture.needsSwap=false;
  capture.render=(gpu,write,read)=>{captureMaterial.uniforms.tDiffuse.value=read.texture;gpu.setRenderTarget(baseTarget);captureQuad.render(gpu);};
  capture.dispose=()=>{captureMaterial.dispose();captureQuad.dispose();};composer.addPass(capture);
  bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.38,.25,1.05);composer.addPass(bloom);
  // Preserve transparent pixels when adding bloom, so the previous homepage remains visible.
  output=new ShaderPass({uniforms:{tDiffuse:{value:null},tBase:{value:baseTarget.texture}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform sampler2D tDiffuse;uniform sampler2D tBase;varying vec2 vUv;vec3 film(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}void main(){vec4 b=texture2D(tBase,vUv);vec3 all=texture2D(tDiffuse,vUv).rgb;vec3 glow=max(vec3(0.),all-b.rgb);float a=max(b.a,clamp(max(glow.r,max(glow.g,glow.b))*1.7,0.,1.));vec3 rgb=pow(film(all/max(a,.001)),vec3(1./2.2));gl_FragColor=vec4(rgb,a);}`});
  composer.addPass(output);
  state.renderer='three-webgl2';state.bloom=true;state.materials=['physical-metal','physical-transmission','hdr-emission','particle-shader'];
  document.body.dataset.reactor='ready';
}

try {init();} catch(error) {
  state.renderer='css';state.failure=error.message;
  const fallback=document.createElement('div');fallback.className='reactor-fallback';fallback.setAttribute('aria-hidden','true');document.body.prepend(fallback);
  renderer?.dispose();renderer=undefined;
}

function modeTargets(mode) {
  for(let i=0;i<state.instances;i++){
    const a=i*.31,r=1.7+(i%11)*.065;
    if(mode===3)targets[i].set(((i%12)-5.5)*.38,(Math.floor(i/12)-5.5)*.3,Math.sin(i*.34)*.3);
    else if(mode===2)targets[i].set(Math.cos(a)*(.8+i*.014),Math.sin(a)*(.8+i*.014),(i/state.instances-.5)*4);
    else if(mode===0)targets[i].set(Math.cos(a)*r,Math.sin(a)*r*.2,Math.sin(a*.5)*r);
    else {const y=1-i/state.instances*2,p=Math.sqrt(1-y*y);targets[i].set(Math.cos(a)*p*2.1,y*2.1,Math.sin(a)*p*2.1);}
  }
}

function scroll() {
  state.cover=scrollY<innerHeight*.72;
  // Cover visibility and focus must agree before either GPU layer paints.
  document.body.dataset.cover=String(state.cover);
  const opticalNav=document.querySelector('.optical-nav');if(opticalNav)opticalNav.inert=state.cover;
  const wrongWindows=document.querySelector('.wrong-windows');if(wrongWindows)wrongWindows.inert=state.cover;
  const sections=[...document.querySelectorAll('[data-optical-section]')];
  let section=0;for(let i=0;i<sections.length;i++)if(sections[i].getBoundingClientRect().top<innerHeight*.4)section=i;
  if(section!==lastSection)lastSection=section;
  const mode=override??Number(sections[section]?.dataset.opticalSection??1);
  if(mode!==state.mode){state.mode=mode;modeTargets(mode);}
  document.body.dataset.reactorScene=String(mode);
  document.querySelector('#reactor-mode').textContent=String(mode+1).padStart(2,'0');
  dirty=true;wake();
}

function buildScroll() {
  context?.revert();view.explosion=0;view.dive=0;
  if(reduce.matches)return;
  context=gsap.context(()=>{
    gsap.to(view,{explosion:1,ease:'none',scrollTrigger:{trigger:'#systems',start:'top top',end:'bottom bottom',scrub:.65,onUpdate:()=>{dirty=true;}}});
    gsap.to('.cobalt-slash',{x:()=>innerWidth*.15,rotate:25,scrollTrigger:{trigger:'#systems',start:'top bottom',end:'bottom top',scrub:1}});
    gsap.fromTo('.reactor-guides',{scale:.92,rotate:-2},{scale:1.03,rotate:2,ease:'none',scrollTrigger:{trigger:'#ribbons',start:'top bottom',end:'bottom top',scrub:1}});
    gsap.to(view,{dive:1,ease:'none',scrollTrigger:{trigger:'#ribbons',start:'top 60%',end:'bottom top',scrub:.8,onUpdate:()=>{dirty=true;}}});
    gsap.fromTo('.collection-scene .specimen',{y:100,rotateY:-25},{y:0,rotateY:0,stagger:.045,ease:'none',scrollTrigger:{trigger:'#collection',start:'top bottom',end:'top 20%',scrub:.5}});
  });
}

function resize() {
  desktop = desktopView(innerWidth, innerHeight);
  state.desktopScale = desktop.effectScale;
  if(renderer){
    const cap=desktop.bufferCap || (innerWidth<700?1024:1920);
    const scale=Math.min(devicePixelRatio,1.7,cap/Math.max(innerWidth,innerHeight));
    const w=Math.max(1,Math.round(innerWidth*scale)),h=Math.max(1,Math.round(innerHeight*scale));
    renderer.setSize(w,h,false);composer.setSize(w,h);baseTarget.setSize(w,h);
    camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();state.pixelSize=[w,h];
  }
  dirty=true;wake();
}

function draw(dt) {
  if(!renderer||state.cover)return;
  const damping=reduce.matches?1:1-Math.exp(-dt*5);
  pointer.x+=(pointer.tx-pointer.x)*damping;pointer.y+=(pointer.ty-pointer.y)*damping;
  state.pointer={x:pointer.x,y:pointer.y};state.explosion=view.explosion;
  const t=reduce.matches?0:seconds;
  hand.kick*=reduce.matches?1:Math.exp(-dt*3.8);
  world.rotation.set(-.1+pointer.y*.09+hand.x,.15+pointer.x*.16+hand.y,Math.sin(t*.13)*.07);
  world.scale.setScalar((state.mode===3?.74:state.mode===2?.9:1)*desktop.effectScale);
  const dive=state.mode===2?view.dive:0;
  camera.position.z=(small?12.2:9.8)-dive*(small?3.2:3);
  camera.position.x=pointer.x*.15;camera.position.y=.12+pointer.y*.13;camera.lookAt(origin);camera.rotation.z=dive*.12;
  state.cameraZ=camera.position.z;state.dive=dive;
  const spread=1+view.explosion*.27+hand.kick*.24;
  core.rotation.set(t*.11,t*.16,t*.06);core.scale.setScalar(state.mode===3?.6:1+Math.sin(t*1.5)*.035);
  shell.rotation.set(-t*.08,t*.06,0);
  for(let i=0;i<knots.length;i++){
    const k=knots[i],b=k.userData.base;
    k.rotation.set(b.x+t*.12*(i%2?-1:1)+state.mode*.24,b.y+t*.08,b.z+t*.045);
    k.scale.setScalar(state.mode===2?1.1:1);
    k.position.y=(i-1)*view.explosion*.42;
  }
  for(let i=0;i<rings.length;i++){
    const r=rings[i],b=r.userData.base;
    const modeTilt=state.mode===2?Math.PI/2:state.mode===3?.1:0;
    r.rotation.set(b.x*.85+modeTilt,b.y*.8+Math.sin(t*.15+i)*.06,b.z+t*.09*(i%2?-1:1));
    r.position.z=(i-3.5)*(state.mode===2?.3:.035)*spread;
    r.scale.setScalar(state.mode===3?.65:spread);
  }
  ticks.rotation.z=-.35+t*.04;
  for(let i=0;i<state.instances;i++){
    current[i].lerp(targets[i],damping);
    dummy.position.copy(current[i]).multiplyScalar(spread);
    dummy.position.y+=Math.sin(t*.7+i*.53)*.025;
    dummy.rotation.set(i*.23+t*.12,i*.42+t*.08,i*.18);
    dummy.scale.setScalar(i%7===0?1.8:1);dummy.updateMatrix();tiles.setMatrixAt(i,dummy.matrix);
  }
  tiles.instanceMatrix.needsUpdate=true;
  for(const {tube,packet,curve,offset} of tubes){
    tube.scale.setScalar(state.mode===3?.75:spread);
    packet.position.copy(curve.getPointAt((t*.075+offset)%1)).multiplyScalar(state.mode===3?.75:spread);
  }
  dust.rotation.z=t*.016;dust.material.uniforms.uTime.value=t;dust.material.uniforms.uPointer.value.set(pointer.x,pointer.y);
  if(wave.visible){hand.progress=Math.min(1,hand.progress+(reduce.matches?0:dt*.85));wave.scale.setScalar(.18+hand.progress*3.6);wave.material.opacity=(1-hand.progress)*.76;wave.quaternion.copy(camera.quaternion);if(hand.progress>=1)wave.visible=false;}
  bloom.strength=(small?.25:.38)+hand.kick*.36;
  state.spin={x:world.rotation.x,y:world.rotation.y};state.waveScale=wave.visible?wave.scale.x:0;
  world.updateMatrixWorld(true);projected.setFromMatrixPosition(core.matrixWorld).project(camera);state.pickPoint={x:(projected.x+1)*innerWidth/2,y:(1-projected.y)*innerHeight/2};
  renderer.info.reset();
  composer.render(dt);
  state.frames++;state.elapsed=seconds;state.drawCalls=renderer.info.render.calls;state.triangles=renderer.info.render.triangles;
  state.gpuError=renderer.getContext().getError();
  document.querySelector('#reactor-draws').textContent=String(state.drawCalls).padStart(3,'0');
}

function frame(now) {
  raf=0;if(disposed||document.hidden)return;
  const elapsed=now-last;
  if(elapsed>=40||reduce.matches&&dirty){
    const dt=Math.min(elapsed/1000,.1);last=now;seconds+=reduce.matches?0:dt;
    if(dirty){scroll();dirty=false;}
    draw(dt);
  }
  if(renderer&&!state.cover&&!reduce.matches||dirty)wake();
}
function wake() {if(!raf&&!disposed&&!document.hidden)raf=requestAnimationFrame(frame);}

function aim(x,y){screenPoint.set(x/innerWidth*2-1,1-y/innerHeight*2);scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);raycaster.setFromCamera(screenPoint,camera);}
function impulse(detail={}){
  if(!renderer||state.cover)return;const x=Number.isFinite(detail.x)?detail.x:innerWidth*.5,y=Number.isFinite(detail.y)?detail.y:innerHeight*.5;
  aim(x,y);raycaster.ray.intersectPlane(plane,wavePoint);wave.position.copy(wavePoint);wave.position.z+=.1;wave.visible=true;hand.progress=reduce.matches?.62:0;hand.kick=Math.min(1.4,Math.max(.18,Number(detail.strength)||.8));state.pulses++;dirty=true;wake();
}
function turn(dx,dy){if(!Number.isFinite(dx)||!Number.isFinite(dy))return;hand.x+=dy*.008;hand.y+=dx*.008;state.turns++;dirty=true;wake();}
listen(window,'ocv:optical-turn',e=>turn(e.detail?.dx,e.detail?.dy));
listen(window,'ocv:optical-impulse',e=>impulse(e.detail));
listen(window,'ocv:optical-reset',()=>{hand.x=hand.y=hand.kick=0;hand.progress=1;if(wave)wave.visible=false;dirty=true;wake();});
listen(window,'pointerdown',e=>{
  if(e.button!==0||e.pointerType!=='mouse'||!renderer||state.cover||e.target.closest('a,button,input,select,textarea,summary,[role=button],[data-loose-window],[data-n3-kind],[data-w7-pane],.loose-lens'))return;
  aim(e.clientX,e.clientY);const hit=raycaster.intersectObjects([core,shell,tiles,...knots],false)[0];if(!hit)return;
  state.picks++;state.pickedInstance=hit.instanceId??null;state.pickedObject=hit.object===tiles?'tile':hit.object===core?'core':hit.object===shell?'glass':'knot';
  grabbed={id:e.pointerId,x:e.clientX,y:e.clientY};impulse({x:e.clientX,y:e.clientY,strength:.7});e.preventDefault();
});
listen(window,'pointermove',e=>{if(!grabbed||grabbed.id!==e.pointerId)return;turn(e.clientX-grabbed.x,e.clientY-grabbed.y);grabbed.x=e.clientX;grabbed.y=e.clientY;});
listen(window,'pointerup',()=>grabbed=null);listen(window,'pointercancel',()=>grabbed=null);listen(window,'blur',()=>grabbed=null);

listen(window,'scroll',scroll,{passive:true});listen(window,'resize',resize,{passive:true});
// Focus/anchor settling must not undo an explicit selection halfway through a click.
function automaticGeometry(){override=null;scroll();}
listen(window,'wheel',automaticGeometry,{passive:true});listen(window,'touchmove',automaticGeometry,{passive:true});
listen(window,'keydown',e=>{if(['PageDown','PageUp','Home','End',' '].includes(e.key)&&!e.target.closest('input,textarea,select,button,[role=button]'))automaticGeometry();});
document.querySelectorAll('a[href^="#"],a[href^="/#"]').forEach(a=>listen(a,'click',automaticGeometry));
listen(window,'pointermove',event=>{
  if(reduce.matches||event.pointerType==='touch')return;
  pointer.tx=event.clientX/innerWidth*2-1;pointer.ty=1-event.clientY/innerHeight*2;dirty=true;wake();
},{passive:true});
document.querySelectorAll('[data-geometry]').forEach(button=>listen(button,'click',()=>{
  scroll();override=Number(button.dataset.geometry);state.mode=override;modeTargets(override);scroll();
}));
listen(reduce,'change',()=>{state.reduced=reduce.matches;buildScroll();dirty=true;resize();});
listen(document,'visibilitychange',()=>{
  state.suspended=document.hidden;
  if(document.hidden){cancelAnimationFrame(raf);raf=0;gsap.ticker.sleep();}
  else{last=performance.now();gsap.ticker.wake();dirty=true;scroll();}
});
listen(canvas,'webglcontextlost',event=>{
  event.preventDefault();state.renderer='css';cancelAnimationFrame(raf);raf=0;renderer=undefined;
  if(!document.querySelector('.reactor-fallback')){const fallback=document.createElement('div');fallback.className='reactor-fallback';fallback.setAttribute('aria-hidden','true');document.body.prepend(fallback);}
});
listen(window,'pagehide',event=>{
  grabbed=null;
  cancelAnimationFrame(raf);raf=0;gsap.ticker.sleep();
  if(event.persisted)return;
  disposed=true;lifetime.abort();context?.revert();
  for(const value of geometries)value.dispose();for(const value of materials)value.dispose();
  baseTarget?.dispose();capture?.dispose();bloom?.dispose();output?.dispose();composer?.dispose();environmentTarget?.dispose();renderer?.dispose();
});
listen(window,'pageshow',()=>{gsap.ticker.wake();dirty=true;scroll();});
modeTargets(1);current.forEach((p,i)=>p.copy(targets[i]));buildScroll();scroll();resize();
