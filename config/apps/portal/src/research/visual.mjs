import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {buildAccent} from './accent-scenes.mjs';
import {mountAccentControls} from './accent-controls.mjs';
import {mountOverviewInteraction} from './overview-interaction.mjs';

const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const fragment=`precision highp float;varying vec2 vUv;uniform float time;uniform vec2 pointer;
 float band(float v,float w){return exp(-v*v/w);}
 void main(){vec2 p=vUv*2.-1.;p.x*=1.7;p+=pointer*.045;
 float f=0.;for(int i=0;i<7;i++){float k=float(i);float d=p.y*.85+p.x*.21+sin(p.x*1.4+time*.045+k*.45)*.26-k*.065+.16;f+=band(d,.00004)*(1.-k*.08);}
 vec3 c=vec3(.1,.38,.36)*f*.75;float halo=exp(-length(p-vec2(.7,.1))*1.5);c+=vec3(.015,.042,.057)*halo;
 float grid=step(.986,fract(vUv.x*82.))+step(.994,fract(vUv.y*46.));c+=grid*vec3(.007,.019,.024);
 gl_FragColor=vec4(c,1.);}`;
export function mountVisuals(background,hero){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;let frame=0,disposed=false,last=-Infinity,renderedFrames=0,accent=null,controls=null,cameraBase=null,overview=null,overviewLattice=null,overviewBases=[];
 const renderers=[],geometries=[],materials=[],uniforms={time:{value:0},pointer:{value:new THREE.Vector2()}},started=performance.now();
 let bgRenderer,bgScene,bgCamera,renderer,scene,camera,composer,field,particles,halo;
 try{
  if(background){bgRenderer=new THREE.WebGLRenderer({canvas:background,alpha:true,antialias:false,powerPreference:'low-power'});bgRenderer.setPixelRatio(1);bgScene=new THREE.Scene();bgCamera=new THREE.Camera();const geometry=new THREE.PlaneGeometry(2,2),material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms});geometries.push(geometry);materials.push(material);bgScene.add(new THREE.Mesh(geometry,material));renderers.push(bgRenderer);}
  if(hero){
   hero.dataset.renderMode='initializing';hero.dataset.renderedFrames='0';
   renderer=new THREE.WebGLRenderer({canvas:hero,alpha:true,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setClearColor(0x000000,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderers.push(renderer);
   scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(36,1,.1,100);camera.position.set(8.8,8,12.8);camera.lookAt(0,0,0);scene.add(new THREE.AmbientLight(0xa5bec8,1.5));
   for(const [color,power,x,y,z] of [[0x94ffe0,32,1,7,4],[0xaa81ff,38,-6,4,-3],[0xbedafa,15,5,1,-5]]){const light=new THREE.PointLight(color,power,35);light.position.set(x,y,z);scene.add(light);}
   field=new THREE.Group();field.rotation.y=-.26;scene.add(field);
   if(hero.dataset.researchScene){accent=buildAccent(hero.dataset.researchScene,field,geometries,materials);camera.position.multiplyScalar(.79);camera.fov=32;cameraBase=camera.position.clone();}
   else{
   const cube=new THREE.BoxGeometry(.41,.1,.88),body=new THREE.MeshPhysicalMaterial({color:0x82b9b2,metalness:.32,roughness:.26,emissive:0x1e5c56,emissiveIntensity:.27,clearcoat:1,clearcoatRoughness:.2});geometries.push(cube);materials.push(body);
   const lattice=new THREE.InstancedMesh(cube,body,162),dummy=new THREE.Object3D(),color=new THREE.Color();let n=0;
   for(let layer=0;layer<2;layer++)for(let z=0;z<9;z++)for(let x=0;x<9;x++){
    const radius=Math.hypot(x-4,z-4),wave=Math.sin(x*.67+z*.58+layer*2)*.14;
    dummy.position.set((x-4)*.5,layer*1.02+wave+(radius<2.5?.33:0)-.7,(z-4)*.51);dummy.rotation.set(0,(x+z)%3?0:Math.PI/2,0);dummy.scale.set(1,1+layer*.3,1);dummy.updateMatrix();lattice.setMatrixAt(n,dummy.matrix);
    color.set((x+z+layer)%6===0?0xc192ff:(x+z)%4===0?0xbaf6e2:0x62cbb9);lattice.setColorAt(n++,color);
    overviewBases.push({x:dummy.position.x,y:dummy.position.y,z:dummy.position.z,rotation:dummy.rotation.y,scale:dummy.scale.y,color:color.clone()});
   }lattice.instanceMatrix.needsUpdate=true;field.add(lattice);
   overviewLattice=lattice;
   const floor=new THREE.GridHelper(8.8,22,0x437b7b,0x173a46);floor.position.y=-1.45;floor.material.transparent=true;floor.material.opacity=.46;field.add(floor);geometries.push(floor.geometry);materials.push(floor.material);
   const edgeGeometry=new THREE.EdgesGeometry(new THREE.BoxGeometry(5.1,2.15,5.1)),edgeMaterial=new THREE.LineBasicMaterial({color:0x77bcb9,transparent:true,opacity:.26});geometries.push(edgeGeometry);materials.push(edgeMaterial);field.add(new THREE.LineSegments(edgeGeometry,edgeMaterial));
   }
   halo=new THREE.Group();field.add(halo);
   for(let i=0;i<3;i++){const geometry=new THREE.TorusGeometry(3.42+i*.17,.009,6,160),material=new THREE.MeshBasicMaterial({color:i===1?0x927fcc:0x73beb0,transparent:true,opacity:.35});geometries.push(geometry);materials.push(material);const ring=new THREE.Mesh(geometry,material);ring.rotation.set(Math.PI/2+i*.2,.26+i*.31,i*.4);halo.add(ring);}
   const positions=new Float32Array(1600*3),colors=new Float32Array(1600*3),particleColor=new THREE.Color();let seed=91273;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
   for(let i=0;i<1600;i++){const angle=random()*Math.PI*2,r=2.8+random()*2.6;positions[i*3]=Math.cos(angle)*r;positions[i*3+1]=(random()-.5)*5.8;positions[i*3+2]=Math.sin(angle)*r;particleColor.set(i%5?0x7eb7b5:0xbb91df);particleColor.toArray(colors,i*3);}
   const pGeometry=new THREE.BufferGeometry();pGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));pGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));const pMaterial=new THREE.PointsMaterial({size:.017,vertexColors:true,transparent:true,opacity:.75,sizeAttenuation:true,depthWrite:false});geometries.push(pGeometry);materials.push(pMaterial);particles=new THREE.Points(pGeometry,pMaterial);scene.add(particles);
   composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new THREE.Vector2(600,600),.2,.5,.95));
  }
 }catch(error){hero?.setAttribute('data-render-mode','fallback');console.info('Research graphics use the static fallback on this device.');}
 const resize=()=>{if(disposed)return;if(bgRenderer)bgRenderer.setSize(Math.min(innerWidth,1100),Math.min(innerHeight,800),false);if(renderer&&hero){const {width,height}=hero.getBoundingClientRect();if(width>0&&height>0){renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();composer?.setSize(width,height);}}};
 const pointer=event=>uniforms.pointer.value.set((event.clientX/innerWidth-.5)*2,(event.clientY/innerHeight-.5)*2);
 window.addEventListener('resize',resize);window.addEventListener('pointermove',pointer,{passive:true});resize();
 const observer=hero?new ResizeObserver(()=>{resize();if(reduced&&!frame&&!disposed)frame=requestAnimationFrame(draw);}):null;
 const draw=stamp=>{if(disposed)return;frame=requestAnimationFrame(draw);if(document.hidden||stamp-last<34)return;const elapsed=Math.min(.1,Number.isFinite(last)?(stamp-last)/1000:0);last=stamp;const t=Math.max(0,(stamp-started)/1000);uniforms.time.value=t;
  if(bgRenderer)bgRenderer.render(bgScene,bgCamera);
  if(renderer&&hero&&scene&&field&&particles&&halo&&composer){const bounds=hero.getBoundingClientRect();if(bounds.width>0&&bounds.height>0&&bounds.bottom>0&&bounds.top<innerHeight&&!renderer.getContext().isContextLost()){
   const s=controls?.state;
   field.rotation.y=s?-.26+Math.sin(t*.09)*.08+s.x*.13+s.yaw:-.26;field.rotation.x=s?s.y*.05+s.pitch:0;
   if(s){camera.position.copy(cameraBase).multiplyScalar(1/s.zoom);camera.lookAt(0,0,0);accent.animate(t,s);if(!reduced)s.energy*=Math.exp(-elapsed*1.4);hero.dataset.viewYaw=String(s.yaw);hero.dataset.zoom=String(s.zoom);hero.dataset.expanded=String(s.expanded);}
   overview?.update(stamp,reduced);particles.rotation.y=accent?t*.018:0;halo.rotation.y=accent?t*.022:0;composer.render();hero.dataset.renderMode='webgl';hero.dataset.renderedFrames=String(++renderedFrames);
  }}
  if(reduced){cancelAnimationFrame(frame);frame=0;}
 };
 if(overviewLattice)overview=mountOverviewInteraction(hero,camera,field,overviewLattice,overviewBases,geometries,materials,()=>{if(reduced&&!frame&&!disposed)frame=requestAnimationFrame(draw);});
 if(accent){
  const wrapper=hero.closest('.research-accent'),inspector=wrapper?.querySelector('.accent-inspector'),input=wrapper?.querySelector('[data-accent-documents]');
  if(input&&inspector){const docs=JSON.parse(input.textContent);accent.select=index=>{inspector.hidden=index<0;if(index>=0){const doc=docs[index%docs.length];inspector.querySelector('[data-accent-document-title]').textContent=doc.title;inspector.querySelector('[data-accent-document-link]').href=doc.url;}};}
  controls=mountAccentControls(hero,camera,accent,()=>{if(reduced&&!frame&&!disposed)frame=requestAnimationFrame(draw);});
 }
 observer?.observe(hero);
 if(renderers.length)frame=requestAnimationFrame(draw);
 return()=>{disposed=true;cancelAnimationFrame(frame);observer?.disconnect();controls?.dispose();overview?.dispose();window.removeEventListener('resize',resize);window.removeEventListener('pointermove',pointer);for(const material of materials)material.dispose();for(const geometry of geometries)geometry.dispose();composer?.passes.forEach(pass=>pass.dispose?.());composer?.dispose();for(const item of renderers){item.dispose();item.forceContextLoss();}};
}
