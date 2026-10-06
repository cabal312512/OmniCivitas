// User-triggered, one-shot audio. Each channel replaces its previous playback.
const cue=new Audio(),music=new Audio();
cue.preload=music.preload='none';cue.loop=music.loop=false;
cue.volume=.8;music.volume=.65;
const state=window.__ocvSound={cue:{requests:0,playing:false},music:{requests:0,playing:false,index:null}};
const serial={cue:0,music:0};
function mark(channel,playing){state[channel].playing=playing;if(channel==='music')document.querySelectorAll('[data-random-music]').forEach(button=>button.dataset.playing=String(playing));}
function message(text){document.querySelectorAll('[data-sound-status]').forEach(node=>node.textContent=text);}
function start(audio,channel,src){
 const job=++serial[channel];audio.pause();audio.src=src;audio.loop=false;audio.currentTime=0;
 state[channel].requests++;state[channel].src=src;mark(channel,false);message('');
 audio.play().then(()=>{if(job===serial[channel])mark(channel,true);}).catch(error=>{if(job!==serial[channel]||error.name==='AbortError')return;mark(channel,false);message('音频未能播放');});
}
export function playCue(){start(cue,'cue','/forgotten-cache/audio/spring.mp3');}
export function playRandomMusic(){const value=crypto.getRandomValues(new Uint32Array(1))[0]%5;state.music.index=value;start(music,'music',`/forgotten-cache/audio/${value}.mp3`);}
for(const [name,audio] of [['cue',cue],['music',music]]){
 audio.addEventListener('ended',()=>mark(name,false));
 audio.addEventListener('error',()=>{mark(name,false);message('音频未能播放');});
}
document.querySelectorAll('[data-random-music]').forEach(button=>button.addEventListener('click',playRandomMusic));
window.addEventListener('pagehide',()=>{for(const [name,audio] of [['cue',cue],['music',music]]){serial[name]++;audio.pause();mark(name,false);}});
