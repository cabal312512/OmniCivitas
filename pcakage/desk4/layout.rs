use crate::common::{Answer,Data,Issue,integer,number};
use std::cmp::Ordering;
use std::collections::{BTreeMap,BTreeSet,BinaryHeap};

struct Config {names:Vec<String>,index:BTreeMap<String,usize>,links:Vec<Invoice>,adjacency:Vec<Vec<(usize,usize)>>}
struct Invoice {id:String,a:usize,b:usize,rate:f64,delay:f64,loss:f64,enabled:bool}
struct Receipt {id:String,source:usize,target:usize,count:usize,bytes:usize,start:f64,interval:f64,path:Option<(Vec<usize>,Vec<usize>)>}
#[derive(Clone)]struct Data2{when:f64,serial:usize,flow:usize,packet:usize,hop:usize,born:f64,dropped:bool}
impl PartialEq for Data2{fn eq(&self,other:&Self)->bool{self.when==other.when&&self.serial==other.serial}}
impl Eq for Data2{}
impl PartialOrd for Data2{fn partial_cmp(&self,other:&Self)->Option<Ordering>{Some(self.cmp(other))}}
impl Ord for Data2{fn cmp(&self,other:&Self)->Ordering{other.when.total_cmp(&self.when).then_with(||other.serial.cmp(&self.serial))}}
struct Common{state:u64}
impl Common{fn sample(&mut self)->f64{self.state^=self.state>>12;self.state^=self.state<<25;self.state^=self.state>>27;((self.state.wrapping_mul(2685821657736338717)>>11)as f64+0.5)/9007199254740992.0}}
#[derive(Default)]struct Stock{sent:usize,delivered:usize,dropped:usize,latency:f64}
fn name(row:&Data,key:&str)->Answer<String>{let value=row.get(key).text().ok_or_else(||Issue::new("NETWORK",format!("{key} must be a node or record ID.")))?;if value.is_empty()||value.len()>96{return Err(Issue::new("NETWORK","IDs require 1 to 96 UTF-8 bytes."));}Ok(value.into())}
impl Config{
    fn load(input:&Data)->Answer<Self>{
        let source=input.get("nodes").list().ok_or_else(||Issue::new("NETWORK","nodes must be an array."))?;
        if source.is_empty()||source.len()>64{return Err(Issue::new("LIMIT","Network requires 1 to 64 nodes."));}
        let mut names=Vec::new();let mut index=BTreeMap::new();
        for row in source{let id=name(row,"id")?;let kind=row.get("type").text().unwrap_or("router");if !matches!(kind,"router"|"satellite"|"base"|"ue"|"switch"|"host"){return Err(Issue::new("NETWORK","Unsupported network node type."));}
            let x=number(row,"x",0.0)?;let y=number(row,"y",0.0)?;if x.abs()>100000.0||y.abs()>100000.0{return Err(Issue::new("LIMIT","Drawing coordinates exceed supported bounds."));}
            if index.insert(id.clone(),names.len()).is_some(){return Err(Issue::new("NETWORK","Node IDs must be unique."));}names.push(id);
        }
        let records=input.get("links").list().ok_or_else(||Issue::new("NETWORK","links must be an array."))?;if records.len()>128{return Err(Issue::new("LIMIT","At most 128 network links."));}
        let mut links=Vec::new();let mut ids=BTreeSet::new();let mut adjacency=vec![Vec::new();names.len()];
        for row in records{let id=name(row,"id")?;let a=*index.get(&name(row,"a")?).ok_or_else(||Issue::new("NETWORK","Unknown link endpoint a."))?;let b=*index.get(&name(row,"b")?).ok_or_else(||Issue::new("NETWORK","Unknown link endpoint b."))?;
            if a==b||!ids.insert(id.clone()){return Err(Issue::new("NETWORK","Links require unique IDs and distinct endpoints."));}
            let rate=number(row,"rateMbps",10.0)?;let delay=number(row,"delayMs",5.0)?;let loss=number(row,"loss",0.0)?;let enabled=row.get("enabled").flag().unwrap_or(true);
            if !(0.001..=100000.0).contains(&rate)||!(0.0..=100000.0).contains(&delay)||!(0.0..=1.0).contains(&loss){return Err(Issue::new("LIMIT","Link bandwidth, delay or loss is outside supported bounds."));}
            let position=links.len();if enabled{adjacency[a].push((b,position));adjacency[b].push((a,position));}links.push(Invoice{id,a,b,rate,delay,loss,enabled});
        }Ok(Self{names,index,links,adjacency})
    }
    fn route(&self,source:usize,target:usize,bytes:usize)->Option<(Vec<usize>,Vec<usize>)>{
        let n=self.names.len();let mut distance=vec![f64::INFINITY;n];let mut parent=vec![None;n];let mut settled=vec![false;n];distance[source]=0.0;
        for _ in 0..n{let chosen=(0..n).filter(|i|!settled[*i]).min_by(|a,b|distance[*a].total_cmp(&distance[*b]))?;if !distance[chosen].is_finite(){break;}settled[chosen]=true;if chosen==target{break;}
            for &(next,edge)in &self.adjacency[chosen]{let link=&self.links[edge];let cost=link.delay+bytes as f64*8.0/(link.rate*1000.0);let candidate=distance[chosen]+cost;if candidate<distance[next]{distance[next]=candidate;parent[next]=Some((chosen,edge));}}
        }
        if !distance[target].is_finite(){return None;}let mut nodes=vec![target];let mut edges=Vec::new();let mut current=target;
        while current!=source{let(previous,edge)=parent[current]?;edges.push(edge);nodes.push(previous);current=previous;if edges.len()>n{return None;}}
        nodes.reverse();edges.reverse();Some((nodes,edges))
    }
}
fn event(kind:&str,time:f64,flow:&Receipt,packet:usize,from:&str,to:&str,link:&str,reason:&str)->Data{
    let mut map=BTreeMap::from([("tMs".into(),time.into()),("kind".into(),kind.into()),("packet".into(),format!("{}:{}",flow.id,packet).into()),("flow".into(),flow.id.clone().into()),("from".into(),from.into()),("to".into(),to.into()),("link".into(),link.into())]);if !reason.is_empty(){map.insert("reason".into(),reason.into());}Data::Receipt(map)
}
pub fn schedule(input:&Data)->Answer<Data>{
    let config=Config::load(input)?;let duration=number(input,"durationMs",5000.0)?;if !(1.0..=100000.0).contains(&duration){return Err(Issue::new("LIMIT","durationMs must be within 1 to 100000."));}
    let seed=integer(input,"seed",42,0,4294967295)?;let mut random=Common{state:if seed==0{0x9e3779b97f4a7c15}else{seed as u64}};
    let source=input.get("flows").list().ok_or_else(||Issue::new("NETWORK","flows must be an array."))?;if source.is_empty()||source.len()>16{return Err(Issue::new("LIMIT","Supply 1 to 16 network flows."));}
    let mut flows=Vec::new();let mut ids=BTreeSet::new();let mut total=0;
    for row in source{let id=name(row,"id")?;if !ids.insert(id.clone()){return Err(Issue::new("NETWORK","Flow IDs must be unique."));}
        let source=*config.index.get(&name(row,"source")?).ok_or_else(||Issue::new("NETWORK","Unknown flow source."))?;let target=*config.index.get(&name(row,"target")?).ok_or_else(||Issue::new("NETWORK","Unknown flow target."))?;
        let count=integer(row,"packets",12,1,512)?;total+=count;if total>512{return Err(Issue::new("LIMIT","At most 512 packets across all flows."));}
        let bytes=integer(row,"bytes",1024,1,65536)?;let start=number(row,"startMs",0.0)?;let interval=number(row,"intervalMs",60.0)?;if start<0.0||start>duration||interval<0.0||interval>100000.0{return Err(Issue::new("NETWORK","Flow start/interval exceed supported bounds."));}
        let path=config.route(source,target,bytes);flows.push(Receipt{id,source,target,count,bytes,start,interval,path});
    }
    let mut queue=BinaryHeap::new();let mut serial=0;for(index,flow)in flows.iter().enumerate(){for packet in 0..flow.count{let t=flow.start+packet as f64*flow.interval;queue.push(Data2{when:t,serial,flow:index,packet,hop:0,born:t,dropped:false});serial+=1;}}
    let mut available=vec![[0.0f64;2];config.links.len()];let mut stock=(0..flows.len()).map(|_|Stock::default()).collect::<Vec<_>>();let mut events=Vec::new();
    while let Some(order)=queue.pop(){if order.when>duration{break;}let flow=&flows[order.flow];let count=&mut stock[order.flow];if order.hop==0{count.sent+=1;}
        let path=match &flow.path{Some(path)=>path,None=>{count.dropped+=1;events.push(event("drop",order.when,flow,order.packet,&config.names[flow.source],&config.names[flow.target],"","no_route"));continue;}};
        if order.hop>0{let edge=&config.links[path.1[order.hop-1]];let from=&config.names[path.0[order.hop-1]];let to=&config.names[path.0[order.hop]];
            if order.dropped{count.dropped+=1;events.push(event("drop",order.when,flow,order.packet,from,to,&edge.id,"configured_loss"));continue;}
            events.push(event("arrive",order.when,flow,order.packet,from,to,&edge.id,""));
        }
        if order.hop==path.1.len(){count.delivered+=1;count.latency+=order.when-order.born;events.push(event("delivered",order.when,flow,order.packet,&config.names[flow.source],&config.names[flow.target],"",""));continue;}
        let edge_index=path.1[order.hop];let link=&config.links[edge_index];let from=path.0[order.hop];let to=path.0[order.hop+1];let direction=if from==link.a{0}else{1};let start=order.when.max(available[edge_index][direction]);let finish=start+flow.bytes as f64*8.0/(link.rate*1000.0);available[edge_index][direction]=finish;
        if start<=duration{events.push(event("send",start,flow,order.packet,&config.names[from],&config.names[to],&link.id,""));}
        queue.push(Data2{when:finish+link.delay,serial,flow:order.flow,packet:order.packet,hop:order.hop+1,born:order.born,dropped:random.sample()<link.loss});serial+=1;
        if serial>32768||events.len()>65536{return Err(Issue::new("LIMIT","Network event budget exceeded."));}
    }
    events.sort_by(|a,b|a.get("tMs").number().unwrap().total_cmp(&b.get("tMs").number().unwrap()));
    let metrics=flows.iter().zip(&stock).map(|(flow,s)|{let pending=flow.count-s.delivered-s.dropped;Data::object([("id",flow.id.clone().into()),("sent",flow.count.into()),("injected",s.sent.into()),("delivered",s.delivered.into()),("dropped",s.dropped.into()),("pending",pending.into()),("late",pending.into()),("avgLatencyMs",if s.delivered==0{Data::Null}else{(s.latency/s.delivered as f64).into()}),("throughputMbps",(s.delivered as f64*flow.bytes as f64*8.0/(duration*1000.0)).into())])}).collect::<Vec<_>>();
    let routes=flows.iter().map(|flow|match &flow.path{Some((nodes,edges))=>Data::object([("flow",flow.id.clone().into()),("nodes",Data::List(nodes.iter().map(|i|config.names[*i].clone().into()).collect())),("links",Data::List(edges.iter().map(|i|config.links[*i].id.clone().into()).collect()))]),None=>Data::object([("flow",flow.id.clone().into()),("nodes",Data::List(vec![])),("links",Data::List(vec![]))])}).collect();
    let delivered=stock.iter().map(|s|s.delivered).sum::<usize>();let dropped=stock.iter().map(|s|s.dropped).sum::<usize>();let pending=total-delivered-dropped;
    Ok(Data::object([("events",Data::List(events.clone())),("routes",Data::List(routes)),("flows",Data::List(metrics)),("summary",Data::object([("seed",seed.into()),("durationMs",duration.into()),("packets",total.into()),("delivered",delivered.into()),("dropped",dropped.into()),("pending",pending.into()),("eventCount",events.len().into()),("model","abstract full-duplex FIFO links; static shortest latency route; finite packet events".into())])),("units",Data::object([("time","ms".into()),("rate","Mbps".into()),("size","bytes".into())]))]))
}
#[cfg(test)]mod tests{
    use super::*;
    fn fixture(loss:f64,duration:f64)->Data{crate::common::decode(&format!(r#"{{"nodes":[{{"id":"a","type":"host"}},{{"id":"b","type":"router"}}],"links":[{{"id":"x","a":"a","b":"b","rateMbps":1,"delayMs":10,"loss":{loss}}}],"flows":[{{"id":"f","source":"a","target":"b","packets":2,"bytes":1000,"intervalMs":0}}],"durationMs":{duration}}}"#)).unwrap()}
    #[test]fn serial_queue_has_real_bandwidth_delay(){let result=schedule(&fixture(0.0,100.0)).unwrap();let events=result.get("events").list().unwrap();let arrived=events.iter().filter(|e|e.get("kind").text()==Some("arrive")).map(|e|e.get("tMs").number().unwrap()).collect::<Vec<_>>();assert_eq!(arrived,vec![18.0,26.0]);assert_eq!(result.get("summary").get("delivered").number(),Some(2.0));}
    #[test]fn total_loss_and_horizon_are_distinct(){assert_eq!(schedule(&fixture(1.0,100.0)).unwrap().get("summary").get("dropped").number(),Some(2.0));assert_eq!(schedule(&fixture(0.0,12.0)).unwrap().get("summary").get("pending").number(),Some(2.0));}
    #[test]fn random_events_seed_replays(){let request=fixture(0.35,100.0);assert_eq!(schedule(&request).unwrap(),schedule(&request).unwrap());}
}
