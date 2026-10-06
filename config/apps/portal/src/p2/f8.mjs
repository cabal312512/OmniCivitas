import * as THREE from 'three';
import { TOWER_SPEC } from './z2.mjs';

export const BOSS_SPEC = Object.freeze({
  x: TOWER_SPEC.x, z: TOWER_SPEC.z, floorY: TOWER_SPEC.baseY + TOWER_SPEC.height,
  height: 205, hp: 180, projectileCap: 48, pulseCap: 5, sweepCap: 2, arenaRadius: 145, modelScale: 2.05,
});
const limit = (n, a, b) => Math.max(a, Math.min(b, n));
const inArena = player => Number.isFinite(player?.y) && player.y >= BOSS_SPEC.floorY - 2
  && Math.hypot(player.x - BOSS_SPEC.x, player.z - BOSS_SPEC.z) <= 210;
const segmentDistance = (point, start, end) => {
  const dx = end.x - start.x, dy = end.y - start.y, dz = end.z - start.z;
  const denom = dx * dx + dy * dy + dz * dz;
  const t = denom ? limit(((point.x - start.x) * dx + (point.y - start.y) * dy + (point.z - start.z) * dz) / denom, 0, 1) : 0;
  return Math.hypot(point.x - start.x - t * dx, point.y - start.y - t * dy, point.z - start.z - t * dz);
};

