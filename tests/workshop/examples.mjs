import {testDeps} from '../runtime-location.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { wasmRunner } from './wasm.mjs';
import { checkEnhancedExample, enhancedExampleIds } from './examples-enhanced.mjs';

export async function loadExamples(directory = 'config/parts/examples') {
  const catalogueText=await readFile(join(directory,'catalogue.json'),'utf8');
  const catalogue=JSON.parse(catalogueText);
  assert.equal(catalogue.schema,'ocv.workshop-catalogue/1'); assert.equal(catalogue.entries.length,12);
  const ids=new Set(); const examples=[];
  for(const entry of catalogue.entries) {
    assert.match(entry.id,/^[a-z0-9-]+$/); assert.ok(!ids.has(entry.id)); ids.add(entry.id);
    assert.equal(entry.file,`${entry.id}.json`);
    for(const key of ['name','description','goal']) {assert.equal(typeof entry[key],'string');assert.match(entry[key],/[\u4e00-\u9fff]/);}
    assert.ok(entry.tips.length>=3 && entry.tips.every(t=>typeof t==='string' && /[\u4e00-\u9fff]/.test(t)));
    const text=await readFile(join(directory,entry.file),'utf8');const project=JSON.parse(text);
    assert.equal(project.schema,'ocv.workshop-project/1');assert.equal(project.name,entry.name);
    assert.ok(Buffer.byteLength(text)<=131072);assert.ok(project.world.bodies.length>=8 && project.world.bodies.length<=64);
    examples.push({entry,project,sha256:createHash('sha256').update(text).digest('hex')});
  }
  return {catalogue,examples,catalogueSha256:createHash('sha256').update(catalogueText).digest('hex')};
}
export function toRequest(project) {
  return {schema:'ocv.workshop-run/1',op:'simulate',world:project.world,...(project.challenge?{challenge:project.challenge}:{})};
}
const pos=(frame,id)=>{const p=frame.bodies.find(b=>b.id===id);assert.ok(p,`Missing pose ${id}`);return p;};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const controls=r=>r.keyMoments.filter(m=>m.kind==='control');
const contacts=r=>r.keyMoments.filter(m=>m.kind==='contact');
function event(r,id,time) {const hit=controls(r).find(m=>m.id===id);assert.ok(hit,`Expected control ${id}`);if(time!==undefined)assert.ok(Math.abs(hit.t-time)<.02);return hit;}
function range(r,id,key) {const values=r.frames.map(f=>pos(f,id)[key]);return Math.max(...values)-Math.min(...values);}

