const cap={entries:32,bytes:196608},storeName='parts';
const safePath=!/^\/(research|identity)(\/|$)/.test(location.pathname)&&document.body.dataset.tool!=='3d-world';
const state={completed:0,reassembled:0,dropped:0,last:null,backend:'not-checked',jobs:[]};
const watching=new Set();
const lifetime=new AbortController();
let database,session,queue=[],busy=false,timer=0,backoff=0,lastQueued=0,paused=false,mediaPending=false;
if(safePath)window.__ocvAfter=state;

const random=()=>crypto.randomUUID();
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
function open(){
 if(database)return database;
 database=new Promise((resolve,reject)=>{
  const r=indexedDB.open('ocv-parts-v1',1);let late=false;
  const timeout=setTimeout(()=>{late=true;reject(Error('Local fragment store timeout'));},1800);
  r.onupgradeneeded=()=>{const store=r.result.createObjectStore(storeName,{keyPath:'id'});store.createIndex('saved','saved');};
  r.onsuccess=()=>{clearTimeout(timeout);if(late){r.result.close();return;}resolve(r.result);};
  r.onerror=r.onblocked=()=>{clearTimeout(timeout);late=true;reject(Error('Local fragment store unavailable'));};
 });
 return database;
}
async function save(record){
 const db=await open();
 await new Promise((resolve,reject)=>{
  const tx=db.transaction(storeName,'readwrite'),store=tx.objectStore(storeName);
  const row={id:record.id,ticket:record.ticket,frontendPiece:record.frontendPiece,packageSha:record.packageSha,saved:Date.now()};
  row.size=new TextEncoder().encode(JSON.stringify(row)).length;
  store.put(row);const rows=[],cursor=store.index('saved').openCursor();
  cursor.onsuccess=()=>{const item=cursor.result;if(item){rows.push(item.value);item.continue();return;}
   let total=rows.reduce((n,r)=>n+(r.size||0),0);
   while(rows.length>cap.entries||total>cap.bytes){const old=rows.shift();total-=old.size||0;store.delete(old.id);}
  };
  tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(Error('Local fragment save failed'));
 });
}
async function read(id){
 const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(storeName),r=tx.objectStore(storeName).get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('Local fragment unavailable'));});
}
async function request(url,body,signal){
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'omit',signal:AbortSignal.any([lifetime.signal,AbortSignal.timeout(6500),...(signal?[signal]:[])])});
 if(!response.ok)throw Error(`Background HTTP ${response.status}`);
 return response.json();
}
async function watch(job,ticket){
 if(!job||watching.has(job.id)||watching.size>=2)return;
 watching.add(job.id);
 const pane=document.createElement('aside');pane.className='a2-progress';
 pane.innerHTML='<header><span>Queue</span><button type="button" aria-label="Close">×</button></header><progress aria-label="Background task"></progress><small></small>';
 const title=pane.querySelector('span'),bar=pane.querySelector('progress'),detail=pane.querySelector('small');
 document.body.append(pane);
 pane.querySelector('button').onclick=()=>pane.remove();
 const handle=pane.querySelector('header');let drag;
 handle.onpointerdown=e=>{if(e.target instanceof HTMLButtonElement)return;drag={x:e.clientX,y:e.clientY,left:pane.offsetLeft,top:pane.offsetTop};handle.setPointerCapture(e.pointerId);};
 handle.onpointermove=e=>{if(!drag)return;pane.style.right='auto';pane.style.left=drag.left+e.clientX-drag.x+'px';pane.style.top=drag.top+e.clientY-drag.y+'px';};
 handle.onpointerup=handle.onpointercancel=()=>{drag=null;};
 try{
  for(let attempt=0;attempt<120&&!lifetime.signal.aborted;attempt++){
   const result=await request('/api/a2/job.cgi/'+job.id,{ticket});
   state.jobs=state.jobs.filter(j=>j.id!==job.id).concat({id:job.id,state:result.state,family:result.family,phase:result.phase}).slice(-4);
   title.textContent=result.title||'Queue';detail.textContent=result.state+' · '+(result.phase+1);
   pane.dataset.state=result.state;
   if(result.state==='done'||result.state==='failed'){bar.value=result.state==='done'?1:0;bar.max=1;await new Promise(resolve=>setTimeout(resolve,2400));return;}
   await new Promise(resolve=>setTimeout(resolve,1800));
  }
 }catch{}
 finally{watching.delete(job.id);pane.remove();}
}
async function pump(){
 timer=0;if(busy||paused||!queue.length||Date.now()<backoff)return;
 const item=queue.shift();busy=true;
 try{
  item.signal?.throwIfAborted();
  session||=random();
  const p={eventId:random(),session,kind:item.kind,feature:item.feature,digest:await digest(item.bytes),bytes:item.bytes.length,units:item.units};
  const receipt=await request('/api/a1/receipt.cgi',p,item.signal);
  if(receipt.storage!=='postgresql'||!receipt.redis||!receipt.frontendPiece)throw Error('Background receipt was not persisted');
  const fragment=Uint8Array.from(atob(receipt.frontendPiece),c=>c.charCodeAt(0));
  if(await digest(fragment)!==receipt.frontendSha)throw Error('Receipt fragment mismatch');
  await save(receipt);state.completed++;state.backend='postgresql+redis';state.last={id:receipt.id,clicks:receipt.clicks,createdTables:receipt.createdTables,stamps:receipt.stamps};
  void watch(receipt.job,receipt.ticket);
  // Read back the actual browser fragment; the other two pieces never live here.
  if(item.forceRecover||item.kind==='export'||state.completed%3===0){
   const stored=await read(receipt.id);
   const merged=await request(`/api/a1/recover.cgi/${receipt.id}`,{ticket:stored.ticket,frontendPiece:stored.frontendPiece},item.signal);
   if(!merged.reassembled||merged.packageSha!==stored.packageSha)throw Error('Receipt reconstruction failed');
   state.reassembled++;
  }
  item.resolve?.({id:receipt.id,storage:receipt.storage,stamps:receipt.stamps});
 }catch(error){
  item.reject?.(error);
  if(!item.signal?.aborted){state.dropped++;state.backend='unavailable-or-busy';backoff=Date.now()+60000;discard(error);}
 }
 finally{busy=false;if(queue.length&&!paused)timer=setTimeout(pump,1200);}
}
function discard(error){for(const item of queue.splice(0))item.reject?.(error);}
// Media cues use the same bounded stores, but require all three fragments back.
export function runMediaReceipt(feature,signal){
 if(!safePath||paused||mediaPending||Date.now()<backoff||queue.length>=3||!globalThis.crypto?.subtle||!globalThis.indexedDB)return Promise.reject(Error('Media receipt unavailable'));
 if(!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(feature))return Promise.reject(Error('Invalid media identifier'));
 const cancelled=AbortSignal.any([lifetime.signal,AbortSignal.timeout(20000),...(signal?[signal]:[])]);
 if(cancelled.aborted)return Promise.reject(cancelled.reason);
 mediaPending=true;
 return new Promise((resolve,reject)=>{
  let settled=false;
  const finish=(callback,value)=>{if(settled)return;settled=true;mediaPending=false;cancelled.removeEventListener('abort',abort);callback(value);};
  const item={kind:'window',feature,bytes:new TextEncoder().encode(feature),units:feature.length,forceRecover:true,signal:cancelled,resolve:value=>finish(resolve,value),reject:error=>finish(reject,error)};
  const abort=()=>{queue=queue.filter(entry=>entry!==item);item.reject(cancelled.reason);};
  cancelled.addEventListener('abort',abort,{once:true});
  queue.unshift(item);
  if(!busy&&!timer)timer=setTimeout(pump,20);
 });
}
function enqueue(kind,feature,text=''){
 if(!safePath||paused||document.hidden||Date.now()<backoff||Date.now()-lastQueued<800||queue.length>=3)return;
 if(!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(feature))return;
 const bytes=new TextEncoder().encode(text);if(bytes.length>4194304)return;
 lastQueued=Date.now();queue.push({kind,feature,bytes,units:text.length});
 if(!busy&&!timer)timer=setTimeout(pump,20);
}
if(safePath&&globalThis.crypto?.subtle&&globalThis.indexedDB){
 document.addEventListener('ocv:tool-success',event=>enqueue('tool',event.detail?.id,document.querySelector('#tool-output')?.value||''),{signal:lifetime.signal});
 document.addEventListener('click',event=>{
  const node=event.target instanceof Element?event.target:null;
  if(node?.closest('#tool-export'))enqueue('export',document.body.dataset.tool,document.querySelector('#tool-output')?.value||'');
  else if(node?.closest('[data-n3-close],[data-n3-pulse],[data-n3-add]'))enqueue('window','pane-'+(node.closest('[data-n3-kind]')?.dataset.n3Kind||'0'));
 },{signal:lifetime.signal,capture:true});
 const page=()=>enqueue('route','page-'+location.pathname.replace(/[^a-z0-9]+/gi,'-').toLowerCase().slice(0,45).replace(/-+$/,'')||'page-home');
 window.addEventListener('pagehide',event=>{paused=true;clearTimeout(timer);timer=0;discard(Error('Page left'));if(!event.persisted){lifetime.abort();database?.then(db=>db.close()).catch(()=>{});}},{signal:lifetime.signal});
 window.addEventListener('pageshow',event=>{paused=false;if(event.persisted)page();},{signal:lifetime.signal});
 page();
}
