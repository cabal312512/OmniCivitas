import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { reports } from './report-location.mjs';
import { ENCOUNTER_ROLES } from '../../config/apps/portal/src/q7/9m.mjs';
import { WORLD_SIZE } from '../../pinia/j7.mjs';

const route = '/functions/3d-world/';
const snapshot = page => page.evaluate(() => window.__ocv3D?.snapshot());
const tracking = page => page.evaluate(() => window.__ocv3D.tracking());
const proof = (name, value) => fs.writeFileSync(path.join(reports, `encounters-${name}.json`), JSON.stringify(value, null, 2));
const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const target = (state, id) => state.encounters.actors.find(actor => actor.id === id);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

async function enter(page) {
  await page.goto(route);
  await expect.poll(async () => (await snapshot(page))?.mode, { timeout: 60000 }).toBe('webgl');
  await expect.poll(async () => (await tracking(page)).frames, { timeout: 30000 }).toBeGreaterThan(3);
  await page.locator('#world').focus();
}

// These helpers steer only through native mouse/keyboard input. The live view
// supplies coordinates, but exposes no actor, player, time or camera setters.
async function aim(page, getPoint, horizontal = false, observe) {
  const bounds = await page.locator('#world').boundingBox();
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  for (let attempt = 0; attempt < 7; attempt++) {
    const state = await tracking(page), point = getPoint(state);
    observe?.(state);
    const wantedYaw = Math.atan2(-(point.x - state.position.x), -(point.z - state.position.z));
    const wantedPitch = horizontal ? 0 : Math.atan2(point.y - state.position.y, distance(point, state.position));
    const yaw = angleDelta(wantedYaw, state.yaw), pitch = wantedPitch - state.pitch;
    if (Math.abs(yaw) < .007 && Math.abs(pitch) < .007) return;
    const dx = Math.max(-bounds.width * .38, Math.min(bounds.width * .38, -yaw / .0021));
    const dy = Math.max(-bounds.height * .38, Math.min(bounds.height * .38, -pitch / .0021));
    await page.mouse.move(center.x, center.y);
    await page.mouse.down({ button: 'right' });
    try { await page.mouse.move(center.x + dx, center.y + dy); }
    finally { await page.mouse.up({ button: 'right' }); }
    await expect.poll(async () => (await tracking(page)).frames, { timeout: 10000, intervals: [16, 32, 50] }).toBeGreaterThan(state.frames);
  }
  const state = await tracking(page), point = getPoint(state);
  observe?.(state);
  const yaw = Math.atan2(-(point.x - state.position.x), -(point.z - state.position.z));
  expect(Math.abs(angleDelta(yaw, state.yaw))).toBeLessThan(.025);
}

async function walk(page, point, tolerance = 2.5, timeout = 30000, observe) {
  const started = Date.now();
  await page.locator('#world').focus();
  while (true) {
    const state = await tracking(page), remaining = distance(state.player, point);
    observe?.(state);
    if (remaining < tolerance) return state;
    if (Date.now() - started > timeout) throw new Error(`Native encounter approach blocked: ${JSON.stringify({ point, player: state.player })}`);
    await aim(page, visitor => ({ ...point, y: visitor.position.y }), true, observe);
    await page.keyboard.down('KeyW');
    try { await page.waitForTimeout(Math.max(20, Math.min(140, (remaining - tolerance / 2) / 27 * 1000))); }
    finally { await page.keyboard.up('KeyW'); }
  }
}

function clearSegment(a, b, boxes) {
  for (const box of boxes) {
    let enter = 0, leave = 1;
    for (const axis of ['x', 'z']) {
      const step = b[axis] - a[axis], low = box[`min${axis}`] + 1e-6, high = box[`max${axis}`] - 1e-6;
      if (Math.abs(step) < 1e-12) { if (a[axis] <= low || a[axis] >= high) { enter = 2; break; } }
      else { const first = (low - a[axis]) / step, second = (high - a[axis]) / step;
        enter = Math.max(enter, Math.min(first, second)); leave = Math.min(leave, Math.max(first, second)); }
      if (enter > leave) break;
    }
    if (enter <= leave && enter <= 1 && leave >= 0) return false;
  }
  return true;
}

