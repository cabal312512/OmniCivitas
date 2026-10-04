import { afterEach, expect, test } from 'vitest';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { TOWER_SPEC, pathPoint, surfaceAt, landingSurfaceAt, blocked, createTower } from '../config/apps/portal/src/3d/tower.mjs';
import { CAPITAL } from '../config/apps/portal/src/3d/city-data.mjs';
import { BOSS_SPEC, createBossState, createBoss } from '../config/apps/portal/src/3d/boss.mjs';
import { stepPlayer } from '../config/apps/portal/src/3d/model.mjs';
const requirePortal = createRequire(new URL('../config/apps/portal/package.json', import.meta.url));
const THREE = await import(pathToFileURL(path.join(path.dirname(requirePortal.resolve('three')), 'three.module.js')).href);

const fixtures = [];
afterEach(() => { for (const item of fixtures.splice(0)) item.dispose(); });
const summit = () => ({ x: BOSS_SPEC.x + 80, y: BOSS_SPEC.floorY, z: BOSS_SPEC.z, health: 1 });
const tick = (model, player, duration, options = {}) => {
  let time = options.time || 0;
  for (let index = 0; index < duration * 20; index++) {
    time += .05;
    model.update(player, time, .05, options.onDamage, options.obstructRay);
  }
  return time;
};

// Independent reference: the accepted full-winding implementation before the
// CPU optimization. Keep the floor/rail thresholds and winding endpoint caps.
function referenceSurface(x, z, referenceY = TOWER_SPEC.baseY) {
  if (![x, z, referenceY].every(Number.isFinite)) return null;
  const dx = x - TOWER_SPEC.x, dz = z - TOWER_SPEC.z, radius = Math.hypot(dx, dz);
  const tau = Math.PI * 2, top = TOWER_SPEC.baseY + TOWER_SPEC.height;
  let angle = Math.atan2(dz, dx); if (angle < 0) angle += tau;
  const floors = [];
  for (let winding = 0; winding <= TOWER_SPEC.turns; winding++) {
    const t = (angle / tau + winding) / TOWER_SPEC.turns;
    if (t > 1 + 1e-8) continue;
    const point = pathPoint(t);
    if (Math.abs(radius - point.radius) <= TOWER_SPEC.roadWidth / 2 + .04
      && point.y <= referenceY + 1.8) floors.push(point.y);
  }
  if (radius <= TOWER_SPEC.topRadius + 5 && top <= referenceY + 1.8) floors.push(top);
  const entranceAngle = Math.min(angle, tau - angle), signedAngle = angle > Math.PI ? angle - tau : angle;
  const landingY = top + Math.min(0, signedAngle) * TOWER_SPEC.height / (tau * TOWER_SPEC.turns);
  if (radius >= TOWER_SPEC.topRadius && radius <= TOWER_SPEC.topRadius + 25
    && entranceAngle < .105 && landingY <= referenceY + 1.8) floors.push(landingY);
  if (dx >= TOWER_SPEC.baseRadius + 2 && dx <= TOWER_SPEC.baseRadius + 76
    && Math.abs(dz) <= 13 && TOWER_SPEC.baseY <= referenceY + 1.8) floors.push(TOWER_SPEC.baseY);
  return floors.length ? Math.max(...floors) : null;
}

function referenceBlocked(x, z, radius = .48, referenceY = TOWER_SPEC.baseY) {
  if (![x, z, radius, referenceY].every(Number.isFinite)) return true;
  const dx = x - TOWER_SPEC.x, dz = z - TOWER_SPEC.z, distance = Math.hypot(dx, dz);
  const relative = referenceY - TOWER_SPEC.baseY, tau = Math.PI * 2, top = TOWER_SPEC.baseY + TOWER_SPEC.height;
  if (relative >= -1 && relative < TOWER_SPEC.height - .2) {
    const progress = Math.max(0, Math.min(1, relative / TOWER_SPEC.height));
    const coreRadius = TOWER_SPEC.baseRadius + (TOWER_SPEC.topRadius - TOWER_SPEC.baseRadius) * progress;
    if (distance < coreRadius + radius) return true;
  }
  let angle = Math.atan2(dz, dx); if (angle < 0) angle += tau;
  for (let winding = 0; winding <= TOWER_SPEC.turns; winding++) {
    const t = (angle / tau + winding) / TOWER_SPEC.turns;
    if (t > 1 + 1e-8) continue;
    const point = pathPoint(t);
    if (referenceY < point.y - 1.2 || referenceY > point.y + TOWER_SPEC.railHeight) continue;
    const outer = point.radius + TOWER_SPEC.roadWidth / 2;
    if (t >= .00075 && Math.abs(distance - outer) < radius + .22) return true;
    const inner = point.radius - TOWER_SPEC.roadWidth / 2;
    if (t < .997 && referenceY <= point.y + .8 && Math.abs(distance - inner) < radius + .22) return true;
  }
  const entranceAngle = Math.min(angle, tau - angle);
  if (referenceY >= top - .2 && referenceY <= top + TOWER_SPEC.railHeight
    && entranceAngle > .105 && Math.abs(distance - 144.5) < radius + .22) return true;
  return false;
}

