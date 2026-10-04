import * as THREE from 'three';
import { CITIES, cityHalf } from './city-data.mjs';
import { LANDMARKS, SPAWN, WORLD_SIZE, heightAt } from './terrain.mjs';
import { TOWER_SPEC, pathPoint } from './tower.mjs';

export const ENCOUNTER_LIMITS = Object.freeze({ active: 64, visible: 256, projectiles: 96,
  city: 8, meadow: 10, tower: 24, grid: 4, cellSize: 240, activationRadius: 350,
  visibilityRadius: 1350, nearDetailRadius: 230,
  respawnMin: 20, respawnMax: 36, stationSafety: 24 });
export const ENCOUNTER_ROLES = Object.freeze(Object.fromEntries(Object.entries({
  wisp: { hp: 3, radius: .65, height: 2.5, speed: 4.2, range: 100, cooldown: 2.8, damage: .035, warning: 1.1, count: 1, shotSpeed: 24, color: 0xa8f6e8 },
  crawler: { hp: 4, radius: .85, height: 1.15, speed: 7.5, range: 3.6, cooldown: 2.3, damage: .055, warning: .95, count: 0, shotSpeed: 0, color: 0xe5e6ff },
  lens: { hp: 5, radius: 1.1, height: 3.1, speed: 2.5, range: 112, cooldown: 3.4, damage: .04, warning: 1.3, count: 2, shotSpeed: 22, color: 0xa1e6ff },
  kite: { hp: 3, radius: 1.05, height: 3.7, speed: 6.3, range: 94, cooldown: 2.6, damage: .04, warning: 1.05, count: 1, shotSpeed: 28, color: 0xd5f4bc },
  pillar: { hp: 6, radius: 1.2, height: 2.15, speed: 0, range: 118, cooldown: 3.2, damage: .05, warning: 1.25, count: 1, shotSpeed: 25, color: 0xf2eed1 },
  coil: { hp: 5, radius: .9, height: 1.8, speed: 4.6, range: 86, cooldown: 3.8, damage: .035, warning: 1.2, count: 3, shotSpeed: 21, color: 0xbdd9ff },
}).map(([kind, role]) => [kind, Object.freeze(role)])));
const kinds = Object.keys(ENCOUNTER_ROLES), tau = Math.PI * 2;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
function random(index, salt = 0) {
  let value = Math.imul(index + 13, 374761393) ^ Math.imul(salt + 7, 668265263);
  value = Math.imul(value ^ value >>> 13, 1274126177);
  return ((value ^ value >>> 16) >>> 0) / 4294967296;
}
const finitePoint = point => Number.isFinite(point?.x) && Number.isFinite(point?.y) && Number.isFinite(point?.z);

function safetyPoints(world, ground) {
  const stations = (world?.restStations || []).map(station => ({ x: station.position.x,
    y: station.position.y, z: station.position.z, radius: Math.max(ENCOUNTER_LIMITS.stationSafety, (station.radius || 6) + 18) }));
  // Protect portal approaches as well as the stations themselves. The exact
  // surveyed gate positions are available on the ordinary rest stations.
  for (const station of world?.restStations || []) if (station.gatePosition) stations.push({
    x: station.gatePosition.x, y: station.gatePosition.y, z: station.gatePosition.z, radius: 32 });
  for (const landmark of world?.landmarks || []) {
    if (landmark.tower) continue;
    const x = landmark.position.x + 15, z = landmark.position.z + 32;
    stations.push({ x, y: ground(x, z, landmark.position.y), z, radius: 38 });
  }
  for (const t of [0, 1 / 3, 2 / 3, 1]) {
    const point = pathPoint(t, t === 1 ? -20 : 0);
    if (!stations.some(station => Math.hypot(station.x - point.x, station.z - point.z) < 1
      && Math.abs(station.y - point.y) < 1)) stations.push({ ...point, radius: 24 });
  }
  return stations;
}
function protectedPoint(x, y, z, stations) {
  if (Math.abs(x) < 110 && z > -580 && z < 310 && y < 80) return true;
  if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 80 && y < 80) return true;
  return stations.some(station => Math.abs(y - station.y) < 8
    && Math.hypot(x - station.x, z - station.z) < station.radius);
}

