use crate::common::{Challenge, Control};
use crate::stock::Warehouse;
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};

pub struct Common {
    sold: BTreeMap<String, usize>, counters: BTreeMap<String, usize>, previous: BTreeSet<(String,String)>,
    gates: BTreeMap<String, bool>, signals: BTreeMap<String, bool>, pub collisions: usize, pub events: usize,
    pub moments: Vec<Value>, pub completed: bool, pub completion_time: Option<f32>, steady_since: Option<f32>,
}
impl Common {
    pub fn new() -> Self { Self { sold:BTreeMap::new(),counters:BTreeMap::new(),previous:BTreeSet::new(),
        gates:BTreeMap::new(),signals:BTreeMap::new(),collisions:0,events:0,moments:Vec::new(),completed:false,completion_time:None,steady_since:None } }
    pub fn read(&mut self, time: f32, pairs: BTreeSet<(String,String)>, controls: &[Control],
                challenge: Option<&Challenge>, store: &mut Warehouse) -> Vec<Value> {
        let new: Vec<_> = pairs.difference(&self.previous).cloned().collect(); let mut records = Vec::new();
        for (a,b) in &new {
            self.collisions += 1; *self.counters.entry(a.clone()).or_default() += 1; *self.counters.entry(b.clone()).or_default() += 1;
            self.push(json!({"t":time,"kind":"contact","a":a,"b":b}),&mut records);
        }
        for c in controls {
            let count = *self.sold.get(&c.id).unwrap_or(&0);
            let pair = if c.body < c.target { (c.body.clone(),c.target.clone()) } else { (c.target.clone(),c.body.clone()) };
            let open = match c.kind.as_str() {
                "timer" => time + 1e-6 >= c.threshold * (count+1) as f32,
                "contact" => pairs.contains(&pair),
                "distance" => {
                    let a = store.bodies[store.keys[&c.body]].translation();
                    let b = store.bodies[store.keys[&c.target]].translation(); (a-b).norm() <= c.threshold
                }
                "count" => {
                    let n = if c.target.is_empty() { *self.counters.get(&c.body).unwrap_or(&0) }
                        else { let key=format!("@{}",c.id); if new.contains(&pair) { *self.counters.entry(key.clone()).or_default() += 1; }
                            *self.counters.get(&key).unwrap_or(&0) };
                    n >= c.threshold.ceil().max(1.0) as usize * (count+1)
                }
                "logic" => match c.logic.as_str() {
                    "all" => c.inputs.iter().all(|id|self.signals.get(id).copied().unwrap_or(false)),
                    "any" => c.inputs.iter().any(|id|self.signals.get(id).copied().unwrap_or(false)),
                    "not" => !self.signals.get(&c.inputs[0]).copied().unwrap_or(false),
                    _=>false,
                },
                _ => false,
            };
            let signal = if c.kind == "timer" { time + 1e-6 >= c.threshold }
                else if c.kind == "count" { open || self.signals.get(&c.id).copied().unwrap_or(false) }
                else { open };
            self.signals.insert(c.id.clone(),signal);
            let prior = *self.gates.get(&c.id).unwrap_or(&false);
            self.gates.insert(c.id.clone(),open);
            if count >= c.max_firings { continue; }
            let fire = open && (!prior || c.kind == "timer" || c.kind == "count");
            if fire {
                if c.action != "signal" {
                    let motor = store.drives.iter_mut().find(|m|m.id == c.motor).expect("validated drive");
                    match c.action.as_str() { "start" => motor.enabled=true, "stop" => motor.enabled=false,
                        "reverse" => motor.target_speed = -motor.target_speed, _=>{} }
                }
                self.sold.insert(c.id.clone(),count+1);
                self.push(json!({"t":time,"kind":"control","id":c.id,"motor":c.motor,"action":c.action,"sequence":count+1,
                    "sensor":c.kind,"inputs":c.inputs,"logic":c.logic,"signal":signal}),&mut records);
            }
        }
        if let Some(c) = challenge {
            let b = &store.bodies[store.keys[&c.body]];
            let within = match c.kind.as_str() {
                "delivery" => (b.translation().x-c.target_x).hypot(b.translation().y-c.target_y) <= c.tolerance
                    && b.linvel().norm() < 2.0 && time >= c.min_time,
                "crossing" => (b.translation().x-c.target_x).hypot(b.translation().y-c.target_y) <= c.tolerance
                    && time >= c.min_time && store.bodies.iter().filter(|(_,b)|b.is_dynamic()).count() <= c.max_parts,
                "routing" => time >= c.min_time && c.targets.iter().all(|target| {
                    let part=&store.bodies[store.keys[&target.body]];
                    (part.translation().x-target.target_x).hypot(part.translation().y-target.target_y) <= target.tolerance
                        && part.linvel().norm()<2.0
                }),
                "steady" => {
                    let motor = store.drives.iter().find(|m|m.body == c.body).expect("validated drive");
                    motor.enabled && (b.angvel()-motor.target_speed).abs() <= c.tolerance && time >= c.min_time
                }
                _=>false,
            };
            if within && self.steady_since.is_none() { self.steady_since=Some(time); }
            if !within { self.steady_since=None; }
            let hold = if c.kind == "steady" { 0.5 } else { 0.1 };
            if !self.completed && self.steady_since.is_some_and(|t|time-t+1e-6>=hold) {
                self.completed=true;self.completion_time=Some(time);
                self.push(json!({"t":time,"kind":"challenge","id":c.id,"complete":true}),&mut records);
            }
        }
        self.previous=pairs; records
    }
    fn push(&mut self, value: Value, records: &mut Vec<Value>) {
        self.events += 1;
        if records.len() < 64 { records.push(value.clone()); }
        if self.moments.len() < 128 { self.moments.push(value); }
    }
}
