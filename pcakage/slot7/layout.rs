use crate::common::{diagnostic, validate, Request, ENGINE, VERSION};
use crate::{aaa, old, stock};
use rapier2d::prelude::*;
use serde_json::{json, Value};
use std::collections::BTreeSet;

pub fn run_bytes(input: &[u8]) -> Vec<u8> {
    let output = if input.len()>262144 {
        failure(vec![diagnostic("INPUT_LIMIT","Input is limited to 256 KiB",None)])
    } else {
        match serde_json::from_slice::<Request>(input) {
            Ok(request)=>run(&request),
            Err(_)=>failure(vec![diagnostic("JSON_MODEL","Malformed, unknown-field or incomplete workshop request",None)]),
        }
    };
    let result=serde_json::to_vec(&output).unwrap_or_else(|_|b"{\"ok\":false}".to_vec());
    if result.len()>4194304 {
        serde_json::to_vec(&failure(vec![diagnostic("OUTPUT_LIMIT","Result exceeds 4 MiB",None)])).unwrap()
    } else { result }
}
fn failure(diagnostics: Vec<Value>) -> Value {
    json!({"schema":"ocv.workshop-result/1","ok":false,"engine":ENGINE,"version":VERSION,
        "diagnostics":diagnostics,"frames":[],"summary":{"challengeComplete":false,"complete":false}})
}
pub fn run(request: &Request) -> Value {
    let diagnostics=validate(request); if !diagnostics.is_empty() {return failure(diagnostics);}
    if request.op=="scan" { return scan(request); } simulate(request)
}
fn simulate(request: &Request) -> Value {
    let w=&request.world; let steps=(w.duration_s as f64/w.step_s as f64).ceil() as usize;
    let every=w.sample_every.max(steps.div_ceil(255));
    let mut store=stock::Warehouse::receive(request);
    let mut pipeline=PhysicsPipeline::new(); let mut islands=IslandManager::new();
    let mut broad=BroadPhaseMultiSap::new(); let mut narrow=NarrowPhase::new(); let mut ccd=CCDSolver::new();
    let mut parameters=IntegrationParameters::default(); parameters.dt=w.step_s;
    let gravity=vector![w.gravity_x,w.gravity_y];
    let mut counter=old::Common::new(); let mut frames=vec![aaa::inventory(&store,request,0.0,Vec::new())];
    let initial_energy=aaa::energy(&store,request); let mut diagnostics=Vec::new(); let mut pending=Vec::new();
    let mut maximum_speed=store.ordinal.iter().map(|h|store.bodies[*h].linvel().norm()).fold(0.0f32,f32::max);
    let mut last_step=0usize; let mut complete=true;
    for i in 1..=steps {
        store.dispatch(w.step_s);
        pipeline.step(&gravity,&parameters,&mut islands,&mut broad,&mut narrow,&mut store.bodies,
            &mut store.colliders,&mut store.joints,&mut store.multi,&mut ccd,None,&(),&());
        store.reconcile(); last_step=i;
        if !aaa::finite(&store) {
            diagnostics.push(diagnostic("NUMERICAL_LIMIT","Non-finite or unbounded motion; partial run retained",None));
            complete=false;break;
        }
        for h in &store.ordinal { maximum_speed=maximum_speed.max(store.bodies[*h].linvel().norm()); }
        let mut pairs=BTreeSet::new();
        for pair in narrow.contact_pairs().filter(|p|p.has_any_active_contact) {
            let a=store.colliders[pair.collider1].user_data as usize; let b=store.colliders[pair.collider2].user_data as usize;
            let ia=&w.bodies[a].id;let ib=&w.bodies[b].id;
            pairs.insert(if ia<ib {(ia.clone(),ib.clone())} else {(ib.clone(),ia.clone())});
        }
        let events=counter.read(i as f32*w.step_s,pairs,&w.controls,request.challenge.as_ref(),&mut store);
        let remaining=64usize.saturating_sub(pending.len()); pending.extend(events.into_iter().take(remaining));
        if i%every==0 || i==steps {frames.push(aaa::inventory(&store,request,i as f32*w.step_s,std::mem::take(&mut pending)));}
    }
    if !complete && aaa::finite(&store) {frames.push(aaa::inventory(&store,request,last_step as f32*w.step_s,pending));}
    if !store.transmissions.is_empty() {diagnostics.push(diagnostic("IDEAL_TRANSMISSION","Gear/belt uses an ideal angular-velocity ratio, not tooth contact or slip",None));}
    if counter.events>128 {diagnostics.push(diagnostic("EVENT_PREVIEW_LIMIT","Key moments are a bounded first-128 preview; event totals include later events",None));}
    let last_time=last_step as f32*w.step_s;
    json!({"schema":"ocv.workshop-result/1","ok":complete,"engine":ENGINE,"version":VERSION,
        "diagnostics":diagnostics,"frames":frames,
        "summary":{"complete":complete,"challengeComplete":counter.completed,"completionTime":counter.completion_time,
            "steps":last_step,"sampleEvery":every,"frameCount":frames.len(),"durationS":last_time,"stepS":w.step_s,
            "collisions":counter.collisions,"eventCount":counter.events,"maxSpeed":maximum_speed,
            "initialEnergyJ":initial_energy,"finalEnergyJ":aaa::energy(&store,request),
            "seed":w.seed,"inputChecksum":aaa::checksum(request)},
        "keyMoments":counter.moments,
        "model":{"dimension":2,"units":{"length":"m","mass":"kg","time":"s","angle":"rad","torque":"N m"},
            "control":"ordered acyclic <=16-node graph; <=4 earlier inputs; timer/count latched, contact/distance current-state; finite rising-edge logic actuators",
            "challenge":"delivery/routing need <2 m/s and 0.1 s dwell; crossing needs 0.1 s inside destination and a dynamic-body budget; steady needs 0.5 s speed dwell",
            "rigidBodies":"ball or cuboid; finite Coulomb friction and restitution",
            "rod":"bilateral radial linear row aligned to center separation each fixed step; finite solver tolerance","spring":"implicit spring-damper between body centers",
            "motor":"bounded torque impulse toward target body angular speed",
            "transmission":"ideal angular velocity ratio; three ordered projections per half-step",
            "presentation3D":"appearance only; not a spatial mechanism solve","crossPlatformBitwiseIdentity":false}})
}
fn scan(request: &Request) -> Value {
    let spec=request.scan.as_ref().expect("validated scan");let mut runs=Vec::new();let mut passed=0usize;let mut succeeded=0usize;
    for (value_index,value) in spec.values.iter().enumerate() {
        for trial in 0..spec.trials {
            let mut sub=request.clone();sub.op="simulate".into();sub.scan=None;
            match spec.parameter.as_str() {
                "gravityY"=>sub.world.gravity_y=*value,
                "motorSpeed"=>sub.world.motors.iter_mut().find(|m|m.id==spec.target_id).unwrap().target_speed=*value,
                "restitution"=>sub.world.bodies.iter_mut().find(|b|b.id==spec.target_id).unwrap().restitution=*value,
                _=>unreachable!(),
            }
            let mut random=sub.world.seed.wrapping_add(trial as u32 * 7919);let mut perturbation=0.0f32;
            if spec.trials>1 {
                random ^= random<<13;random ^=random>>17;random ^=random<<5;
                perturbation=((random as f64/u32::MAX as f64)-0.5) as f32*0.02;
                if let Some(b)=sub.world.bodies.iter_mut().find(|b|b.mode=="dynamic") {
                    let before=b.vx;b.vx=(b.vx+perturbation).clamp(-100.0,100.0);perturbation=b.vx-before;
                }
            }
            sub.world.seed=random;
            let result=simulate(&sub);let ok=result["ok"].as_bool().unwrap_or(false);
            let challenge=result["summary"]["challengeComplete"].as_bool().unwrap_or(false);
            if ok {succeeded+=1;}if ok&&challenge {passed+=1;}
            let frames=result["frames"].as_array().unwrap();
            let stride=frames.len().div_ceil(31).max(1);
            let body=request.challenge.as_ref().map(|c|c.body.as_str()).unwrap_or_else(||request.world.bodies.iter().find(|b|b.mode=="dynamic").unwrap_or(&request.world.bodies[0]).id.as_str());
            let mut sample_indices: BTreeSet<usize> = (0..frames.len()).step_by(stride).collect();
            if !frames.is_empty() { sample_indices.insert(frames.len()-1); }
            let trace:Vec<Value>=sample_indices.into_iter().filter_map(|index| {
                let f=&frames[index];
                f["bodies"].as_array()?.iter().find(|b|b["id"].as_str()==Some(body))
                    .map(|b|json!({"t":f["t"],"x":b["x"],"y":b["y"],"omega":b["omega"]}))
            }).collect();
            runs.push(json!({"index":runs.len(),"valueIndex":value_index,"value":value,"trial":trial,"ok":ok,
                "seed":random,"initialVxPerturbation":perturbation,"summary":result["summary"],"diagnostics":result["diagnostics"],"traceBody":body,"trace":trace,
                "sampling":{"sourceSampleEvery":result["summary"]["sampleEvery"],"traceStrideFrames":stride,"includesLastRetainedFrame":true,"completeRunEndpoint":ok}}));
        }
    }
    let n=runs.len();
    let value_summary: Vec<Value> = spec.values.iter().enumerate().map(|(index,value)| {
        let rows: Vec<&Value> = runs.iter().filter(|row|row["valueIndex"].as_u64()==Some(index as u64)).collect();
        let computed=rows.iter().filter(|r|r["ok"]==true).count();
        let achieved=rows.iter().filter(|r|r["ok"]==true && r["summary"]["challengeComplete"]==true).count();
        let times: Vec<f64>=rows.iter().filter(|r|r["ok"]==true).filter_map(|r|r["summary"]["completionTime"].as_f64()).collect();
        json!({"valueIndex":index,"value":value,"trials":rows.len(),"computed":computed,"failed":rows.len()-computed,
            "challengeCompletions":achieved,"challengeSuccessRate":achieved as f64/rows.len() as f64,
            "meanCompletionTimeS":if times.is_empty(){None}else{Some(times.iter().sum::<f64>()/times.len() as f64)}})
    }).collect();
    json!({"schema":"ocv.workshop-result/1","ok":succeeded==n,"engine":ENGINE,"version":VERSION,
        "diagnostics":[],"frames":[],"summary":{"complete":succeeded==n,"runCount":n,"successfulRuns":succeeded,
            "failedRuns":n-succeeded,"challengeCompletions":passed,"successRate":passed as f64/n as f64,
            "inputChecksum":aaa::checksum(request)},
        "model":{"dimension":2,"units":{"length":"m","mass":"kg","time":"s","angle":"rad"},
            "sampling":"up to 256 physics frames and 32 endpoint-inclusive trace frames per run", "scan":"one explicit parameter by up to three deterministic initial-condition trials; not Monte Carlo confidence intervals"},
        "scan":{"parameter":spec.parameter,"targetId":spec.target_id,"runs":runs,"valueSummary":value_summary,
            "trialModel":"deterministic initial horizontal velocity perturbation <= 0.01 m/s when trials > 1; no random collision law",
            "complete":succeeded==n}})
}
