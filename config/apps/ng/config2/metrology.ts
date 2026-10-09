import type {Project} from './stock';
import type {CircuitResult,Complex} from './transport';

export interface Measurement {id:string;label:string;value:number|null;unit:string;detail:string}
export interface GainSample {frequencyHz:number;gainDb:number|null;phaseDeg:number|null}
export interface CircuitMeasurements {
 kind:'dc'|'ac'|'transient';sourceName:string;node:string;reference:string;points:number;
 metrics:Measurement[];nodes:{id:string;value:number|null}[];branches:{id:string;value:number|null}[];
 gain:GainSample[];note:string;
}
type Sample={t:number;value:number};
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
function scalar(value:number|Complex|undefined):number|null {return finite(value)?value:null}
function complex(value:number|Complex|undefined):{re:number;im:number}|null {
 if(finite(value))return {re:value,im:0};
 if(value&&typeof value==='object'&&finite(value.re)&&finite(value.im))return {re:value.re,im:value.im};
 return null;
}
function metric(id:string,label:string,value:number|null,unit:string,detail=''):Measurement {
 return {id,label,value:value!==null&&Number.isFinite(value)?value:null,unit,detail};
}
function crossing(samples:Sample[],level:number,direction:number,after=-Infinity):number|null {
 for(let i=1;i<samples.length;i++){
  const a=samples[i-1],b=samples[i];
  if(b.t<after||(b.value-a.value)*direction<=0)continue;
  if((a.value-level)*direction<=0&&(b.value-level)*direction>=0){
   const time=a.t+(b.t-a.t)*(level-a.value)/(b.value-a.value);
   if(time>=after)return time;
  }
 }
 return null;
}
function transientMetrics(samples:Sample[]):Measurement[] {
 const missing=(detail:string)=>[
  metric('mean','Time-weighted mean',null,'V',detail),metric('rms','Time-weighted RMS',null,'V',detail),
  metric('minimum','Minimum',null,'V',detail),metric('maximum','Maximum',null,'V',detail),
  metric('peak-to-peak','Peak-to-peak',null,'V',detail),metric('transition','10–90% transition',null,'s',detail),
  metric('settling','2% terminal-band entry',null,'s',detail)
 ];
 if(samples.length<2||samples.some((sample,index)=>!finite(sample.t)||!finite(sample.value)||(index>0&&sample.t<=samples[index-1].t)))return missing('Insufficient or non-monotonic finite time samples.');
 const first=samples[0],last=samples[samples.length-1],duration=last.t-first.t;
 let area=0,squaredArea=0,minimum=first.value,maximum=first.value;
 for(let i=1;i<samples.length;i++){
  const a=samples[i-1],b=samples[i],dt=b.t-a.t;
  area+=dt*(a.value+b.value)/2;
  squaredArea+=dt*(a.value*a.value+a.value*b.value+b.value*b.value)/3;
  minimum=Math.min(minimum,b.value);maximum=Math.max(maximum,b.value);
 }
 const metrics=[metric('mean','Time-weighted mean',area/duration,'V','Trapezoidal integration over the recorded window.'),metric('rms','Time-weighted RMS',Math.sqrt(Math.max(0,squaredArea/duration)),'V','Exact square integral of the piecewise-linear sampled trace.'),metric('minimum','Minimum',minimum,'V'),metric('maximum','Maximum',maximum,'V'),metric('peak-to-peak','Peak-to-peak',maximum-minimum,'V')];
 const delta=last.value-first.value,amplitude=Math.abs(delta),scale=Math.max(1,Math.abs(first.value),Math.abs(last.value),maximum-minimum);
 if(amplitude<=scale*1e-10){metrics.push(metric('transition','10–90% transition',null,'s','No nonzero endpoint transition observed.'),metric('settling','2% terminal-band entry',null,'s','No nonzero endpoint transition observed.'));return metrics}
 const direction=Math.sign(delta),ten=crossing(samples,first.value+.1*delta,direction),ninety=ten===null?null:crossing(samples,first.value+.9*delta,direction,ten);
 const band=.02*amplitude;
 const tailStart=last.t-.1*duration,tail=samples.filter(sample=>sample.t>=tailStart);
 const stableTail=tail.length>=3&&tail.every(sample=>Math.abs(sample.value-last.value)<=band);
 const transition=stableTail&&ten!==null&&ninety!==null?ninety-ten:null;
 metrics.push(metric('transition',direction>0?'10–90% observed rise':'90–10% observed fall',transition,'s',stableTail?'Linear interpolation relative to recorded initial/final values.':'Terminal tail is not stable; the transition may be incomplete.'));
 let settling:number|null=null;
 if(stableTail){
  let lastOutside=-1;
  for(let i=0;i<samples.length;i++)if(Math.abs(samples[i].value-last.value)>band)lastOutside=i;
  if(lastOutside>=0&&lastOutside<samples.length-1){
   const a=samples[lastOutside],b=samples[lastOutside+1],boundary=last.value+Math.sign(a.value-last.value)*band;
   const entry=a.t+(b.t-a.t)*(boundary-a.value)/(b.value-a.value);
   if(last.t-entry>=.1*duration)settling=entry-first.t;
  }
 }
 metrics.push(metric('settling','2% terminal-band entry',settling,'s','Relative to recorded endpoints; requires a stable final 10% of the window and ≥3 tail samples. No extrapolation.'));
 return metrics;
}
function acMetrics(gain:GainSample[]):Measurement[] {
 const first=gain[0],valid=gain.filter(sample=>sample.gainDb!==null),peak=valid.reduce<GainSample|null>((best,sample)=>!best||(sample.gainDb as number)>(best.gainDb as number)?sample:best,null);
 let cut:number|null=null;
 if(first?.gainDb!==null&&first?.gainDb!==undefined){
  const target=first.gainDb-3;
  for(let i=1;i<gain.length;i++){
   const a=gain[i-1],b=gain[i];
   if(a.gainDb===null||b.gainDb===null||a.frequencyHz<=0||b.frequencyHz<=a.frequencyHz)continue;
   if(a.gainDb>=target&&b.gainDb<=target&&b.gainDb<a.gainDb){
    const fraction=(target-a.gainDb)/(b.gainDb-a.gainDb);
    cut=Math.exp(Math.log(a.frequencyHz)+fraction*(Math.log(b.frequencyHz)-Math.log(a.frequencyHz)));break;
   }
  }
 }
 return [metric('baseline-gain','Gain at first sample',first?.gainDb??null,'dB','20 log₁₀ |Vprobe / Vreference|.'),metric('baseline-phase','Relative phase at first sample',first?.phaseDeg??null,'deg','arg(Vprobe) − arg(Vreference), wrapped to ±180°.'),metric('peak-gain','Maximum sampled gain',peak?.gainDb??null,'dB'),metric('peak-frequency','Frequency of sampled maximum',peak?.frequencyHz??null,'Hz'),metric('minus-three-crossing','First baseline −3 dB crossing',cut,'Hz','Relative to the first sampled frequency; interpolated in log-frequency. Not a general bandwidth claim.')];
}
export function circuitMeasurements(result:CircuitResult,source:Project,node:string,reference:string):CircuitMeasurements|null {
 if(!result.ok||!result.rows.length)return null;
 const kind=source.analysis.kind,report:CircuitMeasurements={kind,sourceName:source.name,node,reference,points:result.rows.length,metrics:[],nodes:[],branches:[],gain:[],note:''};
 if(kind==='dc'){
  const row=result.rows[0];
  report.nodes=Object.entries(row.values).map(([id,value])=>({id,value:scalar(value)}));
  report.branches=Object.entries(row.branches||{}).map(([id,value])=>({id,value:scalar(value)}));
  report.metrics=[metric('operating-voltage','Operating voltage',scalar(row.values[node]),'V')];
  report.note='Signed branch currents use the engine’s a → b convention. Recorded operating point.';
 }else if(kind==='transient'){
  const samples=result.rows.map(row=>({t:row.t as number,value:scalar(row.values[node])??NaN}));
  report.metrics=transientMetrics(samples);
  report.note='Frozen computation; statistics cover the recorded window. Transition levels use observed endpoints.';
 }else{
  report.gain=result.rows.map(row=>{
   const out=complex(row.values[node]),input=complex(row.values[reference]);
   if(!out||!input||!finite(row.frequencyHz)||row.frequencyHz<=0)return {frequencyHz:row.frequencyHz??0,gainDb:null,phaseDeg:null};
   const inputMagnitude=Math.hypot(input.re,input.im),outputMagnitude=Math.hypot(out.re,out.im);
   if(inputMagnitude===0||outputMagnitude===0)return {frequencyHz:row.frequencyHz,gainDb:null,phaseDeg:null};
   const gainDb=20*Math.log10(outputMagnitude/inputMagnitude),phase=(Math.atan2(out.im,out.re)-Math.atan2(input.im,input.re))*180/Math.PI;
   return {frequencyHz:row.frequencyHz,gainDb:finite(gainDb)?gainDb:null,phaseDeg:((phase+180)%360+360)%360-180};
  });
  report.metrics=acMetrics(report.gain);
  report.note='Complex voltage ratio from frozen AC samples. A zero reference or absent crossing is unavailable.';
 }
 return report;
}
export function measurementCSV(report:CircuitMeasurements):string {
 const header=['source_project','analysis','probe','reference','kind','name','value','unit','frequency_Hz','detail'];
 const rows:unknown[][]=[header];
 const prefix=[report.sourceName,report.kind,report.node,report.reference];
 for(const item of report.metrics)rows.push([...prefix,'measurement',item.id,item.value??'',item.unit,'',item.value===null?'Unavailable. '+item.detail:item.detail]);
 for(const item of report.nodes)rows.push([...prefix,'node',item.id,item.value??'','V','','Recorded operating point.']);
 for(const item of report.branches)rows.push([...prefix,'branch',item.id,item.value??'','A','','Signed a → b current.']);
 for(const sample of report.gain){rows.push([...prefix,'gain','voltage-ratio',sample.gainDb??'','dB',sample.frequencyHz,'20 log10 |Vprobe / Vreference|.']);rows.push([...prefix,'phase','voltage-ratio',sample.phaseDeg??'','deg',sample.frequencyHz,'Wrapped relative phase.'])}
 return '\uFEFF'+rows.map(row=>row.map(value=>{const safe=typeof value==='string'&&/^[\s]*[=+\-@\t\r]/.test(value)?"'"+value:value;return `"${String(safe).replaceAll('"','""')}"`}).join(',')).join('\r\n');
}
