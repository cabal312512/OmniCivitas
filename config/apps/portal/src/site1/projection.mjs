import {submitAndWait} from './client.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const messages=new Set(['hello','where','again','bye']);
let pending=[],timer=0,active=false,lifetime=new AbortController(),suspended=false;

function storedSession(key){
 for(const store of [()=>localStorage,()=>sessionStorage])try{const session=JSON.parse(store().getItem(key)||'null')?.session;if(uuid.test(session||''))return session;}catch{}
 return null;
}
export function projectionSessions({session,profileSession}={}){
 try{session??=window.__ocvHunt?.snapshot?.().session;}catch{}
 session??=storedSession('ocv.q8.hunt.v1')||profileSession||storedSession('ocv.desk.v1');profileSession??=storedSession('ocv.desk.v1')||session;
 return uuid.test(session||'')&&uuid.test(profileSession||'')?{session,profileSession}:null;
}
export function dialogueMessage(word){
 const text=String(word||'').trim().toLowerCase();
 if(/再见|拜拜|^bye$|^goodbye$/.test(text))return 'bye';
 if(/哪里|在哪|地图|^where$/.test(text))return 'where';
 if(/又|再来|再次|回来|^again$/.test(text))return 'again';
 return 'hello';
}
function cleanEvent(kind,data){
 if(kind==='collect'&&Number.isInteger(data?.slot)&&data.slot>=0&&data.slot<30)return {slot:data.slot};
 if(kind==='favorite'&&/^[a-zA-Z0-9_-]{1,80}$/.test(data?.id||'')&&['default','tools','pages'].includes(data?.folder)&&['add','remove','move'].includes(data?.action))return {id:data.id,folder:data.folder,action:data.action};
 if(kind==='talk'&&messages.has(data?.message))return {message:data.message};
 if(kind==='achievement'&&['hunt-30','favorite-first','visitor-return'].includes(data?.code))return {code:data.code};
 return null;
}
export function projectEvents(events,context={}){
 const sessions=projectionSessions(context);
 if(!sessions||suspended||context.signal?.aborted||!Array.isArray(events)||!events.length||events.length>120)return Promise.resolve(null);
 const prepared=events.map(event=>{const data=cleanEvent(event?.kind,event?.data);return data?{id:uuid.test(event.id||'')?event.id:crypto.randomUUID(),kind:event.kind,data}:null;});
 if(prepared.some(event=>!event)||pending.reduce((count,entry)=>count+entry.events.length,0)+prepared.length>120)return Promise.resolve(null);
 return new Promise(resolve=>{
  pending.push({...sessions,events:prepared,signal:context.signal,onState:context.onState,expires:Date.now()+120000,resolve});
  if(!active&&!timer)timer=setTimeout(()=>{timer=0;void flush();},250);
 });
}
async function flush(){
 if(active||suspended)return;active=true;
 try{
  while(pending.length&&!suspended){
   const first=pending.shift();if(first.signal?.aborted||first.expires<=Date.now()){first.resolve(null);continue;}
   const group=[first];let count=first.events.length;
   // Batching keeps each component's original cancellation scope intact.
   while(pending.length&&count+pending[0].events.length<=120&&pending[0].session===first.session&&pending[0].profileSession===first.profileSession&&pending[0].signal===first.signal){const next=pending.shift();count+=next.events.length;group.push(next);}
   const events=group.flatMap(entry=>entry.events),signals=[lifetime.signal,AbortSignal.timeout(Math.max(1,first.expires-Date.now())),...(first.signal?[first.signal]:[])];
   let result=null;
   try{
    for(let at=0;at<events.length;at+=16){
     const received=await submitAndWait({kind:'projection',session:first.session,profileSession:first.profileSession,events:events.slice(at,at+16)},{signal:AbortSignal.any(signals),onState:first.onState});
     result=received?.result?.projection||received?.result;
     if(!result||typeof result!=='object')throw Error('没有回执');
    }
    document.dispatchEvent(new CustomEvent('ocv:site-projection',{detail:{kind:'projection',session:first.session,ready:true}}));
   }catch{result=null;}
   for(const entry of group)entry.resolve(entry.signal?.aborted?null:result);
  }
 }finally{active=false;if(pending.length&&!suspended&&!timer)timer=setTimeout(()=>{timer=0;void flush();},250);}
}
window.addEventListener('pagehide',()=>{suspended=true;clearTimeout(timer);timer=0;lifetime.abort();for(const entry of pending)entry.resolve(null);pending=[];});
window.addEventListener('pageshow',event=>{if(event.persisted){suspended=false;lifetime=new AbortController();}});
