import {CircuitResult,Complex,RadioResult} from './transport';

export interface Point {x:number;y:number}
export interface Trace {name:string;path:string;color:string}
export interface Tick {value:number;label:string;x:number;y:number}
export interface Cursor {x:number;y:number;value:number;label:string}
export interface Plot {
 traces:Trace[];xmin:number;xmax:number;ymin:number;ymax:number;xLabel:string;yLabel:string;points:number;
 majorGrid:string;minorGrid:string;xTicks:Tick[];yTicks:Tick[];zeroPath:string;measurementLabel:string;cursor?:Cursor;
}
export const WIDTH=900,HEIGHT=280,PAD=32;
const RIGHT=WIDTH-PAD,BOTTOM=HEIGHT-PAD,INNER_WIDTH=WIDTH-2*PAD,INNER_HEIGHT=HEIGHT-2*PAD;
const colors=['#005eff','#1597ae','#7459c6','#ca731c'];
const finite=(point:Point)=>Number.isFinite(point.x)&&Number.isFinite(point.y);
const pixelX=(x:number,min:number,max:number)=>PAD+(x-min)*INNER_WIDTH/Math.max(1e-15,max-min);
const pixelY=(y:number,min:number,max:number)=>BOTTOM-(y-min)*INNER_HEIGHT/Math.max(1e-15,max-min);

function numberLabel(value:number):string {
 if(!Number.isFinite(value))return '—';
 if(value===0||Math.abs(value)<1e-16)return '0';
 for(const [scale,prefix] of [[1e12,'T'],[1e9,'G'],[1e6,'M'],[1e3,'k'],[1,''],[1e-3,'m'],[1e-6,'µ'],[1e-9,'n'],[1e-12,'p']] as [number,string][]){
  if(Math.abs(value)>=scale)return `${Number((value/scale).toPrecision(3))}${prefix}`;
 }
 return value.toExponential(2);
}
function tickValues(min:number,max:number,target:number):number[] {
 const raw=(max-min)/target;
 if(!(raw>0&&Number.isFinite(raw)))return [];
 const decade=Math.pow(10,Math.floor(Math.log10(raw))),fraction=raw/decade;
 const step=(fraction<=1?1:fraction<=2?2:fraction<=2.5?2.5:fraction<=5?5:10)*decade;
 const first=Math.ceil((min-step*1e-8)/step),last=Math.floor((max+step*1e-8)/step);
 const ticks:number[]=[];
 for(let index=first;index<=last&&ticks.length<32;index++){
  const value=index*step;ticks.push(Math.abs(value)<step*1e-9?0:value);
 }
 return ticks;
}
function logarithmicTicks(min:number,max:number):{major:number[];minor:number[]} {
 let major:number[]=[],minor:number[]=[];
 const start=Math.floor(min),stop=Math.ceil(max);
 for(let decade=start;decade<=stop&&decade-start<64;decade++){
  if(decade>=min&&decade<=max)major.push(decade);
  for(let digit=2;digit<=9;digit++){
   const x=decade+Math.log10(digit);if(x>=min&&x<=max)minor.push(x);
  }
 }
 if(major.length<3){
  major=[...major,...minor.filter(x=>{const digit=Math.round(Math.pow(10,x-Math.floor(x)));return digit===2||digit===5})].sort((a,b)=>a-b);
  if(major.length<2)major=tickValues(min,max,5);
 }
 minor=minor.filter(x=>!major.some(m=>Math.abs(m-x)<1e-10));
 return {major,minor};
}
function gridFor(plot:Plot,logarithmic=false){
 const horizontal=tickValues(plot.ymin,plot.ymax,4);
 const log=logarithmic?logarithmicTicks(plot.xmin,plot.xmax):undefined;
 const vertical=log?.major||tickValues(plot.xmin,plot.xmax,6);
 const minorY=tickValues(plot.ymin,plot.ymax,20).filter(y=>!horizontal.some(t=>Math.abs(t-y)<1e-9*(plot.ymax-plot.ymin)));
 const minorX=log?.minor||tickValues(plot.xmin,plot.xmax,30).filter(x=>!vertical.some(t=>Math.abs(t-x)<1e-9*(plot.xmax-plot.xmin)));
 const lineX=(x:number)=>`M${pixelX(x,plot.xmin,plot.xmax).toFixed(2)},${PAD}V${BOTTOM}`;
 const lineY=(y:number)=>`M${PAD},${pixelY(y,plot.ymin,plot.ymax).toFixed(2)}H${RIGHT}`;
 plot.majorGrid=[...vertical.map(lineX),...horizontal.map(lineY)].join(' ');
 plot.minorGrid=[...minorX.map(lineX),...minorY.map(lineY)].join(' ');
 plot.xTicks=vertical.map(value=>({value,label:numberLabel(logarithmic?Math.pow(10,value):value),x:pixelX(value,plot.xmin,plot.xmax),y:268}));
 plot.yTicks=horizontal.map(value=>({value,label:numberLabel(value),x:27,y:pixelY(value,plot.ymin,plot.ymax)+3}));
 plot.zeroPath=[...(plot.ymin<0&&plot.ymax>0?[lineY(0)]:[]),...(!logarithmic&&plot.xmin<0&&plot.xmax>0?[lineX(0)]:[])].join(' ');
 return plot;
}

