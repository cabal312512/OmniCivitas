import {recommend,searchFeatures} from './catalogue.mjs';
import {readIdentity,forgetIdentity} from './identity.mjs';
import {submitAndWait} from '../site1/client.mjs';
const life=new AbortController(),on=(el,type,fn)=>el?.addEventListener(type,fn,{signal:life.signal});
const input=document.querySelector('#portal-search'),results=document.querySelector('.search-results'),voice=document.querySelector('.voice-note');
const link=(item,extra='')=>{const row=document.createElement('div');row.className='search-result '+extra;const a=document.createElement('a');a.href=item.url;a.textContent=item.title;const small=document.createElement('small');small.textContent=item.available?'↗':'尚未开放';row.append(a,small);return row;};
let searchTimer=0,indexLife=null,advanced=false;const indexSession=crypto.randomUUID();
const advancedToggle=document.createElement('button');advancedToggle.type='button';advancedToggle.dataset.advancedSearch='';advancedToggle.textContent='▸';advancedToggle.title='高级搜索';advancedToggle.setAttribute('aria-label','切换高级搜索');advancedToggle.setAttribute('aria-pressed','false');advancedToggle.style.cssText='border:1px solid #9cbbe6;color:#164dff;background:#f2f8ff;padding:0 4px;align-self:center;font:11px Arial';document.querySelector('[data-search]')?.after(advancedToggle);on(advancedToggle,'click',()=>{advanced=!advanced;advancedToggle.textContent=advanced?'▾':'▸';advancedToggle.setAttribute('aria-pressed',String(advanced));input.placeholder=advanced?'高级搜索':'搜索';if(advanced){const url=new URL(location.href);url.searchParams.delete('q');history.replaceState(null,'',url);}indexLife?.abort();results.hidden=true;input.focus();});
async function indexedSearch(){
 search(!advanced);indexLife?.abort();if(!advanced)return;const q=input?.value.trim().slice(0,80);if(!q||!results)return;
 const pending=new AbortController();indexLife=pending;
 const status=document.createElement('small');status.className='index-status';status.textContent='⋯';results.append(status);
 try{
  const receipt=await submitAndWait({kind:'index',session:indexSession,query:q,from:location.pathname,limit:12},{signal:pending.signal});
  if(pending.signal.aborted||input.value.trim().slice(0,80)!==q)return;
  const reply=receipt.result;if(!reply?.hits?.length){status.textContent='';return;}
  results.replaceChildren();for(const hit of reply.hits){if(!hit.url?.startsWith('/')||hit.url.startsWith('//'))continue;const row=link(hit,'indexed-result');row.querySelector('small').textContent=hit.evidence?.join(' · ')||'↗';results.append(row);}
  if(reply.path?.found&&reply.path.nodes.length>1){const path=document.createElement('div');path.className='index-path';for(const node of reply.path.nodes){if(!node.startsWith('/')||node.startsWith('//'))continue;const a=document.createElement('a');a.href=node;a.textContent=node;path.append(a,document.createTextNode(' → '));}path.lastChild?.remove();results.append(path);}
 }catch{if(!pending.signal.aborted)status.textContent='';}
}
function search(updateAddress=!advanced){clearTimeout(searchTimer);if(!input||!results)return;const q=input.value.trim().slice(0,80);results.replaceChildren();results.hidden=false;input.closest('.search-everywhere').style.zIndex='1000';voice.textContent='';
 if(updateAddress){const url=new URL(location.href);q?url.searchParams.set('q',q):url.searchParams.delete('q');history.replaceState(null,'',url);}
 const found=q?searchFeatures(q,{universal:!advanced}):recommend();
 if(found.some(r=>r.id==='image-compress'))results.append(link({title:'关于图片压缩功能搜索结果的说明',url:'/functions/image-compress/#search-notice',available:true},'search-explainer'));
 if(q&&found.length)document.dispatchEvent(new CustomEvent('ocv:site-action',{detail:{kind:'search'}}));
 for(const item of found)results.append(link(item));
 if(!found.length){const empty=document.createElement('p');empty.className='search-empty';empty.textContent='没有结果';results.append(empty);}
 const advice=document.createElement('p');advice.className='search-advice';advice.textContent='您可能不需要搜索这个';results.append(advice);
}
on(document.querySelector('[data-search]'),'click',indexedSearch);on(input,'input',()=>{indexLife?.abort();clearTimeout(searchTimer);searchTimer=setTimeout(search,120);});on(input,'keydown',event=>{if(event.key==='Enter'){event.preventDefault();indexedSearch();}if(event.key==='ArrowDown'){if(results.hidden)search();const first=results.querySelector('a');if(first){event.preventDefault();first.focus();}}if(event.key==='Escape'){indexLife?.abort();clearTimeout(searchTimer);results.hidden=true;input.closest('.search-everywhere').style.removeProperty('z-index');}});
on(window,'pagehide',()=>{indexLife?.abort();clearTimeout(searchTimer)});
on(document.querySelector('[data-voice]'),'click',()=>{voice.textContent='当前环境过于安静，语音功能暂不可用';});
on(document,'keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='k'){event.preventDefault();input?.focus();}});
const initial=new URL(location.href).searchParams.get('q');if(initial&&input){input.value=initial.slice(0,80);search();}
const badge=document.querySelector('[data-fiction-badge]'),out=document.querySelector('[data-fiction-out]');
function refreshIdentity(){const person=readIdentity();if(badge){badge.textContent=person?.name||'';badge.title=person?'因为两个账号相似，系统自动进行了合并（虚构）':'';}if(out)out.hidden=!person;}
refreshIdentity();on(out,'click',()=>{forgetIdentity();refreshIdentity();});
// Noncritical panes use a finite permutation at each fresh page load; navigation/search stay put.
const cards=['.portal-weather','.portal-news','.portal-login-card'];const pool=['53%','61%','68%'];
if(document.querySelector('.dock-home')){const bytes=crypto.getRandomValues(new Uint8Array(2));for(let i=2;i>0;i--){const j=bytes[2-i]%(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}cards.forEach((selector,i)=>document.querySelector(selector).style.top=pool[i]);}
const countdown=document.querySelector('[data-dock-seconds]');let seconds=59,timer=0;
function schedule(){if(document.hidden||seconds<=0)return;timer=setTimeout(()=>{seconds--;if(countdown)countdown.textContent=String(seconds).padStart(2,'0');schedule();},1000);}
schedule();on(document,'visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)schedule();});on(window,'pagehide',()=>{clearTimeout(timer);});on(window,'pageshow',()=>{clearTimeout(timer);schedule();refreshIdentity();});
on(window,'pagehide',event=>{if(!event.persisted)life.abort();});
