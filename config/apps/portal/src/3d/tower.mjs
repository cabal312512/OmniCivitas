import * as THREE from 'three';
import { CAPITAL } from './city-data.mjs';

export const TOWER_SPEC = Object.freeze({
  x: CAPITAL.x, z: CAPITAL.z, baseY: CAPITAL.ground, height: 2400,
  baseRadius: 430, topRadius: 140, turns: 12, roadWidth: 22,
  roadOffset: 14, railHeight: 1.7, steps: 4608,
  summitGuardHeight: 3.2,
});
const TAU = Math.PI * 2;
const cap = (n, a, b) => Math.max(a, Math.min(b, n));
const topY = TOWER_SPEC.baseY + TOWER_SPEC.height;
const radiusDrop = TOWER_SPEC.baseRadius - TOWER_SPEC.topRadius;
const startRoadRadius = TOWER_SPEC.baseRadius + TOWER_SPEC.roadOffset;
const roadFloorHalfWidth = TOWER_SPEC.roadWidth / 2 + .04;
const roadRisePerTurn = TOWER_SPEC.height / TOWER_SPEC.turns;
const axes = ['x', 'y', 'z'];
const landingAngle = .105, summitGateAngle = .035, summitGuardRadius = 144.5;
const landingStart = 1 - landingAngle / (TAU * TOWER_SPEC.turns);
const summitCaptureDepth = 4.2;
const landingPositions = new Float32Array(25 * 6), landingIndices = new Uint16Array(24 * 6);
for (let index = 0; index <= 24; index++) {
  const angle = -landingAngle + index / 24 * landingAngle * 2;
  const outerY = topY + Math.min(0, angle) * TOWER_SPEC.height / (TAU * TOWER_SPEC.turns);
  const innerY = outerY + (topY - outerY) * cap((angle + landingAngle) / (landingAngle - summitGateAngle), 0, 1);
  for (const [side, radius] of [[0, 140], [1, 165]]) {
    const at = index * 6 + side * 3;
    landingPositions[at] = TOWER_SPEC.x + Math.cos(angle) * radius;
    landingPositions[at + 1] = side ? outerY : innerY;
    landingPositions[at + 2] = TOWER_SPEC.z + Math.sin(angle) * radius;
  }
  if (index < 24) { const a = index * 2; landingIndices.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], index * 6); }
}

// The sampler uses the same Float32 ramp triangles as the rendered bridge.
export function landingSurfaceAt(x, z) {
  const angle = Math.atan2(z - TOWER_SPEC.z, x - TOWER_SPEC.x);
  if (Math.abs(angle) > landingAngle + .00001) return null;
  const near = Math.floor((angle + landingAngle) / (landingAngle * 2) * 24);
  let floor = -Infinity;
  for (let segment = Math.max(0, near - 1); segment <= Math.min(23, near + 1); segment++) {
    for (let triangle = 0; triangle < 2; triangle++) {
      const at = segment * 6 + triangle * 3, a = landingIndices[at] * 3, b = landingIndices[at + 1] * 3, c = landingIndices[at + 2] * 3, p = landingPositions;
      const d = (p[b + 2] - p[c + 2]) * (p[a] - p[c]) + (p[c] - p[b]) * (p[a + 2] - p[c + 2]);
      const u = ((p[b + 2] - p[c + 2]) * (x - p[c]) + (p[c] - p[b]) * (z - p[c + 2])) / d;
      const v = ((p[c + 2] - p[a + 2]) * (x - p[c]) + (p[a] - p[c]) * (z - p[c + 2])) / d;
      const w = 1 - u - v;
      if (u >= -1e-5 && v >= -1e-5 && w >= -1e-5) floor = Math.max(floor, u * p[a + 1] + v * p[b + 1] + w * p[c + 1]);
    }
  }
  return floor === -Infinity ? null : floor;
}

function finiteSegmentInBox(origin, direction, distance, bounds) {
  // Raycaster expects a unit direction. For other inputs, preserve its own
  // behavior instead of applying a potentially different broad-phase test.
  const lengthSquared = direction.x * direction.x + direction.y * direction.y + direction.z * direction.z;
  if (!Number.isFinite(lengthSquared) || Math.abs(lengthSquared - 1) > 1e-6) return true;
  let start = .05, end = distance;
  for (const axis of axes) {
    const position = origin[axis], step = direction[axis];
    if (step === 0) {
      if (position < bounds.min[axis] || position > bounds.max[axis]) return false;
      continue;
    }
    let near = (bounds.min[axis] - position) / step;
    let far = (bounds.max[axis] - position) / step;
    if (near > far) { const swap = near; near = far; far = swap; }
    start = Math.max(start, near); end = Math.min(end, far);
    if (start > end) return false;
  }
  return true;
}

