import {tableLab,schedulingLab,orbitLab,solarLab} from './ui.mjs';

const WEEK=['周一','周二','周三','周四','周五','周六','周日'];
export const EARTH_RADIUS_KM=6371;
export const EARTH_MU=398600.4418;
export const PLANETS=Object.freeze([
  {name:'水星',radius:37,size:3,period:5,color:'#497cbd'},
  {name:'金星',radius:59,size:5,period:8,color:'#79b5ec'},
  {name:'地球',radius:83,size:5,period:12,color:'#0060ff'},
  {name:'火星',radius:107,size:4,period:17,color:'#2867a8'},
  {name:'木星',radius:139,size:10,period:23,color:'#004ec4'},
  {name:'土星',radius:173,size:8,period:31,color:'#549fd7'},
  {name:'天王星',radius:202,size:6,period:41,color:'#00667f'},
  {name:'海王星',radius:229,size:6,period:53,color:'#123bc7'},
]);
const field=(key,label,type,value)=>({key,label,type,default:value});
const select=(key,label,values,value)=>({...field(key,label,'select',value),options:values.map(v=>({value:v,label:`${v}×`}))});
const result=(value,table)=>({text:JSON.stringify(value,null,2),table,extension:'json',mime:'application/json;charset=utf-8'});
function boundedText(value,label,max=100*1024) {
  const text=String(value??'');
  if(new TextEncoder().encode(text).byteLength>max)throw Error(`${label}太长`);
  return text;
}
function label(value,name,max=128) {
  if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f\u007f]/u.test(value))throw Error(`${name}须为 1–${max} 个字符，不能含控制字符`);
  return value.trim();
}
function rows(source,name) {
  let value;
  try{value=JSON.parse(boundedText(source,name));}catch(error){if(error.message.endsWith('太长'))throw error;throw Error(`${name}须为 JSON 数组`);}
  if(!Array.isArray(value)||value.length<1||value.length>200)throw Error(`${name}须有 1–200 行`);
  for(const row of value)if(!row||typeof row!=='object'||Array.isArray(row))throw Error(`${name}每行须为对象`);
  return value;
}
function number(value,name,min,max) {
  const source=String(value??'').trim(), parsed=Number(source);
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(source)||!Number.isFinite(parsed)||parsed<min||parsed>max)throw Error(`${name}须在 ${min}–${max} 之间`);
  return parsed;
}
function minute(value,end=false) {
  if(typeof value!=='string'||!/^\d{2}:\d{2}$/.test(value))throw Error('时间须为 HH:MM');
  const [hour,min]=value.split(':').map(Number);
  if(min>59||hour>23&&!(end&&hour===24&&min===0))throw Error('时间超出当天范围');
  return hour*60+min;
}
export function formatTimetable(source) {
  const courses=rows(source,'课程').map(row=>{
    const day=typeof row.day==='number'&&Number.isInteger(row.day)?WEEK[row.day-1]:row.day;
    if(!WEEK.includes(day))throw Error('星期须为周一至周日，或 1–7');
    const start=minute(row.start),end=minute(row.end,true);
    if(end<=start)throw Error('结束时间须晚于开始时间，不支持跨午夜');
    return {course:label(row.course,'课程'),day,start:row.start,end:row.end};
  });
  const slots=[...new Map(courses.map(course=>[`${course.start}–${course.end}`,course])).values()].sort((a,b)=>minute(a.start)-minute(b.start)||minute(a.end,true)-minute(b.end,true));
  const table=[['时间',...WEEK],...slots.map(slot=>[`${slot.start}–${slot.end}`,...WEEK.map(day=>courses.filter(course=>course.day===day&&course.start===slot.start&&course.end===slot.end).map(course=>course.course).join('\n'))])];
  return {courses,table};
}
export function calendarDay(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('日期须为 YYYY-MM-DD');
  const [year,month,day]=value.split('-').map(Number);
  if(year<1||month<1||month>12||day<1)throw Error('日期不存在');
  const date=new Date(0);date.setUTCHours(0,0,0,0);date.setUTCFullYear(year,month-1,day);
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)throw Error('日期不存在');
  return date.getTime()/86400000;
}
const dateText=day=>new Date(day*86400000).toISOString().slice(0,10);
export function studyPlan(subjectSource,start,exam) {
  const subjects=boundedText(subjectSource,'科目',16384).split(/\r?\n/).filter(line=>line.trim()).map(value=>label(value,'科目',96));
  if(subjects.length<1||subjects.length>50)throw Error('请输入 1–50 门科目，每行一门');
  if(new Set(subjects).size!==subjects.length)throw Error('科目不能重复');
  const first=calendarDay(start),end=calendarDay(exam),count=end-first,n=subjects.length;
  if(count<1||count>366)throw Error('考试须在开始日期后 1–366 天内');
  const days=Array.from({length:count},(_,i)=>{
    const allocations=[];
    for(let j=0;j<n;j++){
      const units=Math.min((i+1)*n,(j+1)*count)-Math.max(i*n,j*count);
      if(units>0)allocations.push({subject:subjects[j],share:units/n});
    }
    return {date:dateText(first+i),subjects:allocations};
  });
  const advice=['先过目录。','留时间回看错题。','考前把要带的东西装好。'];
  return {start,exam,totalDays:count,subjects,days,advice,scope:'按日历天均分；同一天可以轮换多科，不做智能规划。'};
}
function randomIndex(limit) {
  if(!globalThis.crypto?.getRandomValues)throw Error('当前环境不能生成随机排列');
  const range=2**32,bound=range-range%limit,value=new Uint32Array(1);
  do{crypto.getRandomValues(value);}while(value[0]>=bound);
  return value[0]%limit;
}
export function shuffle(entries,pick=randomIndex) {
  const values=entries.slice();
  for(let i=values.length-1;i>0;i--){const j=pick(i+1);if(!Number.isInteger(j)||j<0||j>i)throw Error('随机索引越界');[values[i],values[j]]=[values[j],values[i]];}
  return values;
}
function parseSchedulingInput(lessonSource,slotSource) {
  const lessons=rows(lessonSource,'教师课程').map(row=>({teacher:label(row.teacher,'教师',96),course:label(row.course,'课程')}));
  const slots=boundedText(slotSource,'时间段',16384).split(/\r?\n/).filter(line=>line.trim()).map(value=>label(value,'时间段',96));
  if(slots.length<1||slots.length>200)throw Error('请输入 1–200 个时间段，每行一个');
  return {lessons,slots};
}
function placeLessons({lessons,slots},pick) {
  const entries=shuffle(lessons,pick).map((lesson,index)=>({...lesson,slot:slots[index%slots.length]}));
  const conflicts=[],teacherSlots=new Map(),courseSlots=new Map();
  entries.forEach((entry,index)=>{
    for(const [kind,name,map] of [['教师',entry.teacher,teacherSlots],['课程',entry.course,courseSlots]]){
      const key=JSON.stringify([name,entry.slot]);
      if(map.has(key))conflicts.push({kind,name,slot:entry.slot,rows:[map.get(key)+1,index+1]});
      else map.set(key,index);
    }
  });
  return {scope:'随机排列演示，不求解约束；只查相同教师/课程占用同一时间段。',entries,conflicts};
}
export function scheduleLessons(lessonSource,slotSource,pick) {
  return placeLessons(parseSchedulingInput(lessonSource,slotSource),pick);
}
function wait(milliseconds,signal) {
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(new DOMException('已取消','AbortError'));return;}
    const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(new DOMException('已取消','AbortError'));};
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},milliseconds);
    signal?.addEventListener('abort',abort,{once:true});
  });
}
export function basicOrbit(axisValue,eValue,iValue) {
  const axis=number(axisValue,'半长轴',EARTH_RADIUS_KM,1000000),eccentricity=number(eValue,'偏心率',0,.95),inclination=number(iValue,'倾角',0,180);
  const perigeeRadius=axis*(1-eccentricity),apogeeRadius=axis*(1+eccentricity);
  if(perigeeRadius<EARTH_RADIUS_KM)throw Error('此演示只接受近地点不低于地表的椭圆');
  return {axis,eccentricity,inclination,periodSeconds:2*Math.PI*Math.sqrt(axis**3/EARTH_MU),perigeeAltitudeKm:perigeeRadius-EARTH_RADIUS_KM,apogeeAltitudeKm:apogeeRadius-EARTH_RADIUS_KM,perigeeVelocityKmS:Math.sqrt(EARTH_MU*(1+eccentricity)/(axis*(1-eccentricity))),scope:'娱乐/演示计算，不用于真实航天任务',model:'地球二体基础公式；不含摄动、大气、J2、历元或轨道传播。'};
}
export function haversine(lat1Value,lon1Value,lat2Value,lon2Value) {
  const lat1=number(lat1Value,'纬度 1',-90,90),lon1=number(lon1Value,'经度 1',-180,180),lat2=number(lat2Value,'纬度 2',-90,90),lon2=number(lon2Value,'经度 2',-180,180);
  let delta=lon2-lon1;if(delta>180)delta-=360;if(delta<-180)delta+=360;
  if(lat1===lat2&&(delta===0||Math.abs(lat1)===90))return 0;
  const radians=Math.PI/180,p1=lat1*radians,p2=lat2*radians,longitude=delta*radians;
  const h=Math.sin((lat2-lat1)*radians/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(longitude/2)**2;
  // Compute 1-h directly near antipodes instead of subtracting two near-equal numbers.
  const complement=Math.sin((lat1+lat2)*radians/2)**2+Math.cos(p1)*Math.cos(p2)*Math.cos(longitude/2)**2;
  return EARTH_RADIUS_KM*2*Math.atan2(Math.sqrt(Math.max(0,Math.min(1,h))),Math.sqrt(Math.max(0,Math.min(1,complement))));
}

export const tools=[
  {id:'timetable',title:'课程表排版器',requirements:['B053'],group:'学习',fields:[field('courses','课程 / 星期 / 开始 / 结束（JSON）','textarea','[{"course":"数学","day":"周一","start":"08:00","end":"09:30"},{"course":"物理","day":"周三","start":"10:00","end":"11:30"}]')],async run(input,context={}){const data=formatTimetable(input.courses),out=result({scope:'手动填写，只排版，不自动安排。',courses:data.courses},data.table);out.dispose=tableLab(context,'手动课程表',data.table,'只排版，不替你安排。');return out;}},
  {id:'study-plan',title:'复习计划',requirements:['B054'],group:'学习',fields:[field('subjects','科目（每行一门）','textarea','数学\n物理\n英语'),field('start','开始日期（本地日历）','text','2026-10-03'),field('exam','考试日期（本地日历）','text','2026-10-13')],async run(input,context={}){const plan=studyPlan(input.subjects,input.start,input.exam),table=[['日期','均分时段'],...plan.days.map(day=>[day.date,day.subjects.map(subject=>`${subject.subject} ${(subject.share*100).toFixed(2)}%`).join('\n')])],out=result(plan,table);out.dispose=tableLab(context,'复习 / 日历',table,plan.advice.join(' '));return out;}},
  {id:'scheduling',title:'智能排课系统',requirements:['B055'],group:'学习',fields:[field('lessons','教师 / 课程（JSON）','textarea','[{"teacher":"陈老师","course":"数学"},{"teacher":"王老师","course":"物理"},{"teacher":"陈老师","course":"英语"}]'),field('slots','时间段（每行一个）','textarea','周一 08:00\n周一 10:00\n周二 08:00')],async run(input,context={}){if(context.signal?.aborted)throw new DOMException('已取消','AbortError');const prepared=parseSchedulingInput(input.lessons,input.slots);context.onStatus?.('正在调用国家级调度引擎');const view=schedulingLab(context);try{await wait(450,context.signal);const data=placeLessons(prepared);const table=[['教师','课程','时间段'],...data.entries.map(entry=>[entry.teacher,entry.course,entry.slot])];view?.finish(table,data.conflicts.length);const out=result(data,table);out.dispose=view?.dispose;return out;}catch(error){view?.dispose();throw error;}}},
  {id:'orbit',title:'卫星轨道计算器',notice:'娱乐/演示计算，不用于真实航天任务',requirements:['B056'],group:'科学',fields:[field('axis','半长轴 a（km）','number','7000'),field('eccentricity','偏心率 e','number','0.01'),field('inclination','倾角 i（°）','number','51.6')],async run(input,context={}){const data=basicOrbit(input.axis,input.eccentricity,input.inclination),table=[['参数','值'],['周期（秒）',String(data.periodSeconds)],['近地点高度（km）',String(data.perigeeAltitudeKm)],['远地点高度（km）',String(data.apogeeAltitudeKm)],['近地点速度（km/s）',String(data.perigeeVelocityKmS)],['倾角（°）',String(data.inclination)]],out=result(data,table);out.dispose=orbitLab(context,data);return out;}},
  {id:'solar-system',title:'太阳系尺度演示',notice:'尺度和转速为预设，非物理模拟。',requirements:['B057'],group:'科学',fields:[select('speed','预设动画倍率',['0.5','1','2'],'1')],async run(input,context={}){const speed=number(input.speed,'动画倍率',.5,2);if(![.5,1,2].includes(speed))throw Error('请选择预设动画倍率');const table=[['行星','示意半径（px）','动画周期（s）'],...PLANETS.map(planet=>[planet.name,String(planet.radius),String(planet.period/speed)])],out=result({scope:'CSS/SVG 动画：尺度、大小、转速为预设，非物理模拟。',engine:'高精度宇宙引擎',speed,planets:PLANETS.map(planet=>({name:planet.name,radiusPixels:planet.radius,animationSeconds:planet.period/speed}))},table);Object.assign(out,solarLab(context,PLANETS,speed)??{});return out;}},
  {id:'distance',title:'经纬度距离',requirements:['B058'],group:'科学',fields:[field('lat1','纬度 1（°）','number','31.2304'),field('lon1','经度 1（°）','number','121.4737'),field('lat2','纬度 2（°）','number','39.9042'),field('lon2','经度 2（°）','number','116.4074')],async run(input){const km=haversine(input.lat1,input.lon1,input.lat2,input.lon2);return {text:`${km.toFixed(6)} km`,table:[['球面距离（km）',String(km)],['模型','Haversine / 球面半径 6371 km'],['范围','只计算球面最短距离；不做路线规划。']]};}},
];
