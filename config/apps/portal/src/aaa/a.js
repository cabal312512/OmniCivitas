// Bounded geometry, persistent accidents. Navigation/search/identity fields are never targets.
const lifetime=new AbortController(),reduce=matchMedia('(prefers-reduced-motion: reduce)');
const on=(el,type,fn,options={})=>el?.addEventListener(type,fn,{...options,signal:lifetime.signal});
const svgNS='http://www.w3.org/2000/svg';
const lens=document.querySelector('[data-optical-lens]'),cables=document.querySelector('.loose-cables');
const wires=[...cables.querySelectorAll('.loose-wire')],sparks=[...cables.querySelectorAll('.loose-spark')];
const panels=[...document.querySelectorAll('.wrong-window,.maintenance-fragments>section,.panel-new,.optics-panel,.portal-weather,.portal-news,.portal-login-card,.portal-countdown,.portal-tree,.maze-panel,.maze-toast,.light-islands>section,.light-note')];
const records=new Map(),animations=new Set(),sparkAnimations=new Map();
const state=window.__ocvLoose={windows:panels.length,dragCount:0,jolts:0,autoJolts:0,autoMoving:0,autoShivering:0,runaways:0,closed:0,pulses:0,bitChanges:0,ticks:0,runningFrames:0,runningWindows:0,directionChanges:0,suspended:document.hidden,disposed:false};
let raf=0,stack=110,drag=null,lensX=0,lensY=0,sparkIndex=0,lensTurns=0,lastTick=performance.now();
const entropy=new Uint32Array(1),random=(a,b)=>a+(b-a)*crypto.getRandomValues(entropy)[0]/4294967296;
const bound=(v,n)=>Math.max(-n,Math.min(n,v));
function icon(path){const svg=document.createElementNS(svgNS,'svg');svg.setAttribute('viewBox','0 0 16 16');svg.setAttribute('aria-hidden','true');const p=document.createElementNS(svgNS,'path');p.setAttribute('d',path);svg.append(p);return svg;}
function button(label,attribute,path){const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);b.title=label;b.setAttribute(attribute,'');b.append(icon(path));return b;}
function raise(node){node.style.zIndex=String(Math.min(240,++stack));}
function move(node,x,y){const r=records.get(node);r.x=bound(x,innerWidth*1.4);r.y=bound(y,innerHeight*1.4);node.style.setProperty('--loose-x',r.x+'px');node.style.setProperty('--loose-y',r.y+'px');request();}
function watch(animation){animations.add(animation);animation.finished.catch(()=>{}).finally(()=>{animations.delete(animation);request();});request();return animation;}
function jolt(node,automatic=false){const r=records.get(node);if(!r)return;r.animation?.cancel();state.jolts++;node.dataset.jolts=String((Number(node.dataset.jolts)||0)+1);if(!automatic)raise(node);
 if(reduce.matches){node.style.setProperty('--local-x','65%');return;}
 r.animation=watch(node.animate([{transform:'translate(0,0)'},{transform:'translate(13px,-5px)'},{transform:'translate(-8px,7px)'},{transform:'translate(19px,2px)'},{transform:'translate(-3px,-9px)'},{transform:'translate(0,0)'}],{duration:490,easing:'steps(2,end)',composite:'add'}));
}
function close(node){records.get(node)?.animation?.cancel();node.hidden=true;node.dataset.dismissed='true';state.closed++;request();}
function escape(node,dismissAtLimit=true){const r=records.get(node);if(!r.escapeLimit){r.escapeLimit=Math.floor(random(5,31));node.dataset.escapeLimit=String(r.escapeLimit);}if(r.escapes>=r.escapeLimit){if(dismissAtLimit)close(node);return;}r.escapes++;state.runaways++;node.dataset.escapes=String(r.escapes);const box=node.getBoundingClientRect();
 const x=random(-Math.min(75,box.width*.2),Math.max(40,innerWidth-box.width+45)),y=random(35,Math.max(80,innerHeight-Math.min(box.height,innerHeight*.65)+35));move(node,r.x+x-box.left,r.y+y-box.top);raise(node);jolt(node);
}
function changeVelocity(r,now){const a=random(0,Math.PI*2),speed=random(...r.speed);r.vx=Math.cos(a)*speed;r.vy=Math.sin(a)*speed;r.nextTurn=now+random(180,1100);r.node.dataset.velocityX=r.vx.toFixed(2);r.node.dataset.velocityY=r.vy.toFixed(2);state.directionChanges++;}
function bindEscape(node,control){on(control,'click',()=>escape(node));on(control,'pointerenter',e=>{if(e.pointerType==='mouse')escape(node,false);});}
function run(node,automatic=false){const r=records.get(node);r.running=true;node.dataset.running='true';changeVelocity(r,performance.now());if(!automatic)raise(node);request();}
function covered(){return document.body.classList.contains('luminous-home')&&scrollY<innerHeight*.72;}
function advance(now,dt){let count=0,pendingJolt=false;const quiet=covered();for(const [node,r] of records){if(node.hidden)continue;
 if(r.autoJolt&&!reduce.matches&&!quiet&&drag?.node!==node){pendingJolt=true;if(now>=r.nextJolt){jolt(node,true);r.nextJolt=now+random(850,3700);state.autoJolts++;}}
 if(!r.running)continue;count++;if(reduce.matches||quiet||drag?.node===node)continue;if(now>=r.nextTurn)changeVelocity(r,now);let x=r.x+r.vx*dt,y=r.y+r.vy*dt;const b=node.getBoundingClientRect(),left=b.left+(x-r.x),top=b.top+(y-r.y),minX=-Math.min(b.width*.5,140),maxX=innerWidth-45,minY=-Math.min(b.height*.3,100),maxY=innerHeight-35;
 if(left<minX){x+=minX-left;r.vx=Math.abs(r.vx);}else if(left>maxX){x-=left-maxX;r.vx=-Math.abs(r.vx);}if(top<minY){y+=minY-top;r.vy=Math.abs(r.vy);}else if(top>maxY){y-=top-maxY;r.vy=-Math.abs(r.vy);}move(node,x,y);state.runningFrames++;}
 state.runningWindows=count;return (count||pendingJolt)&&!reduce.matches&&!quiet;
}
// Old titles and native buttons stay distinct; most panes have no generic button strip.
function personality(node){
 if(node.matches('.tool-result'))return{actions:[]};
 if(node.matches('.home-image-note'))return{actions:[]};
 if(node.matches('.feature-panel'))return{actions:['drag','close']};
 if(node.matches('.route-panel,.window-menu,.left-column_old,.circuit-panel,.portal-tree'))return{actions:['drag']};
 if(node.matches('.floating-panel'))return{actions:['run'],auto:'jolt'};
 if(node.matches('.window-ghost,.panel_v2'))return{actions:[],auto:node.matches('.panel_v2')?'jolt':null};
 if(node.matches('.window-toast'))return{actions:[],auto:'move'};
 if(node.matches('.window-settings,.portal-countdown'))return{actions:['shake']};
 if(node.matches('.window-table,.maze-toast,.portal-news'))return{actions:['close']};
 if(node.matches('.result-container'))return{actions:['shake','close']};
 if(node.matches('.panel-new'))return{actions:['run']};
 if(node.matches('.portal-weather'))return{actions:[],auto:'move',speed:[18,115]};
 if(node.matches('.spectrum-panel,.light-note'))return{actions:[],auto:'jolt'};
 if(node.matches('.matrix-panel,.dark-panel,.portal-login-card'))return{actions:[]};
 if(node.matches('.light-islands>section:nth-child(1)'))return{actions:['drag']};
 if(node.matches('.light-islands>section:nth-child(2)'))return{actions:['close']};
 if(node.matches('.light-islands>section:nth-child(3)'))return{actions:[]};
 return{actions:['drag','close']};
}
function begin(node,handle,event){if(event.button!==0)return;const r=records.get(node);drag={node,handle,id:event.pointerId,sx:event.clientX,sy:event.clientY,x:r.x,y:r.y,lastX:event.clientX,lastY:event.clientY,moved:false};handle.setPointerCapture(event.pointerId);raise(node);event.preventDefault();}
function moving(event){if(!drag||event.pointerId!==drag.id)return;const dx=event.clientX-drag.sx,dy=event.clientY-drag.sy;drag.moved||=Math.abs(dx)+Math.abs(dy)>4;move(drag.node,drag.x+dx,drag.y+dy);drag.lastX=event.clientX;drag.lastY=event.clientY;}
function end(event){if(!drag||event.pointerId!==drag.id)return;const current=drag;drag=null;if(current.moved)state.dragCount++;else jolt(current.node);if(current.handle.hasPointerCapture(current.id))current.handle.releasePointerCapture(current.id);request();}
for(const [i,node] of panels.entries()){
 const label=node.getAttribute('aria-label')||node.querySelector('.wrong-title,.maze-title,.column-heading,.result-heading,.panel-top')?.textContent.trim().slice(0,12)||'窗口';
 const behavior=personality(node),record={node,x:0,y:0,escapes:0,running:false,speed:behavior.speed||[45,340],z:node.style.zIndex};
 records.set(node,record);node.dataset.looseWindow=String(i);node.removeAttribute('inert');node.removeAttribute('aria-hidden');
 node.querySelectorAll('button[tabindex="-1"]').forEach(b=>b.removeAttribute('tabindex'));
 const tools=document.createElement('div');tools.className='loose-tools';tools.dataset.toolset=behavior.actions.length===1?'single':'pair';
 const grip=behavior.actions.includes('drag')?button(`拖动${label}`,'data-loose-drag','M5 2v12M11 2v12M2 5h12M2 11h12'):null,shake=behavior.actions.includes('shake')?button(`抖动${label}`,'data-loose-shake','m1 9 3-5 3 8 3-8 3 5 2-2'):null,runner=behavior.actions.includes('run')?button(`让${label}持续逃跑`,'data-loose-run','M2 8h11M9 3l5 5-5 5'):null,dismiss=behavior.actions.includes('close')?button(`关闭${label}`,'data-loose-close','m4 4 8 8M12 4l-8 8'):null;
 if(behavior.actions.length){tools.append(...[grip,shake,runner,dismiss].filter(Boolean));node.append(tools);}on(grip,'pointerdown',event=>begin(node,grip,event));on(grip,'pointermove',moving);on(grip,'pointerup',end);on(grip,'pointercancel',end);
 on(grip,'keydown',event=>{const d={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]}[event.key];if(!d)return;event.preventDefault();const r=records.get(node);move(node,r.x+d[0],r.y+d[1]);raise(node);state.dragCount++;});
 const header=node.querySelector('.wrong-title,.column-heading,.panel-heading,.result-heading,.panel-top,.maze-title,.portal-news>div')||node.querySelector(':scope>span,:scope>b,:scope>div:first-child');
 if(header){header.classList.add('loose-handle');header.tabIndex=0;header.setAttribute('aria-label',`移动${label}`);on(header,'pointerdown',event=>{if(!event.target.closest('a,button,input,select,summary,[role=button]'))begin(node,header,event);});on(header,'pointermove',moving);on(header,'pointerup',end);on(header,'pointercancel',end);
  on(header,'keydown',event=>{if(event.target!==header)return;const d={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]}[event.key];if(d){event.preventDefault();move(node,record.x+d[0],record.y+d[1]);raise(node);state.dragCount++;}});
  const oldCross=header.querySelector(':scope>span:last-child');if(oldCross?.textContent.includes('×')){oldCross.removeAttribute('aria-hidden');oldCross.setAttribute('role','button');oldCross.tabIndex=0;oldCross.dataset.looseClose='';oldCross.setAttribute('aria-label',`关闭${label}`);on(oldCross,'click',()=>close(node));on(oldCross,'keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();close(node);}});}
 }
 on(shake,'click',event=>{jolt(node);pulse(event.clientX,event.clientY,.3);});on(runner,'click',()=>run(node));on(dismiss,'click',()=>close(node));
 on(node,'pointermove',event=>{const r=node.getBoundingClientRect();node.style.setProperty('--local-x',event.clientX-r.left+'px');node.style.setProperty('--local-y',event.clientY-r.top+'px');},{passive:true});
 if(node.matches('.window-ghost'))bindEscape(node,node.querySelector(':scope>button'));
 if(node.matches('.window-toast')){const bs=node.querySelectorAll(':scope>button');on(bs[0],'click',()=>run(node));on(bs[1],'click',()=>close(node));}
 if(node.matches('.floating-panel'))node.querySelectorAll('.fake-actions button').forEach((b,n)=>{if(n)bindEscape(node,b);else on(b,'click',()=>close(node));});
 if(node.matches('.maze-toast'))bindEscape(node,node.querySelector(':scope>button'));
 if(behavior.auto){node.dataset.autoWindow=behavior.auto;if(behavior.auto==='move'){state.autoMoving++;run(node,true);}else{record.autoJolt=true;record.nextJolt=performance.now()+random(600,2200);state.autoShivering++;}}
}
state.toolsets=panels.map(node=>({id:node.dataset.looseWindow,classes:node.className,buttons:[...node.querySelectorAll(':scope>.loose-tools>button')].map(b=>[...b.attributes].find(a=>a.name.startsWith('data-loose-'))?.name),automatic:node.dataset.autoWindow||null}));
const settings=document.querySelector('.wrong-settings');if(settings){settings.removeAttribute('inert');settings.removeAttribute('aria-hidden');settings.querySelectorAll('button').forEach((b,i)=>{b.removeAttribute('tabindex');b.setAttribute('aria-label',['显示偏移','声音偏移','自动偏移'][i]);on(b,'click',event=>{b.dataset.lit=String(b.dataset.lit==='false');b.textContent=b.dataset.lit==='true'?'◉':'○';jolt(settings.closest('[data-loose-window]'));pulse(event.clientX,event.clientY,.55);});});}
document.querySelectorAll('.bit-matrix i').forEach((bit,i)=>{bit.tabIndex=0;bit.setAttribute('role','button');bit.setAttribute('aria-label',`矩阵第${i+1}格`);bit.setAttribute('aria-pressed',String(bit.classList.contains('lit')));const flip=()=>{bit.classList.toggle('lit');bit.setAttribute('aria-pressed',String(bit.classList.contains('lit')));state.bitChanges++;const r=bit.getBoundingClientRect();pulse(r.left+r.width/2,r.top+r.height/2,.18);};on(bit,'click',flip);on(bit,'keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();flip();}});});
function pulse(x=innerWidth*.5,y=innerHeight*.5,strength=.8){state.pulses++;if(!Number.isFinite(x)||!Number.isFinite(y)){x=innerWidth*.5;y=innerHeight*.5;}window.dispatchEvent(new CustomEvent('ocv:optical-impulse',{detail:{x,y,strength}}));
 if(reduce.matches||document.hidden)return;const spark=sparks[sparkIndex++%sparks.length];sparkAnimations.get(spark)?.cancel();const animation=watch(spark.animate([{transform:`translate(${x}px,${y}px) scale(.3)`,opacity:.95},{transform:`translate(${x}px,${y}px) scale(4.2)`,opacity:0}],{duration:850,easing:'cubic-bezier(.1,.5,.2,1)'}));sparkAnimations.set(spark,animation);
}
on(document.querySelector('[data-optical-pulse]'),'click',()=>{const r=lens.getBoundingClientRect();pulse(r.left+r.width/2,r.top+r.height/2);const matrix=document.querySelector('.bit-matrix');if(matrix){const bytes=crypto.getRandomValues(new Uint8Array(100));matrix.querySelectorAll('i').forEach((b,i)=>{b.classList.toggle('lit',bytes[i]%3===0);b.setAttribute('aria-pressed',String(b.classList.contains('lit')));});}document.querySelectorAll('.spectrum>i').forEach((b,i)=>b.style.setProperty('--bar',18+(i*37+state.pulses*29)%80+'%'));});
let lensDrag=null,orbitDrag=null;
const lensGrip=document.querySelector('[data-lens-grip]'),orbit=document.querySelector('[data-orbit]');
function moveLens(x,y){lensX=bound(x,innerWidth);lensY=bound(y,innerHeight);lens.style.setProperty('--lens-x',lensX+'px');lens.style.setProperty('--lens-y',lensY+'px');request();}
on(lensGrip,'pointerdown',e=>{if(e.button!==0)return;lensDrag={sx:e.clientX,sy:e.clientY,x:lensX,y:lensY,id:e.pointerId};lensGrip.setPointerCapture(e.pointerId);e.preventDefault();});
on(lensGrip,'pointermove',e=>{if(lensDrag)moveLens(lensDrag.x+e.clientX-lensDrag.sx,lensDrag.y+e.clientY-lensDrag.sy);});
const finishLens=()=>{lensDrag=null;state.dragCount++;request();};on(lensGrip,'pointerup',finishLens);on(lensGrip,'pointercancel',finishLens);
on(lensGrip,'keydown',e=>{const d={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]}[e.key];if(d){e.preventDefault();moveLens(lensX+d[0],lensY+d[1]);state.dragCount++;}});
on(orbit,'pointerdown',e=>{if(e.button!==0)return;orbitDrag={x:e.clientX,y:e.clientY,id:e.pointerId};orbit.setPointerCapture(e.pointerId);e.preventDefault();});
on(orbit,'pointermove',e=>{if(!orbitDrag)return;const dx=e.clientX-orbitDrag.x,dy=e.clientY-orbitDrag.y;orbitDrag.x=e.clientX;orbitDrag.y=e.clientY;lensTurns+=dx*.8;lens.style.setProperty('--lens-turn',lensTurns+'deg');window.dispatchEvent(new CustomEvent('ocv:optical-turn',{detail:{dx,dy}}));});
on(orbit,'pointerup',e=>{orbitDrag=null;pulse(e.clientX,e.clientY,.6);});on(orbit,'pointercancel',()=>orbitDrag=null);
on(orbit,'keydown',e=>{const d={ArrowLeft:[-28,0],ArrowRight:[28,0],ArrowUp:[0,-28],ArrowDown:[0,28]}[e.key];if(d){e.preventDefault();lensTurns+=d[0]*.8;lens.style.setProperty('--lens-turn',lensTurns+'deg');window.dispatchEvent(new CustomEvent('ocv:optical-turn',{detail:{dx:d[0],dy:d[1]}}));}});
function reset(){for(const [node,r] of records){r.animation?.cancel();move(node,0,0);node.hidden=false;node.removeAttribute('data-dismissed');delete node.dataset.escapes;delete node.dataset.escapeLimit;r.escapes=0;r.escapeLimit=0;node.style.zIndex=r.z;}moveLens(0,0);lensTurns=0;lens.style.setProperty('--lens-turn','0deg');window.dispatchEvent(new CustomEvent('ocv:optical-reset'));request();}
document.querySelectorAll('[data-window-reset]').forEach(b=>on(b,'click',reset));
function paint(now){raf=0;if(state.disposed||document.hidden)return;state.ticks++;const dt=Math.min(.12,Math.max(0,(now-lastTick)/1000));lastTick=now;const running=advance(now,dt);const w=innerWidth,h=innerHeight;cables.setAttribute('viewBox',`0 0 ${w} ${h}`);const r=lens.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+80;
 const visible=panels.filter(p=>!p.hidden&&p.getBoundingClientRect().top<h&&p.getBoundingClientRect().bottom>0).filter(p=>p.getBoundingClientRect().left<w&&p.getBoundingClientRect().right>0);
 for(let i=0;i<wires.length;i++){const p=visible[(i*3)%Math.max(1,visible.length)];if(!p){wires[i].setAttribute('d','');continue;}const b=p.getBoundingClientRect(),tx=b.left+b.width/2,ty=b.top+Math.min(b.height/2,23),d=Math.abs(tx-x);wires[i].setAttribute('d',`M${x},${y}C${x+d*.4},${y-53} ${tx-d*.3},${ty+67} ${tx},${ty}`);}
 if(animations.size||drag||lensDrag||orbitDrag||running)request();
}
function request(){if(!raf&&!state.disposed&&!document.hidden)raf=requestAnimationFrame(paint);}
on(document,'scroll',request,{capture:true,passive:true});on(window,'resize',request,{passive:true});
function coverMode(){const covered=document.body.classList.contains('luminous-home')&&scrollY<innerHeight*.72;for(const node of [lens,document.querySelector('.reactor-overlay'),document.querySelector('.loose-rescue')])if(node)node.inert=covered;}
function anchorRescue(){const v=window.visualViewport,node=document.querySelector('.loose-rescue');if(!v||!node)return;node.style.left=v.offsetLeft+v.width-57+'px';node.style.top=v.offsetTop+v.height-109+'px';node.style.right=node.style.bottom='auto';}
coverMode();anchorRescue();on(window,'scroll',coverMode,{passive:true});on(window,'resize',()=>{coverMode();anchorRescue();},{passive:true});on(window.visualViewport,'resize',anchorRescue,{passive:true});on(window.visualViewport,'scroll',anchorRescue,{passive:true});
on(reduce,'change',()=>{if(reduce.matches){for(const a of animations)a.cancel();animations.clear();}request();});
function suspend(){cancelAnimationFrame(raf);raf=0;for(const a of animations)a.pause();}
function resume(){lastTick=performance.now();for(const a of animations)if(a.playState==='paused')a.play();request();}
on(document,'visibilitychange',()=>{state.suspended=document.hidden;document.body.dataset.hidden=String(document.hidden);document.hidden?suspend():resume();});
on(window,'pagehide',e=>{suspend();drag=lensDrag=orbitDrag=null;if(!e.persisted){state.disposed=true;lifetime.abort();for(const a of animations)a.cancel();animations.clear();sparkAnimations.clear();}});
on(window,'pageshow',()=>{coverMode();anchorRescue();resume();});request();
