export const SITE_AWARDS_KEY='ocv.site.awards.v1';
const d=(id,title,metric,target)=>Object.freeze({id,title,metric,target});
export const SITE_AWARDS=Object.freeze([
 ...[3,10,25,60].map(n=>d(`pages-${n}`,`站内访问 · ${n}`,'pages',n)),
 ...[3,8,16].map(n=>d(`maze-${n}`,`路由探索 · ${n}`,'maze',n)),
 ...[3,5].map(n=>d(`depth-${n}`,`目录深度 · ${n}`,'depth',n)),
 ...[1,10,50].map(n=>d(`runs-${n}`,`完成工具操作 · ${n}`,'runs',n)),
 ...[5,15,30].map(n=>d(`tools-${n}`,`使用不同工具 · ${n}`,'tools',n)),
 ...[1,10].map(n=>d(`search-${n}`,`站内查询 · ${n}`,'search',n)),
 ...[1,10].map(n=>d(`closed-${n}`,`关闭窗口 · ${n}`,'closed',n)),
 ...[1,6].map(n=>d(`dragged-${n}`,`移动窗口 · ${n}`,'dragged',n)),
 ...[8,20].map(n=>d(`favorites-${n}`,`收藏条目 · ${n}`,'favorites',n)),
 d('pins','快捷入口已满','pins',8),d('note','便笺已保存','note',1),d('note-100','便笺 · 100 字','noteLength',100),
 d('nickname','资料：昵称','nickname',1),d('bio','资料：简介','bio',1),d('avatar','资料：头像','avatar',1),
 d('export','收藏备份','export',1),d('contact','作者名片','contact',1),d('media','开始播放','media',1),
 d('portals','两个入口','portals',2),d('hunt-1','发现藏点','hunt',1),d('hunt-10','发现藏点 · 10','hunt',10),
]);
const valid=new Set(SITE_AWARDS.map(a=>a.id)),metrics=new Set(SITE_AWARDS.map(a=>a.metric)),defs=new Map();for(const a of SITE_AWARDS){const list=defs.get(a.metric)||[];list.push(a);defs.set(a.metric,list);}
const empty=()=>({version:1,earned:[],values:{},paths:[],tools:[]});
export function cleanSiteAwards(value){try{if(typeof value==='string'){if(value.length>32768)return empty();value=JSON.parse(value);}if(!value||value.version!==1)return empty();const values={};for(const [k,v]of Object.entries(value.values||{}))if(metrics.has(k)&&Number.isFinite(v)&&v>=0)values[k]=Math.min(1e7,v);return{version:1,earned:[...new Set((Array.isArray(value.earned)?value.earned:[]).filter(id=>valid.has(id)))],values,paths:[...new Set((Array.isArray(value.paths)?value.paths:[]).filter(p=>typeof p==='string'&&p.length<160&&/^\/[a-z0-9/_-]*\/$|^\/$/.test(p)))].slice(0,180),tools:[...new Set((Array.isArray(value.tools)?value.tools:[]).filter(p=>typeof p==='string'&&/^[a-z0-9-]{1,60}$/.test(p)))].slice(0,128)};}catch{return empty();}}
export function createSiteAwards(storage,onUnlock=()=>{}){
 let state=empty();try{state=cleanSiteAwards(storage?.getItem(SITE_AWARDS_KEY));}catch{}const earned=new Set(state.earned),paths=new Set(state.paths),tools=new Set(state.tools);
 function save(){try{storage?.setItem(SITE_AWARDS_KEY,JSON.stringify(state));}catch{}}
 function set(key,value){if(!metrics.has(key)||!Number.isFinite(value)||value<0||value<=(state.values[key]||0))return;state.values[key]=Math.min(1e7,value);const ids=[];for(const a of defs.get(key)||[])if(!earned.has(a.id)&&value>=a.target){earned.add(a.id);state.earned.push(a.id);ids.push(a.id);}save();if(ids.length)onUnlock(ids);}
 function add(key,n=1){if(n>0&&Number.isFinite(n))set(key,(state.values[key]||0)+n);}
 return{set,add,visit(path){if(typeof path!=='string'||path.length>158||!/^\/[a-z0-9/_-]*$/.test(path)||/^\/(research|identity)(\/|$)/.test(path)||path.startsWith('/functions/3d-world'))return;path=path==='/'?path:path.replace(/\/$/,'')+'/';if(paths.has(path)||paths.size>=180)return;paths.add(path);state.paths.push(path);set('pages',paths.size);set('maze',state.paths.filter(p=>p.startsWith('/maze/')).length);if(path.startsWith('/maze/'))set('depth',path.split('/').filter(Boolean).length-1);set('portals',state.paths.filter(p=>p.startsWith('/portals/')).length);save();},tool(id){if(typeof id!=='string'||!/^[a-z0-9-]{1,60}$/.test(id)||id==='3d-world')return;add('runs');if(!tools.has(id)&&tools.size<128){tools.add(id);state.tools.push(id);set('tools',tools.size);save();}},snapshot(){return{...state,earned:[...state.earned],values:{...state.values},paths:[...state.paths],tools:[...state.tools]};}};
}
