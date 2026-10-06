import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { reports } from './report-location.mjs';
import { pathPoint, TOWER_SPEC } from '../../config/apps/portal/src/p2/z2.mjs';
import { MEDAL_KEY, MEDAL_SVG, MEDAL_FILENAME } from '../../pinia/p9.mjs';
import { SAVE_KEY } from '../../pcakage/build2/v8.mjs';

const route = '/functions/3d-world/';
const snapshot = page => page.evaluate(() => window.__ocv3D?.snapshot());
// Steering reads the small, read-only view. Full constructed-world records are
// captured at acceptance milestones, rather than serialised on every correction.
const tracking = page => page.evaluate(() => window.__ocv3D.tracking());
const frames = page => page.evaluate(() => window.__ocv3D.tracking().frames);
const delta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const proof = (name, value) => fs.writeFileSync(path.join(reports, `capital-${name}.json`), JSON.stringify(value, null, 2));
const activate = async locator => { await locator.focus(); await locator.press('Enter'); };
async function ready(page) {
  await expect.poll(async () => (await snapshot(page))?.mode, { timeout: 60000 }).toBe('webgl');
  await expect.poll(() => frames(page), { timeout: 30000 }).toBeGreaterThan(3);
  await page.locator('#world').focus();
}
async function enter(page) {
  await page.goto(route); await ready(page);
  // The playlist has separate native playback tests. The long physical ascent
  // uses the real off control to keep music decoding out of steering evidence.
  if (await page.locator('[data-music]').count()) await activate(page.locator('[data-music]'));
  await page.locator('#world').focus();
}
const directionTo = (state, point) => ({
  yaw: Math.atan2(-(point.x - state.position.x), -(point.z - state.position.z)),
  pitch: Math.atan2(point.y - state.position.y, Math.hypot(point.x - state.position.x, point.z - state.position.z)),
});
async function aim(page, getPoint, { horizontalOnly = false, movingForward = false } = {}) {
  const bounds = await page.locator('#world').boundingBox();
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const tolerance = horizontalOnly ? .035 : .012;
  let state, stopped = false;
  try {
    for (let correction = 0; correction < 7; correction++) {
      state = await tracking(page);
      let desired = directionTo(state, getPoint(state));
      let yawChange = delta(desired.yaw, state.yaw), pitchChange = horizontalOnly ? -state.pitch : desired.pitch - state.pitch;
      if (Math.abs(yawChange) < tolerance && Math.abs(pitchChange) < tolerance) return;
      if (movingForward && !stopped && correction >= 3) {
        // On a moving curve the native input queue can outrun a correction.
        // Stop using an actual key release, then turn in place and resume W.
        await page.keyboard.up('KeyW'); stopped = true;
        state = await tracking(page); desired = directionTo(state, getPoint(state));
        yawChange = delta(desired.yaw, state.yaw);
        pitchChange = horizontalOnly ? -state.pitch : desired.pitch - state.pitch;
      }
      const dx = Math.max(-bounds.width * .38, Math.min(bounds.width * .38, -yawChange / .0021));
      const dy = Math.max(-bounds.height * .38, Math.min(bounds.height * .38, -pitchChange / .0021));
      await page.mouse.move(center.x, center.y);
      await page.mouse.down({ button: 'right' });
      try { await page.mouse.move(center.x + dx, center.y + dy); }
      finally { await page.mouse.up({ button: 'right' }); }
      await expect.poll(() => frames(page), { timeout: 15000, intervals: [16, 50, 100] }).toBeGreaterThan(state.frames);
    }
    const final = await tracking(page), desired = directionTo(final, getPoint(final));
    expect(Math.abs(delta(desired.yaw, final.yaw))).toBeLessThan(.08);
  } finally { if (stopped) await page.keyboard.down('KeyW'); }
}
async function walkTo(page, point, tolerance = 1.1, timeout = 60000) {
  const started = Date.now();
  await page.locator('#world').focus();
  await aim(page, state => ({ ...point, y: state.position.y }), { horizontalOnly: true });
  await page.keyboard.down('KeyW');
  try {
    while (true) {
      const state = await tracking(page), distance = Math.hypot(state.player.x - point.x, state.player.z - point.z);
      if (distance < tolerance) return state;
      if (Date.now() - started > timeout) throw new Error(`Native walk stalled: ${JSON.stringify({ player: state.player, point, distance })}`);
      await aim(page, visitor => ({ ...point, y: visitor.position.y }), { horizontalOnly: true, movingForward: true });
      await page.waitForTimeout(distance < 3 ? 35 : 120);
    }
  } finally { await page.keyboard.up('KeyW'); }
}
async function travelToTower(page) {
  const initial = await snapshot(page), index = initial.portals.findIndex(item => item.id === 'tower');
  expect(index).toBeGreaterThan(20);
  await walkTo(page, { x: initial.portals[0].x, z: initial.portals[0].z }, 5);
  for (let step = 1; step <= index; step++) {
    if (step > 1) await page.waitForTimeout(1350);
    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await tracking(page)).warps, { timeout: 30000 }).toBe(step);
  }
  const arrived = await snapshot(page), towerGate = initial.portals[index];
  expect(Math.hypot(arrived.player.x - towerGate.x, arrived.player.z - towerGate.z)).toBeLessThan(8);
  expect(arrived.player.y).toBeGreaterThanOrEqual(TOWER_SPEC.baseY - .01);
  await walkTo(page, pathPoint(0), 1);
  const base = await snapshot(page);
  expect(base.checkpoint.resting).toBe('tower-base');
  await page.keyboard.press('KeyQ');
  await expect.poll(async () => (await tracking(page)).checkpoint.id).toBe('tower-base');
  return { initial, arrived, base };
}
async function climb(page) {
  const progress = [], started = Date.now();
  let nextReport = started, lastProgress = started, previousHeight = TOWER_SPEC.baseY, previousFrame = 0;
  const checkpoints = new Set();
  await page.locator('#world').focus();
  await aim(page, state => ({ ...pathPoint(.0005), y: state.position.y }), { horizontalOnly: true });
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
  try {
    while (true) {
      const state = await tracking(page), t = Math.max(0, Math.min(1, (state.player.y - TOWER_SPEC.baseY) / TOWER_SPEC.height));
      if (t >= .99975) break;
      expect(state.respawns).toBe(0);
      expect(state.player.health).toBeGreaterThan(0);
      expect(state.player.y).toBeGreaterThanOrEqual(previousHeight - 3);
      expect(state.frames).toBeGreaterThanOrEqual(previousFrame);
      if (state.player.y > previousHeight + .03) lastProgress = Date.now();
      if (Date.now() - lastProgress > 25000) throw new Error(`Native ascent stopped: ${JSON.stringify({ player: state.player, t, yaw: state.yaw })}`);
      previousHeight = state.player.y; previousFrame = state.frames;
      if (state.checkpoint.resting?.startsWith('tower-') && !checkpoints.has(state.checkpoint.resting)) {
        await page.keyboard.press('KeyQ'); checkpoints.add(state.checkpoint.resting);
        if (state.player.health < .95) {
          await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
          await expect.poll(async () => (await tracking(page)).player.health,
            { timeout: 12000, intervals: [100, 250] }).toBeGreaterThanOrEqual(.98);
          await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
          lastProgress = Date.now();
        }
      }
      if (Date.now() >= nextReport) {
        const point = { elapsedMs: Date.now() - started, time: state.time, frames: state.frames,
          x: state.player.x, y: state.player.y, z: state.player.z, yaw: state.yaw,
          hp: state.player.health, winding: t * TOWER_SPEC.turns, checkpoint: state.checkpoint.id };
        progress.push(point); proof('native-ascent-progress', progress);
        console.log(`Native tower ascent: ${(t * 100).toFixed(1)}%, foot ${(state.player.y).toFixed(1)}m, ${Math.round((Date.now() - started) / 1000)}s`);
        nextReport = Date.now() + 30000;
      }
      await aim(page, visitor => {
        const currentT = Math.max(0, Math.min(1, (visitor.player.y - TOWER_SPEC.baseY) / TOWER_SPEC.height));
        const radius = pathPoint(currentT).radius;
        const ahead = 32 / (radius * Math.PI * 2 * TOWER_SPEC.turns);
        return { ...pathPoint(Math.min(1, currentT + ahead)), y: visitor.position.y };
      }, { horizontalOnly: true, movingForward: true });
      await page.waitForTimeout(160);
      if (Date.now() - started > 16 * 60 * 1000) throw new Error('Native uninterrupted climb exceeded sixteen minutes');
    }
  } finally { await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft'); }
  await walkTo(page, pathPoint(1), .7);
  await walkTo(page, pathPoint(1, -20), .8);
  const top = await snapshot(page);
  expect(top.player.y).toBe(2455);
  expect(top.checkpoint.resting).toBe('tower-crown');
  expect(top.respawns).toBe(0);
  expect(top.tower.recoveries).toBe(0);
  progress.push({ elapsedMs: Date.now() - started, time: top.time, frames: top.frames, ...top.player,
    winding: 12, checkpoint: top.checkpoint.id });
  proof('native-ascent-progress', progress);
  return { progress, checkpoints: [...checkpoints], top };
}
async function checkSummitGuard(page) {
  const before = await tracking(page), crown = pathPoint(1, -20);
  await page.locator('#world').focus(); await page.keyboard.press('Space');
  await expect.poll(async () => (await tracking(page)).player.y,
    { timeout: 5000, intervals: [30, 50] }).toBeGreaterThan(TOWER_SPEC.baseY + TOWER_SPEC.height + .3);
  await expect.poll(async () => (await tracking(page)).player.y,
    { timeout: 5000, intervals: [50, 100] }).toBe(TOWER_SPEC.baseY + TOWER_SPEC.height);
  const angle = .12, edge = { x: TOWER_SPEC.x + Math.cos(angle) * 142.5,
    z: TOWER_SPEC.z + Math.sin(angle) * 142.5 };
  await walkTo(page, edge, .7);
  await aim(page, state => ({ x: TOWER_SPEC.x + Math.cos(angle) * 200,
    z: TOWER_SPEC.z + Math.sin(angle) * 200, y: state.position.y }), { horizontalOnly: true });
  await page.keyboard.down('KeyW'); const samples = [];
  try {
    await page.waitForTimeout(500); await page.keyboard.press('Space');
    for (let index = 0; index < 12; index++) {
      await page.waitForTimeout(100); const state = await tracking(page);
      const radius = Math.hypot(state.player.x - TOWER_SPEC.x, state.player.z - TOWER_SPEC.z);
      expect(radius).toBeLessThanOrEqual(143.81);
      expect(state.player.y).toBeGreaterThanOrEqual(TOWER_SPEC.baseY + TOWER_SPEC.height);
      expect(state.respawns).toBe(0); samples.push({ time: state.time, radius, player: state.player });
    }
  } finally { await page.keyboard.up('KeyW'); }
  await page.screenshot({ path: path.join(reports, 'capital-summit-guard.png') });
  await walkTo(page, crown, .8);
  const after = await snapshot(page);
  expect(after.tower.recoveries).toBe(0); expect(after.checkpoint.resting).toBe('tower-crown');
  proof('native-summit-guard', { before, samples, after,
    claim: 'After the actual complete ascent, native jumping lands on the platform; sustained W plus a real jump against its guard stays inside the edge. No rescue, position, floor or camera state writes are used.' });
}
async function download(page, locator, basename) {
  const event = page.waitForEvent('download'); await activate(locator);
  const result = await event;
  expect(result.suggestedFilename()).toBe(MEDAL_FILENAME);
  const target = path.join(reports, basename); await result.saveAs(target);
  const bytes = fs.readFileSync(target);
  expect(bytes.equals(Buffer.from(MEDAL_SVG, 'utf8'))).toBe(true);
  expect(await result.failure()).toBe(null);
  return { filename: result.suggestedFilename(), bytes: bytes.length, target };
}

test('Nine expanded pale cities, intercity roads and scattered houses are actually constructed in the active scene', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await enter(page);
  expect((await page.locator('body').innerText()).trim()).toBe('');
  const state = await snapshot(page), world = state.world;
  expect(world.cityRecords).toHaveLength(9);
  expect(world.buildings).toBeGreaterThan(700);
  expect(world.scatteredHouseCount).toBe(48);
  expect(world.scatteredHouses).toHaveLength(48);
  expect(world.roads.length).toBeGreaterThanOrEqual(9);
  expect(world.roadCount).toBe(world.roads.length);
  expect(world.roadLength).toBeGreaterThan(25000);
  for (const city of world.cityRecords) {
    expect(city.surfaceColor).toBe('#e8edef');
    expect(city.minimumGap).toBeGreaterThanOrEqual(20);
    expect(city.buildings).toBeGreaterThan(20);
  }
  for (const road of world.roads) {
    expect(road.surfaceColor).toBe('#eff6fa');
    expect(road.triangles).toBeGreaterThan(0); expect(road.maxGrade).toBeLessThanOrEqual(.111);
  }
  const capital = world.cityRecords.find(item => item.id === 'capital');
  expect(capital.heightRange.max).toBeGreaterThan(1000);
  expect(capital.footprint.width).toBe(Math.max(...world.cityRecords.map(city => city.footprint.width)));
  expect(capital.clearingRadius).toBeGreaterThan(500);
  expect(state.tower.highestWalkableY).toBe(2455);
  expect(state.boss.highestGeometryY).toBeGreaterThan(state.tower.highestWalkableY);
  expect(state.checkpoint.stations).toHaveLength(12);
  expect(state.entities.npcCount).toBeGreaterThanOrEqual(72);
  expect(state.entities.npcs.every(npc => npc.attacks === 0 && npc.damageEvents === 0 && !npc.hostile)).toBe(true);
  expect(errors).toEqual([]);
  proof('constructed-cities-roads', { world, tower: state.tower, boss: state.boss, errors,
    claim: 'Read-only records from the actual constructed Three.js graph, complemented by a separate native ascent and screenshots. Records alone are not proof of walking every road.' });
});

