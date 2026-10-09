import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {composeCall,dockerCall} from '../../scripts/docker-child.mjs';

const mode = process.env.OCV_SIGNALS_NATIVE_MODE || 'container';
const native = process.env.OCV_SIGNALS_NATIVE_CONTAINER;
function calculate(engine, payload) {
  const executable = engine === 'cpp' ? '/opt/ocv/ocv-circuit' : '/opt/ocv/ocv-communications';
  const options={input:JSON.stringify({schema:'ocv.signals/1',...payload}),timeout:20000,maxBuffer:32*1024*1024};
  let result;
  if(mode==='binary') {
    const command=process.env[engine==='cpp'?'OCV_CPP_BINARY':'OCV_RUST_BINARY'];
    if(!command)throw new Error('Explicit native binary path required in binary mode.');
    result=spawnSync(command,[],{...options,encoding:'utf8',windowsHide:true});
  } else result=native?dockerCall(['exec','-i',native,executable],options):composeCall(['exec','-T','signals-native',executable],options);
  if (result.error || result.status) throw new Error(result.error?.message || result.stderr || `Native exit ${result.status}`);
  return JSON.parse(result.stdout);
}
function close(actual, expected, tolerance = 1e-9) { assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1,Math.abs(expected)), `${actual} differs from ${expected}`); }
const divider = [{id:'v',type:'V',a:'in',b:'0',value:5},{id:'r1',type:'R',a:'in',b:'out',value:1000},{id:'r2',type:'R',a:'out',b:'0',value:1000}];
test('DC divider retains KCL and source branch direction', () => {
  const r=calculate('cpp',{op:'circuit',analysis:{kind:'dc'},components:divider});assert.equal(r.ok,true);close(r.rows[0].values.out,2.5);close(r.rows[0].branches.r1,.0025);close(r.rows[0].branches.v,-.0025);assert.ok(r.summary.maxScaledResidual<1e-12);
});
test('Explicit engineering units normalize to SI and reject mismatched units', () => {
  const components=divider.map(c=>c.type==='R'?{...c,value:1,unit:'kohm'}:c);
  const r=calculate('cpp',{op:'circuit',analysis:{kind:'dc'},components});assert.equal(r.ok,true);close(r.rows[0].values.out,2.5);
  assert.equal(calculate('cpp',{components:components.map(c=>c.id==='r1'?{...c,unit:'F'}:c)}).diagnostics[0].code,'UNIT');
});
test('AC RC phasor is 1/(1+jωRC)', () => {
  const components=[...divider.slice(0,2),{id:'c',type:'C',a:'out',b:'0',value:1e-6}];
  const f=1/(2*Math.PI*1000*1e-6);const r=calculate('cpp',{op:'circuit',analysis:{kind:'ac',frequencyHz:f},components});assert.equal(r.ok,true);close(r.rows[0].values.out.re,2.5);close(r.rows[0].values.out.im,-2.5);close(r.rows[0].values.out.phaseDeg,-45);
});
test('RC transient matches independent backward-Euler recurrence', () => {
  const components=[...divider.slice(0,2),{id:'c',type:'C',a:'out',b:'0',value:1e-6,initial:0}];
  const dt=.0001;const r=calculate('cpp',{op:'circuit',analysis:{kind:'transient',stepS:dt,durationS:.001},components});assert.equal(r.ok,true);close(r.rows[0].values.out,0);
  for(let n=1;n<r.rows.length;n++){close(r.rows[n].values.out,5*(1-Math.pow(1/(1+dt/.001),n)));close(r.rows[n].branches.r1,r.rows[n].branches.c);}
});
test('RL transient preserves inductor current and voltage history', () => {
  const components=[{id:'v',type:'V',a:'in',b:'0',value:5},{id:'r',type:'R',a:'in',b:'out',value:100},{id:'l',type:'L',a:'out',b:'0',value:.1,initial:0}];
  const dt=.0001;const r=calculate('cpp',{op:'circuit',analysis:{kind:'transient',stepS:dt,durationS:.001},components});assert.equal(r.ok,true);close(r.rows[0].branches.l,0);
  for(let n=1;n<r.rows.length;n++){close(r.rows[n].branches.l,.05*(1-Math.pow(1/(1+dt/.001),n)));close(r.rows[n].branches.r,r.rows[n].branches.l);}
});
test('Floating, singular and unsupported models fail explicitly', () => {
  const floating=calculate('cpp',{op:'circuit',components:[{id:'a',type:'R',a:'x',b:'y',value:2},{id:'b',type:'V',a:'s',b:'0',value:5}]});assert.equal(floating.ok,false);assert.equal(floating.diagnostics[0].code,'FLOATING');
  const conflict=calculate('cpp',{op:'circuit',components:[{id:'a',type:'V',a:'x',b:'0',value:1},{id:'b',type:'V',a:'x',b:'0',value:2}]});assert.equal(conflict.ok,false);assert.equal(conflict.diagnostics[0].code,'SINGULAR');
  assert.equal(calculate('cpp',{components:[{id:'d',type:'D',a:'x',b:'0',value:1}]}).diagnostics[0].code,'UNSUPPORTED');
});
test('BPSK noiseless CRC-8 frame and seed channel are real repeatable native outputs', () => {
  const r=calculate('rust',{op:'communications',bits:'0111001010011010',noiseless:true,seed:32});assert.equal(r.ok,true);assert.equal(r.crcValid,true);assert.equal(r.bitErrors,0);assert.equal(r.payloadBits,r.decodedBits);assert.equal(r.frameLength,r.payloadLength+8);assert.equal(r.waveform.length,r.frameLength*8);
  const input={op:'communications',bits:'1011000110001010'.repeat(64),seed:55,ebN0Db:0};const a=calculate('rust',input),b=calculate('rust',input);assert.deepEqual(a,b);assert.ok(a.ber>0&&a.ber<.25);assert.ok(a.interval.upper>=a.ber&&a.interval.lower<=a.ber);
});
test('Native ideal digital events evaluate gates and reject combinational cycles', () => {
  const r=calculate('rust',{op:'digital',inputs:{a:true,b:false},gates:[{id:'xor',type:'XOR',inputs:['a','b']},{id:'q',type:'DFF',inputs:['xor']}],ticks:12,clockPeriodTicks:4});assert.equal(r.ok,true);assert.equal(r.trace[0].values.q,false);assert.equal(r.trace[2].values.q,true);
  const cycle=calculate('rust',{op:'digital',inputs:{},gates:[{id:'a',type:'NOT',inputs:['b']},{id:'b',type:'NOT',inputs:['a']}]});assert.equal(cycle.ok,false);assert.equal(cycle.diagnostics[0].code,'DIGITAL_CYCLE');
});
test('Packet network queues serialize real link bandwidth and preserve horizon state', () => {
  const input={op:'network',nodes:[{id:'a',type:'host'},{id:'b',type:'router'}],links:[{id:'x',a:'a',b:'b',rateMbps:1,delayMs:10,loss:0}],flows:[{id:'f',source:'a',target:'b',packets:2,bytes:1000,intervalMs:0}],durationMs:100};
  const r=calculate('rust',input);assert.equal(r.ok,true);assert.deepEqual(r.events.filter(e=>e.kind==='arrive').map(e=>e.tMs),[18,26]);assert.equal(r.flows[0].delivered,2);close(r.flows[0].avgLatencyMs,22);
  const pending=calculate('rust',{...input,durationMs:12});assert.equal(pending.summary.pending,2);assert.equal(pending.summary.dropped,0);
});
