import {test,expect} from 'vitest';
import {createMusic,MUSIC_TRACKS} from '../config/apps/portal/src/p2/u6.mjs';

class FakeAudio extends EventTarget{
 constructor(){super();this.paused=true;this.ended=false;this.currentTime=0;this.duration=180;this.volume=1;this.muted=false;this.playCalls=0;this.pauseCalls=0;this.loadCalls=0;this._src='';}
 get src(){return this._src;}
 set src(value){this._src=value;this.ended=false;this.currentTime=0;this.paused=true;}
 play(){this.playCalls++;this.paused=false;this.dispatchEvent(new Event('playing'));return Promise.resolve();}
 pause(){this.pauseCalls++;this.paused=true;this.dispatchEvent(new Event('pause'));}
 load(){this.loadCalls++;}
 removeAttribute(name){if(name==='src')this.src='';}
 finish(){this.ended=true;this.paused=true;this.currentTime=this.duration;this.dispatchEvent(new Event('ended'));}
}
function setup(){const audio=new FakeAudio();let allocations=0;const music=createMusic({root:null,audioFactory:()=>{allocations++;return audio;}});return{audio,music,allocations:()=>allocations};}

test('soundtrack is lazy and a first unlock creates one audio with fixed track and default volume',async()=>{
 const {music,audio,allocations}=setup();expect(allocations()).toBe(0);expect(music.snapshot()).toMatchObject({allocated:false,track:1,tracks:7,volume:.32,unlocked:false,enabled:true});
 await music.resume();expect(allocations()).toBe(0);await music.unlock();expect(allocations()).toBe(1);expect(audio).toMatchObject({src:'/aero-music/1.ogg',volume:.32,preload:'none',loop:false});
 await music.unlock();expect(allocations()).toBe(1);expect(audio.playCalls).toBe(1);expect(music.snapshot()).toMatchObject({unlocked:true,playing:true,starts:1});music.dispose();
});

test('seven real ended transitions advance the fixed playlist and return to its first track',async()=>{
 const {music,audio,allocations}=setup();await music.unlock();
 for(let end=1;end<=7;end++){audio.finish();await Promise.resolve();expect(music.snapshot().track).toBe(end%7+1);expect(audio.src).toBe(MUSIC_TRACKS[end%7].src);expect(audio.loop).toBe(false);}
 expect(allocations()).toBe(1);expect(music.snapshot()).toMatchObject({ended:7,transitions:7,track:1,playing:true});music.dispose();
});

test('independent pause reasons prevent victory or visibility from prematurely resuming another pause',async()=>{
 const {music,audio}=setup();await music.unlock();audio.currentTime=38;music.pause('victory');music.pause('hidden');
 expect(audio.paused).toBe(true);expect(music.snapshot().reasons.sort()).toEqual(['hidden','victory']);
 await music.resume('hidden');expect(audio.paused).toBe(true);expect(audio.playCalls).toBe(1);await music.resume('victory');expect(audio.paused).toBe(false);expect(audio.currentTime).toBe(38);expect(music.snapshot().paused).toBe(false);music.dispose();
});

test('music toggle preserves its track and position and off before unlock allocates no audio',async()=>{
 const {music,audio,allocations}=setup();expect(music.toggle()).toBe(false);await music.unlock();expect(allocations()).toBe(0);
 expect(music.toggle()).toBe(true);await Promise.resolve();audio.currentTime=22;expect(music.toggle()).toBe(false);expect(audio.paused).toBe(true);expect(music.snapshot().currentTime).toBe(22);
 expect(music.toggle()).toBe(true);await Promise.resolve();expect(audio.paused).toBe(false);expect(audio.src).toBe('/aero-music/1.ogg');expect(audio.currentTime).toBe(22);expect(allocations()).toBe(1);music.dispose();
});

test('soundtrack volume clamps correctly while global mute preserves its independent slider setting',async()=>{
 const {music,audio}=setup();music.setMuted(true);expect(music.setVolume(.57)).toBe(.57);await music.unlock();expect(audio.volume).toBe(.57);expect(audio.muted).toBe(true);
 music.setMuted(false);expect(audio.muted).toBe(false);expect(audio.volume).toBe(.57);expect(music.setVolume(2)).toBe(1);expect(music.setVolume(-3)).toBe(0);expect(music.setVolume(NaN)).toBe(0);expect(music.setVolume(Infinity)).toBe(0);music.dispose();
});

test('disposal is idempotent and removes the original source and owned ended listener',async()=>{
 const {music,audio}=setup();await music.unlock();music.dispose();const loads=audio.loadCalls;music.dispose();expect(audio.loadCalls).toBe(loads);expect(audio.src).toBe('');expect(audio.paused).toBe(true);
 audio.finish();expect(music.snapshot()).toMatchObject({disposed:true,playing:false,transitions:0});await music.unlock();await music.resume();expect(audio.playCalls).toBe(1);
});

test('an unavailable Audio implementation does not throw or block the game API',async()=>{
 const music=createMusic({root:null,audioFactory:()=>{throw new Error('Unavailable');}});expect(await music.unlock()).toBe(false);expect(music.snapshot()).toMatchObject({allocated:false,available:false,failed:true,playing:false});music.pause();await music.resume();music.dispose();
});

test('a refused first playback can be retried and a stale pending promise cannot undo a pause',async()=>{
 const {music,audio}=setup();let fail=true;
 audio.play=function(){this.playCalls++;if(fail)return Promise.reject(new DOMException('Playback unavailable','NotAllowedError'));this.paused=false;return Promise.resolve();};
 expect(await music.unlock()).toBe(false);expect(music.snapshot().failed).toBe(true);fail=false;expect(await music.unlock()).toBe(true);expect(audio.loadCalls).toBe(1);expect(music.snapshot().failed).toBe(false);music.pause();
 let resolve;audio.play=function(){this.playCalls++;this.paused=false;return new Promise(done=>resolve=done);};const pending=music.resume();music.pause('victory');resolve();expect(await pending).toBe(false);expect(audio.paused).toBe(true);expect(music.snapshot().reasons).toEqual(['victory']);music.dispose();
});
