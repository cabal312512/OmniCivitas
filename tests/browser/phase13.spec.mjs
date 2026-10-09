import {test,expect} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {testReports} from '../runtime-location.mjs';
import {composeCall} from '../../scripts/docker-child.mjs';
test.setTimeout(600000);
test('Four normal tools automatically produce completed records',async({page})=>{
 const report={schema:'ocv.phase13.consumer/1',passed:false,checks:[],errors:[],requests:[],screenshots:[]};
 page.on('pageerror',e=>report.errors.push(e.message.slice(0,250)));
 page.on('request',r=>{if(new URL(r.url()).pathname==='/api/site/return.php'){const p=r.postDataJSON();report.requests.push({kind:p.kind,certificate:p.certificate?.kind});}});
 const check=async(name,run)=>{const before=Date.now();try{const data=await run();report.checks.push({name,passed:true,elapsedMs:Date.now()-before,...data});}catch(e){report.checks.push({name,passed:false,error:e.message.slice(0,240)});throw e;}};
 try{
  await check('Four light tools submit on normal Run, retain original output, and unlock a completed record',async()=>{
   for(const id of ['matrix','radix','json','csv']){
    const count=report.requests.length;await page.goto('/functions/'+id+'/');const record=page.locator('[data-certificate-run]');await expect(record).toBeVisible();await expect(record).toBeDisabled();expect(report.requests.length).toBe(count);
    if(id==='matrix'){await page.locator('[name="a"]').fill('[[0.1,0],[0,0]]');await page.locator('[name="b"]').fill('[[0.2,0],[0,0]]');}
    const submitted=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/site/return.php'&&r.request().postDataJSON()?.kind==='certificate');
    await page.locator('#tool-run').press('Enter');const response=await submitted;expect(response.status()).toBe(201);await expect(page.locator('#tool-output')).not.toHaveValue('');const original=await page.locator('#tool-output').inputValue();await expect(page.locator('#tool-export')).toBeEnabled();
    await expect(record).toBeEnabled({timeout:180000});await expect(page.locator('[data-tool-certificate] details')).not.toHaveAttribute('open');await record.press('Enter');await expect(page.locator('[data-tool-certificate] details')).toHaveAttribute('open','');await expect(page.locator('#tool-output')).toHaveValue(original);
    const download=page.waitForEvent('download');await page.locator('[data-certificate-download="json"]').press('Enter');const file=await download,value=JSON.parse(await readFile(await file.path(),'utf8'));expect(value.schema).toBe('ocv.tool-certificate/1');expect(value.valid).toBe(true);
    if(id==='matrix'){expect(JSON.stringify(value.result.exact)).toContain('3/10');await page.locator('[name="a"]').fill('[[1,0],[0,1]]');await expect(record).toBeDisabled();await expect(page.locator('#tool-output')).toHaveValue(original);}
   }
   return {normalRunOnly:true,originalExportsPreserved:true,actualDownloadedCertificates:4};
  });
  expect(report.errors).toEqual([]);report.passed=true;
 }finally{await mkdir(testReports,{recursive:true});await writeFile(path.join(testReports,'phase13-tools-ui.json'),JSON.stringify(report,null,2));}
});

