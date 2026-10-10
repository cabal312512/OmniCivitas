import uniq from 'lodash/uniq.js';
import {pipe,filter,sort} from 'ramda';
import {withNickname} from '../q9/voice.mjs';
import {projectEvents} from '../site1/projection.mjs';
import {createCreatureStage} from './creature.mjs';
import {playInteractionSound,interactionSoundSnapshot} from '../q7/interaction-sound.mjs';
import {residentPreviewUnlocked,residentPreviewKey} from './resident-preview.mjs';
const key='ocv.q8.hunt.v1';
const clean=pipe(uniq,filter(n=>Number.isInteger(n)&&n>=0&&n<30),sort((a,b)=>a-b));
let storage;try{storage=localStorage;storage.getItem(key);}catch{try{storage=sessionStorage;}catch{}}
let state={session:crypto.randomUUID(),found:[],awarded:false};
try{const row=JSON.parse(storage?.getItem(key)||'null');if(row&&/^[a-f0-9-]{36}$/.test(row.session)&&Array.isArray(row.found))state={session:row.session,found:clean(row.found),awarded:row.awarded===true};}catch{}
const life=new AbortController(),projectionSlots=new Set(),departures=new Map();let syncing=false,again=false,projectedAward=false;
export const creatures=createCreatureStage({signal:life.signal});
function save(){state.found=clean(state.found);try{storage?.setItem(key,JSON.stringify(state));}catch{try{storage=sessionStorage;storage.setItem(key,JSON.stringify(state));}catch{}}}
export function huntState(){return {...state,found:[...state.found],count:state.found.length,residentPreview:residentPreviewUnlocked()};}
export function say(text,pitch=64,actor){const spoken=withNickname(text);document.dispatchEvent(new CustomEvent('q8:speech',{detail:{text:spoken,actor}}));}
function award(){if(state.found.length!==30||state.awarded)return;state.awarded=true;save();const pane=document.createElement('aside');pane.className='q8-award';pane.setAttribute('role','dialog');pane.setAttribute('aria-label','捉迷藏成就');pane.innerHTML='<button aria-label="关闭">×</button><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="31"/><path d="M18 73L5 96 36 82M82 73L95 96 64 82M25 55Q10 21 31 28L25 9 47 22 65 8 72 32Q86 61 64 73Q41 83 25 55M35 42v8M60 40v8M43 58q5 5 11-1"/></svg><b>30 / 30</b><span>都找到了。</span><a href="/maze/aside/">去看看 ↗</a>';pane.querySelector('button').onclick=()=>pane.remove();document.body.append(pane);}
export async function syncHunt(){
 if(syncing){again=true;return null;}syncing=true;
 try{const r=await fetch('/api/q8/collect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:state.session,ids:state.found}),signal:AbortSignal.any([life.signal,AbortSignal.timeout(5000)]),credentials:'omit'});if(!r.ok)throw Error();const p=await r.json();if(!Number.isInteger(p.mask)||p.mask<0||p.mask>1073741823)throw Error();state.found=clean(state.found.concat(Array.from({length:30},(_,i)=>i).filter(i=>p.mask&(1<<i))));save();paint();award();document.dispatchEvent(new CustomEvent('q8:progress',{detail:{...p,count:state.found.length}}));if(p.storage==='postgresql'){const accepted=[...projectionSlots].filter(slot=>p.mask&(1<<slot));for(const slot of accepted)projectionSlots.delete(slot);const events=accepted.map(slot=>({kind:'collect',data:{slot}}));if(events.length&&p.mask===1073741823&&!projectedAward){events.push({kind:'achievement',data:{code:'hunt-30'}});projectedAward=true;}if(events.length)void projectEvents(events,{session:state.session,signal:life.signal});}return p;
 }catch{document.dispatchEvent(new CustomEvent('q8:progress',{detail:{count:state.found.length,storage:'local'}}));return null;}finally{syncing=false;if(again&&!life.signal.aborted){again=false;void syncHunt();}}
}
function finishCollection(node){const timer=departures.get(node);if(timer!==undefined)clearTimeout(timer);departures.delete(node);node.hidden=true;node.removeAttribute('data-q8-collecting');creatures.refresh();}
function paint(){document.querySelectorAll('[data-q8-creature]').forEach(node=>node.hidden=state.found.includes(+node.dataset.id)&&!departures.has(node));creatures.refresh();}
document.addEventListener('q8:preview',()=>{paint();document.dispatchEvent(new CustomEvent('q8:progress',{detail:{count:state.found.length,residentPreview:residentPreviewUnlocked(),storage:'local'}}));},{signal:life.signal});
for(const node of document.querySelectorAll('[data-q8-creature]'))node.addEventListener('click',()=>{if(node.hidden||departures.has(node)||state.found.includes(+node.dataset.id))return;playInteractionSound('collect',{form:node.dataset.q8Form});state.found.push(+node.dataset.id);projectionSlots.add(+node.dataset.id);save();node.disabled=true;node.dataset.q8Collecting='true';creatures.perform(node,'resonate',{force:true,duration:500});departures.set(node,setTimeout(()=>finishCollection(node),500));say(node.dataset.say,+node.dataset.pitch,node);const status=document.querySelector('[data-q8-status]');if(status)status.textContent=`已找到：${state.found.length} / 30`;award();void syncHunt();},{signal:life.signal});
window.__ocvHunt={snapshot:huntState,creatures:creatures.snapshot,sound:interactionSoundSnapshot};paint();save();
if(document.querySelector('[data-q8-creature],[data-q8-resident]'))void syncHunt();
function hush(){for(const node of [...departures.keys()])finishCollection(node);document.dispatchEvent(new CustomEvent('q8:speech',{detail:{active:false}}));}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')hush();},{signal:life.signal});
window.addEventListener('pagehide',e=>{hush();if(!e.persisted)life.abort();},{signal:life.signal});

function refresh(){try{const latest=JSON.parse(storage?.getItem(key)||'null');if(latest?.session===state.session){state.found=clean(state.found.concat(latest.found||[]));state.awarded||=latest.awarded===true;paint();award();document.dispatchEvent(new CustomEvent('q8:progress',{detail:{count:state.found.length,storage:'local'}}));}}catch{}}
window.addEventListener('pageshow',refresh,{signal:life.signal});window.addEventListener('storage',e=>{if(e.key===key)refresh();else if(e.key===residentPreviewKey&&residentPreviewUnlocked())document.dispatchEvent(new CustomEvent('q8:preview'));},{signal:life.signal});
