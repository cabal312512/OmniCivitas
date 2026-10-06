export const scale=[0,2,4,5,7,9,11];
export function notation(text,tempo=108){
 if(text.length>1200||/[^0-7#b_',.\s|\-]/.test(text))throw Error('简谱只接受 0—7、#、b、横线、逗号、单引号和下划线');
 const tokens=text.match(/[0-7][#b]?[',]*_*\.?|\-/g)||[],beat=60000/tempo;let t=0,lastNote=null;const events=[];
 for(const token of tokens){
  if(token==='-'){if(lastNote)lastNote.d=Math.min(4000,lastNote.d+beat);t+=beat;continue;}
  const d=beat/2**((token.match(/_/g)||[]).length)*(token.endsWith('.')?1.5:1);lastNote=null;if(token[0]!=='0'){
   const n=60+scale[+token[0]-1]+(token.includes('#')?1:token.includes('b')?-1:0)+12*((token.match(/'/g)||[]).length-(token.match(/,/g)||[]).length);
   if(n<48||n>84)throw Error('音域为 C3—C6');lastNote={n,t:Math.round(t),d:Math.max(40,Math.min(4000,Math.round(d*.9))),v:.68};events.push(lastNote);
  }t+=d;
 }
 if(events.length>256||t>600000)throw Error('单份录音最多 256 个音符、10 分钟');return events;
}
export class Piano{
 context=null;voices=new Map();volume=.7;timers=new Set();
 async open(){if(!this.context){this.context=new AudioContext();this.master=this.context.createGain();this.master.gain.value=this.volume;this.master.connect(this.context.destination);const delay=this.context.createDelay(.5),wet=this.context.createGain();delay.delayTime.value=.19;wet.gain.value=.12;this.master.connect(delay);delay.connect(wet);wet.connect(this.context.destination);}await this.context.resume();}
 level(v){this.volume=v;if(this.master)this.master.gain.setTargetAtTime(v,this.context.currentTime,.03);}
 press(n,v=.7){if(!this.context||this.voices.has(n)||this.voices.size>=16)return;const c=this.context,g=c.createGain(),os=[c.createOscillator(),c.createOscillator()];g.gain.setValueAtTime(.0001,c.currentTime);g.gain.exponentialRampToValueAtTime(v*.18,c.currentTime+.012);g.gain.exponentialRampToValueAtTime(v*.07,c.currentTime+.6);g.connect(this.master);os.forEach((o,i)=>{o.type=i?'triangle':'sine';o.frequency.value=440*2**((n-69)/12);o.detune.value=i?3:0;o.connect(g);o.start();});this.voices.set(n,{g,os});}
 release(n){const voice=this.voices.get(n);if(!voice||!this.context)return;this.voices.delete(n);const c=this.context;voice.g.gain.cancelScheduledValues(c.currentTime);voice.g.gain.setTargetAtTime(.0001,c.currentTime,.045);voice.os.forEach(o=>o.stop(c.currentTime+.28));voice.os[0].onended=()=>{voice.g.disconnect();voice.os.forEach(o=>o.disconnect());};}
 sequence(events,onNote){this.stop();events.forEach(e=>{const timer=setTimeout(()=>{this.timers.delete(timer);this.press(e.n,e.v);onNote?.(e.n,true);const end=setTimeout(()=>{this.timers.delete(end);this.release(e.n);onNote?.(e.n,false);},e.d);this.timers.add(end);},e.t);this.timers.add(timer);});}
 stop(){for(const timer of this.timers)clearTimeout(timer);this.timers.clear();for(const n of this.voices.keys())this.release(n);}
 close(){this.stop();void this.context?.close();this.context=null;}
}
export function midi(events,tempo){
 const bytes=[],pushInt=(n,count)=>{for(let i=count-1;i>=0;i--)bytes.push(n>>>(i*8)&255);};
 const ascii=s=>bytes.push(...Array.from(s,c=>c.charCodeAt(0)));ascii('MThd');pushInt(6,4);pushInt(0,2);pushInt(1,2);pushInt(480,2);
 const track=[],delta=n=>{const b=[n&127];while(n>>=7)b.unshift((n&127)|128);track.push(...b);};
 const micro=Math.round(60000000/tempo);track.push(0,255,81,3,micro>>16&255,micro>>8&255,micro&255,0,192,0);
 const timeline=events.flatMap(e=>[{t:Math.round(e.t/60000*tempo*480),n:e.n,v:Math.round(e.v*100),on:true},{t:Math.round((e.t+e.d)/60000*tempo*480),n:e.n,v:0,on:false}]).sort((a,b)=>a.t-b.t||Number(a.on)-Number(b.on));
 let last=0;for(const e of timeline){delta(e.t-last);track.push(e.on?144:128,e.n,e.v);last=e.t;}track.push(0,255,47,0);ascii('MTrk');pushInt(track.length,4);bytes.push(...track);return new Uint8Array(bytes);
}
export async function localWav(events){
 const rate=22050,duration=Math.min(604,(Math.max(...events.map(e=>e.t+e.d))+350)/1000),c=new OfflineAudioContext(1,Math.ceil(duration*rate),rate);
 for(const e of events){const o=c.createOscillator(),g=c.createGain(),t=e.t/1000,end=t+e.d/1000;o.frequency.value=440*2**((e.n-69)/12);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(e.v*.18,t+.01);g.gain.exponentialRampToValueAtTime(.0001,end+.15);o.connect(g);g.connect(c.destination);o.start(t);o.stop(end+.2);}
 const rendered=await c.startRendering(),samples=rendered.getChannelData(0),bytes=new ArrayBuffer(44+samples.length*2),v=new DataView(bytes),s=(offset,text)=>[...text].forEach((char,i)=>v.setUint8(offset+i,char.charCodeAt(0)));
 s(0,'RIFF');v.setUint32(4,bytes.byteLength-8,true);s(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);s(36,'data');v.setUint32(40,samples.length*2,true);samples.forEach((sample,i)=>v.setInt16(44+i*2,Math.round(Math.tanh(sample)*32760),true));return bytes;
}
