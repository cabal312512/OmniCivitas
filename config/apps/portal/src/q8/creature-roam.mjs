const controllers=new WeakMap(),diagnosticsByWindow=new WeakMap();
const FPS=30,POINTER_RADIUS=150,REST_MS=2000,PADDING=12,HEADER=76;
const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
const finite=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
const seedValue=value=>Math.abs(Math.trunc(finite(value,0)))%2147483647;
const modeFor=seed=>['roam','dart','stationary'][seedValue(seed)%3];
const smooth=value=>value*value*value*(value*(value*6-15)+10);
function random(seed,index,salt){
 let word=(seed^Math.imul(index+1,0x9e3779b1)^salt)>>>0;
 word=Math.imul(word^(word>>>16),0x85ebca6b);word=Math.imul(word^(word>>>13),0xc2b2ae35);
 return((word^(word>>>16))>>>0)/4294967296;
}
function bounds(viewport,size){
 const width=Math.max(1,finite(viewport?.width,1)),height=Math.max(1,finite(viewport?.height,1));
 const actorWidth=Math.max(1,finite(size?.width,84)),actorHeight=Math.max(1,finite(size?.height,88));
 const right=Math.max(0,width-actorWidth-PADDING),bottom=Math.max(0,height-actorHeight-PADDING);
 return{left:Math.min(PADDING,right),right,top:Math.min(HEADER,bottom),bottom};
}
function anchorPoint(anchor,limits){return{x:clamp(finite(anchor?.x,limits.left),limits.left,limits.right),y:clamp(finite(anchor?.y,limits.top),limits.top,limits.bottom)};}
function waypoint(seed,index,limits,start){
 let x=random(seed,index,0x68bc21eb),y=random(seed,index,0x02e5be93);
 if(index===0){x=start.x<(limits.left+limits.right)/2?.67+x*.25:.08+x*.25;y=start.y<(limits.top+limits.bottom)/2?.67+y*.25:.08+y*.25;}
 else{x=.06+x*.88;y=.06+y*.88;}
 return{x:limits.left+(limits.right-limits.left)*x,y:limits.top+(limits.bottom-limits.top)*y};
}

// Time is active movement time in seconds; suspension never advances this clock.
export function roamingPoint(time,seed,viewport,anchor,size){
 seed=seedValue(seed);const mode=modeFor(seed),limits=bounds(viewport,size),start=anchorPoint(anchor,limits);
 if(mode==='stationary')return{...start,mode,moving:false,segment:0};
 const period=mode==='roam'?8.2+random(seed,0,11)*2:5.1+random(seed,0,17)*1.2;
 const rest=mode==='roam'?.85+random(seed,0,23)*.55:1.6+random(seed,0,29)*.65;
 const seconds=Math.max(0,finite(time,0)),segment=Math.floor(seconds/period),elapsed=seconds-segment*period;
 const from=segment===0?start:waypoint(seed,segment-1,limits,start),to=waypoint(seed,segment,limits,start);
 const progress=clamp(elapsed/(period-rest),0,1),blend=smooth(progress);
 return{x:from.x+(to.x-from.x)*blend,y:from.y+(to.y-from.y)*blend,mode,moving:progress<1,segment};
}

function publish(win,root,controller){
 let entry=diagnosticsByWindow.get(win);
 if(!entry){
  entry={controllers:new Map(),last:null};
  const diagnostics={snapshot:()=>{
   const active=[...entry.controllers.values()],primary=active.at(-1)||entry.last;
   return{...primary?.snapshot(),actors:active.length,states:active.map(item=>item.snapshot())};
  }};
  Object.defineProperty(win,'__ocvCreatureRoaming',{value:diagnostics,configurable:true});diagnosticsByWindow.set(win,entry);
 }
 entry.controllers.set(root,controller);entry.last=controller;
 Object.defineProperty(root,'__ocvCreatureRoaming',{value:controller,configurable:true});return()=>entry.controllers.delete(root);
}

