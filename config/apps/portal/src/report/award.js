import {achievementLabels,cleanAwards,registerUse} from './price.mjs';
import {tools} from '../tool/data.mjs';
const key='ocv.awards.v1',known=new Map(tools.map(t=>[t.id,t.group]));
export function ensureAwards(){
 if(window.__ocvAwardSession)return window.__ocvAwardSession;
 const lifetime=new AbortController(),on=(n,k,f)=>n?.addEventListener(k,f,{signal:lifetime.signal});
 let state=cleanAwards(null),persist=true,channel=null,heartbeat=0,lastButton=null,clicks=0,ceremony=null,ceremonyTimer=0;
 try{state=cleanAwards(localStorage.getItem(key));}catch{persist=false;}
 state.tools=state.tools.filter(x=>known.has(x));state.groups=state.groups.filter(x=>[...known.values()].includes(x));
 const self=crypto.randomUUID(),peers=new Map(),time=()=>Date.now();
 function paint(){document.querySelectorAll('[data-civilization-index]').forEach(el=>el.textContent=state.index);document.querySelectorAll('[data-fake-stack]').forEach(el=>el.textContent=String(state.groups.length*3+7));document.body.classList.toggle('compat-acc',state.compat);const list=document.querySelector('#award-list');if(list){list.replaceChildren();for(const id of state.awards){const row=document.createElement('p');row.textContent=achievementLabels[id];list.append(row);}}const status=document.querySelector('#award-persistence');if(status)status.textContent=persist?'仅在本机保存玩笑进度':'存储不可用，当前只在内存';}
 function save(){try{localStorage.setItem(key,JSON.stringify(state));persist=true;}catch{persist=false;}paint();}
 function award(id){if(!Object.hasOwn(achievementLabels,id)||state.awards.includes(id))return;state.awards.push(id);save();if(state.compat||document.hidden||(document.body.classList.contains('luminous-home')&&scrollY<innerHeight*.72))return;
  clearTimeout(ceremonyTimer);ceremony?.remove();ceremony=document.createElement('section');ceremony.className='award-ceremony';ceremony.setAttribute('role','dialog');ceremony.setAttribute('aria-label','成就解锁');const trophy=document.createElement('div');trophy.className='award-trophy';trophy.textContent='◇';const text=document.createElement('p');text.textContent=achievementLabels[id];const foot=document.createElement('small');foot.textContent='无兑换价值';const close=document.createElement('button');close.textContent='收下';close.addEventListener('click',()=>{clearTimeout(ceremonyTimer);ceremony?.remove();ceremony=null;},{once:true});ceremony.append(trophy,text,foot,close);document.body.append(ceremony);ceremonyTimer=setTimeout(()=>{ceremony?.remove();ceremony=null;},7000);
 }
 function toolUse(id){const group=known.get(id);if(!group)return;const before=state.awards.includes('tools');state=registerUse(state,id,group);const ready=!before&&state.awards.includes('tools');if(ready)state.awards=state.awards.filter(x=>x!=='tools');save();if(ready)award('tools');}
 function tick(){const now=time();for(const [id,at]of peers)if(now-at>20000)peers.delete(id);channel?.postMessage({type:'alive',id:self});if(peers.size>=2)award('tabs');}
 try{channel=new BroadcastChannel('ocv.anonymous-tabs.v1');channel.addEventListener('message',e=>{const p=e.data;if(p&&['alive','hello','bye'].includes(p.type)&&typeof p.id==='string'&&/^[a-f0-9-]{36}$/.test(p.id)&&p.id!==self){if(p.type==='bye')peers.delete(p.id);else{if(peers.size<24||peers.has(p.id))peers.set(p.id,time());if(p.type==='hello')channel.postMessage({type:'alive',id:self});if(peers.size>=2)award('tabs');}}});channel.postMessage({type:'hello',id:self});heartbeat=setInterval(tick,5000);}catch{}
 on(document,'ocv:tool-success',e=>toolUse(e.detail?.id));
 on(document,'ocv:award',e=>award(e.detail?.id));
 on(document,'click',e=>{const button=e.target.closest?.('button');if(!button||button.matches('[data-fake]'))return;if(button===lastButton)clicks++;else{lastButton=button;clicks=1;}if(clicks===3)award('triple');});
 on(window,'storage',e=>{if(e.key===key){const incoming=cleanAwards(e.newValue);if(BigInt(incoming.index)>BigInt(state.index))state.index=incoming.index;state.awards=[...new Set([...state.awards,...incoming.awards])];state.tools=[...new Set([...state.tools,...incoming.tools.filter(x=>known.has(x))])];state.groups=[...new Set([...state.groups,...incoming.groups.filter(x=>[...known.values()].includes(x))])];state.compat=incoming.compat;paint();}});
 const nav=performance.getEntriesByType('navigation')[0];if(nav?.type==='reload')award('refreshed');
 const api={award,toolUse,compat(value){state.compat=Boolean(value);save();},snapshot:()=>({...state,awards:[...state.awards],tools:[...state.tools],groups:[...state.groups],persistence:persist?'local':'memory'})};window.__ocvAwardSession=api;paint();
 on(window,'pagehide',()=>{channel?.postMessage({type:'bye',id:self});channel?.close();clearInterval(heartbeat);clearTimeout(ceremonyTimer);ceremony?.remove();lastButton=null;});
 on(window,'pageshow',e=>{if(e.persisted){window.__ocvAwardSession=null;lifetime.abort();ensureAwards();}});
 return api;
}
