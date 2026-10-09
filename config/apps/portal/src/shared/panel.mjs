import {panelContents} from './panel-template.mjs';
import './shared.css';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,HEX=/^[a-f0-9]{64}$/;
const encoder=new TextEncoder(),NS='http://www.w3.org/2000/svg';
const number=value=>Number.isFinite(Number(value))?Number(value):0;
const text=value=>value==null?'—':typeof value==='number'?Number(value.toPrecision(6)).toString():String(value).slice(0,180);
const element=(tag,value,attributes={})=>{const node=document.createElement(tag);if(value!==undefined)node.textContent=text(value);for(const[key,value]of Object.entries(attributes))node.setAttribute(key,String(value));return node};
const shape=(tag,attributes={},value)=>{const node=document.createElementNS(NS,tag);for(const[key,value]of Object.entries(attributes))node.setAttribute(key,String(value));if(value!==undefined)node.textContent=text(value);return node};
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
const pause=(ms,signal)=>new Promise((resolve,reject)=>{if(signal?.aborted){reject(new DOMException('Aborted','AbortError'));return}const abort=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'))},timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve()},ms);signal?.addEventListener('abort',abort,{once:true})});
const capability=value=>value&&UUID.test(value.id)&&HEX.test(value.ticket)?{id:value.id,ticket:value.ticket,revision:Number.isInteger(value.revision)?value.revision:undefined,digest:HEX.test(value.digest)?value.digest:undefined,domain:value.domain}:null;
const transferData=bytes=>{let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary)};
const decodeData=encoded=>{if(typeof encoded!=='string'||encoded.length>87384)throw Error('下载分块超过限制');return Uint8Array.from(atob(encoded),value=>value.charCodeAt(0))};

async function api(path,body,signal){
 let expired=false;const timeout=new AbortController(),timer=setTimeout(()=>{expired=true;timeout.abort()},20000),abort=()=>timeout.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)timeout.abort();
 try{const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:timeout.signal,credentials:'same-origin'});const raw=await response.text();if(raw.length>6291456)throw Error('记录超过读取限制');let data;try{data=JSON.parse(raw)}catch{throw Error(`读取未完成 (${response.status})`)}if(!response.ok){const e=Error(typeof data.error==='string'?data.error:typeof data.message==='string'?data.message:`HTTP ${response.status}`);e.status=response.status;e.code=data.code;e.minimumSequence=data.minimumSequence;throw e}return data}
 catch(error){if(expired&&!signal?.aborted)throw Error('读取超时');throw error}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
function saveBlob(blob,name){const url=URL.createObjectURL(blob),link=element('a');link.href=url;link.download=name.replace(/[\\/\x00-\x1f]/g,'_').slice(0,120);link.click();setTimeout(()=>URL.revokeObjectURL(url),10000)}
function table(headers,rows){const node=element('table'),head=element('thead'),tr=element('tr');for(const title of headers)tr.append(element('th',title));head.append(tr);node.append(head);const body=element('tbody');for(const row of rows){const tr=element('tr');for(const value of row)tr.append(element('td',value));body.append(tr)}node.append(body);return node}

export function initSharedPanels(){for(const panel of document.querySelectorAll('[data-shared-panel]'))mountPanel(panel)}
export function mountMusicPanel(){let panel=document.querySelector('[data-shared-panel][data-shared-domain="music"]');if(!panel){const floor=document.querySelector('.tool-floor');if(!floor)return;panel=element('section',undefined,{class:'shared-panel','data-shared-panel':'','data-shared-domain':'music','data-shared-frame':'music-frame','aria-label':'音乐记录'});panel.innerHTML=panelContents('music');floor.append(panel)}mountPanel(panel);return panel}

