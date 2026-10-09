import type {Network,NetworkEvent,NetworkResult} from './packet';

export type PacketStatus='delivered'|'dropped'|'no-route'|'not-injected'|'in-flight'|'waiting';
export interface PacketHop {
 link:string;from:string;to:string;sendMs:number;serializationEndMs:number|null;arrivalMs:number|null;dropMs:number|null;
 queueMs:number|null;queueOrigin:'injection'|'upstream-arrival'|'unknown';status:'arrived'|'dropped'|'in-flight';
}
export interface PacketAudit {
 packet:string;flow:string;index:number;status:PacketStatus;injectedAtMs:number;deliveredAtMs:number|null;
 droppedAtMs:number|null;dropReason:string|null;latencyMs:number|null;hops:PacketHop[];
}
export interface FlowAudit {
 id:string;planned:number;injected:number;delivered:number;dropped:number;noRoute:number;pending:number;
 notInjected:number;inFlight:number;waiting:number;medianLatencyMs:number|null;p95LatencyMs:number|null;
 meanIPDVMs:number|null;routeBottleneckMbps:number|null;
 latencySeries:{packet:string;index:number;tMs:number;latencyMs:number}[];
}
export interface DirectedLinkAudit {
 key:string;id:string;from:string;to:string;rateMbps:number;delayMs:number;transmissions:number;serializationMs:number;
 utilization:number;meanQueueMs:number|null;p95QueueMs:number|null;maxQueueMs:number|null;
 queueSeries:{packet:string;flow:string;tMs:number;queueMs:number}[];
}
export interface NetworkAudit {
 horizonMs:number;flows:FlowAudit[];links:DirectedLinkAudit[];packets:PacketAudit[];selectedPacket:PacketAudit|null;limits:string[];
}

const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const mean=(values:number[]):number|null=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
function median(values:number[]):number|null {
 if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),n=sorted.length;
 return n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2;
}
function p95(values:number[]):number|null {
 if(!values.length)return null;return [...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];
}
function occupied(intervals:[number,number][],horizon:number):{duration:number;overlap:boolean} {
 const ordered=intervals.map(([start,end])=>[Math.max(0,start),Math.min(horizon,end)] as [number,number]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);
 let total=0,left=0,right=0,first=true,overlap=false;
 for(const [start,end] of ordered){
  if(first){left=start;right=end;first=false;continue}
  if(start<right-1e-9)overlap=true;
  if(start<=right){right=Math.max(right,end);continue}
  total+=right-left;left=start;right=end;
 }
 return {duration:total+(first?0:right-left),overlap};
}