export function createEncounterPlan({ world, ground = () => 0, isBlocked = () => false } = {}) {
  const stations = safetyPoints(world, ground), regions = [];
  function land(x, z, referenceY, radius) {
    const clear = (cx, cz) => {
      if (Math.abs(cx) > WORLD_SIZE / 2 - 12 || Math.abs(cz) > WORLD_SIZE / 2 - 12) return null;
      const y = ground(cx, cz, referenceY);
      if (!Number.isFinite(y) || isBlocked(cx, cz, radius, y) || protectedPoint(cx, y, cz, stations)) return null;
      return { x: cx, y, z: cz, valid: true };
    };
    let point = clear(x, z); if (point) return point;
    for (let radiusStep = 8; radiusStep <= 160; radiusStep += 8) for (let direction = 0; direction < 12; direction++) {
      point = clear(x + Math.cos(direction * tau / 12) * radiusStep, z + Math.sin(direction * tau / 12) * radiusStep);
      if (point) return point;
    }
    return { x, y: referenceY, z, valid: false };
  }
  for (const [index, city] of CITIES.entries()) {
    const region = { id: `c-${city.id}`, type: 'city', cap: ENCOUNTER_LIMITS.city, roam: 100,
      x: city.x, z: city.z, y: city.ground, points: [] };
    for (let slot = 0; slot < region.cap; slot++) {
      const angle = (slot + .35) * tau / region.cap;
      const distance = Math.max(city.clearing ? city.clearing + 90 : 150, cityHalf(city) * .43);
      const kind = kinds[(slot + index) % kinds.length];
      region.points.push({ ...land(city.x + Math.cos(angle) * distance, city.z + Math.sin(angle) * distance,
        city.ground, ENCOUNTER_ROLES[kind].radius), kind });
    }
    regions.push(region);
  }
  const meadowIds = ['avenue', 'hills', 'village', 'east-village', 'sphere', 'ring', 'stairs', 'monolith'];
  for (const [index, id] of meadowIds.entries()) {
    const location = LANDMARKS.find(point => point.id === id), region = { id: `m-${id}`, type: 'meadow',
      cap: ENCOUNTER_LIMITS.meadow, roam: 110, x: location.x, z: location.z,
      y: ground(location.x, location.z, 0), points: [] };
    for (let slot = 0; slot < region.cap; slot++) {
      const angle = (slot + .2) * tau / region.cap, distance = 155 + random(slot, index) * 140;
      const kind = kinds[(slot + index * 2) % kinds.length];
      region.points.push({ ...land(location.x + Math.cos(angle) * distance, location.z + Math.sin(angle) * distance,
        region.y, ENCOUNTER_ROLES[kind].radius), kind });
    }
    regions.push(region);
  }
  for (let turn = 0; turn < TOWER_SPEC.turns; turn++) {
    const midpoint = pathPoint((turn + .5) / TOWER_SPEC.turns), region = {
      id: `t-${turn + 1}`, type: 'tower', cap: ENCOUNTER_LIMITS.tower, roam: 66,
      x: midpoint.x, z: midpoint.z, y: midpoint.y, turn, points: [] };
    for (let slot = 0; slot < region.cap; slot++) {
      let t = (turn + (slot + .5) / region.cap) / TOWER_SPEC.turns;
      const offset = slot % 2 ? 4.8 : -4.8;
      let point = pathPoint(t, offset);
      for (let attempt = 0; attempt < 6 && protectedPoint(point.x, point.y, point.z, stations); attempt++) {
        t = clamp(t + (slot < region.cap / 2 ? .0006 : -.0006), turn / TOWER_SPEC.turns + .0001, (turn + 1) / TOWER_SPEC.turns - .0001);
        point = pathPoint(t, offset);
      }
      const kind = kinds[(turn + slot) % kinds.length];
      region.points.push({ ...point, kind, offset,
        valid: !isBlocked(point.x, point.z, ENCOUNTER_ROLES[kind].radius, point.y)
          && !protectedPoint(point.x, point.y, point.z, stations) });
    }
    regions.push(region);
  }
  const size = ENCOUNTER_LIMITS.cellSize, half = WORLD_SIZE / 2;
  for (let row = 0; row < WORLD_SIZE / size; row++) for (let column = 0; column < WORLD_SIZE / size; column++) {
    const x = -half + (column + .5) * size, z = -half + (row + .5) * size;
    const region = { id: `g-${column}-${row}`, type: 'grid', cap: ENCOUNTER_LIMITS.grid, roam: 75, x, z, y: heightAt(x, z), points: [] };
    for (let slot = 0; slot < region.cap; slot++) {
      const px = x + (slot % 2 ? 58 : -58), pz = z + (slot < 2 ? -58 : 58);
      region.points.push({ x: px, y: heightAt(px, pz), z: pz, kind: kinds[(column + row * 3 + slot) % kinds.length], lazy: true, valid: true });
    }
    regions.push(region);
  }
  return { regions, stations };
}

