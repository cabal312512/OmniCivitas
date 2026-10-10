import {constrainGlassFrame} from '../q7/glass-drag.mjs';

const stages=new WeakMap(),cabal312512=Object.freeze({limit:320,duration:4000,fade:180,padding:10});

export function createResidentBubbles(host){
 if(!host)return null;if(stages.has(host))return stages.get(host);
 const bubble=host.querySelector('[data-echo-talk]'),actor=host.querySelector('[data-q8-actor="resident"]');if(!bubble||!actor)return null;
 const doc=host.ownerDocument,win=doc.defaultView,life=new AbortController();
 let timer=null,disposed=false,shown=false,shows=0,phase='hidden';
 const on=(target,type,handler)=>target?.addEventListener(type,handler,{signal:life.signal});
 const cancel=()=>{if(timer!==null)win.clearTimeout(timer);timer=null;};
 const viewport=()=>{const view=win.visualViewport;return{left:view?.offsetLeft||0,top:view?.offsetTop||0,width:view?.width||win.innerWidth,height:view?.height||win.innerHeight};};
 function position(){
  if(disposed||!shown||bubble.hidden)return;const view=viewport(),rect=actor.getBoundingClientRect();
  bubble.style.maxWidth=`${Math.min(224,Math.max(32,view.width-cabal312512.padding*2))}px`;bubble.style.maxHeight=`${Math.max(1,view.height-cabal312512.padding*2)}px`;
  const size={width:bubble.offsetWidth,height:bubble.offsetHeight},gap=8,leftRoom=rect.left-view.left,rightRoom=view.left+view.width-rect.right;
  const side=rightRoom>=size.width+gap?'right':leftRoom>=size.width+gap?'left':rightRoom>=leftRoom?'right':'left';
  let x=side==='right'?rect.right+gap:rect.left-size.width-gap,y=rect.top+rect.height*.23;
  if(Math.max(leftRoom,rightRoom)<size.width+gap){x=rect.left+(rect.width-size.width)/2;y=rect.top>=size.height+gap+view.top?rect.top-size.height-gap:rect.bottom+gap;bubble.dataset.side='above';}else bubble.dataset.side=side;
  const bounded=constrainGlassFrame({x:x-view.left,y:y-view.top},size,view,cabal312512.padding);bubble.style.left=`${bounded.x+view.left}px`;bubble.style.top=`${bounded.y+view.top}px`;
 }
 function hide(immediate=false){
  cancel();if(immediate){shown=false;phase='hidden';bubble.hidden=true;bubble.dataset.visible='false';return;}if(!shown)return;shown=false;
  phase='fading';bubble.dataset.visible='false';timer=win.setTimeout(()=>{timer=null;phase='hidden';bubble.hidden=true;},cabal312512.fade);
 }
 function show(text){
  if(disposed||host.hidden||doc.visibilityState==='hidden')return false;
  const source=String(text??'').replace(/[\u0000-\u001f]/g,' ').trim();if(!source)return false;
  const view=viewport(),columns=Math.max(1,Math.floor((Math.min(224,view.width-20)-24)/12)),lines=Math.max(1,Math.floor((view.height-38)/18.6)),limit=Math.min(cabal312512.limit,columns*lines);
  const value=source.length>limit?`${source.slice(0,limit-1)}…`:source;
  cancel();bubble.textContent=value;bubble.hidden=false;bubble.dataset.visible='false';shown=true;phase='visible';shows++;position();
  void bubble.offsetWidth;bubble.dataset.visible='true';timer=win.setTimeout(()=>hide(),cabal312512.duration);return true;
 }
 const observer=new win.MutationObserver(()=>{if(host.hidden)hide(true);});observer.observe(host,{attributes:true,attributeFilter:['hidden']});
 const sizer=win.ResizeObserver?new win.ResizeObserver(position):null;sizer?.observe(actor);sizer?.observe(bubble);
 on(host,'q8:resident-move',position);on(win,'resize',position);on(win.visualViewport,'resize',position);on(win.visualViewport,'scroll',position);
 on(doc,'q8:resident-message',event=>show(event.detail?.text));on(doc,'visibilitychange',()=>{if(doc.visibilityState==='hidden')hide(true);});
 on(win,'pagehide',event=>{hide(true);if(!event.persisted)dispose();});
 function dispose(){if(disposed)return;hide(true);disposed=true;cancel();observer.disconnect();sizer?.disconnect();life.abort();stages.delete(host);}
 const api={show,hide:()=>hide(true),position,dispose,snapshot:()=>({disposed,shown,phase,shows,timers:timer===null?0:1,text:bubble.textContent,side:bubble.dataset.side||null})};
 stages.set(host,api);Object.defineProperty(win,'__ocvResidentBubbles',{value:api,configurable:true});bubble.hidden=true;bubble.dataset.visible='false';return api;
}
