export interface Complex {re:number;im:number;magnitude:number;phaseDeg:number}
export interface CircuitRow {t?:number;frequencyHz?:number;values:Record<string,number|Complex>;branches:Record<string,number|Complex>}
export interface CircuitResult {ok:boolean;engine:string;version:string;diagnostics:{code:string;message:string;component?:string}[];nodes:string[];rows:CircuitRow[];summary?:Record<string,unknown>;units?:Record<string,string>}
export interface RFLinkBudget {model:string;freeSpaceLossDb:number;eirpDbm:number;receivedDbm:number;noiseDbm:number;snrDb:number;ebN0Db:number;capacityBps:number;marginDb:number;fresnelRadiusM:number;noiseDensityDbmHz?:number;thermalNoiseDbm?:number;wavelengthM?:number;temperatureK?:number;channelCoupled?:boolean;geometryDerived?:boolean}
export interface ScanCell {row:number;column:number;x:number;y:number;bitErrors:number;payloadLength:number;ber:number;crcValid:boolean;interval:{lower:number;upper:number};summary:Record<string,unknown>}
export interface RadioResult {ok:boolean;engine:string;version:string;diagnostics?:{code:string;message:string}[];txBits:string;rxBits:string;payloadBits:string;decodedBits:string;encodedBits?:string;crcValid:boolean;bitErrors:number;ber:number;frameBitErrors:number;frameLength:number;payloadLength:number;waveform:{t:number;tx:number;txQ?:number;rx:number;q?:number}[];constellation:{i:number;q:number;bit:number;index:number}[];idealConstellation?:{i:number;q:number}[];eye:{phase:number;rx:number;q?:number;index:number}[];lineWaveform?:{t:number;value:number}[];interval:{lower:number;upper:number};summary:Record<string,unknown>;linkBudget?:RFLinkBudget;waterfall?:{rows:{frame:number;bin:number;t:number;frequencyHz:number;powerDb:number}[];frames:number;bins:number;minimumDb:number;maximumDb:number;normalization:string};sweep?:{axis:string;secondaryAxis:string|null;values:number[];secondaryValues:number[];cases:number;cells:ScanCell[];executed:boolean;seedPolicy:string}}
export interface DigitalResult {ok:boolean;engine:string;version:string;diagnostics?:{code:string;message:string}[];wires:string[];trace:{tick:number;t:number;values:Record<string,boolean>}[];events:{tick:number;t:number;wire:string;from:boolean|null;to:boolean;cause:string}[];summary:Record<string,unknown>}
export type EngineResult=CircuitResult|RadioResult|NetworkResult|DigitalResult;
export class LocalComputer {
 private worker?:Worker;private sequence=0;private reject?: (reason:Error)=>void;private deadline?:ReturnType<typeof setTimeout>;
 run(request:object):Promise<EngineResult>{
  this.cancel();this.worker=new Worker(new URL('engine-worker.mjs',document.baseURI),{type:'module'});
  const id=++this.sequence;
  return new Promise((resolve,reject)=>{
   this.reject=reject;
   this.deadline=setTimeout(()=>{this.cancel('Local computation exceeded 30 s')},30000);
   this.worker!.onmessage=({data})=>{if(data.id!==id)return;clearTimeout(this.deadline);this.reject=undefined;if(data.error)reject(Error(data.error));else resolve(data.result);this.worker?.terminate();this.worker=undefined;};
   this.worker!.onerror=event=>{clearTimeout(this.deadline);this.reject=undefined;reject(Error(event.message||'Engine worker failed'));this.worker?.terminate();this.worker=undefined;};
   this.worker!.postMessage({id,request});
  });
 }
 cancel(message='Cancelled'){clearTimeout(this.deadline);this.worker?.terminate();this.worker=undefined;this.reject?.(Error(message));this.reject=undefined;}
}
export interface JobResponse {id:string;ticket?:string;state:string;phase?:string;result?:{engine:EngineResult;analysis?:Record<string,unknown>;receipt?:unknown};error?:unknown}
export async function api<T>(path:string,payload:object,signal?:AbortSignal):Promise<T>{
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
 try{
  const response=await fetch(`/api/signals${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
  const text=await response.text();if(text.length>8*1024*1024)throw Error('Response exceeds 8 MiB');let result:any;
  try{result=JSON.parse(text)}catch{throw Object.assign(Error(response.ok?'响应格式异常':`分析暂不可用 (${response.status})`),{status:response.status})}
  if(!response.ok)throw Object.assign(Error(String(result.message||result.error||`HTTP ${response.status}`)),{status:response.status});return result as T;
 }finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort)}
}
export function download(name:string,content:string,mime:string){const url=URL.createObjectURL(new Blob([content],{type:mime})),a=document.createElement('a');a.href=url;a.download=name;a.style.display='none';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)}
export function circuitCSV(result:CircuitResult):string {
 const nodes=result.nodes||Object.keys(result.rows?.[0]?.values||{}),complex=result.rows.some(row=>nodes.some(node=>typeof row.values[node]==='object'));
 const headers=[result.rows.some(row=>row.frequencyHz!==undefined)?'frequency_Hz':'time_s',...nodes.flatMap(node=>complex?[`${node}_re_V`,`${node}_im_V`,`${node}_magnitude_V`,`${node}_phase_deg`]:[`${node}_V`])];
 return [headers.join(','),...result.rows.map(row=>[row.frequencyHz??row.t??0,...nodes.flatMap(node=>{const value=row.values[node];return typeof value==='object'?[value.re,value.im,value.magnitude,value.phaseDeg]:complex?[value??'',0,Math.abs(value as number),typeof value==='number'&&value<0?180:0]:[value??'']})].join(','))].join('\r\n');
}
export function radioCSV(result:RadioResult):string{return [`# schema=ocv.signals-waveform/1;engine=${result.engine};version=${result.version};fs_Hz=${result.summary['sampleRateHz']};seed=${result.summary['seed']};modulation=${result.summary['modulation']};line_code=${result.summary['lineCode']||'NRZ'};amplitude_unit=normalized;raw_samples=true`,'time_s,tx_I,tx_Q,rx_I,rx_Q',...result.waveform.map(row=>`${row.t},${row.tx},${row.txQ??0},${row.rx},${row.q??0}`)].join('\r\n')}
export function digitalCSV(result:DigitalResult):string{return [`# schema=ocv.signals-digital/1;engine=${result.engine};version=${result.version};tick_s=${result.summary['tickS']};unit=boolean;model=ideal synchronous`,'tick,time_s,'+result.wires.join(','),...result.trace.map(row=>[row.tick,row.t,...result.wires.map(wire=>row.values[wire]?1:0)].join(','))].join('\r\n')}
import {NetworkResult} from './packet';
