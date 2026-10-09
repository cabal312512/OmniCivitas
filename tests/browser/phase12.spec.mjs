import {testDeps} from '../runtime-location.mjs';
import {test,expect} from '@playwright/test';
import {createHash,randomUUID} from 'node:crypto';
import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';

const deps=testDeps;
const folder=path.join(deps,'runtime/reports'),reportFile=path.join(folder,'phase12-ui.json');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,HEX=/^[a-f0-9]{64}$/;
const pathname=response=>new URL(response.url()).pathname;
const redact=value=>String(value).replace(/[0-9a-f]{64}/gi,'[digest-or-capability]').slice(0,280);
const capability=value=>!!value&&UUID.test(value.id)&&typeof value.ticket==='string'&&HEX.test(value.ticket);
const terminal=state=>['done','failed','cancelled'].includes(state);
const hash=value=>createHash('sha256').update(value).digest('hex');

test('Native saves bridge into real shared versions; actual music analysis and a verified package render through the parent panel',async({page})=>{
  const report={schema:'ocv.phase12/ui-proof/1',startedAt:new Date().toISOString(),passed:false,checks:[],jobs:[],screenshots:[],pageErrors:[],consoleErrors:[],
    maximumPages:1,parallelPages:1,maximumExplicitSubmittedJobs:3,maximumVersionWaitMs:60000,maximumMusicWaitMs:180000,privateCapabilitiesPrinted:false,interceptedResponses:false,
    injectedContext:false,explicitNativeSolverClicks:false,automaticInitialRun:'local-wasm-only',musicReportCompletionRequired:true,analysisDataRenderingExercised:false,cleanup:[],
    scopeClarification:'The three jobs are explicit harness actions. Workshop initial Run() defaults withReview=false and runs local Wasm only; other users may submit separate backend jobs.'};
  const owned=new Map();let musicJob,musicPanel,musicFrame,musicMain,musicCompletion;
  const musicTransitions=[];let musicPendingObservations=0;
  page.on('pageerror',error=>report.pageErrors.push(redact(error.message)));
  page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(redact(message.text()))});
  async function check(name,fn){
    await test.step(name,async()=>{const started=Date.now();try{const evidence=await fn();report.checks.push({name,passed:true,elapsedMs:Date.now()-started,...evidence})}
      catch(error){report.checks.push({name,passed:false,elapsedMs:Date.now()-started,error:redact(error.message)});throw error}});
  }
  async function screenshot(panel,domain){
    const file=path.join(folder,`phase12-ui-${domain}.png`);await mkdir(folder,{recursive:true});
    await panel.scrollIntoViewIfNeeded();await panel.screenshot({path:file,animations:'disabled'});report.screenshots.push({domain,file});
  }
  async function nativeSave(domain){
    await page.goto(`/${domain}/`,{waitUntil:'domcontentloaded'});
    const panel=page.locator(`[data-shared-panel][data-shared-domain="${domain}"]`),frame=page.frameLocator(`#${domain}-ui`);
    await expect(panel).toHaveCount(1);await expect(panel).toHaveAttribute('data-shared-initialized','1');
    await expect(panel.locator('[data-shared-source]')).toHaveText('—');await expect(panel.locator('[data-shared-action="versions"]')).toBeDisabled();
    await expect(panel.locator('[data-shared-action="package"]')).toBeDisabled();
    const name=`phase12-ui-${domain}-${randomUUID().slice(0,8)}`;
    const input=frame.getByRole('textbox',{name:domain==='signals'?'Project name':'工程名称',exact:true});
    const button=domain==='signals'?frame.getByTestId('save-project'):frame.getByRole('button',{name:'保存版本',exact:true});
    await expect(input).toBeVisible({timeout:45000});
    if(domain==='workshop'){await expect(frame.locator('.play-button')).not.toHaveAttribute('data-run-state','calculating');const sheet=frame.locator('#mechanical-sheet');await sheet.focus();if(await sheet.getAttribute('data-canvas-lock')==='true')await sheet.press('Space')}
    await input.fill(name);await input.press('Tab');
    if(domain==='workshop')await expect(frame.locator('.drawing-topline')).toContainText(name);
    await expect(button).toBeEnabled();
    const responsePromise=page.waitForResponse(response=>pathname(response)===`/api/${domain}/projects`&&response.request().method()==='POST',{timeout:20000});
    const[response]=await Promise.all([responsePromise,button.press('Enter')]);expect([200,201].includes(response.status()),'Native project persistence succeeds').toBe(true);
    const sent=response.request().postDataJSON(),saved=await response.json();
    expect(sent.project.name).toBe(name);expect(capability(saved),'Native project acknowledgement contains a valid capability').toBe(true);expect(saved.revision).toBe(1);
    expect(saved.storage).toBe('PostgreSQL');expect(HEX.test(saved.digest),'The stored snapshot has a content digest').toBe(true);
    await expect(panel.locator('[data-shared-source]')).toHaveText(`${domain==='signals'?'通信':'机械'} / r1 / ${saved.id.slice(0,8)}`);
    await expect(panel.locator('[data-shared-action="versions"]')).toBeEnabled();await expect(panel.locator('[data-shared-action="diff"]')).toBeDisabled();
    await expect(button).toBeEnabled();await expect(input).toHaveValue(name);
    if(domain==='signals'){await expect(frame.getByTestId('network-board')).toBeVisible();await expect(frame.getByTestId('run-circuit')).toBeAttached();await expect(page.locator('#signals-search')).toBeAttached()}
    else{await expect(frame.locator('#mechanical-sheet')).toBeAttached();await frame.locator('#mechanical-sheet').focus();if(await frame.locator('#mechanical-sheet').getAttribute('data-canvas-lock')==='true')await frame.locator('#mechanical-sheet').press('Space');await expect(frame.locator('.play-button')).toBeEnabled();await expect(page.locator('#workshop-search')).toBeAttached()}
    return {panel,frame,name,saved};
  }
  async function versions(domain,state){
    const ackPromise=page.waitForResponse(response=>{
      if(pathname(response)!=='/api/shared/operations'||response.request().method()!=='POST')return false;
      const body=response.request().postDataJSON();return body.action==='versions'&&body.domain===domain&&body.project===state.saved.id;
    },{timeout:20000}).then(async response=>{
      expect([200,201].includes(response.status()),'The native panel creates a real shared operation').toBe(true);
      const ack=await response.json();expect(capability(ack),'The shared operation has a valid private capability').toBe(true);
      owned.set(ack.id,ack.ticket);expect(owned.size).toBeLessThanOrEqual(3);return ack;
    });
    const transitions=[];
    const donePromise=page.waitForResponse(async response=>{
      if(response.request().method()!=='POST'||!/^\/api\/shared\/jobs\/[a-f0-9-]+\/read$/.test(pathname(response)))return false;
      const ack=await ackPromise;if(pathname(response)!==`/api/shared/jobs/${ack.id}/read`)return false;
      const record=await response.json();if(transitions.at(-1)?.state!==record.state||transitions.at(-1)?.phase!==record.phase)transitions.push({state:record.state,phase:record.phase});
      expect(transitions.length).toBeLessThanOrEqual(32);return terminal(record.state);
    },{timeout:60000});
    const[ack,response]=await Promise.all([ackPromise,donePromise,state.panel.getByRole('button',{name:'读取版本',exact:true}).press('Enter')]);
    const record=await response.json();
    expect([200,201].includes(response.status())).toBe(true);expect(record.state).toBe('done');expect(record.family).toBe('shared');owned.delete(ack.id);
    const result=record.shared?.operationResult;expect(result?.storage).toBe('PostgreSQL');expect(result.headRevision).toBe(1);expect(result.versions).toHaveLength(1);
    expect(result.versions[0].revision).toBe(1);expect(result.versions[0].digest).toBe(state.saved.digest);
    const history=state.panel.locator('[data-shared-history] > button');await expect(history).toHaveCount(1);await expect(history.locator('b')).toHaveText('1');
    await expect(history).toContainText(state.saved.digest.slice(0,16));await expect(state.panel.locator('[data-shared-notice]')).toHaveText('1 / r1');
    await expect(state.panel.locator('[data-shared-state]')).toContainText('done');await expect(state.panel.locator('[data-shared-notice]')).toHaveAttribute('data-error','false');
    await expect(state.panel.locator('[data-shared-action="diff"]')).toBeEnabled();await expect(state.panel.locator('[data-shared-cancel]')).toBeDisabled();
    await expect(state.frame.getByRole('textbox',{name:domain==='signals'?'Project name':'工程名称',exact:true})).toHaveValue(state.name);
    report.jobs.push({id:ack.id,domain,action:'versions',state:record.state,transitions,headRevision:1});
    await screenshot(state.panel,domain);
    return {job:ack.id,headRevision:1,historyRendered:true,nativeProjectNamePreserved:true};
  }
  async function panelViews(panel,domain){
    for(const view of ['analysis','artifacts','rooms','versions']){
      await panel.locator(`[data-shared-tab="${view}"]`).press('Enter');await expect(panel.locator(`[data-shared-view="${view}"]`)).toBeVisible();
      await expect(panel.locator(`[data-shared-tab="${view}"]`)).toHaveAttribute('aria-selected','true');
    }
    await panel.locator('[data-shared-fold]').press('Enter');await expect(panel.locator('[data-shared-body]')).toBeHidden();await expect(panel.locator('.shared-panel-bar')).toBeVisible();
    await panel.locator('[data-shared-fold]').press('Enter');await expect(panel.locator('[data-shared-body]')).toBeVisible();
    await expect(panel.locator('[data-shared-source]')).toContainText('r1');
    return {domain,tabs:4,foldRoundtrip:true,analysisDataRendering:false};
  }

  try{
    for(const domain of ['signals','workshop']){
      let state;
      await check(`${domain}: native save publishes the actual project capability`,async()=>{state=await nativeSave(domain);return {domain,project:state.saved.id,revision:1,storage:state.saved.storage}});
      await check(`${domain}: the native panel renders the completed shared version operation`,()=>versions(domain,state));
      await check(`${domain}: original editor and shared views remain operable`,()=>panelViews(state.panel,domain));
    }
    await check('music: all six demos exist, two real selections load or play, and their exports preserve valid notes',async()=>{
      await page.goto('/functions/music-studio/',{waitUntil:'domcontentloaded'});
      const panel=musicPanel=page.locator('[data-shared-panel][data-shared-domain="music"]'),frame=musicFrame=page.frameLocator('#music-frame');
      await expect(panel).toHaveCount(1);await expect(panel).toHaveAttribute('data-shared-initialized','1');await expect(panel.locator('[data-shared-source]')).toHaveText('—');
      await expect(panel.locator('[data-shared-tab="versions"]')).toHaveCount(0);await expect(panel.locator('[data-shared-chart]')).toBeAttached();
      await expect(panel.locator('[data-shared-action="package"]')).toBeDisabled();
      const main=musicMain=frame.locator('[data-studio-mode]');await expect(main).toHaveAttribute('data-studio-mode','idle',{timeout:30000});
      const select=frame.getByRole('combobox',{name:'示范曲',exact:true});await expect(select.locator('option')).toHaveCount(6);
      await expect(select.locator('option')).toHaveText(['欢乐颂','铃儿响叮当','小星星','两只老虎','玛丽有只小羊','伦敦桥']);
      await select.selectOption({label:'欢乐颂'});await frame.locator('[data-melody-load]').press('Enter');
      await expect(frame.locator('#notation')).toHaveValue('3 3 4 5 | 5 4 3 2 | 1 1 2 3 | 3. 2_ 2 - | 3 3 4 5 | 5 4 3 2 | 1 1 2 3 | 2. 1_ 1 -');
      await expect(page.locator('#music-receipt')).toContainText(/^[1-9]\d* 音符/);const joyNotes=parseInt(await page.locator('#music-receipt').textContent(),10);
      expect(joyNotes>0&&joyNotes<=64).toBe(true);await expect(main).toHaveAttribute('data-studio-mode','idle');
      await select.selectOption({label:'铃儿响叮当'});await frame.locator('[data-melody-play]').press('Enter');await expect(main).toHaveAttribute('data-studio-mode','playing');
      await expect(frame.locator('#notation')).toHaveValue(/^3 3 3 - \| 3 3 3 - \| 3 5 1' 2'/);
      await expect(page.locator('#music-receipt')).toContainText(/^[1-9]\d* 音符/);
      await frame.getByRole('button',{name:'■',exact:true}).press('Enter');await expect(main).toHaveAttribute('data-studio-mode','idle');
      const bellNotes=parseInt(await page.locator('#music-receipt').textContent(),10);expect(bellNotes>0&&bellNotes<=64).toBe(true);
      const files=[];let exported;
      for(const [kind,name]of [['json','JSON ↓'],['mid','MIDI ↓']]){
        const promised=page.waitForEvent('download',{timeout:10000});const[download]=await Promise.all([promised,frame.getByRole('button',{name,exact:true}).press('Enter')]);
        const file=path.join(folder,`phase12-music-demo.${kind}`);await mkdir(folder,{recursive:true});await download.saveAs(file);const bytes=await readFile(file);expect(bytes.length>0&&bytes.length<=32768).toBe(true);
        if(kind==='json'){
          exported=JSON.parse(bytes.toString('utf8'));expect(exported.events).toHaveLength(bellNotes);expect(exported.tempo).toBe(132);
          for(const note of exported.events){expect(Number.isInteger(note.n)&&note.n>=48&&note.n<=96).toBe(true);expect(Number.isInteger(note.t)&&note.t>=0&&note.t<=600000).toBe(true);
            expect(Number.isInteger(note.d)&&note.d>=40&&note.d<=4000,'Exported held notes use finite integer millisecond durations').toBe(true);expect(Number.isFinite(note.v)&&note.v>=.05&&note.v<=1).toBe(true)}
          expect(exported.events.some(note=>note.n>=72),'The real bells phrase contains its upper-octave notes').toBe(true);
          expect(exported.events.every((note,index)=>index===0||note.t>=exported.events[index-1].t)).toBe(true);
        }else{expect(bytes.subarray(0,4).toString('ascii')).toBe('MThd');expect(bytes.readUInt32BE(4)).toBe(6);expect(bytes.subarray(14,18).toString('ascii')).toBe('MTrk')}
        files.push({kind,file,bytes:bytes.length,sha256:hash(bytes)});
      }
      return {options:6,joyLoadedNotes:joyNotes,bellsPlayedNotes:bellNotes,playStoppedImmediately:true,actualDownloads:files,integerNoteFields:true,wavRendering:false};
    });
    await check('music: one actual short note is recorded and its saved job reaches the shared panel',async()=>{
      const panel=musicPanel,frame=musicFrame,main=musicMain,record=frame.locator('[data-record]');
      await expect(main).toHaveAttribute('data-studio-mode','idle');
      await record.press('Enter');await expect(main).toHaveAttribute('data-studio-mode','recording');
      const key=frame.getByRole('button',{name:'琴键 60',exact:true});await expect(key).toBeVisible();const box=await key.boundingBox();expect(!!box,'A real piano key is visible').toBe(true);
      await key.click({position:{x:Math.min(8,box.width/2),y:box.height*.85},delay:90});
      await record.press('Enter');await expect(main).toHaveAttribute('data-studio-mode','idle');await expect(page.locator('#music-receipt')).toContainText('1 音符');
      const responsePromise=page.waitForResponse(response=>pathname(response)==='/api/q8/music'&&response.request().method()==='POST',{timeout:20000});
      const acknowledgement=responsePromise.then(async response=>{
        expect([200,201].includes(response.status()),'The actual recording is saved').toBe(true);const data=await response.json();
        musicJob={id:data.job?.id,ticket:data.ticket};expect(capability(musicJob),'The recording has a real backend job capability').toBe(true);owned.set(musicJob.id,musicJob.ticket);return data;
      });
      musicCompletion=page.waitForResponse(async response=>{
        if(response.request().method()!=='POST'||!/^\/api\/shared\/jobs\/[a-f0-9-]+\/read$/.test(pathname(response)))return false;
        await acknowledgement;if(pathname(response)!==`/api/shared/jobs/${musicJob.id}/read`)return false;
        const record=await response.json();if(musicTransitions.at(-1)?.state!==record.state||musicTransitions.at(-1)?.phase!==record.phase)musicTransitions.push({state:record.state,phase:record.phase});
        expect(musicTransitions.length).toBeLessThanOrEqual(40);
        if(!terminal(record.state)){await expect(panel.locator('[data-shared-action="package"]')).toBeDisabled();musicPendingObservations++}
        return terminal(record.state);
      },{timeout:180000});
      // This promise is awaited by the next step; retain a rejection handler if native save fails first.
      void musicCompletion.catch(()=>{});
      const[response]=await Promise.all([responsePromise,acknowledgement,frame.locator('[data-save]').press('Enter')]);
      const sent=response.request().postDataJSON();expect(sent.events).toHaveLength(1);expect(sent.events[0].n).toBe(60);expect(Number.isInteger(sent.events[0].d)&&sent.events[0].d>=40&&sent.events[0].d<=4000).toBe(true);
      await expect(panel.locator('[data-shared-source]')).toHaveText(`音乐 / ${musicJob.id.slice(0,8)}`);
      await expect(frame.locator('[data-save]')).toBeEnabled();await expect(frame.getByLabel('简谱',{exact:false})).toBeAttached();
      return {job:musicJob.id,recordedNotes:1,note:60,actualNativeRecording:true,actualSaveAcknowledged:true,contextBridge:true};
    });
    await check('music: completed backend data draws real parent analysis and enables a SHA-verified ZIP download',async()=>{
      const panel=musicPanel,response=await musicCompletion;expect([200,201].includes(response.status())).toBe(true);const record=await response.json();
      expect(record.state).toBe('done');expect(record.family).toBe('music-report');owned.delete(musicJob.id);
      const shared=record.shared,analysis=shared?.analysis;
      expect(analysis?.schema).toBe('ocv.shared-analysis-result/1');expect(analysis.ok).toBe(true);expect(analysis.dataset.kind).toBe('music');
      expect(analysis.dataset.originalSamples).toBe(1);expect(analysis.statistics.length).toBeGreaterThan(0);expect(analysis.series.length).toBeGreaterThan(0);
      expect(shared.object?.verified).toBe(true);expect(shared.publication?.ok).toBe(true);expect(shared.publication?.storage).toBe('mysql');
      await expect(panel.locator('[data-shared-state]')).toHaveText('就绪');await expect(panel.locator('[data-shared-action="package"]')).toBeEnabled();
      await expect(panel.locator('[data-shared-cancel]')).toBeDisabled();await expect(panel.locator('[data-shared-notice]')).not.toHaveAttribute('data-error','true');
      await panel.locator('[data-shared-tab="analysis"]').press('Enter');await expect(panel.locator('[data-shared-view="analysis"]')).toBeVisible();
      await expect(panel.locator('[data-shared-analysis-source]')).toHaveText(`music / ${analysis.sourceDigest.slice(0,16)}`);
      await expect.poll(()=>panel.locator('[data-shared-chart] path').count()).toBeGreaterThan(0);
      await expect.poll(()=>panel.locator('[data-shared-chart] circle').count()).toBeGreaterThan(0);
      await expect.poll(()=>panel.locator('[data-shared-heatmap] rect title').count()).toBeGreaterThan(0);
      await expect(panel.locator('[data-shared-statistics] tbody tr')).toHaveCount(Math.min(10,analysis.statistics.length));
      await expect(panel.locator('[data-shared-statistics] tbody tr').first()).toContainText(`${analysis.statistics[0].entity} / ${analysis.statistics[0].quantity}`);
      const downloadable=analysis.artifacts.filter(artifact=>['samples.csv','statistics.csv','comparison.csv','analysis.json'].includes(artifact.name)).slice(0,4);
      expect(downloadable.length).toBeGreaterThan(0);await expect(panel.locator('[data-shared-analysis-downloads] button')).toHaveCount(downloadable.length);await screenshot(panel,'music-analysis');
      report.analysisDataRenderingExercised=true;
      await panel.locator('[data-shared-tab="artifacts"]').press('Enter');await expect(panel.locator('[data-shared-package]')).toHaveText('✓ SHA-256');
      await expect(panel.locator('[data-shared-manifest] > div')).toHaveCount(shared.artifact.manifest.files.length);
      const downloadPromise=page.waitForEvent('download',{timeout:20000});
      const zipResponsePromise=page.waitForResponse(value=>pathname(value)===`/api/shared/jobs/${musicJob.id}/download`&&value.request().method()==='POST',{timeout:20000});
      const[download,zipResponse]=await Promise.all([downloadPromise,zipResponsePromise,panel.getByRole('button',{name:'下载工程包',exact:true}).press('Enter')]);
      expect(zipResponse.status()).toBe(200);expect(zipResponse.headers()['content-type']).toContain('application/zip');
      const archiveSha=zipResponse.headers()['x-content-sha256'];expect(HEX.test(archiveSha),'The real ZIP response carries its checksum').toBe(true);
      const file=path.join(folder,'phase12-ui-music-report.zip');await download.saveAs(file);const bytes=await readFile(file);
      expect(bytes.length).toBe(shared.artifact.archive.bytes);expect(bytes.length).toBe(shared.object.bytes);expect(bytes.length>0&&bytes.length<=3145728).toBe(true);
      expect(bytes.readUInt32LE(0)).toBe(0x04034b50);expect(hash(bytes)).toBe(archiveSha);expect(hash(bytes)).toBe(shared.artifact.archive.sha256);expect(hash(bytes)).toBe(shared.object.sha256);
      await expect(panel.locator('[data-shared-notice]')).toHaveText('✓ SHA-256');await screenshot(panel,'music-artifacts');
      report.jobs.push({id:musicJob.id,domain:'music',action:'record/save/report',state:record.state,transitions:musicTransitions,archiveSha,bytes:bytes.length,verifiedPublication:true,actualParentDownload:true});
      return {job:musicJob.id,state:record.state,sourceNotes:1,renderedStatisticRows:Math.min(10,analysis.statistics.length),
        disabledPackageObservationsBeforeCompletion:musicPendingObservations,verifiedPublication:true,actualParentDownload:true,file,archiveSha,bytes:bytes.length};
    });
    expect(report.pageErrors,'No uncaught browser errors').toEqual([]);expect(report.consoleErrors,'No browser console errors').toEqual([]);
    expect(report.jobs.length).toBeLessThanOrEqual(report.maximumExplicitSubmittedJobs);report.passed=true;
  }catch(error){report.error=redact(error.message);throw error}
  finally{
    // Only capabilities obtained from this test's native UI are eligible for cleanup.
    for(const[id,ticket]of owned){try{const response=await page.request.post(`/api/shared/jobs/${id}/cancel`,{data:{ticket},timeout:10000});const data=await response.json();report.cleanup.push({id,http:response.status(),cancelled:data.cancelled===true})}catch{report.cleanup.push({id,cancelled:false,unresolved:true})}}
    report.finishedAt=new Date().toISOString();await mkdir(folder,{recursive:true});
    const old=path.join(folder,'phase12-ui-before-'+report.startedAt.replace(/[:.]/g,'-')+'.json');
    try{await copyFile(reportFile,old,constants.COPYFILE_EXCL)}catch(error){if(!['ENOENT','EEXIST'].includes(error.code))throw error}
    await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');
  }
});