export function createEncounterState({ regions, stations = [], ground = () => 0, isBlocked = () => false } = {}) {
  const actors = [], projectiles = Array.from({ length: ENCOUNTER_LIMITS.projectiles }, () => ({ active: false }));
  const active = [], previousActive = [], visible = [], nearbyDead = new Set(), drops = new Set(), candidates = [], regionCounts = new Uint16Array(regions.length);
  const cells = new Map(), species = Object.fromEntries(kinds.map(kind => [kind, 0])), deadlines = [];
  const anchors = [], fixedRegionIndices = [], gridRegions = regions.filter(region => region.type === 'grid').length;
  const cellKey = (x, z) => `${Math.floor(x / ENCOUNTER_LIMITS.cellSize)},${Math.floor(z / ENCOUNTER_LIMITS.cellSize)}`;
  let lastQuery = -Infinity, queryX = 0, queryY = 0, queryZ = 0, queryDirty = true, resolved = 0;
  const stats = { kills: 0, respawns: 0, acceptedHits: 0, attacks: 0, meleeAttacks: 0,
    damageEvents: 0, damageTotal: 0, projectileImpacts: 0, blockedShots: 0, droppedShots: 0,
    blockedMelee: 0, activePeak: 0, projectilePeak: 0, collected: 0,
    queries: 0, candidatesChecked: 0, lastCandidates: 0, candidatePeak: 0, cellsVisited: 0 };
  for (const [regionIndex, region] of regions.entries()) for (const point of region.points.slice(0, region.cap)) {
    const role = ENCOUNTER_ROLES[point.kind], index = actors.length;
    actors.push({ index, id: `enc-${index}`, region: regionIndex, kind: point.kind, role,
      homeX: point.x, homeY: point.y, homeZ: point.z, x: point.x, y: point.y, z: point.z,
      spawnValid: point.valid !== false, resolved: !point.lazy, hp: role.hp, alive: point.valid !== false, active: false, visible: false,
      generation: 0, respawnAt: null, nextAttack: 0, lastHit: -Infinity, hits: 0,
      attacks: 0, walked: 0, damageEvents: 0, dropUntil: 0, dropCollected: false,
      pending: { active: false, at: 0, x: 0, y: 0, z: 0 } });
    species[point.kind]++; resolved += Number(!point.lazy);
    if (region.type === 'city' && point === region.points[0]) anchors.push(actors[index]);
    if (point === region.points[0] && region.type !== 'grid') fixedRegionIndices.push(regionIndex);
    const key = cellKey(point.x, point.z); if (!cells.has(key)) cells.set(key, []); cells.get(key).push(actors[index]);
  }
  function schedule(actor) {
    deadlines.push(actor); let index = deadlines.length - 1;
    while (index > 0) { const parent = (index - 1) >> 1; if (deadlines[parent].respawnAt <= actor.respawnAt) break;
      deadlines[index] = deadlines[parent]; index = parent; } deadlines[index] = actor;
  }
  function removeDeadline() {
    const result = deadlines[0], tail = deadlines.pop(); if (!deadlines.length) return result;
    let index = 0;
    while (index * 2 + 1 < deadlines.length) { let child = index * 2 + 1;
      if (child + 1 < deadlines.length && deadlines[child + 1].respawnAt < deadlines[child].respawnAt) child++;
      if (tail.respawnAt <= deadlines[child].respawnAt) break; deadlines[index] = deadlines[child]; index = child; }
    deadlines[index] = tail; return result;
  }
  function resolve(actor) {
    if (actor.resolved) return actor.spawnValid;
    actor.resolved = true; resolved++;
    const originalX = actor.homeX, originalZ = actor.homeZ;
    for (let step = 0; step < 25; step++) {
      const angle = step * 2.399963, radius = step ? 12 * Math.sqrt(step) : 0;
      const x = originalX + Math.cos(angle) * radius, z = originalZ + Math.sin(angle) * radius, y = ground(x, z, actor.homeY);
      if (!Number.isFinite(y) || Math.abs(x) > WORLD_SIZE / 2 - 8 || Math.abs(z) > WORLD_SIZE / 2 - 8
        || isBlocked(x, z, actor.role.radius, y) || protectedPoint(x, y, z, stations)) continue;
      actor.x = actor.homeX = x; actor.y = actor.homeY = y; actor.z = actor.homeZ = z; return true;
    }
    actor.alive = actor.spawnValid = false; return false;
  }
  function query(player, time) {
    previousActive.length = 0;
    for (const actor of active) { previousActive.push(actor); actor.active = false; }
    for (const actor of visible) actor.visible = false;
    active.length = visible.length = candidates.length = 0; nearbyDead.clear(); regionCounts.fill(0);
    const radius = ENCOUNTER_LIMITS.visibilityRadius, padding = radius + 160, size = ENCOUNTER_LIMITS.cellSize;
    let checked = 0, visited = 0;
    for (let cx = Math.floor((player.x - padding) / size); cx <= Math.floor((player.x + padding) / size); cx++) {
      for (let cz = Math.floor((player.z - padding) / size); cz <= Math.floor((player.z + padding) / size); cz++) {
        visited++; for (const actor of cells.get(`${cx},${cz}`) || []) {
          checked++; const dx = actor.x - player.x, dz = actor.z - player.z;
          actor.nearDistance = dx * dx + dz * dz;
          const tower = regions[actor.region].type === 'tower';
          if (actor.nearDistance > radius * radius || Math.abs(actor.y - player.y) > (tower ? 70 : 160)) continue;
          if (!actor.alive) { nearbyDead.add(actor); continue; }
          if (!resolve(actor)) continue;
          const px = actor.x - player.x, pz = actor.z - player.z; actor.nearDistance = px * px + pz * pz;
          if (actor.nearDistance <= radius * radius) candidates.push(actor);
        }
      }
    }
    candidates.sort((a, b) => a.nearDistance - b.nearDistance);
    for (const actor of candidates) {
      if (visible.length < ENCOUNTER_LIMITS.visible) { actor.visible = true; visible.push(actor); }
      const heightRange = regions[actor.region].type === 'tower' ? 35 : 28;
      if (active.length < ENCOUNTER_LIMITS.active && actor.nearDistance <= ENCOUNTER_LIMITS.activationRadius ** 2
        && Math.abs(actor.y - player.y) <= heightRange && regionCounts[actor.region] < regions[actor.region].cap) {
        actor.active = true; active.push(actor); regionCounts[actor.region]++;
      }
    }
    for (const actor of previousActive) if (!actor.active) { actor.pending.active = false; actor.nextAttack = Math.max(actor.nextAttack, time + 1); }
    stats.queries++; stats.candidatesChecked += checked; stats.lastCandidates = checked;
    stats.candidatePeak = Math.max(stats.candidatePeak, checked); stats.cellsVisited = visited;
    lastQuery = time; queryX = player.x; queryY = player.y; queryZ = player.z; queryDirty = false;
  }
  const rayStart = { x: 0, y: 0, z: 0 }, rayDirection = { x: 0, y: 0, z: 0 };
  const hurt = (actor, amount, onDamage) => { actor.damageEvents++; stats.damageEvents++;
    stats.damageTotal += amount; onDamage(amount); };
  function move(actor, dx, dz) {
    const x = actor.x + dx, z = actor.z + dz, y = ground(x, z, actor.y);
    if (!Number.isFinite(y) || y - actor.y > 1.8 || actor.y - y > 2.5
      || isBlocked(x, z, actor.role.radius, actor.y) || protectedPoint(x, y, z, stations)) return false;
    actor.walked += Math.hypot(dx, dz); actor.x = x; actor.z = z; actor.y = y; return true;
  }
  function fire(actor) {
    const role = actor.role, pending = actor.pending;
    const dx = pending.x - actor.x, dy = pending.y - (actor.y + role.height), dz = pending.z - actor.z;
    const horizontal = Math.max(.1, Math.hypot(dx, dz)), angle = Math.atan2(dz, dx);
    const length = Math.hypot(horizontal, dy);
    for (let number = 0; number < role.count; number++) {
      const shot = projectiles.find(item => !item.active);
      if (!shot) { stats.droppedShots++; continue; }
      const spread = (number - (role.count - 1) / 2) * .09;
      Object.assign(shot, { active: true, owner: actor.index, generation: actor.generation,
        x: actor.x, y: actor.y + role.height, z: actor.z, life: 6, damage: role.damage,
        vx: Math.cos(angle + spread) * horizontal / length * role.shotSpeed,
        vy: dy / length * role.shotSpeed, vz: Math.sin(angle + spread) * horizontal / length * role.shotSpeed });
    }
  }
  function update(player, time, dt, onDamage = () => {}, _reduced = false,
    obstructRay = (_start, _direction, distance) => distance) {
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, .1);
    if (!finitePoint(player) || !Number.isFinite(time)) return;
    const playerSafe = protectedPoint(player.x, player.y, player.z, stations) || player.health <= 0;
    while (deadlines.length && deadlines[0].respawnAt <= time) {
      const actor = removeDeadline(); actor.alive = true; actor.hp = actor.role.hp;
      actor.x = actor.homeX; actor.y = actor.homeY; actor.z = actor.homeZ;
      actor.generation++; actor.respawnAt = null; actor.nextAttack = time + 1.1;
      actor.pending.active = false; actor.lastHit = -Infinity; actor.dropUntil = 0;
      drops.delete(actor); stats.respawns++; queryDirty = true;
    }
    if (queryDirty || time - lastQuery >= .16 || Math.hypot(player.x - queryX, player.z - queryZ) > 20
      || Math.abs(player.y - queryY) > 8) query(player, time);
    stats.activePeak = Math.max(stats.activePeak, active.length);
    for (const actor of active) {
      if (!actor.alive || !actor.active) continue;
      const role = actor.role, region = regions[actor.region];
      const dx = player.x - actor.x, dz = player.z - actor.z, distance = Math.hypot(dx, dz);
      const homeDistance = Math.hypot(actor.x - actor.homeX, actor.z - actor.homeZ);
      if (role.speed && !playerSafe && !actor.pending.active) {
        const returnHome = homeDistance > region.roam;
        const mx = returnHome ? actor.homeX - actor.x : dx, mz = returnHome ? actor.homeZ - actor.z : dz;
        const range = Math.hypot(mx, mz), stop = returnHome ? 1 : role.count ? 36 : 2.5;
        if (range > stop && (returnHome || distance < 150)) {
          const step = Math.min(role.speed * dt, range - stop);
          const moveX = mx / range * step, moveZ = mz / range * step;
          if (!move(actor, moveX, moveZ)) { move(actor, moveX, 0); move(actor, 0, moveZ); }
        }
      }
      if (playerSafe) { actor.pending.active = false; actor.nextAttack = Math.max(actor.nextAttack, time + 1); continue; }
      if (actor.pending.active && time >= actor.pending.at) {
        actor.pending.active = false; actor.nextAttack = time + role.cooldown;
        actor.attacks++; stats.attacks++;
        if (role.count) fire(actor);
        else if (Math.hypot(player.x - actor.x, player.z - actor.z) <= role.range + 1
          && Math.abs(player.y - actor.y) <= 2.5) {
          const dx = player.x - actor.x, dy = player.y + 1.25 - (actor.y + role.height), dz = player.z - actor.z;
          const length = Math.hypot(dx, dy, dz);
          rayStart.x = actor.x; rayStart.y = actor.y + role.height; rayStart.z = actor.z;
          rayDirection.x = length ? dx / length : 0; rayDirection.y = length ? dy / length : 0; rayDirection.z = length ? dz / length : 0;
          const obstruction = length > .05 ? obstructRay(rayStart, rayDirection, length) : length;
          if (obstruction === true || typeof obstruction === 'number' && obstruction < length - .01) stats.blockedMelee++;
          else { stats.meleeAttacks++; hurt(actor, role.damage, onDamage); }
        }
      } else if (!actor.pending.active && time >= actor.nextAttack && distance <= role.range
        && Math.abs(player.y - actor.y) <= (role.count ? 26 : 2.5)) {
        Object.assign(actor.pending, { active: true, at: time + role.warning,
          x: player.x, y: player.y + 1.25, z: player.z });
      }
    }
    let projectileCount = 0;
    for (const shot of projectiles) {
      if (!shot.active) continue;
      const owner = actors[shot.owner];
      if (!owner.alive || !owner.active || owner.generation !== shot.generation || playerSafe) { shot.active = false; continue; }
      shot.life -= dt;
      const dx = shot.vx * dt, dy = shot.vy * dt, dz = shot.vz * dt, length = Math.hypot(dx, dy, dz);
      if (shot.life <= 0) { shot.active = false; continue; }
      if (!length) { projectileCount++; continue; }
      rayStart.x = shot.x; rayStart.y = shot.y; rayStart.z = shot.z;
      rayDirection.x = dx / length; rayDirection.y = dy / length; rayDirection.z = dz / length;
      const obstruction = obstructRay(rayStart, rayDirection, length);
      if (obstruction === true || typeof obstruction === 'number' && obstruction < length - .01) {
        shot.active = false; stats.blockedShots++; continue;
      }
      const px = player.x - shot.x, py = player.y + 1.25 - shot.y, pz = player.z - shot.z;
      const fraction = clamp((px * dx + py * dy + pz * dz) / (length * length), 0, 1);
      if ((px - dx * fraction) ** 2 + (py - dy * fraction) ** 2 + (pz - dz * fraction) ** 2 < .9 ** 2) {
        shot.active = false; stats.projectileImpacts++; hurt(owner, shot.damage, onDamage); continue;
      }
      shot.x += dx; shot.y += dy; shot.z += dz;
      const floor = ground(shot.x, shot.z, shot.y);
      if (Number.isFinite(floor) && shot.y < floor + .08) { shot.active = false; continue; }
      projectileCount++;
    }
    stats.projectilePeak = Math.max(stats.projectilePeak, projectileCount);
  }
  function hit(index, time) {
    const actor = actors[index];
    if (!actor?.alive || !actor.visible || !Number.isFinite(time) || time - actor.lastHit < .16) return false;
    actor.lastHit = time; actor.hits++; actor.hp--; stats.acceptedHits++;
    if (actor.hp <= 0) {
      if (actor.active) regionCounts[actor.region]--;
      actor.alive = actor.active = actor.visible = false; actor.pending.active = false;
      actor.respawnAt = time + ENCOUNTER_LIMITS.respawnMin + random(actor.index, actor.generation + 90)
        * (ENCOUNTER_LIMITS.respawnMax - ENCOUNTER_LIMITS.respawnMin);
      actor.dropUntil = time + 12; actor.dropCollected = false; stats.kills++;
      schedule(actor); drops.add(actor); nearbyDead.add(actor); queryDirty = true;
      for (const shot of projectiles) if (shot.active && shot.owner === index) shot.active = false;
    }
    return true;
  }
  function collect(player, time) {
    let healing = 0;
    for (const actor of drops) {
      if (actor.dropUntil <= time || actor.dropCollected) { drops.delete(actor); continue; }
      if (Math.hypot(player.x - actor.x, player.z - actor.z) < 3 && Math.abs(player.y - actor.y) < 3) {
        actor.dropCollected = true; stats.collected++; healing += .045; drops.delete(actor);
      }
    }
    return healing;
  }
  const actorRecord = actor => ({ id: actor.id, index: actor.index, region: regions[actor.region].id,
    kind: actor.kind, x: actor.x, y: actor.y, z: actor.z, homeX: actor.homeX, homeY: actor.homeY, homeZ: actor.homeZ,
    hp: actor.hp, maxHp: actor.role.hp, alive: actor.alive, active: actor.active, visible: actor.visible, spawnValid: actor.spawnValid,
    generation: actor.generation, respawnAt: actor.respawnAt, warning: actor.pending.active,
    warningUntil: actor.pending.active ? actor.pending.at : null, attacks: actor.attacks, walked: actor.walked,
    hits: actor.hits, damageEvents: actor.damageEvents });
  function tracking() { return { ...stats, activeCount: active.filter(actor => actor.active).length,
    visibleCount: visible.filter(actor => actor.visible).length,
    actors: [...active.filter(actor => actor.active), ...[...nearbyDead].filter(actor => Math.hypot(actor.x - queryX, actor.z - queryZ) < 350).slice(0, 32)].map(actorRecord) }; }
  function snapshot() { return { ...stats, limits: { ...ENCOUNTER_LIMITS }, totalActors: actors.length,
    activeCount: active.filter(actor => actor.active).length, visibleCount: visible.filter(actor => actor.visible).length,
    regionCount: regions.length, resolvedActors: resolved, spatialCells: cells.size, pendingRespawns: deadlines.length,
    coverage: { cellSize: ENCOUNTER_LIMITS.cellSize, grid: gridRegions,
      slotsPerCell: ENCOUNTER_LIMITS.grid, towerSlotsPerTurn: ENCOUNTER_LIMITS.tower },
    regions: [...new Set([...fixedRegionIndices, ...active.filter(actor => actor.active).map(actor => actor.region)])].map(index => ({ region: regions[index], index })).map(({ region, index }) => ({ id: region.id, type: region.type, cap: region.cap,
      x: region.x, y: region.y, z: region.z, population: region.points.length, active: regionCounts[index] })),
    species: { ...species }, anchors: anchors.map(actorRecord),
    actors: (actors.length <= ENCOUNTER_LIMITS.visible ? actors : [...visible.filter(actor => actor.visible), ...nearbyDead]).slice(0, 288).map(actorRecord),
    projectiles: projectiles.filter(shot => shot.active).map(shot => ({ ...shot })) }; }
  function deactivate() {
    for (const actor of active) { actor.active = false; actor.pending.active = false; }
    for (const actor of visible) actor.visible = false;
    for (const shot of projectiles) shot.active = false;
    active.length = visible.length = candidates.length = deadlines.length = 0; regionCounts.fill(0); drops.clear(); nearbyDead.clear();
  }
  return { actors, active, visible, drops, projectiles, update, hit, collect, snapshot, tracking, deactivate };
}