export function checkExample(id,project,r) {
  if(enhancedExampleIds.includes(id)) return checkEnhancedExample(id,project,r);
  assert.equal(r.ok,true,JSON.stringify(r.diagnostics));assert.equal(r.summary.complete,true);
  assert.equal(r.schema,'ocv.workshop-result/1');assert.ok(r.frames.length>20 && r.frames.length<=256);
  assert.equal(r.frames.length,r.summary.frameCount);assert.ok(r.summary.steps<=4800);
  let movement=0,poses=0;
  for(const f of r.frames) {
    assert.ok(Number.isFinite(f.t));assert.equal(f.bodies.length,project.world.bodies.length);
    for(const b of f.bodies) {
      for(const key of ['x','y','angle','vx','vy','omega'])assert.ok(Number.isFinite(b[key]),`${id}:${b.id}:${key}`);
      assert.ok(Math.hypot(b.x,b.y)<30,`Scene escaped its useful viewport: ${id}:${b.id}`);
      const initial=project.world.bodies.find(v=>v.id===b.id);assert.ok(initial);
      if(initial.mode==='fixed') {assert.ok(Math.abs(b.x-initial.x)<1e-5);assert.ok(Math.abs(b.y-initial.y)<1e-5);}
      else movement=Math.max(movement,distance(initial,b),Math.abs(b.angle-initial.angle));
      poses++;
    }
  }
  assert.ok(movement>.35,`${id} must actually move`);
  if(project.challenge) {assert.equal(r.summary.challengeComplete,true);assert.ok(r.keyMoments.some(m=>m.kind==='challenge'&&m.complete&&m.id===project.challenge.id));}
  const last=r.frames.at(-1);const evidence={movement,poses};
  switch(id) {
    case 'gearbox': {
      const g=[0,1,2,3].map(i=>pos(last,`gear${i}`));const ratios=[1/.65,.65/.5,.5/.9];
      const errors=ratios.map((ratio,i)=>Math.abs(g[i+1].omega+ratio*g[i].omega));assert.ok(errors.every(e=>e<.015));
      assert.equal(controls(r).filter(m=>m.id==='reverse').length,2);event(r,'coast',8);
      evidence.maxRatioResidual=Math.max(...errors);evidence.challengeTime=r.summary.completionTime;break;
    }
    case 'timing-belt': {
      for(let i=0;i<3;i++){assert.ok(range(r,`pulley${i}`,'angle')>5);assert.ok(Math.abs(pos(last,`pulley${i}`).angle-pos(last,`hand${i}`).angle)<.02);}
      assert.ok(Math.abs(pos(last,'pulley1').omega-1.6*pos(last,'pulley0').omega)<.015);
      assert.ok(Math.abs(pos(last,'pulley2').omega-.5*pos(last,'pulley1').omega)<.015);
      assert.equal(controls(r).length,5);event(r,'start',.75);event(r,'stop',7.5);
      assert.deepEqual(controls(r).filter(m=>m.id==='reverse').map(m=>m.sequence),[1,2,3]);
      evidence.controlTimes=controls(r).map(m=>({id:m.id,action:m.action,t:m.t}));break;
    }
    case 'domino-line': {
      const fallen=last.bodies.filter(b=>b.id.startsWith('tile')&&Math.abs(b.angle)>1.1).length;assert.ok(fallen>=10);
      assert.ok(event(r,'last-contact').t>2);assert.ok(pos(last,'counter').omega>2.9);assert.ok(r.summary.collisions>=14);
      evidence.fallen=fallen;evidence.tailTriggerTime=event(r,'last-contact').t;break;
    }
    case 'marble-relay': {
      for(const rail of ['ramp0','ramp1','ramp2'])assert.ok(contacts(r).some(m=>[m.a,m.b].includes('marble')&&[m.a,m.b].includes(rail)),`Missing actual rail contact ${rail}`);
      const b=pos(last,'marble');assert.ok(Math.hypot(b.vx,b.vy)<.1);assert.ok(b.x>6);
      evidence.challengeTime=r.summary.completionTime;evidence.finalPosition={x:b.x,y:b.y};break;
    }
    case 'pendulum-bank': {
      let maxRodError=0;for(let i=0;i<6;i++){assert.ok(range(r,`bob${i}`,'x')>.35);const length=project.world.joints.find(j=>j.id===`rod${i}`).restLength;
        for(const f of r.frames)maxRodError=Math.max(maxRodError,Math.abs(distance(pos(f,`anchor${i}`),pos(f,`bob${i}`))-length));}
      assert.ok(maxRodError<.015);evidence.maxCenterDistanceError=maxRodError;break;
    }
    case 'tuned-damping': {
      const e1=Math.abs(pos(last,'cart1').x-(-.5)),e2=Math.abs(pos(last,'cart2').x-3.8);assert.ok(e1<.002 && e2<.002);
      const late=r.frames.filter(f=>f.t>=7);const lowSpan=Math.max(...late.map(f=>pos(f,'cart0').x))-Math.min(...late.map(f=>pos(f,'cart0').x));
      const highSpan=Math.max(...late.map(f=>pos(f,'cart2').x))-Math.min(...late.map(f=>pos(f,'cart2').x));assert.ok(lowSpan>.05&&highSpan<.01);
      evidence.lateLowDampingTravel=lowSpan;evidence.lateHighDampingTravel=highSpan;break;
    }
    case 'crank-slider': {
      assert.ok(range(r,'piston','x')>1.5);assert.ok(range(r,'piston','y')<.02);event(r,'reverse',5);
      for(const portion of [r.frames.filter(f=>f.t>1&&f.t<4),r.frames.filter(f=>f.t>6&&f.t<9)]) {
        const speeds=portion.map(f=>pos(f,'piston').vx);assert.ok(Math.max(...speeds)>1&&Math.min(...speeds)<-1,'Piston must continue reciprocating, not hit a limit and stick');}
      let extension=0;for(const f of r.frames)extension=Math.max(extension,Math.abs(distance(pos(f,'pin'),pos(f,'piston'))-4.2));assert.ok(extension<.06);
      evidence.stroke=range(r,'piston','x');evidence.maxElasticLengthError=extension;break;
    }
    case 'basketball': {
      const apex=Math.max(...r.frames.map(f=>pos(f,'ball').y));assert.ok(apex>5.5&&apex<8);
      assert.ok(contacts(r).some(m=>[m.a,m.b].includes('ball')&&[m.a,m.b].includes('basketbase')));
      event(r,'near');event(r,'hit');event(r,'count');assert.ok(pos(last,'score').omega< -2.9);
      evidence.apex=apex;evidence.challengeTime=r.summary.completionTime;evidence.sensorKinds=['distance','contact','count'];break;
    }
    default:assert.fail(`Missing meaningful mechanism check for ${id}`);
  }
  return evidence;
}

export async function checkAllExamples({directory,wasm,reportPath}={}) {
  const loaded=await loadExamples(directory);const wasmPath=wasm||'config/apps/portal/public/workshop/engines/mechanics.wasm';const run=await wasmRunner(wasmPath);
  const report={schema:'ocv.workshop-examples-validation/1',passed:true,catalogueSha256:loaded.catalogueSha256,
    wasmSha256:createHash('sha256').update(await readFile(wasmPath)).digest('hex'),examples:[]};
  for(const {entry,project,sha256} of loaded.examples) {
    const started=performance.now();const result=run(toRequest(project));
    const row={id:entry.id,name:entry.name,sha256,bodies:project.world.bodies.length,joints:project.world.joints.length,
      engine:result.version,summary:result.summary,diagnostics:result.diagnostics};
    try {row.evidence=checkExample(entry.id,project,result);row.passed=true;}
    catch(error){row.passed=false;row.error=error.message;report.passed=false;}
    row.elapsedMs=performance.now()-started;report.examples.push(row);
  }
  const completed=report.examples.filter(r=>r.passed&&r.summary.challengeComplete).length;
  if(completed<2){report.passed=false;report.error='At least two distinct completed challenges required.';}
  report.completedChallenges=completed;
  const output=reportPath||process.env.OCV_WORKSHOP_EXAMPLES_REPORT||join(join(testDeps,'runtime','reports'),'phase11-examples-wasm.json');
  await mkdir(dirname(resolve(output)),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,examples:report.examples.map(r=>({id:r.id,passed:r.passed,error:r.error,evidence:r.evidence})),completedChallenges:completed,report:output}));
  return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const report=await checkAllExamples({directory:process.argv[2],wasm:process.argv[3]});
  if(!report.passed)process.exitCode=1;
}
