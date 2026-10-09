import {testDeps} from '../runtime-location.mjs';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {wasmRunner} from './wasm.mjs';

const body=(id,x,mass=1,fixed=false)=>({id,kind:'ball',mode:fixed?'fixed':'dynamic',x,y:0,mass,radius:.1,linearDamping:0,angularDamping:0});
const request=(a,b,length=2,extra={})=>({schema:'ocv.workshop-run/1',op:'simulate',world:{gravityY:0,durationS:1,
  bodies:[a,b],joints:[{id:'r',kind:'rod',a:a.id,b:b.id,restLength:length}],...extra}});
export async function rodCases() {
  const a=body('a',0,1,true);const moving=(x,vx,mass=2)=>({...body('b',x,mass),vx});
  const rows=[
    {id:'compressed-fixed-a',request:request(a,moving(.4,-4)),length:2,fixed:'a'},
    {id:'extended-fixed-a',request:request(a,moving(3.5,4)),length:2,fixed:'a'},
    {id:'compressed-fixed-b',request:request(moving(.5,0),a,1),length:1,fixed:'a'},
    {id:'collapsed-centers',request:request(a,moving(0,0),1),length:1,fixed:'a'},
    {id:'dynamic-masses-1-3',request:request({...body('a',0,1),vx:-1},{...body('b',.5,3),vx:1}),length:2,momentum:2,center0:.375,centerVelocity:.5},
    {id:'dynamic-mass-ratio-1000',request:request(body('a',0,100),body('b',.5,.1)),length:2,momentum:0,center0:.05/100.1,centerVelocity:0},
    {id:'inconsistent-fixed-centers',request:request(a,body('b',.5,1,true)),error:'ROD_FIXED_CONFLICT'},
  ];
  const x=.7,length=2,y=3-Math.sqrt(length**2-x**2);
  rows.push({id:'swing-following-radial-axis',request:request({...a,y:3},{...body('b',x),y,vx:1,vy:x/Math.sqrt(length**2-x**2)},length,{gravityY:-9.81,durationS:4}),length:2,swing:true});
  const project=JSON.parse(await readFile('config/parts/examples/crank-slider.json','utf8'));
  project.world.joints.find(j=>j.id==='rod').kind='rod';
  rows.push({id:'rejected-old-crank-candidate-now-bilateral',request:{schema:'ocv.workshop-run/1',op:'simulate',world:project.world},length:4.2,crank:true});
  return rows;
}
const pose=(f,id)=>f.bodies.find(b=>b.id===id);
export function checkRodCase(row,r) {
  if(row.error){assert.equal(r.ok,false);assert.ok(r.diagnostics.some(d=>d.code===row.error));return {diagnostic:row.error};}
  assert.equal(r.ok,true,JSON.stringify(r.diagnostics));let maxLateError=0,maxMomentumError=0,maxCenterError=0;
  const j=row.request.world.joints.find(j=>j.kind==='rod');
  const a=row.request.world.bodies.find(b=>b.id===j.a),b=row.request.world.bodies.find(b=>b.id===j.b);
  for(const f of r.frames) {
    const p=pose(f,j.a),q=pose(f,j.b);for(const v of [p.x,p.y,p.vx,p.vy,q.x,q.y,q.vx,q.vy])assert.ok(Number.isFinite(v));
    if(f.t>=.3)maxLateError=Math.max(maxLateError,Math.abs(Math.hypot(p.x-q.x,p.y-q.y)-row.length));
    if(row.momentum!==undefined) {
      maxMomentumError=Math.max(maxMomentumError,Math.abs(a.mass*p.vx+b.mass*q.vx-row.momentum));
      const center=(a.mass*p.x+b.mass*q.x)/(a.mass+b.mass);
      maxCenterError=Math.max(maxCenterError,Math.abs(center-(row.center0+row.centerVelocity*f.t)));
    }
    if(row.fixed){const fbody=row.request.world.bodies.find(v=>v.id===row.fixed),fp=pose(f,row.fixed);assert.ok(Math.hypot(fp.x-fbody.x,fp.y-fbody.y)<1e-5);}
  }
  assert.ok(maxLateError<(row.crank?.06:.025),`${row.id}: rod distance residual ${maxLateError}`);
  if(row.momentum!==undefined){assert.ok(maxMomentumError<.006,`Momentum residual ${maxMomentumError}`);assert.ok(maxCenterError<.01,`COM residual ${maxCenterError}`);}
  if(row.swing) {const xs=r.frames.map(f=>pose(f,j.b).x);assert.ok(Math.max(...xs)-Math.min(...xs)>1);}
  if(row.crank) {
    for(const portion of [r.frames.filter(f=>f.t>1&&f.t<4),r.frames.filter(f=>f.t>6&&f.t<9)]) {
      const v=portion.map(f=>pose(f,'piston').vx);assert.ok(Math.max(...v)>1&&Math.min(...v)<-1,'Piston stuck instead of reciprocating');}
  }
  return {maxLateDistanceError:maxLateError,maxMomentumError,maxCenterError};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const file=process.argv[2]||'config/apps/portal/public/workshop/engines/mechanics.wasm';const run=await wasmRunner(file);
  const report={schema:'ocv.workshop-rod-validation/1',wasmSha256:createHash('sha256').update(await readFile(file)).digest('hex'),passed:true,cases:[]};
  for(const row of await rodCases()) {
    const result=run(row.request);const record={id:row.id,engine:result.version};report.engine=result.version;
    try{record.evidence=checkRodCase(row,result);record.passed=true;}catch(error){record.passed=false;record.error=error.message;report.passed=false;}
    report.cases.push(record);
  }
  const suffix=report.engine.includes('rod-radial-1')?'after-fix':'before-fix';
  const out=process.env.OCV_WORKSHOP_ROD_REPORT||join(join(testDeps,'runtime','reports'),`phase11-rod-wasm-${suffix}.json`);
  await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({...report,report:out}));if(!report.passed)process.exitCode=1;
}
