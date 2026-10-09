export type Receipt={id:string;ticket:string;job:{id:string};result:any};
async function post(url:string,body:unknown,signal:AbortSignal){
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'omit',signal:AbortSignal.any([signal,AbortSignal.timeout(10000)])});
 if(!response.ok)throw Error(response.status===503?'暂未连接':response.status===429?'请稍后再试':'处理未完成');
 return response.json();
}
export async function processTake(body:unknown,signal:AbortSignal,changed:(state:string)=>void):Promise<Receipt>{
 const receipt=await post('/api/site/return.php',body,signal),end=Date.now()+180000;
 while(Date.now()<end){
  if(signal.aborted)throw new DOMException('Aborted','AbortError');
  const state=await post('/api/a2/job.cgi/'+receipt.job.id,{ticket:receipt.ticket},signal);changed(state.state);
  if(state.state==='done'){const result=await post('/api/site/order.asm/'+receipt.id,{ticket:receipt.ticket},signal);return {...receipt,result:result.result};}
  if(['failed','cancelled'].includes(state.state))throw Error('处理未完成；原录音保留');
  await new Promise<void>((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'))};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve()},1800);signal.addEventListener('abort',abort,{once:true});});
 }
 throw Error('等待结束；可稍后重试');
}
export async function processedFile(receipt:Receipt,ext:'wav'|'mid',signal:AbortSignal){
 const response=await fetch('/api/site/file.do/'+receipt.id+'/'+ext,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket:receipt.ticket}),credentials:'omit',signal:AbortSignal.any([signal,AbortSignal.timeout(10000)])});
 if(!response.ok)throw Error('文件未就绪');
 const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download='take-processed.'+ext;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