export function createEncounters(scene, { world, ground = world?.groundAt?.bind(world) || (() => 0),
  isBlocked = world?.isBlocked?.bind(world) || (() => false) } = {}) {
  const plan = createEncounterPlan({ world, ground, isBlocked });
  const model = createEncounterState({ ...plan, ground, isBlocked });
  const root = new THREE.Group(); root.name = 'encounters'; scene.add(root);
  const geometries = new Set(), materials = new Set(), targetMeshes = [], parts = [];
  const ownGeometry = geometry => (geometries.add(geometry), geometry), ownMaterial = material => (materials.add(material), material);
  const shapes = { crystal: ownGeometry(new THREE.IcosahedronGeometry(.9, 1)),
    cube: ownGeometry(new THREE.BoxGeometry(1, 1, 1)), sphere: ownGeometry(new THREE.SphereGeometry(1, 12, 8)),
    octahedron: ownGeometry(new THREE.OctahedronGeometry(1)), cone: ownGeometry(new THREE.ConeGeometry(1, 2, 6)),
    column: ownGeometry(new THREE.CylinderGeometry(.65, .9, 1.7, 8)), ring: ownGeometry(new THREE.TorusGeometry(1, .065, 5, 28)),
    bar: ownGeometry(new THREE.PlaneGeometry(1.8, .13)), shot: ownGeometry(new THREE.SphereGeometry(.19, 8, 6)),
    warning: ownGeometry(new THREE.TorusGeometry(1, .045, 5, 24)) };
  const colors = kinds.map(kind => ownMaterial(new THREE.MeshPhysicalMaterial({ color: ENCOUNTER_ROLES[kind].color,
    metalness: .19, roughness: .14, clearcoat: 1, emissive: ENCOUNTER_ROLES[kind].color, emissiveIntensity: .045 })));
  const glass = ownMaterial(new THREE.MeshPhysicalMaterial({ color: 0xebffff, roughness: .075,
    metalness: .03, clearcoat: 1, transparent: true, opacity: .38, transmission: .22, thickness: .18, ior: 1.18 }));
  const white = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xf8ffff, metalness: .24, roughness: .19 }));
  const warning = ownMaterial(new THREE.MeshBasicMaterial({ color: 0xffd5ac, depthWrite: false, transparent: true, opacity: .78 }));
  const health = ownMaterial(new THREE.MeshBasicMaterial({ color: 0xa6f6dc, side: THREE.DoubleSide, depthWrite: false }));
  const dark = ownMaterial(new THREE.MeshStandardMaterial({ color: 0x648b98, metalness: .25, roughness: .26 }));
  const drop = ownMaterial(new THREE.MeshBasicMaterial({ color: 0xa1ffe3, transparent: true, opacity: .82 }));
  const byKind = kinds.map(() => []), instanceActors = kinds.map(() => []);
  const actorMatrices = Array.from({ length: ENCOUNTER_LIMITS.active }, () => new THREE.Matrix4()), actorYaws = new Float64Array(ENCOUNTER_LIMITS.active);
  const temp = new THREE.Object3D(), base = new THREE.Matrix4(), transform = new THREE.Matrix4();
  function makeInstanced(geometry, material, capacity) {
    const mesh = new THREE.InstancedMesh(geometry, material, capacity); mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; root.add(mesh); return mesh;
  }
  function part(kindIndex, shape, material, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], target = true) {
    const mesh = makeInstanced(shapes[shape], material, ENCOUNTER_LIMITS.active);
    mesh.castShadow = target && material !== glass; mesh.receiveShadow = true;
    mesh.userData.encounterKind = kinds[kindIndex];
    temp.position.set(...position); temp.scale.set(...scale); temp.rotation.set(...rotation); temp.updateMatrix();
    const descriptor = { mesh, local: temp.matrix.clone(), kindIndex, health: false, warning: false };
    parts.push(descriptor); if (target) targetMeshes.push(mesh); return descriptor;
  }
  for (const [index, kind] of kinds.entries()) {
    const color = colors[index];
    if (kind === 'wisp') {
      part(index, 'crystal', color, [0, 0, 0], [.9, 1.15, .9]);
      part(index, 'sphere', glass, [0, 0, 0], [1.1, 1.25, 1.1]);
      part(index, 'ring', white, [0, 0, 0], [1.36, 1.36, 1.36], [Math.PI / 3, 0, 0]);
    } else if (kind === 'crawler') {
      part(index, 'cube', color, [0, 0, 0], [1.5, .6, 1.8]);
      part(index, 'octahedron', glass, [0, .48, 0], [.85, .75, .9]);
      for (const side of [-1, 1]) part(index, 'cube', dark, [side * .93, -.47, 0], [.27, .55, 1.38]);
    } else if (kind === 'lens') {
      part(index, 'sphere', glass, [0, 0, 0], [1.35, 1.35, .7]);
      part(index, 'crystal', color, [0, 0, 0], [.75, .75, .4]);
      part(index, 'ring', white, [0, 0, 0], [1.45, 1.45, 1.45]);
      part(index, 'ring', color, [0, 0, 0], [1.8, 1.8, 1.8], [0, Math.PI / 2, 0]);
    } else if (kind === 'kite') {
      part(index, 'octahedron', color, [0, 0, 0], [.8, .8, .7]);
      for (const side of [-1, 1]) part(index, 'cone', glass, [side * 1.15, .05, 0], [.6, 1.15, .4], [0, 0, side * Math.PI / 2]);
      part(index, 'ring', white, [0, -.2, 0], [.6, .6, .6], [Math.PI / 2, 0, 0]);
    } else if (kind === 'pillar') {
      part(index, 'column', white, [0, -.75, 0]);
      part(index, 'cube', color, [0, .6, 0], [1.4, 1.4, 1.4], [0, Math.PI / 4, 0]);
      part(index, 'sphere', glass, [0, .6, 0], [1.25, 1.25, 1.25]);
      part(index, 'ring', white, [0, 1.4, 0], [1.6, 1.6, 1.6], [Math.PI / 2, 0, 0]);
    } else {
      part(index, 'sphere', color, [0, 0, 0], [.6, .6, .6]);
      for (let ring = 0; ring < 3; ring++) part(index, 'ring', ring === 1 ? glass : white,
        [0, (ring - 1) * .6, 0], [1.2, 1.2, 1.2], [Math.PI / 2, 0, ring * .1]);
    }
    const bar = part(index, 'bar', health, [0, 2.4, 0], [1, 1, 1], [0, 0, 0], false); bar.health = true;
    const alert = part(index, 'warning', warning, [0, -ENCOUNTER_ROLES[kind].height + .2, 0], [1.8, 1.8, 1.8], [Math.PI / 2, 0, 0], false); alert.warning = true;
  }
  const shotMesh = makeInstanced(shapes.shot, warning, ENCOUNTER_LIMITS.projectiles);
  const dropMesh = makeInstanced(shapes.crystal, drop, ENCOUNTER_LIMITS.active);
  const farMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: .22, roughness: .2, emissive: 0x0b1619 }));
  const farMesh = makeInstanced(shapes.octahedron, farMaterial, ENCOUNTER_LIMITS.visible), farActors = [], farColors = kinds.map(kind => new THREE.Color(ENCOUNTER_ROLES[kind].color));
  farMesh.userData.encounterKind = 'far'; farMesh.receiveShadow = true; targetMeshes.push(farMesh);
  for (const shape of geometries) shape.computeBoundingBox();
  const rayStart = new THREE.Vector3(), rayDirection = new THREE.Vector3();
  let disposed = false, lastPlayer = null, lastTime = 0, lastReduced = false;
  let activeObstruction = (_origin, _direction, distance) => distance;
  const traceProjectile = (start, direction, distance) => activeObstruction(
    rayStart.set(start.x, start.y, start.z), rayDirection.set(direction.x, direction.y, direction.z), distance);
  const partSet = new Set(targetMeshes);
  function sync(player, time, reduced) {
    for (let index = 0; index < kinds.length; index++) byKind[index].length = instanceActors[index].length = 0;
    let nearSlot = 0;
    for (const actor of model.active) if (actor.active) {
      const kindIndex = kinds.indexOf(actor.kind); byKind[kindIndex].push(actor); instanceActors[kindIndex].push(actor.index);
      const hover = reduced || actor.kind === 'crawler' ? 0 : Math.sin(time * 1.3 + actor.index) * .17;
      const yaw = player ? Math.atan2(player.x - actor.x, player.z - actor.z) : 0; actor.renderSlot = nearSlot; actorYaws[nearSlot] = yaw;
      temp.position.set(actor.x, actor.y + actor.role.height + hover, actor.z);
      temp.rotation.set(0, yaw, 0); temp.scale.set(1, 1, 1); temp.updateMatrix(); actorMatrices[nearSlot++].copy(temp.matrix);
    }
    for (const descriptor of parts) {
      const { mesh, local, kindIndex } = descriptor, actors = byKind[kindIndex];
      let count = 0;
      for (const actor of actors) {
        if (descriptor.health && actor.hp === actor.role.hp || descriptor.warning && !actor.pending.active) continue;
        base.copy(actorMatrices[actor.renderSlot]); transform.multiplyMatrices(base, local);
        if (descriptor.health) {
          temp.position.set(actor.x, actor.y + actor.role.height + 2.4, actor.z);
          temp.rotation.set(0, actorYaws[actor.renderSlot], 0); temp.scale.set(actor.hp / actor.role.hp, 1, 1); temp.updateMatrix(); transform.copy(temp.matrix);
        }
        mesh.setMatrixAt(count++, transform);
      }
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true; mesh.boundingSphere = mesh.boundingBox = null;
    }
    farActors.length = 0;
    for (const actor of model.visible) if (actor.visible && actor.alive && !actor.active) {
      const kindIndex = kinds.indexOf(actor.kind), scale = 2.4;
      temp.position.set(actor.x, actor.y + Math.max(scale + .1, actor.role.height), actor.z);
      temp.rotation.set(0, actor.index * .2, actor.kind === 'kite' ? .5 : 0); temp.scale.set(scale, scale * (actor.kind === 'pillar' ? 1.4 : 1), scale); temp.updateMatrix();
      farMesh.setMatrixAt(farActors.length, temp.matrix); farMesh.setColorAt(farActors.length, farColors[kindIndex]); farActors.push(actor.index);
    }
    farMesh.count = farActors.length; farMesh.instanceMatrix.needsUpdate = true;
    if (farMesh.instanceColor) farMesh.instanceColor.needsUpdate = true; farMesh.boundingSphere = farMesh.boundingBox = null;
    let shotCount = 0;
    for (const shot of model.projectiles) if (shot.active) {
      temp.position.set(shot.x, shot.y, shot.z); temp.rotation.set(0, 0, 0); temp.scale.set(1, 1, 1); temp.updateMatrix(); shotMesh.setMatrixAt(shotCount++, temp.matrix);
    }
    shotMesh.count = shotCount; shotMesh.instanceMatrix.needsUpdate = true;
    let dropCount = 0;
    for (const actor of model.drops) if (dropCount < ENCOUNTER_LIMITS.active && !actor.alive && !actor.dropCollected
      && actor.dropUntil > time && player && Math.hypot(actor.x - player.x, actor.z - player.z) < 350 && Math.abs(actor.y - player.y) < 35) {
      temp.position.set(actor.x, actor.y + .6, actor.z); temp.rotation.set(0, reduced ? 0 : time, 0); temp.scale.setScalar(.32); temp.updateMatrix(); dropMesh.setMatrixAt(dropCount++, temp.matrix);
    }
    dropMesh.count = dropCount; dropMesh.instanceMatrix.needsUpdate = true; root.updateMatrixWorld(true);
  }
  return {
    update(player, time, dt, onDamage = () => {}, reduced = false, obstruction = (_start, _direction, distance) => distance) {
      if (disposed) return;
      lastPlayer = player; lastTime = time; lastReduced = reduced; activeObstruction = obstruction;
      model.update(player, time, dt, onDamage, reduced, traceProjectile); sync(player, time, reduced);
    },
    targets() { return disposed ? [] : targetMeshes.filter(mesh => mesh.count > 0); },
    hit(mesh, time, instanceId) {
      if (disposed || !partSet.has(mesh) || !Number.isInteger(instanceId) || instanceId < 0 || instanceId >= mesh.count) return false;
      const kindIndex = kinds.indexOf(mesh.userData.encounterKind), actorIndex = mesh === farMesh ? farActors[instanceId] : instanceActors[kindIndex][instanceId];
      const accepted = model.hit(actorIndex, time);
      if (accepted) sync(lastPlayer, time, lastReduced);
      return accepted;
    },
    collect(player, time) { return disposed ? 0 : model.collect(player, time); },
    tracking() { return { disposed, ...model.tracking() }; },
    snapshot() { return { disposed, ...model.snapshot(), geometryCount: geometries.size,
      materialCount: materials.size, meshCount: root.children.length, visualCapacity: ENCOUNTER_LIMITS.visible,
      renderInstances: byKind.reduce((count, actors) => count + actors.length, 0) + farActors.length,
      nearInstances: byKind.reduce((count, actors) => count + actors.length, 0), farInstances: farMesh.count, farMeshes: 1, time: lastTime }; },
    dispose() {
      if (disposed) return;
      disposed = true; root.removeFromParent();
      for (const mesh of root.children) { mesh.count = 0; mesh.dispose(); }
      model.deactivate();
      farActors.length = 0;
      for (let index = 0; index < kinds.length; index++) byKind[index].length = instanceActors[index].length = 0;
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      root.clear();
    },
  };
}
