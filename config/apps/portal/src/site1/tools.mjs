import {submitAndWait} from './client.mjs';

const kinds={matrix:'matrix',radix:'base',json:'json',csv:'csv'},id=document.body.dataset.tool;
const root=document.querySelector('[data-tool-certificate]'),form=document.querySelector('#tool-form'),output=document.querySelector('#tool-output');
if(root&&form&&output&&kinds[id]){
 const button=root.querySelector('[data-certificate-run]'),note=root.querySelector('[data-certificate-note]'),details=root.querySelector('details'),summary=root.querySelector('[data-certificate-summary]'),checks=root.querySelector('[data-certificate-checks]');
 const downloadButtons=[...root.querySelectorAll('[data-certificate-download]')];
 const lifetime=new AbortController(),urls=new Map();let pending=null,snapshot=null,certificate=null,generation=0,request=null,suspended=false;
 const on=(node,name,handler,options={})=>node?.addEventListener(name,handler,{...options,signal:lifetime.signal});
 function fields(){const values={};for(const node of form.elements)if(node.name&&node.type!=='file')values[node.name]=node.value;return {values,file:form.elements.namedItem('file')?.files?.[0]||null};}
 function same(a,b){return a&&b&&JSON.stringify(a.values)===JSON.stringify(b.values)&&a.file===b.file;}
 function reset(message=''){
  request?.abort();request=null;certificate=null;button.disabled=true;button.textContent=label;note.textContent=message;details.hidden=true;details.open=false;checks.replaceChildren();for(const button of downloadButtons)button.disabled=true;
 }
 function invalidate(){generation++;pending=null;snapshot=null;reset();}
 function localSession(){try{const value=sessionStorage.getItem('ocv.site.certificate.session');if(/^[0-9a-f-]{36}$/i.test(value||''))return value;const session=crypto.randomUUID();sessionStorage.setItem('ocv.site.certificate.session',session);return session;}catch{return crypto.randomUUID();}}
 const session=localSession(),label={matrix:'计算记录',radix:'转换凭据',json:'结构记录',csv:'格式报告'}[id];button.textContent=label;
 async function inputFor(captured){
  const input=captured.values;
  if(id==='matrix')return {operation:input.operation,a:input.a,...(input.operation==='determinant'?{}:{b:input.b})};
  if(id==='radix')return {value:input.value,from:Number(input.from),to:Number(input.to)};
  let source=input.source;
  if(id==='csv'&&captured.file){if(captured.file.size>65536)throw Error('核对限 64 KiB；原结果仍可导出');source=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(await captured.file.arrayBuffer());}
  if(new TextEncoder().encode(source).length>65536)throw Error('核对限 64 KiB；原结果仍可导出');
  return id==='csv'?{source,delimiter:',',header:false}:{source};
 }
 on(form,'submit',()=>{invalidate();const captured=fields();pending={captured,generation,payload:inputFor(captured).then(input=>({input}),error=>({error:error.message}))};},{capture:true});
 on(form,'input',invalidate);on(form,'change',invalidate);
 for(const selector of ['#tool-cancel','#tool-example','[data-work="undo"]','[data-work="redo"]'])on(document.querySelector(selector),'click',invalidate,{capture:true});
 on(document.querySelector('#work-project'),'change',invalidate,{capture:true});on(document.querySelector('#work-text'),'change',invalidate,{capture:true});
 on(output,'ocv:result',()=>{if(!output.value){snapshot=null;reset();}});
 on(document,'ocv:tool-success',async event=>{
  if(event.detail?.id!==id||!pending)return;const candidate=pending,expected=output.value;
  const loaded=await candidate.payload;
  if(candidate!==pending||candidate.generation!==generation||suspended||!same(candidate.captured,fields())||expected!==output.value)return;
  if(loaded.error){note.textContent=loaded.error;return;}
  if(['json','csv'].includes(id)&&new TextEncoder().encode(expected).length>65536){note.textContent='核对记录限 64 KiB；原结果仍可导出';return;}
  snapshot={input:loaded.input,expected,captured:candidate.captured,generation};void prepare();
 });
 function paint(value){
  if(value?.schema!=='ocv.tool-certificate/1'||typeof value.valid!=='boolean'||!Array.isArray(value.checks)||value.checks.length>64)throw Error('回执格式不匹配');
  certificate=value;details.hidden=false;summary.textContent=value.valid?'记录完整':'记录存在差异';checks.replaceChildren();
  const labels={supportedMatrix:'矩阵范围',rationalReduction:'精确分数',expectedShape:'结果尺寸',expectedComparison:'原结果核对',supportedBase:'进制范围',integerRoundtrip:'整数转换',jsonSyntax:'JSON 结构',rootSchema:'根类型',requiredKeys:'必需字段',csvSyntax:'CSV 结构',widthSchema:'列数',columnSchema:'列名',inputValidation:'输入范围'};
  for(const check of value.checks){if(!labels[check.name]&&check.passed)continue;const row=document.createElement('li');row.textContent=`${check.passed?'✓':'×'} ${labels[check.name]||'记录核对'}${check.passed?'':'：'+String(check.detail||'').slice(0,240)}`;checks.append(row);}
  for(const warning of (Array.isArray(value.warnings)?value.warnings:[]).slice(0,8)){const row=document.createElement('li');row.textContent=String(warning).slice(0,320);checks.append(row);}
  if(value.result?.exact!==undefined){const row=document.createElement('li');row.textContent='精确值：'+(typeof value.result.exact==='string'?value.result.exact:JSON.stringify(value.result.exact)).slice(0,600);checks.prepend(row);}
  if(value.kind==='matrix'){const row=document.createElement('li');row.textContent='十进制字面值按精确分数核对；原显示容差为 1e-12 + 1e-10 × |精确值|。';checks.append(row);}
  for(const button of downloadButtons){const file=value.download?.[button.dataset.certificateDownload];button.disabled=!(file&&typeof file.text==='string'&&new TextEncoder().encode(file.text).length<=524288);}
 }
 async function prepare(){
  const current=snapshot;if(!current||!same(current.captured,fields())||current.expected!==output.value){invalidate();return;}
  const active=new AbortController();request=active;button.disabled=true;note.textContent='⋯';
  const signal=AbortSignal.any([active.signal,lifetime.signal,AbortSignal.timeout(120000)]);
  try{
   const receipt=await submitAndWait({kind:'certificate',session,certificate:{schema:'ocv.tool-certificate/1',kind:kinds[id],input:current.input,expected:current.expected}},{signal});
   if(signal.aborted||request!==active||snapshot!==current||current.generation!==generation||suspended)return;
   paint(receipt?.result?.certificate||receipt?.result);details.open=false;note.textContent='';button.disabled=false;
  }catch{if(request===active&&!suspended)note.textContent=active.signal.aborted?'':'记录未生成；原结果保留';}
  finally{if(request===active){request=null;button.textContent=label;}}
 }
 on(button,'click',()=>{if(!certificate||button.disabled)return;details.open=!details.open;});
 for(const button of downloadButtons)on(button,'click',()=>{
  const format=button.dataset.certificateDownload,file=certificate?.download?.[format];if(!file||typeof file.text!=='string'||new TextEncoder().encode(file.text).length>524288)return;
  const mime=format==='json'?'application/json':'text/csv;charset=utf-8',blob=new Blob([file.text],{type:mime}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`ocv-${id}-certificate.${format}`;link.click();const timer=setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},1500);urls.set(url,timer);
 });
 on(window,'pagehide',event=>{suspended=true;generation++;pending=null;snapshot=null;reset();for(const [url,timer]of urls){clearTimeout(timer);URL.revokeObjectURL(url);}urls.clear();if(!event.persisted)lifetime.abort();});
 on(window,'pageshow',event=>{if(event.persisted)suspended=false;});
}
