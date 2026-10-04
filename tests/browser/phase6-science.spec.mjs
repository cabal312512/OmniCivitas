import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {tools} from '../../config/apps/portal/src/δοκιμή/calc.mjs';
import {reports} from './report-location.mjs';

const field=(page,key)=>page.locator(`#tool-form [name="${key}"]`);
const diagnosticKeys=['id','runs','successes','busy','cancelled','lastTool','resultLength'].sort();
const errorsFor=page=>{const errors=[];page.on('pageerror',error=>errors.push(error.message));return errors;};
async function activate(page,selector){await page.locator(selector).focus();await page.keyboard.press('Enter');}
async function enter(page,id){await page.emulateMedia({reducedMotion:'reduce'});expect((await page.goto(`/functions/${id}/`)).status()).toBe(200);await expect.poll(()=>page.evaluate(()=>window.__ocvTools?.id)).toBe(id);await activate(page,'[data-tool-front]');}
async function submit(page,error=false){const before=await page.evaluate(()=>window.__ocvTools.runs);await activate(page,'#tool-run');await expect.poll(()=>page.evaluate(()=>window.__ocvTools.runs)).toBeGreaterThan(before);await expect.poll(()=>page.evaluate(()=>window.__ocvTools.busy)).toBe(false);await expect(page.locator('#tool-status')).toHaveAttribute('data-error',String(error));return page.locator('#tool-output').inputValue();}
async function save(info,page,name,errors,data){const diagnostic=await page.evaluate(()=>window.__ocvTools);expect(Object.keys(diagnostic).sort()).toEqual(diagnosticKeys);expect(errors).toEqual([]);fs.writeFileSync(path.join(reports,`phase6-${info.project.name}-${name}.json`),JSON.stringify({...data,diagnostic,errors},null,2));}
async function downloadJSON(info,page,name,canonical){const pending=page.waitForEvent('download');await activate(page,'#tool-export');const download=await pending;const target=path.join(reports,`phase6-${info.project.name}-${name}.json`);await download.saveAs(target);const bytes=fs.readFileSync(target,'utf8');expect(bytes).toBe(canonical);return {filename:download.suggestedFilename(),bytes:Buffer.byteLength(bytes),value:JSON.parse(bytes)};}

for(const entry of tools){
  test(`Phase 6 ${entry.requirements[0]} ${entry.id} computes its actual default`,async({page},info)=>{
    const errors=errorsFor(page);await enter(page,entry.id);
    for(const descriptor of entry.fields){if(descriptor.type==='select')await field(page,descriptor.key).selectOption(String(descriptor.default));else await field(page,descriptor.key).fill(String(descriptor.default));}
    const output=await submit(page);expect(output).not.toBe('');const data=entry.id==='distance'?null:JSON.parse(output);
    if(entry.id==='timetable'){expect(data.courses).toEqual([{course:'数学',day:'周一',start:'08:00',end:'09:30'},{course:'物理',day:'周三',start:'10:00',end:'11:30'}]);await expect(page.locator('#tool-lab table tr')).toHaveCount(3);}
    if(entry.id==='study-plan'){expect(data.totalDays).toBe(10);expect(data.days[0].date).toBe('2026-10-03');expect(data.days[9].date).toBe('2026-10-12');expect(data.subjects).toEqual(['数学','物理','英语']);}
    if(entry.id==='scheduling'){expect(data.entries.map(row=>row.course).sort()).toEqual(['数学','物理','英语'].sort());expect(data.conflicts).toEqual([]);await expect(page.locator('[data-scheduling-state]')).toHaveAttribute('data-scheduling-state','finished');}
    if(entry.id==='orbit'){expect(data.periodSeconds).toBeCloseTo(5828.516637686015,7);expect(data.perigeeAltitudeKm).toBe(559);expect(data.apogeeAltitudeKm).toBe(699);expect(data.scope).toBe('娱乐/演示计算，不用于真实航天任务');await expect(page.locator('[data-orbit-diagram]')).toHaveCount(1);}
    if(entry.id==='solar-system'){expect(data.planets).toHaveLength(8);expect(data.planets[0].animationSeconds).toBe(5);expect(data.planets[7].animationSeconds).toBe(53);expect(data.engine).toBe('高精度宇宙引擎');await expect(page.locator('[data-planet]')).toHaveCount(8);}
    if(entry.id==='distance'){const km=Number(output.replace(' km',''));expect(km).toBeGreaterThan(1067);expect(km).toBeLessThan(1068);expect(output).toMatch(/^\d+\.\d{6} km$/);}
    await save(info,page,`default-${entry.id}`,errors,{id:entry.id,requirements:entry.requirements,output,outputLength:output.length});
  });
}