function seededRandom(seed = 28479) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

test('tower: 12 real continuous windings have manageable slope, giant scale and the highest walkable summit', () => {
  expect(TOWER_SPEC).toMatchObject({ x: CAPITAL.x, z: CAPITAL.z, baseY: CAPITAL.ground, height: 2400, turns: 12, roadWidth: 22 });
  expect(Math.hypot(CAPITAL.x, CAPITAL.z - 180)).toBeGreaterThan(6300);
  let prior = pathPoint(0);
  for (let index = 1; index <= 12000; index++) {
    const next = pathPoint(index / 12000);
    const slope = (next.y - prior.y) / Math.hypot(next.x - prior.x, next.z - prior.z);
    expect(slope).toBeGreaterThan(0);
    expect(slope).toBeLessThan(.23);
    const actualFloor = surfaceAt(next.x, next.z, next.y);
    if (next.t < 1 - .105 / (Math.PI * 2 * TOWER_SPEC.turns)) expect(actualFloor).toBeCloseTo(next.y, 6);
    else {
      expect(actualFloor).toBeGreaterThanOrEqual(next.y - .001);
      expect(actualFloor - next.y).toBeLessThan(1.8);
    }
    expect(blocked(next.x, next.z, .48, next.y)).toBe(false);
    prior = next;
  }
  expect(prior.y).toBe(2455);
  expect(BOSS_SPEC.floorY).toBe(2455);
  expect(BOSS_SPEC.floorY + BOSS_SPEC.height).toBeGreaterThan(1500);
});

test('tower: current foot height picks the actual winding and does not teleport visitors through floor layers', () => {
  const top = pathPoint(1), middle = pathPoint(.5);
  expect(surfaceAt(top.x, top.z, 55)).toBe(null);
  expect(surfaceAt(TOWER_SPEC.x, TOWER_SPEC.z, 55)).toBe(null);
  expect(surfaceAt(TOWER_SPEC.x, TOWER_SPEC.z, 2455)).toBe(2455);
  expect(surfaceAt(middle.x, middle.z, middle.y)).toBeCloseTo(middle.y);
  expect(surfaceAt(middle.x, middle.z, middle.y - 20)).toBe(null);
  expect(surfaceAt(middle.x, middle.z, middle.y + 20)).toBeCloseTo(middle.y);
  expect(blocked(TOWER_SPEC.x, TOWER_SPEC.z, .48, 55)).toBe(true);
  expect(blocked(TOWER_SPEC.x, TOWER_SPEC.z, .48, 2455)).toBe(false);
});

