import * as THREE from 'three';
import {gsap} from 'gsap';
const canvas=document.querySelector('.light-circuit'),life=new AbortController(),reduce=matchMedia('(prefers-reduced-motion:reduce)');
let renderer,frame=0,last=0,disposed=false;
const hand={x:0,y:0,kick:0};
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(46,1,.1,100);camera.position.z=7;
const geometry=new THREE.BoxGeometry(.065,.065,.065),material=new THREE.MeshBasicMaterial({color:0x57aaff,wireframe:true}),nodes=new THREE.InstancedMesh(geometry,material,320),matrix=new THREE.Matrix4();
for(let i=0;i<320;i++){const a=i*.213,r=1+(i%11)*.18;matrix.makeTranslation(Math.cos(a)*r,Math.sin(a)*r,(i%7)*.12);nodes.setMatrixAt(i,matrix);}scene.add(nodes);
const stats=window.__ocvLight={renderer:'css',frames:0,instances:320,turns:0,pulses:0,spin:{x:0,y:0},scale:1,gpuError:0};
try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});stats.renderer='three-webgl2';}catch{canvas.style.background='repeating-linear-gradient(90deg,transparent 0 30px,#245583 31px 32px)';}
function paint(now){frame=0;if(disposed||document.hidden||!renderer)return;if(now-last>60||reduce.matches){hand.kick*=reduce.matches?1:Math.exp(-Math.min(.15,(now-last)/1000)*3);nodes.rotation.z=reduce.matches ? .1 : now*.00005;nodes.rotation.x=hand.x;nodes.rotation.y=(reduce.matches ? .2 : Math.sin(now*.0001)*.3)+hand.y;nodes.scale.setScalar(1+hand.kick*.3);material.color.setHex(hand.kick>.1?0x2173ff:0x57aaff);renderer.render(scene,camera);stats.frames++;stats.spin={x:nodes.rotation.x,y:nodes.rotation.y};stats.scale=nodes.scale.x;stats.gpuError=renderer.getContext().getError();last=now;}if(!reduce.matches)frame=requestAnimationFrame(paint);}
function resize(){if(!renderer)return;const {width,height}=canvas.getBoundingClientRect(),ratio=Math.min(1,960/Math.max(width,height));renderer.setSize(width*ratio,height*ratio,false);camera.aspect=width/height;camera.updateProjectionMatrix();cancelAnimationFrame(frame);paint(performance.now());}
const tween=gsap.to('.light-scan',{scaleX:.1,x:210,duration:4,yoyo:true,repeat:-1,ease:'sine.inOut',paused:reduce.matches});
const on=(el,event,fn)=>el.addEventListener(event,fn,{signal:life.signal});on(window,'resize',resize);
function wake(){cancelAnimationFrame(frame);frame=0;last=0;if(!document.hidden)paint(performance.now());}
on(window,'ocv:optical-turn',e=>{const {dx,dy}=e.detail||{};if(!Number.isFinite(dx)||!Number.isFinite(dy))return;hand.x+=dy*.008;hand.y+=dx*.008;stats.turns++;wake();});
on(window,'ocv:optical-impulse',e=>{hand.kick=Math.min(1.4,Math.max(.18,Number(e.detail?.strength)||.8));stats.pulses++;wake();});
on(window,'ocv:optical-reset',()=>{hand.x=hand.y=hand.kick=0;wake();});
on(document,'visibilitychange',()=>{cancelAnimationFrame(frame);document.hidden?tween.pause():(reduce.matches?tween.pause():tween.play());if(!document.hidden)paint(performance.now());});on(reduce,'change',()=>{reduce.matches?tween.pause():tween.play();resize();});
on(window,'pagehide',event=>{cancelAnimationFrame(frame);tween.pause();if(!event.persisted){disposed=true;life.abort();tween.kill();geometry.dispose();material.dispose();renderer?.dispose();}});on(window,'pageshow',()=>{if(!reduce.matches)tween.play();resize();});resize();
