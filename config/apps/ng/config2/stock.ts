export type PartKind = 'R'|'C'|'L'|'V'|'I'|'S'|'GND'|'POT'|'SPDT'|'VM'|'AM'|'E'|'G';
export type Pin = 'a'|'b'|'w'|'c'|'d';
export interface Terminal {component:string;pin:Pin}
export interface Part {id:string;kind:PartKind;x:number;y:number;rotation:number;value:number;closed?:boolean;initial?:number;phaseDeg?:number;wiper?:number;throw?:'b'|'w'}
export interface Wire {id:string;from:Terminal;to:Terminal}
export interface Drawing {components:Part[];wires:Wire[]}
export interface AnalysisSettings {kind:'dc'|'ac'|'transient';fStart:number;fStop:number;points:number;durationS:number;stepS:number}
export interface RFLinkSettings {frequencyMHz:number;distanceKm:number;txPowerDbm:number;txGainDbi:number;rxGainDbi:number;lossDb:number;bandwidthHz:number;bitRateBps:number;noiseFigureDb:number;requiredEbN0Db:number}
export const DEFAULT_RF_LINK:RFLinkSettings={frequencyMHz:1000,distanceKm:1,txPowerDbm:30,txGainDbi:8,rxGainDbi:8,lossDb:2,bandwidthHz:1e6,bitRateBps:5e5,noiseFigureDb:5,requiredEbN0Db:10};
export const RF_RANGES:Record<keyof RFLinkSettings,[number,number]>={frequencyMHz:[1,1e6],distanceKm:[.001,1e7],txPowerDbm:[-100,100],txGainDbi:[-50,100],rxGainDbi:[-50,100],lossDb:[0,200],bandwidthHz:[1,1e12],bitRateBps:[1,1e12],noiseFigureDb:[0,100],requiredEbN0Db:[-20,60]};
export function validateRFLink(value:unknown):RFLinkSettings {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('RF link budget requires a parameter object');
 const source=value as Record<string,unknown>;
 if(Object.keys(source).length!==Object.keys(RF_RANGES).length||Object.keys(source).some(key=>!(key in RF_RANGES)))throw Error('RF link budget fields do not match the model');
 for(const [key,[minimum,maximum]]of Object.entries(RF_RANGES)){const number=source[key];if(typeof number!=='number'||!Number.isFinite(number)||number<minimum||number>maximum)throw Error(`RF ${key}: ${minimum} … ${maximum}`);}
 return source as unknown as RFLinkSettings;
}
export type SweepAxis='ebN0Db'|'timingOffsetSymbols'|'frequencyOffsetHz';
export interface RadioSweep {axis:SweepAxis;values:number[];secondaryAxis?:SweepAxis;secondaryValues?:number[]}
export interface RadioSettings {bits:string;seed:number;ebN0Db:number;samplesPerSymbol:number;sampleRateHz:number;rf?:RFLinkSettings;crc?:'CRC-8'|'CRC-16';modulation?:'BPSK'|'QPSK'|'BFSK';lineCode?:'NRZ'|'Manchester';timingOffsetSymbols?:number;frequencyOffsetHz?:number;noiseless?:boolean;sweep?:RadioSweep}
export interface Project {schema:'ocv.signals-project/1';name:string;network:Network;drawing:Drawing;analysis:AnalysisSettings;communication:RadioSettings;digital?:DigitalSettings;instruments:{probe:string;cursor:number}}
export const PARTS: {kind:PartKind;label:string;value:number;unit:string}[] = [
 {kind:'R',label:'电阻',value:1000,unit:'Ω'}, {kind:'C',label:'电容',value:1e-6,unit:'F'},
 {kind:'L',label:'电感',value:.01,unit:'H'}, {kind:'V',label:'电压源',value:5,unit:'V'},
 {kind:'I',label:'电流源',value:.001,unit:'A'}, {kind:'S',label:'开关',value:.01,unit:'Ω'},
 {kind:'GND',label:'地',value:0,unit:''},
 {kind:'POT',label:'电位器',value:10000,unit:'Ω'}, {kind:'SPDT',label:'转换开关',value:.01,unit:'Ω'},
 {kind:'VM',label:'电压表',value:1e9,unit:'Ω'}, {kind:'AM',label:'电流表',value:0,unit:'A'},
 {kind:'E',label:'受控电压源',value:10,unit:'V/V'}, {kind:'G',label:'受控电流源',value:.001,unit:'S'}
];
export function clone<T>(value:T):T {return structuredClone(value)}
export function terminalKey(t:Terminal) {return `${t.component}:${t.pin}`}
export function pinsFor(part:Part):Pin[] {
 if(part.kind==='GND')return ['a'];
 if(part.kind==='POT'||part.kind==='SPDT')return ['a','b','w'];
 if(part.kind==='E'||part.kind==='G')return ['a','b','c','d'];
 return ['a','b'];
}
export function endpoint(part:Part,pin:Pin):{x:number;y:number} {
 const local:Record<Pin,[number,number]>={a:[-48,0],b:[48,0],w:[0,48],c:[-24,62],d:[24,62]};
 const [x,y]=part.kind==='GND'?[0,0]:local[pin],angle=part.rotation*Math.PI/180;
 return {x:part.x+x*Math.cos(angle)-y*Math.sin(angle),y:part.y+x*Math.sin(angle)+y*Math.cos(angle)};
}
function checkPart(part:Part):void {
 if(!part||typeof part!=='object'||!PARTS.some(entry=>entry.kind===part.kind)||!/^[-a-zA-Z0-9_]{1,32}$/.test(part.id))throw Error('Invalid component');
 if(![part.x,part.y,part.rotation,part.value].every(Number.isFinite))throw Error('Non-finite component parameter');
 if(Math.abs(part.value)>1e12)throw Error(`${part.id}: value exceeds ±1e12 SI`);
 if(['R','C','L','S','SPDT','POT','VM'].includes(part.kind)&&part.value<1e-18)throw Error(`${part.id}: positive value must be at least 1e-18 SI`);
 if((part.kind==='AM'||part.kind==='GND')&&part.value!==0)throw Error(`${part.id}: ${part.kind} requires value 0`);
 if(part.closed!==undefined&&(part.kind!=='S'||typeof part.closed!=='boolean'))throw Error(`${part.id}: closed applies only to S`);
 if(part.initial!==undefined&&(!['C','L'].includes(part.kind)||!Number.isFinite(part.initial)||Math.abs(part.initial)>1e9))throw Error(`${part.id}: initial applies only to C/L, within ±1e9 SI`);
 if(part.phaseDeg!==undefined&&(!['V','I'].includes(part.kind)||!Number.isFinite(part.phaseDeg)||Math.abs(part.phaseDeg)>360))throw Error(`${part.id}: phase applies only to V/I, within ±360°`);
 if(part.wiper!==undefined&&(part.kind!=='POT'||!Number.isFinite(part.wiper)||part.wiper<.01||part.wiper>.99))throw Error(`${part.id}: POT wiper range is 0.01 … 0.99`);
 if(part.throw!==undefined&&(part.kind!=='SPDT'||!['b','w'].includes(part.throw)))throw Error(`${part.id}: SPDT throw must be b or w`);
 if(part.kind==='POT'){const wiper=part.wiper??.5;if(Math.min(wiper,1-wiper)*part.value<1e-18)throw Error(`${part.id}: both POT resistance segments must be at least 1e-18 Ω`);}
}
export function engineering(value:number):string {
 if(!Number.isFinite(value))return '—';
 const magnitude=Math.abs(value);if(magnitude===0)return '0';
 for(const [scale,prefix] of [[1e9,'G'],[1e6,'M'],[1e3,'k'],[1,''],[1e-3,'m'],[1e-6,'µ'],[1e-9,'n'],[1e-12,'p']] as [number,string][])
  if(magnitude>=scale||scale===1e-12)return `${Number((value/scale).toPrecision(4))}${prefix}`;
 return '0';
}
function wire(id:string,from:string,to:string):Wire {const [f,p]=from.split(':'),[t,q]=to.split(':');return {id,from:{component:f,pin:p as Pin},to:{component:t,pin:q as Pin}}}
export function template(name:string):Drawing {
 if(name==='Potentiometer')return {
  components:[{id:'V1',kind:'V',x:220,y:260,rotation:90,value:5},{id:'P1',kind:'POT',x:470,y:160,rotation:0,value:10000,wiper:.5},{id:'VM1',kind:'VM',x:710,y:270,rotation:90,value:1e9},{id:'G1',kind:'GND',x:220,y:430,rotation:0,value:0}],
  wires:[wire('w1','V1:a','P1:a'),wire('w2','V1:b','G1:a'),wire('w3','P1:b','G1:a'),wire('w4','P1:w','VM1:a'),wire('w5','VM1:b','G1:a')]
 };
 if(name==='VCVS')return {
  components:[{id:'V1',kind:'V',x:180,y:260,rotation:90,value:1},{id:'E1',kind:'E',x:450,y:240,rotation:90,value:10},{id:'AM1',kind:'AM',x:640,y:145,rotation:0,value:0},{id:'R1',kind:'R',x:800,y:260,rotation:90,value:1000},{id:'G1',kind:'GND',x:180,y:430,rotation:0,value:0}],
  wires:[wire('w1','V1:b','G1:a'),wire('w2','V1:a','E1:c'),wire('w3','E1:d','G1:a'),wire('w4','E1:b','G1:a'),wire('w5','E1:a','AM1:a'),wire('w6','AM1:b','R1:a'),wire('w7','R1:b','G1:a')]
 };
 const parts:Part[]=[{id:'V1',kind:'V',x:230,y:260,rotation:90,value:5},{id:'R1',kind:'R',x:450,y:150,rotation:0,value:1000},{id:'G1',kind:'GND',x:230,y:390,rotation:0,value:0}];
 const wires=[wire('w1','V1:a','R1:a'),wire('w2','V1:b','G1:a')];
 if(name==='RC'){parts.push({id:'C1',kind:'C',x:670,y:260,rotation:90,value:1e-6});wires.push(wire('w3','R1:b','C1:a'),wire('w4','C1:b','G1:a'));}
 else if(name==='RL'){parts.push({id:'L1',kind:'L',x:670,y:260,rotation:90,value:.01});wires.push(wire('w3','R1:b','L1:a'),wire('w4','L1:b','G1:a'));}
 else if(name==='RLC'){parts.push({id:'L1',kind:'L',x:635,y:150,rotation:0,value:.01},{id:'C1',kind:'C',x:775,y:260,rotation:90,value:1e-6});wires.push(wire('w3','R1:b','L1:a'),wire('w4','L1:b','C1:a'),wire('w5','C1:b','G1:a'));}
 else {parts.push({id:'R2',kind:'R',x:670,y:260,rotation:90,value:1000});wires.push(wire('w3','R1:b','R2:a'),wire('w4','R2:b','G1:a'));}
 return {components:parts,wires};
}
export function defaultProject():Project {return {schema:'ocv.signals-project/1',name:'Untitled 01',network:networkTemplate(),drawing:template('Divider'),analysis:{kind:'dc',fStart:10,fStop:100000,points:64,durationS:.01,stepS:.000025},communication:{bits:'010011010110001001100101',seed:42,ebN0Db:8,samplesPerSymbol:8,sampleRateHz:8000,crc:'CRC-8',modulation:'BPSK',lineCode:'NRZ',timingOffsetSymbols:0,frequencyOffsetHz:0},digital:digitalTemplate(),instruments:{probe:'out',cursor:0}}}

