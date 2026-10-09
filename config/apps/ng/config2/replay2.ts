import type {DigitalResult,RadioResult} from './transport';
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid replay metadata');return value as Record<string,unknown>}
function canonical(value:unknown):string{if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical((value as Record<string,unknown>)[key])).join(',')+'}';return JSON.stringify(value)}
function close(actual:unknown,expected:number):boolean{return typeof actual==='number'&&Number.isFinite(actual)&&Math.abs(actual-expected)<=1e-12+Math.abs(expected)*1e-9}
function channelRequest(value:Record<string,unknown>):Record<string,unknown>{return {...value,crc:value['crc']??'CRC-8',modulation:value['modulation']??'BPSK',lineCode:value['lineCode']??'NRZ',timingOffsetSymbols:value['timingOffsetSymbols']??0,frequencyOffsetHz:value['frequencyOffsetHz']??0,noiseless:value['noiseless']??false}}
function radioMetadata(summary:Record<string,unknown>,request:Record<string,unknown>){
 for(const key of ['seed','samplesPerSymbol','sampleRateHz','ebN0Db','crc','modulation','noiseless'])if(summary[key]!==request[key])throw Error(`Replay channel ${key} differs from the request`);
 for(const key of ['lineCode','timingOffsetSymbols','frequencyOffsetHz'])if((summary[key]??(key==='lineCode'?'NRZ':0))!==request[key])throw Error(`Replay channel ${key} differs from the request`);
 const sigma=request['noiseless']?0:Math.sqrt(.5/10**(Number(request['ebN0Db'])/10));
 if(summary['sigma']!==undefined&&!close(summary['sigma'],sigma))throw Error('Replay noise metadata differs from the request');
}
function checksum(bits:string,width:number):number{let crc=width===16?65535:0;for(const bit of bits){const high=((crc>>(width-1))&1)^Number(bit);crc=(crc<<1)&(width===16?65535:255);if(high)crc^=width===16?0x1021:7}return crc}
// These are record consistency checks, not a new native execution or an integrity certificate.
export function replayRecord(value:unknown,kind:'digital'|'communications',expectedRequest:Record<string,unknown>):DigitalResult|RadioResult {
 const record=object(value),saved=object(record['request']);
 if(record['schema']!=='ocv.signals-replay/1'||record['kind']!==kind||saved['schema']!=='ocv.signals/1'||saved['op']!==kind)throw Error('Replay request kind differs from the record');
 const expected=kind==='communications'?channelRequest(expectedRequest):{...expectedRequest,patterns:expectedRequest['patterns']??{},ticks:expectedRequest['ticks']??32,clockPeriodTicks:expectedRequest['clockPeriodTicks']??8,tickS:expectedRequest['tickS']??.001};
 const request=kind==='communications'?channelRequest(saved):{...saved,patterns:saved['patterns']??{},ticks:saved['ticks']??32,clockPeriodTicks:saved['clockPeriodTicks']??8,tickS:saved['tickS']??.001};
 if(canonical(request)!==canonical(expected))throw Error('Replay request differs from the editable project');
 const result=replayResult(kind,record['result']),raw=object(result),summary=object(result.summary);
 if(record['modelVersion']!==result.version||canonical(object(record['sampling']))!==canonical(summary))throw Error('Replay model version or sampling differs from the result');
 const units=kind==='digital'?{time:'s',wire:'boolean'}:{time:'s',amplitude:'normalized',frequency:'Hz'};
 if(canonical(object(record['units']))!==canonical(units))throw Error('Replay units differ from the model');
 if(kind==='digital'){
  if('waveform'in raw||'rows'in raw||'routes'in raw)throw Error('Replay result kind differs from the request');
  const digital=result as DigitalResult,inputs=object(request['inputs']),patterns=object(request['patterns']),gates=request['gates'] as {id:string;type:string;initial?:boolean}[],ticks=Number(request['ticks']),period=Number(request['clockPeriodTicks']),dt=Number(request['tickS']);
  const names=['clock',...Object.keys(inputs),...gates.map(gate=>gate.id)].sort();
  if(canonical([...digital.wires].sort())!==canonical(names)||digital.trace.length!==ticks||summary['ticks']!==ticks||summary['clockPeriodTicks']!==period||!close(summary['tickS'],dt)||summary['durationS']!==undefined&&!close(summary['durationS'],ticks*dt))throw Error('Replay digital acquisition differs from the request');
  for(const row of digital.trace){
   if(!close(row.t,row.tick*dt)||row.values['clock']!==(row.tick%period>=Math.floor(period/2)))throw Error('Replay digital timing differs from the request');
   for(const [wire,initial]of Object.entries(inputs)){const pattern=patterns[wire] as string|undefined,wanted=pattern?pattern[row.tick%pattern.length]==='1':initial;if(row.values[wire]!==wanted)throw Error('Replay digital input differs from the request')}
  }
  for(const gate of gates)if(['DFF','JKFF'].includes(gate.type)&&digital.trace[0].values[gate.id]!==!!gate.initial)throw Error('Replay register initial state differs from the request');
  return digital;
 }
 if('trace'in raw||'events'in raw||'rows'in raw||'routes'in raw)throw Error('Replay result kind differs from the request');
 const radio=result as RadioResult,bits=request['bits'] as string,width=request['crc']==='CRC-16'?16:8,sps=Number(request['samplesPerSymbol']),rate=Number(request['sampleRateHz']),code=request['lineCode']==='Manchester'?2:1,symbols=Math.ceil((bits.length+width)*code/(request['modulation']==='QPSK'?2:1)),frame=bits+checksum(bits,width).toString(2).padStart(width,'0');
 radioMetadata(summary,request);
 if(radio.payloadBits!==bits||radio.txBits!==frame||radio.payloadLength!==bits.length||radio.frameLength!==frame.length||typeof radio.rxBits!=='string'||!/^[01]+$/.test(radio.rxBits)||radio.rxBits.length!==frame.length||radio.decodedBits!==radio.rxBits.slice(0,bits.length))throw Error('Replay frame differs from the request');
 const errors=[...bits].filter((bit,index)=>bit!==radio.decodedBits[index]).length,frameErrors=[...frame].filter((bit,index)=>bit!==radio.rxBits[index]).length,valid=checksum(radio.decodedBits,width)===parseInt(radio.rxBits.slice(bits.length),2);
 if(radio.bitErrors!==errors||radio.frameBitErrors!==frameErrors||!close(radio.ber,errors/bits.length)||radio.crcValid!==valid)throw Error('Replay error counts differ from the received frame');
 if(radio.waveform.length!==symbols*sps||radio.constellation.length!==symbols||summary['symbolRateHz']!==undefined&&!close(summary['symbolRateHz'],rate/sps)||summary['durationS']!==undefined&&!close(summary['durationS'],symbols*sps/rate)||summary['symbols']!==undefined&&summary['symbols']!==symbols)throw Error('Replay channel acquisition differs from the request');
 for(let index=0;index<radio.waveform.length;index++)if(!close(radio.waveform[index].t,index/rate))throw Error('Replay sample times differ from the sample rate');
 const scan=request['sweep'] as {axis:string;values:number[];secondaryAxis?:string;secondaryValues?:number[]}|undefined;
 if(!!scan!==!!radio.sweep)throw Error('Replay scan differs from the request');
 if(scan&&radio.sweep){const actual=radio.sweep,ys=scan.secondaryValues||[0],seen=new Set<string>();if(actual.axis!==scan.axis||actual.secondaryAxis!==(scan.secondaryAxis??null)||canonical(actual.values)!==canonical(scan.values)||canonical(actual.secondaryValues)!==canonical(ys)||actual.cases!==scan.values.length*ys.length||actual.executed!==true)throw Error('Replay scan plan differs from the request');for(const cell of actual.cells){const key=cell.row+':'+cell.column;if(seen.has(key)||cell.x!==scan.values[cell.column]||cell.y!==ys[cell.row]||cell.payloadLength!==bits.length||!Number.isInteger(cell.bitErrors)||cell.bitErrors<0||cell.bitErrors>bits.length||!close(cell.ber,cell.bitErrors/bits.length))throw Error('Replay scan cell differs from the request');seen.add(key);radioMetadata(object(cell.summary),{...request,[scan.axis]:cell.x,...(scan.secondaryAxis?{[scan.secondaryAxis]:cell.y}:{})})}}
 return radio;
}
export function replayResult(kind:'digital'|'communications',value:unknown):DigitalResult|RadioResult {
 if(!value||typeof value!=='object')throw Error('Replay result missing');
 const raw=value as Record<string,unknown>;
 if(raw['ok']!==true||typeof raw['engine']!=='string'||typeof raw['version']!=='string'||!raw['summary']||typeof raw['summary']!=='object')throw Error('Invalid recorded engine metadata');
 const numeric=(value:unknown)=>typeof value==='number'&&Number.isFinite(value);
 if(kind==='digital'){
  const result=value as DigitalResult;
  if(!Array.isArray(result.trace)||!result.trace.length||result.trace.length>4096||!Array.isArray(result.wires)||result.wires.length>193||result.wires.length*result.trace.length>32768||!Array.isArray(result.events)||result.events.length>32768)throw Error('Digital replay exceeds acquisition limits');
  if(result.wires.some(wire=>typeof wire!=='string'||!/^[a-zA-Z][a-zA-Z0-9_]{0,95}$/.test(wire)))throw Error('Invalid recorded wire');
  result.trace.forEach((row,index)=>{if(!row||row.tick!==index||!numeric(row.t)||!row.values||result.wires.some(wire=>typeof row.values[wire]!=='boolean'))throw Error('Invalid recorded digital sample')});
  if(result.events.some(event=>!event||!numeric(event.tick)||!numeric(event.t)||typeof event.wire!=='string'||typeof event.to!=='boolean'||event.from!==null&&typeof event.from!=='boolean'||typeof event.cause!=='string'))throw Error('Invalid recorded digital event');
  return result;
 }
 const result=value as RadioResult;
 if(!Array.isArray(result.waveform)||!result.waveform.length||result.waveform.length>32768||!Array.isArray(result.constellation)||result.constellation.length>16384||!Array.isArray(result.eye)||result.eye.length>8192||!numeric(result.ber)||result.ber<0||result.ber>1||!result.interval||![result.interval.lower,result.interval.upper].every(numeric))throw Error('Invalid recorded channel acquisition');
 result.waveform.forEach((row,index)=>{if(!row||![row.t,row.tx,row.rx,row.q??0,row.txQ??0].every(numeric)||index>0&&row.t<=result.waveform[index-1].t)throw Error('Invalid recorded IQ sample')});
 if(result.lineWaveform&&(!Array.isArray(result.lineWaveform)||result.lineWaveform.length>2048||result.lineWaveform.some((row,index)=>!row||![row.t,row.value].every(numeric)||index>0&&row.t<=result.lineWaveform![index-1].t)))throw Error('Invalid recorded line-code display');
 if(result.idealConstellation&&(!Array.isArray(result.idealConstellation)||result.idealConstellation.length>4||result.idealConstellation.some(point=>!point||![point.i,point.q].every(numeric))))throw Error('Invalid recorded ideal constellation');
 if(result.constellation.some(point=>!point||![point.i,point.q,point.bit,point.index].every(numeric))||result.eye.some(point=>!point||![point.phase,point.rx,point.index].every(numeric)))throw Error('Invalid recorded instrument sample');
 if(result.waterfall){const data=result.waterfall;if(!Array.isArray(data.rows)||data.rows.length!==data.frames*data.bins||data.rows.length>768||!Number.isInteger(data.frames)||data.frames<1||data.frames>12||!Number.isInteger(data.bins)||data.bins<1||data.bins>64||![data.minimumDb,data.maximumDb].every(numeric)||data.rows.some(row=>!row||![row.frame,row.bin,row.t,row.frequencyHz,row.powerDb].every(numeric)||!Number.isInteger(row.frame)||!Number.isInteger(row.bin)||row.frame<0||row.frame>=data.frames||row.bin<0||row.bin>=data.bins))throw Error('Invalid recorded spectrogram')}
 if(result.sweep){const data=result.sweep,axis=(values:unknown):values is number[]=>Array.isArray(values)&&values.length>=1&&values.length<=7&&values.every((value,index)=>numeric(value)&&(!index||value>values[index-1]));if(!Array.isArray(data.cells)||data.cells.length>49||!axis(data.values)||!axis(data.secondaryValues)||data.cells.length!==data.values.length*data.secondaryValues.length||data.cells.some(cell=>!cell||![cell.x,cell.y,cell.row,cell.column,cell.ber,cell.bitErrors,cell.payloadLength,cell.interval?.lower,cell.interval?.upper].every(numeric)||!Number.isInteger(cell.row)||!Number.isInteger(cell.column)||cell.row<0||cell.row>=data.secondaryValues.length||cell.column<0||cell.column>=data.values.length||cell.ber<0||cell.ber>1))throw Error('Invalid recorded scan')}
 return result;
}