export function pathPoint(t, offset = 0) {
  t = cap(t, 0, 1);
  const radius = TOWER_SPEC.baseRadius + (TOWER_SPEC.topRadius - TOWER_SPEC.baseRadius) * t
    + TOWER_SPEC.roadOffset + offset;
  const angle = t * TAU * TOWER_SPEC.turns;
  return { x: TOWER_SPEC.x + Math.cos(angle) * radius,
    y: TOWER_SPEC.baseY + t * TOWER_SPEC.height,
    z: TOWER_SPEC.z + Math.sin(angle) * radius, t, radius, angle };
}

// Every road layer is a real floor. The caller supplies the current FOOT height,
// so a ground visitor can never snap to a different winding or the summit.
export function surfaceAt(x, z, referenceY = TOWER_SPEC.baseY) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(referenceY)) return null;
  const dx = x - TOWER_SPEC.x, dz = z - TOWER_SPEC.z;
  if (dx < -startRoadRadius - roadFloorHalfWidth || dx > TOWER_SPEC.baseRadius + 76
    || Math.abs(dz) > startRoadRadius + roadFloorHalfWidth) return null;
  const radius = Math.hypot(dx, dz);
  let angle = Math.atan2(dz, dx);
  if (angle < 0) angle += TAU;
  let floor = -Infinity;
  const fraction = angle / TAU;
  // The radius drops by more than the road width each turn. Select the radial
  // winding, then check its neighbors with the original precise conditions.
  const candidate = Math.round((startRoadRadius - radius) * TOWER_SPEC.turns / radiusDrop - fraction);
  for (let winding = Math.max(0, candidate - 1); winding <= Math.min(TOWER_SPEC.turns, candidate + 1); winding++) {
    const t = (fraction + winding) / TOWER_SPEC.turns;
    if (t > 1 + 1e-8) continue;
    const progress = cap(t, 0, 1);
    const roadRadius = TOWER_SPEC.baseRadius - radiusDrop * progress + TOWER_SPEC.roadOffset;
    const roadY = TOWER_SPEC.baseY + progress * TOWER_SPEC.height;
    if (Math.abs(radius - roadRadius) <= roadFloorHalfWidth && roadY <= referenceY + 1.8) floor = Math.max(floor, roadY);
  }
  // Only the already-reached final landing may capture a small downward
  // crossing. Earlier windings and ground visitors never receive the crown.
  if (referenceY >= topY - summitCaptureDepth) {
    if (radius <= TOWER_SPEC.topRadius + 5) floor = Math.max(floor, topY);
    if (radius >= 139.9 && radius <= 165.1) {
      const landing = landingSurfaceAt(x, z);
      if (landing !== null) floor = Math.max(floor, landing);
    }
  }
  // A short entrance apron makes the road unmistakable without a teleport.
  if (dx >= TOWER_SPEC.baseRadius + 2 && dx <= TOWER_SPEC.baseRadius + 76
    && Math.abs(dz) <= 13 && TOWER_SPEC.baseY <= referenceY + 1.8) floor = Math.max(floor, TOWER_SPEC.baseY);
  return floor === -Infinity ? null : floor;
}