export function parseProject(text:string):Project {
 if(text.length>524288)throw Error('Project exceeds 512 KiB');
 const raw=JSON.parse(text) as Project;
 if(raw?.schema!=='ocv.signals-project/1'||!raw.drawing||!Array.isArray(raw.drawing.components)||!Array.isArray(raw.drawing.wires))throw Error('Unsupported project format');
 if(raw.drawing.components.length>64||raw.drawing.wires.length>256)throw Error('Editor limit: 64 components / 256 wires');
 const ids=new Set<string>(),byId=new Map<string,Part>();
 for(const part of raw.drawing.components){
  checkPart(part);if(ids.has(part.id))throw Error('Duplicate component ID');
  if(part.x<0||part.x>1100||part.y<0||part.y>560)throw Error('Component outside drawing bounds');ids.add(part.id);byId.set(part.id,part);
 }
 const wireIds=new Set<string>();
 for(const w of raw.drawing.wires){
  if(!w||!/^[-a-zA-Z0-9_]{1,32}$/.test(w.id)||wireIds.has(w.id))throw Error('Invalid or duplicate wire ID');wireIds.add(w.id);
  for(const terminal of [w.from,w.to]){const part=terminal&&byId.get(terminal.component);if(!part||!pinsFor(part).includes(terminal.pin))throw Error('Dangling wire or invalid component terminal');}
 }
 const base=defaultProject();
 if(raw.communication?.rf!==undefined)validateRFLink(raw.communication.rf);
 const network=raw.network||base.network;
 if(!Array.isArray(network.nodes)||!Array.isArray(network.links)||!Array.isArray(network.flows)||network.nodes.length>64||network.links.length>128||network.flows.length>16)throw Error('Invalid network workspace');
 const networkIds=new Set<string>();
 for(const node of network.nodes){if(!/^[-a-zA-Z0-9_]{1,32}$/.test(node.id)||networkIds.has(node.id)||!['router','satellite','base','ue','switch','host'].includes(node.type)||![node.x,node.y].every(Number.isFinite))throw Error('Invalid network node');networkIds.add(node.id)}
 for(const link of network.links){if(!/^[-a-zA-Z0-9_]{1,32}$/.test(link.id)||!networkIds.has(link.a)||!networkIds.has(link.b)||![link.rateMbps,link.delayMs,link.loss].every(Number.isFinite)||link.rateMbps<=0||link.delayMs<0||link.loss<0||link.loss>1||typeof link.enabled!=='boolean')throw Error('Invalid network link')}
 let packets=0;for(const flow of network.flows){if(!/^[-a-zA-Z0-9_]{1,32}$/.test(flow.id)||!networkIds.has(flow.source)||!networkIds.has(flow.target)||![flow.packets,flow.bytes,flow.startMs,flow.intervalMs].every(Number.isFinite)||flow.packets<1||flow.bytes<1||flow.startMs<0||flow.intervalMs<0)throw Error('Invalid traffic flow');packets+=flow.packets}if(packets>512)throw Error('512-packet simulation limit');
 if(!Number.isFinite(network.seed)||!Number.isFinite(network.durationMs)||network.durationMs<=0)throw Error('Invalid simulation horizon');
 const digital=validateDigital(raw.digital||base.digital!);
 return {...base,...raw,network,digital,name:String(raw.name||'Untitled').slice(0,80),analysis:{...base.analysis,...raw.analysis},communication:{...base.communication,...raw.communication},instruments:{...base.instruments,...raw.instruments}};
}

