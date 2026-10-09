use crate::{run, Request};
use serde_json::{json, Value};
fn request(world: Value) -> Request {
    serde_json::from_value(json!({"schema":"ocv.workshop-run/1","op":"simulate","world":world})).unwrap()
}
fn body(id: &str, kind: &str, x: f32, y: f32) -> Value {
    json!({"id":id,"kind":kind,"x":x,"y":y,"linearDamping":0,"angularDamping":0})
}
fn pose(result: &Value, id: &str) -> Value {
    result["frames"].as_array().unwrap().last().unwrap()["bodies"].as_array().unwrap()
        .iter().find(|b|b["id"]==id).unwrap().clone()
}
#[test]
fn maximum_speed_includes_the_initial_recorded_state() {
    let r=request(json!({"gravityX":0,"gravityY":0,"durationS":0.1,"stepS":1.0/60.0,"sampleEvery":1,
        "bodies":[{"id":"ball","kind":"ball","y":2,"vx":10,"linearDamping":50,"angularDamping":0}]}));
    let result=run(&r);
    assert_eq!(result["ok"],true);
    assert_eq!(result["summary"]["maxSpeed"].as_f64().unwrap(),10.0);
    for frame in result["frames"].as_array().unwrap() {
        for b in frame["bodies"].as_array().unwrap() {
            let speed=b["vx"].as_f64().unwrap().hypot(b["vy"].as_f64().unwrap());
            assert!(result["summary"]["maxSpeed"].as_f64().unwrap()+1e-6>=speed);
        }
    }
}
#[test]
fn free_fall_and_refined_fixed_step() {
    let mut r=request(json!({"gravityY":-9.81,"durationS":1,"bodies":[body("ball","ball",0.,5.)]}));
    let coarse=run(&r);r.world.step_s=1./240.;let fine=run(&r);
    assert_eq!(coarse["ok"],true);assert_eq!(fine["ok"],true);
    let expected=5.-9.81/2.;
    let coarse_error=(pose(&coarse,"ball")["y"].as_f64().unwrap()-expected).abs();
    let fine_error=(pose(&fine,"ball")["y"].as_f64().unwrap()-expected).abs();
    assert!(coarse_error<0.09&&fine_error<coarse_error+0.002);
    assert!((pose(&fine,"ball")["vy"].as_f64().unwrap()+9.81).abs()<0.01);
}
#[test]
fn fixed_track_contact_and_bounded_frames() {
    let r=request(json!({"durationS":4,"sampleEvery":1,"bodies":[body("ball","ball",0.,3.),
        {"id":"floor","kind":"track","mode":"fixed","x":0,"y":0,"width":8,"height":0.4,"restitution":0}]}));
    let result=run(&r);assert_eq!(result["ok"],true);assert!(result["frames"].as_array().unwrap().len()<=256);
    assert!(result["summary"]["collisions"].as_u64().unwrap()>=1);
    let y=pose(&result,"ball")["y"].as_f64().unwrap();assert!((y-0.5).abs()<0.08);
    assert_eq!(pose(&result,"floor")["y"],0.0);
}
#[test]
fn revolute_anchor_and_torque_limited_drive() {
    let r=request(json!({"gravityY":0,"durationS":2,"bodies":[body("wheel","wheel",0.,2.),
        {"id":"anchor","kind":"box","mode":"fixed","x":0,"y":2}],
        "joints":[{"id":"j","kind":"hinge","a":"anchor","b":"wheel","anchorX":0,"anchorY":2}],
        "motors":[{"id":"m","body":"wheel","targetSpeed":3,"maxTorque":10}]}));
    let result=run(&r);assert_eq!(result["ok"],true);let b=pose(&result,"wheel");
    assert!(b["x"].as_f64().unwrap().abs()<0.02);assert!((b["y"].as_f64().unwrap()-2.).abs()<0.02);
    assert!((b["omega"].as_f64().unwrap()-3.).abs()<0.01);
    let mut low=r.clone();low.world.duration_s=0.1;low.world.motors[0].max_torque=0.001;
    let slow=pose(&run(&low),"wheel")["omega"].as_f64().unwrap();assert!(slow>0.&&slow<0.004);
}
#[test]
fn prismatic_axis_and_limits() {
    let mut box_body=body("s","slider",0.,1.);box_body["vx"]=json!(8);
    let r=request(json!({"durationS":1,"bodies":[{"id":"a","kind":"box","mode":"fixed","x":0,"y":1},box_body],
        "joints":[{"id":"j","kind":"slider","a":"a","b":"s","anchorX":0,"anchorY":1,"axisX":1,"axisY":0,"min":-1,"max":1}]}));
    let result=run(&r);assert_eq!(result["ok"],true);let p=pose(&result,"s");
    assert!((p["y"].as_f64().unwrap()-1.).abs()<0.03);assert!(p["x"].as_f64().unwrap()<=1.05);
}
#[test]
fn implicit_spring_and_bilateral_rod() {
    let mut r=request(json!({"gravityY":0,"durationS":2,"bodies":[{"id":"a","kind":"box","mode":"fixed"},body("b","ball",2.,0.)],
        "joints":[{"id":"j","kind":"spring","a":"a","b":"b","restLength":1,"stiffness":50,"damping":10}]}));
    let spring=run(&r);assert_eq!(spring["ok"],true);assert!((pose(&spring,"b")["x"].as_f64().unwrap()-1.).abs()<0.06);
    r.world.joints[0].kind="rod".into();r.world.gravity_y=-9.81;
    let rod=run(&r);assert_eq!(rod["ok"],true);let p=pose(&rod,"b");
    assert!((p["x"].as_f64().unwrap().hypot(p["y"].as_f64().unwrap())-1.).abs()<0.05);
}
#[test]
fn ideal_gear_and_belt_sign_and_ratio() {
    let mut a=body("a","gear",-2.,0.);a["omega"]=json!(3);
    let mut r=request(json!({"gravityY":0,"durationS":1,"bodies":[a,body("b","pulley",2.,0.)],
        "joints":[{"id":"j","kind":"gear","a":"a","b":"b","ratio":2}]}));
    let gears=run(&r);let pa=pose(&gears,"a");let pb=pose(&gears,"b");
    assert!((pb["omega"].as_f64().unwrap()+2.*pa["omega"].as_f64().unwrap()).abs()<1e-5);
    r.world.joints[0].kind="belt".into();let belts=run(&r);let pa=pose(&belts,"a");let pb=pose(&belts,"b");
    assert!((pb["omega"].as_f64().unwrap()-2.*pa["omega"].as_f64().unwrap()).abs()<1e-5);
}
#[test]
fn timer_actuator_and_snapshot_repeatability() {
    let r=request(json!({"gravityY":0,"durationS":2,"bodies":[body("w","wheel",0.,0.)],
        "motors":[{"id":"m","body":"w","targetSpeed":3}],
        "controls":[{"id":"c","kind":"timer","motor":"m","threshold":0.5,"action":"reverse","maxFirings":1}]}));
    let a=run(&r);let b=run(&r);assert_eq!(a,b);
    assert!(pose(&a,"w")["omega"].as_f64().unwrap() < -2.9);
    assert!(a["keyMoments"].as_array().unwrap().iter().any(|m|m["kind"]=="control"));
}
#[test]
fn contact_distance_and_count_controls_use_real_contact() {
    let r=request(json!({"durationS":3,"bodies":[body("ball","ball",0.,3.),body("wheel","wheel",5.,3.),
        {"id":"floor","kind":"track","mode":"fixed","width":6,"height":0.4}],
        "motors":[{"id":"m","body":"wheel","targetSpeed":3}],
        "controls":[
            {"id":"distance","kind":"distance","body":"ball","target":"floor","threshold":0.7,"motor":"m","action":"reverse"},
            {"id":"contact","kind":"contact","body":"ball","target":"floor","motor":"m","action":"reverse"},
            {"id":"count","kind":"count","body":"ball","target":"floor","threshold":1,"motor":"m","action":"reverse"}
        ]}));
    let result=run(&r);assert_eq!(result["ok"],true);
    for id in ["distance","contact","count"] {
        assert!(result["keyMoments"].as_array().unwrap().iter().any(|m|m["kind"]=="control"&&m["id"]==id),"{id}");
    }
}
#[test]
fn fixed_joint_preserves_initial_relative_transform() {
    let mut a=body("a","box",-1.,3.);a["angle"]=json!(0.4);
    let r=request(json!({"durationS":1,"bodies":[a,body("b","box",1.,3.)],
        "joints":[{"id":"fixed","kind":"fixed","a":"a","b":"b","anchorX":0,"anchorY":3}]}));
    let result=run(&r);assert_eq!(result["ok"],true);
    let a=pose(&result,"a");let b=pose(&result,"b");
    assert!((a["angle"].as_f64().unwrap()-b["angle"].as_f64().unwrap()-0.4).abs()<0.02);
    let distance=(a["x"].as_f64().unwrap()-b["x"].as_f64().unwrap()).hypot(a["y"].as_f64().unwrap()-b["y"].as_f64().unwrap());
    assert!((distance-2.).abs()<0.03);
}
#[test]
fn two_real_completable_challenges() {
    let mut delivery=request(json!({"durationS":4,"bodies":[body("ball","ball",-3.,5.),
        {"id":"floor","kind":"track","mode":"fixed","x":-3,"width":8,"height":0.4}]}));
    delivery.challenge=serde_json::from_value(json!({"id":"delivery","kind":"delivery","body":"ball","targetX":-3,"targetY":0.8,"tolerance":0.8,"minTime":1})).ok();
    assert_eq!(run(&delivery)["summary"]["challengeComplete"],true);
    let mut steady=request(json!({"gravityY":0,"durationS":4,"bodies":[body("w","wheel",0.,0.)],"motors":[{"id":"m","body":"w","targetSpeed":3}]}));
    steady.challenge=serde_json::from_value(json!({"id":"steady","kind":"steady","body":"w","minTime":2,"tolerance":0.6})).ok();
    assert_eq!(run(&steady)["summary"]["challengeComplete"],true);
}
#[test]
fn finite_parameter_experiment_and_diagnostics() {
    let mut r=request(json!({"gravityY":0,"durationS":0.2,"bodies":[body("w","wheel",0.,0.)],"motors":[{"id":"m","body":"w"}]}));
    r.op="scan".into();r.scan=serde_json::from_value(json!({"parameter":"motorSpeed","targetId":"m","values":[1,2,3],"trials":2})).ok();
    let result=run(&r);assert_eq!(result["ok"],true);assert_eq!(result["summary"]["runCount"],6);
    assert_eq!(result["scan"]["runs"][2]["value"].as_f64(),Some(2.0));assert!(result["scan"]["runs"][2]["trace"].as_array().unwrap().len()<=32);
    r.world.joints.push(serde_json::from_value(json!({"id":"bad","kind":"hinge","a":"w","b":"missing"})).unwrap());
    assert_eq!(run(&r)["ok"],false);
    let invalid=crate::run_bytes(br#"{"schema":"ocv.workshop-run/1","op":"simulate","world":{"bodies":[],"password":"private"}}"#);
    assert_eq!(serde_json::from_slice::<Value>(&invalid).unwrap()["diagnostics"][0]["code"],"JSON_MODEL");
}
#[test]
fn ordered_logic_waits_for_timer_and_real_contact_count() {
    let mut r=request(json!({"durationS":2,"bodies":[body("ball","ball",0.,3.),body("wheel","wheel",4.,3.),
        {"id":"floor","kind":"track","mode":"fixed","width":3,"height":0.4}],
        "motors":[{"id":"m","body":"wheel","enabled":false,"targetSpeed":3}],
        "controls":[{"id":"clock","kind":"timer","threshold":0.5,"action":"signal"},
            {"id":"received","kind":"count","body":"ball","target":"floor","threshold":1,"action":"signal"},
            {"id":"gate","kind":"logic","inputs":["clock","received"],"logic":"all","motor":"m","action":"start"}]}));
    let result=run(&r);assert_eq!(result["ok"],true);
    let moments=result["keyMoments"].as_array().unwrap();
    let count=moments.iter().find(|v|v["id"]=="received").unwrap()["t"].as_f64().unwrap();
    let gate=moments.iter().find(|v|v["id"]=="gate").unwrap()["t"].as_f64().unwrap();
    assert!(gate>=count&&gate>=0.5);assert!(pose(&result,"wheel")["omega"].as_f64().unwrap()>2.9);
    r.world.controls[0].kind="logic".into();r.world.controls[0].inputs=vec!["gate".into()];
    assert_eq!(run(&r)["ok"],false,"Forward/cyclic signals must be rejected");
}
#[test]
fn any_and_not_logic_use_current_distance_and_latched_clock() {
    let r=request(json!({"gravityY":0,"durationS":1,"bodies":[body("w","wheel",0.,0.),{"id":"target","kind":"box","mode":"fixed","x":4}],
        "motors":[{"id":"m","body":"w","enabled":false}],
        "controls":[{"id":"far","kind":"distance","body":"w","target":"target","threshold":1,"action":"signal"},
            {"id":"near_not","kind":"logic","inputs":["far"],"logic":"not","action":"signal"},
            {"id":"later","kind":"timer","threshold":0.5,"action":"signal"},
            {"id":"drive","kind":"logic","inputs":["near_not","later"],"logic":"any","motor":"m","action":"start"}]}));
    let out=run(&r);assert_eq!(out["ok"],true);
    let event=out["keyMoments"].as_array().unwrap().iter().find(|v|v["id"]=="drive").unwrap();
    assert!(event["t"].as_f64().unwrap()<0.02);assert!(pose(&out,"w")["omega"].as_f64().unwrap()>2.9);
}
#[test]
fn routing_needs_all_distinct_destinations_and_crossing_respects_budget() {
    let mut route=request(json!({"durationS":4,"bodies":[body("left","ball",-2.,3.),body("right","ball",2.,4.),
        {"id":"floor","kind":"track","mode":"fixed","width":9,"height":0.4}]}));
    route.challenge=serde_json::from_value(json!({"id":"route","kind":"routing","body":"left","minTime":1,
        "targets":[{"body":"left","targetX":-2,"targetY":0.5,"tolerance":0.6},{"body":"right","targetX":2,"targetY":0.5,"tolerance":0.6}]})).ok();
    assert_eq!(run(&route)["summary"]["challengeComplete"],true);
    route.challenge.as_mut().unwrap().targets[1].target_x=-2.;
    assert_eq!(run(&route)["summary"]["challengeComplete"],false);
    let mut crossing=request(json!({"gravityY":0,"durationS":3,"bodies":[{"id":"traveller","kind":"ball","x":-2,"y":2,"vx":2,"linearDamping":0}]}));
    crossing.challenge=serde_json::from_value(json!({"id":"cross","kind":"crossing","body":"traveller","targetX":2,"targetY":2,"tolerance":0.2,"minTime":1,"maxParts":1})).ok();
    assert_eq!(run(&crossing)["summary"]["challengeComplete"],true);
    crossing.world.bodies.push(serde_json::from_value(body("extra","ball",10.,2.)).unwrap());
    let over=run(&crossing);assert_eq!(over["ok"],true);assert_eq!(over["summary"]["challengeComplete"],false);
    crossing.world.bodies[0].x=2.;assert_eq!(run(&crossing)["ok"],false,"A destination cannot also be the starting position");
}
#[test]
fn partial_scan_preserves_failure_rows_and_real_endpoints() {
    let mut r=request(json!({"gravityY":0,"durationS":20,"bodies":[{"id":"traveller","kind":"ball","y":100,"vx":100,"linearDamping":0}]}));
    r.op="scan".into();r.scan=serde_json::from_value(json!({"parameter":"gravityY","values":[0,100],"trials":1})).ok();
    let out=run(&r);assert_eq!(out["ok"],false);assert_eq!(out["summary"]["failedRuns"],1);
    let rows=out["scan"]["runs"].as_array().unwrap();assert_eq!(rows.len(),2);
    assert_eq!(rows[0]["ok"],true);assert_eq!(rows[1]["ok"],false);
    assert!(rows[1]["diagnostics"].as_array().unwrap().iter().any(|v|v["code"]=="NUMERICAL_LIMIT"));
    for row in rows { assert!(row["trace"].as_array().unwrap().len()<=32);assert_eq!(row["sampling"]["includesLastRetainedFrame"],true); }
    assert_eq!(out["scan"]["valueSummary"][1]["failed"],1);
}
#[test]
fn rod_pushes_compression_and_pulls_extension() {
    for (start,speed) in [(0.4,-4.0),(3.5,4.0)] {
        let mut moving=body("b","ball",start,0.);moving["vx"]=json!(speed);moving["mass"]=json!(2);
        let r=request(json!({"durationS":1,"gravityY":0,"bodies":[{"id":"a","kind":"box","mode":"fixed"},moving],
            "joints":[{"id":"rod","kind":"rod","a":"a","b":"b","restLength":2}]}));
        let result=run(&r);assert_eq!(result["ok"],true);
        let b=pose(&result,"b");assert!((b["x"].as_f64().unwrap()-2.).abs()<0.003);
        assert!(b["vx"].as_f64().unwrap().abs()<0.03);assert_eq!(pose(&result,"a")["x"],0.0);
    }
}
#[test]
fn rod_two_dynamic_masses_preserve_momentum_and_center_of_mass() {
    let mut a=body("a","ball",0.,0.);a["vx"]=json!(-1);a["mass"]=json!(1);
    let mut b=body("b","ball",0.5,0.);b["vx"]=json!(1);b["mass"]=json!(3);
    let r=request(json!({"durationS":1,"gravityY":0,"bodies":[a,b],
        "joints":[{"id":"rod","kind":"rod","a":"a","b":"b","restLength":2}]}));
    let result=run(&r);assert_eq!(result["ok"],true);let a=pose(&result,"a");let b=pose(&result,"b");
    assert!(((b["x"].as_f64().unwrap()-a["x"].as_f64().unwrap()).abs()-2.).abs()<0.004);
    assert!((a["vx"].as_f64().unwrap()+3.*b["vx"].as_f64().unwrap()-2.).abs()<0.003);
    let center=(a["x"].as_f64().unwrap()+3.*b["x"].as_f64().unwrap())/4.;
    assert!((center-(0.375+0.5*result["summary"]["durationS"].as_f64().unwrap())).abs()<0.006);
}
#[test]
fn rod_supports_reversed_fixed_endpoint_and_collapsed_start() {
    for (start,reverse) in [(0.5,true),(0.0,false)] {
        let fixed=json!({"id":"a","kind":"box","mode":"fixed"});let moving=body("b","ball",start,0.);
        let (a,b)=if reverse {("b","a")} else {("a","b")};
        let r=request(json!({"durationS":1,"gravityY":0,"bodies":[fixed,moving],
            "joints":[{"id":"rod","kind":"rod","a":a,"b":b,"restLength":1}]}));
        let result=run(&r);assert_eq!(result["ok"],true);let b=pose(&result,"b");
        assert!((b["x"].as_f64().unwrap().hypot(b["y"].as_f64().unwrap())-1.).abs()<0.003);
        assert!(b["vx"].as_f64().unwrap().abs()<0.03);
    }
}
#[test]
fn rod_radial_axis_follows_swing_instead_of_locking_horizontal_separation() {
    let length=2.0f32;let x=0.7f32;let y=3.0-(length*length-x*x).sqrt();
    let mut bob=body("bob","ball",x,y);bob["vx"]=json!(1);bob["vy"]=json!(x/(length*length-x*x).sqrt());
    let r=request(json!({"durationS":4,"bodies":[{"id":"anchor","kind":"box","mode":"fixed","y":3},bob],
        "joints":[{"id":"rod","kind":"rod","a":"anchor","b":"bob","restLength":2}]}));
    let result=run(&r);assert_eq!(result["ok"],true);let mut xmin=1e9f64;let mut xmax=-1e9f64;
    for f in result["frames"].as_array().unwrap() {
        let b=f["bodies"].as_array().unwrap().iter().find(|v|v["id"]=="bob").unwrap();
        let x=b["x"].as_f64().unwrap();let y=b["y"].as_f64().unwrap();
        assert!((x.hypot(y-3.)-2.).abs()<0.02);xmin=xmin.min(x);xmax=xmax.max(x);
    }
    assert!(xmax-xmin>1.0);
}
#[test]
fn incompatible_fixed_rod_has_explicit_diagnostic() {
    let r=request(json!({"durationS":1,"gravityY":0,"bodies":[{"id":"a","kind":"box","mode":"fixed"},
        {"id":"b","kind":"box","mode":"fixed","x":0.5}],"joints":[{"id":"r","kind":"rod","a":"a","b":"b","restLength":2}]}));
    let result=run(&r);assert_eq!(result["ok"],false);
    assert_eq!(result["diagnostics"][0]["code"],"ROD_FIXED_CONFLICT");
}