export function blocked(x, z, radius = .48, referenceY = TOWER_SPEC.baseY) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(radius) || !Number.isFinite(referenceY)) return true;
  const dx = x - TOWER_SPEC.x, dz = z - TOWER_SPEC.z;
  const distance = Math.hypot(dx, dz), relative = referenceY - TOWER_SPEC.baseY;
  if (distance > startRoadRadius + TOWER_SPEC.roadWidth / 2 + Math.max(0, radius + .22) + .001
    || referenceY < TOWER_SPEC.baseY - 1.2 || referenceY > topY + TOWER_SPEC.summitGuardHeight) return false;
  if (relative >= -1 && relative < TOWER_SPEC.height - .2) {
    const coreRadius = TOWER_SPEC.baseRadius + (TOWER_SPEC.topRadius - TOWER_SPEC.baseRadius)
      * cap(relative / TOWER_SPEC.height, 0, 1);
    if (distance < coreRadius + radius) return true;
  }
  let angle = Math.atan2(dz, dx);
  if (angle < 0) angle += TAU;
  const fraction = angle / TAU;
  const candidate = Math.round(relative / roadRisePerTurn - fraction);
  for (let winding = Math.max(0, candidate - 1); winding <= Math.min(TOWER_SPEC.turns, candidate + 1); winding++) {
    const t = (fraction + winding) / TOWER_SPEC.turns;
    if (t > 1 + 1e-8) continue;
    const progress = cap(t, 0, 1);
    const roadY = TOWER_SPEC.baseY + progress * TOWER_SPEC.height;
    // The rail only blocks at its own vertical layer. Jumping above it can fall.
    const railHeight = t >= .997 ? TOWER_SPEC.summitGuardHeight : TOWER_SPEC.railHeight;
    if (referenceY < roadY - 1.2 || referenceY > roadY + railHeight) continue;
    const roadRadius = TOWER_SPEC.baseRadius - radiusDrop * progress + TOWER_SPEC.roadOffset;
    const outer = roadRadius + TOWER_SPEC.roadWidth / 2;
    if (t >= .00075 && Math.abs(distance - outer) < radius + .22) return true;
    const inner = roadRadius - TOWER_SPEC.roadWidth / 2;
    const innerHeight = t >= .997 ? TOWER_SPEC.summitGuardHeight : .8;
    if (t < landingStart && referenceY <= roadY + innerHeight && Math.abs(distance - inner) < radius + .22) return true;
  }
  const entranceAngle = Math.min(angle, TAU - angle);
  if (referenceY >= topY - summitCaptureDepth && referenceY <= topY + TOWER_SPEC.summitGuardHeight) {
    if (entranceAngle > summitGateAngle && Math.abs(distance - summitGuardRadius) < radius + .22) return true;
    if (entranceAngle <= summitGateAngle + .01 && Math.abs(distance - 164.5) < radius + .22) return true;
    for (const side of [-1, 1]) {
      const a = side * summitGateAngle, along = dx * Math.cos(a) + dz * Math.sin(a), across = -dx * Math.sin(a) + dz * Math.cos(a);
      // The approaching helix crosses the negative-angle side at radius 154.
      // Its opening is real geometry, not a collision-only exemption.
      const end = side < 0 ? 150 : 164.5;
      if (along > summitGuardRadius - radius && along < end + radius && Math.abs(across) < radius + .16) return true;
    }
  }
  return false;
}