test('tower: true gravity and 58m/s movement climb the complete continuous road without skipped layers', () => {
  const tower = createTower(new THREE.Scene()); fixtures.push(tower);
  const start = pathPoint(0);
  const visitor = { x: TOWER_SPEC.x + 520, y: 55.085, z: TOWER_SPEC.z + 38, vy: 0, grounded: true, health: 1, energy: 1 };
  const ground = (x, z, referenceY = visitor.y) => Math.max(55.085, surfaceAt(x, z, referenceY) ?? 55.085);
  const wall = (x, z, radius, referenceY = visitor.y) => blocked(x, z, radius, referenceY);
  for (let frame = 0; frame < 1000 && Math.hypot(visitor.x - start.x, visitor.z - start.z) > .3; frame++) {
    stepPlayer(visitor, { forward: 1, yaw: Math.atan2(-(start.x - visitor.x), -(start.z - visitor.z)) }, .02, ground, wall);
    tower.recoverPlayer(visitor);
  }
  expect(Math.hypot(visitor.x - start.x, visitor.z - start.z)).toBeLessThan(.4);
  expect(visitor.y).toBeCloseTo(55.085, 2);
  let angle = Math.atan2(visitor.z - TOWER_SPEC.z, visitor.x - TOWER_SPEC.x), previousAngle = angle,
    previousY = visitor.y, maximumJump = 0, travelled = 0;
  const targetAngle = Math.PI * 2 * TOWER_SPEC.turns;
  for (let frame = 0; frame < 6000 && angle < targetAngle - .012; frame++) {
    const t = angle / targetAngle;
    const radius = pathPoint(t).radius;
    const lookAhead = 8 / (radius * targetAngle);
    const target = pathPoint(Math.min(1, t + lookAhead));
    const dx = target.x - visitor.x, dz = target.z - visitor.z;
    const old = { x: visitor.x, z: visitor.z };
    stepPlayer(visitor, { forward: 1, strafe: 0, sprint: true, yaw: Math.atan2(-dx, -dz) }, .1, ground, wall);
    tower.recoverPlayer(visitor);
    const current = Math.atan2(visitor.z - TOWER_SPEC.z, visitor.x - TOWER_SPEC.x);
    let change = current - previousAngle;
    if (change < -Math.PI) change += Math.PI * 2;
    if (change > Math.PI) change -= Math.PI * 2;
    angle += change; previousAngle = current;
    travelled += Math.hypot(visitor.x - old.x, visitor.z - old.z);
    maximumJump = Math.max(maximumJump, Math.abs(visitor.y - previousY)); previousY = visitor.y;
  }
  expect(angle).toBeGreaterThan(targetAngle - .014);
  expect(visitor.y).toBeGreaterThan(2453);
  expect(travelled).toBeGreaterThan(20000);
  expect(travelled).toBeLessThan(24000);
  expect(maximumJump).toBeLessThan(1.8);
  const roadEnd = pathPoint(1);
  for (let frame = 0; frame < 200 && Math.hypot(visitor.x - roadEnd.x, visitor.z - roadEnd.z) > .25; frame++) {
    const dx = roadEnd.x - visitor.x, dz = roadEnd.z - visitor.z;
    stepPlayer(visitor, { forward: 1, yaw: Math.atan2(-dx, -dz) }, .02, ground, wall);
    tower.recoverPlayer(visitor);
  }
  const crown = pathPoint(1, -20);
  for (let frame = 0; frame < 200 && Math.hypot(visitor.x - crown.x, visitor.z - crown.z) > .5; frame++) {
    const dx = crown.x - visitor.x, dz = crown.z - visitor.z;
    stepPlayer(visitor, { forward: 1, yaw: Math.atan2(-dx, -dz) }, .05, ground, wall);
    tower.recoverPlayer(visitor);
  }
  expect(Math.hypot(visitor.x - crown.x, visitor.z - crown.z), JSON.stringify({ visitor, crown })).toBeLessThan(.6);
  expect(visitor.y).toBe(2455);
  expect(visitor.health).toBe(1);
  expect(visitor.energy).toBe(1);
  expect(tower.snapshot().recoveries).toBe(0);
});

test('tower: final bridge floors are the actual rendered triangles and remain below the next-winding capture threshold', () => {
  const scene = new THREE.Scene(), tower = createTower(scene); fixtures.push(tower);
  const ramp = scene.children[0].getObjectByName('tower-final-landing');
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
  let samples = 0;
  for (const angle of [-.1, -.085, -.065, -.04, -.02, 0, .02, .06, .1]) {
    for (const radius of [140.2, 143, 147, 152, 157, 162, 164.7]) {
      const x = TOWER_SPEC.x + Math.cos(angle) * radius, z = TOWER_SPEC.z + Math.sin(angle) * radius;
      ray.set(new THREE.Vector3(x, 2460, z), down);
      const hit = ray.intersectObject(ramp, false)[0];
      expect(hit).toBeTruthy();
      expect(landingSurfaceAt(x, z)).toBeCloseTo(hit.point.y, 8);
      samples++;
    }
  }
  expect(samples).toBe(63);
  for (const y of [55, 855, 1655, 2445, 2450.7]) expect(surfaceAt(TOWER_SPEC.x, TOWER_SPEC.z, y)).toBe(null);
  expect(scene.children[0].getObjectByName('tower-summit-guard').geometry.parameters.height).toBe(3.2);
  expect(scene.children[0].getObjectByName('tower-crown-handrail').material.color.getHex()).toBe(0xffffff);
  expect(scene.children[0].getObjectByName('tower-crown-posts').count).toBe(48);
});

