import uniq from 'lodash/uniq.js';
import {pipe,filter,sort} from 'ramda';
import {withNickname} from '../q9/voice.mjs';
const key='ocv.q8.hunt.v1';
const clean=pipe(uniq,filter(n=>Number.isInteger(n)&&n>=0&&n<30),sort((a,b)=>a-b));
let storage;try{storage=localStorage;storage.getItem(key);}catch{try{storage=sessionStorage;}catch{}}
let state={session:crypto.randomUUID(),found:[],awarded:false};
try{const row=JSON.parse(storage?.getItem(key)||'null');if(row&&/^[a-f0-9-]{36}$/.test(row.session)&&Array.isArray(row.found))state={session:row.session,found:clean(row.found),awarded:row.awarded===true};}catch{}
const life=new AbortController();let syncing=false,again=false;
function save(){state.found=clean(state.found);try{storage?.setItem(key,JSON.stringify(state));}catch{try{storage=sessionStorage;storage.setItem(key,JSON.stringify(state));}catch{}}}
export function huntState(){return {...state,found:[...state.found],count:state.found.length};}
export function say(text,pitch=64){try{speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(withNickname(text));speech.lang=/[ぁ-んァ-ン]/.test(text)?'ja-JP':/[가-힣]/.test(text)?'ko-KR':'zh-CN';speech.rate=1.05;speech.pitch=.8+(pitch-48)/60;speechSynthesis.speak(speech);}catch{}}
function award(){if(state.found.length!==30||state.awarded)return;state.awarded=true;save();const pane=document.createElement('aside');pane.className='q8-award';pane.setAttribute('role','dialog');pane.setAttribute('aria-label','捉迷藏成就');pane.innerHTML='<button aria-label="关闭">×</button><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="31"/><path d="M18 73L5 96 36 82M82 73L95 96 64 82M25 55Q10 21 31 28L25 9 47 22 65 8 72 32Q86 61 64 73Q41 83 25 55M35 42v8M60 40v8M43 58q5 5 11-1"/></svg><b>30 / 30</b><span>都找到了。</span><a href="/maze/aside/">去看看 ↗</a>';pane.querySelector('button').onclick=()=>pane.remove();document.body.append(pane);}
export async function syncHunt(){
 if(syncing){again=true;return null;}syncing=true;
 try{const r=await fetch('/api/q8/collect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:state.session,ids:state.found}),signal:AbortSignal.any([life.signal,AbortSignal.timeout(5000)]),credentials:'omit'});if(!r.ok)throw Error();const p=await r.json();if(!Number.isInteger(p.mask)||p.mask<0||p.mask>1073741823)throw Error();state.found=clean(state.found.concat(Array.from({length:30},(_,i)=>i).filter(i=>p.mask&(1<<i))));save();paint();award();document.dispatchEvent(new CustomEvent('q8:progress',{detail:{...p,count:state.found.length}}));return p;
 }catch{document.dispatchEvent(new CustomEvent('q8:progress',{detail:{count:state.found.length,storage:'local'}}));return null;}finally{syncing=false;if(again&&!life.signal.aborted){again=false;void syncHunt();}}
}
function paint(){document.querySelectorAll('[data-q8-creature]').forEach(node=>node.hidden=state.found.includes(+node.dataset.id));}
for(const node of document.querySelectorAll('[data-q8-creature]'))node.addEventListener('click',()=>{if(node.hidden)return;state.found.push(+node.dataset.id);save();node.hidden=true;say(node.dataset.say,+node.dataset.pitch);award();void syncHunt();},{signal:life.signal});
window.__ocvHunt={snapshot:huntState};paint();save();
if(document.querySelector('[data-q8-creature],[data-q8-resident]'))void syncHunt();
window.addEventListener('pagehide',e=>{try{speechSynthesis.cancel();}catch{}if(!e.persisted)life.abort();},{signal:life.signal});

function refresh(){try{const latest=JSON.parse(storage?.getItem(key)||'null');if(latest?.session===state.session){state.found=clean(state.found.concat(latest.found||[]));state.awarded||=latest.awarded===true;paint();award();document.dispatchEvent(new CustomEvent('q8:progress',{detail:{count:state.found.length,storage:'local'}}));}}catch{}}
window.addEventListener('pageshow',refresh,{signal:life.signal});window.addEventListener('storage',e=>{if(e.key===key)refresh();},{signal:life.signal});
