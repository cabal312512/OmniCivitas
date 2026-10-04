import { afterEach, expect, test } from 'vitest';
import { createEntities } from '../config/apps/portal/src/3d/entities.mjs';

// Actual Three.js graphs and geometry, with deterministic simulation inputs.
// These are behavior tests, not WebGL rendering or native-control evidence.
const fixtures = [];
const flat = () => 0;
const open = () => false;
const landmarks = Array.from({ length: 16 }, (_, index) => ({
  position: { x: 1100 + index % 4 * 330, z: -900 - Math.floor(index / 4) * 310 },
}));
function create({ places = landmarks, ground = flat, blocked = open } = {}) {
  const capture = { add(root) { this.root = root; } };
  const instance = createEntities(capture, places, ground, blocked);
  const scene = new capture.root.constructor();
  scene.add(capture.root);
  const fixture = { instance, scene, root: capture.root, time: 0 };
  fixtures.push(fixture);
  return fixture;
}
afterEach(() => { for (const fixture of fixtures.splice(0)) fixture.instance.dispose(); });
const player = (x = 0, z = 180) => ({ x, y: 0, z, health: 1 });
const entity = (fixture, id) => fixture.instance.snapshot().entities.find(item => item.id === id);
const target = (fixture, id, part) => fixture.instance.targets().find(item => item.userData.entity.id === id && (!part || item.userData.part === part));
function tick(fixture, visitor, seconds, { onDamage = () => {}, obstruction, reduced = false } = {}) {
  const steps = Math.ceil(seconds / .05);
  for (let index = 0; index < steps; index++) {
    fixture.time += .05;
    fixture.instance.update(visitor, fixture.time, .05, onDamage, reduced, obstruction);
  }
}

test('3D entity behavior: five different bodies and health roles exist in a bounded population', () => {
  const fixture = create();
  const state = fixture.instance.snapshot();
  expect(state.entities.length).toBeGreaterThanOrEqual(70);
  expect(state.entities.length).toBeLessThanOrEqual(95);
  expect(Object.keys(state.species).sort()).toEqual(['drone', 'jelly', 'orb', 'sentinel', 'stalker']);
  expect(Object.values(state.species).every(count => count > 0)).toBe(true);
  const signatures = new Set();
  for (const species of Object.keys(state.species)) {
    const id = state.entities.find(item => item.species === species).id;
    const graph = target(fixture, id).userData.entity.group;
    const parts = [];
    graph.traverse(item => { if (item.isMesh) parts.push(item.geometry.type); });
    signatures.add(parts.sort().join(','));
  }
  expect(signatures.size).toBe(5);
  expect(new Set(state.entities.map(item => item.maxHp)).size).toBeGreaterThan(2);
  expect(state.entities.every(item => item.hp === item.maxHp && item.maxHp >= 3)).toBe(true);
  expect(state.entities[0]).toMatchObject({ id: 0, x: 0, y: 2.2, z: 155, hp: 3, proactive: false });
});

test('3D entity behavior: spawn and the first four remain safe without being provoked', () => {
  const fixture = create();
  let hurt = 0;
  tick(fixture, player(), 20, { onDamage: value => hurt += value });
  tick(fixture, player(35, 120), 20, { onDamage: value => hurt += value });
  expect(hurt).toBe(0);
  expect(fixture.instance.snapshot().shotsAtPlayer).toBe(0);
  expect(fixture.instance.snapshot().entities.slice(0, 4).every(item => !item.hostile && item.attacks === 0)).toBe(true);
});