// Pure bounded combat simulation. Rendering and the application's RAF stay separate.
export function createBossState({ defeated = false } = {}) {
  const state = {
    hp: defeated ? 0 : BOSS_SPEC.hp, maxHp: BOSS_SPEC.hp, phase: 1, active: false,
    defeated, completions: defeated ? 1 : 0, defeatTime: null, shotsTaken: 0,
    weakHits: 0, attacks: 0, damageEvents: 0, damageTotal: 0,
    telegraphs: 0, projectileImpacts: 0, lastHit: -Infinity, lastAttack: -Infinity,
    pending: null, projectiles: [], pulses: [], sweeps: [], resets: 0,
  };
  let nextProjectile = 0;
  const clear = () => { state.pending = null; state.projectiles.length = 0; state.pulses.length = 0; state.sweeps.length=0; };
  function damage(value, onDamage) {
    state.damageEvents++; state.damageTotal += value;
    onDamage(value);
  }
  return {
    state,
    hit(part, time) {
      if (!state.active || state.defeated || !Number.isFinite(time) || time - state.lastHit < .12) return false;
      const hit = part === 'weak' ? 3 : 1;
      state.lastHit = time; state.shotsTaken++;
      if (part === 'weak') state.weakHits++;
      state.hp = Math.max(0, state.hp - hit);
      state.phase = state.hp <= state.maxHp / 3 ? 3 : state.hp <= state.maxHp * 2 / 3 ? 2 : 1;
      if (state.hp === 0) {
        state.defeated = true; state.active = false; state.completions++;
        state.defeatTime = time; clear();
      }
      return true;
    },
    update(player, time, dt, onDamage = () => {}, obstructRay = (_origin, _direction, distance) => distance) {
      dt = limit(Number.isFinite(dt) ? dt : 0, 0, .1);
      if (state.defeated) { clear(); state.active = false; return; }
      const alive = Number.isFinite(player?.health) ? player.health > 0 : true;
      const present = alive && inArena(player);
      if (!present) {
        if (state.active) {
          state.resets++; state.hp = state.maxHp; state.phase = 1;
          state.lastAttack = -Infinity; state.lastHit = -Infinity;
        }
        state.active = false; clear(); return;
      }
      if (!state.active) { state.active = true; state.lastAttack = time; }
      const interval = state.phase === 1 ? 3.8 : state.phase === 2 ? 2.9 : 2.1;
      if (!state.pending && time - state.lastAttack >= interval) {
        state.pending = { at: time + (state.phase === 3 ? 1.2 : 1.65), phase: state.phase,
          x: player.x, y: player.y + 1.25, z: player.z, type: ['volley','pulse','sweep','volley'][state.attacks%4] };
        state.lastAttack = time; state.telegraphs++;
      }
      if (state.pending && time >= state.pending.at) {
        const attack = state.pending; state.pending = null; state.attacks++;
        if (attack.type === 'pulse') {
          if (state.pulses.length < BOSS_SPEC.pulseCap) state.pulses.push({ radius: 0, phase: attack.phase,delay:0 });
          if(attack.phase>=2&&state.pulses.length<BOSS_SPEC.pulseCap)state.pulses.push({radius:0,phase:attack.phase,delay:.85});
        } else if(attack.type==='sweep'){
          if(state.sweeps.length<BOSS_SPEC.sweepCap)state.sweeps.push({angle:Math.atan2(attack.z-BOSS_SPEC.z,attack.x-BOSS_SPEC.x)-.85,life:2.2,lastHit:-Infinity,phase:attack.phase});
        } else {
          const count = attack.phase === 1 ? 5 : attack.phase === 2 ? 9 : 13;
          const start = { x: BOSS_SPEC.x, y: BOSS_SPEC.floorY + 38, z: BOSS_SPEC.z };
          const angle = Math.atan2(attack.z - start.z, attack.x - start.x);
          const range = Math.hypot(attack.x - start.x, attack.z - start.z);
          for (let index = 0; index < count && state.projectiles.length < BOSS_SPEC.projectileCap; index++) {
            const spread = (index - (count - 1) / 2) * .09;
            const horizontal = Math.max(1, range), dy = attack.y - start.y;
            const length = Math.hypot(horizontal, dy), speed = 42 + attack.phase * 8;
            state.projectiles.push({ id: nextProjectile++, ...start, life: 7,
              vx: Math.cos(angle + spread) * horizontal / length * speed,
              vy: dy / length * speed, vz: Math.sin(angle + spread) * horizontal / length * speed,
              damage: .085 + attack.phase * .015 });
          }
        }
      }
      for (let index = state.projectiles.length - 1; index >= 0; index--) {
        const shot = state.projectiles[index], start = { x: shot.x, y: shot.y, z: shot.z };
        const end = { x: shot.x + shot.vx * dt, y: shot.y + shot.vy * dt, z: shot.z + shot.vz * dt };
        const length = Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
        const direction = length ? { x: (end.x - start.x) / length, y: (end.y - start.y) / length,
          z: (end.z - start.z) / length } : { x: 0, y: 0, z: 0 };
        shot.life -= dt;
        const obstruction = obstructRay(start, direction, length);
        const occluded = obstruction === true || (typeof obstruction === 'number' && obstruction < length - .01);
        if (shot.life <= 0 || end.y < BOSS_SPEC.floorY + .1 || occluded) {
          state.projectiles.splice(index, 1); continue;
        }
        const chest = { x: player.x, y: player.y + 1.25, z: player.z };
        if (segmentDistance(chest, start, end) < 1.6) {
          state.projectileImpacts++; damage(shot.damage, onDamage);
          state.projectiles.splice(index, 1); continue;
        }
        Object.assign(shot, end);
      }
      for (let index = state.pulses.length - 1; index >= 0; index--) {
        const pulse = state.pulses[index], before = pulse.radius;
        if(pulse.delay>0){pulse.delay-=dt;continue;}
        pulse.radius += dt * (28 + pulse.phase * 4);
        const distance = Math.hypot(player.x - BOSS_SPEC.x, player.z - BOSS_SPEC.z);
        if (!pulse.hit && distance >= before - 2 && distance <= pulse.radius + 2
          && player.y < BOSS_SPEC.floorY + 1.5) {
          pulse.hit = true; damage(.09 + pulse.phase * .02, onDamage);
        }
        if (pulse.radius > 165) state.pulses.splice(index, 1);
      }
      for(let index=state.sweeps.length-1;index>=0;index--){const sweep=state.sweeps[index];sweep.life-=dt;sweep.angle+=dt*(.7+sweep.phase*.12);const dx=player.x-BOSS_SPEC.x,dz=player.z-BOSS_SPEC.z,along=dx*Math.cos(sweep.angle)+dz*Math.sin(sweep.angle),across=Math.abs(-dx*Math.sin(sweep.angle)+dz*Math.cos(sweep.angle));
        if(along>18&&along<149&&across<4&&player.y<BOSS_SPEC.floorY+1.4&&time-sweep.lastHit>.7){sweep.lastHit=time;damage(.12+sweep.phase*.015,onDamage);}if(sweep.life<=0)state.sweeps.splice(index,1);
      }
    },
    snapshot() {
      return { ...state, lastHit: Number.isFinite(state.lastHit) ? state.lastHit : null,
        lastAttack: Number.isFinite(state.lastAttack) ? state.lastAttack : null,
        pending: state.pending ? { ...state.pending } : null,
        projectiles: state.projectiles.map(shot => ({ ...shot })), pulses: state.pulses.map(pulse => ({ ...pulse })),sweeps:state.sweeps.map(sweep=>({...sweep,lastHit:Number.isFinite(sweep.lastHit)?sweep.lastHit:null})),
        spec: { ...BOSS_SPEC } };
    },
  };
}

