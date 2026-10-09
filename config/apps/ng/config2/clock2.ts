export type GateKind='AND'|'NAND'|'OR'|'NOR'|'XOR'|'NOT'|'BUFFER'|'DFF'|'JKFF';
export interface Gate {id:string;type:GateKind;inputs:string[];initial?:boolean}
export interface DigitalSettings {inputs:Record<string,boolean>;patterns:Record<string,string>;gates:Gate[];ticks:number;clockPeriodTicks:number;tickS:number}
export const GATE_KINDS:GateKind[]=['AND','NAND','OR','NOR','XOR','NOT','BUFFER','DFF','JKFF'];
export function digitalTemplate(name='Shift register'):DigitalSettings {
 const common={ticks:64,clockPeriodTicks:8,tickS:.001};
 if(name==='JK counter')return {...common,inputs:{one:true},patterns:{},gates:[{id:'q0',type:'JKFF',inputs:['one','one'],initial:false},{id:'q1',type:'JKFF',inputs:['q0','q0'],initial:false},{id:'q2',type:'JKFF',inputs:['carry','carry'],initial:false},{id:'carry',type:'AND',inputs:['q0','q1']}]};
 if(name==='Parity latch')return {...common,inputs:{a:false,b:false},patterns:{a:'00001111',b:'00110011'},gates:[{id:'parity',type:'XOR',inputs:['a','b']},{id:'q',type:'DFF',inputs:['parity'],initial:false},{id:'alarm',type:'AND',inputs:['q','clock']}]};
 return {...common,inputs:{d:false},patterns:{d:'00001111111100000000111100000000'},gates:[{id:'q0',type:'DFF',inputs:['d'],initial:false},{id:'q1',type:'DFF',inputs:['q0'],initial:false},{id:'q2',type:'DFF',inputs:['q1'],initial:false},{id:'edge',type:'XOR',inputs:['q1','q2']}]};
}
export function validateDigital(value:DigitalSettings):DigitalSettings {
 if(!value||typeof value!=='object'||!value.inputs||typeof value.inputs!=='object'||Array.isArray(value.inputs)||!Array.isArray(value.gates))throw Error('Invalid digital model');
 const sources=Object.entries(value.inputs),ids=new Set<string>(['clock']),id=/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/;
 if(sources.length>64||value.gates.length>128)throw Error('Digital limit: 64 inputs / 128 gates');
 for(const [name,initial]of sources){if(!id.test(name)||ids.has(name)||typeof initial!=='boolean')throw Error('Invalid digital input');ids.add(name)}
 for(const gate of value.gates){if(!id.test(gate.id)||ids.has(gate.id)||!GATE_KINDS.includes(gate.type)||!Array.isArray(gate.inputs)||gate.inputs.length<1||gate.inputs.length>8||['NOT','BUFFER','DFF'].includes(gate.type)&&gate.inputs.length!==1||gate.type==='JKFF'&&gate.inputs.length!==2||gate.initial!==undefined&&typeof gate.initial!=='boolean')throw Error('Invalid digital gate');ids.add(gate.id)}
 for(const gate of value.gates)if(gate.inputs.some(input=>typeof input!=='string'||!ids.has(input)))throw Error(`${gate.id}: unknown wire`);
 if(!Number.isInteger(value.ticks)||value.ticks<1||value.ticks>4096||!Number.isInteger(value.clockPeriodTicks)||value.clockPeriodTicks<2||value.clockPeriodTicks>4096||!Number.isFinite(value.tickS)||value.tickS<1e-9||value.tickS>1||ids.size*value.ticks>32768)throw Error('Digital acquisition limits exceeded');
 for(const [name,pattern]of Object.entries(value.patterns||{}))if(!Object.hasOwn(value.inputs,name)||typeof pattern!=='string'||!(/^[01]{1,4096}$/).test(pattern))throw Error('Invalid cyclic input pattern');
 return value;
}
export function digitalLayout(settings:DigitalSettings){
 const inputs=['clock',...Object.keys(settings.inputs)],gates=settings.gates;
 const depth=new Map<string,number>(inputs.map(name=>[name,0]));for(const gate of gates)if(['DFF','JKFF'].includes(gate.type))depth.set(gate.id,1);
 for(let pass=0;pass<gates.length+1;pass++)for(const gate of gates)if(!depth.has(gate.id)&&gate.inputs.every(input=>depth.has(input)))depth.set(gate.id,Math.min(4,1+Math.max(...gate.inputs.map(input=>depth.get(input)!))));
 const columns=new Map<number,number>();
 const nodes=[...inputs.map(id=>({id,type:'INPUT',inputs:[] as string[]})),...gates].map(gate=>{const column=depth.get(gate.id)??4,row=columns.get(column)||0;columns.set(column,row+1);return {...gate,x:58+column*155,y:43+row*69}});
 const byId=new Map(nodes.map(node=>[node.id,node]));const connections=nodes.flatMap(node=>[...node.inputs,...(['DFF','JKFF'].includes(node.type)?['clock']:[])].flatMap((wire,index)=>{const from=byId.get(wire);if(!from)return [];const a=from.x+34,b=node.x-34,y=node.y+(index-(node.inputs.length-1)/2)*11;return [{id:`${node.id}:${index}`,wire,clock:wire==='clock',path:`M${a} ${from.y} H${(a+b)/2} V${y} H${b}`}]}));
 return {nodes,connections,height:Math.max(250,60+Math.max(...nodes.map(node=>node.y),0))};
}
