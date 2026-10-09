import {appearance,disposeAppearance} from './scene.mjs';
let reference,lastProject,sharedContext,worker,pending,generation=0,deadline=0,heightFrame=0,lastHeight=0,closed=false;
let inputFrame=0,inputBusy=false,gesture;
let probeWidthFrame=0,lastProbeWidth=0;
const inputQueue=[];
const life=new AbortController(),on=(target,type,handler,options={})=>target?.addEventListener(type,handler,{...options,signal:life.signal});
const parse=value=>typeof value==='string'?JSON.parse(value):value;
const post=(type,data)=>parent.postMessage({type,...data},location.origin);
function height(){if(heightFrame||closed)return;heightFrame=requestAnimationFrame(()=>{heightFrame=0;const app=document.querySelector('#workshop-app');if(!app)return;const value=Math.ceil(Math.max(app.getBoundingClientRect().height,app.scrollHeight));if(value!==lastHeight){lastHeight=value;post('OCV_WORKSHOP_HEIGHT',{height:value})}})}
const observer=new ResizeObserver(height);observer.observe(document.querySelector('#workshop-app'));
function probeWidth(){if(probeWidthFrame||closed||!reference)return;probeWidthFrame=requestAnimationFrame(()=>{probeWidthFrame=0;const svg=document.querySelector('#mechanical-sheet'),matrix=svg?.getScreenCTM(),width=matrix?Math.abs(matrix.a)*svg.viewBox.baseVal.width:0;if(Number.isFinite(width)&&width>=64&&Math.abs(width-lastProbeWidth)>.5){lastProbeWidth=width;reference.invokeMethodAsync('UpdateCanvasWidth',width).catch(()=>{})}})}
const probeObserver=new ResizeObserver(probeWidth);
function cancel(message='计算已取消'){++generation;clearTimeout(deadline);worker?.terminate();worker=undefined;pending?.reject(Error(message));pending=undefined}
async function run(request){
 cancel();if(closed)throw Error('工作台已关闭');const id=generation,input=parse(request),encoded=JSON.stringify(input);if(new TextEncoder().encode(encoded).length>262144)throw Error('模拟输入超过256 KiB');
 const source=lastProject?structuredClone(lastProject):null;if(source){source.world=structuredClone(input.world);source.challenge=input.challenge||undefined}
 worker=new Worker(new URL('./engine-worker.mjs',import.meta.url),{type:'module'});
 return new Promise((resolve,reject)=>{
  pending={reject};deadline=setTimeout(()=>cancel('本地模拟超过30秒'),30000);
  worker.onmessage=({data})=>{if(data.id!==id||id!==generation||closed)return;clearTimeout(deadline);worker?.terminate();worker=undefined;pending=undefined;if(data.error)reject(Error(data.error));else{if(Array.isArray(data.result?.frames)&&data.result.frames.length)post('OCV_WORKSHOP_RESULT',{result:data.result,project:source,request:input,enhanced:true});resolve(data.result)}height()};
  worker.onerror=event=>cancel(event.message||'模拟进程已停止');worker.postMessage({id,input:encoded});
 });
}
function download(name,mime,content){const url=URL.createObjectURL(new Blob([content],{type:mime})),link=document.createElement('a');link.href=url;link.download=String(name).replace(/[\\/]/g,'_');link.click();setTimeout(()=>URL.revokeObjectURL(url),10000)}
function point(x,y){const svg=document.querySelector('#mechanical-sheet'),matrix=svg?.getScreenCTM();if(!matrix||!Number.isFinite(x+y))return[];try{const p=svg.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(matrix.inverse());return Number.isFinite(q.x+q.y)?[(q.x-550)/55,(470-q.y)/55]:[]}catch{return[]}}
function viewScale(){const matrix=document.querySelector('#mechanical-sheet')?.getScreenCTM();if(!matrix)return[];try{const inverse=matrix.inverse(),values=[inverse.a,inverse.b,inverse.c,inverse.d];return values.every(Number.isFinite)?values:[]}catch{return[]}}
const editable=target=>target instanceof Element&&!!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');
function scheduleInput(){if(closed||inputBusy||inputFrame||!inputQueue.length||!reference)return;inputFrame=requestAnimationFrame(dispatchInput)}
async function dispatchInput(){
 inputFrame=0;if(closed||inputBusy||!reference)return;const item=inputQueue.shift();if(!item)return;inputBusy=true;
 try{await reference.invokeMethodAsync(item.method,...item.args)}catch(error){if(!closed)post('OCV_WORKSHOP_NOTICE',{message:String(error.message).slice(0,240)})}
 finally{inputBusy=false;if(item.finish!==undefined&&gesture?.id===item.finish)gesture=undefined;scheduleInput()}
}
function queueInput(item){
 if(closed||!reference)return;
 if(item.method==='CanvasPointer'&&item.args[0]==='move'){
  const last=inputQueue.at(-1);if(last?.method==='CanvasPointer'&&last.args[0]==='move'&&last.args[2]===item.args[2]){inputQueue[inputQueue.length-1]=item;scheduleInput();return}
 }
 if(item.method==='CanvasCommand'&&item.args[0]==='wheel'){
  const last=inputQueue.at(-1);if(last?.method==='CanvasCommand'&&last.args[0]==='wheel'){last.args[2]=item.args[2];last.args[3]=item.args[3];last.args[4]=Math.max(-4,Math.min(4,last.args[4]+item.args[4]));scheduleInput();return}
 }
 if(inputQueue.length>=12&&item.method==='CanvasCommand'&&item.args[0]!=='escape')return;
 if(inputQueue.length>=16){const disposable=inputQueue.findIndex(value=>value.method==='CanvasCommand'||value.args[0]==='move');if(disposable>=0)inputQueue.splice(disposable,1);else return}
 inputQueue.push(item);scheduleInput();
}
function releaseGesture(){if(!gesture)return;gesture.ended=true;try{if(gesture.svg.hasPointerCapture(gesture.id))gesture.svg.releasePointerCapture(gesture.id)}catch{}}
function pointerItem(action,event,body=''){return{method:'CanvasPointer',args:[action,body,event.pointerId,event.clientX,event.clientY,event.button,!!event.shiftKey],...(action==='up'||action==='cancel'?{finish:event.pointerId}:{})}}
on(document,'contextmenu',event=>{
 if(closed||!(event.target instanceof Element)||!event.target.closest('#mechanical-sheet'))return;
 event.preventDefault();
},{capture:true,passive:false});
on(document,'pointerdown',event=>{
 const svg=event.target instanceof Element?event.target.closest('#mechanical-sheet'):null;
 if(!svg||!reference||closed||editable(event.target)||event.ctrlKey||event.metaKey||event.altKey||![0,1,2].includes(event.button)||event.isPrimary===false)return;
 event.preventDefault();event.stopImmediatePropagation();svg.focus({preventScroll:true});
 if(gesture||(event.button===0&&svg.dataset.canvasLock==='true'))return;
 gesture={id:event.pointerId,svg,ended:false};try{svg.setPointerCapture(event.pointerId)}catch{}
 queueInput(pointerItem('down',event,event.target.closest('[data-body]')?.dataset.body||''));
},{capture:true,passive:false});
on(document,'pointermove',event=>{
 if(!gesture||gesture.id!==event.pointerId||gesture.ended)return;
 event.preventDefault();event.stopImmediatePropagation();queueInput(pointerItem('move',event));
},{capture:true,passive:false});
on(document,'pointerup',event=>{
 if(!gesture||gesture.id!==event.pointerId||gesture.ended)return;
 event.preventDefault();event.stopImmediatePropagation();releaseGesture();queueInput(pointerItem('up',event));
},{capture:true,passive:false});
function abortGesture(event){
 if(!gesture||gesture.id!==event.pointerId||gesture.ended)return;
 event.stopImmediatePropagation();releaseGesture();queueInput(pointerItem('cancel',event));
}
on(document,'pointercancel',abortGesture,{capture:true});on(document,'lostpointercapture',abortGesture,{capture:true});
on(document,'wheel',event=>{
 const svg=event.target instanceof Element?event.target.closest('#mechanical-sheet'):null;
 if(!svg||!reference||closed||editable(event.target)||event.ctrlKey||event.metaKey||event.altKey)return;
 event.preventDefault();event.stopImmediatePropagation();if(gesture)return;
 const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?svg.clientHeight:1)/100;
 if(Number.isFinite(delta)&&delta!==0)queueInput({method:'CanvasCommand',args:['wheel',false,event.clientX,event.clientY,Math.max(-2,Math.min(2,delta))]});
},{capture:true,passive:false});
on(document,'keydown',event=>{
 const svg=document.querySelector('#mechanical-sheet');
 if(!reference||closed||!svg||document.activeElement!==svg||editable(event.target)||event.ctrlKey||event.metaKey||event.altKey||event.isComposing)return;
 const key=event.key.toLowerCase();let command=({' ':'pause',f:'fit','+':'zoom-in','=':'zoom-in','-':'zoom-out',delete:'delete',arrowleft:'left',arrowright:'right',arrowup:'up',arrowdown:'down',r:'rotate',d:'duplicate',escape:'escape'})[key];
 if(!command)return;event.preventDefault();event.stopImmediatePropagation();
 if(event.repeat&&['pause','duplicate','delete','rotate','escape'].includes(command))return;
 let finish;if(command==='escape'&&gesture){finish=gesture.id;releaseGesture()}
 queueInput({method:'CanvasCommand',args:[command,!!event.shiftKey,0,0,0],...(finish!==undefined?{finish}:{})});
},{capture:true});
function notify(value){const project=parse(value);if(JSON.stringify(project).length>131072)throw Error('工程大小超过128 KiB');lastProject=structuredClone(project);post('OCV_WORKSHOP_PROJECT',{project});height()}
function publishResult(resultValue,projectValue,requestValue,enhanced=false){if(closed)return;const result=parse(resultValue),project=parse(projectValue),request=parse(requestValue);if(new TextEncoder().encode(JSON.stringify(result)).length>4194304||!Array.isArray(result?.frames)||result.frames.length>256)throw Error('回放记录无效');post('OCV_WORKSHOP_RESULT',{result,project,request,enhanced:!!enhanced});height()}
function preview(project,settings){appearance(parse(project),parse(settings)||{},document.querySelector('#mechanical-appearance'));height()}
window.WorkshopBridge={register(value){reference=value;const svg=document.querySelector('#mechanical-sheet');if(svg){svg.setAttribute('tabindex','0');svg.style.touchAction='none';probeObserver.observe(svg);probeWidth()}post('OCV_WORKSHOP_READY',{});height()},sharedContext(value){sharedContext=parse(value);post('OCV_SHARED_CONTEXT',sharedContext)},run,cancel,point,viewScale,download,async readFile(id,maxBytes=131072){if(id!=='project-file')throw Error('未识别的工程输入');const file=document.getElementById(id)?.files?.[0],limit=Math.min(5*1024*1024,Math.max(1,Number(maxBytes)||131072));if(!file)throw Error('请选择工程文件。');if(file.size>limit)throw Error(limit>131072?'导入回放超过5 MiB。':'导入工程超过128 KiB。');return new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer())},localGet(key){try{return localStorage.getItem(key)}catch{return null}},localSet(key,value){if(value.length>524288)throw Error('本地工程超过512 KiB');localStorage.setItem(key,value)},notify,publishResult,preview,close(){close()}};
on(window,'message',async event=>{if(event.origin!==location.origin||event.source!==parent||closed||!reference)return;const d=event.data;if(d?.type==='OCV_SHARED_MEASURE'){if(sharedContext)post('OCV_SHARED_CONTEXT',sharedContext)}else if(['OCV_SHARED_REFRESH','OCV_SHARED_OPEN_BRANCH','OCV_SHARED_APPLY_PROJECT'].includes(d?.type)){const p=d.project||sharedContext?.project;if(p)await reference.invokeMethodAsync('ReloadShared',JSON.stringify(p)).catch(error=>post('OCV_WORKSHOP_NOTICE',{message:String(error.message).slice(0,240)}));}});
on(window,'message',async event=>{if(event.origin!==location.origin||event.source!==parent||closed)return;const data=event.data;if(data?.type==='OCV_WORKSHOP_MEASURE'){lastHeight=0;height();if(lastProject)post('OCV_WORKSHOP_PROJECT',{project:lastProject})}else if(data?.type==='OCV_WORKSHOP_COMPONENT'&&reference){try{const text=JSON.stringify(data.project),source=JSON.stringify(data.sourceProject);if(new TextEncoder().encode(text).length>131072||new TextEncoder().encode(source).length>131072)throw Error('组件大小超过128 KiB');await reference.invokeMethodAsync('InsertComponent',text,source)}catch(error){post('OCV_WORKSHOP_NOTICE',{message:error.message})}}else if(data?.type==='OCV_WORKSHOP_TEMPLATE'&&reference){try{const text=JSON.stringify(data.project);if(text.length>131072)throw Error('组件大小超过128 KiB');await reference.invokeMethodAsync('ApplyTemplate',text)}catch(error){post('OCV_WORKSHOP_NOTICE',{message:error.message})}}else if(data?.type==='OCV_WORKSHOP_SELECT_TEMPLATE'&&reference){try{await reference.invokeMethodAsync('SelectTemplate',String(data.name).slice(0,64))}catch(error){post('OCV_WORKSHOP_NOTICE',{message:error.message})}}});
function close(){if(closed)return;closed=true;releaseGesture();gesture=undefined;inputQueue.length=0;cancelAnimationFrame(inputFrame);inputFrame=0;cancel();observer.disconnect();probeObserver.disconnect();cancelAnimationFrame(probeWidthFrame);cancelAnimationFrame(heightFrame);disposeAppearance();life.abort();reference=undefined}
on(window,'pagehide',event=>{if(!event.persisted)close()});on(window,'resize',height,{passive:true});on(document,'load',height,{capture:true});height();
const cabal312512=()=>generation;
