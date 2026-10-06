import { afterEach, expect, test } from 'vitest';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { createEncounterPlan, createEncounterState, createEncounters, ENCOUNTER_LIMITS, ENCOUNTER_ROLES } from '../config/apps/portal/src/q7/9m.mjs';
import { TOWER_SPEC, pathPoint, surfaceAt, blocked, createTower } from '../config/apps/portal/src/p2/z2.mjs';
import { stepPlayer } from '../config/apps/portal/src/3d/model.mjs';
const requirePortal = createRequire(new URL('../config/apps/portal/package.json', import.meta.url));
const THREE = await import(pathToFileURL(path.join(path.dirname(requirePortal.resolve('three')), 'three.module.js')).href);
const fixtures = [];
afterEach(() => { for (const fixture of fixtures.splice(0)) fixture.dispose(); });
const player = (x = 1000, y = 0, z = 1000) => ({ x, y, z, health: 1 });
const region = (points, options = {}) => ({ id: 'test', type: 'meadow', cap: 10, roam: 110, x: 1000, y: 0, z: 1000, points, ...options });
const point = (kind, x = 1050, y = 0, z = 1000) => ({ kind, x, y, z, valid: true });
function tick(model, visitor, start, seconds, onDamage = () => {}, obstruction) {
  for (let index = 1; index <= seconds / .05; index++) model.update(visitor, start + index * .05, .05, onDamage, false, obstruction);
}

test('encounters: fixed 10440 slots cover the whole ground grid, nine cities, eight meadows and all twelve tower windings', () => {
  const plan = createEncounterPlan({ ground: () => 0, isBlocked: blocked });
  expect(plan.regions.length).toBe(2529);
  expect(plan.regions.filter(item => item.type === 'grid')).toHaveLength(2500);
  expect(plan.regions.filter(item => item.type === 'city').length).toBe(9);
  expect(plan.regions.filter(item => item.type === 'meadow').length).toBe(8);
  const towers = plan.regions.filter(item => item.type === 'tower');
  expect(towers.length).toBe(12);
  for (const [turn, zone] of towers.entries()) {
    expect(zone.points.length).toBe(24);
    for (const actor of zone.points) {
      expect(actor.t).toBeGreaterThan(turn / 12); expect(actor.t).toBeLessThan((turn + 1) / 12);
      expect(actor.valid).toBe(true);
      expect(surfaceAt(actor.x, actor.z, actor.y)).toBeCloseTo(actor.y, 6);
      expect(blocked(actor.x, actor.z, ENCOUNTER_ROLES[actor.kind].radius, actor.y)).toBe(false);
      for (const t of [0, 1 / 3, 2 / 3, 1]) {
        const station = pathPoint(t, t === 1 ? -20 : 0);
        expect(Math.hypot(actor.x - station.x, actor.y - station.y, actor.z - station.z)).toBeGreaterThan(24);
      }
    }
  }
  const model = createEncounterState({ ...plan });
  expect(model.snapshot().totalActors).toBe(10440); expect(Object.keys(model.snapshot().species)).toHaveLength(6);
  expect(Object.values(model.snapshot().species).every(count => count >= 1650)).toBe(true);
  expect(model.actors.every(actor => actor.spawnValid)).toBe(true);
});

test('encounters: global and per-region limits, sleeping height layers, actor objects and projectiles stay bounded', () => {
  const regions = Array.from({ length: 12 }, (_, index) => region(Array.from({ length: 10 }, (_, slot) => point('coil', 1055 + index, 0, 990 + slot)), { id: `r-${index}` }));
  const model = createEncounterState({ regions }), identities = [...model.actors], shots = [...model.projectiles], visitor = player();
  model.update(visitor, 0, .05); expect(model.snapshot().activeCount).toBe(64);
  tick(model, visitor, 0, 2);
  expect(model.snapshot().projectilePeak).toBeLessThanOrEqual(96); expect(model.snapshot().droppedShots).toBeGreaterThan(0);
  for (let index = 0; index < 800; index++) {
    model.update(visitor, 2 + index * .05, .05);
    const snapshot = model.snapshot();
    expect(snapshot.activeCount).toBeLessThanOrEqual(64); expect(snapshot.projectiles.length).toBeLessThanOrEqual(96);
    expect(snapshot.regions.every(zone => zone.active <= zone.cap)).toBe(true);
  }
  expect(model.actors).toEqual(identities); expect(model.actors.every((actor, index) => actor === identities[index])).toBe(true);
  expect(model.projectiles.every((shot, index) => shot === shots[index])).toBe(true);
  const before = model.actors.map(actor => actor.walked);
  model.update(player(1000, 200, 1000), 43, .05);
  expect(model.snapshot().activeCount).toBe(0); expect(model.snapshot().projectiles).toEqual([]);
  expect(model.actors.map(actor => actor.walked)).toEqual(before);
});