function mountPanel(root){
 if(root.dataset.sharedInitialized==='1')return;root.dataset.sharedInitialized='1';
 const domain=root.dataset.sharedDomain,frame=document.getElementById(root.dataset.sharedFrame),life=new AbortController();
 const state={cap:null,projectData:null,job:null,jobData:null,operation:null,busy:false,closed:false,branch:null,room:null,cursor:0,transfer:null,versionList:[],selectedRevision:0,artifactController:null,operationController:null,analysisLife:null,versionLife:null,analysisFingerprint:null,contextEpoch:0,actionContext:null};
 const contextWaiters=new Set();
 const find=selector=>root.querySelector(selector),input=name=>find(`[data-shared-input="${name}"]`),listen=(target,type,callback)=>target?.addEventListener(type,callback,{signal:life.signal});
 const notice=(value,error=false)=>{const target=find('[data-shared-notice]');target.textContent=String(value||'').slice(0,240);target.dataset.error=String(error)};
 function controls(){
  for(const button of root.querySelectorAll('[data-shared-action]')){
   const action=button.dataset.sharedAction;let enabled=!!state.cap&&!state.busy;
   if(action==='package')enabled=!state.busy&&!!state.job&&state.jobData?.id===state.job.id&&state.jobData.state==='done'&&!!state.jobData.shared?.object?.verified&&!!state.jobData.shared?.publication?.ok;
   if(action==='diff'||action==='rollback')enabled&&=state.versionList.length>0;
   if(action==='open-branch')enabled=!!state.branch&&!state.busy;
   if(['room-read','room-commit','room-leave'].includes(action))enabled&&=!!state.room;
   if(action==='room-commit'||action==='upload-project')enabled&&=!!state.projectData;
   if(action==='pause-upload')enabled=!!state.transfer&&!state.transfer.paused&&!!state.busy;
   if(action==='download-transfer'||action==='upload-abort'||action==='upload-status')enabled=!!state.cap&&!state.busy&&UUID.test(input('upload')?.value||'');
   button.disabled=!enabled;
  }
  const file=find('[data-shared-upload-file]');if(file)file.disabled=!state.cap||state.busy;
  find('[data-shared-cancel]').disabled=!state.operation&&!state.job||state.closed||['done','failed','cancelled'].includes(state.jobData?.state)&&!state.operation;
 }
 function source(){const label={signals:'通信',workshop:'机械',music:'音乐'}[domain];find('[data-shared-source]').textContent=state.cap?`${label} / r${state.cap.revision||'—'} / ${state.cap.id.slice(0,8)}`:state.job?`${label} / ${state.job.id.slice(0,8)}`:'—';controls()}
 function canonicalProject(value){if(!value||typeof value!=='object'||Array.isArray(value))return null;try{if(encoder.encode(JSON.stringify(value)).length>131072)return null;return structuredClone(value)}catch{return null}}
 function requestContext(){frame?.contentWindow?.postMessage({type:'OCV_SHARED_MEASURE'},location.origin)}
 function assertContext(epoch=state.actionContext?.epoch??state.contextEpoch){if(state.closed||epoch!==state.contextEpoch)throw new DOMException('Project context changed','AbortError')}
 function resetProjectContext(){
  state.contextEpoch++;state.projectData=null;state.transfer&&(state.transfer.paused=true);state.operationController?.abort();state.operation=null;state.room=null;state.cursor=0;state.transfer=null;state.branch=null;state.versionList=[];state.selectedRevision=0;state.versionLife?.abort();
  for(const selector of ['[data-shared-history]','[data-shared-diff]','[data-shared-people]','[data-shared-replay]'])find(selector)?.replaceChildren();const difference=find('[data-shared-diff]');if(difference)difference.hidden=true;
  for(const name of ['beforeRevision','afterRevision'])input(name)?.replaceChildren();for(const name of ['room','upload']){const field=input(name);if(field)field.value=''}const room=find('[data-shared-room-state]');if(room)room.textContent='—';if(find('[data-shared-transfer-status]'))progress('—');
 }
 function resetArtifact(){
  state.artifactController?.abort();state.artifactController=null;state.jobData=null;state.analysisLife?.abort();state.analysisLife=null;state.analysisFingerprint=null;
  for(const selector of ['[data-shared-chart]','[data-shared-heatmap]','[data-shared-statistics]','[data-shared-comparison]','[data-shared-analysis-downloads]','[data-shared-manifest]'])find(selector)?.replaceChildren();
  for(const selector of ['[data-shared-analysis-source]','[data-shared-package]','[data-shared-state]'])find(selector).textContent='—';find('[data-shared-count]').textContent='';find('[data-shared-proof]').textContent='';
 }
 async function currentProject(){
  const epoch=state.actionContext?.epoch??state.contextEpoch;if(!frame?.contentWindow)throw Error('工程窗口尚未就绪');
  await new Promise((resolve,reject)=>{let timer;const clean=()=>{clearTimeout(timer);contextWaiters.delete(ready);life.signal.removeEventListener('abort',abort)},ready=()=>{clean();resolve()},abort=()=>{clean();reject(new DOMException('Aborted','AbortError'))};contextWaiters.add(ready);life.signal.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>{clean();reject(Error('工程窗口未响应'))},2500);if(life.signal.aborted){abort();return}requestContext()});
  assertContext(epoch);if(!state.cap||!state.projectData)throw Error('尚无当前工程');return {cap:{...state.cap},project:canonicalProject(state.projectData)};
 }
 function context(data){
  if(data.domain!==domain)return;
  if(Object.prototype.hasOwnProperty.call(data,'project')){const next=capability(data.project);if(data.project!=null&&!next)return;if(next)next.domain=domain;if(next?.id!==state.cap?.id||next?.ticket!==state.cap?.ticket)resetProjectContext();state.cap=next}
  if(Object.prototype.hasOwnProperty.call(data,'projectData'))state.projectData=canonicalProject(data.projectData);
  if(Object.prototype.hasOwnProperty.call(data,'job')){const job=capability(data.job);if(data.job==null||job){if(job?.id!==state.job?.id||job?.ticket!==state.job?.ticket){resetArtifact();state.job=job;if(job){state.artifactController=new AbortController();void watchArtifact(job,state.artifactController)}}}}
  source();for(const ready of [...contextWaiters])ready();
 }
 listen(window,'message',event=>{if(event.origin!==location.origin||event.source!==frame?.contentWindow||!event.data||typeof event.data!=='object')return;const d=event.data;if(d.type==='OCV_SHARED_CONTEXT')context(d);else if(domain==='workshop'&&d.type==='OCV_WORKSHOP_PROJECT')state.projectData=canonicalProject(d.project);else if(domain==='signals'&&d.type==='OCV_SIGNALS_PROJECT')state.projectData=canonicalProject(d.project);controls()});
 listen(frame,'load',requestContext);requestContext();
 async function poll(job,controller,notify){
  const deadline=Date.now()+7*86400000;let reads=0;
  while(!controller.signal.aborted&&!state.closed&&Date.now()<deadline){
   let record;
   try{record=await api(`/api/shared/jobs/${job.id}/read`,{ticket:job.ticket},controller.signal)}catch(error){if(controller.signal.aborted)throw error;if(error.status===403||error.status===404)throw error;notify?.({state:'retrying'});await pause(15000,controller.signal);continue}
   notify?.(record);if(['done','failed','cancelled'].includes(record.state)){if(record.state!=='done'){const error=Error(typeof record.result?.reason==='string'?record.result.reason:`记录 ${record.state}`);error.code=record.result?.code;throw error}return record}
   await pause(++reads<120?1500:15000,controller.signal);
  }
  throw new DOMException('Aborted','AbortError');
 }
 async function watchArtifact(job,controller){
  try{await poll(job,controller,record=>{if(state.closed||controller.signal.aborted||state.job?.id!==job.id)return;state.jobData=record;find('[data-shared-state]').textContent=record.state==='done'?'就绪':record.state==='retrying'?'重试':`${record.state} / ${number(record.phase)}`;if(record.shared?.analysis)renderAnalysis(record.shared.analysis);if(record.shared)renderManifest(record.shared);controls()})}
  catch(error){if(!controller.signal.aborted&&!state.closed){notice(error.message,true);find('[data-shared-state]').textContent='—';controls()}}
 }
 async function operation(action,extra={}){
  const epoch=state.actionContext?.epoch??state.contextEpoch;assertContext(epoch);const project=state.actionContext?.cap||state.cap;if(!project)throw Error('尚无保存记录');const base={action,project:project.id,ticket:project.ticket,domain};
  const ack=await api('/api/shared/operations',{...base,...extra},life.signal);assertContext(epoch);const job=capability(ack);if(!job)throw Error('记录凭据缺失');state.operation=job;controls();state.operationController?.abort();const controller=new AbortController();state.operationController=controller;
  const record=await poll(job,controller,entry=>{if(!controller.signal.aborted&&epoch===state.contextEpoch){find('[data-shared-state]').textContent=`${entry.state} / ${number(entry.phase)}`;controls()}});assertContext(epoch);state.operation=null;controls();
  const result=record.shared?.operationResult;if(!result||typeof result!=='object')throw Error('操作结果缺失');return {result,capability:ack.capability};
 }
 async function perform(fn){if(state.busy||state.closed)return;const epoch=state.contextEpoch;state.actionContext={epoch,cap:state.cap?{...state.cap}:null};state.busy=true;notice('');controls();try{await fn()}catch(error){if(error.name!=='AbortError'&&epoch===state.contextEpoch)notice(error.message,true)}finally{state.busy=false;state.operation=null;state.operationController=null;state.actionContext=null;controls()}}

 function renderVersions(result){
  if(!Array.isArray(result.versions))throw Error('版本列表缺失');state.versionList=result.versions.slice(0,32);
  state.versionLife?.abort();state.versionLife=new AbortController();const history=find('[data-shared-history]');history.replaceChildren();for(const version of state.versionList){const button=element('button',undefined,{type:'button','aria-pressed':'false'});button.append(element('b',version.revision));const detail=element('span');detail.append(element('span',version.operation),element('span',version.digest?.slice(0,16)));button.append(detail);button.addEventListener('click',()=>{state.selectedRevision=version.revision;for(const row of history.children)row.setAttribute('aria-pressed',String(row===button));input('beforeRevision').value=String(version.revision)},{signal:state.versionLife.signal});history.append(button)}
  for(const name of ['beforeRevision','afterRevision']){const select=input(name),previous=select.value;select.replaceChildren();for(const version of state.versionList)select.append(element('option',version.revision,{value:version.revision}));if(state.versionList.some(v=>String(v.revision)===previous))select.value=previous;else if(name==='beforeRevision'&&state.versionList.length>1)select.value=String(state.versionList[1].revision)}
  source();notice(`${state.versionList.length} / r${result.headRevision}`);
 }
 function renderDifference(result){const difference=result.difference||result;const target=find('[data-shared-diff]');target.hidden=false;target.replaceChildren(element('p',`${number(difference.totalChanges)} changes${difference.truncated?' / clipped':''}`));const rows=(difference.changes||[]).slice(0,64).map(change=>[change.kind,change.path,JSON.stringify(change.before??null).slice(0,90),JSON.stringify(change.after??null).slice(0,90)]);const grid=table(['Δ','Path','Before','After'],rows);[...grid.querySelectorAll('tbody tr')].forEach((row,index)=>row.children[0].dataset.kind=rows[index][0]);target.append(grid)}
 function retainRoom(result,cap){if(!UUID.test(result.room))throw Error('房间凭据缺失');const member=cap?.room===result.room?cap:state.room?.room===result.room?state.room:null,client=member?.client,clientTicket=member?.clientTicket;if(!UUID.test(client)||!HEX.test(clientTicket))throw Error('参与者凭据缺失');state.room={room:result.room,client,clientTicket};state.cursor=number(result.cursor)||0;input('room').value=result.room;find('[data-shared-room-state]').textContent=result.room.slice(0,8);find('[data-shared-people]').replaceChildren();find('[data-shared-replay]').replaceChildren();controls()}
 function roomExtra(){if(!state.room)throw Error('尚未加入房间');return {...state.room,cursor:state.cursor}}
 function renderRoom(result){state.cursor=number(result.cursor);find('[data-shared-room-state]').textContent=`r${result.headRevision} / ${state.cursor}`;const people=find('[data-shared-people]');people.replaceChildren();for(const person of (result.participants||[]).slice(0,16))people.append(element('span',person.client?.slice(0,8),{'data-online':String(!!person.online)}));const replay=find('[data-shared-replay]');for(const record of(result.operations||[]).slice(0,32)){const row=element('div');row.append(element('b',record.sequence),element('span',`r${record.expectedRevision} → r${record.revision}`),element('span',record.client?.slice(0,8)));replay.append(row)}while(replay.children.length>128)replay.firstElementChild.remove()}
 async function roomRead(){let hasMore=true,passes=0;while(hasMore&&passes++<4){const{result}=await operation('room-read',roomExtra());renderRoom(result);hasMore=!!result.hasMore}}
 function reopen(cap=state.cap){if(!cap)return;frame?.contentWindow?.postMessage({type:'OCV_SHARED_REFRESH',project:cap},location.origin);notice('↗')}

 function renderManifest(shared){
  const manifest=shared.artifact?.manifest||shared.artifact;const target=find('[data-shared-manifest]');target.replaceChildren();const files=Array.isArray(manifest?.files)?manifest.files:Array.isArray(manifest?.entries)?manifest.entries:[];
  for(const file of files.slice(0,32)){const row=element('div',file.name||file.path||'—');row.append(element('small',`${number(file.bytes)} B / ${(file.sha256||file.digest||'').slice(0,16)}`));target.append(row)}
  find('[data-shared-package]').textContent=shared.object?.verified&&shared.publication?.ok?'✓ SHA-256':'—';find('[data-shared-proof]').textContent=shared.object?.verified?'verified / object storage':'';
 }
 function renderAnalysis(analysis){
  if(analysis?.schema!=='ocv.shared-analysis-result/1'||!analysis.ok)return;const fingerprint=analysis.fingerprint||analysis.id||analysis.sourceDigest;if(fingerprint&&state.analysisFingerprint===fingerprint)return;state.analysisFingerprint=fingerprint;state.analysisLife?.abort();state.analysisLife=new AbortController();find('[data-shared-analysis-source]').textContent=`${analysis.dataset?.kind||domain} / ${(analysis.sourceDigest||'').slice(0,16)}`;find('[data-shared-count]').textContent=`${number(analysis.dataset?.selectedSamples)} / ${number(analysis.dataset?.originalSamples)} samples${Number.isInteger(analysis.query?.acceptedRows)?` · ${analysis.query.acceptedRows} rows`:''}`;drawTrace(find('[data-shared-chart]'),analysis);drawHeatmap(find('[data-shared-heatmap]'),analysis);
  find('[data-shared-statistics]').replaceChildren(table(['Entity / quantity','Unit','n','Mean','σ','p05 / p95','RMS'],(analysis.statistics||[]).slice(0,10).map(s=>[`${s.entity} / ${s.quantity}`,s.unit,s.count,s.mean,s.stddev,`${text(s.p05)} / ${text(s.p95)}`,s.rms])));
  find('[data-shared-comparison]').replaceChildren();if(analysis.comparison?.groups?.length)find('[data-shared-comparison]').append(table(['Δ / group','n','Bias','RMSE','Max |error|','ρ'],analysis.comparison.groups.slice(0,8).map(s=>[`${s.entity} / ${s.quantity}`,s.count,s.bias,s.rmse,s.maxAbsoluteError,s.correlation])));
  const downloads=find('[data-shared-analysis-downloads]');downloads.replaceChildren();for(const file of(analysis.artifacts||[]).filter(a=>['samples.csv','statistics.csv','comparison.csv','analysis.json'].includes(a.name)).slice(0,4)){const button=element('button',file.name,{type:'button'});button.addEventListener('click',()=>perform(async()=>{const bytes=encoder.encode(file.content||'');if(bytes.length!==file.bytes||!HEX.test(file.sha256)||await sha(bytes)!==file.sha256)throw Error('分析文件校验失败');saveBlob(new Blob([bytes],{type:file.mime||'application/octet-stream'}),file.name);notice('✓ SHA-256')}),{signal:state.analysisLife.signal});downloads.append(button)}
 }
 async function downloadPackage(){const job=state.job?{...state.job}:null;if(!job||state.jobData?.id!==job.id||state.jobData.state!=='done'||!state.jobData.shared?.object?.verified||!state.jobData.shared?.publication?.ok)throw Error('工程包尚未就绪');const response=await fetch(`/api/shared/jobs/${job.id}/download`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket:job.ticket}),signal:life.signal,credentials:'same-origin'});if(!response.ok)throw Error(`下载未完成 (${response.status})`);const expected=response.headers.get('X-Content-SHA256');if(!HEX.test(expected||''))throw Error('下载校验头缺失');const blob=await response.blob();if(blob.size>20971520)throw Error('工程包超过下载限制');if(await sha(await blob.arrayBuffer())!==expected)throw Error('工程包校验失败');assertContext();saveBlob(blob,`${domain}-record-${job.id.slice(0,8)}.zip`);notice('✓ SHA-256')}

 function progress(message,value=0,max=1){find('[data-shared-transfer-status]').textContent=message;const bar=find('[data-shared-transfer-progress]');bar.max=Math.max(1,max);bar.value=value}
 async function uploadBytes(bytes,name){
  if(bytes.length<1||bytes.length>8388608)throw Error('文件须为 1 B–8 MiB');const hash=await sha(bytes),upload=crypto.randomUUID();assertContext();state.transfer={upload,bytes,digest:hash,size:bytes.length,name,paused:false};input('upload').value=upload;const{result}=await operation('upload-start',{upload,size:bytes.length,digest:hash});await resumeTransfer(result);
 }
 async function resumeTransfer(status){
  const transfer=state.transfer;if(!transfer||transfer.upload!==status.upload||transfer.digest!==status.digest||transfer.size!==status.size){progress(`${status.state} / ${status.receivedBytes} / ${status.size} B`,status.receivedBytes,status.size);if(status.state==='ready')return;throw Error('重新选择同一文件后续传')}
  transfer.paused=false;const received=new Map((status.receivedParts||[]).map(part=>[part.part,part.digest]));let total=0;const parts=Math.ceil(transfer.size/65536);
  for(let part=0;part<parts;part++){
   if(transfer.paused||state.closed){progress('暂停',total,transfer.size);return}
   const chunk=transfer.bytes.subarray(part*65536,Math.min(transfer.size,(part+1)*65536)),hash=await sha(chunk);assertContext();if(received.has(part)){if(received.get(part)!==hash)throw Error('续传分块校验失败')}else await operation('upload-put',{upload:transfer.upload,part,digest:hash,data:transferData(chunk)});total+=chunk.length;progress(`${part+1} / ${parts} · ${total} B`,total,transfer.size);controls();
  }
  assertContext();if(transfer.paused){progress('暂停',total,transfer.size);return}
  const{result}=await operation('upload-commit',{upload:transfer.upload});if(!result.verified||result.digest!==transfer.digest)throw Error('传输校验未完成');progress(`✓ SHA-256 / ${result.size} B`,result.size,result.size);notice('✓ SHA-256');
 }
 async function transferStatus(){const upload=input('upload').value.trim();const{result}=await operation('upload-status',{upload});await resumeTransfer(result)}
 async function downloadTransfer(){const upload=input('upload').value.trim(),{result:status}=await operation('upload-status',{upload});if(status.state!=='ready'||status.size>8388608)throw Error('制品尚未就绪');const bytes=new Uint8Array(status.size);for(let part=0;part<status.totalParts;part++){const{result}=await operation('upload-download',{upload,part});const chunk=decodeData(result.data);if(!result.verified||await sha(chunk)!==result.chunkDigest||result.digest!==status.digest)throw Error('下载分块校验失败');assertContext();bytes.set(chunk,part*65536);progress(`${part+1} / ${status.totalParts}`,part+1,status.totalParts)}if(await sha(bytes)!==status.digest)throw Error('下载完整校验失败');assertContext();saveBlob(new Blob([bytes]),state.transfer?.name||`${domain}-artifact.bin`);notice('✓ SHA-256')}

 const actions={
  versions:async()=>{const{result}=await operation('versions');renderVersions(result)},
  diff:async()=>{const{result}=await operation('diff',{beforeRevision:Number(input('beforeRevision').value),afterRevision:Number(input('afterRevision').value)});renderDifference(result)},
  branch:async()=>{const{result,capability:cap}=await operation('branch',{operationId:crypto.randomUUID(),sourceRevision:Number(input('beforeRevision').value)||state.cap.revision,name:input('branchName').value.trim()||undefined});if(!cap?.project||!HEX.test(cap.ticket))throw Error('分支凭据缺失');state.branch={id:cap.project,ticket:cap.ticket,revision:result.project?.revision,digest:result.project?.digest,domain};notice(`分支 / ${state.branch.id.slice(0,8)}`)},
  rollback:async()=>{if(!confirm('回退到所选版本？'))return;const{result}=await operation('rollback',{operationId:crypto.randomUUID(),sourceRevision:Number(input('beforeRevision').value),expectedRevision:state.cap.revision});if(result.project?.revision)state.cap.revision=result.project.revision;source();reopen()},
  reload:async()=>reopen(),
  'open-branch':async()=>{reopen(state.branch)},
  'room-open':async()=>{const{result,capability:cap}=await operation('room-open',{operationId:crypto.randomUUID()});retainRoom(result,cap)},
  'room-join':async()=>{const room=input('room').value.trim();if(!UUID.test(room))throw Error('房间编号无效');const{result,capability:cap}=await operation('room-join',{room});retainRoom(result,cap)},
  'room-read':roomRead,
  'room-commit':async()=>{const current=await currentProject();const{result}=await operation('room-commit',{...roomExtra(),operationId:crypto.randomUUID(),expectedRevision:current.cap.revision,projectData:current.project});if(result.revision)state.cap.revision=result.revision;source();notice(`r${result.revision} / ${result.sequence}`);reopen()},
  'room-leave':async()=>{await operation('room-leave',roomExtra());state.room=null;state.cursor=0;find('[data-shared-room-state]').textContent='—';find('[data-shared-people]').replaceChildren()},
  package:downloadPackage,
  'upload-project':async()=>{const current=await currentProject(),bytes=encoder.encode(JSON.stringify(current.project,null,2));await uploadBytes(bytes,`${domain}-project.json`)},
  'upload-status':transferStatus,
  'pause-upload':async()=>{if(state.transfer){state.transfer.paused=true;progress('暂停');controls()}},
  'download-transfer':downloadTransfer,
  'upload-abort':async()=>{const upload=input('upload').value.trim();await operation('upload-abort',{upload});state.transfer=null;progress('—')}
 };
 for(const button of root.querySelectorAll('[data-shared-action]'))listen(button,'click',()=>{const action=button.dataset.sharedAction;if(action==='pause-upload'){void actions[action]();return}if(actions[action])void perform(actions[action])});
 listen(find('[data-shared-upload-file]'),'change',event=>{const target=event.currentTarget,file=target.files?.[0];if(!file)return;void perform(async()=>{if(file.size<1||file.size>8388608)throw Error('文件须为 1 B–8 MiB');const bytes=new Uint8Array(await file.arrayBuffer()),hash=await sha(bytes),existing=input('upload').value.trim();if(UUID.test(existing)){const{result:status}=await operation('upload-status',{upload:existing});if(status.digest!==hash||status.size!==bytes.length)throw Error('续传须选择与记录相同的文件');state.transfer={upload:existing,bytes,digest:hash,size:bytes.length,name:file.name,paused:false};await resumeTransfer(status)}else await uploadBytes(bytes,file.name)}).finally(()=>target.value='')});
 for(const field of ['upload','room'])listen(input(field),'input',controls);
 listen(find('[data-shared-cancel]'),'click',()=>{const job=state.operation||state.job;if(!job)return;void api(`/api/shared/jobs/${job.id}/cancel`,{ticket:job.ticket},life.signal).then(()=>notice('已取消')).catch(error=>notice(error.message,true))});
 listen(find('[data-shared-fold]'),'click',()=>{const body=find('[data-shared-body]');body.hidden=!body.hidden});
 for(const button of root.querySelectorAll('[data-shared-tab]'))listen(button,'click',()=>{for(const item of root.querySelectorAll('[data-shared-tab]'))item.setAttribute('aria-selected',String(item===button));for(const view of root.querySelectorAll('[data-shared-view]'))view.hidden=view.dataset.sharedView!==button.dataset.sharedTab});
 const close=()=>{state.closed=true;state.transfer&&(state.transfer.paused=true);state.operationController?.abort();state.artifactController?.abort();state.analysisLife?.abort();state.versionLife?.abort();life.abort();state.cap=null;state.projectData=null;state.room=null;state.branch=null;state.transfer=null};
 listen(window,'pagehide',event=>{if(!event.persisted)close()});listen(window,'pageshow',event=>{if(event.persisted)requestContext()});source();
}