export function pathOf(points:Point[],xmin:number,xmax:number,ymin:number,ymax:number):string {
 if(!points.length)return '';
 const stride=Math.max(1,Math.ceil(points.length/400)),selected:number[]=[];
 for(let first=0;first<points.length;first+=stride){
  const last=Math.min(points.length-1,first+stride-1);
  let low=first,high=first;
  for(let index=first;index<=last;index++){
   if(!finite(points[index]))continue;
   if(!finite(points[low])||points[index].y<points[low].y)low=index;
   if(!finite(points[high])||points[index].y>points[high].y)high=index;
  }
  for(const index of [...new Set([first,low,high,last])].sort((a,b)=>a-b))selected.push(index);
 }
 let previous=-1,connected=false;const paths:string[]=[];
 for(const index of selected){
  const point=points[index];
  for(let skipped=previous+1;skipped<index;skipped++)if(!finite(points[skipped])){connected=false;break;}
  previous=index;
  if(!finite(point)){connected=false;continue;}
  paths.push(`${connected?'L':'M'}${pixelX(point.x,xmin,xmax).toFixed(2)},${pixelY(point.y,ymin,ymax).toFixed(2)}`);
  connected=true;
 }
 return paths.join(' ');
}

export function plotSeries(series:{name:string;points:Point[];color:string}[],xLabel:string,yLabel:string,options:{singleXSpan?:number;minimumYSpan?:number}={}):Plot {
 let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity,count=0;
 for(const trace of series)for(const point of trace.points)if(finite(point)){
  xmin=Math.min(xmin,point.x);xmax=Math.max(xmax,point.x);ymin=Math.min(ymin,point.y);ymax=Math.max(ymax,point.y);count++;
 }
 if(!count){xmin=0;xmax=1;ymin=-1;ymax=1;}
 if(xmax===xmin){const allowance=options.singleXSpan??Math.max(1e-6,Math.abs(xmin)*.01);xmin-=allowance;xmax+=allowance;}
 if(ymax===ymin){const allowance=Math.max(options.minimumYSpan??1e-6,Math.abs(ymin)*.08);ymin-=allowance;ymax+=allowance;}
 else{const allowance=Math.max(options.minimumYSpan??0,(ymax-ymin)*.08);ymin-=allowance;ymax+=allowance;}
 return gridFor({traces:series.map(trace=>({name:trace.name,path:pathOf(trace.points,xmin,xmax,ymin,ymax),color:trace.color})),
  xmin,xmax,ymin,ymax,xLabel,yLabel,points:count,majorGrid:'',minorGrid:'',zeroPath:'',xTicks:[],yTicks:[],measurementLabel:`${count} acquired values`});
}

function valueOf(value:number|Complex,phase:boolean):number {
 if(typeof value==='number')return phase?0:value;
 return phase?(Number.isFinite(value.phaseDeg)?value.phaseDeg:Math.atan2(value.im,value.re)*180/Math.PI):
  (Number.isFinite(value.magnitude)?value.magnitude:Math.hypot(value.re,value.im));
}
function coordinate(result:CircuitResult,index:number,frequency:boolean):number {
 const row=result.rows[index];
 return frequency?(row.frequencyHz!>0?Math.log10(row.frequencyHz!):NaN):(row.t??0);
}
export function circuitPlot(result:CircuitResult,probe:string,phase=false,cursorIndex=0):Plot {
 const candidates=[probe,...result.nodes,...Object.keys(result.rows[0]?.values||{})];
 const names=[...new Set(candidates)].filter(name=>name!=='0'&&result.rows.some(row=>row.values[name]!==undefined)).slice(0,2);
 const frequency=result.rows.some(row=>row.frequencyHz!==undefined),dc=result.rows.length===1&&!frequency&&result.rows[0].t===undefined;
 const series=names.map((name,index)=>({name,color:colors[index],points:result.rows.filter(row=>row.values[name]!==undefined).flatMap(row=>{
  const y=valueOf(row.values[name],phase);
  return dc?[{x:0,y},{x:1,y}]:[{x:frequency?(row.frequencyHz!>0?Math.log10(row.frequencyHz!):NaN):(row.t??0),y}];
 })}));
 const plot=plotSeries(series,frequency?'Frequency / Hz · log scale':dc?'DC level · constant':'Time / s',phase?'Phase / °':'Voltage / V',
  {...(frequency?{singleXSpan:.5}:{}),...(phase?{minimumYSpan:5}:{})});
 if(frequency)gridFor(plot,true);
 if(dc){plot.xTicks=[];plot.majorGrid=plot.majorGrid.split(' ').filter(path=>!path.includes('V')).join(' ');plot.minorGrid=plot.minorGrid.split(' ').filter(path=>!path.includes('V')).join(' ');}
 const selected=Math.max(0,Math.min(result.rows.length-1,Math.floor(cursorIndex)||0)),row=result.rows[selected],name=names[0];
 if(row&&name&&row.values[name]!==undefined){
  const x=dc ? .5 : coordinate(result,selected,frequency),value=valueOf(row.values[name],phase);
  if(Number.isFinite(x)&&Number.isFinite(value))plot.cursor={x:pixelX(x,plot.xmin,plot.xmax),y:pixelY(value,plot.ymin,plot.ymax),value,
   label:`${name} · ${numberLabel(value)}${phase?'°':' V'}${dc?'':frequency?` @ ${numberLabel(row.frequencyHz!)} Hz`:` @ ${numberLabel(row.t??0)} s`}`};
 }
 plot.measurementLabel=dc?'DC operating point':`${result.rows.length} native rows · ${frequency?'AC frequency sweep':'transient acquisition'}`;
 return plot;
}