test('encounters: warnings precede actual chasing, projectile body damage and melee; world rays stop bullets', () => {
  const visitor = player(), model = createEncounterState({ regions: [region([
    point('wisp', 1060), point('crawler', 1015), point('pillar', 1080), point('lens', 1055, 0, 1010),
  ])] });
  const damage = [];
  model.update(visitor, 0, .05, amount => damage.push(amount));
  expect(model.snapshot().actors.some(actor => actor.warning)).toBe(true); expect(damage).toEqual([]);
  tick(model, visitor, 0, 14, amount => damage.push(amount));
  const snapshot = model.snapshot();
  expect(snapshot.actors.some(actor => actor.walked > 10)).toBe(true);
  expect(snapshot.attacks).toBeGreaterThan(4); expect(snapshot.meleeAttacks).toBeGreaterThan(0);
  expect(snapshot.projectileImpacts).toBeGreaterThan(0); expect(damage.length).toBeGreaterThan(2);
  expect(damage.every(value => value >= .035 && value <= .06)).toBe(true);
  const occluded = createEncounterState({ regions: [region([point('pillar', 1050)])] }); let blockedDamage = 0;
  tick(occluded, visitor, 0, 14, amount => blockedDamage += amount, () => 0);
  expect(blockedDamage).toBe(0); expect(occluded.snapshot().blockedShots).toBeGreaterThan(0);
});

test('encounters: lethal accepted hits trigger repeatable 20–36-second resurrection on the same object and a separate health pickup', () => {
  const model = createEncounterState({ regions: [region([point('wisp')])] }), visitor = player(1048);
  const identity = model.actors[0]; let time = 0;
  for (let life = 0; life < 8; life++) {
    model.update(visitor, time, .05);
    const generation = model.actors[0].generation;
    expect(model.hit(0, time + .2)).toBe(true); expect(model.hit(0, time + .21)).toBe(false);
    expect(model.hit(0, time + .42)).toBe(true); expect(model.hit(0, time + .64)).toBe(true);
    const dead = model.snapshot().actors[0];
    expect(dead.alive).toBe(false); expect(model.hit(0, time + .9)).toBe(false);
    model.update(player(8000, 0, 8000), time + .9, .05); expect(model.tracking().actors).toEqual([]);
    model.update(visitor, time + .95, .05); expect(model.tracking().actors[0].alive).toBe(false);
    expect(dead.respawnAt - (time + .64)).toBeGreaterThanOrEqual(20);
    expect(dead.respawnAt - (time + .64)).toBeLessThanOrEqual(36);
    expect(model.collect(player(dead.x, dead.y, dead.z), time + 1)).toBe(.045);
    expect(model.collect(player(dead.x, dead.y, dead.z), time + 1.1)).toBe(0);
    model.update(visitor, dead.respawnAt - .001, .05); expect(model.actors[0].alive).toBe(false);
    time = dead.respawnAt; model.update(visitor, time, .05);
    expect(model.actors[0]).toBe(identity); expect(model.actors[0].alive).toBe(true);
    expect(model.actors[0].generation).toBe(generation + 1); expect(model.actors[0].hp).toBe(3);
  }
  expect(model.snapshot()).toMatchObject({ kills: 8, respawns: 8, collected: 8, acceptedHits: 24 });
});

test('encounters: a zero-time resume retains flying projectiles and melee cannot cross an actual obstructing wall', () => {
  const shots = createEncounterState({ regions: [region([point('pillar', 1050)])] }), visitor = player();
  tick(shots, visitor, 0, 1.35);
  const before = shots.snapshot().projectiles; expect(before.length).toBeGreaterThan(0);
  shots.update(visitor, 1.35, 0);
  expect(shots.snapshot().projectiles).toEqual(before);
  const melee = createEncounterState({ regions: [region([point('crawler', 1003)])] }); let damage = 0;
  tick(melee, visitor, 0, 8, value => damage += value, () => 0);
  expect(melee.snapshot().attacks).toBeGreaterThan(0); expect(melee.snapshot().blockedMelee).toBeGreaterThan(0);
  expect(damage).toBe(0); expect(melee.snapshot().meleeAttacks).toBe(0);
});