test('3D entity behavior: three hits drop the foreground object, collect once and respawn with full health', () => {
  const fixture = create();
  const foreground = target(fixture, 0);
  for (let shot = 0; shot < 3; shot++) expect(fixture.instance.hit(foreground, fixture.time)).toBe(true);
  expect(entity(fixture, 0)).toMatchObject({ hp: 0, state: 'seed' });
  expect(fixture.instance.snapshot().kills).toBe(1);
  expect(fixture.instance.hit(foreground, fixture.time)).toBe(false);
  expect(fixture.instance.collect(player(0, 155), fixture.time)).toEqual([0]);
  expect(fixture.instance.collect(player(0, 155), fixture.time)).toEqual([]);
  expect(entity(fixture, 0)).toMatchObject({ state: 'sleep', visible: false });
  tick(fixture, player(), 40);
  expect(entity(fixture, 0)).toMatchObject({ hp: 3, state: 'idle', visible: true });
  expect(fixture.instance.snapshot().collected).toBe(1);
  expect(fixture.instance.targets()).toContain(foreground);
});

test('3D entity behavior: a nearby unprovoked drone fires real simulated projectiles that damage a body', () => {
  const fixture = create(), visitor = player(0, 95), damage = [];
  tick(fixture, visitor, 8, { onDamage: value => { damage.push(value); visitor.health -= value; } });
  const state = fixture.instance.snapshot(), drone = entity(fixture, 4);
  expect(drone).toMatchObject({ species: 'drone', proactive: true, hostile: true, healthVisible: true, hits: 0 });
  expect(drone.attacks).toBeGreaterThan(1);
  expect(drone.damageEvents).toBeGreaterThan(0);
  expect(state.projectileImpacts).toBeGreaterThan(0);
  expect(damage.length).toBe(state.damageEvents);
  expect(damage.every(value => value > 0 && value < .25)).toBe(true);
  expect(visitor.health).toBeLessThan(1);
  expect(visitor.health).toBeGreaterThan(0);
});

test('3D entity behavior: peaceful foreground drone retaliates only after a shot', () => {
  const fixture = create(), visitor = player(8, 145);
  tick(fixture, visitor, 4);
  expect(entity(fixture, 1).attacks).toBe(0);
  expect(fixture.instance.hit(target(fixture, 1), fixture.time)).toBe(true);
  tick(fixture, visitor, 6);
  expect(entity(fixture, 1)).toMatchObject({ hp: 2, proactive: false, hostile: true, healthVisible: true });
  expect(entity(fixture, 1).damageEvents).toBeGreaterThan(0);
});

test('3D entity behavior: a ground stalker pursues, winds up and inflicts melee damage', () => {
  const fixture = create(), visitor = player(-16, -17), values = [];
  const initial = entity(fixture, 5);
  tick(fixture, visitor, 3, { onDamage: value => values.push(value) });
  const stalker = entity(fixture, 5);
  expect(stalker.species).toBe('stalker');
  expect(stalker.damageEvents).toBeGreaterThan(0);
  expect(fixture.instance.snapshot().meleeAttacks).toBeGreaterThan(0);
  expect(values).toContain(.12);
  expect(Math.hypot(visitor.x - stalker.x, visitor.z - stalker.z)).toBeLessThan(Math.hypot(visitor.x - initial.x, visitor.z - initial.z));
});

test('3D entity behavior: shield damage is separate from body health and the shield disappears', () => {
  const fixture = create(), shield = target(fixture, 6, 'shield');
  const initial = entity(fixture, 6);
  fixture.instance.hit(shield, 0);
  expect(entity(fixture, 6)).toMatchObject({ hp: initial.hp, shieldHp: 1 });
  fixture.instance.hit(shield, 0);
  expect(entity(fixture, 6)).toMatchObject({ hp: initial.hp, shieldHp: 0 });
  expect(shield.visible).toBe(false);
  expect(fixture.instance.targets()).not.toContain(shield);
  fixture.instance.hit(target(fixture, 6), 0);
  tick(fixture, player(15, -55), .05);
  expect(entity(fixture, 6)).toMatchObject({ hp: initial.hp - 1, healthVisible: true });
});

