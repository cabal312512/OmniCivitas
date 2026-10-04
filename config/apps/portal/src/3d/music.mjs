export const MUSIC_TRACKS=Object.freeze([
 ['memory of a dream','/aero-music/1.ogg'],['ever and never','/aero-music/2.ogg'],['drifting stardust','/aero-music/3.ogg'],['between the waves','/aero-music/4.ogg'],['like wild horses on the hills','/aero-music/5.ogg'],['closer','/aero-music/6.ogg'],['in the end, only sorrow','/aero-music/7.ogg'],
].map(([title,src])=>Object.freeze({title,src,author:'Efilheim'})));

// A separate, lazy HTMLAudio channel. The game supplies its real gesture and
// lifecycle hooks; soundtrack volume never changes the procedural sound gain.
export function createMusic({root=globalThis.document,audioFactory=()=>new Audio()}={}){
 const lifetime=new AbortController(),reasons=new Set(),allowedReasons=new Set(['game','hidden','victory','pagehide']);
 const toggleButton=root?.querySelector('[data-music]'),slider=root?.querySelector('[data-music-volume]');
 const on=(target,type,handler)=>target?.addEventListener(type,handler,{signal:lifetime.signal});
 let audio=null,enabled=true,muted=false,volume=.32,index=0,unlocked=false,disposed=false,available=true,failed=false,pending=false,serial=0,playRequests=0,starts=0,ended=0,transitions=0;
 const blocked=()=>disposed||!enabled||!unlocked||reasons.size>0;
 function paint(){
  toggleButton?.setAttribute('aria-pressed',String(enabled));
  if(toggleButton){toggleButton.dataset.playing=String(Boolean(audio&&!audio.paused&&!audio.ended));toggleButton.dataset.failed=String(failed);}
  if(slider&&Number(slider.value)!==volume)slider.value=String(volume);
 }
 function pauseAudio(){serial++;pending=false;audio?.pause();paint();}
 function initialize(){
  if(audio)return true;if(disposed||!available)return false;
  try{
   audio=audioFactory();audio.preload='none';audio.loop=false;audio.volume=volume;audio.muted=muted;audio.src=MUSIC_TRACKS[index].src;
   on(audio,'ended',()=>{
    if(disposed)return;ended++;transitions++;index=(index+1)%MUSIC_TRACKS.length;
    pauseAudio();audio.src=MUSIC_TRACKS[index].src;audio.currentTime=0;failed=false;paint();void play();
   });
   on(audio,'error',()=>{if(disposed)return;failed=true;pending=false;paint();});
   on(audio,'playing',paint);on(audio,'pause',paint);return true;
  }catch{available=false;audio=null;failed=true;paint();return false;}
 }
 async function play(){
  if(blocked())return false;if(!initialize())return false;
  if(!audio.paused&&!audio.ended){paint();return true;}if(pending)return false;
  const job=++serial;pending=true;playRequests++;
  try{
   if(failed)audio.load();await audio.play();
   if(job!==serial||blocked()){if(job===serial)audio.pause();return false;}
   starts++;failed=false;paint();return true;
  }catch(error){if(job===serial&&error.name!=='AbortError'){failed=true;paint();}return false;}
  finally{if(job===serial)pending=false;}
 }
 function unlock(){if(disposed)return false;unlocked=true;return play();}
 function pause(reason='game'){if(disposed)return;if(!allowedReasons.has(reason))reason='game';reasons.add(reason);pauseAudio();}
 function resume(reason='game'){if(!allowedReasons.has(reason))reason='game';reasons.delete(reason);return play();}
 function toggle(){if(disposed)return enabled;enabled=!enabled;if(!enabled)pauseAudio();else{unlocked=true;void play();}paint();return enabled;}
 function setMuted(value){muted=Boolean(value);if(audio)audio.muted=muted;paint();}
 function setVolume(value){const number=Number(value);if(!Number.isFinite(number))return volume;volume=Math.max(0,Math.min(1,number));if(audio)audio.volume=volume;paint();return volume;}
 function dispose(){if(disposed)return;disposed=true;pauseAudio();lifetime.abort();if(audio){audio.removeAttribute('src');audio.load();}reasons.clear();paint();}
 on(toggleButton,'click',event=>{if(event.isTrusted)toggle();});
 on(slider,'input',event=>{setVolume(slider.value);if(event.isTrusted)void unlock();});
 const documentRef=root?.ownerDocument||(root?.nodeType===9?root:null),windowRef=documentRef?.defaultView;
 on(documentRef,'visibilitychange',()=>{if(documentRef.hidden)pause('hidden');else void resume('hidden');});
 on(windowRef,'pagehide',event=>{if(event.persisted)pause('pagehide');else dispose();});
 on(windowRef,'pageshow',event=>{if(event.persisted)void resume('pagehide');});
 if(documentRef?.hidden)reasons.add('hidden');paint();
 return {unlock,pause,resume,dispose,setMuted,toggle,setVolume,snapshot:()=>({enabled,muted,volume,index,track:index+1,title:MUSIC_TRACKS[index].title,tracks:MUSIC_TRACKS.length,src:audio?.src??null,allocated:Boolean(audio),available,unlocked,playing:Boolean(audio&&!audio.paused&&!audio.ended&&!disposed),paused:reasons.size>0,reasons:[...reasons],audioPaused:audio?.paused??true,currentTime:audio?.currentTime??0,duration:Number.isFinite(audio?.duration)?audio.duration:null,loop:audio?.loop??false,failed,pending,playRequests,starts,ended,transitions,disposed})};
}