test('encounters: tutorial, respawn and saved rest approaches remain safe and tower enemies follow the current foot layer', () => {
  const plan = createEncounterPlan(), model = createEncounterState({ ...plan });
  model.update(player(0, 0, 180), 0, .05);
  for (const actor of model.actors) if (actor.resolved && actor.spawnValid && actor.y < 80) expect(Math.abs(actor.x) >= 110 || actor.z <= -580 || actor.z >= 310).toBe(true);
  const role = ENCOUNTER_ROLES.crawler, start = pathPoint(.46, 4.8), target = pathPoint(.4605);
  const floor = (x, z, y) => Math.max(TOWER_SPEC.baseY, surfaceAt(x, z, y) ?? TOWER_SPEC.baseY);
  const tower = createEncounterState({ regions: [region([{ ...start, kind: 'crawler' }], { type: 'tower', roam: 66 })], ground: floor, isBlocked: blocked });
  tick(tower, player(target.x, target.y, target.z), 0, 8);
  const actor = tower.snapshot().actors[0];
  expect(actor.walked).toBeGreaterThan(4); expect(actor.y).toBeGreaterThan(TOWER_SPEC.baseY + 1000);
  expect(Math.abs(actor.y - floor(actor.x, actor.z, actor.y))).toBeLessThan(.001);
  const safe = createEncounterState({ regions: [region([point('pillar', 1030)])], stations: [{ x: 1000, y: 0, z: 1000, radius: 24 }] });
  let damage = 0; tick(safe, player(), 0, 30, value => damage += value);
  expect(damage).toBe(0); expect(safe.snapshot().attacks).toBe(0);
});

test('encounters: true gravity and 58m/s sprint retain the current floor through low, middle and high tower samples', () => {
  const tower = createTower(new THREE.Scene()); fixtures.push(tower);
  const origin = new THREE.Vector3(), direction = new THREE.Vector3();
  const obstruction = (start, ray, distance) => tower.obstructRay(origin.set(start.x, start.y, start.z), direction.set(ray.x, ray.y, ray.z), distance);
  for (const startT of [.01, .46, .985]) {
    const start = pathPoint(startT), visitor = { ...start, vy: 0, grounded: true, health: 1, energy: 1 };
    const ground = (x, z, y = visitor.y) => Math.max(TOWER_SPEC.baseY + .085, surfaceAt(x, z, y) ?? TOWER_SPEC.baseY + .085);
    const plan = createEncounterPlan({ ground, isBlocked: blocked });
    const model = createEncounterState({ regions: plan.regions.filter(region => region.type === 'tower'), stations: plan.stations, ground, isBlocked: blocked });
    let time = 0;
    for (let frame = 0; frame < 80 && visitor.y < start.y + 9.6; frame++) {
      const t = (visitor.y - TOWER_SPEC.baseY) / TOWER_SPEC.height;
      const target = pathPoint(Math.min(1, t + 32 / (pathPoint(t).radius * Math.PI * 24)));
      stepPlayer(visitor, { forward: 1, sprint: true, yaw: Math.atan2(-(target.x - visitor.x), -(target.z - visitor.z)) }, .05, ground, blocked);
      time += .05; model.update(visitor, time, .05, value => visitor.health -= value, false, obstruction);
    }
    expect(visitor.y).toBeGreaterThan(start.y + 8); expect(visitor.health).toBeGreaterThan(.75);
    expect(model.snapshot().totalActors).toBe(288); expect(model.snapshot().activeCount).toBeGreaterThan(0);
    expect(Math.abs(visitor.y - ground(visitor.x, visitor.z, visitor.y))).toBeLessThan(.001);
  }
});

