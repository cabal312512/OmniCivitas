import {searchFeatures,recommend} from '../main1/catalogue.mjs';
const life=new AbortController(),on=(target,type,fn,options={})=>target?.addEventListener(type,fn,{...options,signal:life.signal});
const frame=document.querySelector('#signals-ui');
on(window,'message',event=>{if(event.origin!==location.origin||event.source!==frame?.contentWindow||event.data?.type!=='OCV_SIGNALS_HEIGHT')return;const height=Number(event.data.height);if(Number.isFinite(height)&&height>0)frame.style.height=`${Math.max(1200,Math.min(2000000,height+6))}px`;});
const measureFrame=()=>frame?.contentWindow?.postMessage({type:'OCV_SIGNALS_MEASURE'},location.origin);on(frame,'load',measureFrame);measureFrame();
const input=document.querySelector('#signals-search'),results=document.querySelector('.signals-search-results');let searchTimer;
function search(){clearTimeout(searchTimer);const q=input.value.trim().slice(0,80),found=q?searchFeatures(q):recommend();results.replaceChildren();results.hidden=false;for(const item of found.slice(0,30)){const link=document.createElement('a'),note=document.createElement('small');link.href=item.url;link.append(document.createTextNode(item.title));note.textContent='↗';link.append(note);results.append(link)}if(!found.length)results.textContent='没有结果';}
on(document.querySelector('[data-signals-search]'),'click',search);on(input,'input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(search,120)});on(input,'keydown',event=>{if(event.key==='Enter'){event.preventDefault();search()}if(event.key==='Escape')results.hidden=true});
on(document,'keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='k'){event.preventDefault();input.focus()}});
const reduce=matchMedia('(prefers-reduced-motion: reduce)'),notes=[];
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
let motionFrame=0,lastPaint=0;
function paint(state){state.note.style.setProperty('--note-dx',`${state.x.toFixed(1)}px`);state.note.style.setProperty('--note-dy',`${state.y.toFixed(1)}px`)}
function reset(state){state.x=state.y=0;state.note.removeAttribute('data-signals-blink');paint(state)}
function stopMotion(){cancelAnimationFrame(motionFrame);motionFrame=0;lastPaint=0}
function syncMotion(){if(!motionFrame&&!life.signal.aborted&&!document.hidden&&!reduce.matches)motionFrame=requestAnimationFrame(moveNotes)}
function bounds(state,rect){
 const header=state.handle.getBoundingClientRect(),left=header.left-rect.left,top=header.top-rect.top;
 return {left:Math.max(0,-left),right:Math.max(0,innerWidth-left-header.width),top:Math.max(0,-top),bottom:Math.max(0,innerHeight-top-header.height)};
}
function moveNotes(now){
 motionFrame=0;if(life.signal.aborted||document.hidden||reduce.matches)return;
 if(lastPaint&&now-lastPaint<32){motionFrame=requestAnimationFrame(moveNotes);return}
 const dt=lastPaint?Math.min(.07,(now-lastPaint)/1000):0;lastPaint=now;let active=0;
 for(const state of notes){
  if(!state.motion||state.note.hidden||state.dragging)continue;
  const rect=state.note.getBoundingClientRect();if(rect.bottom<-180||rect.top>innerHeight+180)continue;
  active++;
  if(state.focused||now<state.holdUntil)continue;
  const box=bounds(state,rect),baseX=rect.left-state.x,baseY=rect.top-state.y;
  const minX=Math.max(-220,box.left-baseX),maxX=Math.min(220,box.right-baseX);
  const fixed=state.note.dataset.manual==='true',minY=fixed?Math.max(-120,box.top-baseY):-120,maxY=fixed?Math.min(120,box.bottom-baseY):120;
  if(state.motion==='track'){
   if(now>=state.next){state.vx=(Math.random()<.5?-1:1)*(28+Math.random()*62);state.vy=(Math.random()-.5)*75;state.next=now+1400+Math.random()*3400}
   state.x+=state.vx*dt;state.y+=state.vy*dt;
   if(state.x<=minX||state.x>=maxX)state.vx*=-1;if(state.y<=minY||state.y>=maxY)state.vy*=-1;
   state.x=clamp(state.x,minX,maxX);state.y=clamp(state.y,minY,maxY);paint(state);
  }else if(state.motion==='jump'&&now>=state.next){
   state.x=clamp((Math.random()-.45)*440,minX,maxX);state.y=clamp((Math.random()-.5)*215,minY,maxY);
   state.next=now+1700+Math.random()*3800;paint(state);
  }else if(state.motion==='spasm'){
   if(now>=state.next){state.burstUntil=now+110+Math.random()*130;state.next=now+1000+Math.random()*3100}
   if(now<state.burstUntil){state.x=clamp((Math.random()-.5)*37,minX,maxX);state.y=clamp((Math.random()-.5)*24,minY,maxY);state.note.dataset.signalsBlink=String(Math.random()<.23);paint(state)}
   else if(state.x||state.y||state.note.hasAttribute('data-signals-blink'))reset(state);
  }
 }
 if(active)motionFrame=requestAnimationFrame(moveNotes);else lastPaint=0;
}
for(const note of document.querySelectorAll('[data-signals-note]')){
 const handle=note.querySelector('[data-signals-note-handle]');let drag;
 const state={note,handle,motion:note.dataset.signalsMotion,x:0,y:0,vx:0,vy:0,next:0,burstUntil:0,holdUntil:0,dragging:false,focused:false};notes.push(state);
 on(note.querySelector('[data-signals-note-close]'),'pointerdown',()=>{state.holdUntil=performance.now()+800});
 on(note.querySelector('[data-signals-note-close]'),'click',()=>{note.hidden=true;state.dragging=false;drag=undefined});
 on(note,'focusin',()=>{state.focused=true;note.removeAttribute('data-signals-blink')});on(note,'focusout',event=>{state.focused=note.contains(event.relatedTarget);syncMotion()});
 on(handle,'pointerdown',event=>{
  if(event.target.closest('button')||event.button!==0)return;event.preventDefault();const rect=note.getBoundingClientRect();
  state.dragging=true;reset(state);note.dataset.manual='true';note.dataset.dragging='true';note.style.top=`${rect.top}px`;note.style.left=`${rect.left}px`;note.style.right='auto';
  drag={x:event.clientX-rect.left,y:event.clientY-rect.top};handle.setPointerCapture(event.pointerId);
 });
 on(handle,'pointermove',event=>{
  if(!drag)return;const box=bounds(state,note.getBoundingClientRect());
  note.style.left=`${clamp(event.clientX-drag.x,box.left,box.right)}px`;note.style.top=`${clamp(event.clientY-drag.y,box.top,box.bottom)}px`;
 });
 const release=()=>{drag=undefined;state.dragging=false;note.removeAttribute('data-dragging');state.next=performance.now()+450;syncMotion()};
 on(handle,'pointerup',release);on(handle,'pointercancel',release);on(handle,'lostpointercapture',release);
}
on(window,'scroll',syncMotion,{passive:true});on(window,'resize',syncMotion,{passive:true});
on(document,'visibilitychange',()=>{if(document.hidden)stopMotion();else syncMotion()});
on(reduce,'change',()=>{if(reduce.matches){stopMotion();for(const state of notes)reset(state)}else syncMotion()});
on(window,'pagehide',event=>{clearTimeout(searchTimer);stopMotion();if(!event.persisted)life.abort()});on(window,'pageshow',syncMotion);syncMotion();
