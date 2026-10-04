import {test} from 'vitest';
import assert from 'node:assert/strict';
import {tools,formatTimetable,calendarDay,studyPlan,shuffle,scheduleLessons,basicOrbit,haversine,EARTH_RADIUS_KM,EARTH_MU,PLANETS} from '../config/apps/portal/src/δοκιμή/calc.mjs';

const close=(actual,expected,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} ≠ ${expected}`);
const tool=id=>tools.find(entry=>entry.id===id);
const defaults=entry=>Object.fromEntries(entry.fields.map(field=>[field.key,field.default]));

test('six science/learning tools have exact requirement mappings and executable defaults',async()=>{
  assert.deepEqual(tools.map(entry=>entry.id),['timetable','study-plan','scheduling','orbit','solar-system','distance']);
  assert.deepEqual(tools.flatMap(entry=>entry.requirements),['B053','B054','B055','B056','B057','B058']);
  for(const entry of tools){const output=await entry.run(defaults(entry),{});assert.equal(typeof output.text,'string');assert.ok(output.text.length>0);assert.ok(output.table.every(row=>row.every(value=>typeof value==='string')));if(entry.id!=='distance')assert.doesNotThrow(()=>JSON.parse(output.text));}
});

test('manual timetable keeps exactly entered days and times, including duplicate cells',()=>{
  const input=[{course:'甲',day:'周三',start:'13:00',end:'14:20'},{course:'数学',day:'周一',start:'08:00',end:'09:00'},{course:'重复',day:1,start:'08:00',end:'09:00'},{course:'跨年无关',day:'周日',start:'23:00',end:'24:00'}];
  const data=formatTimetable(JSON.stringify(input));
  assert.equal(data.courses.length,4);
  assert.deepEqual(data.table[0],['时间','周一','周二','周三','周四','周五','周六','周日']);
  assert.deepEqual(data.table[1],['08:00–09:00','数学\n重复','','','','','','']);
  assert.equal(data.table[2][3],'甲');assert.equal(data.table[3][7],'跨年无关');
  assert.equal(data.courses[0].start,'13:00');assert.equal(data.courses[0].day,'周三');
});

test('timetable rejects malformed arrays, invalid weekday and invalid or overnight time',()=>{
  const valid={course:'课',day:'周一',start:'08:00',end:'09:00'};
  for(const patch of [{course:''},{day:'周八'},{day:1.2},{start:'8:00'},{start:'24:00'},{end:'09:60'},{end:'08:00'},{end:'01:00'},{end:'24:01'},{start:'x'}])assert.throws(()=>formatTimetable(JSON.stringify([{...valid,...patch}])));
  for(const source of ['[]','null','{}','[null]','[[]]','[1]','x'])assert.throws(()=>formatTimetable(source));
  assert.throws(()=>formatTimetable(JSON.stringify(Array(201).fill(valid))),/1–200/);
  assert.throws(()=>formatTimetable(' '.repeat(100*1024+1)),/太长/);
});

test('literal markup is data in timetable output, not HTML input to a renderer',async()=>{
  const course='<img src=x onerror=alert(1)>';
  const output=await tool('timetable').run({courses:JSON.stringify([{course,day:'周一',start:'08:00',end:'09:00'}])});
  assert.equal(JSON.parse(output.text).courses[0].course,course);
  assert.equal(output.table[1][1],course);assert.equal(output.html,undefined);
});

test('calendar parsing is Gregorian, preserves years under 100 and excludes invalid leap dates',()=>{
  assert.equal(calendarDay('1970-01-01'),0);
  assert.equal(calendarDay('1970-01-02'),1);
  assert.equal(calendarDay('2000-03-01')-calendarDay('2000-02-28'),2);
  assert.equal(calendarDay('1900-03-01')-calendarDay('1900-02-28'),1);
  assert.equal(calendarDay('0099-03-01')-calendarDay('0099-02-28'),1);
  assert.equal(calendarDay('0001-01-02')-calendarDay('0001-01-01'),1);
  for(const value of ['0000-01-01','2023-02-29','1900-02-29','2026-04-31','2026-13-01','2026-00-01','2026-01-00','2026-01-32','2026-1-01','2026-01-01T00:00:00Z','2026-01-01+08:00','10000-01-01'])assert.throws(()=>calendarDay(value));
});

test('review allocation equally divides calendar-day shares including more subjects than days',()=>{
  for(const [names,start,exam] of [['甲\n乙\n丙','2024-03-09','2024-03-12'],['甲\n乙\n丙','2024-11-02','2024-11-04'],['甲\n乙\n丙\n丁\n戊','2024-02-28','2024-03-01'],['甲\n乙\n丙','2026-10-03','2026-10-13']]){
    const plan=studyPlan(names,start,exam),sums=new Map(plan.subjects.map(name=>[name,0]));
    assert.equal(plan.days.length,plan.totalDays);
    assert.equal(plan.days[0].date,start);
    for(const day of plan.days){close(day.subjects.reduce((sum,item)=>sum+item.share,0),1);for(const item of day.subjects){assert.ok(item.share>0&&item.share<=1);sums.set(item.subject,sums.get(item.subject)+item.share);}}
    for(const total of sums.values())close(total,plan.totalDays/plan.subjects.length);
    assert.equal(plan.advice.length,3);
    assert.ok(plan.days.every(day=>day.date<exam));
  }
  assert.deepEqual(studyPlan('甲','0099-12-30','0100-01-01').days.map(day=>day.date),['0099-12-30','0099-12-31']);
});

test('review plan has bounded date range and requires real nonduplicate subjects',()=>{
  for(const subjects of ['', '甲\n甲',Array.from({length:51},(_,i)=>`科目${i}`).join('\n')])assert.throws(()=>studyPlan(subjects,'2026-10-03','2026-10-13'));
  for(const exam of ['2026-10-03','2026-10-02','2028-10-03','2026-02-30'])assert.throws(()=>studyPlan('甲','2026-10-03',exam));
  assert.equal(studyPlan('甲','2024-01-01','2025-01-01').totalDays,366);
});

test('Fisher-Yates uses bounded indices, retains originals and never loses a row',()=>{
  const original=[1,2,3,4],calls=[];
  assert.deepEqual(shuffle(original,limit=>{calls.push(limit);return 0;}),[2,3,4,1]);
  assert.deepEqual(original,[1,2,3,4]);assert.deepEqual(calls,[4,3,2]);
  assert.throws(()=>shuffle(original,limit=>limit));
  assert.throws(()=>shuffle(original,()=>.5));
  for(let i=0;i<30;i++)assert.deepEqual(shuffle(original).sort(),original);
});

test('random scheduling cycles supplied slots and catches both teacher and course duplicates',()=>{
  const lessons=JSON.stringify([{teacher:'同一老师',course:'数学'},{teacher:'另一老师',course:'数学'},{teacher:'同一老师',course:'英语'}]);
  const data=scheduleLessons(lessons,'周一 08:00',limit=>limit-1);
  assert.equal(data.entries.length,3);assert.ok(data.entries.every(row=>row.slot==='周一 08:00'));
  assert.deepEqual(data.conflicts,[{kind:'课程',name:'数学',slot:'周一 08:00',rows:[1,2]},{kind:'教师',name:'同一老师',slot:'周一 08:00',rows:[1,3]}]);
  assert.equal(scheduleLessons(lessons,'周一 08:00\n周二 08:00\n周三 08:00',limit=>limit-1).conflicts.length,0);
  assert.throws(()=>scheduleLessons(lessons,''));assert.throws(()=>scheduleLessons('[{"teacher":"","course":"课"}]','时间'));
});

test('national scheduling label is issued before delay, actual result is explicitly a simple demo',async()=>{
  const labels=[],entry=tool('scheduling'),start=performance.now();
  const promise=entry.run(defaults(entry),{onStatus:status=>labels.push(status)});
  assert.deepEqual(labels,['正在调用国家级调度引擎']);
  const output=await promise;assert.ok(performance.now()-start>=400);
  assert.match(JSON.parse(output.text).scope,/不求解约束/);
  assert.equal(JSON.parse(output.text).entries.length,3);
});

test('scheduling delay can be immediately cancelled and pre-aborted runs do not begin',async()=>{
  const entry=tool('scheduling'),controller=new AbortController(),start=performance.now();
  const promise=entry.run(defaults(entry),{signal:controller.signal});controller.abort();
  await assert.rejects(promise,{name:'AbortError'});assert.ok(performance.now()-start<400);
  await assert.rejects(entry.run(defaults(entry),{signal:controller.signal}),{name:'AbortError'});
});

test('orbit reports finite basic two-body formulas with explicit nonflight disclaimer',async()=>{
  const circular=basicOrbit('7000','0','51.6');
  close(circular.periodSeconds,5828.516637686015,1e-8);
  close(circular.perigeeAltitudeKm,629);close(circular.apogeeAltitudeKm,629);
  close(circular.perigeeVelocityKmS,Math.sqrt(EARTH_MU/7000));
  const ellipse=basicOrbit('10000','.1','180');
  close(ellipse.perigeeAltitudeKm,2629);close(ellipse.apogeeAltitudeKm,4629);
  assert.match(ellipse.scope,/娱乐\/演示计算，不用于真实航天任务/);
  assert.equal(ellipse.periodSeconds,basicOrbit('10000','.1','0').periodSeconds);
  const output=await tool('orbit').run({axis:'7000',eccentricity:'0.01',inclination:'51.6'});
  assert.match(output.text,/不含摄动/);assert.equal(JSON.parse(output.text).inclination,51.6);
});

test('orbit rejects escaping/parabolic parameters, underground perigee and nondecimal inputs',()=>{
  for(const input of [['6000','0','0'],['7000','.2','0'],['7000','1','0'],['7000','-0.01','0'],['7000','0','181'],['7000','0','-1'],['1000001','0','0'],['NaN','0','0'],['0x1fff','0','0'],['Infinity','0','0']])assert.throws(()=>basicOrbit(...input));
  assert.equal(basicOrbit(String(EARTH_RADIUS_KM),'0','0').perigeeAltitudeKm,0);
});

test('solar outputs exactly eight preset bodies and honest animation units rather than physical periods',async()=>{
  assert.equal(PLANETS.length,8);assert.equal(new Set(PLANETS.map(body=>body.period)).size,8);
  const output=await tool('solar-system').run({speed:'2'}),data=JSON.parse(output.text);
  assert.match(data.scope,/非物理模拟/);assert.equal(data.engine,'高精度宇宙引擎');
  assert.equal(data.planets[0].animationSeconds,2.5);assert.equal(data.planets[7].animationSeconds,26.5);
  assert.deepEqual(data.planets.map(body=>body.name),['水星','金星','地球','火星','木星','土星','天王星','海王星']);
  await assert.rejects(tool('solar-system').run({speed:'0'}));await assert.rejects(tool('solar-system').run({speed:'1.5'}));
});

test('Haversine exact identity, quarter circumference, antimeridian and poles',()=>{
  assert.equal(haversine(0,0,0,0),0);assert.equal(haversine(90,-70,90,170),0);assert.equal(haversine(-90,0,-90,90),0);
  close(haversine(0,0,0,90),EARTH_RADIUS_KM*Math.PI/2);
  close(haversine(0,179,0,-179),EARTH_RADIUS_KM*Math.PI/90);
  close(haversine(0,0,0,180),EARTH_RADIUS_KM*Math.PI);
  close(haversine(-90,0,90,123),EARTH_RADIUS_KM*Math.PI);
  assert.equal(haversine(12,180,12,-180),0);
  close(haversine(51.5074,-.1278,40.7128,-74.0060),5570.222179737958,1e-6);
});

test('Haversine stays finite and symmetric for very small and nearly antipodal separations',()=>{
  const points=[[0,0,0,.000000001],[45,20,-44.999999999,-159.999999999],[89.999999,0,-89.999999,179.999999],[31.2304,121.4737,39.9042,116.4074]];
  for(const point of points){const value=haversine(...point);assert.ok(Number.isFinite(value)&&value>=0&&value<=Math.PI*EARTH_RADIUS_KM);close(value,haversine(point[2],point[3],point[0],point[1]),1e-8);}
  close(haversine(0,0,0,.000000001),EARTH_RADIUS_KM*Math.PI/180*1e-9,1e-15);
  close(haversine(0,0,0,179.999999999),EARTH_RADIUS_KM*Math.PI/180*179.999999999,1e-8);
});

test('Haversine rejects out-of-range latitude/longitude and invalid numerical data',()=>{
  for(const point of [[91,0,0,0],[0,181,0,0],[0,0,-91,0],[0,0,0,-181],['',0,0,0],[0,'NaN',0,0],[0,0,'Infinity',0],[0,0,0,'0x12']])assert.throws(()=>haversine(...point));
});