test('encounters: real instanceId shooting updates current matrices, hides killed instances, and releases each resource once', () => {
  const scene = new THREE.Scene(), instance = createEncounters(scene, { ground: () => 0 }); fixtures.push(instance);
  const initial = instance.snapshot().anchors.find(actor => actor.region === 'c-city' && actor.kind === 'wisp');
  const visitor = player(initial.x - 12, initial.y, initial.z);
  instance.update(visitor, 0, .05);
  const ray = new THREE.Raycaster(new THREE.Vector3(visitor.x, visitor.y + 2.5, visitor.z), new THREE.Vector3(1, 0, 0), .05, 40);
  const actualHits = ray.intersectObjects(instance.targets(), false);
  expect(actualHits.length).toBeGreaterThan(0); expect(actualHits[0].instanceId).toBeTypeOf('number');
  const hit = actualHits[0];
  expect(instance.hit(hit.object, .2)).toBe(false);
  expect(instance.hit(hit.object, .2, -1)).toBe(false);
  expect(instance.hit(hit.object, .2, hit.instanceId)).toBe(true);
  let actor = instance.snapshot().actors.find(actor => actor.id === initial.id);
  expect(actor.hp).toBe(2);
  for (let shot = 0; shot < 2; shot++) {
    const intersection = ray.intersectObjects(instance.targets(), false)[0]; expect(intersection).toBeTruthy();
    expect(instance.hit(intersection.object, .45 + shot * .25, intersection.instanceId)).toBe(true);
  }
  actor = instance.snapshot().actors.find(actor => actor.id === initial.id); expect(actor.alive).toBe(false);
  instance.update(visitor, actor.respawnAt, .05);
  expect(instance.snapshot().actors.find(actor => actor.id === initial.id)).toMatchObject({ alive: true, generation: 1, hp: 3 });
  expect(ray.intersectObjects(instance.targets(), false).length).toBeGreaterThan(0);
  const geometries = new Set(), materials = new Set(), meshes = new Set();
  scene.traverse(mesh => { if (mesh.geometry) geometries.add(mesh.geometry); if (mesh.material) materials.add(mesh.material); if (mesh.isInstancedMesh) meshes.add(mesh); });
  expect(geometries.size).toBe(10); expect(meshes.size).toBeLessThan(45);
  let disposed = 0; for (const value of [...geometries, ...materials, ...meshes]) value.addEventListener('dispose', () => disposed++);
  instance.dispose(); instance.dispose();
  expect(disposed).toBe(geometries.size + materials.size + meshes.size); expect(scene.children).toEqual([]);
  expect(instance.targets()).toEqual([]); expect(instance.collect(visitor, 999)).toBe(0);
  expect(instance.snapshot().activeCount).toBe(0); expect(instance.snapshot().renderInstances).toBe(0);
  expect(instance.snapshot().regions.every(region => region.active === 0)).toBe(true);
});

test('encounters: representative distant ground cells resolve only indexed neighbors, show bounded enemies and preserve far instance shooting', () => {
  const plan = createEncounterPlan({ ground: () => 0 }), model = createEncounterState({ ...plan, ground: () => 0 });
  const identities = [...model.actors];
  for (const [index, position] of [[[-5200, -5100]], [[5100, -5100]], [[-5100, 5100]], [[5100, 5100]], [[2300, -2100]]].map((entry, index) => [index, entry[0]])) {
    model.update(player(position[0], 0, position[1]), index * .2, .05);
    const snapshot = model.snapshot();
    expect(snapshot.totalActors).toBe(10440); expect(snapshot.visibleCount).toBeGreaterThan(150);
    expect(snapshot.visibleCount).toBeLessThanOrEqual(256); expect(snapshot.activeCount).toBeLessThanOrEqual(64);
    expect(snapshot.lastCandidates).toBeLessThan(1200); expect(snapshot.actors.length).toBeLessThanOrEqual(288);
    expect(snapshot.regions.every(zone => zone.active <= zone.cap)).toBe(true);
  }
  expect(model.actors.every((actor, index) => actor === identities[index])).toBe(true);
  const scene = new THREE.Scene(), instance = createEncounters(scene, { ground: () => 0 }); fixtures.push(instance);
  instance.update(player(2300, 0, -2100), 0, .05);
  const snapshot = instance.snapshot(); expect(snapshot.farMeshes).toBe(1); expect(snapshot.farInstances).toBeGreaterThan(100);
  expect(snapshot.renderInstances).toBeLessThanOrEqual(256); expect(snapshot.nearInstances).toBeLessThanOrEqual(64);
  const far = instance.targets().find(mesh => mesh.userData.encounterKind === 'far'); expect(far).toBeTruthy();
  const matrix = new THREE.Matrix4(); far.getMatrixAt(0, matrix);
  const center = new THREE.Vector3().setFromMatrixPosition(matrix), origin = center.clone().add(new THREE.Vector3(0, 0, 10));
  const intersection = new THREE.Raycaster(origin, new THREE.Vector3(0, 0, -1), .05, 15).intersectObject(far, false)[0];
  expect(intersection?.instanceId).toBe(0); expect(instance.hit(far, .2, intersection.instanceId)).toBe(true);
});
