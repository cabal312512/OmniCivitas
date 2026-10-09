import {createHash} from 'node:crypto';

export const hashInvoice=(s:string)=>createHash('sha256').update(s).digest('hex');
export const identifier=/^(?:0|[A-Za-z][A-Za-z0-9_-]{0,31})$/;
export const hexTicket=/^[a-f0-9]{64}$/;
export const uuidInvoice=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function objectInvoice(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Object required');return v as Record<string,unknown>;}
export function keysInvoice(o:Record<string,unknown>,allowed:string[]){if(Object.keys(o).some(k=>!allowed.includes(k)))throw Error('Unknown field');}
export function finiteInvoice(v:unknown,lo:number,hi:number){if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw Error('Number out of range');return v;}
export function nodeInvoice(v:unknown){if(typeof v!=='string'||!identifier.test(v))throw Error('Invalid node or component identifier');return v;}
export function componentInvoice(v:unknown){if(typeof v!=='string'||!/^(?:0|[A-Za-z][A-Za-z0-9_-]{0,33})$/.test(v))throw Error('Invalid native component identifier');return v;}
export function radioInvoice(value:unknown){
 const p=objectInvoice(value),limits:Record<string,[number,number]>={frequencyMHz:[1,1e6],distanceKm:[.001,1e7],txPowerDbm:[-100,100],txGainDbi:[-50,100],rxGainDbi:[-50,100],lossDb:[0,200],bandwidthHz:[1,1e12],bitRateBps:[1,1e12],noiseFigureDb:[0,100],requiredEbN0Db:[-20,60]};
 keysInvoice(p,Object.keys(limits));for(const[k,[minimum,maximum]]of Object.entries(limits))finiteInvoice(p[k],minimum,maximum);return p;
}
function depthInvoice(v:unknown,depth=0){if(depth>12)throw Error('Object too deep');if(Array.isArray(v)){if(v.length>2048)throw Error('Array too large');v.forEach(x=>depthInvoice(x,depth+1));}else if(v&&typeof v==='object'){if(Object.keys(v).length>128)throw Error('Too many fields');for(const[k,x]of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k)||/password|email|phone|token|secret/i.test(k))throw Error('Account fields are not accepted');depthInvoice(x,depth+1);}}else if(typeof v==='number'&&!Number.isFinite(v))throw Error('Finite values required');else if(typeof v==='string'&&v.length>4096)throw Error('String too long');}
export function communicationsInvoice(p:Record<string,unknown>){
 keysInvoice(p,['schema','op','bits','seed','ebN0Db','samplesPerSymbol','sampleRateHz','crc','modulation','lineCode','noiseless','rf','timingOffsetSymbols','frequencyOffsetHz','sweep']);
 if(typeof p.bits!=='string'||!/^[01]{1,4096}$/.test(p.bits))throw Error('Bits must be 1–4096 binary digits');
 const crc=String(p.crc??'CRC-8'),modulation=String(p.modulation??'BPSK'),line=String(p.lineCode??'NRZ');
 if(!['CRC-8','CRC-16'].includes(crc)||!['BPSK','QPSK','BFSK'].includes(modulation)||!['NRZ','Manchester'].includes(line))throw Error('Unsupported coding or modulation');
 const samples=finiteInvoice(p.samplesPerSymbol,modulation==='BFSK'?4:2,32),rate=finiteInvoice(p.sampleRateHz,1,1e9);
 if(!Number.isInteger(samples)||!Number.isInteger(p.seed))throw Error('Integer seed and oversampling required');finiteInvoice(p.seed,0,4294967295);finiteInvoice(p.ebN0Db,-30,60);
 if(p.noiseless!==undefined&&typeof p.noiseless!=='boolean')throw Error('Invalid channel setting');
 finiteInvoice(p.timingOffsetSymbols??0,-.45,.45);finiteInvoice(p.frequencyOffsetHz??0,-rate/samples*.25,rate/samples*.25);
 const chips=(p.bits.length+(crc==='CRC-16'?16:8))*(line==='Manchester'?2:1),count=Math.ceil(chips/(modulation==='QPSK'?2:1))*samples;
 if(count>32768)throw Error('Complex waveform limit');if(p.rf!==undefined)radioInvoice(p.rf);
 if(p.sweep!==undefined){const s=objectInvoice(p.sweep);keysInvoice(s,['axis','values','secondaryAxis','secondaryValues']);const axes=['ebN0Db','timingOffsetSymbols','frequencyOffsetHz'];
  function series(axis:unknown,values:unknown){if(!axes.includes(String(axis))||!Array.isArray(values)||values.length<1||values.length>7)throw Error('Invalid scan axis');const bounds:Record<string,[number,number]>={ebN0Db:[-30,60],timingOffsetSymbols:[-.45,.45],frequencyOffsetHz:[-rate/samples*.25,rate/samples*.25]};const [lo,hi]=bounds[String(axis)];values.forEach((v,i)=>{finiteInvoice(v,lo,hi);if(i&&Number(v)<=Number(values[i-1]))throw Error('Scan values must be strictly increasing');});}
  series(s.axis,s.values);if(s.secondaryAxis!==undefined){if(s.axis===s.secondaryAxis)throw Error('Scan axes must differ');series(s.secondaryAxis,s.secondaryValues);}else if(s.secondaryValues!==undefined)throw Error('Missing secondary axis');if(count>8192)throw Error('Scan waveform limit');
 }return p;
}
export function digitalInvoice(p:Record<string,unknown>){
 keysInvoice(p,['schema','op','gates','inputs','patterns','ticks','clockPeriodTicks','tickS']);const inputs=objectInvoice(p.inputs),names=new Set<string>(['clock']);
 const wire=(v:unknown)=>{if(typeof v!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,95}$/.test(v)||['__proto__','constructor','prototype'].includes(v))throw Error('Invalid wire');return v;};
 if(Object.keys(inputs).length>64)throw Error('Input wire limit');for(const[k,v]of Object.entries(inputs)){if(names.has(wire(k))||typeof v!=='boolean')throw Error('Invalid source');names.add(k);}
 if(!Array.isArray(p.gates)||p.gates.length>128)throw Error('Gate limit');const gates=p.gates.map(item=>{const g=objectInvoice(item);keysInvoice(g,['id','type','inputs','initial']);const id=wire(g.id),type=String(g.type);if(names.has(id))throw Error('Duplicate wire');names.add(id);if(!['AND','NAND','OR','NOR','XOR','NOT','BUFFER','DFF','JKFF'].includes(type)||!Array.isArray(g.inputs)||g.inputs.length<1||g.inputs.length>8)throw Error('Invalid gate');g.inputs.forEach(wire);if(['NOT','BUFFER','DFF'].includes(type)&&g.inputs.length!==1||type==='JKFF'&&g.inputs.length!==2)throw Error('Gate pin count');if(g.initial!==undefined&&(typeof g.initial!=='boolean'||!['DFF','JKFF'].includes(type)))throw Error('Invalid register initial state');return g;});
 for(const g of gates)for(const n of g.inputs as string[])if(!names.has(n))throw Error('Unknown wire');
 const known=new Set<string>(['clock',...Object.keys(inputs),...gates.filter(g=>['DFF','JKFF'].includes(String(g.type))).map(g=>String(g.id))]);let pending=gates.filter(g=>!['DFF','JKFF'].includes(String(g.type)));while(pending.length){const ready=pending.filter(g=>(g.inputs as string[]).every(n=>known.has(n)));if(!ready.length)throw Error('Combinational cycle');ready.forEach(g=>known.add(String(g.id)));pending=pending.filter(g=>!known.has(String(g.id)));}
 const ticks=finiteInvoice(p.ticks??32,1,4096),period=finiteInvoice(p.clockPeriodTicks??8,2,4096);if(!Number.isInteger(ticks)||!Number.isInteger(period)||names.size*ticks>32768)throw Error('Digital trace limit');finiteInvoice(p.tickS??.001,1e-9,1);
 if(p.patterns!==undefined){const patterns=objectInvoice(p.patterns);for(const[k,v]of Object.entries(patterns))if(!Object.prototype.hasOwnProperty.call(inputs,k)||typeof v!=='string'||!/^[01]{1,4096}$/.test(v))throw Error('Invalid input pattern');}return p;
}
export function canonicalInvoice(v:unknown):string {if(Array.isArray(v))return '['+v.map(canonicalInvoice).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonicalInvoice((v as Record<string,unknown>)[k])).join(',')+'}';return JSON.stringify(v);}
export function validateEngineRequest(value:unknown){
 const p=objectInvoice(value);depthInvoice(p);if(Buffer.byteLength(JSON.stringify(p))>65536)throw Error('Request exceeds 64 KiB');
 if(p.schema!=='ocv.signals/1')throw Error('Unsupported engine schema');
 if(!['circuit','communications','network','digital'].includes(String(p.op)))throw Error('Unsupported laboratory operation');
 if(p.op==='circuit'||p.op==='topology'){
  keysInvoice(p,['schema','op','analysis','components','ground','probeNodes']);
  if(p.ground!=='0')throw Error('Ground must be node 0');
  if(!Array.isArray(p.components)||p.components.length<1||p.components.length>128)throw Error('Component count out of range');
  const seen=new Set<string>();for(const item of p.components){const c=objectInvoice(item);keysInvoice(c,['id','type','a','b','value','phaseDeg','initial','closed','controlA','controlB']);const id=componentInvoice(c.id);if(seen.has(id))throw Error('Duplicate component');seen.add(id);nodeInvoice(c.a);nodeInvoice(c.b);if(!['R','C','L','V','I','S','E','G'].includes(String(c.type)))throw Error('Unsupported component');finiteInvoice(c.value,-1e12,1e12);if(c.type==='E'||c.type==='G'){nodeInvoice(c.controlA);nodeInvoice(c.controlB);}else if(c.controlA!==undefined||c.controlB!==undefined)throw Error('Control terminals require a controlled source');if(c.phaseDeg!==undefined)finiteInvoice(c.phaseDeg,-36000,36000);if(c.initial!==undefined)finiteInvoice(c.initial,-1e9,1e9);if(c.closed!==undefined&&typeof c.closed!=='boolean')throw Error('Switch state must be boolean');}
  if(p.probeNodes!==undefined){if(!Array.isArray(p.probeNodes)||p.probeNodes.length>16)throw Error('Invalid probes');p.probeNodes.forEach(nodeInvoice);}
  if(p.op==='circuit'){const a=objectInvoice(p.analysis);keysInvoice(a,['kind','frequencyHz','frequenciesHz','stepS','durationS','method']);if(!['dc','ac','transient'].includes(String(a.kind)))throw Error('Unsupported analysis');if(a.kind==='ac'){if(a.frequenciesHz!==undefined){if(!Array.isArray(a.frequenciesHz)||a.frequenciesHz.length<1||a.frequenciesHz.length>128)throw Error('Frequency count');a.frequenciesHz.forEach(x=>finiteInvoice(x,1e-6,1e12));}else finiteInvoice(a.frequencyHz,1e-6,1e12);}if(a.kind==='transient'){const step=finiteInvoice(a.stepS,1e-9,1e6),duration=finiteInvoice(a.durationS,step,1e6);if(Math.ceil(duration/step)>262143)throw Error('Sample count exceeds limit');if(a.method!==undefined&&a.method!=='backward-euler')throw Error('Unsupported integration method');}}
 }else if(p.op==='communications'){
  communicationsInvoice(p);
 }else if(p.op==='network'){
  keysInvoice(p,['schema','op','nodes','links','flows','seed','durationMs']);finiteInvoice(p.seed,0,4294967295);if(!Number.isInteger(p.seed))throw Error('Integer seed required');finiteInvoice(p.durationMs,1,100000);
  if(!Array.isArray(p.nodes)||p.nodes.length<2||p.nodes.length>64||!Array.isArray(p.links)||p.links.length>128||!Array.isArray(p.flows)||p.flows.length<1||p.flows.length>16)throw Error('Network size out of range');
  const nodes=new Set<string>();for(const item of p.nodes){const n=objectInvoice(item);keysInvoice(n,['id','type','x','y']);const id=nodeInvoice(n.id);if(nodes.has(id))throw Error('Duplicate node');nodes.add(id);if(!['router','satellite','base','ue','switch','host'].includes(String(n.type)))throw Error('Unknown network device');finiteInvoice(n.x,-10000,10000);finiteInvoice(n.y,-10000,10000);}
  const links=new Set<string>();for(const item of p.links){const l=objectInvoice(item);keysInvoice(l,['id','a','b','rateMbps','delayMs','loss','enabled']);const id=nodeInvoice(l.id);if(links.has(id)||l.a===l.b||!nodes.has(nodeInvoice(l.a))||!nodes.has(nodeInvoice(l.b)))throw Error('Invalid link');links.add(id);finiteInvoice(l.rateMbps,.001,100000);finiteInvoice(l.delayMs,0,100000);finiteInvoice(l.loss,0,1);if(typeof l.enabled!=='boolean')throw Error('Link enabled must be boolean');}
  let packets=0;const flows=new Set<string>();for(const item of p.flows){const f=objectInvoice(item);keysInvoice(f,['id','source','target','packets','bytes','startMs','intervalMs']);const id=nodeInvoice(f.id);if(flows.has(id)||!nodes.has(nodeInvoice(f.source))||!nodes.has(nodeInvoice(f.target))||f.source===f.target)throw Error('Invalid flow');flows.add(id);finiteInvoice(f.packets,1,512);finiteInvoice(f.bytes,1,65536);if(!Number.isInteger(f.packets)||!Number.isInteger(f.bytes))throw Error('Packets and bytes must be integers');finiteInvoice(f.startMs,0,Number(p.durationMs));finiteInvoice(f.intervalMs,0,100000);packets+=Number(f.packets);}if(packets>512)throw Error('Packet limit');
 }else if(p.op==='digital'){digitalInvoice(p);}else throw Error('Unsupported operation');
 return p;
}
export function validateProject(value:unknown){
 const p=objectInvoice(value);depthInvoice(p);keysInvoice(p,['schema','name','drawing','analysis','communication','instruments','network','digital']);if(p.schema!=='ocv.signals-project/1')throw Error('Unsupported project schema');
 const drawing=objectInvoice(p.drawing);keysInvoice(drawing,['components','wires']);if(!Array.isArray(drawing.components)||drawing.components.length>512||!Array.isArray(drawing.wires)||drawing.wires.length>1024)throw Error('Invalid schematic');
 const name=String(p.name??p.title??'Untitled').trim();if(!name||name.length>80||/[\x00-\x1f]/.test(name))throw Error('Invalid project name');
 const ids=new Set<string>(),pins=new Map<string,string[]>();for(const item of drawing.components){const c=objectInvoice(item);keysInvoice(c,['id','kind','x','y','rotation','value','closed','phaseDeg','initial','wiper','throw']);const id=nodeInvoice(c.id);if(ids.has(id))throw Error('Duplicate component');ids.add(id);if(!['R','C','L','V','I','S','GND','POT','SPDT','VM','AM','E','G'].includes(String(c.kind)))throw Error('Unsupported component');finiteInvoice(c.x,-10000,10000);finiteInvoice(c.y,-10000,10000);finiteInvoice(c.value,-1e12,1e12);if(![0,90,180,270].includes(Number(c.rotation)))throw Error('Invalid rotation');if(c.phaseDeg!==undefined)finiteInvoice(c.phaseDeg,-36000,36000);if(c.initial!==undefined)finiteInvoice(c.initial,-1e9,1e9);if(c.closed!==undefined&&typeof c.closed!=='boolean')throw Error('Switch state must be boolean');if(c.wiper!==undefined){if(c.kind!=='POT')throw Error('Wiper requires a potentiometer');finiteInvoice(c.wiper,.01,.99);}if(c.throw!==undefined&&(c.kind!=='SPDT'||!['b','w'].includes(String(c.throw))))throw Error('Invalid switch throw');pins.set(id,c.kind==='GND'?['a']:['POT','SPDT'].includes(String(c.kind))?['a','b','w']:['E','G'].includes(String(c.kind))?['a','b','c','d']:['a','b']);}
 for(const item of drawing.wires){const w=objectInvoice(item);keysInvoice(w,['id','from','to']);nodeInvoice(w.id);for(const endpoint of [w.from,w.to]){const e=objectInvoice(endpoint);keysInvoice(e,['component','pin']);if(!ids.has(nodeInvoice(e.component))||!pins.get(String(e.component))?.includes(String(e.pin)))throw Error('Wire endpoint missing');}}
 if(p.network!==undefined){const n=objectInvoice(p.network);keysInvoice(n,['nodes','links','flows','seed','durationMs']);validateEngineRequest({...n,schema:'ocv.signals/1',op:'network'});}
 if(p.communication!==undefined){const radio=objectInvoice(p.communication);communicationsInvoice({...radio,schema:'ocv.signals/1',op:'communications'});}
 if(p.digital!==undefined)digitalInvoice({...objectInvoice(p.digital),schema:'ocv.signals/1',op:'digital'});
 const text=canonicalInvoice(p);if(Buffer.byteLength(text)>65536)throw Error('Project exceeds 64 KiB');return {project:p,name,text,digest:hashInvoice(text)};
}