// Plan an ordinary walking route around the recorded, actually constructed
// buildings. This does not bypass the application's real floor/wall checks.
function walkingRoute(start, goal, city) {
  const boxes = city.buildingRecords.map(building => ({
    minx: building.x - building.width / 2 - 8, maxx: building.x + building.width / 2 + 8,
    minz: building.z - building.depth / 2 - 8, maxz: building.z + building.depth / 2 + 8,
  }));
  if (clearSegment(start, goal, boxes)) return [goal];
  const nodes = [start, goal, ...boxes.flatMap(box => [
    { x: box.minx, z: box.minz }, { x: box.minx, z: box.maxz },
    { x: box.maxx, z: box.minz }, { x: box.maxx, z: box.maxz },
  ])];
  const costs = new Float64Array(nodes.length).fill(Infinity), parent = new Int32Array(nodes.length).fill(-1), closed = new Uint8Array(nodes.length);
  costs[0] = 0;
  for (let iteration = 0; iteration < nodes.length; iteration++) {
    let current = -1, score = Infinity;
    for (let index = 0; index < nodes.length; index++) if (!closed[index] && costs[index] + distance(nodes[index], goal) < score) {
      current = index; score = costs[index] + distance(nodes[index], goal);
    }
    if (current < 0) break;
    if (current === 1) {
      const route = []; for (let index = 1; index > 0; index = parent[index]) route.unshift(nodes[index]);
      return route;
    }
    closed[current] = 1;
    for (let next = 1; next < nodes.length; next++) if (!closed[next] && clearSegment(nodes[current], nodes[next], boxes)) {
      const cost = costs[current] + distance(nodes[current], nodes[next]);
      if (cost < costs[next]) { costs[next] = cost; parent[next] = current; }
    }
  }
  throw new Error('No clear walking route to the recorded encounter home');
}

function bounded(state) {
  const namedRegions = state.regions.filter(region => region.type !== 'grid');
  expect(state.coverage).toMatchObject({ cellSize: 240, slotsPerCell: 4, towerSlotsPerTurn: 24 });
  expect(state.coverage.grid).toBe((WORLD_SIZE / state.coverage.cellSize) ** 2);
  expect(state.regionCount).toBe(state.coverage.grid + namedRegions.length);
  expect(state.totalActors).toBe(state.coverage.grid * state.coverage.slotsPerCell
    + namedRegions.reduce((sum, region) => sum + region.population, 0));
  expect(Object.values(state.species).reduce((sum, count) => sum + count, 0)).toBe(state.totalActors);
  expect(state.resolvedActors).toBeGreaterThan(0);
  expect(state.resolvedActors).toBeLessThanOrEqual(state.totalActors);
  expect(state.activeCount).toBeLessThanOrEqual(64);
  expect(state.activePeak).toBeLessThanOrEqual(64);
  expect(state.projectiles.length).toBeLessThanOrEqual(96);
  expect(state.projectilePeak).toBeLessThanOrEqual(96);
  expect(state.nearInstances).toBe(state.activeCount);
  expect(state.farMeshes).toBe(1);
  expect(state.farInstances).toBeLessThanOrEqual(256);
  expect(state.visibleCount).toBeLessThanOrEqual(256);
  expect(state.renderInstances).toBe(state.nearInstances + state.farInstances);
  expect(state.renderInstances).toBeLessThanOrEqual(256);
  expect(state.visualCapacity).toBe(256);
  expect(state.actors.length).toBeLessThanOrEqual(288);
  expect(state.actors.length).toBeLessThan(state.totalActors);
  expect(new Set(state.actors.map(actor => actor.id)).size).toBe(state.actors.length);
  expect(state.anchors).toHaveLength(namedRegions.filter(region => region.type === 'city').length);
  for (const region of state.regions) {
    expect(region.cap).toBe({ city: 8, meadow: 10, tower: 24, grid: 4 }[region.type]);
    expect(region.population).toBe(region.cap);
    expect(region.active).toBeLessThanOrEqual(region.cap);
    expect(region.active).toBe(state.actors.filter(actor => actor.region === region.id && actor.active).length);
  }
  expect(state.regions.reduce((sum, region) => sum + region.active, 0)).toBe(state.activeCount);
}

