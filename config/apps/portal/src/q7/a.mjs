// A separate namespace leaves the existing window handlers and all research pages alone.
function mount(){
 const layer=document.querySelector('[data-n3-layer]');
 if(!layer||layer.dataset.n3Mounted)return;
 layer.dataset.n3Mounted='true';
 const lifetime=new AbortController(),signal=lifetime.signal;
 const on=(node,event,fn)=>node.addEventListener(event,fn,{signal});
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const states=[...layer.querySelectorAll('[data-n3-kind]')].map(node=>({node,kind:Number(node.dataset.n3Kind),motion:node.dataset.n3Motion,x:0,y:0,dx:0,dy:0,drag:false,next:0,phase:Math.random()*6.28,pulse:0}));
 let frame=0,elapsed=0,last=0,stopped=false;
 function draw(s){s.node.style.setProperty('--n3-x',`${s.x}px`);s.node.style.setProperty('--n3-y',`${s.y}px`);}
 for(const s of states){
  const handle=s.node.querySelector('[data-n3-handle]');
  if(handle){
   let origin;
   on(handle,'pointerdown',e=>{if(e.target.closest('a,button')&&e.target!==handle)return;s.drag=true;origin={id:e.pointerId,x:e.clientX,y:e.clientY,dx:s.dx,dy:s.dy};handle.setPointerCapture(e.pointerId);e.preventDefault();});
   on(handle,'pointermove',e=>{if(!s.drag||origin.id!==e.pointerId)return;s.dx=Math.max(-innerWidth,Math.min(innerWidth,origin.dx+e.clientX-origin.x));s.dy=Math.max(-innerHeight,Math.min(innerHeight,origin.dy+e.clientY-origin.y));s.node.style.setProperty('--n3-dx',`${s.dx}px`);s.node.style.setProperty('--n3-dy',`${s.dy}px`);});
   for(const event of ['pointerup','pointercancel','lostpointercapture'])on(handle,event,()=>{s.drag=false;});
   on(handle,'keydown',e=>{const dirs={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]};if(!dirs[e.key])return;e.preventDefault();s.dx=Math.max(-innerWidth,Math.min(innerWidth,s.dx+dirs[e.key][0]));s.dy=Math.max(-innerHeight,Math.min(innerHeight,s.dy+dirs[e.key][1]));s.node.style.setProperty('--n3-dx',`${s.dx}px`);s.node.style.setProperty('--n3-dy',`${s.dy}px`);});
  }
  for(const close of s.node.querySelectorAll('[data-n3-close]'))on(close,'click',()=>{s.node.hidden=true;});
  const add=s.node.querySelector('[data-n3-add]');
  if(add)on(add,'click',()=>{const counter=s.node.querySelector('[data-n3-count]');counter.textContent=String((Number(counter.textContent)+1)%1000).padStart(2,'0');});
  const pulse=s.node.querySelector('[data-n3-pulse]');
  if(pulse)on(pulse,'click',()=>{s.pulse=elapsed+500;s.node.setAttribute('data-n3-pulsed','');});
 }
 function tick(now){
  if(stopped)return;
  if(last)elapsed+=Math.min(40,Math.max(0,now-last));last=now;
  for(const s of states){
   if(s.node.hidden)continue;
   if(s.pulse&&elapsed>s.pulse){s.pulse=0;s.node.removeAttribute('data-n3-pulsed');}
   if(reduce.matches||s.drag||s.node.matches(':focus-within'))continue;
   const t=elapsed/1000+s.phase;
   if(s.motion==='orbit'){s.x=Math.sin(t*.37)*145;s.y=Math.cos(t*.61)*72;draw(s);}
   if(s.motion==='crawl'){s.x=Math.sin(t*.14)*245;s.y=Math.sin(t*.27)*48;draw(s);}
   if(s.motion==='rail'){s.x=Math.sin(t*.32)*27;s.y=Math.sin(t*.19)*155;draw(s);}
   if((s.motion==='jump'||s.motion==='spasm'||s.motion==='blink')&&elapsed>=s.next){
    s.next=elapsed+(s.motion==='spasm'?(Math.random()<.55?80+Math.random()*120:1200+Math.random()*3100):900+Math.random()*2800);
    if(s.motion==='blink')s.node.toggleAttribute('data-n3-blink');
    else{s.x=(Math.random()-.5)*(s.motion==='jump'?390:42);s.y=(Math.random()-.5)*(s.motion==='jump'?210:27);draw(s);}
   }
  }
  frame=requestAnimationFrame(tick);
 }
 function sync(){cancelAnimationFrame(frame);last=0;if(!document.hidden&&document.body.dataset.cover!=='true'&&!stopped)frame=requestAnimationFrame(tick);}
 const observer=new MutationObserver(sync);observer.observe(document.body,{attributes:true,attributeFilter:['data-cover']});
 on(document,'visibilitychange',sync);
 on(reduce,'change',()=>{if(reduce.matches)for(const s of states){s.x=s.y=0;draw(s);s.node.removeAttribute('data-n3-blink');}sync();});
 function dispose(){if(stopped)return;stopped=true;cancelAnimationFrame(frame);observer.disconnect();lifetime.abort();}
 on(document,'astro:before-swap',dispose);
 on(window,'pagehide',e=>{if(e.persisted){cancelAnimationFrame(frame);last=0;}else dispose();});
 on(window,'pageshow',sync);
 sync();
}
mount();document.addEventListener('astro:page-load',mount);
