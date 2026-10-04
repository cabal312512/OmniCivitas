export const MEDAL_KEY='ocv.aero.medal.v1';
export const TROPHY_ID='aero.babel.summit.v1';
export const MEDAL_FILENAME='OmniCivitas-Summit-Medal.svg';

// This record is deliberately separate from movable checkpoints. It contains no
// account, player position, user-entered text, or arbitrary reward identifiers.
export function createMedalStore(storage){
 let memory=null,status='empty',writes=0,volatile=false;
 const copy=value=>value?{...value}:null;
 function clean(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1||value.trophyId!==TROPHY_ID)return null;
  if(!Number.isSafeInteger(value.earnedAt)||value.earnedAt<=0||value.earnedAt>8640000000000000)return null;
  return {version:1,trophyId:TROPHY_ID,earnedAt:value.earnedAt};
 }
 function target(){return typeof storage==='function'?storage():storage;}
 function read(){
  let raw;
  try{
   const actual=target();
   if(!actual){status='memory';return copy(memory);}
   raw=actual.getItem(MEDAL_KEY);
  }catch{volatile=true;status='memory';return copy(memory);}
  if(raw===null||raw===''){if(!volatile)memory=null;status=memory?'memory':'empty';return copy(memory);}
  if(typeof raw!=='string'||raw.length>1024){volatile=false;status='invalid';memory=null;return null;}
  let value;try{value=clean(JSON.parse(raw));}catch{value=null;}
  volatile=false;memory=value;status=value?'loaded':'invalid';return copy(value);
 }
 function unlock(earnedAt=Date.now()){
  const previous=read();if(previous)return copy(previous);
  const value=clean({version:1,trophyId:TROPHY_ID,earnedAt});if(!value)return null;
  memory=value;writes++;
  try{const actual=target();if(!actual)throw new Error('Storage unavailable');actual.setItem(MEDAL_KEY,JSON.stringify(value));volatile=false;status='saved';}catch{volatile=true;status='memory';}
  return copy(value);
 }
 return {read,unlock,snapshot:()=>({status,writes,persistent:status==='saved'||status==='loaded',earned:Boolean(memory),trophyId:memory?.trophyId??null,earnedAt:memory?.earnedAt??null})};
}

// Original decoration surrounds the exact O / C / V paths used by Identity.astro.
// Fixed definitions keep the exported image self-contained and independent of
// fonts, site CSS, page origin, remote pictures, and the current user's machine.
const leaves=Array.from({length:12},(_,i)=>{
 const a=(139+i*8.6)*Math.PI/180,x=256+190*Math.cos(a),y=247+190*Math.sin(a),rotation=(139+i*8.6)+47;
 return `<path d="M0 0C-3-19 11-31 17-35C18-15 13-3 0 0Z" transform="translate(${x.toFixed(3)} ${y.toFixed(3)}) rotate(${rotation.toFixed(3)})"/><path d="M0 0C3-19-11-31-17-35C-18-15-13-3 0 0Z" transform="translate(${(512-x).toFixed(3)} ${y.toFixed(3)}) rotate(${(-rotation).toFixed(3)})"/>`;
}).join('');
const ticks=Array.from({length:72},(_,i)=>`<path d="M256 64v${i%6===0?11:5}" transform="rotate(${i*5} 256 247)"/>`).join('');
export const MEDAL_SVG=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1152" viewBox="0 0 512 576" role="img" aria-labelledby="ocv-medal-title">
<title id="ocv-medal-title">OmniCivitas Summit Medal</title>
<defs>
 <linearGradient id="ocv-medal-silver" x1="0" y1="0" x2=".9" y2="1"><stop stop-color="#fff"/><stop offset=".18" stop-color="#e6f4fc"/><stop offset=".4" stop-color="#7d98af"/><stop offset=".47" stop-color="#fff"/><stop offset=".72" stop-color="#c2ddeb"/><stop offset="1" stop-color="#587d9d"/></linearGradient>
 <linearGradient id="ocv-medal-edge" x2="1" y2="1"><stop stop-color="#0c608b"/><stop offset=".35" stop-color="#d1f5ff"/><stop offset=".7" stop-color="#49799b"/><stop offset="1" stop-color="#113d62"/></linearGradient>
 <radialGradient id="ocv-medal-glass" cx=".35" cy=".2" r=".86"><stop stop-color="#fbfeff"/><stop offset=".33" stop-color="#d2f6ff"/><stop offset=".73" stop-color="#59c8e8"/><stop offset="1" stop-color="#166498"/></radialGradient>
 <linearGradient id="ocv-medal-ribbon" x2="1" y2="1"><stop stop-color="#eafcff"/><stop offset=".45" stop-color="#81cde8"/><stop offset=".5" stop-color="#265f92"/><stop offset="1" stop-color="#092d66"/></linearGradient>
 <linearGradient id="ocv-medal-metal" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#fff"/><stop offset=".21" stop-color="#d7e4ed"/><stop offset=".45" stop-color="#8ea7ba"/><stop offset=".52" stop-color="#f9fdff"/><stop offset=".75" stop-color="#c4d2de"/><stop offset="1" stop-color="#90acc4"/></linearGradient>
 <filter id="ocv-medal-shadow" x="-35%" y="-35%" width="170%" height="180%"><feDropShadow dx="0" dy="9" stdDeviation="7" flood-color="#103d63" flood-opacity=".22"/></filter>
 <filter id="ocv-medal-logo-shadow" x="-30%" y="-35%" width="160%" height="180%"><feDropShadow dx="0" dy="9" stdDeviation="5" flood-color="#0b648e" flood-opacity=".37"/></filter>
