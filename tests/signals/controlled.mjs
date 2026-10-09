import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dockerCall,composeCall} from '../../scripts/docker-child.mjs';

const container=process.env.OCV_SIGNALS_NATIVE_CONTAINER;
function calculate(components,analysis={kind:'dc'}){
  const request={schema:'ocv.signals/1',op:'circuit',ground:'0',components,analysis};
  const options={input:JSON.stringify(request),timeout:10000,maxBuffer:1048576};
  const result=container?dockerCall(['exec','-i',container,'/opt/ocv/ocv-circuit'],options):composeCall(['exec','-T','signals-native','/opt/ocv/ocv-circuit'],options);
  if(result.error||result.status)throw Error(result.error?.message||result.stderr||'Native fixture failed');
  return JSON.parse(result.stdout);
}
const fixture=(type,gain)=>[{id:'v',type:'V',a:'in',b:'0',value:3},{id:'x',type,a:'out',b:'0',controlA:'in',controlB:'0',value:gain},{id:'r',type:'R',a:'out',b:'0',value:1000}];
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
test('Native VCVS gain and phase follow the independently supplied control voltage',()=>{
  const parts=fixture('E',2),dc=calculate(parts);assert.equal(dc.ok,true);close(dc.rows[0].values.out,6);close(dc.rows[0].branches.x,-.006);close(dc.rows[0].branches.v,0);
  parts[0].phaseDeg=45;const ac=calculate(parts,{kind:'ac',frequencyHz:1000});assert.equal(ac.ok,true);close(ac.rows[0].values.out.re,6/Math.sqrt(2));close(ac.rows[0].values.out.im,6/Math.sqrt(2));close(ac.rows[0].values.out.phaseDeg,45);
  const negative=calculate(fixture('E',-2));assert.equal(negative.ok,true);close(negative.rows[0].values.out,-6);
  const zero=calculate(fixture('E',0));assert.equal(zero.ok,true);close(zero.rows[0].values.out,0);
});
test('Native VCCS has oriented output current and loaded DC/AC voltage',()=>{
  const parts=fixture('G',.001),dc=calculate(parts);assert.equal(dc.ok,true);close(dc.rows[0].values.out,-3);close(dc.rows[0].branches.x,.003);close(dc.rows[0].branches.r,-.003);close(dc.rows[0].branches.v,0);
  parts[0].phaseDeg=45;const ac=calculate(parts,{kind:'ac',frequencyHz:1000});assert.equal(ac.ok,true);close(ac.rows[0].values.out.re,-3/Math.sqrt(2));close(ac.rows[0].values.out.im,-3/Math.sqrt(2));
});
test('Native controlled sources share the genuine backward-Euler state operator',()=>{
  const gm=calculate([...fixture('G',.001),{id:'c',type:'C',a:'out',b:'0',value:1e-6,initial:0}],{kind:'transient',stepS:.0001,durationS:.001});assert.equal(gm.ok,true);
  for(let n=0;n<gm.rows.length;n++)close(gm.rows[n].values.out,-3*(1-Math.pow(1/1.1,n)));
  const vc=calculate([{id:'v',type:'V',a:'s',b:'0',value:3},{id:'r0',type:'R',a:'s',b:'in',value:1000},{id:'c',type:'C',a:'in',b:'0',value:1e-6,initial:0},...fixture('E',2).slice(1)],{kind:'transient',stepS:.0001,durationS:.001});assert.equal(vc.ok,true);
  for(let n=0;n<vc.rows.length;n++)close(vc.rows[n].values.out,6*(1-Math.pow(1/1.1,n)));
});
test('Native controlled sources reject missing control ports, excess gain and floating references',()=>{
  const missing=fixture('E',2);delete missing[1].controlB;const absent=calculate(missing);assert.equal(absent.ok,false);assert.equal(absent.diagnostics[0].code,'CONTROL');
  const excessive=calculate(fixture('G',1e12+1));assert.equal(excessive.ok,false);assert.equal(excessive.diagnostics[0].code,'LIMIT');
  const floating=fixture('E',2);floating[1].controlA='ghost';const unsupported=calculate(floating);assert.equal(unsupported.ok,false);assert.equal(unsupported.diagnostics[0].code,'FLOATING');
});
if(process.env.OCV_SIGNALS_CONTROLLED_CASES)test('Actual editor-emitted potentiometer, loaded meter, ammeter and SPDT netlists execute unchanged',()=>{
  const cases=JSON.parse(readFileSync(process.env.OCV_SIGNALS_CONTROLLED_CASES,'utf8'));assert.equal(cases.length,3);
  for(const item of cases){const result=calculate(item.request.components,item.request.analysis);assert.equal(result.ok,true,item.name);close(result.rows[0].values.out,item.expectedOutput);if(item.expectedCurrent!==undefined)close(result.rows[0].branches.AM1,item.expectedCurrent);}
});
