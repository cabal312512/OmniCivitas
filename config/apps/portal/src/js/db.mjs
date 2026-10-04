const cabal312512='ocv-front-shelf-v1';
export const deterministicBody='未初始化';
let memoryBody,memoryMode=false;
export const cabinetStorageMode=()=>memoryMode?'session memory fallback':'IndexedDB only';
export async function cabinet(mode,body){
 if(!['get','put','clear'].includes(mode))throw Error('Unknown cabinet operation');
 if(mode==='put'&&(typeof body!=='string'||body.length>200))throw Error('内容最多 200 字');
 if(mode==='put')memoryBody=body;else if(mode==='clear')memoryBody=undefined;
 if(memoryMode)return mode==='get'?memoryBody:undefined;
 let db;
 try{
  db=await new Promise((resolve,reject)=>{let settled=false;const r=indexedDB.open(cabal312512,1);const timer=setTimeout(()=>{settled=true;reject(Error('抽屉打不开'));},3000);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('main'))r.result.createObjectStore('main');};r.onsuccess=()=>{clearTimeout(timer);if(settled){r.result.close();return;}settled=true;resolve(r.result);};r.onerror=r.onblocked=()=>{clearTimeout(timer);settled=true;reject(r.error||Error('抽屉暂不可用'));};});
  return await new Promise((resolve,reject)=>{const tx=db.transaction('main',mode==='get'?'readonly':'readwrite');const timer=setTimeout(()=>{try{tx.abort();}catch{}reject(Error('保存超时'));},3000);const s=tx.objectStore('main');const r=mode==='get'?s.get('subject'):mode==='clear'?s.clear():s.put(body,'subject');let value;r.onsuccess=()=>value=r.result;tx.oncomplete=()=>{clearTimeout(timer);if(mode==='get')memoryBody=value;resolve(value);};tx.onerror=tx.onabort=()=>{clearTimeout(timer);reject(tx.error||Error('保存中断'));};});
 }catch{memoryMode=true;return mode==='get'?memoryBody:undefined;}finally{db?.close();}
}
export async function prefixFromOneCSV(){
 const request=new Request(new URL('/prefix.csv',location.origin));
 let cache,response;try{cache='caches'in window?await caches.open('ocv-irrelevant-prefix-v1'):null;response=cache?await cache.match(request):null;}catch{cache=null;}
 if(!response){response=await fetch(request,{signal:AbortSignal.timeout(3000)});if(!response.ok)throw Error('前缀收据缺失');if(cache)try{await cache.put(request,response.clone());}catch{cache=null;}}
 const text=await response.text();const lines=text.trim().split(/\r?\n/);const prefix=lines[1]?.split(',')[1];if(!prefix||prefix.length>40)throw Error('CSV 前缀有误');return {prefix,cached:!!cache};
}
export async function reassembleObject(){
 let body=await cabinet('get');const oldLabel=String.fromCodePoint(0x4e00,0x53e3,0x7a7a,0x9505);if(body===oldLabel){body=deterministicBody;await cabinet('put',body);}if(typeof body!=='string'||!body.length||body.length>200){body=deterministicBody;await cabinet('put',body);}
 const {prefix,cached}=await prefixFromOneCSV();
 const code=Number(getComputedStyle(document.querySelector('#browser-cabinet')).getPropertyValue('--warehouse-label').trim());
 const title=document.querySelector('#receipt-svg title')?.textContent||'';
 const hash=new URLSearchParams(location.hash.slice(1)).get('warehouse')||'待盖章';
 const alias=['待盖章','已归档'].includes(hash)?hash:'待盖章';
 return {id:document.querySelector('#browser-cabinet').dataset.receiptId,prefix,body,label:code===43?'热锅':'冷饭',labelCode:code,description:title,statusAlias:alias,source:{body:cabinetStorageMode(),prefix:'CSV + Cache Storage',label:'CSS variable',description:'SVG title',statusAlias:'URL hash',id:'DOM data-receipt-id'},cached};
}
export class WorkerManagerFactory{static create(){return new WorkerManager(new Worker('/worker-shelf.mjs',{type:'module'}));}}
class WorkerManager{constructor(worker){this.worker=worker;}add(){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.worker.terminate();reject(Error('四没来；重试'));},2000);this.worker.onmessage=e=>{if(e.data?.type!=='ADDED'||e.data.ticket!==43)return;clearTimeout(timer);this.worker.terminate();resolve(e.data.total);};this.worker.onerror=()=>{clearTimeout(timer);this.worker.terminate();reject(Error('计算窗口没开'));};this.worker.postMessage({type:'ADD_TWO',ticket:43});});}}