</defs>
<g filter="url(#ocv-medal-shadow)">
 <path d="m174 383-30 162 61-24 35 33 24-152Z" fill="url(#ocv-medal-ribbon)" stroke="#6dabc7" stroke-width="2"/>
 <path d="m336 383 31 162-61-24-35 33-24-152Z" fill="url(#ocv-medal-ribbon)" stroke="#6dabc7" stroke-width="2"/>
 <path d="m181 410-22 119m27-117-21 112m162-114 22 119m-27-117 21 112" fill="none" stroke="#e9faff" stroke-width="2" opacity=".8"/>
 <circle cx="256" cy="247" r="190" fill="url(#ocv-medal-silver)" stroke="url(#ocv-medal-edge)" stroke-width="5"/>
 <circle cx="256" cy="247" r="169" fill="url(#ocv-medal-glass)" stroke="#e6fbff" stroke-width="3"/>
 <circle cx="256" cy="247" r="155" fill="none" stroke="#207fab" stroke-width="1" opacity=".6"/>
 <g fill="none" stroke="#335f80" stroke-width="1.3" opacity=".65">${ticks}</g>
 <path d="M111 247c0-84 64-147 145-147 67 0 118 35 139 90-99-54-194-31-284 57Z" fill="#fff" opacity=".33"/>
 <g fill="url(#ocv-medal-silver)" stroke="#6e97ae" stroke-width=".9">${leaves}</g>
 <path d="M94 390c42 44 105 65 162 65s120-21 162-65" fill="none" stroke="url(#ocv-medal-silver)" stroke-width="4"/>
 <g fill="#f6fcff" stroke="#95cfe6" stroke-width="1.5" opacity=".5"><path d="M184 375 233 155h46l49 220Z"/><ellipse cx="256" cy="155" rx="23" ry="7"/><path d="M201 299q55 23 110 0m-103-31q48 21 96 0m-89-31q41 18 82 0m-75-31q34 14 68 0" fill="none"/></g>
 <g transform="translate(107 126) scale(.68)" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#ocv-medal-logo-shadow)">
  <g transform="translate(0 7)" stroke="url(#ocv-medal-edge)" stroke-width="39"><circle cx="155" cy="154" r="88"/><path d="M326 95a88 88 0 1 0 0 118"/><path d="M182 82l69 149 70-149"/></g>
  <g stroke="url(#ocv-medal-metal)" stroke-width="35"><circle cx="155" cy="154" r="88"/><path d="M326 95a88 88 0 1 0 0 118"/><path d="M182 82l69 149 70-149"/></g>
  <g stroke="#fff" stroke-width="1.1" opacity=".8"><path d="M70 150a84 84 0 0 1 131-68"/><path d="M324 91a87 87 0 0 0-137 46"/><path d="M183 82l69 149"/></g>
 </g>
 <g fill="url(#ocv-medal-silver)" stroke="#5b95b3" stroke-width="1.4"><path d="m256 27 8 20 22 2-17 14 6 22-19-11-19 11 6-22-17-14 22-2Z"/><path d="m155 353 5 12 13 1-10 8 4 13-12-7-11 7 3-13-10-8 13-1Zm202 0 5 12 13 1-10 8 4 13-12-7-11 7 3-13-10-8 13-1Z"/></g>
 <ellipse cx="256" cy="420" rx="30" ry="15" fill="url(#ocv-medal-silver)" stroke="#638fa9" stroke-width="2"/>
 <path d="m244 423 12-15 12 15M244 425h24" fill="none" stroke="#2a6f96" stroke-width="2.8" stroke-linejoin="round"/>
</g></svg>`;

export function createMedalBlob(BlobClass=Blob){return new BlobClass([MEDAL_SVG],{type:'image/svg+xml;charset=utf-8'});}
export function downloadMedal(documentRef=document,urlApi=URL){
 const blob=createMedalBlob(),href=urlApi.createObjectURL(blob),link=documentRef.createElement('a');
 link.href=href;link.download=MEDAL_FILENAME;link.hidden=true;documentRef.body.append(link);
 try{link.click();}finally{link.remove();setTimeout(()=>urlApi.revokeObjectURL(href),1500);}
 return {filename:MEDAL_FILENAME,bytes:blob.size,type:blob.type};
}