test('3D entity behavior: stationary sentinels fire and glass jellies launch distinct three-bolt volleys', () => {
  const fixture = create(), visitor = player(0, -90);
  const initialGuard = entity(fixture, 6);
  for (let index = 0; index < 50 && entity(fixture, 7).attacks === 0; index++) tick(fixture, visitor, .05);
  const volley = fixture.instance.snapshot().projectiles.filter(projectile => projectile.owner === 7);
  expect(volley).toHaveLength(3);
  expect(new Set(volley.map(projectile => projectile.x)).size).toBe(3);
  tick(fixture, visitor, 6);
  const guard = entity(fixture, 6), jelly = entity(fixture, 7);
  expect(guard.attacks).toBeGreaterThan(0);
  expect(guard.damageEvents).toBeGreaterThan(0);
  expect(guard.x).toBe(initialGuard.x);
  expect(guard.z).toBe(initialGuard.z);
  expect(jelly.attacks).toBeGreaterThanOrEqual(3);
  expect(jelly.damageEvents).toBeGreaterThan(0);
});

test('3D entity behavior: a thin collision wall stops pursuit and leashing returns the hostile home', () => {
  const wall = (x, z, radius) => x + radius >= -6 && x - radius <= -5.8 && z > -70 && z < 20;
  const occlusion = (origin, direction, max) => {
    const distance = Math.abs(direction.x) > .00001 ? (-6 - origin.x) / direction.x : -1;
    return distance >= 0 && distance < max ? distance : max;
  };
  const fixture = create({ blocked: wall });
  tick(fixture, player(10, -20), 9, { obstruction: occlusion });
  const stopped = entity(fixture, 5);
  expect(stopped.x).toBeGreaterThan(-16);
  expect(stopped.x + .8).toBeLessThan(-6);
  expect(stopped.damageEvents).toBe(0);
  tick(fixture, player(5000, 4500), 12, { obstruction: occlusion });
  const returned = entity(fixture, 5);
  expect(returned.hostile).toBe(false);
  expect(Math.hypot(returned.x - returned.homeX, returned.z - returned.homeZ)).toBeLessThan(1);
});

test('3D entity behavior: line occlusion prevents ranged attacks and walls absorb already flying bolts', () => {
  const fixture = create(), visitor = player(0, 95);
  tick(fixture, visitor, 5, { obstruction: () => 0 });
  expect(entity(fixture, 4).hostile).toBe(true);
  expect(fixture.instance.snapshot().shotsAtPlayer).toBe(0);
  expect(fixture.instance.snapshot().damageEvents).toBe(0);
  for (let index = 0; index < 20 && fixture.instance.snapshot().activeSeeds === 0; index++) tick(fixture, visitor, .05);
  expect(fixture.instance.snapshot().activeSeeds).toBeGreaterThan(0);
  tick(fixture, visitor, .05, { obstruction: () => 0 });
  expect(fixture.instance.snapshot().activeSeeds).toBe(0);
  expect(fixture.instance.snapshot().blockedShots).toBeGreaterThan(0);
  expect(fixture.instance.snapshot().damageEvents).toBe(0);
});

test('3D entity behavior: sustained volleys reuse a fixed pool without exceeding forty-eight projectiles', () => {
  const cluster = Array.from({ length: 15 }, (_, index) => ({ position: { x: index % 5 * 4 - 8, z: -60 + Math.floor(index / 5) * 4 } }));
  const fixture = create({ places: cluster }), visitor = player(0, -10);
  for (let index = 0; index < 1100; index++) {
    visitor.x = index % 2 ? 65 : -65;
    fixture.time += .03;
    fixture.instance.update(visitor, fixture.time, .03, () => {});
    if (index % 50 === 0) expect(fixture.instance.snapshot().activeSeeds).toBeLessThanOrEqual(48);
  }
  const state = fixture.instance.snapshot();
  expect(state.shotsAtPlayer).toBeGreaterThan(96);
  expect(state.projectilePeak).toBeLessThanOrEqual(48);
  expect(state.projectilePeak).toBeGreaterThan(15);
  expect(state.projectiles.length).toBeLessThanOrEqual(48);
  expect(state.projectiles.every(projectile => Number.isFinite(projectile.x) && Number.isFinite(projectile.y) && Number.isFinite(projectile.z))).toBe(true);
});