function ribbon(offset, width, vertical = false, end = 1, start = 0) {
  const points = [], normals = [], indices = [], count = Math.ceil(TOWER_SPEC.steps * (end - start));
  for (let index = 0; index <= count; index++) {
    const t = start + index / count * (end - start), p = pathPoint(t, offset);
    for (let side = 0; side < 2; side++) {
      const radius = p.radius + (vertical ? 0 : (side - .5) * width);
      points.push(TOWER_SPEC.x + Math.cos(p.angle) * radius,
        p.y + (vertical ? side * width : 0), TOWER_SPEC.z + Math.sin(p.angle) * radius);
      normals.push(vertical ? Math.cos(p.angle) : 0, vertical ? 0 : 1,
        vertical ? Math.sin(p.angle) : 0);
    }
    if (index < count) {
      const a = index * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createTower(scene) {
  const root = new THREE.Group(); root.name = 'tower'; scene.add(root);
  const geometries = new Set(), materials = new Set();
  const ownGeometry = value => (geometries.add(value), value);
  const ownMaterial = value => (materials.add(value), value);
  const white = ownMaterial(new THREE.MeshPhysicalMaterial({ color: 0xffffff,
    roughness: .24, metalness: .04, clearcoat: .8, envMapIntensity: 1.1 }));
  const pearl = ownMaterial(new THREE.MeshPhysicalMaterial({ color: 0xf6fffd,
    roughness: .33, metalness: .06, clearcoat: .55, side: THREE.DoubleSide }));
  const glass = ownMaterial(new THREE.MeshPhysicalMaterial({ color: 0xdafaff,
    roughness: .08, transmission: .34, thickness: .4, ior: 1.15,
    transparent: true, opacity: .6, side: THREE.DoubleSide, clearcoat: 1 }));
  const glow = ownMaterial(new THREE.MeshBasicMaterial({ color: 0x98ebff,
    transparent: true, opacity: .32, depthWrite: false, blending: THREE.AdditiveBlending }));
  function mesh(geometry, material, position) {
    const item = new THREE.Mesh(ownGeometry(geometry), material);
    if (position) item.position.set(...position);
    item.castShadow = material !== glass && material !== glow;
    item.receiveShadow = true; root.add(item); return item;
  }
  const body = mesh(new THREE.CylinderGeometry(TOWER_SPEC.topRadius, TOWER_SPEC.baseRadius,
    TOWER_SPEC.height, 96, 24, true), white,
  [TOWER_SPEC.x, TOWER_SPEC.baseY + TOWER_SPEC.height / 2, TOWER_SPEC.z]);
  const road = mesh(ribbon(0, TOWER_SPEC.roadWidth), pearl);
  const outerRail = mesh(ribbon(TOWER_SPEC.roadWidth / 2, TOWER_SPEC.railHeight, true, 1, .00075), glass);
  const innerRail = mesh(ribbon(-TOWER_SPEC.roadWidth / 2, .8, true, .997), white);
  const summit = mesh(new THREE.CylinderGeometry(145, 145, 3, 96), pearl,
    [TOWER_SPEC.x, topY - 1.5, TOWER_SPEC.z]);
  const landingGeometry = new THREE.BufferGeometry();
  landingGeometry.setAttribute('position', new THREE.BufferAttribute(landingPositions.slice(), 3));
  landingGeometry.setIndex(new THREE.BufferAttribute(landingIndices.slice(), 1)); landingGeometry.computeVertexNormals();
  const finalLanding = mesh(landingGeometry, pearl);
  finalLanding.name = 'tower-final-landing';
  const summitRail = mesh(new THREE.CylinderGeometry(summitGuardRadius, summitGuardRadius, TOWER_SPEC.summitGuardHeight, 96, 1, true, summitGateAngle, TAU - summitGateAngle * 2), glass,
    [TOWER_SPEC.x, topY + TOWER_SPEC.summitGuardHeight / 2, TOWER_SPEC.z]);
  summitRail.name = 'tower-summit-guard';
  summitRail.rotation.y = Math.PI / 2;
  mesh(new THREE.BoxGeometry(74, .7, 26), pearl,
    [TOWER_SPEC.x + TOWER_SPEC.baseRadius + 39, TOWER_SPEC.baseY - .35, TOWER_SPEC.z]);
  // White ribs emphasize the exceptional scale while keeping the tower solid.
  const ribGeometry = ownGeometry(new THREE.CylinderGeometry(.65, .65, 1, 6));
  const ribs = new THREE.InstancedMesh(ribGeometry, white, 48);
  const temporary = new THREE.Object3D();
  const slope = Math.atan((TOWER_SPEC.baseRadius - TOWER_SPEC.topRadius) / TOWER_SPEC.height);
  for (let index = 0; index < 48; index++) {
    const angle = index * TAU / 48;
    temporary.position.set(TOWER_SPEC.x + Math.cos(angle) * 285,
      TOWER_SPEC.baseY + TOWER_SPEC.height / 2, TOWER_SPEC.z + Math.sin(angle) * 285);
    temporary.rotation.set(Math.sin(angle) * slope, 0, -Math.cos(angle) * slope);
    temporary.scale.set(1, Math.hypot(TOWER_SPEC.height, 290), 1);
    temporary.updateMatrix(); ribs.setMatrixAt(index, temporary.matrix);
  }
  ribs.castShadow = true; root.add(ribs);
  const beam = mesh(new THREE.CylinderGeometry(2.5, 8, 4100, 20, 1, true), glow,
    [TOWER_SPEC.x, TOWER_SPEC.baseY + 2050, TOWER_SPEC.z]);
  // Above the crown the guiding beam remains non-solid light, not a higher floor.
  const beamShell = mesh(new THREE.CylinderGeometry(10, 32, 4100, 20, 1, true), glow,
    [TOWER_SPEC.x, TOWER_SPEC.baseY + 2050, TOWER_SPEC.z]);
  mesh(ribbon(-TOWER_SPEC.roadWidth / 2, TOWER_SPEC.summitGuardHeight, true, landingStart, .997), glass).name = 'tower-final-inner-guard';
  mesh(ribbon(TOWER_SPEC.roadWidth / 2, TOWER_SPEC.summitGuardHeight, true, 1, .997), glass).name = 'tower-final-outer-guard';
  for (const side of [-1, 1]) {
    const angle = side * summitGateAngle, end = side < 0 ? 150 : 164.5, middle = (summitGuardRadius + end) / 2;
    const rail = mesh(new THREE.BoxGeometry(end - summitGuardRadius, TOWER_SPEC.summitGuardHeight, .32), glass,
      [TOWER_SPEC.x + Math.cos(angle) * middle, topY + TOWER_SPEC.summitGuardHeight / 2, TOWER_SPEC.z + Math.sin(angle) * middle]);
    rail.rotation.y = -angle; rail.name = 'tower-landing-side-guard';
  }
  const landingEndGuard = mesh(new THREE.CylinderGeometry(164.5, 164.5, TOWER_SPEC.summitGuardHeight, 12, 1, true, -summitGateAngle, summitGateAngle * 2), glass,
    [TOWER_SPEC.x, topY + TOWER_SPEC.summitGuardHeight / 2, TOWER_SPEC.z]);
  landingEndGuard.rotation.y = Math.PI / 2; landingEndGuard.name = 'tower-landing-end-guard';
  class CrownHandrail extends THREE.Curve {
    getPoint(t, target = new THREE.Vector3()) {
      const angle = summitGateAngle + t * (TAU - summitGateAngle * 2);
      return target.set(TOWER_SPEC.x + Math.cos(angle) * summitGuardRadius,
        topY + TOWER_SPEC.summitGuardHeight, TOWER_SPEC.z + Math.sin(angle) * summitGuardRadius);
    }
  }
  mesh(new THREE.TubeGeometry(new CrownHandrail(), 192, .23, 6, false), white).name = 'tower-crown-handrail';
  const guardPostGeometry = ownGeometry(new THREE.CylinderGeometry(.21, .21, TOWER_SPEC.summitGuardHeight, 6));
  const guardPosts = new THREE.InstancedMesh(guardPostGeometry, white, 48);
  for (let i = 0; i < 48; i++) {
    const angle = summitGateAngle + (i + .5) / 48 * (TAU - summitGateAngle * 2);
    temporary.position.set(TOWER_SPEC.x + Math.cos(angle) * summitGuardRadius, topY + TOWER_SPEC.summitGuardHeight / 2, TOWER_SPEC.z + Math.sin(angle) * summitGuardRadius);
    temporary.rotation.set(0, 0, 0); temporary.scale.set(1, 1, 1); temporary.updateMatrix(); guardPosts.setMatrixAt(i, temporary.matrix);
  }
  guardPosts.name = 'tower-crown-posts'; guardPosts.castShadow = true; root.add(guardPosts);
  const stationDefinitions = [
    ['tower-base', 0], ['tower-third', 1 / 3], ['tower-second', 2 / 3], ['tower-crown', 1],
  ];
  const restStations = stationDefinitions.map(([id, t]) => {
    const point = pathPoint(t, t === 1 ? -20 : 0);
    return { id, landmarkId: id, position: new THREE.Vector3(point.x, point.y, point.z),
      radius: t === 1 ? 5 : 6, tower: true, t };
  });
  const stationGlass = ownMaterial(new THREE.MeshBasicMaterial({ color: 0x8bf7e7,
    transparent: true, opacity: .7, depthWrite: false, side: THREE.DoubleSide }));
  for (const station of restStations) {
    const ring = mesh(new THREE.TorusGeometry(station.radius, .14, 6, 48), stationGlass,
      [station.position.x, station.position.y + .08, station.position.z]);
    ring.rotation.x = -Math.PI / 2;
  }
  root.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster();
  const solids = [body, road, summit, innerRail, finalLanding];
  const rayHits = [], rayBounds = new THREE.Box3(), temporaryBounds = new THREE.Box3();
  for (const solid of solids) {
    solid.geometry.computeBoundingBox();
    temporaryBounds.copy(solid.geometry.boundingBox).applyMatrix4(solid.matrixWorld);
    rayBounds.union(temporaryBounds);
  }
  // A conservative margin keeps Float32 geometry boundaries in the narrow phase.
  rayBounds.expandByScalar(.001);
  let disposed = false;
  const stats = { spec: { ...TOWER_SPEC }, entrance: pathPoint(0), summit: pathPoint(1), roadLength: 0, topY, recoveries: 0,
    highestWalkableY: topY, roadVertices: road.geometry.attributes.position.count,
    restStations: restStations.length, disposed: false };
  let previous = pathPoint(0);
  for (let index = 1; index <= 1200; index++) {
    const point = pathPoint(index / 1200);
    stats.roadLength += Math.hypot(point.x - previous.x, point.y - previous.y, point.z - previous.z);
    previous = point;
  }
  let lastSafe = null;
  function recoverPlayer(player) {
    if (disposed || !player || ![player.x, player.y, player.z].every(Number.isFinite)) return false;
    const relative = player.y - TOWER_SPEC.baseY;
    const radial = Math.hypot(player.x - TOWER_SPEC.x, player.z - TOWER_SPEC.z);
    const core = TOWER_SPEC.baseRadius - radiusDrop * cap(relative / TOWER_SPEC.height, 0, 1);
    if (relative >= -.1 && relative < TOWER_SPEC.height - .2 && radial < core - .05) {
      const candidates = restStations.map(station => ({ x: station.position.x, y: station.position.y, z: station.position.z, source: station.id }));
      if (lastSafe) candidates.push({ ...lastSafe, source: 'last-safe' });
      let angle = Math.atan2(player.z - TOWER_SPEC.z, player.x - TOWER_SPEC.x); if (angle < 0) angle += TAU;
      const fraction = angle / TAU;
      for (let winding = 0; winding <= TOWER_SPEC.turns; winding++) {
        const t = (winding + fraction) / TOWER_SPEC.turns;
        if (t <= 1) candidates.push({ ...pathPoint(t), source: 'road' });
      }
      let nearest = null, score = Infinity;
      for (const point of candidates) {
        const floor = surfaceAt(point.x, point.z, point.y);
        if (floor === null || Math.abs(floor - point.y) > 1.8 || blocked(point.x, point.z, .48, floor)) continue;
        const distance = (point.x - player.x) ** 2 + (floor - player.y) ** 2 + (point.z - player.z) ** 2;
        if (distance < score) { score = distance; nearest = { x: point.x, y: floor, z: point.z, source: point.source }; }
      }
      if (!nearest) return false;
      stats.lastRecovery = { from: { x: player.x, y: player.y, z: player.z }, to: { ...nearest } };
      player.x = nearest.x; player.y = nearest.y; player.z = nearest.z; player.vy = 0; player.grounded = true;
      stats.recoveries++; lastSafe = { x: player.x, y: player.y, z: player.z }; return true;
    }
    const floor = surfaceAt(player.x, player.z, player.y);
    if (player.grounded && floor !== null && Math.abs(floor - player.y) < .25 && !blocked(player.x, player.z, .48, player.y)) {
      lastSafe = { x: player.x, y: player.y, z: player.z };
    }
    return false;
  }
  return {
    groundAt: surfaceAt, surfaceAt, isBlocked: blocked, blocked,
    recoverPlayer,
    restStations,
    landmarks: [{ id: 'tower', position: new THREE.Vector3(TOWER_SPEC.x + 505, TOWER_SPEC.baseY, TOWER_SPEC.z),
      tower: true }],
    stats,
    update(time, _dt, player, reduced = false) {
      if (disposed) return;
      recoverPlayer(player);
      const shimmer = reduced ? .3 : .3 + Math.sin(time * .7) * .035;
      beam.material.opacity = shimmer;
      beamShell.scale.x = beamShell.scale.z = reduced ? 1 : 1 + Math.sin(time * .32) * .05;
    },
    obstructRay(origin, direction, distance) {
      if (disposed || !Number.isFinite(distance) || distance <= .05) return distance;
      if (!finiteSegmentInBox(origin, direction, distance, rayBounds)) return distance;
      raycaster.set(origin, direction); raycaster.near = .05; raycaster.far = distance;
      rayHits.length = 0;
      raycaster.intersectObjects(solids, false, rayHits);
      return rayHits[0]?.distance ?? distance;
    },
    snapshot() { return { ...stats, disposed, restStations: restStations.map(station => ({
      id: station.id, x: station.position.x, y: station.position.y, z: station.position.z, t: station.t, radius: station.radius,
    })) }; },
    dispose() {
      if (disposed) return;
      disposed = true; stats.disposed = true; scene.remove(root);
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      ribs.dispose(); guardPosts.dispose();
      rayHits.length = 0;
      root.clear();
    },
  };
}