test('tower: actual summit jumping lands on its platform and repeated sprint-jumps cannot clear the guard or drop into the cone', () => {
  const tower = createTower(new THREE.Scene()); fixtures.push(tower);
  const crown = pathPoint(1, -20), player = { ...crown, vy: 0, grounded: true, health: .7, energy: 1 };
  const ground = (x, z, y) => Math.max(55, tower.groundAt(x, z, y) ?? 55);
  const wall = (x, z, r, y) => tower.isBlocked(x, z, r, y);
  let apex = player.y;
  for (let frame = 0; frame < 65; frame++) {
    stepPlayer(player, { jump: frame === 0 }, .02, ground, wall);
    tower.recoverPlayer(player); apex = Math.max(apex, player.y);
  }
  expect(apex - 2455).toBeGreaterThan(1.7);
  expect(apex - 2455).toBeLessThan(2.1);
  expect(player).toMatchObject({ y: 2455, vy: 0, grounded: true, health: .7 });
  const approach = { x: TOWER_SPEC.x + Math.cos(.12) * 142.5, z: TOWER_SPEC.z + Math.sin(.12) * 142.5 };
  for (let frame = 0; frame < 250 && Math.hypot(player.x - approach.x, player.z - approach.z) > .2; frame++) {
    stepPlayer(player, { forward: 1, yaw: Math.atan2(-(approach.x - player.x), -(approach.z - player.z)) }, .02, ground, wall);
    tower.recoverPlayer(player);
  }
  expect(Math.hypot(player.x - approach.x, player.z - approach.z)).toBeLessThan(.25);
  let maximumRadius = 0;
  for (let frame = 0; frame < 180; frame++) {
    stepPlayer(player, { forward: 1, sprint: true, jump: frame % 55 === 0, yaw: Math.atan2(-Math.cos(.12), -Math.sin(.12)) }, .02, ground, wall);
    tower.recoverPlayer(player);
    maximumRadius = Math.max(maximumRadius, Math.hypot(player.x - TOWER_SPEC.x, player.z - TOWER_SPEC.z));
    expect(player.y).toBeGreaterThanOrEqual(2455);
  }
  expect(maximumRadius).toBeLessThanOrEqual(143.81);
  for (let frame = 0; frame < 80; frame++) stepPlayer(player, {}, .02, ground, wall);
  expect(player.y).toBe(2455);
  expect(tower.snapshot().recoveries).toBe(0);
});

test('tower: an already-trapped visitor recovers to the nearest legal road without health, inventory or progress changes', () => {
  const tower = createTower(new THREE.Scene()); fixtures.push(tower);
  const crown = pathPoint(1, -20);
  const player = { ...crown, grounded: true, vy: 0, health: .43, energy: .8, found: 11, checkpoint: 'tower-crown' };
  expect(tower.recoverPlayer(player)).toBe(false);
  player.x = TOWER_SPEC.x + 90; player.y = 2446; player.z = TOWER_SPEC.z + 3; player.vy = -20; player.grounded = false;
  expect(tower.recoverPlayer(player)).toBe(true);
  expect(surfaceAt(player.x, player.z, player.y)).toBeCloseTo(player.y, 6);
  expect(blocked(player.x, player.z, .48, player.y)).toBe(false);
  expect(player.y).toBeGreaterThan(2400);
  expect(player).toMatchObject({ vy: 0, grounded: true, health: .43, energy: .8, found: 11, checkpoint: 'tower-crown' });
  expect(tower.recoverPlayer(player)).toBe(false);
  expect(tower.snapshot().recoveries).toBe(1);
  const groundVisitor = { x: TOWER_SPEC.x + 100, y: 55, z: TOWER_SPEC.z, vy: 0, grounded: true, health: 1 };
  expect(tower.recoverPlayer(groundVisitor)).toBe(true);
  expect(groundVisitor.y).toBe(55);
  expect(Math.hypot(groundVisitor.x - TOWER_SPEC.x, groundVisitor.z - TOWER_SPEC.z)).toBe(444);
  expect(blocked(groundVisitor.x, groundVisitor.z, .48, 55)).toBe(false);
  const bystander = { x: TOWER_SPEC.x + 520, y: 55, z: TOWER_SPEC.z, vy: 0, grounded: true };
  expect(tower.recoverPlayer(bystander)).toBe(false);
  expect(bystander.x).toBe(TOWER_SPEC.x + 520);
  expect(tower.snapshot().recoveries).toBe(2);
});

