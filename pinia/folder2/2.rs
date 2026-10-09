use crate::common::{Body, Joint, Motor, Request};
use rapier2d::prelude::*;
use std::collections::BTreeMap;

pub struct Warehouse {
    pub bodies: RigidBodySet, pub colliders: ColliderSet,
    pub joints: ImpulseJointSet, pub multi: MultibodyJointSet,
    pub keys: BTreeMap<String, RigidBodyHandle>,
    pub ordinal: Vec<RigidBodyHandle>,
    pub inertia: BTreeMap<String, f32>,
    pub transmissions: Vec<Joint>, pub drives: Vec<Motor>,
    pub rods: Vec<(Joint, ImpulseJointHandle)>,
}
pub fn circular(b: &Body) -> bool { ["ball","wheel","gear","pulley"].contains(&b.kind.as_str()) }
pub fn moment(b: &Body) -> f32 {
    if b.mode == "fixed" { return 0.0; }
    if circular(b) { b.mass * b.radius * b.radius / 2.0 }
    else { b.mass * (b.width * b.width + b.height * b.height) / 12.0 }
}
impl Warehouse {
    pub fn receive(request: &Request) -> Self {
        let mut store = Self {
            bodies: RigidBodySet::new(), colliders: ColliderSet::new(), joints: ImpulseJointSet::new(),
            multi: MultibodyJointSet::new(), keys: BTreeMap::new(), ordinal: Vec::new(),
            inertia: BTreeMap::new(), transmissions: Vec::new(), drives: request.world.motors.clone(),
            rods: Vec::new(),
        };
        for (i, b) in request.world.bodies.iter().enumerate() {
            let builder = if b.mode == "fixed" { RigidBodyBuilder::fixed() } else { RigidBodyBuilder::dynamic() };
            let handle = store.bodies.insert(builder.translation(vector![b.x,b.y]).rotation(b.angle)
                .linvel(vector![b.vx,b.vy]).angvel(b.omega).linear_damping(b.linear_damping)
                .angular_damping(b.angular_damping).ccd_enabled(true).can_sleep(false).user_data(i as u128).build());
            let shape = if circular(b) { ColliderBuilder::ball(b.radius) } else { ColliderBuilder::cuboid(b.width/2.0,b.height/2.0) };
            let collider = shape.mass(b.mass).friction(b.friction).restitution(b.restitution)
                .restitution_combine_rule(CoefficientCombineRule::Max).user_data(i as u128).build();
            store.colliders.insert_with_parent(collider,handle,&mut store.bodies);
            store.keys.insert(b.id.clone(),handle); store.ordinal.push(handle); store.inertia.insert(b.id.clone(),moment(b));
        }
        for j in &request.world.joints {
            let a = store.keys[&j.a]; let b = store.keys[&j.b];
            let position = point![j.anchor_x,j.anchor_y];
            let anchor_a = store.bodies[a].position().inverse_transform_point(&position);
            let anchor_b = store.bodies[b].position().inverse_transform_point(&position);
            let joint: GenericJoint = match j.kind.as_str() {
                "hinge" => RevoluteJointBuilder::new().local_anchor1(anchor_a).local_anchor2(anchor_b)
                    .contacts_enabled(false).into(),
                "slider" => {
                    let axis = UnitVector::new_normalize(vector![j.axis_x,j.axis_y]);
                    let ax_a = UnitVector::new_normalize(store.bodies[a].rotation().inverse() * *axis);
                    let ax_b = UnitVector::new_normalize(store.bodies[b].rotation().inverse() * *axis);
                    PrismaticJointBuilder::new(ax_a).local_axis2(ax_b).local_anchor1(anchor_a).local_anchor2(anchor_b)
                        .limits([j.min,j.max]).contacts_enabled(false).into()
                }
                "spring" => SpringJointBuilder::new(j.rest_length,j.stiffness,j.damping).contacts_enabled(false).into(),
                "rod" => {
                    let line = store.bodies[b].translation() - store.bodies[a].translation();
                    let axis = if line.norm_squared() > 1e-12 { UnitVector::new_normalize(line) }
                        else { UnitVector::new_normalize(vector![1.0,0.0]) };
                    let ax_a = UnitVector::new_normalize(store.bodies[a].rotation().inverse() * *axis);
                    let ax_b = UnitVector::new_normalize(store.bodies[b].rotation().inverse() * *axis);
                    GenericJointBuilder::new(JointAxesMask::empty()).local_axis1(ax_a).local_axis2(ax_b)
                        .limits(JointAxis::LinX,[j.rest_length,j.rest_length]).contacts_enabled(false).build()
                }
                "fixed" => {
                    let world_frame = Isometry::new(vector![j.anchor_x,j.anchor_y],0.0);
                    FixedJointBuilder::new().local_frame1(store.bodies[a].position().inverse() * world_frame)
                        .local_frame2(store.bodies[b].position().inverse() * world_frame).contacts_enabled(false).into()
                }
                "gear" | "belt" => { store.transmissions.push(j.clone()); continue; }
                _ => unreachable!("validated joint kind"),
            };
            let handle = store.joints.insert(a,b,joint,true);
            if j.kind == "rod" { store.rods.push((j.clone(),handle)); }
        }
        store
    }
    pub fn dispatch(&mut self, step: f32) {
        self.align_rods();
        for m in &self.drives {
            if !m.enabled { continue; }
            let body = &mut self.bodies[self.keys[&m.body]];
            let requested = self.inertia[&m.body] * (m.target_speed-body.angvel()) / step;
            let impulse = requested.clamp(-m.max_torque,m.max_torque) * step;
            body.apply_torque_impulse(impulse,true);
        }
        self.reconcile();
    }
    fn align_rods(&mut self) {
        // Rapier 0.22 coupled linear limits ignore their minimum. A normal, bilateral
        // linear row is aligned to the current COM separation before each fixed step.
        for (rod,handle) in &self.rods {
            let a = &self.bodies[self.keys[&rod.a]];
            let b = &self.bodies[self.keys[&rod.b]];
            let line = b.translation() - a.translation();
            let axis = if line.norm_squared() > 1e-12 { UnitVector::new_normalize(line) }
                else { UnitVector::new_normalize(vector![1.0,0.0]) };
            let ax_a = UnitVector::new_normalize(a.rotation().inverse() * *axis);
            let ax_b = UnitVector::new_normalize(b.rotation().inverse() * *axis);
            let joint = self.joints.get_mut(*handle).expect("retained rod handle");
            joint.data.set_local_axis1(ax_a).set_local_axis2(ax_b);
        }
    }
    pub fn reconcile(&mut self) {
        // Three ordered projections are explicit, finite and retained in the model metadata.
        for _ in 0..3 {
            for j in &self.transmissions {
                let ah = self.keys[&j.a]; let bh = self.keys[&j.b];
                let ia = self.inertia[&j.a]; let ib = self.inertia[&j.b];
                let inv_a = if ia > 0.0 { 1.0/ia } else { 0.0 };
                let inv_b = if ib > 0.0 { 1.0/ib } else { 0.0 };
                let sign = if j.kind == "gear" { -1.0 } else { 1.0 };
                let divisor = inv_b + j.ratio*j.ratio*inv_a;
                if divisor <= 0.0 { continue; }
                let error = self.bodies[bh].angvel() - sign*j.ratio*self.bodies[ah].angvel();
                let stock = -error/divisor;
                if inv_a > 0.0 { self.bodies[ah].apply_torque_impulse(-sign*j.ratio*stock,true); }
                if inv_b > 0.0 { self.bodies[bh].apply_torque_impulse(stock,true); }
            }
        }
    }
}
