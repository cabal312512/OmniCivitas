use crate::common::Request;
use crate::stock::Warehouse;
use serde_json::{json, Value};

pub fn inventory(store: &Warehouse, request: &Request, time: f32, events: Vec<Value>) -> Value {
    let bodies: Vec<Value> = request.world.bodies.iter().zip(&store.ordinal).map(|(spec,handle)| {
        let b=&store.bodies[*handle]; let p=b.translation();
        json!({"id":spec.id,"x":p.x,"y":p.y,"angle":b.rotation().angle(),
            "vx":b.linvel().x,"vy":b.linvel().y,"omega":b.angvel()})
    }).collect();
    json!({"t":time,"bodies":bodies,"events":events})
}
pub fn energy(store: &Warehouse, request: &Request) -> f64 {
    request.world.bodies.iter().zip(&store.ordinal).filter(|(b,_)|b.mode=="dynamic").map(|(spec,handle)| {
        let b=&store.bodies[*handle];
        0.5*spec.mass as f64*b.linvel().norm_squared() as f64
            +0.5*store.inertia[&spec.id] as f64*(b.angvel() as f64).powi(2)
            -(spec.mass*(request.world.gravity_x*b.translation().x+request.world.gravity_y*b.translation().y)) as f64
    }).sum()
}
pub fn finite(store: &Warehouse) -> bool {
    store.ordinal.iter().all(|h| {
        let b=&store.bodies[*h]; let p=b.translation();
        [p.x,p.y,b.rotation().angle(),b.linvel().x,b.linvel().y,b.angvel()].iter().all(|v|v.is_finite())
            && p.norm()<=10000.0 && b.linvel().norm()<=10000.0 && b.angvel().abs()<=10000.0
    })
}
pub fn checksum(request: &Request) -> String {
    let mut code=2166136261u32;
    let payload=serde_json::to_string(request).expect("finite validated request");
    let envelope=serde_json::to_string(&json!({"format":"stock/2","payload":payload})).expect("fixed envelope");
    let cell=format!("\"{}\"",envelope.replace('"',"\"\""));
    let restored=cell[1..cell.len()-1].replace("\"\"","\"");
    let invoice: Value=serde_json::from_str(&restored).expect("internal CSV cell round-trip");
    for b in invoice["payload"].as_str().expect("internal payload").bytes() { code=(code^b as u32).wrapping_mul(16777619); }
    format!("fnv1a32:{code:08x}")
}