export function networkAudit(result:NetworkResult,source:Network,selectedPacket?:string|number):NetworkAudit {
 const horizon=source.durationMs,planned=source.flows.reduce((n,flow)=>n+flow.packets,0);
 if(!result.ok||!finite(horizon)||horizon<=0)throw Error('A successful network result and its frozen source are required.');
 if(!Number.isInteger(planned)||planned<0||planned>512||source.flows.length>16||source.links.length>128||result.events.length>65536)throw Error('Network audit exceeds the bounded native workspace.');
 const limits=[
  'Queue delay uses recorded send starts, upstream arrivals and frozen injection times. Injected counts are scheduled births within the horizon; queue occupancy is not recorded.',
  'Utilization is directional serialization time / horizon. Packet size and link rate reconstruct serialization ends; propagation is excluded.',
  'Latency statistics use delivered packets only. p95 is nearest-rank; IPDV is mean absolute latency change in delivered-packet injection order.'
 ];
 const warn=(text:string)=>{if(!limits.includes(text)&&limits.length<24)limits.push(text)};
 if(finite(result.summary['durationMs'])&&Math.abs(result.summary['durationMs']-horizon)>1e-9)warn('Result and frozen-source horizons differ.');
 const linksById=new Map(source.links.map(link=>[link.id,link]));
 const grouped=new Map<string,NetworkEvent[]>();
 for(const event of result.events){
  if(!finite(event.tMs)||event.tMs<0||event.tMs>horizon+1e-8){warn('Events outside the finite simulation horizon were excluded.');continue}
  const key=JSON.stringify([event.flow,String(event.packet)]),events=grouped.get(key)||[];events.push(event);grouped.set(key,events);
 }
 const packets:PacketAudit[]=[],flowRows:FlowAudit[]=[],directionRows=new Map<string,DirectedLinkAudit>();
 const intervals=new Map<string,[number,number][]>();
 for(const link of source.links){
  if(!finite(link.rateMbps)||link.rateMbps<=0||!finite(link.delayMs)||link.delayMs<0)throw Error('Frozen link parameters are invalid.');
  for(const [from,to] of [[link.a,link.b],[link.b,link.a]]){
   const key=JSON.stringify([link.id,from,to]);
   directionRows.set(key,{key,id:link.id,from,to,rateMbps:link.rateMbps,delayMs:link.delayMs,transmissions:0,serializationMs:0,utilization:0,meanQueueMs:null,p95QueueMs:null,maxQueueMs:null,queueSeries:[]});
  }
 }
 for(const flow of source.flows){
  if(!Number.isInteger(flow.packets)||flow.packets<0||!finite(flow.bytes)||flow.bytes<=0||!finite(flow.startMs)||!finite(flow.intervalMs)||flow.startMs<0||flow.intervalMs<0)throw Error('Frozen traffic parameters are invalid.');
  const current:PacketAudit[]=[];
  for(let index=0;index<flow.packets;index++){
   const packet=`${flow.id}:${index}`,born=flow.startMs+index*flow.intervalMs;
   const events=[...(grouped.get(JSON.stringify([flow.id,packet]))||[])].sort((a,b)=>a.tMs-b.tMs);
   const hops:PacketHop[]=[],ready=new Map<string,{t:number;origin:'injection'|'upstream-arrival'}>([[flow.source,{t:born,origin:'injection'}]]);
   let delivered:number|null=null,dropped:number|null=null,reason:string|null=null;
   for(const event of events){
    if(event.kind==='send'){
     const link=linksById.get(event.link),at=ready.get(event.from),delta=at?event.tMs-at.t:null;
     const queue=delta!==null&&delta>=-1e-8?Math.max(0,delta):null;
     if(delta!==null&&delta< -1e-8)warn('A send precedes the recorded injection or upstream arrival; its queue delay is unknown.');
     const valid=link&&link.enabled&&((link.a===event.from&&link.b===event.to)||(link.b===event.from&&link.a===event.to));
     if(!valid)warn('A send references an absent, disabled or mismatched frozen link.');
     const end=valid?event.tMs+flow.bytes*8/(link.rateMbps*1000):null;
     hops.push({link:event.link,from:event.from,to:event.to,sendMs:event.tMs,serializationEndMs:end,arrivalMs:null,dropMs:null,queueMs:queue,queueOrigin:at?.origin||'unknown',status:'in-flight'});
     const key=JSON.stringify([event.link,event.from,event.to]),direction=directionRows.get(key);
     if(direction&&end!==null){
      direction.transmissions++;const spans=intervals.get(key)||[];spans.push([event.tMs,end]);intervals.set(key,spans);
      if(queue!==null)direction.queueSeries.push({packet,flow:flow.id,tMs:event.tMs,queueMs:queue});
     }
    }else if(event.kind==='arrive'||event.kind==='drop'){
     let hop:PacketHop|undefined;
     for(let at=hops.length-1;at>=0;at--){const candidate=hops[at];if(candidate.link===event.link&&candidate.from===event.from&&candidate.to===event.to&&candidate.status==='in-flight'&&candidate.sendMs<=event.tMs+1e-8){hop=candidate;break}}
     if(event.kind==='arrive'){
      if(hop){hop.arrivalMs=event.tMs;hop.status='arrived'}else warn('An arrival has no matching recorded send; the timeline retains only observed sends.');
      ready.set(event.to,{t:event.tMs,origin:'upstream-arrival'});
     }else{
      if(hop){hop.dropMs=event.tMs;hop.status='dropped'}
      if(dropped===null){dropped=event.tMs;reason=event.reason||null}
     }
    }else if(event.kind==='delivered'&&delivered===null)delivered=event.tMs;
   }
   const latency=delivered!==null&&delivered>=born-1e-8?Math.max(0,delivered-born):null;
   if(delivered!==null&&latency===null)warn('A delivery precedes configured injection; its latency is unknown.');
   if(delivered!==null&&dropped!==null)warn('A packet has both delivery and drop events.');
   const status:PacketStatus=delivered!==null?'delivered':dropped!==null?(reason==='no_route'?'no-route':'dropped'):born>horizon?'not-injected':hops.some(hop=>hop.status==='in-flight')?'in-flight':'waiting';
   const row:PacketAudit={packet,flow:flow.id,index,status,injectedAtMs:born,deliveredAtMs:delivered,droppedAtMs:dropped,dropReason:reason,latencyMs:latency,hops};
   packets.push(row);current.push(row);
  }
  const deliveredRows=current.filter(row=>row.status==='delivered'),latencies=deliveredRows.map(row=>row.latencyMs).filter((value):value is number=>value!==null);
  const changes:number[]=[];for(let at=1;at<deliveredRows.length;at++){const a=deliveredRows[at-1].latencyMs,b=deliveredRows[at].latencyMs;if(a!==null&&b!==null)changes.push(Math.abs(b-a))}
  const route=result.routes.find(path=>path.flow===flow.id),rates=(route?.links||[]).map(id=>linksById.get(id)?.rateMbps);
  const bottleneck=rates.length&&rates.every((rate):rate is number=>finite(rate)&&rate>0)?Math.min(...rates as number[]):null;
  const dropped=current.filter(row=>row.status==='dropped'||row.status==='no-route').length,delivered=deliveredRows.length;
  const row:FlowAudit={id:flow.id,planned:flow.packets,injected:current.filter(packet=>packet.injectedAtMs<=horizon).length,delivered,dropped,noRoute:current.filter(row=>row.status==='no-route').length,pending:flow.packets-delivered-dropped,notInjected:current.filter(row=>row.status==='not-injected').length,inFlight:current.filter(row=>row.status==='in-flight').length,waiting:current.filter(row=>row.status==='waiting').length,medianLatencyMs:median(latencies),p95LatencyMs:p95(latencies),meanIPDVMs:mean(changes),routeBottleneckMbps:bottleneck,latencySeries:deliveredRows.filter(row=>row.latencyMs!==null).map(row=>({packet:row.packet,index:row.index,tMs:row.deliveredAtMs!,latencyMs:row.latencyMs!}))};
  const native=result.flows.find(native=>native.id===flow.id);
  if(native&&(native.sent!==row.planned||native.delivered!==row.delivered||native.dropped!==row.dropped||native.pending!==row.pending))warn(`Native flow counts differ from observed events for ${flow.id}.`);
  flowRows.push(row);
 }
 for(const [key,direction] of directionRows){
  const busy=occupied(intervals.get(key)||[],horizon);direction.serializationMs=busy.duration;direction.utilization=Math.min(1,busy.duration/horizon);
  if(busy.overlap)warn(`Overlapping directional serialization intervals on ${direction.id}; utilization uses their union.`);
  direction.queueSeries.sort((a,b)=>a.tMs-b.tMs);const values=direction.queueSeries.map(row=>row.queueMs);
  direction.meanQueueMs=mean(values);direction.p95QueueMs=p95(values);direction.maxQueueMs=values.length?Math.max(...values):null;
 }
 const selected=selectedPacket===undefined?(packets.find(packet=>packet.hops.length)||packets[0]||null):(packets.find(packet=>packet.packet===String(selectedPacket))||null);
 return {horizonMs:horizon,flows:flowRows,links:[...directionRows.values()],packets,selectedPacket:selected,limits};
}

