use crate::common::{Data,Answer,Issue,integer,number};
use std::collections::{BTreeMap,BTreeSet,VecDeque};

fn field(text:&str)->String{let mut out=String::new();for byte in text.as_bytes(){out.push_str(&format!("{byte:02x}"));}format!("{out:<192}")}
fn unfield(column:&str)->Answer<String>{let text=column.trim_end();if text.len()%2!=0{return Err(Issue::new("RECORD","Odd legacy field width."));}let bytes=(0..text.len()).step_by(2).map(|at|u8::from_str_radix(&text[at..at+2],16).map_err(|_|Issue::new("RECORD","Invalid legacy record byte."))).collect::<Answer<Vec<_>>>()?;String::from_utf8(bytes).map_err(|_|Issue::new("RECORD","Invalid legacy UTF-8 field."))}
fn invoice_record(id:&str,a:&str,b:&str,kind:&str)->Answer<(String,String,String,String)>{
    let record=format!("{: <2}{}{}{}",kind,field(id),field(a),field(b));
    if record.len()!=578{return Err(Issue::new("RECORD","Legacy connection width mismatch."));}
    Ok((unfield(&record[2..194])?,unfield(&record[194..386])?,unfield(&record[386..578])?,record[..2].trim().to_string()))
}

pub fn topology(input:&Data)->Answer<Data>{
    let rows=input.get("components").list().ok_or_else(||Issue::new("MODEL","Components must be an array."))?;
    if rows.is_empty()||rows.len()>512{return Err(Issue::new("LIMIT","Topology accepts 1 to 512 components."));}
    let ground=input.get("ground").text().unwrap_or("0");let mut nodes=BTreeSet::new();let mut ids=BTreeSet::new();let mut adjacency:BTreeMap<String,Vec<String>>=BTreeMap::new();let mut connections=Vec::new();
    for row in rows{let id=row.get("id").text().ok_or_else(||Issue::new("MODEL","Missing component ID."))?;let a=row.get("a").text().ok_or_else(||Issue::new("MODEL","Missing node a."))?;let b=row.get("b").text().ok_or_else(||Issue::new("MODEL","Missing node b."))?;
        if id.is_empty()||id.len()>96||a.is_empty()||a.len()>96||b.is_empty()||b.len()>96||a==b||!ids.insert(id.to_string()){return Err(Issue::new("MODEL","Invalid component ID or nodes."));}
        nodes.insert(a.to_string());nodes.insert(b.to_string());let typ=row.get("type").text().unwrap_or("");
        if !matches!(typ,"R"|"C"|"L"|"V"|"I"|"S"){return Err(Issue::new("UNSUPPORTED",format!("Unsupported component {typ}.")));}
        let (old_id,old_a,old_b,old_kind)=invoice_record(id,a,b,typ)?;
        if typ!="I"&&!(typ=="S"&&row.get("closed").flag()==Some(false)){adjacency.entry(a.into()).or_default().push(b.into());adjacency.entry(b.into()).or_default().push(a.into());}
        connections.push(Data::object([("id",old_id.into()),("a",old_a.into()),("b",old_b.into()),("type",old_kind.into())]));
    }
    if nodes.len()>129{return Err(Issue::new("LIMIT","At most 128 non-ground nodes."));}if !nodes.contains(ground){return Err(Issue::new("GROUND","Ground node is not connected."));}
    let mut seen=BTreeSet::from([ground.to_string()]);let mut queue=VecDeque::from([ground.to_string()]);while let Some(node)=queue.pop_front(){for next in adjacency.get(&node).into_iter().flatten(){if seen.insert(next.clone()){queue.push_back(next.clone());}}}
    let floating=nodes.difference(&seen).cloned().map(Data::from).collect::<Vec<_>>();
    Ok(Data::object([("nodes",Data::List(nodes.into_iter().map(Data::from).collect())),("connections",Data::List(connections)),("floating",Data::List(floating.clone())),("connected",floating.is_empty().into()),("diagnostics",Data::List(if floating.is_empty(){vec![]}else{vec![Data::object([("code","FLOATING".into()),("message","Disconnected nodes exist in the reference topology.".into())])]}))]))
}
struct Gate{id:String,kind:String,inputs:Vec<String>}
fn evaluate(gates:&[Gate],sequence:&[usize],state:&mut BTreeMap<String,bool>)->Answer<()>{
    for &index in sequence{let gate=&gates[index];let values=gate.inputs.iter().map(|name|state.get(name).copied().ok_or_else(||Issue::new("DIGITAL",format!("Unknown wire {name}.")))).collect::<Answer<Vec<_>>>()?;
        let value=match gate.kind.as_str(){"AND"=>values.iter().all(|b|*b),"NAND"=>!values.iter().all(|b|*b),"OR"=>values.iter().any(|b|*b),"NOR"=>!values.iter().any(|b|*b),"XOR"=>values.iter().fold(false,|a,b|a^b),"NOT"=>!values[0],"BUFFER"=>values[0],_=>return Err(Issue::new("DIGITAL","Unsupported combinational gate."))};state.insert(gate.id.clone(),value);
    }Ok(())
}
pub fn digital(input:&Data)->Answer<Data>{
    let ticks=integer(input,"ticks",32,1,4096)?;let period=integer(input,"clockPeriodTicks",8,2,4096)?;let source=input.get("inputs").map().ok_or_else(||Issue::new("MODEL","inputs must map source names to boolean values."))?;
    if source.len()>64{return Err(Issue::new("LIMIT","At most 64 input wires."));}let mut state=BTreeMap::new();
    for(key,value)in source{if key.is_empty()||key.len()>96||key=="clock"{return Err(Issue::new("DIGITAL","Invalid or reserved source name."));}state.insert(key.clone(),value.flag().ok_or_else(||Issue::new("DIGITAL","Source values must be boolean."))?);}
    state.insert("clock".into(),false);let rows=input.get("gates").list().ok_or_else(||Issue::new("MODEL","gates must be an array."))?;if rows.len()>128{return Err(Issue::new("LIMIT","At most 128 digital gates."));}
    let mut gates=Vec::new();let mut identifiers:BTreeSet<String>=state.keys().cloned().collect();
    for row in rows{let id=row.get("id").text().ok_or_else(||Issue::new("DIGITAL","Missing gate ID."))?.to_string();let kind=row.get("type").text().unwrap_or("").to_string();let names=row.get("inputs").list().ok_or_else(||Issue::new("DIGITAL","Gate inputs must be wire names."))?.iter().map(|name|name.text().map(str::to_string).ok_or_else(||Issue::new("DIGITAL","Wire name must be text."))).collect::<Answer<Vec<_>>>()?;
        if id.is_empty()||id.len()>96||!identifiers.insert(id.clone()){return Err(Issue::new("DIGITAL","Gate IDs must be unique."));}
        if !matches!(kind.as_str(),"AND"|"NAND"|"OR"|"NOR"|"XOR"|"NOT"|"BUFFER"|"DFF"|"JKFF")||names.is_empty()||names.len()>8||((kind=="NOT"||kind=="BUFFER"||kind=="DFF")&&names.len()!=1)||(kind=="JKFF"&&names.len()!=2){return Err(Issue::new("DIGITAL","Unsupported gate or input count; DFF needs D, JKFF needs J/K."));}
        if kind=="DFF"||kind=="JKFF"{let initial=match row.get("initial"){Data::Null=>false,Data::Flag(value)=>*value,_=>return Err(Issue::new("DIGITAL","Initial register values must be boolean."))};state.insert(id.clone(),initial);}gates.push(Gate{id,kind,inputs:names});
    }
    for gate in &gates{for name in &gate.inputs{if !identifiers.contains(name){return Err(Issue::new("DIGITAL",format!("Unknown input wire {name}.")));}}}
    if identifiers.len()*ticks>32768{return Err(Issue::new("LIMIT","Digital trace exceeds 32768 wire/tick cells."));}
    let tick_s=number(input,"tickS",0.001)?;if !(1e-9..=1.0).contains(&tick_s){return Err(Issue::new("LIMIT","tickS must be within 1e-9 to 1 second."));}
    let mut patterns=BTreeMap::new();if input.map().is_some_and(|map|map.contains_key("patterns")){let rows=input.get("patterns").map().ok_or_else(||Issue::new("DIGITAL","patterns must map input names to cyclic binary strings."))?;for(key,value)in rows{let bits=value.text().ok_or_else(||Issue::new("DIGITAL","Input patterns must be binary strings."))?;if !source.contains_key(key)||bits.is_empty()||bits.len()>4096||!bits.bytes().all(|b|b==b'0'||b==b'1'){return Err(Issue::new("DIGITAL","Patterns require an existing input and 1–4096 binary digits."));}patterns.insert(key.clone(),bits.as_bytes().to_vec());}}
    let mut order=Vec::new();let mut known:BTreeSet<String>=state.keys().cloned().collect();
    while order.len()<gates.iter().filter(|g|g.kind!="DFF"&&g.kind!="JKFF").count(){let before=order.len();for(index,gate)in gates.iter().enumerate(){if gate.kind!="DFF"&&gate.kind!="JKFF"&&!known.contains(&gate.id)&&gate.inputs.iter().all(|name|known.contains(name)){order.push(index);known.insert(gate.id.clone());}}if before==order.len(){return Err(Issue::new("DIGITAL_CYCLE","Combinational feedback is unsupported; insert a DFF/JKFF."));}}
    let mut trace=Vec::new();let mut events=Vec::new();let mut previous_clock=false;
    for tick in 0..ticks{let previous=state.clone();for(key,bits)in &patterns{state.insert(key.clone(),bits[tick%bits.len()]==b'1');}let clock=tick%period>=period/2;state.insert("clock".into(),clock);evaluate(&gates,&order,&mut state)?;
        if clock&&!previous_clock{let updates=gates.iter().filter(|g|g.kind=="DFF"||g.kind=="JKFF").map(|g|{let first=*state.get(&g.inputs[0]).unwrap();let value=if g.kind=="DFF"{first}else{let second=*state.get(&g.inputs[1]).unwrap();match(first,second){(false,false)=>*state.get(&g.id).unwrap(),(false,true)=>false,(true,false)=>true,(true,true)=>!*state.get(&g.id).unwrap()}};(g.id.clone(),value)}).collect::<Vec<_>>();for(id,value)in updates{state.insert(id,value);}evaluate(&gates,&order,&mut state)?;}
        for(key,&value)in &state{let old=previous.get(key).copied();if old!=Some(value){events.push(Data::object([("tick",tick.into()),("t",(tick as f64*tick_s).into()),("wire",key.clone().into()),("from",old.map(Data::from).unwrap_or(Data::Null)),("to",value.into()),("cause",(if key=="clock"{"clock"}else if source.contains_key(key){"input"}else if gates.iter().any(|gate|gate.id==*key&&(gate.kind=="DFF"||gate.kind=="JKFF")){"rising-edge register"}else{"combinational settle"}).into())]));}}
        previous_clock=clock;trace.push(Data::object([("tick",tick.into()),("t",(tick as f64*tick_s).into()),("values",Data::Receipt(state.iter().map(|(k,v)|(k.clone(),(*v).into())).collect()))]));
    }
    Ok(Data::object([("trace",Data::List(trace)),("events",Data::List(events)),("wires",Data::List(state.keys().cloned().map(Data::from).collect())),("summary",Data::object([("ticks",ticks.into()),("tickS",tick_s.into()),("durationS",(ticks as f64*tick_s).into()),("clockPeriodTicks",period.into()),("model","ideal synchronous events; DFF / JKFF simultaneous global rising edge; cyclic sampled inputs; acyclic combinational settling; no setup/hold/metastability or propagation delay".into())]))]))
}
#[cfg(test)]mod tests{
    use super::*;
    #[test]fn gate_truth_table(){let d=crate::common::decode(r#"{"inputs":{"a":true,"b":false},"gates":[{"id":"x","type":"XOR","inputs":["a","b"]}],"ticks":1}"#).unwrap();assert_eq!(digital(&d).unwrap().get("trace").list().unwrap()[0].get("values").get("x").flag(),Some(true));}
    #[test]fn rejects_combinational_feedback(){let d=crate::common::decode(r#"{"inputs":{},"gates":[{"id":"x","type":"NOT","inputs":["y"]},{"id":"y","type":"NOT","inputs":["x"]}]}"#).unwrap();assert_eq!(digital(&d).unwrap_err().code,"DIGITAL_CYCLE");}
    #[test]fn jk_toggle_and_dff_sample_same_prior_state(){let d=crate::common::decode(r#"{"inputs":{"one":true},"gates":[{"id":"q","type":"JKFF","inputs":["one","one"]},{"id":"r","type":"DFF","inputs":["q"]}],"ticks":12,"clockPeriodTicks":4}"#).unwrap();let result=digital(&d).unwrap();let rows=result.get("trace").list().unwrap();assert_eq!(rows[2].get("values").get("q").flag(),Some(true));assert_eq!(rows[2].get("values").get("r").flag(),Some(false));assert_eq!(rows[6].get("values").get("q").flag(),Some(false));assert_eq!(rows[6].get("values").get("r").flag(),Some(true));}
    #[test]fn cyclic_patterns_really_feed_clocked_registers(){let d=crate::common::decode(r#"{"inputs":{"d":false},"patterns":{"d":"00110000"},"gates":[{"id":"q","type":"DFF","inputs":["d"]}],"ticks":12,"clockPeriodTicks":4,"tickS":0.01}"#).unwrap();let result=digital(&d).unwrap();let rows=result.get("trace").list().unwrap();assert_eq!(rows[2].get("values").get("q").flag(),Some(true));assert_eq!(rows[6].get("values").get("q").flag(),Some(false));assert_eq!(rows[10].get("values").get("q").flag(),Some(true));assert!((rows[10].get("t").number().unwrap()-0.1).abs()<1e-12);assert!(!result.get("events").list().unwrap().is_empty());}
}
