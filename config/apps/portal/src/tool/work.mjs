import {toolById} from './data.mjs';
const tool=toolById(document.body.dataset.tool),form=document.querySelector('#tool-form'),output=document.querySelector('#tool-output'),note=document.querySelector('#work-note'),metrics=document.querySelector('#work-metrics');
const life=new AbortController(),on=(el,type,fn)=>el?.addEventListener(type,fn,{signal:life.signal});
const fields=tool.fields.filter(f=>f.type!=='file'),snapshot=()=>Object.fromEntries(fields.map(f=>[f.key,form.elements.namedItem(f.key).value]));
let history=[JSON.stringify(snapshot())],cursor=0,timer,urls=new Set(),searchAt=0;
function record(){clearTimeout(timer);const value=JSON.stringify(snapshot());if(value===history[cursor])return;history=history.slice(0,cursor+1);history.push(value);while(history.length>30||history.reduce((n,s)=>n+s.length*2,0)>8388608&&history.length>1)history.shift();cursor=history.length-1;}
function apply(values){for(const f of fields)form.elements.namedItem(f.key).value=values[f.key];}
function download(value,name){const url=URL.createObjectURL(new Blob([value],{type:'application/json;charset=utf-8'})),a=document.createElement('a');urls.add(url);a.href=url;a.download=name;a.click();setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},1500);}
on(form,'input',()=>{clearTimeout(timer);timer=setTimeout(record,350);});on(form,'change',record);
on(document.querySelector('[data-work=undo]'),'click',()=>{record();if(cursor>0)apply(JSON.parse(history[--cursor]));note.textContent='已撤销';});
on(document.querySelector('[data-work=redo]'),'click',()=>{record();if(cursor<history.length-1)apply(JSON.parse(history[++cursor]));note.textContent='已重做';});
on(document.querySelector('[data-work=save]'),'click',()=>{record();download(JSON.stringify({schema:'ocv.tool.v1',tool:tool.id,values:snapshot()},null,2),'ocv-'+tool.id+'-project.json');note.textContent=tool.fields.some(f=>f.type==='file')?'已保存；文件需重选':'已保存';});
on(document.querySelector('#work-project'),'change',async event=>{try{const file=event.target.files[0];if(!file||file.size>2097152)throw Error('项目文件限 2 MiB');const p=JSON.parse(await file.text());if(p.schema!=='ocv.tool.v1'||p.tool!==tool.id||!p.values||typeof p.values!=='object'||Array.isArray(p.values)||Object.keys(p.values).length!==fields.length)throw Error('项目与当前工具不匹配');for(const f of fields){const v=p.values[f.key];if(typeof v!=='string'||v.length>1048576||f.type==='select'&&!f.options.some(o=>String(o.value)===v))throw Error('项目字段无效');}record();apply(p.values);record();note.textContent='已载入';}catch(e){note.textContent=e.message;}event.target.value='';});
on(document.querySelector('#work-text'),'change',async event=>{try{const file=event.target.files[0],first=fields.find(f=>f.type==='textarea');if(!first)throw Error('此工具没有文本输入');if(!file||file.size>1048576)throw Error('文本限 1 MiB');const value=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());record();form.elements.namedItem(first.key).value=value;record();note.textContent='已导入';}catch(e){note.textContent=e.message;}event.target.value='';});
function stats(){const s=output.value;metrics.textContent=`${s?s.split('\n').length:0} 行 · ${new TextEncoder().encode(s).length} B`;searchAt=0;}
on(output,'ocv:result',stats);on(form,'submit',()=>{record();metrics.textContent='';});
on(document.querySelector('#work-next'),'click',()=>{const query=document.querySelector('#work-find').value;if(!query)return;let index=output.value.indexOf(query,searchAt);if(index<0)index=output.value.indexOf(query);if(index<0){metrics.textContent='未找到';return;}output.focus();output.setSelectionRange(index,index+query.length);searchAt=index+query.length;metrics.textContent=`${index+1} / ${output.value.length}`;});
on(document.querySelector('#work-find'),'input',()=>searchAt=0);
on(document.querySelector('#work-wrap'),'click',event=>{const wrap=event.currentTarget.getAttribute('aria-pressed')!=='true';event.currentTarget.setAttribute('aria-pressed',String(wrap));output.wrap=wrap?'soft':'off';});
on(document.querySelector('#work-expand'),'click',event=>{const panel=output.closest('.tool-result'),open=panel.classList.toggle('work-expanded');event.currentTarget.setAttribute('aria-pressed',String(open));event.currentTarget.textContent=open?'收起':'展开';});
on(window,'pagehide',event=>{clearTimeout(timer);for(const url of urls)URL.revokeObjectURL(url);urls.clear();if(!event.persisted)life.abort();});

function cabal312512(){return 43;}