test('Native world uses fixed encounter actors, capped active regions and fixed instanced resources', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await enter(page);
  const before = await snapshot(page); bounded(before.encounters);
  expect(before.encounters.renderInstances).toBeGreaterThan(0);
  expect(before.encounters.farInstances).toBeGreaterThan(0);
  expect(before.encounters.resolvedActors).toBeLessThan(before.encounters.totalActors);
  expect(before.encounters.regions.filter(region => region.type === 'tower')).toHaveLength(12);
  expect(Object.keys(before.encounters.species)).toHaveLength(6);
  expect(before.encounters.geometryCount).toBeGreaterThan(0);
  expect(before.encounters.meshCount).toBeLessThan(50);
  const damage = before.checkpoint.damageTaken;
  await page.keyboard.down('ArrowRight');
  try {
    await expect.poll(async () => Math.abs(angleDelta((await tracking(page)).yaw, before.yaw)), {
      timeout: 10000, intervals: [50, 100],
    }).toBeGreaterThan(.8);
  } finally { await page.keyboard.up('ArrowRight'); }
  const after = await snapshot(page); bounded(after.encounters);
  expect(after.encounters.renderInstances).toBeGreaterThan(0);
  expect(after.encounters.farInstances).toBeGreaterThan(0);
  expect(after.encounters).toMatchObject({ totalActors: before.encounters.totalActors,
    geometryCount: before.encounters.geometryCount, materialCount: before.encounters.materialCount,
    meshCount: before.encounters.meshCount });
  expect(after.checkpoint.damageTaken).toBe(damage);
  expect(errors).toEqual([]);
  await page.screenshot({ path: path.join(reports, 'encounters-native-grid.png') });
  proof('native-pools', { before: before.encounters, after: after.encounters, errors,
    nativeYaw: { before: before.yaw, after: after.yaw },
    claim: 'Actual logical coverage and bounded nonempty near/far renderer records, with a native arrow turn and one screenshot. Logical slot counts do not mean all slots are drawn or updated each frame; saturation is separately tested in pure behavioral units.' });
});