test('Phase 6 timetable only lays out manually entered overlapping courses and treats markup as text',async({page},info)=>{
  const errors=errorsFor(page);await enter(page,'timetable');
  const label='<img src=x onerror=window.__sciencePwned=1>',courses=[{course:label,day:'周一',start:'08:00',end:'10:00'},{course:'另一节',day:'周一',start:'08:00',end:'10:00'},{course:'时间交叉',day:'周一',start:'09:00',end:'11:00'}];
  await field(page,'courses').fill(JSON.stringify(courses));const canonical=await submit(page),data=JSON.parse(canonical);
  expect(data.courses).toEqual(courses);
  const cells=await page.locator('#tool-table tr').evaluateAll(rows=>rows.map(row=>Array.from(row.querySelectorAll('th,td'),cell=>cell.textContent)));
  expect(cells[1][1]).toBe(`${label}\n另一节`);expect(cells[2][1]).toBe('时间交叉');
  await expect(page.locator('#tool-lab img,#tool-table img,#tool-lab script,#tool-table script')).toHaveCount(0);expect(await page.evaluate(()=>window.__sciencePwned)).toBeUndefined();
  const exported=await downloadJSON(info,page,'timetable-download',canonical);expect(exported.filename).toBe('ocv-timetable.json');expect(exported.value.courses).toEqual(courses);
  await field(page,'courses').fill('[{"course":"课","day":"周一","start":"09:00","end":"08:00"}]');await submit(page,true);await expect(page.locator('#tool-status')).toContainText('结束时间须晚于开始时间');await expect(page.locator('#tool-export')).toBeDisabled();
  await save(info,page,'science-timetable',errors,{manualCourses:courses,cells,exported,invalidTimeRejected:true,scriptExecuted:false});
});

test('Phase 6 study plan equally divides actual Gregorian days across DST and rejects nonexistent exam dates',async({page},info)=>{
  const errors=errorsFor(page);await enter(page,'study-plan');await field(page,'subjects').fill('甲\n乙\n丙\n丁\n戊');await field(page,'start').fill('2024-03-09');await field(page,'exam').fill('2024-03-11');
  const canonical=await submit(page),data=JSON.parse(canonical);expect(data.days.map(day=>day.date)).toEqual(['2024-03-09','2024-03-10']);
  const totals=new Map(data.subjects.map(name=>[name,0]));for(const day of data.days){expect(day.subjects.reduce((sum,subject)=>sum+subject.share,0)).toBeCloseTo(1,12);for(const subject of day.subjects)totals.set(subject.subject,totals.get(subject.subject)+subject.share);}
  for(const total of totals.values())expect(total).toBeCloseTo(.4,12);
  expect(data.advice).toEqual(['先过目录。','留时间回看错题。','考前把要带的东西装好。']);
  const exported=await downloadJSON(info,page,'study-plan-download',canonical);expect(exported.filename).toBe('ocv-study-plan.json');expect(exported.value).toEqual(data);
  await field(page,'exam').fill('2024-02-30');await submit(page,true);await expect(page.locator('#tool-status')).toContainText('日期不存在');await expect(page.locator('#tool-output')).toHaveValue('');
  await save(info,page,'science-study-plan',errors,{dates:data.days.map(day=>day.date),totals:Object.fromEntries(totals),exported,invalidCalendarRejected:true});
});

test('Phase 6 scheduling shows exact national-engine label, cancels promptly, then keeps every course and flags teacher conflict',async({page},info)=>{
  const errors=errorsFor(page);await enter(page,'scheduling');const cancelled=await page.evaluate(()=>window.__ocvTools.cancelled);
  await activate(page,'#tool-run');await expect(page.locator('#tool-status')).toHaveText('正在调用国家级调度引擎');await expect(page.locator('[data-scheduling-state]')).toHaveAttribute('data-scheduling-state','pending');await activate(page,'#tool-cancel');
  await expect.poll(()=>page.evaluate(()=>window.__ocvTools.cancelled)).toBe(cancelled+1);await expect(page.locator('#tool-output')).toHaveValue('');await expect(page.locator('#tool-lab [data-scheduling-state]')).toHaveCount(0);
  const courses=['甲','乙','丙'];await field(page,'lessons').fill(JSON.stringify(courses.map(course=>({teacher:'同一个老师',course}))));await field(page,'slots').fill('周一 08:00');
  const canonical=await submit(page),data=JSON.parse(canonical);expect(data.entries.map(row=>row.course).sort()).toEqual(courses.sort());expect(data.entries.every(row=>row.slot==='周一 08:00')).toBe(true);expect(data.conflicts).toHaveLength(2);expect(data.conflicts.every(conflict=>conflict.kind==='教师')).toBe(true);expect(data.scope).toContain('不求解约束');
  await expect(page.locator('[data-scheduling-state]')).toHaveAttribute('data-scheduling-state','finished');const exported=await downloadJSON(info,page,'scheduling-download',canonical);expect(exported.value.entries).toEqual(data.entries);
  await save(info,page,'science-scheduling',errors,{nationalLabel:'正在调用国家级调度引擎',cancelled:true,entries:data.entries,conflicts:data.conflicts,exported});
});

