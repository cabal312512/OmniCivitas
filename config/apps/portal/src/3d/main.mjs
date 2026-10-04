import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {createWorld} from './world.mjs';
import {WORLD_SIZE,SPAWN,heightAt,riverShapeAt} from './terrain.mjs';
import {createPlayer,stepPlayer,EYE_HEIGHT,clamp,createCycle} from './model.mjs';
import {createEntities} from './entities.mjs';
import {createSound} from './audio.mjs';
import {createCheckpointStore} from './save.mjs';
import {createTower} from './tower.mjs';
import {createBoss} from './boss.mjs';
import {createMedalStore,downloadMedal} from './medal.mjs';
import {createMusic} from './music.mjs';
import {createEncounters} from './encounters.mjs';

const canvas=document.querySelector('#world'),body=document.body,frameElement=document.querySelector('#aero-window'),life=new AbortController();
const viewport=()=>({width:Math.max(1,frameElement.clientWidth),height:Math.max(1,frameElement.clientHeight)});
const on=(target,type,fn,options={})=>target.addEventListener(type,fn,{...options,signal:life.signal});
const sound=createSound(),reduce=matchMedia('(prefers-reduced-motion:reduce)'),keys=new Set();
const music=createMusic({root:frameElement});
const hud={travel:document.querySelector('[data-travel]'),save:document.querySelector('[data-save]'),health:document.querySelector('.aero-health'),fill:document.querySelector('.aero-health i'),orbs:[...document.querySelectorAll('.aero-orbs i')]},hudValues=new Map();
const hudWrites={travel:value=>hud.travel.dataset.ready=String(value),resting:value=>{hud.save.dataset.ready=String(value);hud.save.disabled=!value;body.dataset.resting=String(value);},saved:value=>body.dataset.saved=String(value),hurt:value=>body.style.setProperty('--hurt',value),warp:value=>body.style.setProperty('--warp',value),hit:value=>body.dataset.hit=String(value),health:value=>hud.fill.style.transform=`scaleX(${value})`,healthPercent:value=>hud.health.setAttribute('aria-valuenow',String(value)),found:value=>hud.orbs.forEach((el,i)=>el.classList.toggle('on',i<value))};
function changed(key,value){if(hudValues.get(key)===value)return;hudValues.set(key,value);hudWrites[key](value);}
const altKeys=new Set();let cursorHeld=false,restoreLockAfterAlt=false;
let renderer,world,entities,encounters,tower,boss,medalStore,composer,raf=0,disposed=false,paused=document.hidden,mode='initializing',frames=0,last=0,time=0,yaw=0,pitch=0,shootWait=0,shots=0,hits=0,warps=0,respawns=0,hitTime=0,hurt=0,warp=1,bob=0,recoil=0,jump=false,heldFire=false,drag=null,portalWait=0,victoryOpen=false,completionShown=false;
const ground=(x,z,referenceY)=>Math.max(world?.groundAt?.(x,z,referenceY)??heightAt(x,z),riverShapeAt(x,z).mask>.45?4.2:-1000);
const player=createPlayer(SPAWN.x,SPAWN.z,ground),cycle=createCycle(8),direction=new THREE.Vector3(),origin=new THREE.Vector3(),ray=new THREE.Raycaster();
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(72,viewport().width/viewport().height,.075,10000);camera.rotation.order='YXZ';scene.add(camera);
const view=new THREE.Vector3(),gateGroups=[],beams=[];
let portalGeometry,portalMaterial,beamGeometry,beamMaterial,weaponGeometry,weaponMaterial,weaponGroup,bloom,renderPass,outputPass,ao,grade,muted=false;
let saveStore,checkpointId=null,saveFlash=0,healed=0,damageTaken=0,saveRestores=0;
const diagnostics={snapshot:()=>({mode,disposed,paused,frames,time,shots,hits,warps,respawns,yaw,pitch,eyeHeight:EYE_HEIGHT,viewport:{...viewport(),fullscreen:document.fullscreenElement===frameElement},player:{...player},position:{x:camera.position.x,y:camera.position.y,z:camera.position.z},locked:document.pointerLockElement===canvas,cursorHeld,controls:cursorHeld?'cursor':document.pointerLockElement===canvas?'locked':'drag',world:world?JSON.parse(JSON.stringify(world.stats)):null,tower:tower?.snapshot(),boss:boss?.snapshot(),medal:medalStore?.snapshot(),victoryOpen,completionShown,entities:entities?.snapshot(),encounters:encounters?.snapshot(),cycle:cycle.count,portals:gateGroups.map(g=>({id:g.id,x:g.group.position.x,y:g.group.position.y,z:g.group.position.z})),checkpoint:{id:checkpointId,healed,damageTaken,restores:saveRestores,resting:nearestStation()?.id??null,store:saveStore?.snapshot(),stations:(world?.restStations??[]).map(s=>({id:s.id,x:s.position.x,y:s.position.y,z:s.position.z,radius:s.radius}))},audio:sound.snapshot(),music:music.snapshot(),renderer:renderer?{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,shadows:renderer.shadowMap.enabled,contactAO:Boolean(ao),glassTransmission:weaponMaterial?.transmission}:null})};
// Read-only live coordinates avoid copying the entire city and road graph for aiming.
diagnostics.tracking=()=>({frames,time,shots,hits,warps,respawns,yaw,pitch,player:{...player},position:{x:camera.position.x,y:camera.position.y,z:camera.position.z},entities:{npcs:entities?.npcTracking()??[]},encounters:encounters?.tracking(),boss:boss?.snapshot(),checkpoint:{id:checkpointId,resting:nearestStation()?.id??null}});
Object.defineProperty(window,'__ocv3D',{value:diagnostics,configurable:true});