export interface CircuitRequest {schema:'ocv.signals/1';op:'circuit';ground:'0';components:{id:string;type:string;a:string;b:string;value:number;closed?:boolean;initial?:number;phaseDeg?:number;controlA?:string;controlB?:string}[];analysis:Record<string,unknown>;probeNodes:string[]}
export function netlist(project:Project):{request:CircuitRequest;nodes:Map<string,string>} {
 const links=new Map<string,string>();
 const find=(key:string):string=>{const parent=links.get(key);if(!parent){links.set(key,key);return key;}if(parent===key)return key;const root=find(parent);links.set(key,root);return root;};
 const join=(a:string,b:string)=>{const x=find(a),y=find(b);if(x!==y)links.set(x,y)};
 const byId=new Map<string,Part>();
 for(const p of project.drawing.components){checkPart(p);if(byId.has(p.id))throw Error('Duplicate component ID');byId.set(p.id,p);for(const pin of pinsFor(p))find(`${p.id}:${pin}`)}
 for(const w of project.drawing.wires){for(const terminal of [w.from,w.to]){const part=byId.get(terminal.component);if(!part||!pinsFor(part).includes(terminal.pin))throw Error('Dangling wire or invalid component terminal');}join(terminalKey(w.from),terminalKey(w.to));}
 const grounds=project.drawing.components.filter(p=>p.kind==='GND');
 if(!grounds.length)throw Error('GROUND_REQUIRED: add a ground terminal');
 for(const g of grounds)join(`${g.id}:a`,`${grounds[0].id}:a`);
 const roots=new Map<string,string>();roots.set(find(`${grounds[0].id}:a`),'0');
 const candidates:Terminal[]=[];
 const resistor=project.drawing.components.find(p=>p.id==='R1');if(resistor)candidates.push({component:resistor.id,pin:'b'});
 for(const p of project.drawing.components){if(p.kind==='POT')candidates.push({component:p.id,pin:'w'});if(p.kind==='E'||p.kind==='G'||p.kind==='VM')candidates.push({component:p.id,pin:'a'});}
 const groundRoot=find(`${grounds[0].id}:a`),output=candidates.find(terminal=>find(terminalKey(terminal))!==groundRoot);
 if(output)roots.set(find(terminalKey(output)),'out');
 const names=new Map<string,string>();let number=1;
 for(const p of project.drawing.components)for(const pin of pinsFor(p)){const key=`${p.id}:${pin}`,root=find(key);if(!roots.has(root))roots.set(root,`n${number++}`);names.set(key,roots.get(root)!)}
 if(roots.size>129)throw Error('Native circuit limit: 128 non-ground nodes');
 const settings=project.analysis;
 const analysis:Record<string,unknown>={kind:settings.kind};
 if(settings.kind==='ac'){
  if(!(settings.fStart>0&&settings.fStop>=settings.fStart))throw Error('Frequency range must be positive and ordered');
  const n=Math.max(2,Math.min(128,Math.round(settings.points)));
  analysis['frequenciesHz']=Array.from({length:n},(_,i)=>settings.fStart*Math.pow(settings.fStop/settings.fStart,i/(n-1)));
 } else if(settings.kind==='transient') {analysis['stepS']=settings.stepS;analysis['durationS']=settings.durationS;analysis['method']='backward-euler';}
 const components:CircuitRequest['components']=[],expandedIds=new Set<string>();
 function add(component:CircuitRequest['components'][number]){if(expandedIds.has(component.id))throw Error(`Expanded component ID collision: ${component.id}`);expandedIds.add(component.id);components.push(component)}
 for(const part of project.drawing.components){
  if(part.kind==='GND')continue;const node=(pin:Pin)=>names.get(`${part.id}:${pin}`)!;
  const common={id:part.id,a:node('a'),b:node('b'),value:part.value};
  if(part.kind==='POT'){
   const ratio=part.wiper??.5;
   add({id:`${part.id}_a`,type:'R',a:node('a'),b:node('w'),value:part.value*ratio});
   add({id:`${part.id}_b`,type:'R',a:node('w'),b:node('b'),value:part.value*(1-ratio)});
  }else if(part.kind==='SPDT'){
   const selected=part.throw??'b';
   add({id:`${part.id}_b`,type:'S',a:node('a'),b:node('b'),value:part.value,closed:selected==='b'});
   add({id:`${part.id}_w`,type:'S',a:node('a'),b:node('w'),value:part.value,closed:selected==='w'});
  }else if(part.kind==='VM')add({...common,type:'R'});
  else if(part.kind==='AM')add({...common,type:'V',value:0});
  else if(part.kind==='E'||part.kind==='G')add({...common,type:part.kind,controlA:node('c'),controlB:node('d')});
  else add({...common,type:part.kind,...(part.kind==='S'?{closed:part.closed??false}:{}),...(['C','L'].includes(part.kind)&&part.initial!==undefined?{initial:part.initial}:{}),...(['V','I'].includes(part.kind)&&part.phaseDeg!==undefined?{phaseDeg:part.phaseDeg}:{})});
 }
 return {request:{schema:'ocv.signals/1',op:'circuit',ground:'0',components,analysis,probeNodes:[project.instruments.probe]},nodes:names};
}
import {Network,networkTemplate} from './packet';
import {DigitalSettings,digitalTemplate,validateDigital} from './clock2';