test('Phase 6 orbit displays explicit nonflight scope before calculation, computes basic numbers and rejects underground orbits',async({page},info)=>{
  const errors=errorsFor(page);await enter(page,'orbit');await expect(page.locator('.tool-feature').getByText('娱乐/演示计算，不用于真实航天任务',{exact:true})).toBeVisible();
  await field(page,'axis').fill('7000');await field(page,'eccentricity').fill('0');await field(page,'inclination').fill('90');const canonical=await submit(page),data=JSON.parse(canonical);
  expect(data.perigeeAltitudeKm).toBe(629);expect(data.apogeeAltitudeKm).toBe(629);expect(data.periodSeconds).toBeCloseTo(5828.516637686015,7);expect(data.perigeeVelocityKmS).toBeCloseTo(7.546053290107541,10);await expect(page.locator('[data-orbit-limit]')).toHaveText('娱乐/演示计算，不用于真实航天任务');
  const exported=await downloadJSON(info,page,'orbit-download',canonical);expect(exported.value).toEqual(data);
  await field(page,'eccentricity').fill('0.2');await submit(page,true);await expect(page.locator('#tool-status')).toContainText('近地点不低于地表');await expect(page.locator('[data-orbit-diagram]')).toHaveCount(0);await expect(page.locator('#tool-export')).toBeDisabled();
  await save(info,page,'science-orbit',errors,{basicCircular:data,exported,undergroundOrbitRejected:true,explicitScope:true});
});

test('Phase 6 solar animation has eight distinct preset speeds, moves for real and becomes static under reduced motion',async({page},info)=>{
  const errors=errorsFor(page);await enter(page,'solar-system');await submit(page);await expect(page.locator('[data-solar-engine]')).toHaveText('高精度宇宙引擎');await expect(page.locator('[data-planet]')).toHaveCount(8);
  const durations=await page.locator('[data-planet]').evaluateAll(nodes=>nodes.map(node=>node.style.getPropertyValue('--period')));expect(durations).toEqual(['5s','8s','12s','17s','23s','31s','41s','53s']);
  expect(await page.locator('[data-planet]').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).animationName))).toEqual(Array(8).fill('none'));
  await page.emulateMedia({reducedMotion:'no-preference'});const mercury=page.locator('[data-planet="水星"]');await expect.poll(()=>mercury.evaluate(node=>getComputedStyle(node).animationName)).toBe('science-annual');const first=await mercury.evaluate(node=>getComputedStyle(node).transform);await expect.poll(()=>mercury.evaluate(node=>getComputedStyle(node).transform)).not.toBe(first);
  await page.emulateMedia({reducedMotion:'reduce'});await expect.poll(()=>mercury.evaluate(node=>getComputedStyle(node).animationName)).toBe('none');
  await field(page,'speed').selectOption('2');const canonical=await submit(page),data=JSON.parse(canonical);expect(data.planets[0].animationSeconds).toBe(2.5);await expect(page.locator('[data-planet]')).toHaveCount(8);const exported=await downloadJSON(info,page,'solar-system-download',canonical);expect(exported.value.scope).toContain('非物理模拟');
  await save(info,page,'science-solar-system',errors,{durations,realCssMovement:true,reducedMotionStatic:true,planets:data.planets,exported});
});

test('Phase 6 Haversine returns independent known spherical distances, handles antimeridian and rejects impossible coordinates',async({page},info)=>{
  const errors=errorsFor(page);await enter(page,'distance');const known=[];
  for(const [coordinates,expected] of [[[0,0,0,90],'10007.543398 km'],[[0,0,0,0],'0.000000 km'],[[0,179,0,-179],'222.389853 km'],[[0,0,0,180],'20015.086796 km']]){
    for(const [index,key] of ['lat1','lon1','lat2','lon2'].entries())await field(page,key).fill(String(coordinates[index]));const actual=await submit(page);expect(actual).toBe(expected);known.push({coordinates,actual});
  }
  await field(page,'lat1').fill('91');await submit(page,true);await expect(page.locator('#tool-status')).toContainText('纬度 1须在 -90–90 之间');await expect(page.locator('#tool-output')).toHaveValue('');
  await save(info,page,'science-distance',errors,{known,invalidLatitudeRejected:true,model:'Haversine / spherical radius 6371 km'});
});