function cell(value:unknown):string {
 if(value===undefined||value===null)return '';let text=String(value);
 if(typeof value==='string'&&/^[=+\-@\t\r]/.test(text))text=`'${text}`;
 return `"${text.replace(/"/g,'""')}"`;
}
export function networkAuditCSV(audit:NetworkAudit):string {
 const columns=['record','id','flow','packet','link','from','to','status','index','injected_at_ms','send_ms','serialization_end_ms','arrival_ms','drop_ms','delivered_at_ms','latency_ms','queue_ms','mean_queue_ms','p95_queue_ms','max_queue_ms','median_latency_ms','p95_latency_ms','mean_ipdv_ms','bottleneck_mbps','rate_mbps','delay_ms','transmissions','serialization_ms','utilization','planned','injected','delivered','dropped','pending','not_injected','in_flight','waiting','no_route','horizon_ms','detail'];
 const rows:Record<string,unknown>[]=[];
 for(const flow of audit.flows)rows.push({record:'flow',id:flow.id,flow:flow.id,median_latency_ms:flow.medianLatencyMs,p95_latency_ms:flow.p95LatencyMs,mean_ipdv_ms:flow.meanIPDVMs,bottleneck_mbps:flow.routeBottleneckMbps,planned:flow.planned,injected:flow.injected,delivered:flow.delivered,dropped:flow.dropped,pending:flow.pending,not_injected:flow.notInjected,in_flight:flow.inFlight,waiting:flow.waiting,no_route:flow.noRoute});
 for(const link of audit.links)rows.push({record:'directed_link',id:link.key,link:link.id,from:link.from,to:link.to,rate_mbps:link.rateMbps,delay_ms:link.delayMs,transmissions:link.transmissions,serialization_ms:link.serializationMs,utilization:link.utilization,mean_queue_ms:link.meanQueueMs,p95_queue_ms:link.p95QueueMs,max_queue_ms:link.maxQueueMs});
 for(const packet of audit.packets){
  rows.push({record:'packet',flow:packet.flow,packet:packet.packet,status:packet.status,index:packet.index,injected_at_ms:packet.injectedAtMs,delivered_at_ms:packet.deliveredAtMs,drop_ms:packet.droppedAtMs,latency_ms:packet.latencyMs,detail:packet.dropReason});
  for(const hop of packet.hops)rows.push({record:'hop',flow:packet.flow,packet:packet.packet,link:hop.link,from:hop.from,to:hop.to,status:hop.status,send_ms:hop.sendMs,serialization_end_ms:hop.serializationEndMs,arrival_ms:hop.arrivalMs,drop_ms:hop.dropMs,queue_ms:hop.queueMs,detail:`queue origin: ${hop.queueOrigin}; serialization end reconstructed from frozen size/rate`});
 }
 for(const detail of audit.limits)rows.push({record:'definition',detail});
 return '\uFEFF'+[columns.map(cell).join(','),...rows.map(row=>columns.map(column=>cell(column==='horizon_ms'?audit.horizonMs:row[column])).join(','))].join('\r\n')+'\r\n';
}