function chartBase(svg){svg.replaceChildren();svg.append(shape('rect',{x:0,y:0,width:600,height:220,fill:'#ffffff'}));for(let i=0;i<5;i++){svg.append(shape('line',{x1:38,y1:20+i*42,x2:586,y2:20+i*42,stroke:'#e1ebf9','stroke-width':1}));svg.append(shape('line',{x1:38+i*137,y1:20,x2:38+i*137,y2:190,stroke:'#eef4fc','stroke-width':1}))}svg.append(shape('path',{d:'M38 20V190H586',stroke:'#8cafda',fill:'none','stroke-width':1}))}
function projectedPoints(series){const points=(series.points||[]).filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]));return points.length<=256?points:Array.from({length:256},(_,index)=>points[Math.round(index*(points.length-1)/255)])}
function drawTrace(svg,analysis){
 chartBase(svg);const available=(analysis.series||[]).filter(series=>projectedPoints(series).length),first=available[0];if(!first)return;const sets=available.filter(series=>series.unit===first.unit&&series.axisUnit===first.axisUnit).slice(0,3),points=sets.flatMap(projectedPoints);const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));const x=v=>maxX===minX?312:38+(v-minX)/(maxX-minX)*548,y=v=>maxY===minY?105:190-(v-minY)/(maxY-minY)*170;
 svg.append(shape('title',{},`${sets.length} / ${available.length} groups; shared units: ${first.unit||'1'} / ${first.axisUnit||'1'}; at most 256 observed points per group, including endpoints`));
 for(const[seriesIndex,series]of sets.entries()){const colour=['#1e72e6','#21a6b2','#885adc'][seriesIndex],valid=projectedPoints(series);svg.append(shape('polyline',{points:valid.map(p=>`${x(p[0])},${y(p[1])}`).join(' '),stroke:colour,'stroke-width':1.3,fill:'none',opacity:.75}));for(const[pointIndex,p]of valid.entries()){if(pointIndex%Math.max(1,Math.ceil(valid.length/48))===0||pointIndex===valid.length-1){const mark=shape('circle',{cx:x(p[0]),cy:y(p[1]),r:2.2,fill:colour,opacity:.8});mark.append(shape('title',{},`${text(p[0])} ${series.axisUnit||'1'} / ${text(p[1])} ${series.unit||'1'}`));svg.append(mark)}}const label=shape('text',{x:46+seriesIndex*172,y:212,fill:colour,'font-size':9,'font-family':'monospace'},`${String(series.entity).slice(0,11)}/${String(series.quantity).slice(0,13)}`);label.append(shape('title',{},`${series.entity}/${series.quantity} [${series.unit||'1'}] / ${valid.length} displayed / ${series.count} source rows`));svg.append(label)}
 svg.append(shape('text',{x:3,y:27,fill:'#6b89b0','font-size':8},text(maxY)),shape('text',{x:3,y:189,fill:'#6b89b0','font-size':8},text(minY)),shape('text',{x:38,y:202,fill:'#6b89b0','font-size':8},text(minX)),shape('text',{x:586,y:202,fill:'#6b89b0','font-size':8,'text-anchor':'end'},text(maxX)),shape('text',{x:312,y:202,fill:'#6b89b0','font-size':8,'text-anchor':'middle'},`axis [${first.axisUnit||'1'}] / value [${first.unit||'1'}]`))
}
function drawHeatmap(svg,analysis){
 svg.replaceChildren();svg.append(shape('rect',{x:0,y:0,width:600,height:220,fill:'#ffffff'}));const groups=(analysis.heatmap||[]).slice(0,6);if(!groups.length)return;
 svg.append(shape('title',{},`${groups.length} displayed groups; row-normalized means; source bin positions and empty intervals retained`));
 const height=164/groups.length;for(const[index,group]of groups.entries()){const columns=Math.min(128,Math.max(1,number(group.configuredBins))),bins=(group.bins||[]).filter(bin=>Number.isInteger(bin.bin)&&bin.bin>=0&&bin.bin<columns&&Number.isFinite(bin.mean)&&bin.count>0).slice(0,128),means=bins.map(b=>b.mean),low=Math.min(...means),high=Math.max(...means),label=shape('text',{x:8,y:20+index*height+height*.52,fill:'#5879a7','font-size':8,'font-family':'monospace'},`${String(group.entity).slice(0,10)}/${String(group.quantity).slice(0,12)}`);label.append(shape('title',{},`${group.entity}/${group.quantity} [${group.unit||'1'}] / axis [${group.axisUnit||'1'}]`));svg.append(label,shape('text',{x:8,y:29+index*height+height*.52,fill:'#8297b3','font-size':7},`${group.unit||'1'} / ${group.axisUnit||'1'}`),shape('rect',{x:142,y:20+index*height,width:440,height:Math.max(4,height-3),fill:'#f3f7fc'}));for(const bin of bins){const level=high===low ? .5 : (bin.mean-low)/(high-low),node=shape('rect',{x:142+bin.bin*440/columns,y:20+index*height,width:Math.max(1,440/columns-1),height:Math.max(4,height-3),fill:`hsl(${218-level*36} 84% ${94-level*50}%)`,stroke:'#d8e8ff','stroke-width':.5});node.append(shape('title',{},`${bin.fromAxis} – ${bin.toAxis} ${group.axisUnit||'1'}: ${text(bin.mean)} ${group.unit||'1'} / ${bin.count} rows`));svg.append(node)}}
 for(let i=0;i<64;i++)svg.append(shape('rect',{x:142+i*440/64,y:200,width:440/64+1,height:7,fill:`hsl(${218-i/63*36} 84% ${94-i/63*50}%)`}));svg.append(shape('text',{x:142,y:217,fill:'#6c8ab2','font-size':8},'row-normalized interval means'))
}
