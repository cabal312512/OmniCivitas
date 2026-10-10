import {constrainGlassFrame} from '../q7/glass-drag.mjs';

const stages=new WeakMap(),cabal312512=Object.freeze({threshold:6,padding:10,clickWindow:650});

export function createResidentDragging(host,actor){
 if(!host||!actor)return null;if(stages.has(host))return stages.get(host);
 const doc=host.ownerDocument,win=doc.defaultView,life=new AbortController();
 let active=null,pending=null,raf=0,moved=false,position=null,suppressUntil=0,disposed=false,moves=0,suppressedClicks=0,keyboardMoves=0;
 const now=()=>win.performance.now();
 const viewport=()=>{const view=win.visualViewport;return{left:view?.offsetLeft||0,top:view?.offsetTop||0,width:view?.width||win.innerWidth,height:view?.height||win.innerHeight};};
 const on=(target,type,handler,options={})=>target?.addEventListener(type,handler,{...options,signal:life.signal});
 function dragging(value){host.dataset.residentDragging=String(value);actor.dataset.residentDragging=String(value);}
 function place(point){
  const rect=host.getBoundingClientRect(),view=viewport();
  const bounded=constrainGlassFrame({x:point.x-view.left,y:point.y-view.top},rect,view,cabal312512.padding);
  position={x:bounded.x+view.left,y:bounded.y+view.top};host.style.left=`${position.x}px`;host.style.top=`${position.y}px`;host.style.right='auto';host.style.bottom='auto';
  host.dispatchEvent(new win.CustomEvent('q8:resident-move',{bubbles:true,detail:{...position,dragging:!!active?.started}}));
 }
 function flush(){
  if(raf)win.cancelAnimationFrame(raf);raf=0;
  if(active?.started&&pending){place(pending);pending=null;}
 }
 function finish(){
  flush();if(!active)return;const ended=active;active=null;pending=null;
  if(ended.started){moves++;suppressUntil=now()+cabal312512.clickWindow;}
  dragging(false);
  try{if(actor.hasPointerCapture(ended.id))actor.releasePointerCapture(ended.id);}catch{}
  host.dispatchEvent(new win.CustomEvent('q8:resident-move',{bubbles:true,detail:{...(position||{}),dragging:false}}));
 }
 function fit(){
  finish();if(disposed||host.hidden||!host.getClientRects().length)return;
  const rect=host.getBoundingClientRect();place(position||{x:rect.left,y:rect.top});
 }
 function reset(){
  finish();moved=false;position=null;host.style.removeProperty('left');host.style.removeProperty('top');host.style.removeProperty('right');host.style.removeProperty('bottom');host.removeAttribute('data-resident-moved');fit();
 }
 on(actor,'pointerdown',event=>{
  if(disposed||active||actor.disabled||event.button!==0||event.isPrimary===false)return;
  suppressUntil=0;const rect=host.getBoundingClientRect();active={id:event.pointerId,startX:event.clientX,startY:event.clientY,left:rect.left,top:rect.top,started:false};
  try{actor.setPointerCapture(event.pointerId);}catch{}
 });
 on(doc,'pointermove',event=>{
  if(!active||event.pointerId!==active.id)return;
  if(event.pointerType==='mouse'&&!(event.buttons&1)){finish();return;}
  const x=event.clientX-active.startX,y=event.clientY-active.startY;
  if(!active.started&&Math.hypot(x,y)<cabal312512.threshold)return;
  if(!active.started){active.started=true;moved=true;host.dataset.residentMoved='true';dragging(true);actor.focus({preventScroll:true});}
  pending={x:active.left+x,y:active.top+y};if(!raf)raf=win.requestAnimationFrame(flush);event.preventDefault();
 });
 for(const type of ['pointerup','pointercancel','lostpointercapture'])on(doc,type,event=>{if(active&&event.pointerId===active.id)finish();});
 on(actor,'click',event=>{
  if(event.detail===0||now()>suppressUntil)return;
  suppressUntil=0;suppressedClicks++;event.preventDefault();event.stopImmediatePropagation();
 },{capture:true});
 on(actor,'dragstart',event=>event.preventDefault());
 on(actor,'keydown',event=>{
  if(event.target!==actor||!event.shiftKey||event.altKey||event.ctrlKey||event.metaKey)return;
  const delta={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]}[event.key];
  if(event.key==='Home'){reset();event.preventDefault();return;}if(!delta)return;
  finish();const rect=host.getBoundingClientRect();moved=true;keyboardMoves++;host.dataset.residentMoved='true';place({x:rect.left+delta[0],y:rect.top+delta[1]});event.preventDefault();
 });
 const observer=new win.MutationObserver(()=>{if(host.hidden)finish();else fit();});observer.observe(host,{attributes:true,attributeFilter:['hidden']});
 on(win,'resize',fit);on(win.visualViewport,'resize',fit);on(win.visualViewport,'scroll',fit);on(win,'blur',finish);
 on(doc,'visibilitychange',()=>{if(doc.visibilityState==='hidden')finish();else fit();});
 on(win,'pagehide',event=>{finish();if(!event.persisted)dispose();});on(win,'pageshow',fit);
 function dispose(){if(disposed)return;finish();disposed=true;observer.disconnect();life.abort();if(raf)win.cancelAnimationFrame(raf);raf=0;pending=null;active=null;stages.delete(host);}
 const api={dispose,reset,fit,snapshot:()=>({disposed,dragging:!!active?.started,moved,moves,keyboardMoves,suppressedClicks,position:position?{...position}:null,viewport:viewport(),pendingFrames:raf?1:0})};
 stages.set(host,api);Object.defineProperty(win,'__ocvResidentDragging',{value:api,configurable:true});dragging(false);fit();return api;
}