test('3D entity behavior: disposal releases each shared geometry/material once and is idempotent', () => {
  const fixture = create();
  const geometries = new Set(), materials = new Set(), released = new Map();
  fixture.root.traverse(item => {
    if (!item.isMesh) return;
    geometries.add(item.geometry);
    materials.add(item.material);
  });
  for (const resource of [...geometries, ...materials]) {
    released.set(resource, 0);
    resource.addEventListener('dispose', () => released.set(resource, released.get(resource) + 1));
  }
  expect(geometries.size).toBeLessThan(20);
  fixture.instance.dispose();
  fixture.instance.dispose();
  expect(fixture.scene.children).toHaveLength(0);
  expect([...released.values()].every(count => count === 1)).toBe(true);
  expect(fixture.instance.targets()).toEqual([]);
  expect(fixture.instance.snapshot()).toMatchObject({ disposed: true, activeSeeds: 0 });
  expect(fixture.instance.snapshot().entities.every(item => !item.visible)).toBe(true);
  expect(fixture.instance.collect(player(0, 155), 50)).toEqual([]);
});

const npcCities = ['city', 'north-city', 'white-plaza', 'arcade', 'spires'];
const npcLandmarks = landmarks.map((place, index) => ({ ...place, id: npcCities[index] || 'other-' + index }));
const npcState = (fixture, id = 1000) => fixture.instance.snapshot().npcs.find(item => item.id === id);

test('3D NPC behavior: only the five city districts contain a separate forty-person population', () => {
  const fixture = create({ places: npcLandmarks }), state = fixture.instance.snapshot();
  expect(state.entities).toHaveLength(91);
  expect(state.entities[0]).toMatchObject({ id: 0, x: 0, z: 155, hp: 3 });
  expect(state.npcCount).toBe(40);
  expect(state.npcs).toHaveLength(40);
  expect(Object.keys(state.npcKinds).sort()).toEqual(['capsule', 'cart', 'packet', 'pearl', 'tripod']);
  expect(Object.values(state.npcKinds).every(count => count > 0)).toBe(true);
  expect(state.npcs.every(item => item.id >= 1000 && item.hp >= 2 && item.hp <= 4 && !item.proactive && !item.hostile)).toBe(true);
  for (const city of npcCities) expect(state.npcs.filter(item => item.city === city)).toHaveLength(8);
  const silhouettes = new Set();
  for (const kind of Object.keys(state.npcKinds)) {
    const npc = state.npcs.find(item => item.kind === kind), parts = [];
    target(fixture, npc.id).userData.entity.group.traverse(item => { if (item.isMesh) parts.push(item.geometry.type); });
    silhouettes.add(parts.sort().join(','));
  }
  expect(silhouettes.size).toBe(5);
  expect(create().instance.snapshot().npcs).toEqual([]);
});

test('3D NPC behavior: independent wandering moves while the player is far away and stays near home', () => {
  const fixture = create({ places: npcLandmarks }), initial = fixture.instance.snapshot().npcs;
  const remote = player(5500, 5500);
  tick(fixture, remote, 6);
  const moved = fixture.instance.snapshot().npcs;
  expect(moved.filter((item, index) => Math.hypot(item.x - initial[index].x, item.z - initial[index].z) > 1).length).toBeGreaterThan(30);
  expect(moved.every(item => item.walked > 1)).toBe(true);
  tick(fixture, remote, 65);
  expect(fixture.instance.snapshot().npcs.every(item => Math.hypot(item.x - item.homeX, item.z - item.homeZ) < 32)).toBe(true);
  expect(fixture.instance.snapshot().npcs.every(item => item.speed >= 0 && item.speed <= 4.01)).toBe(true);
});

