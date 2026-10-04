import {toolById} from './data.mjs';
import {keyboardReport,pointerReport,measureScreen} from '../net/net.mjs';
const tool=toolById(document.body.dataset.tool),form=document.querySelector('#tool-form');
const output=document.querySelector('#tool-output'),preview=document.querySelector('#tool-preview'),tableBox=document.querySelector('#tool-table'),status=document.querySelector('#tool-status'),transfer=document.querySelector('#tool-transfer');
const lab=document.querySelector('#tool-lab');
const copy=document.querySelector('#tool-copy'),exportButton=document.querySelector('#tool-export'),cancel=document.querySelector('#tool-cancel');
const lifetime=new AbortController(),on=(node,name,fn,options={})=>node?.addEventListener(name,fn,{...options,signal:lifetime.signal});
const state=window.__ocvTools={id:tool.id,runs:0,successes:0,busy:false,cancelled:0,lastTool:null,resultLength:0};
let serial=0,controller=null,liveController=null,lastResult=null,liveFrame=0,liveValue=null,previewUrl=null,scene=null,suspended=false;
const urls=new Map(),disposers=new Set();
function note(text,error=false){status.textContent=text;status.dataset.error=String(error);}
function clearLive(){liveController?.abort();liveController=null;cancelAnimationFrame(liveFrame);liveFrame=0;liveValue=null;}
function clearPreview(){preview.replaceChildren();preview.hidden=true;if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}}
function clearResult(){lastResult=null;output.value='';clearPreview();tableBox.replaceChildren();tableBox.hidden=true;copy.disabled=exportButton.disabled=true;copy.textContent='复制';transfer.textContent='';state.resultLength=0;output.dispatchEvent(new CustomEvent('ocv:result'));}
function disposeSession(){controller?.abort();clearLive();for(const dispose of disposers){try{dispose();}catch{}}disposers.clear();scene=null;lab?.replaceChildren();if(lab)lab.hidden=true;}
function render(result){
 if(!result||typeof result.text!=='string')throw Error('没有可导出的结果');
 if(new TextEncoder().encode(result.text).byteLength>4*1024*1024)throw Error('结果超过 4 MiB');
 if(result.blob!==undefined&&(!(result.blob instanceof Blob)||!result.blob.size||result.blob.size>32*1024*1024))throw Error('文件结果限 32 MiB');
 if(result.blob&&result.mime&&result.blob.type!==result.mime)throw Error('文件格式不一致');
 if(typeof result.dispose==='function')disposers.add(result.dispose);
 if(result.suspend||result.resume||result.dispose)scene=result;
 lastResult=result;output.value=result.text;state.resultLength=result.text.length;copy.disabled=exportButton.disabled=false;output.dispatchEvent(new CustomEvent('ocv:result'));
 copy.textContent=result.blob?'复制信息':'复制';clearPreview();
 if(['markdown','svg-chart'].includes(tool.id)&&typeof result.html==='string'){preview.innerHTML=result.html;preview.hidden=false;}
 if(result.previewBlob instanceof Blob){if(!['image/png','image/jpeg','image/webp'].includes(result.previewBlob.type)||result.previewBlob.size>32*1024*1024)throw Error('预览格式不支持');const img=document.createElement('img');previewUrl=URL.createObjectURL(result.previewBlob);img.src=previewUrl;img.alt='结果预览';img.className='tool-media';preview.append(img);preview.hidden=false;}
 tableBox.replaceChildren();tableBox.hidden=true;
 if(Array.isArray(result.table)&&result.table.length){const table=document.createElement('table'),body=document.createElement('tbody');
  for(const row of result.table.slice(0,500)){const tr=document.createElement('tr');for(const value of row.slice(0,256)){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}body.append(tr);}table.append(body);tableBox.append(table);tableBox.hidden=false;
  if(result.table.length>500){const note=document.createElement('p');note.textContent='显示前 500 行，导出保留完整结果。';tableBox.append(note);}
 }
}
function live(result){
 clearLive();if(!result.live)return;liveController=new AbortController();
 const queue=value=>{if(document.hidden)return;liveValue=value;if(!liveFrame)liveFrame=requestAnimationFrame(()=>{liveFrame=0;const value=liveValue;liveValue=null;if(value&&!document.hidden)render(value);});};
 const bind=(node,name,fn)=>node.addEventListener(name,fn,{signal:liveController.signal,passive:true});
 if(result.live==='keyboard'){bind(document,'keydown',e=>queue(keyboardReport(e)));bind(document,'keyup',e=>queue(keyboardReport(e)));}
 if(result.live==='pointer')bind(document,'pointermove',e=>queue(pointerReport(e)));
 if(result.live==='screen'){bind(window,'resize',()=>queue(measureScreen(window)));if(window.visualViewport)bind(window.visualViewport,'resize',()=>queue(measureScreen(window)));}
}
function values(){const input={};for(const field of tool.fields){const node=form.elements.namedItem(field.key);if(field.type==='file')input[field.key]=field.multiple?[...node.files]:node.files?.[0];else{input[field.key]=node.value;if(field.type==='number'&&!node.value.trim())throw Error(`请输入${field.label}`);}}return input;}
async function run(event){
 event.preventDefault();disposeSession();clearResult();suspended=false;const id=++serial;controller=new AbortController();const active=controller;
 if(lab)lab.hidden=false;
 state.runs++;state.busy=true;state.lastTool=tool.id;cancel.hidden=false;note('处理中…');
 const current=()=>id===serial&&!active.signal.aborted&&!suspended;
 const onStatus=(text,error=false)=>{if(current())note(String(text),error);};
 const onResult=result=>{if(!current())return;try{render(result);}catch(error){disposeSession();clearResult();serial++;state.busy=false;cancel.hidden=true;note(error?.message||'未完成',true);}};
 try{const result=await tool.run(values(),{signal:active.signal,lab,onResult,onStatus});if(!current()){result?.dispose?.();return;}render(result);live(result);state.successes++;document.dispatchEvent(new CustomEvent('ocv:tool-success',{detail:{id:tool.id}}));if(lab&&!lab.childNodes.length)lab.hidden=true;note('完成');}
 catch(error){if(id!==serial)return;disposeSession();clearResult();note(error?.name==='AbortError'?'已取消':error?.message||'未完成',true);}
 finally{if(id===serial){state.busy=false;cancel.hidden=!(scene?.dispose||lastResult?.live);}}
}
on(form,'submit',run);
on(cancel,'click',()=>{serial++;disposeSession();clearResult();state.cancelled++;state.busy=false;cancel.hidden=true;note('已取消');});
on(document.querySelector('#tool-example'),'click',()=>{for(const field of tool.fields){const node=form.elements.namedItem(field.key);node.value=field.type==='file'?'':String(field.default??(field.type==='select'?field.options[0].value:''));}transfer.textContent='';});
on(document.querySelector('[data-tool-front]'),'click',()=>{document.querySelector('.tool-feature').style.zIndex='260';});
on(copy,'click',async()=>{if(!lastResult)return;const text=lastResult.text;try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);else{output.focus();output.select();if(!document.execCommand('copy'))throw Error('当前浏览器不能复制');}transfer.textContent='已复制';}catch(error){transfer.textContent=error?.message||'复制未完成';}});
on(exportButton,'click',()=>{if(!lastResult)return;const extension=/^[a-z0-9]{1,8}$/.test(lastResult.extension||'')?lastResult.extension:'txt',blob=lastResult.blob||new Blob([lastResult.text],{type:lastResult.mime||'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`ocv-${tool.id}.${extension}`;link.click();const timer=setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},1200);urls.set(url,timer);transfer.textContent='已导出';});
on(document,'visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(liveFrame);liveFrame=0;liveValue=null;}});
on(window,'pagehide',event=>{suspended=true;clearLive();if(event.persisted&&!state.busy){scene?.suspend?.();return;}serial++;disposeSession();clearResult();state.busy=false;cancel.hidden=true;for(const [url,timer]of urls){clearTimeout(timer);URL.revokeObjectURL(url);}urls.clear();if(!event.persisted)lifetime.abort();});
on(window,'pageshow',event=>{if(event.persisted){suspended=false;scene?.resume?.();if(lastResult?.live)live(lastResult);}});
note('');