test('tower: real portal arrival walks through an opening in the rendered outer guard rail into the base station', () => {
  const visitor = { x: TOWER_SPEC.x + 520, y: 55.085, z: TOWER_SPEC.z + 38, vy: 0, grounded: true, health: 1, energy: 1 };
  const target = pathPoint(0), scene = new THREE.Scene(), tower = createTower(scene); fixtures.push(tower);
  const floor = (x, z, y = visitor.y) => Math.max(55.085, surfaceAt(x, z, y) ?? 55.085);
  for (let frame = 0; frame < 300 && Math.hypot(visitor.x - target.x, visitor.z - target.z) > .5; frame++) {
    stepPlayer(visitor, { forward: 1, yaw: Math.atan2(-(target.x - visitor.x), -(target.z - visitor.z)) }, .05,
      floor, (x, z, radius, y = visitor.y) => tower.isBlocked(x, z, radius, y));
  }
  expect(Math.hypot(visitor.x - target.x, visitor.z - target.z)).toBeLessThan(.6);
  expect(visitor.y).toBeCloseTo(55.085, 2);
  const rail = scene.children[0].children.find(item => item.isMesh && item.geometry.attributes.position.count > 9000
    && item.material.transmission === .34);
  expect(rail).toBeTruthy();
  const positions = rail.geometry.attributes.position;
  const first = new THREE.Vector3().fromBufferAttribute(positions, 0);
  expect(first.y).toBeCloseTo(56.8, 3);
  expect(Math.hypot(first.x - target.x, first.z - target.z)).toBeGreaterThan(24);
});

test('tower: real road, ribs, rails, platform and four valid rest stations have single owned-resource cleanup', () => {
  const scene = new THREE.Scene(), tower = createTower(scene); fixtures.push(tower);
  expect(tower.stats.roadLength).toBeGreaterThan(22000);
  expect(tower.stats.roadVertices).toBe(9218);
  expect(tower.restStations.map(item => item.id)).toEqual(['tower-base', 'tower-third', 'tower-second', 'tower-crown']);
  for (const station of tower.restStations) {
    expect(station.position.isVector3).toBe(true);
    expect(surfaceAt(station.position.x, station.position.z, station.position.y)).toBeCloseTo(station.position.y, 6);
    expect(blocked(station.position.x, station.position.z, .48, station.position.y)).toBe(false);
  }
  const geometry = new Set(), material = new Set();
  scene.traverse(object => { if (object.geometry) geometry.add(object.geometry); if (object.material) material.add(object.material); });
  let cleared = 0;
  for (const item of [...geometry, ...material]) item.addEventListener('dispose', () => cleared++);
  tower.dispose(); tower.dispose();
  expect(scene.children.length).toBe(0);
  expect(cleared).toBe(geometry.size + material.size);
  expect(tower.snapshot().disposed).toBe(true);
});

test('tower: finite ray obstruction uses actual frustum/road intersections and never an infinite default', () => {
  const tower = createTower(new THREE.Scene()); fixtures.push(tower);
  const start = new THREE.Vector3(TOWER_SPEC.x + 700, 300, TOWER_SPEC.z);
  const direction = new THREE.Vector3(-1, 0, 0);
  expect(tower.obstructRay(start, direction, 20)).toBe(20);
  expect(tower.obstructRay(start, direction, 800)).toBeGreaterThan(250);
  expect(tower.obstructRay(start, direction, 800)).toBeLessThan(500);
  expect(tower.obstructRay(new THREE.Vector3(TOWER_SPEC.x, 2455 + 5, TOWER_SPEC.z), new THREE.Vector3(1, 0, 0), 200)).toBe(200);
});