test('Native city walking and instance shooting kill an encounter which respawns after real game time on the same fixed slot', async ({ page }) => {
  test.setTimeout(240000);
  const errors = [], milestones = []; page.on('pageerror', error => errors.push(error.message));
  await enter(page);
  const initial = await snapshot(page), city = initial.world.cityRecords.find(record => record.id === 'city');
  const source = initial.portals[0];
  await walk(page, source, 5);
  await page.keyboard.press('KeyE');
  await expect.poll(async () => (await tracking(page)).warps, { timeout: 30000 }).toBe(1);
  const entered = await tracking(page);
  await expect.poll(async () => (await tracking(page)).frames, { timeout: 10000 }).toBeGreaterThan(entered.frames);
  const cityState = await snapshot(page), original = cityState.encounters.anchors.find(actor => actor.id === 'enc-0');
  expect(original).toMatchObject({ kind: 'wisp', region: 'c-city', alive: true, spawnValid: true, generation: 0 });
  expect(Number.isFinite(original.homeX) && Number.isFinite(original.homeY) && Number.isFinite(original.homeZ)).toBe(true);
  const home = { x: original.homeX, z: original.homeZ };
  const arrival = await tracking(page), safe = { x: arrival.player.x, z: arrival.player.z };
  const route = walkingRoute(arrival.player, home, city);
  milestones.push({ stage: 'arrival', time: arrival.time, player: arrival.player, route });
  for (const point of route) await walk(page, point);
  await expect.poll(async () => target(await tracking(page), original.id)?.active, { timeout: 15000 }).toBe(true);
  const approach = await tracking(page);
  expect(distance(approach.player, safe)).toBeGreaterThan(100);
  milestones.push({ stage: 'approach', time: approach.time, player: approach.player, actor: target(approach, original.id) });
  const fire = page.locator('[data-fire]');
  for (let attempt = 0; attempt < 12; attempt++) {
    const before = await tracking(page), actor = target(before, original.id); if (!actor.alive) break;
    await aim(page, state => {
      const current = target(state, original.id);
      return { x: current.x, y: current.y + ENCOUNTER_ROLES[current.kind].height, z: current.z };
    });
    await fire.focus(); await fire.press('Enter');
    await expect.poll(async () => (await tracking(page)).shots, { timeout: 10000 }).toBeGreaterThan(before.shots);
    await page.waitForTimeout(260);
    const after = await tracking(page);
    milestones.push({ stage: 'shot', time: after.time, shots: after.shots, hits: after.hits, actor: target(after, original.id) });
  }
  const killedState = await tracking(page), killed = target(killedState, original.id);
  expect(killed).toMatchObject({ alive: false, active: false, hp: 0, generation: 0 });
  expect(killed.hits).toBe(original.maxHp);
  expect(killedState.encounters.kills).toBeGreaterThanOrEqual(1);
  expect(killed.respawnAt - killedState.time).toBeGreaterThan(19);
  expect(killed.respawnAt - killedState.time).toBeLessThanOrEqual(36);
  const dead = await snapshot(page); bounded(dead.encounters);
  proof('native-kill', { original, approach, killedState, dead: dead.encounters, milestones });
  // Return through real input to the protected portal approach while the game
  // clock advances. No fake time, model update calls or actor setters are used.
  let firstRespawn = null, previousObservation = killedState.time;
  const observeRespawn = state => {
    const actor = target(state, original.id);
    if (!firstRespawn && actor?.generation === 1) firstRespawn = {
      time: state.time, frames: state.frames, previousObservation, player: state.player, actor,
    };
    previousObservation = state.time;
  };
  for (const point of walkingRoute(killedState.player, safe, city)) await walk(page, point, 2.5, 30000, observeRespawn);
  const waiting = await tracking(page);
  observeRespawn(waiting);
  expect(distance(waiting.player, safe)).toBeLessThan(3);
  await expect.poll(async () => { observeRespawn(await tracking(page)); return Boolean(firstRespawn); }, {
    timeout: 65000, intervals: [100, 250, 500],
  }).toBe(true);
  expect(firstRespawn.actor).toMatchObject({ alive: true, hp: original.maxHp, generation: 1, respawnAt: null });
  expect(firstRespawn.time).toBeGreaterThanOrEqual(killed.respawnAt);
  expect(firstRespawn.time).toBeLessThanOrEqual(killed.respawnAt + 1);
  expect(firstRespawn.time - killedState.time).toBeGreaterThan(19);
  expect(firstRespawn.frames).toBeGreaterThan(killedState.frames);
  const restored = await snapshot(page), actor = restored.encounters.actors.find(record => record.id === original.id);
  expect(actor).toMatchObject({ index: original.index, region: original.region, kind: original.kind,
    homeX: original.homeX, homeY: original.homeY, homeZ: original.homeZ,
    alive: true, hp: original.maxHp, generation: 1, respawnAt: null });
  expect(restored.time).toBeGreaterThanOrEqual(killed.respawnAt);
  expect(restored.frames).toBeGreaterThan(killedState.frames);
  bounded(restored.encounters);
  expect(restored.encounters).toMatchObject({ totalActors: initial.encounters.totalActors,
    geometryCount: initial.encounters.geometryCount, materialCount: initial.encounters.materialCount,
    meshCount: initial.encounters.meshCount, visualCapacity: initial.encounters.visualCapacity });
  expect(restored.encounters.respawns).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
  await aim(page, () => ({ x: actor.x, y: actor.y + ENCOUNTER_ROLES[actor.kind].height, z: actor.z }));
  await page.screenshot({ path: path.join(reports, 'encounters-native-respawn.png') });
  proof('native-respawn', { original, killed, firstRespawn, waiting, restored: restored.encounters,
    restoredGameTime: restored.time, milestones, errors,
    claim: 'Native W/right-drag/E/fire interaction, real raycast instanceId, actual elapsed game clock and the same slot generation. No teleport/time/state injection.' });
});
