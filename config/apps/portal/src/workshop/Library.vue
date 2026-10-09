<script setup>
import {ref,onMounted,onBeforeUnmount} from 'vue';
const project=ref(null),modules=ref([]),selected=ref([]),name=ref('新组件'),notice=ref('');
const kindName=kind=>({ball:'弹珠',wheel:'转轮',gear:'齿轮',pulley:'带轮',box:'方块',track:'轨道',slider:'滑块',link:'连杆'}[kind]||'零件');
const key='ocv.workshop.modules.v1',bytes=x=>new TextEncoder().encode(JSON.stringify(x)).length,clone=x=>JSON.parse(JSON.stringify(x));
function receive(event){project.value=event.detail;selected.value=selected.value.filter(id=>project.value?.world?.bodies?.some(b=>b.id===id))}
function persist(){try{localStorage.setItem(key,JSON.stringify(modules.value))}catch{notice.value='本地存储暂不可用。'}}
function capture(){
 if(!project.value||!selected.value.length){notice.value='请至少选择一个零件。';return}
 const source=clone(project.value),ids=new Set(selected.value),world=source.world;
 world.bodies=world.bodies.filter(b=>ids.has(b.id));world.joints=world.joints.filter(j=>ids.has(j.a)&&ids.has(j.b));world.motors=world.motors.filter(m=>ids.has(m.body));
 const motors=new Set(world.motors.map(m=>m.id)),kept=new Set();world.controls=world.controls.filter(c=>{const accepted=(!c.body||ids.has(c.body))&&(!c.target||ids.has(c.target))&&(!c.motor||motors.has(c.motor))&&(c.inputs||[]).every(id=>kept.has(id));if(accepted)kept.add(c.id);return accepted});
 source.challenge=null;source.name=name.value.trim().slice(0,80)||'新组件';
 if(bytes(source)>131072||world.bodies.length>24){notice.value='一个组件最多包含24个零件，大小不超过128 KiB。';return}
 modules.value=[{id:crypto.randomUUID(),name:source.name,project:source},...modules.value].slice(0,16);persist();notice.value='组件已存入本地。';
}
function instantiate(entry){
 if(!project.value){notice.value='请等待工作台加载。';return}
 const sourceProject=clone(project.value),dest=clone(sourceProject),src=clone(entry.project.world),limits={bodies:64,joints:64,motors:8,controls:16};
 for(const [field,cap]of Object.entries(limits))if((dest.world[field]?.length||0)+(src[field]?.length||0)>cap){notice.value=`${({bodies:'零件',joints:'连接',motors:'电机',controls:'控制器'})[field]}数量超过上限${cap}。`;return}
 const map=new Map(),prefix=crypto.randomUUID().slice(0,8),id=old=>map.get(old)||old;
 for(const field of Object.keys(limits))for(const [i,item]of(src[field]||[]).entries())map.set(item.id,`${prefix}_${field[0]}${i}`);
 const groups=new Map();for(const b of src.bodies){b.id=id(b.id);b.x+=1.5;b.y+=1;if(b.group){if(!groups.has(b.group))groups.set(b.group,`${prefix}_g${groups.size}`);b.group=groups.get(b.group)}}
 for(const j of src.joints){j.id=id(j.id);j.a=id(j.a);j.b=id(j.b);j.anchorX+=1.5;j.anchorY+=1}
 for(const m of src.motors){m.id=id(m.id);m.body=id(m.body)}
 for(const c of src.controls){c.id=id(c.id);c.body=id(c.body);c.target=id(c.target);c.motor=id(c.motor);c.inputs=(c.inputs||[]).map(id)}
 for(const field of Object.keys(limits))dest.world[field]=[...(dest.world[field]||[]),...(src[field]||[])];
 if([...src.bodies.map(b=>[b.x,b.y]),...src.joints.map(j=>[j.anchorX,j.anchorY])].some(p=>p.some(v=>!Number.isFinite(v)||Math.abs(v)>100))){notice.value='插入后将超出画板坐标边界。';return}if(bytes(dest)>131072){notice.value='工程大小超过128 KiB。';return}
 document.querySelector('#workshop-ui')?.contentWindow?.postMessage({type:'OCV_WORKSHOP_COMPONENT',project:dest,sourceProject},location.origin);notice.value='组件已提交到画板。';
}
function download(entry){const url=URL.createObjectURL(new Blob([JSON.stringify(entry.project,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='mechanical-module.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function remove(id){modules.value=modules.value.filter(m=>m.id!==id);persist()}
onMounted(()=>{try{const saved=JSON.parse(localStorage.getItem(key)||'[]');modules.value=Array.isArray(saved)?saved.filter(e=>e?.project?.schema==='ocv.workshop-project/1'&&e.project.world?.bodies?.length<=24&&bytes(e.project)<=131072).slice(0,16):[]}catch{};project.value=window.__ocvWorkshopProject||null;window.addEventListener('ocv:workshop-project',receive)});
onBeforeUnmount(()=>window.removeEventListener('ocv:workshop-project',receive));
</script>
<template><div class="library"><header><strong>零件库</strong><span>本地 / 16</span></header><div class="capture"><input v-model="name" aria-label="组件名称" maxlength="80"/><button @click="capture">收进零件库</button></div><div class="part-list"><label v-for="b in project?.world?.bodies||[]" :key="b.id"><input type="checkbox" :value="b.id" v-model="selected"/><span>{{b.label||kindName(b.kind)}}</span><small>{{kindName(b.kind)}}</small></label></div><div class="modules"><article v-for="entry in modules" :key="entry.id"><button class="insert" @click="instantiate(entry)">{{entry.name}} ↗</button><small>{{entry.project.world.bodies.length}} 个零件</small><button @click="download(entry)" aria-label="导出组件">↓</button><button @click="remove(entry.id)" aria-label="删除组件">×</button></article></div><output>{{notice}}</output></div></template>
<style scoped>
.library{background:#f9fcff;border:1px solid #9ebaff;color:#244f95;font:12px system-ui;min-height:330px}header{display:flex;justify-content:space-between;background:#e4edff;padding:10px;border-bottom:1px solid #91b0eb}header span{font:10px monospace}.capture{display:flex;padding:10px;gap:5px}input:not([type=checkbox]){min-width:0;width:125px;border:1px solid #a5bdf0;padding:6px;color:inherit;background:white}button{border:1px solid #9ab9ef;background:#eef5ff;color:#2052a0;padding:5px 8px;cursor:pointer}.part-list{display:grid;grid-template-columns:1fr 1fr;padding:0 10px;gap:4px}.part-list label{display:flex;align-items:center;gap:3px}.part-list small{margin-left:auto;color:#6580aa}.part-list span{max-width:82px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.modules{margin:12px 10px}.modules article{display:flex;align-items:center;gap:4px;border-top:1px solid #c6d7f3;padding:5px 0}.insert{flex:1;text-align:left}.modules small{font:10px monospace}output{display:block;min-height:30px;padding:10px;color:#3b689c}
</style>