test('Original search and advanced search follow actual home navigation',async({page})=>{
 const report={schema:'ocv.phase13.consumer/1',passed:false,checks:[],errors:[],requests:[],screenshots:[]};
 page.on('pageerror',e=>report.errors.push(e.message.slice(0,250)));
 page.on('request',r=>{if(new URL(r.url()).pathname==='/api/site/return.php'){const p=r.postDataJSON();report.requests.push({kind:p.kind,certificate:p.certificate?.kind});}});
 const check=async(name,run)=>{const before=Date.now();try{const data=await run();report.checks.push({name,passed:true,elapsedMs:Date.now()-before,...data});}catch(e){report.checks.push({name,passed:false,error:e.message.slice(0,240)});throw e;}};
 try{
  await check('Original search stays immediate; arrow switches to actual ranked advanced search',async()=>{
   await page.goto('/#systems');await expect(page.locator('body')).toHaveAttribute('data-cover','false',{timeout:30000});const before=report.requests.filter(r=>r.kind==='index').length;await page.locator('#portal-search').fill('钢琴');await page.locator('#portal-search').press('Enter');await expect(page.locator('.search-results')).toContainText('音乐');expect(report.requests.filter(r=>r.kind==='index').length).toBe(before);
   await page.locator('[data-advanced-search]').press('Enter');await expect(page.locator('#portal-search')).toHaveAttribute('placeholder','高级搜索');const sent=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/site/return.php'&&r.request().postDataJSON()?.kind==='index');await page.locator('#portal-search').press('Enter');const response=await sent;expect(response.status()).toBe(201);expect((await response.request().headerValue('referer'))||'').toBe('');expect(new URL(page.url()).searchParams.has('q')).toBe(false);await expect(page.locator('.indexed-result')).not.toHaveCount(0,{timeout:180000});await expect(page.locator('.indexed-result').first().locator('a')).toHaveAttribute('href',/^\//);await expect(page.locator('.index-path')).toBeVisible();return {originalNoNewIndexJob:true,advancedRealJob:true,verifiedPathRendered:true,noQueryInUrlOrReferrer:true};
  });
  expect(report.errors).toEqual([]);report.passed=true;
 }finally{await mkdir(testReports,{recursive:true});await writeFile(path.join(testReports,'phase13-search-ui.json'),JSON.stringify(report,null,2));}
});