test('tower: optimized floor and rail queries match full-winding behavior at seeded world, road and boundary points', () => {
  const random = seededRandom(); let comparisons = 0, supported = 0, collisions = 0;
  const compare = (x, z, y, radius) => {
    // The repaired final landing and its taller guards deliberately replace
    // the old broken summit. All earlier floors retain the accepted behavior.
    if (Number.isFinite(y) && y >= TOWER_SPEC.baseY + TOWER_SPEC.height - 10) return;
    const floor = referenceSurface(x, z, y), collision = referenceBlocked(x, z, radius, y);
    const actualFloor = surfaceAt(x, z, y), actualCollision = blocked(x, z, radius, y);
    if (actualFloor !== floor || actualCollision !== collision) {
      expect({ floor: actualFloor, collision: actualCollision, x, z, y, radius }).toEqual({ floor, collision, x, z, y, radius });
    }
    comparisons++; supported += Number(floor !== null); collisions += Number(collision);
  };
  for (let index = 0; index < 30000; index++) {
    if (index % 3 === 0) {
      compare((random() - .5) * 18000, (random() - .5) * 18000, random() * 3300 - 300, random() * 8);
    } else {
      const point = pathPoint(random(), (random() - .5) * 35);
      const offset = index % 5 === 0 ? (random() - .5) * 550 : (random() - .5) * 8;
      compare(point.x, point.z, point.y + offset, index % 7 ? .48 : random() * 1000);
    }
  }
  const progress = [0, 5e-9, .000749999, .00075, .000750001, .001,
    1 / 12 - 1e-9, 1 / 12, 1 / 12 + 1e-9, .1, .2, .3, .4, .5, .6, .7, .8, .9, .9969999, .997, .999999995, 1];
  const widths = [-11.04000001, -11.04, -11.03999999, -11.7, -11, -10.3, 0, 10.3, 11, 11.7,
    11.03999999, 11.04, 11.04000001, 12, 62];
  for (const t of progress) for (const width of widths) {
    const point = pathPoint(t, width);
    for (const dy of [-201, -1.80000001, -1.8, -1.2, -1, 0, .8, 1.7, 1.8, 201]) {
      for (const radius of [-1, 0, .48, 8, 1000]) compare(point.x, point.z, point.y + dy, radius);
    }
  }
  for (const dx of [0, 139.999999, 140, 145, 165, 432, 506, 506.000001]) {
    for (const dz of [-13.000001, -13, -1e-8, 0, 1e-8, 13, 13.000001]) {
      for (const y of [53.8, 54, 55, 2453.2, 2454.8, 2455, 2456.7, 2456.700001]) {
        compare(TOWER_SPEC.x + dx, TOWER_SPEC.z + dz, y, .48);
      }
    }
  }
  for (const value of [NaN, Infinity, -Infinity]) {
    compare(value, TOWER_SPEC.z, 55, .48); compare(TOWER_SPEC.x, value, 55, .48);
    compare(TOWER_SPEC.x, TOWER_SPEC.z, value, .48); compare(TOWER_SPEC.x, TOWER_SPEC.z, 55, value);
  }
  expect(comparisons).toBeGreaterThan(40000);
  expect(supported).toBeGreaterThan(2000); expect(collisions).toBeGreaterThan(2000);
});

test('tower: finite AABB ray broad phase preserves actual old triangle intersections for long and short rays', () => {
  const scene = new THREE.Scene(), tower = createTower(scene); fixtures.push(tower);
  const root = scene.children[0], solids = [root.children[0], root.children[1], root.children[4], root.children[3], root.children[5]];
  const boxes = solids.map(mesh => mesh.geometry.boundingBox);
  expect(boxes.every(box => box?.isBox3)).toBe(true);
  const raycaster = new THREE.Raycaster(), random = seededRandom(485721), direction = new THREE.Vector3();
  let hits = 0, clear = 0;
  for (let index = 0; index < 1200; index++) {
    const point = pathPoint(random()), center = new THREE.Vector3(point.x, point.y, point.z);
    let origin, distance;
    switch (index % 6) {
      case 0:
        origin = new THREE.Vector3(TOWER_SPEC.x + 3000, random() * 2900, TOWER_SPEC.z - 4000);
        direction.copy(center).sub(origin).normalize(); distance = 30; break;
      case 1:
        origin = center.clone().add(new THREE.Vector3(Math.cos(point.angle) * 100, 1, Math.sin(point.angle) * 100));
        direction.set(-Math.cos(point.angle), 0, -Math.sin(point.angle)); distance = 400; break;
      case 2:
        origin = center.clone().add(new THREE.Vector3(0, 10, 0)); direction.set(0, -1, 0); distance = 50; break;
      case 3:
        origin = new THREE.Vector3(TOWER_SPEC.x, 2460, TOWER_SPEC.z); direction.set(1, 0, 0); distance = 300; break;
      case 4:
        origin = new THREE.Vector3(TOWER_SPEC.x + (random() - .5) * 1400, random() * 3300, TOWER_SPEC.z + (random() - .5) * 1400);
        direction.copy(center).sub(origin).normalize(); distance = random() * 2800; break;
      default:
        origin = center.clone().add(new THREE.Vector3(0, .06, 0)); direction.set(0, -1, 0); distance = index % 4 ? .0501 : .06;
    }
    const actual = tower.obstructRay(origin, direction, distance);
    raycaster.set(origin, direction); raycaster.near = .05; raycaster.far = distance;
    for (const mesh of solids) mesh.geometry.boundingBox = null;
    const expected = raycaster.intersectObjects(solids, false)[0]?.distance ?? distance;
    for (let item = 0; item < solids.length; item++) solids[item].geometry.boundingBox = boxes[item];
    if (Math.abs(actual - expected) > 1e-7) expect({ actual, origin: origin.toArray(), direction: direction.toArray(), distance }).toEqual({ actual: expected, origin: origin.toArray(), direction: direction.toArray(), distance });
    hits += Number(expected < distance); clear += Number(expected === distance);
  }
  expect(hits).toBeGreaterThan(350); expect(clear).toBeGreaterThan(350);
  for (const distance of [0, .04, .05, -1, NaN, Infinity]) {
    expect(tower.obstructRay(new THREE.Vector3(), new THREE.Vector3(1, 0, 0), distance)).toBe(distance);
  }
}, 20000);

