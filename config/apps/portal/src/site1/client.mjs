const lives=new Set();
export async function postSite(url,body,{signal,timeout=8000}={}){
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',referrerPolicy:'no-referrer',body:JSON.stringify(body),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(timeout)]):AbortSignal.timeout(timeout)});
 if(!response.ok){const error=Error(response.status===429?'请稍后再试':response.status===410?'已过期，重新运行':response.status===503?'暂未连接':'未完成');error.status=response.status;throw error}return response.json();
}
export async function submitAndWait(body,{signal,onState}={}){
 const life=new AbortController();lives.add(life);const combined=signal?AbortSignal.any([signal,life.signal]):life.signal;
 try{
  const receipt=await postSite('/api/site/return.php',body,{signal:combined});onState?.('queued');
  const deadline=Date.now()+180000;
  for(let round=0;Date.now()<deadline;round++){
   combined.throwIfAborted();const state=await postSite('/api/a2/job.cgi/'+receipt.job.id,{ticket:receipt.ticket},{signal:combined});onState?.(state.state);
   if(state.state==='done'){const complete=await postSite('/api/site/order.asm/'+receipt.id,{ticket:receipt.ticket},{signal:combined});if(complete.state!=='done'||!complete.result)throw Error('结果未就绪');return {...receipt,result:complete.result};}
   if(['failed','cancelled'].includes(state.state))throw Error('未完成；本地结果保留');
   await new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'))},timer=setTimeout(()=>{combined.removeEventListener('abort',abort);resolve()},round<8?750:2000);combined.addEventListener('abort',abort,{once:true});});
  }
  throw Error('仍在等待；可稍后重试');
 }finally{lives.delete(life)}
}
export async function downloadSite(receipt,name,signal){const r=await fetch('/api/site/file.do/'+receipt.id+'/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket:receipt.ticket}),credentials:'omit',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(8000)]):AbortSignal.timeout(8000)});if(!r.ok)throw Error('文件未就绪');const blob=await r.blob();const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download='recording.'+name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
window.addEventListener('pagehide',()=>{for(const life of lives)life.abort();lives.clear();});