export function createCreatureRoaming(root,{signal}={}){
 if(!root||root.dataset.q8Actor!=='hidden')return null;
 if(controllers.has(root))return controllers.get(root);
 const doc=root.ownerDocument,win=doc?.defaultView;if(!win)return null;
 const life=new AbortController(),reduced=win.matchMedia?.('(prefers-reduced-motion: reduce)'),seed=seedValue(root.dataset.id),mode=modeFor(seed);
 let raf=0,resumeTimer=null,resumeDeadline=0,lastStamp=null,frames=0,time=0,disposed=false,pagePaused=false,intersecting=true;
 let x=0,y=0,anchor=null,size={width:84,height:88},pointer=null,nearBlocked=false,hovered=false,focused=doc.activeElement===root,pressed=false,pressedId=null,collected=false,holdUntil=0,reason='pending',resizePending=false;
 const now=()=>win.performance?.now?.()??Date.now();
 const viewport=()=>({width:win.innerWidth||doc.documentElement?.clientWidth||1,height:win.innerHeight||doc.documentElement?.clientHeight||1});
 const on=(target,type,handler,options={})=>target?.addEventListener?.(type,handler,{...options,signal:life.signal});
 const flagged=name=>root.dataset[name]!==undefined&&root.dataset[name]!=='false';
 const isCovered=()=>doc.body?.dataset.cover==='true'||!!root.closest?.('[data-cover="true"]');
 function stop(){if(raf)win.cancelAnimationFrame(raf);raf=0;lastStamp=null;}
 function clearResume(){if(resumeTimer!==null)win.clearTimeout(resumeTimer);resumeTimer=null;resumeDeadline=0;}
 function measure(){
  const rect=root.getBoundingClientRect();if(!rect.width||!rect.height)return false;
  size={width:rect.width,height:rect.height};
  if(!anchor){anchor={x:rect.left,y:rect.top};x=rect.left;y=rect.top;}
  return true;
 }
 function near(px=x,py=y,radius=POINTER_RADIUS){
  if(!pointer)return false;const dx=pointer.x-clamp(pointer.x,px,px+size.width),dy=pointer.y-clamp(pointer.y,py,py+size.height);
  return Math.hypot(dx,dy)<=radius;
 }
 function pauseReason(){
  if(disposed)return'disposed';if(flagged('q8Collecting')||flagged('q8Collected'))collected=true;
  if(collected)return'collecting';if(root.hidden||root.closest?.('[hidden]'))return'hidden';
  if(pagePaused||doc.visibilityState==='hidden')return'page';if(isCovered())return'cover';if(reduced?.matches)return'reduced';
  if(root.dataset.q8Awake!=='true')return'asleep';if(!intersecting||!root.getClientRects().length)return'offscreen';
  const style=win.getComputedStyle?.(root);if(style?.display==='none'||style?.visibility==='hidden')return'hidden';
  const rect=root.getBoundingClientRect(),view=viewport();if(rect.left+rect.width<=0||rect.top+rect.height<=0||rect.left>=view.width||rect.top>=view.height)return'offscreen';
  if(mode==='stationary')return'stationary';if(pressed)return'pressed';if(focused||doc.activeElement===root)return'focus';if(hovered)return'hover';
  if(pointer&&(nearBlocked||near()))return'pointer';if(now()<holdUntil)return'cooldown';return null;
 }
 function status(pausedReason){
  reason=pausedReason;root.dataset.q8Roaming=mode;root.dataset.q8RoamMode=mode;root.dataset.q8RoamState=pausedReason?'paused':'moving';
  if(pausedReason)root.dataset.q8RoamPaused=pausedReason;else delete root.dataset.q8RoamPaused;
 }
 function place(){root.style.setProperty('left',`${x.toFixed(3)}px`);root.style.setProperty('top',`${y.toFixed(3)}px`);}
 function refresh(){
  if(disposed)return;measure();
  if(resizePending&&anchor&&!pressed&&!root.hidden&&!collected&&!flagged('q8Collecting')&&!flagged('q8Collected')){
   const bounded=anchorPoint({x,y},bounds(viewport(),size));x=bounded.x;y=bounded.y;resizePending=false;if(mode!=='stationary')place();
  }
  const pausedReason=pauseReason();status(pausedReason);
  if(pausedReason){
   stop();
   if(pausedReason==='cooldown'){
    if(resumeTimer===null||resumeDeadline!==holdUntil){clearResume();resumeDeadline=holdUntil;resumeTimer=win.setTimeout(()=>{resumeTimer=null;resumeDeadline=0;refresh();},Math.max(1,holdUntil-now()));}
   }else clearResume();
   return;
  }
  clearResume();if(!anchor)return;if(!raf)raf=win.requestAnimationFrame(frame);
 }
 function frame(stamp){
  raf=0;const pausedReason=pauseReason();if(pausedReason){refresh();return;}
  const dt=lastStamp===null?0:Math.max(0,Math.min((stamp-lastStamp)/1000,.08));
  if(lastStamp!==null&&stamp-lastStamp<1000/FPS){raf=win.requestAnimationFrame(frame);return;}
  lastStamp=stamp;const nextTime=time+dt,target=roamingPoint(nextTime,seed,viewport(),anchor,size);
  const distance=Math.hypot(target.x-x,target.y-y),diagonal=Math.hypot(win.innerWidth||1,win.innerHeight||1);
  const maxStep=dt*Math.max(mode==='dart'?190:110,diagonal*(mode==='dart'?.6:.25)),blend=distance>maxStep&&distance?maxStep/distance:1;
  const limits=bounds(viewport(),size),nextX=clamp(x+(target.x-x)*blend,limits.left,limits.right),nextY=clamp(y+(target.y-y)*blend,limits.top,limits.bottom);
  if(pointer&&near(nextX,nextY)){nearBlocked=true;holdUntil=now()+REST_MS;refresh();return;}
  time=nextTime;x=nextX;y=nextY;place();frames++;status(null);raf=win.requestAnimationFrame(frame);
 }
 function hold(){holdUntil=now()+REST_MS;refresh();}
 function updatePointer(event){
  if(disposed||event.pointerType==='touch'||reduced?.matches)return;
  if(!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return;
  pointer={x:event.clientX,y:event.clientY};
  if(near()){nearBlocked=true;holdUntil=now()+REST_MS;}else if(!near(x,y,POINTER_RADIUS+20))nearBlocked=false;
  refresh();
 }
 function release(event){if(!pressed||event.pointerId!==undefined&&pressedId!==null&&event.pointerId!==pressedId)return;pressed=false;pressedId=null;hold();}
 on(doc,'pointermove',updatePointer,{passive:true});
 on(doc,'pointerout',event=>{if(event.relatedTarget===null){pointer=null;nearBlocked=false;hovered=false;hold();}},{passive:true});
 on(root,'pointerenter',()=>{hovered=true;hold();});on(root,'pointerleave',()=>{hovered=false;hold();});
 on(root,'focus',()=>{focused=true;hold();});on(root,'blur',()=>{focused=false;hold();});
 on(root,'pointerdown',event=>{pressed=true;pressedId=event.pointerId??null;hold();},{capture:true});
 on(win,'pointerup',release,{capture:true});on(win,'pointercancel',release,{capture:true});on(root,'lostpointercapture',release);
 on(win,'blur',()=>{pressed=false;pressedId=null;hovered=false;pointer=null;nearBlocked=false;hold();});
 on(doc,'visibilitychange',refresh);on(reduced,'change',refresh);
 on(win,'resize',()=>{
  if(disposed)return;resizePending=true;refresh();
 });
 on(win,'pagehide',event=>{if(event.persisted){pagePaused=true;stop();clearResume();status('page');}else dispose();});
 on(win,'pageshow',()=>{pagePaused=false;refresh();});
 const observer=win.MutationObserver?new win.MutationObserver(refresh):null;
 observer?.observe(root,{attributes:true,attributeFilter:['hidden','data-q8-awake','data-q8-collecting','data-q8-collected']});
 const ancestors=new Set();for(let parent=root.parentElement;parent;parent=parent.parentElement)ancestors.add(parent);if(doc.body)ancestors.add(doc.body);
 for(const parent of ancestors)observer?.observe(parent,{attributes:true,attributeFilter:['hidden','data-cover']});
 const intersection=win.IntersectionObserver?new win.IntersectionObserver(entries=>{intersecting=entries[0]?.isIntersecting!==false;refresh();}):null;intersection?.observe(root);
 function dispose(){
  if(disposed)return;disposed=true;stop();clearResume();observer?.disconnect();intersection?.disconnect();life.abort();signal?.removeEventListener('abort',dispose);unpublish();status('disposed');
 }
 const controller={refresh,dispose,snapshot:()=>({mode,running:!!raf,x,y,paused:reason!==null,reason,pausedReason:reason,timers:resumeTimer===null?0:1,frames,disposed,activeTime:time,pressed,seed})};
 controllers.set(root,controller);const unpublish=publish(win,root,controller);
 signal?.addEventListener('abort',dispose,{once:true});if(signal?.aborted)dispose();else refresh();return controller;
}
