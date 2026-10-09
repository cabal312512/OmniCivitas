function mountWideFragments(){
 const layer=document.querySelector('[data-w7-layer]');
 if(!layer||layer.dataset.w7Mounted||/^\/(research|identity)(\/|$)/.test(location.pathname)||document.body.dataset.tool==='3d-world')return;
 layer.dataset.w7Mounted='true';
 const life=new AbortController(),signal=life.signal;
 const on=(node,event,fn)=>node.addEventListener(event,fn,{signal});
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const queries=[matchMedia('(min-width:1800px) and (min-height:680px)'),matchMedia('(min-width:1920px) and (min-height:850px)'),matchMedia('(min-width:2560px) and (min-height:1000px)'),matchMedia('(min-width:3200px) and (min-height:1250px)')];
 const states=[...layer.querySelectorAll('[data-w7-id]')].map(node=>({node,id:Number(node.dataset.w7Id),batch:Number(node.dataset.w7Batch),motion:node.dataset.w7Motion,x:0,y:0,dx:0,dy:0,next:0,active:false,drag:false,origin:null,phase:Number(node.dataset.w7Id)*1.79}));
 let timer=0,last=0,elapsed=0,stopped=false,running=false;

 function draw(state){
  state.node.style.setProperty('--w7-x',`${state.x.toFixed(1)}px`);
  state.node.style.setProperty('--w7-y',`${state.y.toFixed(1)}px`);
 }
 function offset(state,x,y){
  const rect=state.node.getBoundingClientRect();
  const shiftX=Math.max(10-rect.left,Math.min(innerWidth-10-rect.right,x));
  const shiftY=Math.max(112-rect.top,Math.min(innerHeight-12-rect.bottom,y));
  state.dx+=shiftX;state.dy+=shiftY;
  state.node.style.setProperty('--w7-dx',`${state.dx.toFixed(1)}px`);
  state.node.style.setProperty('--w7-dy',`${state.dy.toFixed(1)}px`);
 }
 function release(state){
  if(state.origin){const handle=state.node.querySelector('[data-w7-handle]');if(handle?.hasPointerCapture(state.origin.id))handle.releasePointerCapture(state.origin.id);}
  state.drag=false;state.origin=null;
 }
 for(const state of states){
  const handle=state.node.querySelector('[data-w7-handle]');
  if(handle){
   on(handle,'pointerdown',event=>{
    if(event.button!==0||!state.active||(event.target.closest('a,button,input,select,textarea')&&event.target!==handle))return;
    state.drag=true;state.origin={id:event.pointerId,x:event.clientX,y:event.clientY};
    handle.setPointerCapture(event.pointerId);event.preventDefault();
   });
   on(handle,'pointermove',event=>{
    if(!state.drag||state.origin?.id!==event.pointerId)return;
    offset(state,event.clientX-state.origin.x,event.clientY-state.origin.y);
    state.origin.x=event.clientX;state.origin.y=event.clientY;
   });
   for(const event of ['pointerup','pointercancel','lostpointercapture'])on(handle,event,()=>release(state));
   on(handle,'keydown',event=>{
    const direction={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]}[event.key];
    if(event.target!==handle||!state.active||!direction)return;
    event.preventDefault();offset(state,...direction);
   });
  }
  for(const close of state.node.querySelectorAll('[data-w7-close]'))on(close,'click',()=>{release(state);state.node.hidden=true;sync();});
 }

 function tick(){
  timer=0;
  if(!running||stopped)return;
  const now=performance.now();
  if(last)elapsed+=Math.max(0,Math.min(300,now-last));
  last=now;
  for(const state of states){
   if(!state.active||state.drag||state.node.matches(':focus-within')||!state.motion)continue;
   const time=elapsed/1000+state.phase;
   if(state.motion==='drift'){state.x=Math.sin(time*.19)*56;state.y=Math.sin(time*.13)*24;draw(state);}
   if(state.motion==='route'){
    const route=(time*.035)%1;
    state.x=route<.5?route*188:(1-route)*188;
    state.y=route<.25?0:route<.5?(route-.25)*108:route<.75?27:(1-route)*108;
    draw(state);
   }
   if(elapsed<state.next)continue;
   if(state.motion==='twitch'){
    const twitch=Math.random()<.44;
    state.x=twitch?(Math.random()-.5)*20:0;state.y=twitch?(Math.random()-.5)*12:0;
    state.next=elapsed+(twitch?240+Math.random()*360:1500+Math.random()*2800);draw(state);
   }
   if(state.motion==='step'){
    state.x=(Math.random()-.5)*130;state.y=(Math.random()-.5)*52;
    state.next=elapsed+3100+Math.random()*3900;draw(state);
   }
   if(state.motion==='blink'){
    const dim=!state.node.hasAttribute('data-w7-blink');
    state.node.toggleAttribute('data-w7-blink',dim);
    state.next=elapsed+(dim?320+Math.random()*500:2100+Math.random()*3800);
   }
  }
  timer=setTimeout(tick,120);
 }
 function sync(){
  clearTimeout(timer);timer=0;last=0;
  const open=queries[0].matches&&document.body.dataset.cover!=='true'&&!document.hidden&&!stopped;
  let visible=0;
  for(const state of states){
   state.active=open&&queries[state.batch].matches&&!state.node.hidden;
   if(state.active){visible++;if(state.dx||state.dy)offset(state,0,0);}
   else release(state);
  }
  layer.inert=!open;
  layer.dataset.w7Visible=String(visible);
  running=open&&!reduced.matches&&states.some(state=>state.active&&state.motion);
  layer.dataset.w7Running=String(running);
  if(running)timer=setTimeout(tick,120);
 }
 function dispose(){
  if(stopped)return;
  stopped=true;running=false;clearTimeout(timer);observer.disconnect();
  for(const state of states)release(state);
  life.abort();delete layer.dataset.w7Mounted;
 }
 const observer=new MutationObserver(sync);
 observer.observe(document.body,{attributes:true,attributeFilter:['data-cover']});
 for(const query of queries)on(query,'change',sync);
 on(reduced,'change',()=>{if(reduced.matches)for(const state of states){state.x=state.y=0;draw(state);state.node.removeAttribute('data-w7-blink');}sync();});
 on(document,'visibilitychange',sync);
 on(window,'resize',sync);
 on(document,'astro:before-swap',dispose);
 on(window,'pagehide',event=>{if(event.persisted){running=false;clearTimeout(timer);last=0;layer.dataset.w7Running='false';}else dispose();});
 on(window,'pageshow',sync);
 sync();
}
mountWideFragments();
document.addEventListener('astro:page-load',mountWideFragments);