test('Piano normal playback and native processing generate actual files',async({page})=>{
 const report={schema:'ocv.phase13.consumer/1',passed:false,checks:[],errors:[],requests:[],screenshots:[]};
 page.on('pageerror',e=>report.errors.push(e.message.slice(0,250)));
 page.on('request',r=>{if(new URL(r.url()).pathname==='/api/site/return.php'){const p=r.postDataJSON();report.requests.push({kind:p.kind,certificate:p.certificate?.kind});}});
 const check=async(name,run)=>{const before=Date.now();try{const data=await run();report.checks.push({name,passed:true,elapsedMs:Date.now()-before,...data});}catch(e){report.checks.push({name,passed:false,error:e.message.slice(0,240)});throw e;}};
 try{
  await check('Piano renders an actual processed mix, Rust verified files download, input edits invalidate downloads',async()=>{
   await page.goto('/functions/music-studio/');const frame=page.frameLocator('#music-frame');await expect(frame.locator('#notation')).toBeVisible({timeout:45000});await frame.locator('#notation').fill('1 2 3');
   const scores=[];for(let run=0;run<2;run++){const saved=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/q8/music'&&r.request().method()==='POST');await frame.locator('[data-notation-play]').press('Enter');const response=await saved;expect(response.status()).toBe(201);const score=await response.json();expect(score.storage).toBe('postgresql');expect(score.redis).toBe(true);expect(score.file).toBe('lua');scores.push(score);}
   expect(new Set(scores.map(score=>score.id)).size).toBe(2);
   // Keep the separate native DSP proof out of the two existing eight-step report jobs' queue window.
   for(const score of scores)if(score.job){await expect.poll(async()=>{const r=await page.request.post('/api/a2/job.cgi/'+score.job.id,{data:{ticket:score.ticket}});const job=await r.json();expect(['failed','cancelled']).not.toContain(job.state);return job.state;},{timeout:180000}).toBe('done');}
   await expect(frame.locator('[data-render]')).toBeEnabled();const sent=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/site/return.php'&&r.request().postDataJSON()?.kind==='music');await frame.locator('[data-render]').press('Enter');expect((await sent).status()).toBe(201);await expect(frame.locator('[data-processed-wav]')).toBeEnabled({timeout:180000});await expect(frame.locator('[data-processed-analysis]')).toBeVisible();
   for(const [button,magic] of [['[data-processed-wav]','RIFF'],['[data-processed-midi]','MThd']]){const received=page.waitForEvent('download');await frame.locator(button).press('Enter');const file=await received,bytes=await readFile(await file.path());expect(bytes.subarray(0,4).toString()).toBe(magic);}
   const image=path.join(testReports,'phase13-music.png');await frame.locator('[data-processed]').screenshot({path:image});report.screenshots.push(image);await frame.locator('select[aria-label="处理音色"]').selectOption('sine');await expect(frame.locator('[data-processed-wav]')).toBeDisabled();return {everyNormalPlayActuallySaved:true,distinctPlaybackRecords:scores.length,actualPostgresLuaRedis:true,existingSharedReportsFinishedFirst:true,nativeMix:true,realWavAndMidiDownloads:true,staleFileGuard:true};
  });
  expect(report.errors).toEqual([]);report.passed=true;
 }finally{await mkdir(testReports,{recursive:true});await writeFile(path.join(testReports,'phase13-music-ui.json'),JSON.stringify(report,null,2));}
});

test('Successful favorites and resident dialogue automatically project actual persisted state',async({page})=>{
 const session=randomUUID(),profileSession=randomUUID(),requests=[],report={schema:'ocv.phase13.events-ui/1',passed:false,checks:[]};
 const database=(text,values)=>JSON.parse(composeCall(['exec','-T','-w','/workspace/services/gateway','gateway','node','-e',"const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL,max:1});const a=JSON.parse(process.argv[1]);p.query(a.text,a.values).then(r=>console.log(JSON.stringify(r.rows))).finally(()=>p.end()).catch(()=>process.exitCode=1)",JSON.stringify({text,values})]).stdout);
 database('INSERT INTO ocv_q8.hunt(session,mask) VALUES($1,1073741823)',[session]);database('INSERT INTO ocv_q8.desk(session,revision,favorites) VALUES($1,1,$2::jsonb)',[profileSession,JSON.stringify([{id:'json',folder:'tools'}])]);database('INSERT INTO ocv_q8.profile(session,nickname) VALUES($1,$2)',[profileSession,'Visitor13']);
 await page.addInitScript(({session,profileSession})=>{localStorage.setItem('ocv.q8.hunt.v1',JSON.stringify({session,found:Array.from({length:30},(_,i)=>i),awarded:true}));localStorage.setItem('ocv.desk.v1',JSON.stringify({session:profileSession,revision:1,favorites:[{id:'json',folder:'tools'}],pinned:[],note:'',dirty:false}));},{session,profileSession});
 page.on('request',r=>{if(new URL(r.url()).pathname==='/api/site/return.php')requests.push(r.postDataJSON());});
 try{
  await page.goto('/favorites/');await expect(page.locator('[data-q8-resident]')).toBeVisible();await expect(page.locator('[data-favorite-id="json"]')).toBeVisible();await expect(page.locator('[data-desk-storage]').first()).toHaveText('已连接');expect(requests).toHaveLength(0);
  const submitted=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/site/return.php'&&r.request().postDataJSON()?.events?.some(e=>e.kind==='favorite'));
  await page.locator('[data-favorite-id="json"]').getByRole('button',{name:'×',exact:true}).press('Enter');expect((await submitted).status()).toBe(201);
  await expect.poll(()=>database('SELECT checkpoint FROM ocv_web3.warehouse_stock WHERE session=$1',[session]).length,{timeout:180000}).toBe(1);
  expect(database('SELECT favorites FROM ocv_q8.desk WHERE session=$1',[profileSession])[0].favorites).toEqual([]);expect(requests.some(r=>r.events.some(e=>e.kind==='favorite'&&e.data.action==='remove'))).toBe(true);report.checks.push({name:'favorite mutation automatic, PostgreSQL confirmed, passive load no jobs',passed:true});
  const talk=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/site/return.php'&&r.request().postDataJSON()?.events?.some(e=>e.kind==='talk'));
  await page.locator('#echo-input').fill('where');await page.locator('#echo-input').press('Enter');expect((await talk).status()).toBe(201);await expect(page.locator('[data-echo-store]')).toHaveText('已存档 · 已同步',{timeout:180000});
  const last=requests.at(-1);expect(last.events.at(-1).data).toEqual({message:'where'});expect(Object.keys(last).sort()).toEqual(['events','kind','profileSession','session']);expect(await page.locator('[data-echo-talk]').textContent()).toBeTruthy();report.checks.push({name:'actual Elixir reply displayed with enum only, no raw private/text payload',passed:true});report.passed=true;
 }finally{await mkdir(testReports,{recursive:true});await writeFile(path.join(testReports,'phase13-events-ui.json'),JSON.stringify(report,null,2));}
});
test('A real collected slot automatically reaches the authoritative store and projection',async({page})=>{
 const session=randomUUID(),profileSession=randomUUID(),report={schema:'ocv.phase13.collect-ui/1',passed:false};
 const source=await readFile('historical/station/src/rooms.rs','utf8'),matched=source.match(/slot!\((\d+),"([^"]+)"/),slot=Number(matched[1]),route=matched[2];
 await page.addInitScript(({session,profileSession})=>{localStorage.setItem('ocv.q8.hunt.v1',JSON.stringify({session,found:[],awarded:false}));localStorage.setItem('ocv.desk.v1',JSON.stringify({session:profileSession,revision:0,favorites:[],pinned:[],note:'',dirty:false}));},{session,profileSession});
 try{
  await page.goto(route==='/'?'/#systems':route);if(route==='/')await expect(page.locator('body')).toHaveAttribute('data-cover','false',{timeout:30000});const creature=page.locator('[data-q8-creature]');await expect(creature).toBeVisible();
  const submitted=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/site/return.php'&&r.request().postDataJSON()?.events?.some(e=>e.kind==='collect'));
  await creature.press('Enter');const response=await submitted;expect(response.status()).toBe(201);const ack=await response.json();let result;
  await expect.poll(async()=>{const r=await page.request.post('/api/site/order.asm/'+ack.id,{data:{ticket:ack.ticket}});result=await r.json();return result.state},{timeout:180000}).toBe('done');
  expect(result.result.count).toBe(1);expect(result.result.mask).toBe(1<<slot);expect(result.result.sequence.high).toBe(1);report.passed=true;report.slot=slot;report.route=route;report.actualMask=result.result.mask;
 }finally{await mkdir(testReports,{recursive:true});await writeFile(path.join(testReports,'phase13-collect-ui.json'),JSON.stringify(report,null,2));}
});

test('A direct tool visit projects its favorite without requiring a prior hunt visit',async({page})=>{
 const session=randomUUID(),report={schema:'ocv.phase13.direct-favorite/1',passed:false};
 const database=(text,values)=>JSON.parse(composeCall(['exec','-T','-w','/workspace/services/gateway','gateway','node','-e',"const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL,max:1});const a=JSON.parse(process.argv[1]);p.query(a.text,a.values).then(r=>console.log(JSON.stringify(r.rows))).finally(()=>p.end()).catch(()=>process.exitCode=1)",JSON.stringify({text,values})]).stdout);
 database('INSERT INTO ocv_q8.desk(session,revision,favorites) VALUES($1,1,$2::jsonb)',[session,'[]']);
 await page.addInitScript(session=>{localStorage.removeItem('ocv.q8.hunt.v1');localStorage.setItem('ocv.desk.v1',JSON.stringify({session,revision:1,favorites:[],pinned:[],note:'',dirty:false}));},session);
 try{
  await page.goto('/functions/json/');const star=page.locator('[data-desk-star]');await expect(star).toBeVisible();
  const submitted=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/site/return.php'&&r.request().postDataJSON()?.events?.some(e=>e.kind==='favorite'));
  await star.press('Enter');const response=await submitted;expect(response.status()).toBe(201);const projectedSession=response.request().postDataJSON().session;expect(response.request().postDataJSON().profileSession).toBe(session);expect(projectedSession).toMatch(/^[a-f0-9-]{36}$/i);
  await expect.poll(()=>database('SELECT checkpoint FROM ocv_web3.warehouse_stock WHERE session=$1',[projectedSession]).length,{timeout:180000}).toBe(1);
  expect(database('SELECT favorites FROM ocv_q8.desk WHERE session=$1',[session])[0].favorites).toEqual([{id:'json',folder:'tools'}]);
  expect(database('SELECT mask FROM ocv_q8.hunt WHERE session=$1',[projectedSession]).every(row=>Number(row.mask)===0)).toBe(true);
  report.passed=true;report.favoriteProjected=true;report.priorHuntVisitNotRequired=true;report.identityDerivedFromActualSession=true;report.huntAuthorityNotInvented=true;
 }finally{await mkdir(testReports,{recursive:true});await writeFile(path.join(testReports,'phase13-direct-favorite-ui.json'),JSON.stringify(report,null,2));}
});