export function createBoss(scene, { obstructRay = (_origin, _direction, distance) => distance, defeated = false } = {}) {
  const root = new THREE.Group(); root.name = 'crown-guardian'; scene.add(root);
  root.position.set(BOSS_SPEC.x, BOSS_SPEC.floorY, BOSS_SPEC.z);
  const figure=new THREE.Group();figure.scale.setScalar(BOSS_SPEC.modelScale);root.add(figure);
  const geometries = new Set(), materials = new Set();
  const ownGeometry = value => (geometries.add(value), value);
  const ownMaterial = value => (materials.add(value), value);
  const white = ownMaterial(new THREE.MeshPhysicalMaterial({ color: 0xf8ffff,
    metalness: .22, roughness: .16, clearcoat: 1, envMapIntensity: 1.4 }));
  const glass = ownMaterial(new THREE.MeshPhysicalMaterial({ color: 0xb7f4ff,
    metalness: .02, roughness: .08, transmission: .48, thickness: 1.2,
    transparent: true, opacity: .68, ior: 1.17, clearcoat: 1 }));
  const teal = ownMaterial(new THREE.MeshBasicMaterial({ color: 0x32d9de,
    transparent: true, opacity: .85, depthWrite: false }));
  const warning = ownMaterial(new THREE.MeshBasicMaterial({ color: 0xffdcaa,
    transparent: true, opacity: .72, depthWrite: false, side: THREE.DoubleSide }));
  const pulseMaterial = ownMaterial(new THREE.MeshBasicMaterial({ color: 0xaef8ff,
    transparent: true, opacity: .85, depthWrite: false }));
  const model = createBossState({ defeated }), targets = [];
  function part(geometry, material, position, hitPart = 'body') {
    const item = new THREE.Mesh(ownGeometry(geometry), material);
    item.position.set(...position); item.castShadow = material === white; item.receiveShadow = true;
    item.userData.bossPart = hitPart; (hitPart?figure:root).add(item);
    if (hitPart) targets.push(item);
    return item;
  }
  const heart = part(new THREE.IcosahedronGeometry(14, 2), white, [0, 29, 0]);
  const weakPoint = part(new THREE.SphereGeometry(7, 24, 16), teal, [0, 28, 15], 'weak');
  const rearWeak = part(new THREE.SphereGeometry(7, 24, 16), teal, [0, 28, -15], 'weak');
  const crown = part(new THREE.TorusGeometry(27, 2, 10, 80), glass, [0, 37, 0]);
  crown.rotation.x = Math.PI / 2;
  const wings = [];
  for (let index = 0; index < 6; index++) {
    const angle = index * Math.PI / 3;
    const wing = part(new THREE.ConeGeometry(7, 69, 4), index % 2 ? glass : white,
      [Math.cos(angle) * 32, 42, Math.sin(angle) * 32]);
    wing.rotation.z = Math.cos(angle) * .55;
    wing.rotation.x = Math.sin(angle) * .55;
    wings.push(wing);
    const fin = part(new THREE.TorusGeometry(34, .7, 6, 48, Math.PI * 1.2), glass,
      [0, 20 + index * 3, 0]);
    fin.rotation.set(Math.PI / 2 + index * .17, 0, angle);
  }
  const warningRing = part(new THREE.RingGeometry(138, 141, 96), warning, [0, .12, 0], null);
  warningRing.rotation.x = -Math.PI / 2; warningRing.visible = false;
  const healthBack = part(new THREE.PlaneGeometry(68, 2),
    ownMaterial(new THREE.MeshBasicMaterial({ color: 0xb6d6df, side: THREE.DoubleSide })), [0, 205, 0], null);
  const health = part(new THREE.PlaneGeometry(68, 1.2), teal, [0, 205, .05], null);
  const aimedMark=part(new THREE.TorusGeometry(7,.18,6,48),warning,[0,.18,0],null);aimedMark.rotation.x=-Math.PI/2;aimedMark.visible=false;
  const orbitals=[];for(let j=0;j<12;j++){const m=part(new THREE.OctahedronGeometry(2.1),j%2?glass:white,[Math.cos(j*Math.PI/6)*45,65,Math.sin(j*Math.PI/6)*45],null);figure.add(m);orbitals.push(m);}
  const shots = Array.from({ length: BOSS_SPEC.projectileCap }, () => {
    const item = part(new THREE.SphereGeometry(.8, 10, 8), warning, [0, 0, 0], null);
    item.visible = false; return item;
  });
  const pulses = Array.from({ length: BOSS_SPEC.pulseCap }, () => {
    const item = part(new THREE.TorusGeometry(1, .045, 6, 64), pulseMaterial, [0, .4, 0], null);
    item.rotation.x = -Math.PI / 2; item.visible = false; return item;
  });
  const sweeps=Array.from({length:BOSS_SPEC.sweepCap},()=>{const m=part(new THREE.BoxGeometry(145,1.1,1.3),pulseMaterial,[0,1,0],null);m.visible=false;return m;});
  const rayStart = new THREE.Vector3(), rayDirection = new THREE.Vector3();
  let activeObstruction = obstructRay;
  const traceProjectile = (start, direction, distance) => activeObstruction(
    rayStart.set(start.x, start.y, start.z), rayDirection.set(direction.x, direction.y, direction.z), distance);
  let disposed = false;
  function sync(player, time, reduced) {
    const state = model.state;
    root.visible = !state.defeated;
    if (state.defeated) return;
    const hover = reduced ? 0 : Math.sin(time * .62) * 1.5;
    heart.position.y = 29 + hover;
    weakPoint.position.y = rearWeak.position.y = 28 + hover;
    crown.rotation.z = reduced ? 0 : time * .08;
    for (let index = 0; index < wings.length; index++) {
      wings[index].position.y = 42 + (reduced ? 0 : Math.sin(time * .48 + index) * 2);
    }
    warningRing.visible = !!state.pending;
    aimedMark.visible=!!state.pending;if(state.pending)aimedMark.position.set(state.pending.x-BOSS_SPEC.x,.18,state.pending.z-BOSS_SPEC.z);
    for(let j=0;j<orbitals.length;j++){const a=j*Math.PI/6+time*.15;orbitals[j].position.set(Math.cos(a)*45,65+Math.sin(time*.8+j)*4,Math.sin(a)*45);orbitals[j].rotation.set(time*.17,j,time*.11);}
    teal.color.setHex(state.phase===3?0xffc993:state.phase===2?0x8bddff:0x32d9de);
    warning.opacity = state.pending ? .48 + Math.sin(time * 8) * .2 : .72;
    health.visible = healthBack.visible = state.active;
    health.scale.x = state.hp / state.maxHp;
    if (player) {
      health.rotation.y = healthBack.rotation.y = Math.atan2(player.x - BOSS_SPEC.x, player.z - BOSS_SPEC.z);
    }
    for (let index = 0; index < shots.length; index++) {
      const shot = state.projectiles[index], mesh = shots[index]; mesh.visible = !!shot;
      if (shot) mesh.position.set(shot.x - BOSS_SPEC.x, shot.y - BOSS_SPEC.floorY, shot.z - BOSS_SPEC.z);
    }
    for (let index = 0; index < pulses.length; index++) {
      const pulse = state.pulses[index], mesh = pulses[index]; mesh.visible = !!pulse;
      if (pulse) {mesh.visible=pulse.delay<=0;mesh.scale.set(pulse.radius, pulse.radius, 1);}
    }
    for(let j=0;j<sweeps.length;j++){const s=state.sweeps[j],mesh=sweeps[j];mesh.visible=!!s;if(s){mesh.position.set(Math.cos(s.angle)*72.5,1.1,Math.sin(s.angle)*72.5);mesh.rotation.y=-s.angle;}}
  }
  root.updateMatrixWorld(true);
  return {
    get isDefeated() { return model.state.defeated; },
    targets() { return disposed || model.state.defeated ? [] : targets; },
    hit(mesh, time) { return !disposed && targets.includes(mesh) && model.hit(mesh.userData.bossPart, time); },
    update(player, time, dt, onDamage, reduced = false, obstruction = obstructRay) {
      if (disposed) return;
      activeObstruction = obstruction;
      model.update(player, time, dt, onDamage, traceProjectile);
      sync(player, time, reduced); root.updateMatrixWorld(true);
    },
    snapshot() { return { ...model.snapshot(), disposed, projectilePool: shots.length,
      pulsePool: pulses.length, targetCount: targets.length,
      position: { x: BOSS_SPEC.x, y: BOSS_SPEC.floorY + 29*BOSS_SPEC.modelScale, z: BOSS_SPEC.z },
      weakPoints: [{ x: BOSS_SPEC.x, y: weakPoint.position.y*BOSS_SPEC.modelScale + BOSS_SPEC.floorY, z: BOSS_SPEC.z + 15*BOSS_SPEC.modelScale },
        { x: BOSS_SPEC.x, y: rearWeak.position.y*BOSS_SPEC.modelScale + BOSS_SPEC.floorY, z: BOSS_SPEC.z - 15*BOSS_SPEC.modelScale }],
      highestGeometryY: BOSS_SPEC.floorY + BOSS_SPEC.height,sweepPool:sweeps.length }; },
    dispose() {
      if (disposed) return;
      disposed = true; scene.remove(root); root.clear();
      model.state.active = false; model.state.projectiles.length = 0; model.state.pulses.length = 0;model.state.sweeps.length=0;
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