test('Native complete twelve-winding ascent, summit checkpoint, three-phase boss victory and identical medal downloads on the homepage', async ({ page }) => {
  test.setTimeout(20 * 60 * 1000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /Shader Error|VALIDATE_STATUS|initialization failed/.test(message.text())) errors.push(message.text()); });
  await enter(page);
  expect(await page.evaluate(key => localStorage.getItem(key), MEDAL_KEY)).toBeNull();
  const travel = await travelToTower(page);
  await aim(page, state => ({ x: TOWER_SPEC.x, y: TOWER_SPEC.baseY + 1100, z: TOWER_SPEC.z }));
  await page.screenshot({ path: path.join(reports, 'capital-tower-base.png') });
  const ascent = await climb(page);
  await checkSummitGuard(page);
  await page.keyboard.press('KeyQ');
  await expect.poll(async () => (await tracking(page)).checkpoint.id).toBe('tower-crown');
  const saved = await snapshot(page), savedBytes = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY);
  expect(JSON.parse(savedBytes).checkpoint).toBe('tower-crown');
  expect(saved.checkpoint.store.persistent).toBe(true);
  await walkTo(page, pathPoint(1, -34), 1);
  expect((await tracking(page)).checkpoint.resting).not.toBe('tower-crown');
  await page.keyboard.press('KeyR');
  await expect.poll(async () => (await tracking(page)).respawns).toBe(1);
  const recovered = await snapshot(page);
  expect(recovered.player.y).toBe(2455); expect(recovered.checkpoint.resting).toBe('tower-crown');
  await page.reload(); await ready(page);
  const restored = await snapshot(page);
  expect(restored.checkpoint).toMatchObject({ id: 'tower-crown', restores: 1 });
  expect(restored.player.y).toBe(2455);
  expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(savedBytes);
  await aim(page, state => state.boss.weakPoints[0]);
  await page.screenshot({ path: path.join(reports, 'capital-summit-boss.png') });
  const phases = new Set([restored.boss.phase]), attacks = [], shooting = page.locator('[data-fire]');
  for (let index = 0; index < 75; index++) {
    const before = await tracking(page); if (before.boss.defeated) break;
    await aim(page, state => state.boss.weakPoints[0]);
    await activate(shooting);
    await expect.poll(async () => (await tracking(page)).shots, { timeout: 15000 }).toBeGreaterThan(before.shots);
    await page.waitForTimeout(320);
    const after = await tracking(page); phases.add(after.boss.phase);
    attacks.push({ shot: after.shots, bossHp: after.boss.hp, phase: after.boss.phase,
      weakHits: after.boss.weakHits, attacks: after.boss.attacks, damageEvents: after.boss.damageEvents });
  }
  await expect(page.locator('[data-aero-victory]')).toBeVisible();
  await expect(page.getByRole('heading', { name: '通关', exact: true })).toBeVisible();
  const won = await snapshot(page);
  expect(won.boss).toMatchObject({ defeated: true, hp: 0, completions: 1 });
  expect([...phases].sort()).toEqual([1, 2, 3]);
  expect(won.boss.shotsTaken).toBeGreaterThanOrEqual(Math.ceil(won.boss.maxHp/3));
  expect(won.boss.shotsTaken).toBeLessThanOrEqual(won.boss.maxHp);
  expect(won.medal).toMatchObject({ earned: true, writes: 1, persistent: true });
  expect(won.victoryOpen).toBe(true);
  const award = JSON.parse(await page.evaluate(key => localStorage.getItem(key), MEDAL_KEY));
  expect(Object.keys(award).sort()).toEqual(['earnedAt', 'trophyId', 'version']);
  await page.screenshot({ path: path.join(reports, 'capital-victory-medal.png') });
  const gameDownload = await download(page, page.locator('[data-victory-download]'), 'native-game-medal.svg');
  await activate(page.locator('[data-victory-close]'));
  await expect(page.locator('[data-aero-victory]')).toBeHidden();
  await expect.poll(() => frames(page)).toBeGreaterThan(won.frames);
  expect((await tracking(page)).boss.completions).toBe(1);
  await page.getByRole('link', { name: '退出游戏', exact: true }).click();
  await expect(page).toHaveURL(/\/functions\/games\/$/);
  await page.goto('/');
  await expect(page.locator('[data-aero-medal-dialog]')).not.toBeVisible();
  await activate(page.getByRole('link', { name: '进入主页', exact: true }));
  await expect.poll(() => page.locator('body').getAttribute('data-cover'), { timeout: 30000 }).toBe('false');
  await activate(page.locator('[data-aero-medal-open]'));
  await expect(page.locator('[data-aero-medal-dialog]')).toBeVisible();
  await expect(page.locator('[data-aero-medal-empty]')).toBeHidden();
  await expect(page.locator('[data-aero-medal-art]')).toBeVisible();
  const homeDownload = await download(page, page.locator('[data-aero-medal-download]'), 'native-home-medal.svg');
  expect(fs.readFileSync(homeDownload.target).equals(fs.readFileSync(gameDownload.target))).toBe(true);
  await page.screenshot({ path: path.join(reports, 'capital-home-medal.png') });
  await activate(page.locator('[data-aero-medal-close]'));
  await expect(page.locator('[data-aero-medal-dialog]')).not.toBeVisible();
  expect(errors).toEqual([]);
  proof('native-completion', { travel, ascent, saved, recovered, restored, won, award, phases: [...phases], attacks,
    gameDownload, homeDownload, errors,
    claim: 'The entire ascent begins at the real ground entrance and uses only native W/Shift, right mouse dragging, Q/R, native portals and actual shooting. Summit persistence was produced by the ascent, never a manufactured save. Both actual browser downloads are byte-identical to the standalone original SVG; no camera, position, hit, reward or combat state setters were used.' });
});
