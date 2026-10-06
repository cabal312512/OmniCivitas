import {runMediaReceipt} from '../q7/b.mjs';

const video=document.querySelector('.media-video video');
if(video){
 const pane=video.closest('[data-n9-window]'),status=pane.querySelector('[data-video-error]');
 const audio=new Audio('/forgotten-cache/audio/video.mp3'),lifetime=new AbortController();
 audio.preload='none';audio.volume=.8;audio.loop=false;
 const state=window.__ocvVideoSound={requests:0,playing:false,phase:'idle',receipt:null};
 let pending,serial=0;
 const on=(target,type,callback)=>target.addEventListener(type,callback,{signal:lifetime.signal});
 function stop(){serial++;pending?.abort();pending=null;audio.pause();audio.currentTime=0;state.playing=false;state.phase='idle';status.textContent='';}
 async function play(){
  stop();if(video.paused||pane.hidden||document.hidden)return;
  const job=serial,controller=pending=new AbortController();
  state.requests++;state.phase='routing';state.receipt=null;status.textContent='音效 · …';
  try{
   const receipt=await runMediaReceipt('video-audio',controller.signal);
   if(job!==serial||video.paused||pane.hidden||document.hidden)return;
   state.receipt=receipt.id;state.phase='playing';
   await audio.play();
   if(job!==serial){audio.pause();return;}
   state.playing=true;status.textContent='';
  }catch{
   if(job!==serial||controller.signal.aborted)return;
   state.playing=false;state.phase='unavailable';status.textContent='音效暂未播放';
  }
 }
 on(video,'play',play);on(video,'pause',stop);on(video,'ended',stop);
 on(audio,'ended',()=>{state.playing=false;state.phase='ended';});
 on(audio,'error',()=>{if(!video.paused){state.playing=false;state.phase='unavailable';status.textContent='音效暂未播放';}});
 on(pane.querySelector('[data-n9-close]'),'click',stop);
 on(document,'visibilitychange',()=>{if(document.hidden)stop();});
 on(window,'pagehide',event=>{stop();if(!event.persisted){lifetime.abort();audio.removeAttribute('src');audio.load();}});
}