const coordinates=new WeakMap<CircuitResult,{values:number[];min:number;max:number;ordered:boolean;finite:boolean}>();
export function circuitCursorIndex(result:CircuitResult,probe:string,fraction:number):number {
 if(result.rows.length<2)return 0;
 let data=coordinates.get(result);
 if(!data){
  const frequency=result.rows.some(row=>row.frequencyHz!==undefined),values:number[]=[];let min=Infinity,max=-Infinity,ordered=true,valid=true;
  for(let index=0;index<result.rows.length;index++){
   const x=coordinate(result,index,frequency);values.push(x);if(Number.isFinite(x)){min=Math.min(min,x);max=Math.max(max,x);}else valid=false;if(index&&x<values[index-1])ordered=false;
  }
  data={values,min,max,ordered,finite:valid};coordinates.set(result,data);
 }
 const target=data.min+Math.max(0,Math.min(1,Number.isFinite(fraction)?fraction:0))*(data.max-data.min);
 if(data.ordered&&data.finite){
  let low=0,high=data.values.length-1;
  while(low<high){const middle=(low+high)>>1;if(data.values[middle]<target)low=middle+1;else high=middle;}
  const previous=Math.max(0,low-1),nearest=Math.abs(data.values[low]-target)<Math.abs(data.values[previous]-target)?low:previous;
  if(result.rows[nearest].values[probe]!==undefined)return nearest;
 }
 let closest=0,distance=Infinity;
 for(let index=0;index<data.values.length;index++)if(result.rows[index].values[probe]!==undefined&&Math.abs(data.values[index]-target)<distance){closest=index;distance=Math.abs(data.values[index]-target);}
 return closest;
}

export function radioPlot(result:RadioResult,quadrature=false):Plot {
 const plot=plotSeries([{name:quadrature?'TX Q':'TX I',color:colors[0],points:result.waveform.map(row=>({x:row.t,y:quadrature?(row.txQ??0):row.tx}))},
                        {name:quadrature?'RX Q':'RX I',color:colors[1],points:result.waveform.map(row=>({x:row.t,y:quadrature?(row.q??0):row.rx}))}],'Time / s','Normalized amplitude');
 plot.measurementLabel=`${result.waveform.length} native samples · TX / RX · envelope-preserving display`;
 return plot;
}
export function spectrum(result:RadioResult):Plot {
 const samples=result.waveform.slice(0,512),N=samples.length;
 if(N<3){const plot=plotSeries([],'Frequency / Hz','Windowed power / dB');plot.measurementLabel='At least 3 uniformly timed samples are required';return plot;}
 const step=samples[1].t-samples[0].t;
 const uniform=Number.isFinite(step)&&step>0&&samples.every((row,index)=>Number.isFinite(row.rx)&&Number.isFinite(row.t)&&
  (!index||Math.abs((row.t-samples[index-1].t)-step)<=Math.max(1e-12,step*1e-7)));
 if(!uniform){const plot=plotSeries([],'Frequency / Hz','Windowed power / dB');plot.measurementLabel='Spectrum unavailable: acquisition is not uniformly timed';return plot;}
 const rate=1/step,points:Point[]=[];
 const complex=result.waveform.some(row=>row.q!==undefined);
 for(let column=0;column<(complex?N:Math.floor(N/2)+1);column++){
  const bin=complex?column-Math.floor(N/2):column;
  let real=0,imaginary=0;
  for(let index=0;index<N;index++){
   const window=.5-.5*Math.cos(2*Math.PI*index/(N-1)),angle=2*Math.PI*bin*index/N,value=samples[index].rx*window,q=(samples[index].q??0)*window;
   real+=value*Math.cos(angle)+q*Math.sin(angle);imaginary+=q*Math.cos(angle)-value*Math.sin(angle);
  }
  points.push({x:bin*rate/N,y:10*Math.log10(Math.max(1e-14,(real*real+imaginary*imaginary)/(N*N)))});
 }
 const plot=plotSeries([{name:'RX · Hann DFT',color:colors[0],points}],'Frequency / Hz','Windowed |X/N|² / dB');
 plot.measurementLabel=`First ${N} native samples · Δf ${numberLabel(rate/N)} Hz · 10 log₁₀(|X/N|²), not PSD`;
 return plot;
}