test('boss: visitors below the crown and beyond the arena cannot activate or hurt the boss', () => {
  const model = createBossState();
  tick(model, { ...summit(), y: 55 }, 30);
  expect(model.state.active).toBe(false); expect(model.state.attacks).toBe(0);
  expect(model.hit('weak', 31)).toBe(false);
  tick(model, { ...summit(), x: BOSS_SPEC.x + 500 }, 30);
  expect(model.state.active).toBe(false);
});

test('boss: weak points and actual bounded firing rhythm complete all three phases exactly once', () => {
  const model = createBossState(), visitor = summit(); model.update(visitor, 0, .05);
  const phases = new Set([model.state.phase]);
  for (let index = 0; index < 18; index++) {
    expect(model.hit('weak', 1 + index * .22)).toBe(true);
    phases.add(model.state.phase);
  }
  expect([...phases].sort()).toEqual([1, 2, 3]);
  expect(model.state).toMatchObject({ hp: 0, defeated: true, completions: 1, weakHits: 18, shotsTaken: 18, active: false });
  expect(model.hit('weak', 99)).toBe(false); tick(model, visitor, 20);
  expect(model.state.completions).toBe(1); expect(model.state.projectiles).toEqual([]);
  expect(model.state.pulses).toEqual([]);
});

test('boss: body takes 36 shots, cooldown rejects simultaneous multi-hit and arena retreat resets living fight', () => {
  const model = createBossState(), visitor = summit(); model.update(visitor, 0, .05);
  expect(model.hit('body', 1)).toBe(true); expect(model.hit('body', 1.01)).toBe(false);
  expect(model.state.hp).toBe(35);
  tick(model, { ...visitor, y: 55 }, 1);
  expect(model.state).toMatchObject({ hp: 36, phase: 1, active: false, resets: 1 });
  model.update(visitor, 2, .05);
  for (let index = 0; index < 36; index++) expect(model.hit('body', 3 + index * .22)).toBe(true);
  expect(model.state.defeated).toBe(true); expect(model.state.completions).toBe(1);
});

test('boss: telegraphed aimed volleys cause actual finite projectile body damage', () => {
  const model = createBossState(), visitor = summit(), damage = [];
  tick(model, visitor, 10, { onDamage: value => damage.push(value) });
  expect(model.state.telegraphs).toBeGreaterThan(0); expect(model.state.attacks).toBeGreaterThan(0);
  expect(model.state.projectileImpacts).toBeGreaterThan(0);
  expect(damage.length).toBeGreaterThan(0); expect(damage.every(value => value >= .1 && value <= .13)).toBe(true);
  expect(model.state.damageEvents).toBe(damage.length);
});

test('boss: true world ray occlusion suppresses shots while pulse jump or running avoids damage', () => {
  const model = createBossState(), visitor = summit(); let damage = 0;
  tick(model, visitor, 10, { onDamage: value => damage += value, obstructRay: () => 0 });
  expect(damage).toBe(0); expect(model.state.projectileImpacts).toBe(0);
  model.state.pending = { at: 10, type: 'pulse', phase: 3 };
  model.update({ ...visitor, y: BOSS_SPEC.floorY + 2 }, 10.05, .05, value => damage += value, () => 0);
  tick(model, { ...visitor, y: BOSS_SPEC.floorY + 2 }, 5, { time: 10.05, onDamage: value => damage += value, obstructRay: () => 0 });
  expect(damage).toBe(0);
});

