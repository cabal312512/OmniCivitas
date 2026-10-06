import {CITIES,cityHalf} from '../pcakage/build2/c0.mjs';
import {GIANT_KINDS} from '../pcakage/build2/r6.mjs';

export const GAME_AWARDS_KEY='ocv.aero.awards.v1';
const definition=(id,title,metric,target)=>Object.freeze({id,title,metric,target});
export const GAME_AWARDS=Object.freeze([
 ...[1,10,50,100,250,500,1000,2000,5000].map(n=>definition(`kills-${n}`,`击败敌人 · ${n}`,'kills',n)),
 ...[1,5,20,50,100,200].map(n=>definition(`giants-${n}`,`巨型狩猎 · ${n}`,'giants',n)),
 ...[1,5,20,50,100].map(n=>definition(`air-${n}`,`空中目标 · ${n}`,'air',n)),
 ...GIANT_KINDS.map(kind=>definition(`giant-${kind}`,`大型实体 / ${kind}`,`kind-${kind}`,1)),
 ...GIANT_KINDS.map(kind=>definition(`seen-${kind}`,`初次遇见 / ${kind}`,`seen-${kind}`,1)),
 ...[3,6,10].map(n=>definition(`species-${n}`,`实体观察 · ${n}`,'species',n)),
 ...CITIES.map(c=>definition(`city-${c.id}`,`抵达 / ${c.id}`,`city-${c.id}`,1)),
 ...[3,6,9].map(n=>definition(`cities-${n}`,`城市巡游 · ${n}`,'cities',n)),
 ...[1000,10000,50000,100000,250000].map(n=>definition(`walk-${n}`,`行走 · ${n/1000} km`,'distance',n)),
 ...[100,1000,5000].map(n=>definition(`shots-${n}`,`发射 · ${n}`,'shots',n)),
 ...[100,500,1000].map(n=>definition(`hits-${n}`,`命中 · ${n}`,'hits',n)),
 ...[10,50,200].map(n=>definition(`jumps-${n}`,`跃起 · ${n}`,'jumps',n)),
 ...[5,20,50].map(n=>definition(`warps-${n}`,`光环穿行 · ${n}`,'warps',n)),
 ...[10,50].map(n=>definition(`saves-${n}`,`留下记录 · ${n}`,'saves',n)),
 ...[5,15].map(n=>definition(`healing-${n}`,`疗愈 · ${n}`,'healing',n)),
 ...[300,900,1800].map(n=>definition(`play-${n}`,`停留 · ${n/60} min`,'play',n)),
 definition('wind','风机之下','wind',1),definition('grove','林间','grove',1),
 ...[1,5,15].map(n=>definition(`objects-${n}`,`异常地标 · ${n}`,'objects',n)),
 definition('friend','无害访客','friend',1),definition('save','落脚点','saves',1),
 definition('summit','最高处','summit',1),definition('boss','冠顶守卫','boss',1),
 definition('weak-20','弱点命中 · 20','weak',20),definition('survivor','重返地面','recoveries',1),
 definition('weak-100','弱点命中 · 100','weak',100),
 ...CITIES.filter(c=>c.id!=='capital').map(c=>definition(`guardian-${c.id}`,`城区守卫 · ${c.id}`,`guardian-${c.id}`,1)),
 definition('guardians','八城守卫 · 飞行已解锁','guardians',1),
]);
const keys=new Set(GAME_AWARDS.map(a=>a.id)),metrics=new Set(GAME_AWARDS.map(a=>a.metric));
const byMetric=new Map();for(const a of GAME_AWARDS){const list=byMetric.get(a.metric)||[];list.push(a);byMetric.set(a.metric,list);}
export function cleanGameAwards(raw){
 try{if(typeof raw==='string'){if(raw.length>16384)return null;raw=JSON.parse(raw);}if(!raw||raw.version!==1||!Array.isArray(raw.earned)||raw.earned.length>GAME_AWARDS.length)return null;
  const earned=[...new Set(raw.earned.filter(id=>keys.has(id)))],values={};for(const [key,value]of Object.entries(raw.values||{}))if(metrics.has(key)&&Number.isFinite(value)&&value>=0)values[key]=Math.min(1e9,value);
  const visited=Array.isArray(raw.visited)?[...new Set(raw.visited.filter(id=>CITIES.some(c=>c.id===id)))].slice(0,9):[];
  const objects=Array.isArray(raw.objects)?[...new Set(raw.objects.filter(id=>/^object-\d{1,2}$/.test(id)))].slice(0,36):[];
  return{version:1,earned,values,visited,objects};
 }catch{return null;}
}
export function createGameAwards(storage,onUnlock=()=>{}){
 let record={version:1,earned:[],values:{},visited:[],objects:[]},dirty=false,lastWrite=-Infinity,persistent=false;
 const target=()=>typeof storage==='function'?storage():storage;
 try{record=cleanGameAwards(target()?.getItem(GAME_AWARDS_KEY))||record;}catch{}
 const earned=new Set(record.earned),visited=new Set(record.visited),objects=new Set(record.objects);
 function check(key){const unlocked=[];for(const a of byMetric.get(key)||[])if(!earned.has(a.id)&&(record.values[a.metric]||0)>=a.target){earned.add(a.id);record.earned.push(a.id);unlocked.push(a.id);dirty=true;}if(unlocked.length)onUnlock(unlocked);}
 function add(key,value=1){if(!metrics.has(key)||!Number.isFinite(value)||value<=0)return;record.values[key]=Math.min(1e9,(record.values[key]||0)+value);dirty=true;check(key);}
 function flush(time=null){if(!dirty||time!==null&&time-lastWrite<2)return;persistent=false;try{const s=target();if(s){s.setItem(GAME_AWARDS_KEY,JSON.stringify(record));persistent=true;}}catch{}if(Number.isFinite(time))lastWrite=time;dirty=false;}
 return{add,defeat({kind,flying=false,hostile=true,giant=false}){if(hostile)add('kills');if(giant){add('giants');add(`kind-${kind}`);if(flying)add('air');}flush();},
  see(kind){const key=`seen-${kind}`;if(!metrics.has(key)||record.values[key])return;add(key);record.values.species=GIANT_KINDS.filter(k=>record.values[`seen-${k}`]>0).length;check('species');},
  explore(player,distance,field={}){add('distance',Math.min(10,Math.max(0,distance||0)));for(const c of CITIES)if(!visited.has(c.id)&&Math.abs(player.x-c.x)<cityHalf(c)&&Math.abs(player.z-c.z)<cityHalf(c)&&Math.abs(player.y-c.ground)<50){visited.add(c.id);record.visited.push(c.id);add(`city-${c.id}`);record.values.cities=record.visited.length;check('cities');}
   if(field.wind&&!record.values.wind)add('wind');if(field.grove&&!record.values.grove)add('grove');for(const id of field.objects||[])if(/^object-\d{1,2}$/.test(id)&&!objects.has(id)&&record.objects.length<36){objects.add(id);record.objects.push(id);record.values.objects=record.objects.length;dirty=true;check('objects');}},
  flush,snapshot(){return {...record,earned:[...record.earned],values:{...record.values},visited:[...record.visited],objects:[...record.objects],persistent};}
 };
}