test('3D NPC behavior: shooting a civilian reduces its health without provoking an attack', () => {
  const fixture = create({ places: npcLandmarks }), body = target(fixture, 1000), initial = npcState(fixture);
  expect(fixture.instance.hit(body, fixture.time)).toBe(true);
  tick(fixture, player(initial.x + 3, initial.z), .05);
  expect(npcState(fixture)).toMatchObject({ hp: initial.hp - 1, healthVisible: true, hostile: false, attacks: 0, damageEvents: 0 });
  tick(fixture, player(initial.x + 3, initial.z), 6);
  expect(body.userData.entity.attacks).toBe(0);
  expect(body.userData.entity.damageEvents).toBe(0);
  expect(body.userData.entity.hostile).toBe(0);
  expect(fixture.instance.snapshot().projectiles.every(bolt => bolt.owner < 1000)).toBe(true);
});

test('3D NPC behavior: destroy and collect use separate IDs and counters without changing enemy discoveries', () => {
  const fixture = create({ places: npcLandmarks }), body = target(fixture, 1000), initial = npcState(fixture);
  for (let shot = 0; shot < initial.maxHp; shot++) fixture.instance.hit(body, fixture.time);
  expect(npcState(fixture)).toMatchObject({ hp: 0, state: 'seed' });
  expect(fixture.instance.snapshot()).toMatchObject({ kills: 0, collected: 0, npcKills: 1, npcCollected: 0 });
  expect(fixture.instance.targets()).not.toContain(body);
  expect(fixture.instance.collect(player(initial.x, initial.z), fixture.time)).toEqual([1000]);
  expect(fixture.instance.collect(player(initial.x, initial.z), fixture.time)).toEqual([]);
  expect(fixture.instance.snapshot()).toMatchObject({ kills: 0, collected: 0, npcKills: 1, npcCollected: 1 });
  expect(npcState(fixture)).toMatchObject({ state: 'sleep', visible: false });
  tick(fixture, player(5500, 5500), 50);
  expect(npcState(fixture)).toMatchObject({ hp: initial.maxHp, state: 'idle', visible: true });
});

test('3D NPC behavior: real blocked footprints confine wandering without clipping through thin walls', () => {
  const centerX = 1100, centerZ = -882;
  const walls = (x, z, radius) => {
    const dx = Math.abs(x - centerX), dz = Math.abs(z - centerZ);
    return Math.abs(dx - 3) < radius + .1 && dz < 6 + radius || Math.abs(dz - 6) < radius + .1 && dx < 3 + radius;
  };
  const fixture = create({ places: npcLandmarks, blocked: walls });
  const initial = npcState(fixture);
  tick(fixture, player(5500, 5500), 25);
  const confined = npcState(fixture);
  expect(confined.walked).toBeGreaterThan(4);
  expect(Math.abs(confined.x - centerX) + .5).toBeLessThan(3);
  expect(Math.abs(confined.z - centerZ) + .5).toBeLessThan(6);
  expect(Math.hypot(confined.x - initial.x, confined.z - initial.z)).toBeGreaterThan(.5);
  expect(walls(confined.x, confined.z, .5)).toBe(false);
});

test('3D NPC behavior: leaving disposes shared NPC materials and removes every civilian target', () => {
  const fixture = create({ places: npcLandmarks }), resources = new Set(), counts = new Map();
  fixture.root.traverse(item => { if (item.isMesh) { resources.add(item.geometry); resources.add(item.material); } });
  for (const resource of resources) {
    counts.set(resource, 0);
    resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  }
  fixture.instance.dispose(); fixture.instance.dispose();
  expect([...counts.values()].every(count => count === 1)).toBe(true);
  expect(fixture.instance.targets()).toEqual([]);
  expect(fixture.instance.snapshot().npcs.every(item => !item.visible)).toBe(true);
  expect(fixture.scene.children).toHaveLength(0);
});