test('boss: projectile and pulse pools remain bounded across long combat and death clears danger', () => {
  const model = createBossState(), visitor = summit(); let maximum = 0;
  for (let index = 0; index < 2400; index++) {
    model.update({ ...visitor, x: BOSS_SPEC.x + 130 * Math.cos(index * .035),
      z: BOSS_SPEC.z + 130 * Math.sin(index * .035) }, index * .05, .05);
    maximum = Math.max(maximum, model.state.projectiles.length);
    expect(model.state.projectiles.length).toBeLessThanOrEqual(24);
    expect(model.state.pulses.length).toBeLessThanOrEqual(3);
  }
  expect(maximum).toBeGreaterThan(0);
  model.update({ ...visitor, health: 0 }, 130, .05);
  expect(model.state.active).toBe(false); expect(model.state.projectiles).toEqual([]); expect(model.state.pulses).toEqual([]);
});

test('boss: real different target parts, persistent defeated state and idempotent resource cleanup', () => {
  const scene = new THREE.Scene(), boss = createBoss(scene); fixtures.push(boss);
  const visitor = summit(); boss.update(visitor, 0, .05);
  const weak = boss.targets().find(item => item.userData.bossPart === 'weak');
  expect(weak).toBeTruthy(); expect(boss.snapshot()).toMatchObject({ projectilePool: 24, pulsePool: 3, maxHp: 36 });
  for (let index = 0; index < 18; index++) expect(boss.hit(weak, 1 + index * .22)).toBe(true);
  boss.update(visitor, 10, .05);
  expect(boss.targets()).toEqual([]); expect(boss.snapshot().defeated).toBe(true);
  const geometry = new Set(), material = new Set();
  scene.traverse(item => { if (item.geometry) geometry.add(item.geometry); if (item.material) material.add(item.material); });
  let cleared = 0;
  for (const item of [...geometry, ...material]) item.addEventListener('dispose', () => cleared++);
  boss.dispose(); boss.dispose();
  expect(cleared).toBe(geometry.size + material.size); expect(scene.children).toEqual([]);
  const finished = createBoss(new THREE.Scene(), { defeated: true }); fixtures.push(finished);
  finished.update(visitor, 100, .05, () => { throw new Error('finished boss attacked'); });
  expect(finished.snapshot()).toMatchObject({ defeated: true, hp: 0, completions: 1 });
  expect(finished.targets()).toEqual([]);
});

test('boss: projectile scratch vectors preserve combat and the defeat getter cannot mutate state', () => {
  const origins = new Set(), directions = new Set(), damage = [], referenceDamage = [], rays = [];
  const scene = new THREE.Scene(), boss = createBoss(scene, { obstructRay: (origin, direction, distance) => {
    origins.add(origin); directions.add(direction);
    rays.push({ origin: origin.clone(), direction: direction.clone(), distance });
    return distance;
  } }); fixtures.push(boss);
  const visitor = summit(), reference = createBossState();
  expect(boss.isDefeated).toBe(false); expect(Reflect.set(boss, 'isDefeated', true)).toBe(false);
  expect(Object.getOwnPropertyDescriptor(boss, 'isDefeated').set).toBeUndefined();
  for (let index = 0; index < 300; index++) {
    const time = index * .05;
    boss.update(visitor, time, .05, value => damage.push(value));
    reference.update(visitor, time, .05, value => referenceDamage.push(value));
  }
  expect(rays.length).toBeGreaterThan(80); expect(origins.size).toBe(1); expect(directions.size).toBe(1);
  expect(rays.every(ray => Number.isFinite(ray.distance) && ray.distance > 0
    && Math.abs(ray.direction.length() - 1) < 1e-9)).toBe(true);
  expect(damage).toEqual(referenceDamage);
  const actual = boss.snapshot(), expected = reference.snapshot();
  for (const key of ['hp', 'active', 'phase', 'attacks', 'telegraphs', 'damageTotal', 'damageEvents', 'projectileImpacts', 'projectiles', 'pulses']) {
    expect(actual[key]).toEqual(expected[key]);
  }
  const target = boss.targets().find(mesh => mesh.userData.bossPart === 'body');
  for (let index = 0; index < 36; index++) expect(boss.hit(target, 20 + index * .22)).toBe(true);
  expect(boss.isDefeated).toBe(true); expect(Reflect.set(boss, 'isDefeated', false)).toBe(false);
  expect(boss.snapshot()).toMatchObject({ defeated: true, hp: 0, completions: 1 });
});
