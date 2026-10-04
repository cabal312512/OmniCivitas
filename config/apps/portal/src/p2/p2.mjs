const frame=document.querySelector('[data-p2-frame]');
if(frame){
 const lifetime=new AbortController(),on=(target,type,callback)=>target?.addEventListener(type,callback,{signal:lifetime.signal});
 const voice=frame.dataset.p2Frame==='7',audio=voice?new Audio():null;
 const state={kind:frame.dataset.p2Frame,requests:0,index:null,playing:false,failed:false,closed:false,disposed:false,x:0,y:0};
 let serial=0,drag=null;
 if(audio){audio.preload='none';audio.loop=false;audio.volume=.8;}
 function paint(){frame.dataset.playing=String(state.playing);frame.dataset.failed=String(state.failed);frame.querySelector('[data-p2-status]').textContent=state.failed?'×':'';}
 function stop(release=false){serial++;if(audio){audio.pause();if(release){audio.removeAttribute('src');audio.load();}}state.playing=false;paint();}
 function play(){
  if(!audio||state.closed||state.disposed)return;
  const job=++serial,index=crypto.getRandomValues(new Uint32Array(1))[0]%5;
  audio.pause();audio.src=`/forgotten-cache/p2/a${index}.mp3`;audio.loop=false;audio.currentTime=0;
  state.index=index;state.requests++;state.failed=false;state.playing=false;paint();
  audio.play().then(()=>{if(job!==serial)return;state.playing=true;paint();}).catch(error=>{if(job!==serial||error.name==='AbortError')return;state.failed=true;state.playing=false;paint();});
 }
 on(audio,'ended',()=>{state.playing=false;paint();});on(audio,'error',()=>{if(state.closed||state.disposed)return;state.playing=false;state.failed=true;paint();});
 on(frame.querySelector('[data-p2-play]'),'click',play);
 on(frame.querySelector('[data-p2-close]'),'click',()=>{state.closed=true;frame.hidden=true;stop(true);});
 const handle=frame.querySelector('[data-p2-handle]');
 function move(x,y){
  state.x=Math.max(-innerWidth*.8,Math.min(innerWidth*.8,x));state.y=Math.max(-innerHeight*.8,Math.min(innerHeight*.8,y));
  frame.style.setProperty('--p2-x',state.x+'px');frame.style.setProperty('--p2-y',state.y+'px');
 }
 on(handle,'pointerdown',event=>{if(event.button!==0)return;drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,x:state.x,y:state.y};handle.setPointerCapture(event.pointerId);event.preventDefault();});
 on(handle,'pointermove',event=>{if(drag?.id===event.pointerId)move(drag.x+event.clientX-drag.startX,drag.y+event.clientY-drag.startY);});
 on(handle,'pointerup',()=>drag=null);on(handle,'pointercancel',()=>drag=null);
 on(handle,'keydown',event=>{const step={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]}[event.key];if(step){event.preventDefault();move(state.x+step[0],state.y+step[1]);}});
 on(document,'visibilitychange',()=>{if(document.hidden)stop();});
 on(window,'pagehide',event=>{stop(!event.persisted);if(!event.persisted){state.disposed=true;drag=null;lifetime.abort();}});
 Object.defineProperty(window,'__ocvMediaFrame',{configurable:true,value:Object.freeze({snapshot:()=>({...state,src:audio?.src??null,paused:audio?.paused??true,loop:audio?.loop??false,currentTime:audio?.currentTime??0,duration:Number.isFinite(audio?.duration)?audio.duration:null})})});
 paint();
}