function init(){
 const size=viewport();renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(size.width,size.height);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.info.autoReset=false;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const landscape=createWorld(scene);tower=createTower(scene);
 // Tower platforms share X/Z across twelve windings. Keep the landscape's
 // station array separate so high checkpoints cannot raise ground terrain.
 world={...landscape,landmarks:[...landscape.landmarks,...tower.landmarks],restStations:[...landscape.restStations,...tower.restStations],
  groundAt(x,z,referenceY){const floor=landscape.groundAt(x,z,referenceY),ramp=tower.groundAt(x,z,Number.isFinite(referenceY)?referenceY:floor);return ramp===null?floor:Math.max(floor,ramp);},
  isBlocked(x,z,radius,y){return landscape.isBlocked(x,z,radius,y)||tower.isBlocked(x,z,radius,Number.isFinite(y)?y:landscape.groundAt(x,z));},
  obstructRay(start,dir,distance){return Math.min(landscape.obstructRay(start,dir,distance),tower.obstructRay(start,dir,distance));},
  update(position,elapsed,dt){landscape.update(position,elapsed,dt);tower.update(elapsed,dt,player,reduce.matches);},
  dispose(){tower.dispose();landscape.dispose();}};
 world.stats.restStations=world.restStations.length;
 let storage=null;try{storage=window.localStorage;}catch{/* In-memory progress works when persistence is refused. */}
 medalStore=createMedalStore(storage);medalStore.read();saveStore=createCheckpointStore(storage,world.restStations.map(s=>s.id),95);restoreCheckpoint();world.update(new THREE.Vector3(player.x,player.y,player.z),0,0);entities=createEntities(scene,world.landmarks,ground,world.isBlocked,world.stats.cityRecords);encounters=createEncounters(scene,{world,ground,isBlocked:world.isBlocked});boss=createBoss(scene);
 composer=new EffectComposer(renderer);renderPass=new RenderPass(scene,camera);ao=new SSAOPass(scene,camera,size.width,size.height,12);ao.kernelRadius=2.4;ao.minDistance=.00002;ao.maxDistance=.003;bloom=new UnrealBloomPass(new THREE.Vector2(size.width,size.height),.2,.45,1.12);outputPass=new OutputPass();
 grade=new ShaderPass({uniforms:{tDiffuse:{value:null},time:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform sampler2D tDiffuse;uniform float time;varying vec2 vUv;void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float noise=fract(sin(dot(vUv+time*.00001,vec2(12.9898,78.233)))*43758.5453)-.5;float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,1.065);c=(c-.5)*1.045+.5;gl_FragColor=vec4(c+noise*.006,1.);}'});
 composer.addPass(renderPass);composer.addPass(ao);composer.addPass(bloom);composer.addPass(outputPass);composer.addPass(grade);ao.setSize(Math.round(size.width*.65),Math.round(size.height*.65));
 createPortals();createWeapon();createBeams();mode='webgl';positionCamera(0,0);render();start();
}
function createPortals(){
 portalGeometry=new THREE.TorusGeometry(2.55,.115,10,56);portalMaterial=new THREE.MeshStandardMaterial({color:0xbbfff0,emissive:0x47edba,emissiveIntensity:1.5,metalness:.25,roughness:.15});
 function landing(l){const station=world.restStations?.find(s=>s.landmarkId===l.id&&s.gatePosition);if(station)return{id:l.id,position:new THREE.Vector3(station.gatePosition.x,ground(station.gatePosition.x,station.gatePosition.z),station.gatePosition.z)};for(let radius=0;radius<=150;radius+=5)for(let j=0;j<(radius?12:1);j++){const angle=j*Math.PI/6,x=l.position.x+15+Math.cos(angle)*radius,z=l.position.z+32+Math.sin(angle)*radius;if(!world.isBlocked(x,z,4)&&!world.isBlocked(x,z+6,1))return{id:l.id,position:new THREE.Vector3(x,ground(x,z),z)};}return{id:l.id,position:new THREE.Vector3(l.position.x,ground(l.position.x,l.position.z),l.position.z)};}
 const destinations=[{id:'avenue',position:new THREE.Vector3(0,ground(0,166),166)},...world.landmarks.filter(l=>l.id!=='avenue').map(landing)];
 for(const [i,p]of destinations.entries()){const group=new THREE.Group(),ring=new THREE.Mesh(portalGeometry,portalMaterial);ring.position.y=2.8;group.position.copy(p.position);group.add(ring);scene.add(group);gateGroups.push({id:p.id,group,ring,index:i});}
}
function createWeapon(){
 weaponGroup=new THREE.Group();camera.add(weaponGroup);weaponGroup.position.set(.36,-.29,-.72);weaponGroup.scale.setScalar(.62);
 weaponGeometry=new THREE.TorusGeometry(.088,.017,12,48);weaponMaterial=new THREE.MeshPhysicalMaterial({color:0xe6f8ff,metalness:.04,roughness:.027,clearcoat:1,transmission:.82,thickness:.07,ior:1.35,envMapIntensity:1.45,emissive:0x2cbded,emissiveIntensity:.025});
 for(let i=0;i<3;i++){const ring=new THREE.Mesh(weaponGeometry,weaponMaterial);ring.position.z=i*-.075;ring.rotation.z=i*.5;weaponGroup.add(ring);}
 const sphere=new THREE.Mesh(new THREE.IcosahedronGeometry(.052,2),new THREE.MeshBasicMaterial({color:0xc7ffef}));sphere.position.z=-.26;weaponGroup.add(sphere);
}
function createBeams(){
 beamGeometry=new THREE.CylinderGeometry(.023,.023,1,6);beamGeometry.rotateX(Math.PI/2);beamMaterial=new THREE.MeshBasicMaterial({color:0xc5fffb,transparent:true,opacity:.75,depthWrite:false});
 for(let i=0;i<24;i++){const mesh=new THREE.Mesh(beamGeometry,beamMaterial);mesh.visible=false;scene.add(mesh);beams.push({mesh,life:0});}
}
function positionCamera(dt,speed){
 if(!reduce.matches)bob+=dt*speed*(player.grounded?1.3:.1);
 camera.position.set(player.x,player.y+EYE_HEIGHT+(reduce.matches?0:Math.sin(bob)*Math.min(.037,speed*.003)),player.z);camera.rotation.set(pitch,yaw,0);
 if(weaponGroup){weaponGroup.position.y=-.29+(reduce.matches?0:Math.sin(bob)*.008);weaponGroup.position.z=-.72+recoil*.15;weaponGroup.rotation.z=reduce.matches?0:Math.sin(bob*.5)*.02;}
}
function obstruction(distance){
 // Check the actual visible settlement footprints and terrain before accepting a hit.
 let nearest=world.obstructRay(origin,direction,distance);for(let d=1;d<nearest;d+=.6){view.copy(direction).multiplyScalar(d).add(origin);if(view.y<(world.groundAt(view.x,view.z,view.y)??heightAt(view.x,view.z))+.08)return d;}return nearest;
}
function shoot(){
 if(disposed||paused||victoryOpen||mode!=='webgl'||performance.now()<shootWait)return;
 sound.unlock();sound.shot();shootWait=performance.now()+220;shots++;recoil=1;
 camera.getWorldDirection(direction);origin.copy(camera.position);ray.set(origin,direction);ray.far=360;
 const intersection=ray.intersectObjects([...entities.targets(),...boss.targets(),...encounters.targets()],false)[0],distance=obstruction(intersection?.distance||360);
 const hit=intersection&&distance>=intersection.distance-.1&&(boss.hit(intersection.object,time)||entities.hit(intersection.object,time)||encounters.hit(intersection.object,time,intersection.instanceId));
 if(hit){hits++;hitTime=.13;sound.hit();}
 const beam=beams.find(b=>b.life<=0)||beams[shots%beams.length];beam.life=.105;beam.mesh.visible=true;beam.mesh.position.copy(origin).addScaledVector(direction,distance*.5);beam.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);beam.mesh.scale.set(1,1,distance);
}
function nearestPortal(){return gateGroups.find(g=>Math.hypot(player.x-g.group.position.x,player.z-g.group.position.z)<8&&Math.abs(player.y-g.group.position.y)<4);}
function nearestStation(){return world?.restStations?.find(s=>Math.hypot(player.x-s.position.x,player.z-s.position.z)<s.radius&&Math.abs(player.y-s.position.y)<4);}
function placeAtStation(station){
 if(world.isBlocked(station.position.x,station.position.z,.6,station.position.y))return false;
 player.x=station.position.x;player.z=station.position.z;player.y=ground(player.x,player.z,station.position.y);player.vy=0;player.grounded=true;return true;
}
function restoreCheckpoint(){
 const progress=saveStore.read();if(!progress)return;
 const station=world.restStations.find(s=>s.id===progress.checkpoint);if(!station||!placeAtStation(station))return;
 checkpointId=station.id;player.health=progress.health;player.energy=progress.energy;for(const id of progress.found)cycle.add(id);saveRestores++;
}
function saveCheckpoint(){
 if(disposed||paused||victoryOpen||mode!=='webgl')return;const station=nearestStation();if(!station)return;
 const saved=saveStore.write({version:1,checkpoint:station.id,found:cycle.values(),health:Math.max(.05,player.health),energy:player.energy});
 if(saved){checkpointId=station.id;saveFlash=1.8;sound.unlock();sound.collect();}
}
function travel(){
 const gate=nearestPortal();if(!gate||performance.now()<portalWait||disposed||victoryOpen||mode!=='webgl')return;
 const target=gateGroups[(gate.index+1)%gateGroups.length];player.x=target.group.position.x;player.z=target.group.position.z+6;player.y=ground(player.x,player.z);player.vy=0;player.grounded=true;yaw=0;pitch=0;warp=1;portalWait=performance.now()+1200;warps++;sound.unlock();sound.portal();world.update(new THREE.Vector3(player.x,player.y,player.z),time,0);positionCamera(0,0);
}
function recover(){if(disposed||victoryOpen||mode!=='webgl')return;const station=world.restStations?.find(s=>s.id===checkpointId);if(!station||!placeAtStation(station)){player.x=SPAWN.x;player.z=SPAWN.z;player.y=ground(player.x,player.z);}player.vy=0;player.health=1;player.energy=1;player.grounded=true;yaw=0;pitch=0;warp=1;portalWait=performance.now()+1000;respawns++;keys.clear();world.update(new THREE.Vector3(player.x,player.y,player.z),time,0);positionCamera(0,0);sound.portal();}
function openVictory(){
 if(completionShown||disposed)return;completionShown=true;medalStore.unlock();victoryOpen=true;stop();
 if(document.pointerLockElement===canvas)document.exitPointerLock();
 const popup=document.querySelector('[data-aero-victory]');popup.hidden=false;body.dataset.completed='true';popup.querySelector('[data-victory-download]').focus({preventScroll:true});
}
function closeVictory(){if(!victoryOpen)return;document.querySelector('[data-aero-victory]').hidden=true;victoryOpen=false;canvas.focus({preventScroll:true});start();}
function damage(value){if(disposed||nearestStation())return;const before=player.health;player.health=clamp(player.health-value,0,1);damageTaken+=before-player.health;hurt=.7;sound.damage();if(player.health<=0)recover();}
function render(){if(renderer&&!disposed){renderer.info.reset();grade.uniforms.time.value=reduce.matches?0:time;composer.render();frames++;}}
function frame(timestamp){
 if(disposed||paused||victoryOpen)return;raf=requestAnimationFrame(frame);const dt=last?Math.min((timestamp-last)/1000,.08):0;last=timestamp;time+=dt;
 const prevX=player.x,prevZ=player.z;
 const input={forward:Number(keys.has('KeyW'))-Number(keys.has('KeyS')),strafe:Number(keys.has('KeyD'))-Number(keys.has('KeyA')),sprint:keys.has('ShiftLeft')||keys.has('ShiftRight'),jump,yaw};jump=false;
 if(keys.has('ArrowLeft'))yaw+=dt*1.15;if(keys.has('ArrowRight'))yaw-=dt*1.15;if(keys.has('ArrowUp'))pitch=clamp(pitch+dt,-1.35,1.35);if(keys.has('ArrowDown'))pitch=clamp(pitch-dt,-1.35,1.35);
 stepPlayer(player,input,dt,ground,world.isBlocked,WORLD_SIZE/2);
 tower.recoverPlayer?.(player);
 const speed=dt?Math.hypot(player.x-prevX,player.z-prevZ)/dt:0;positionCamera(dt,speed);
 world.update(camera.position,reduce.matches?0:time,reduce.matches?0:dt);entities.update(player,time,dt,damage,reduce.matches,world.obstructRay);encounters.update(player,time,dt,damage,reduce.matches,world.obstructRay);boss.update(player,time,dt,damage,reduce.matches,world.obstructRay);
 const found=entities.collect(player,time);for(const id of found){if(id>=0&&id<=95)cycle.add(id);player.health=Math.min(1,player.health+.2);sound.collect();}
 const supplies=encounters.collect(player,time);if(supplies>0){player.health=Math.min(1,player.health+supplies);sound.collect();}
 const station=nearestStation();if(station){const before=player.health;player.health=Math.min(1,player.health+dt*.14);healed+=player.health-before;}
 saveFlash=Math.max(0,saveFlash-dt);hitTime=Math.max(0,hitTime-dt);recoil=Math.max(0,recoil-dt*7);hurt=Math.max(0,hurt-dt);warp=Math.max(0,warp-dt*1.8);
 if(heldFire)shoot();
 for(const beam of beams){beam.life-=dt;if(beam.life<=0)beam.mesh.visible=false;}
 for(const gate of gateGroups){gate.ring.rotation.z=reduce.matches?0:time*.08;gate.ring.scale.setScalar(cycle.complete?1.12:1);}
 changed('travel',Boolean(nearestPortal()));changed('resting',Boolean(station));changed('saved',saveFlash>0);changed('hurt',hurt.toFixed(3));changed('warp',warp.toFixed(3));changed('hit',hitTime>0);
 changed('health',player.health);changed('healthPercent',Math.round(player.health*100));changed('found',cycle.count);
 sound.update({speed,grounded:player.grounded,water:riverShapeAt(player.x,player.z).mask>.45},dt);render();if(boss.isDefeated)openVictory();
}
function start(){if(disposed||paused||victoryOpen||mode!=='webgl')return;last=0;if(!raf)raf=requestAnimationFrame(frame);sound.resume();void music.resume();}
function releaseCursor(restore=false){const relock=restore&&restoreLockAfterAlt;cursorHeld=false;restoreLockAfterAlt=false;altKeys.clear();body.dataset.cursor='false';if(relock&&!paused&&!disposed&&!victoryOpen)capture();}
function showCursor(code){altKeys.add(code);if(cursorHeld)return;restoreLockAfterAlt=document.pointerLockElement===canvas;cursorHeld=true;keys.clear();heldFire=false;drag=null;jump=false;body.dataset.cursor='true';if(restoreLockAfterAlt)document.exitPointerLock();}
function stop(){if(raf)cancelAnimationFrame(raf);raf=0;last=0;keys.clear();heldFire=false;drag=null;jump=false;releaseCursor();sound.suspend();music.pause();}
function look(dx,dy){if(cursorHeld)return;yaw-=dx*.0021;pitch=clamp(pitch-dy*.0021,-1.35,1.35);}
function capture(){
 if(victoryOpen||cursorHeld)return;
 sound.unlock();void music.unlock();canvas.focus({preventScroll:true});
 if(document.pointerLockElement===canvas)return;
 try{const result=canvas.requestPointerLock?.();result?.catch?.(()=>{mode='webgl';});}catch{mode='webgl';}
}
async function full(){sound.unlock();void music.unlock();try{if(document.fullscreenElement)await document.exitFullscreen();else await frameElement.requestFullscreen();}catch{/* Keep native window play available. */}}
function dispose(){
 if(disposed)return;stop();disposed=true;mode='disposed';life.abort();sizeObserver.disconnect();sound.dispose();music.dispose();if(document.pointerLockElement===canvas)document.exitPointerLock();
 world?.dispose();entities?.dispose();encounters?.dispose();boss?.dispose();for(const gate of gateGroups)gate.group.removeFromParent();for(const beam of beams)beam.mesh.removeFromParent();
 portalGeometry?.dispose();portalMaterial?.dispose();beamGeometry?.dispose();beamMaterial?.dispose();weaponGeometry?.dispose();weaponMaterial?.dispose();if(weaponGroup){const sphere=weaponGroup.children.at(-1);sphere.geometry.dispose();sphere.material.dispose();}bloom?.dispose();renderPass?.dispose?.();outputPass?.dispose();if(ao){ao.dispose();ao.ssaoMaterial.dispose();ao.noiseTexture.dispose();}grade?.dispose();composer?.dispose();renderer?.dispose();renderer?.forceContextLoss();
}
on(canvas,'pointerdown',e=>{if(e.button!==0&&e.button!==2||cursorHeld||victoryOpen)return;drag={x:e.clientX,y:e.clientY};if(e.button===0){capture();shoot();heldFire=true;}else{sound.unlock();void music.unlock();canvas.focus({preventScroll:true});}});
on(window,'pointerup',()=>{heldFire=false;drag=null;});on(canvas,'pointercancel',()=>{heldFire=false;drag=null;});on(canvas,'contextmenu',e=>e.preventDefault());
on(canvas,'pointermove',e=>{if(document.pointerLockElement===canvas)look(e.movementX,e.movementY);else if(e.buttons&&drag){look(e.clientX-drag.x,e.clientY-drag.y);drag={x:e.clientX,y:e.clientY};}});
on(document,'pointerlockchange',()=>{if(document.pointerLockElement===canvas&&(cursorHeld||paused||victoryOpen||disposed||!document.hasFocus()))document.exitPointerLock();if(document.pointerLockElement!==canvas){keys.clear();heldFire=false;drag=null;}});on(document,'pointerlockerror',()=>{/* Native drag and arrow look remain available after refusal. */});
on(window,'keydown',e=>{
 if(victoryOpen){
  if(e.code==='Escape'){e.preventDefault();closeVictory();}
  if(e.code==='Tab'){e.preventDefault();const buttons=[...document.querySelectorAll('[data-aero-victory] button')],index=buttons.indexOf(document.activeElement);buttons[(index+(e.shiftKey?-1:1)+buttons.length)%buttons.length].focus();}
  return;
 }
 if(e.code==='AltLeft'||e.code==='AltRight'){e.preventDefault();showCursor(e.code);return;}
 if(e.target.matches?.('[data-music-volume]')&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.code))return;
 if(e.isTrusted&&!e.target.closest?.('[data-music],[data-music-volume]'))void music.unlock();
 if(disposed||e.target.closest?.('button,a')&&e.code==='Space')return;
 if(cursorHeld&&['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)){e.preventDefault();return;}
 if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)){e.preventDefault();keys.add(e.code);if(e.code==='Space'&&!e.repeat){sound.unlock();jump=true;}}
 if(e.repeat)return;if(e.code==='KeyF')full();if(e.code==='KeyE')travel();if(e.code==='KeyQ')saveCheckpoint();if(e.code==='KeyR')recover();if(e.code==='Escape'){keys.clear();heldFire=false;if(document.pointerLockElement)document.exitPointerLock();if(document.fullscreenElement)Promise.resolve(document.exitFullscreen()).catch(()=>{});}
});on(window,'keyup',e=>{keys.delete(e.code);if(e.code==='AltLeft'||e.code==='AltRight'){e.preventDefault();altKeys.delete(e.code);if(!altKeys.size)releaseCursor(true);}});on(window,'blur',()=>{keys.clear();heldFire=false;drag=null;releaseCursor();});
on(document.querySelector('[data-fullscreen]'),'click',full);on(document.querySelector('[data-mute]'),'click',e=>{sound.unlock();muted=!muted;sound.setMuted(muted);music.setMuted(muted);void music.unlock();e.currentTarget.setAttribute('aria-pressed',String(muted));e.currentTarget.setAttribute('aria-label',muted?'取消静音':'静音');});on(document.querySelector('[data-return]'),'click',()=>{void music.unlock();recover();});on(document.querySelector('[data-travel]'),'click',()=>{void music.unlock();travel();});on(document.querySelector('[data-fire]'),'click',()=>{void music.unlock();sound.unlock();shoot();});
on(document.querySelector('[data-save]'),'click',saveCheckpoint);
on(document.querySelector('[data-victory-close]'),'click',closeVictory);on(document.querySelector('[data-victory-download]'),'click',()=>downloadMedal());
for(const button of document.querySelectorAll('[data-walk]')){const code={forward:'KeyW',left:'KeyA',back:'KeyS',right:'KeyD'}[button.dataset.walk];on(button,'pointerdown',e=>{sound.unlock();void music.unlock();keys.add(code);button.setPointerCapture(e.pointerId);});on(button,'pointerup',()=>keys.delete(code));on(button,'pointercancel',()=>keys.delete(code));}
function resize(){if(!renderer||disposed||!composer)return;const size=viewport();camera.aspect=size.width/size.height;camera.updateProjectionMatrix();renderer.setSize(size.width,size.height);composer.setSize(size.width,size.height);ao.setSize(Math.round(size.width*.65),Math.round(size.height*.65));}
const sizeObserver=new ResizeObserver(resize);sizeObserver.observe(frameElement);on(window,'resize',resize);on(document,'fullscreenchange',resize);
on(document,'visibilitychange',()=>{paused=document.hidden;if(paused)stop();else start();});on(window,'pagehide',e=>{if(e.persisted){paused=true;stop();}else dispose();});on(window,'pageshow',e=>{if(e.persisted){paused=document.hidden;start();}});
on(canvas,'webglcontextlost',e=>{e.preventDefault();paused=true;mode='context-lost';stop();body.dataset.error='true';});
try{init();}catch(error){body.dataset.error='true';console.error('3D renderer initialization failed',error);dispose();mode='error';}
