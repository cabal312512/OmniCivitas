use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeSet;

pub const ENGINE: &str = "ME1 / Rapier 2D";
pub const VERSION: &str = "ocv-mechanics-1.1.1+rapier-0.22.0.rod-radial-1.control-dag-1.initial-speed-1";
fn all() -> String { "all".into() }
fn one() -> f32 { 1.0 }
fn radius() -> f32 { 0.3 }
fn width() -> f32 { 1.0 }
fn height() -> f32 { 0.3 }
fn friction() -> f32 { 0.4 }
fn restitution() -> f32 { 0.15 }
fn damping() -> f32 { 0.02 }
fn dynamic() -> String { "dynamic".into() }
fn colour() -> String { "#2479ed".into() }
fn gravity() -> f32 { -9.81 }
fn dt() -> f32 { 1.0 / 120.0 }
fn duration() -> f32 { 8.0 }
fn every() -> usize { 8 }
fn seed() -> u32 { 1 }
fn speed() -> f32 { 3.0 }
fn torque() -> f32 { 10.0 }
fn yes() -> bool { true }
fn stiffness() -> f32 { 80.0 }
fn spring_damping() -> f32 { 2.0 }
fn minimum() -> f32 { -10.0 }
fn maximum() -> f32 { 10.0 }
fn firings() -> usize { 1 }
fn tolerance() -> f32 { 0.6 }
fn minimum_time() -> f32 { 1.0 }

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Body {
    pub id: String, pub kind: String,
    #[serde(default = "dynamic")] pub mode: String,
    #[serde(default)] pub x: f32, #[serde(default)] pub y: f32,
    #[serde(default)] pub angle: f32,
    #[serde(default = "width")] pub width: f32,
    #[serde(default = "height")] pub height: f32,
    #[serde(default = "radius")] pub radius: f32,
    #[serde(default = "one")] pub mass: f32,
    #[serde(default = "friction")] pub friction: f32,
    #[serde(default = "restitution")] pub restitution: f32,
    #[serde(default = "damping")] pub linear_damping: f32,
    #[serde(default = "damping")] pub angular_damping: f32,
    #[serde(default)] pub vx: f32, #[serde(default)] pub vy: f32,
    #[serde(default)] pub omega: f32,
    #[serde(default)] pub layer: usize, #[serde(default)] pub group: String,
    #[serde(default)] pub label: String, #[serde(default = "colour")] pub colour: String,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Joint {
    pub id: String, pub kind: String, pub a: String, pub b: String,
    #[serde(default)] pub anchor_x: f32, #[serde(default)] pub anchor_y: f32,
    #[serde(default = "one")] pub axis_x: f32, #[serde(default)] pub axis_y: f32,
    #[serde(default = "one")] pub rest_length: f32,
    #[serde(default = "stiffness")] pub stiffness: f32,
    #[serde(default = "spring_damping")] pub damping: f32,
    #[serde(default = "one")] pub ratio: f32,
    #[serde(default = "minimum")] pub min: f32,
    #[serde(default = "maximum")] pub max: f32,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Motor {
    pub id: String, pub body: String,
    #[serde(default = "speed")] pub target_speed: f32,
    #[serde(default = "torque")] pub max_torque: f32,
    #[serde(default = "yes")] pub enabled: bool,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Control {
    pub id: String, pub kind: String, #[serde(default)] pub motor: String,
    #[serde(default)] pub body: String, #[serde(default)] pub target: String,
    #[serde(default = "one")] pub threshold: f32,
    pub action: String, #[serde(default = "firings")] pub max_firings: usize,
    #[serde(default)] pub inputs: Vec<String>, #[serde(default = "all")] pub logic: String,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct World {
    #[serde(default)] pub gravity_x: f32, #[serde(default = "gravity")] pub gravity_y: f32,
    #[serde(default = "dt")] pub step_s: f32,
    #[serde(default = "duration")] pub duration_s: f32,
    #[serde(default = "every")] pub sample_every: usize,
    #[serde(default = "seed")] pub seed: u32,
    pub bodies: Vec<Body>, #[serde(default)] pub joints: Vec<Joint>,
    #[serde(default)] pub motors: Vec<Motor>, #[serde(default)] pub controls: Vec<Control>,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Challenge {
    pub id: String, pub kind: String, pub body: String,
    #[serde(default)] pub target_x: f32, #[serde(default)] pub target_y: f32,
    #[serde(default = "tolerance")] pub tolerance: f32,
    #[serde(default = "minimum_time")] pub min_time: f32,
    #[serde(default)] pub targets: Vec<Destination>, #[serde(default)] pub max_parts: usize,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Destination {
    pub body: String, pub target_x: f32, pub target_y: f32,
    #[serde(default = "tolerance")] pub tolerance: f32,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Scan {
    pub parameter: String, #[serde(default)] pub target_id: String,
    pub values: Vec<f32>, #[serde(default = "firings")] pub trials: usize,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Request {
    pub schema: String, pub op: String, pub world: World,
    #[serde(default)] pub challenge: Option<Challenge>,
    #[serde(default)] pub scan: Option<Scan>,
}
pub fn diagnostic(code: &str, message: &str, element: Option<&str>) -> Value {
    let mut value = json!({"code":code,"message":message});
    if let Some(id) = element { value["element"] = json!(id); } value
}
fn number(value: f32, low: f32, high: f32) -> bool {
    value.is_finite() && value >= low && value <= high
}
pub fn identifier(id: &str) -> bool {
    !id.is_empty() && id.len() <= 32 && id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
}
pub fn validate(request: &Request) -> Vec<Value> {
    let mut out = Vec::new(); let w = &request.world;
    if request.schema != "ocv.workshop-run/1" || !["simulate", "scan"].contains(&request.op.as_str()) {
        out.push(diagnostic("SCHEMA", "Use ocv.workshop-run/1 and a supported operation", None));
    }
    let steps = (w.duration_s as f64 / w.step_s as f64).ceil();
    if !number(w.step_s, 1.0/240.0 - 1e-8, 1.0/30.0 + 1e-8) || !number(w.duration_s, 0.05, 20.0)
        || !number(w.gravity_x,-100.0,100.0) || !number(w.gravity_y,-100.0,100.0)
        || steps > 4800.0 || w.sample_every == 0 || w.sample_every > 4800 {
        out.push(diagnostic("TIME_LIMIT", "Invalid fixed step, gravity, duration or sampling interval", None));
    }
    if w.bodies.is_empty() || w.bodies.len() > 64 || w.joints.len() > 64 || w.motors.len() > 8 || w.controls.len() > 16 {
        out.push(diagnostic("WORLD_LIMIT", "World accepts 1–64 bodies, 64 joints, 8 motors and 16 controls", None));
    }
    let mut ids = BTreeSet::new();
    for b in &w.bodies {
        if !identifier(&b.id) || !ids.insert(b.id.as_str()) {
            out.push(diagnostic("BODY_ID", "Body identifiers must be unique ASCII identifiers of at most 32 bytes", Some(&b.id)));
        }
        if !["ball","box","track","wheel","link","slider","gear","pulley"].contains(&b.kind.as_str())
            || !["dynamic","fixed"].contains(&b.mode.as_str()) {
            out.push(diagnostic("BODY_KIND", "Unsupported rigid body or motion mode", Some(&b.id)));
        }
        let valid = number(b.x,-100.0,100.0) && number(b.y,-100.0,100.0) && number(b.angle,-1000.0,1000.0)
            && number(b.width,0.01,50.0) && number(b.height,0.01,50.0) && number(b.radius,0.01,50.0)
            && number(b.mass,0.001,10000.0) && number(b.friction,0.0,2.0) && number(b.restitution,0.0,1.0)
            && number(b.linear_damping,0.0,100.0) && number(b.angular_damping,0.0,100.0)
            && number(b.vx,-100.0,100.0) && number(b.vy,-100.0,100.0) && number(b.omega,-200.0,200.0)
            && b.layer <= 32 && b.group.len() <= 64 && b.label.len() <= 64
            && b.colour.len() == 7 && b.colour.starts_with('#') && b.colour[1..].bytes().all(|c|c.is_ascii_hexdigit());
        if !valid { out.push(diagnostic("BODY_PARAMETER", "Invalid SI parameter, display label or colour", Some(&b.id))); }
    }
    let mut joint_ids = BTreeSet::new();
    for j in &w.joints {
        let valid = identifier(&j.id) && joint_ids.insert(j.id.as_str()) && ids.contains(j.a.as_str()) && ids.contains(j.b.as_str())
            && j.a != j.b && ["hinge","slider","spring","rod","fixed","gear","belt"].contains(&j.kind.as_str())
            && number(j.anchor_x,-100.0,100.0) && number(j.anchor_y,-100.0,100.0)
            && number(j.axis_x,-100.0,100.0) && number(j.axis_y,-100.0,100.0)
            && (j.kind != "slider" || j.axis_x.hypot(j.axis_y) > 1e-5)
            && number(j.rest_length,0.001,100.0) && number(j.stiffness,0.0,10000.0)
            && number(j.damping,0.0,10000.0) && number(j.ratio,-20.0,20.0) && j.ratio.abs() >= 0.01
            && number(j.min,-100.0,100.0) && number(j.max,-100.0,100.0) && j.min <= j.max;
        if !valid { out.push(diagnostic("JOINT_CONNECTION", "Unknown, duplicate, self-connected or invalid constraint", Some(&j.id))); }
        if valid && j.kind == "rod" {
            let a = w.bodies.iter().find(|b|b.id == j.a).unwrap();
            let b = w.bodies.iter().find(|b|b.id == j.b).unwrap();
            if a.mode == "fixed" && b.mode == "fixed" && ((b.x-a.x).hypot(b.y-a.y)-j.rest_length).abs() > 1e-4 {
                out.push(diagnostic("ROD_FIXED_CONFLICT", "Two fixed centers cannot satisfy the requested rod length", Some(&j.id)));
            }
        }
    }
    let mut motor_ids = BTreeSet::new();
    for m in &w.motors {
        let valid = identifier(&m.id) && motor_ids.insert(m.id.as_str()) && w.bodies.iter().any(|b|b.id == m.body && b.mode == "dynamic")
            && number(m.target_speed,-100.0,100.0) && number(m.max_torque,0.001,10000.0);
        if !valid { out.push(diagnostic("MOTOR", "Motor must address a dynamic body and finite speed/torque", Some(&m.id))); }
    }
    let mut control_ids = BTreeSet::new();
    for c in &w.controls {
        let is_logic = c.kind == "logic";
        let references = c.inputs.iter().all(|id| control_ids.contains(id.as_str()));
        let mut valid = identifier(&c.id) && !control_ids.contains(c.id.as_str())
            && (c.action == "signal" && (c.motor.is_empty() || motor_ids.contains(c.motor.as_str())) || motor_ids.contains(c.motor.as_str()))
            && ["timer","contact","distance","count","logic"].contains(&c.kind.as_str()) && ["start","stop","reverse","signal"].contains(&c.action.as_str())
            && number(c.threshold,0.0,10000.0) && (1..=32).contains(&c.max_firings);
        if is_logic {
            valid &= references && (1..=4).contains(&c.inputs.len()) && ["all","any","not"].contains(&c.logic.as_str())
                && (c.logic != "not" || c.inputs.len() == 1)
                && c.inputs.iter().collect::<BTreeSet<_>>().len() == c.inputs.len();
        } else { valid &= c.inputs.is_empty() && c.logic == "all"; }
        if !["timer","logic"].contains(&c.kind.as_str()) { valid &= ids.contains(c.body.as_str()); }
        if ["contact","distance"].contains(&c.kind.as_str()) || !c.target.is_empty() { valid &= ids.contains(c.target.as_str()); }
        if !c.body.is_empty() { valid &= ids.contains(c.body.as_str()); }
        control_ids.insert(c.id.as_str());
        if !valid { out.push(diagnostic("CONTROL", "Invalid bounded sensor/actuator connection", Some(&c.id))); }
    }
    if let Some(c) = &request.challenge {
        let mut valid = identifier(&c.id) && ids.contains(c.body.as_str()) && ["delivery","steady","routing","crossing"].contains(&c.kind.as_str())
            && number(c.target_x,-100.0,100.0) && number(c.target_y,-100.0,100.0)
            && number(c.tolerance,0.001,50.0) && number(c.min_time,0.0,20.0)
            && (c.kind != "steady" || w.motors.iter().any(|m|m.body == c.body));
        if c.kind == "routing" {
            let mut targets = BTreeSet::new();
            valid &= (2..=8).contains(&c.targets.len()) && c.targets.iter().any(|t| t.body == c.body)
                && c.targets.iter().all(|t| targets.insert(t.body.as_str())
                    && w.bodies.iter().any(|b|b.id == t.body && b.mode == "dynamic")
                    && number(t.target_x,-100.0,100.0) && number(t.target_y,-100.0,100.0)
                    && number(t.tolerance,0.001,50.0));
        } else { valid &= c.targets.is_empty(); }
        if c.kind == "crossing" {
            valid &= (1..=64).contains(&c.max_parts)
                && w.bodies.iter().any(|b| b.id == c.body && b.mode == "dynamic" && b.x < c.target_x-c.tolerance);
        } else { valid &= c.max_parts == 0; }
        if !valid { out.push(diagnostic("CHALLENGE", "Invalid challenge target or missing drive", Some(&c.id))); }
    }
    if request.op == "scan" {
        let valid = request.scan.as_ref().is_some_and(|s| {
            let (low, high, target) = match s.parameter.as_str() {
                "motorSpeed" => (-100.0,100.0,motor_ids.contains(s.target_id.as_str())),
                "restitution" => (0.0,1.0,ids.contains(s.target_id.as_str())),
                "gravityY" => (-100.0,100.0,true), _ => (0.0,0.0,false),
            };
            target && (1..=9).contains(&s.values.len()) && (1..=3).contains(&s.trials)
                && s.values.iter().all(|v|number(*v,low,high))
        });
        if !valid { out.push(diagnostic("SCAN_LIMIT", "Scan accepts up to 9 values and 3 explicit initial-condition trials", None)); }
    }
    out
}
