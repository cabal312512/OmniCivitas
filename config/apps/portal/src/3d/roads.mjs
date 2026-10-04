import { ROAD_ROUTES } from './city-data.mjs';
import { riverShapeAt, WATER_LEVEL } from './terrain.mjs';

// The road sampler and rendered triangles use exactly the same Float32 data.
// A sparse X/Z index avoids scanning kilometres of geometry on each movement
// substep. Profiles are a grade-limited upper envelope of the local terrain.
export function createRoadNetwork(landscapeHeightAt) {
  const gridSize = 64, surfaceGrid = new Map();
  const roads = [];
  function register(triangle) {
    const { positions: p, a, b, c } = triangle;
    const minX = Math.min(p[a], p[b], p[c]), maxX = Math.max(p[a], p[b], p[c]);
    const minZ = Math.min(p[a + 2], p[b + 2], p[c + 2]), maxZ = Math.max(p[a + 2], p[b + 2], p[c + 2]);
    for (let ix = Math.floor(minX / gridSize); ix <= Math.floor(maxX / gridSize); ix++) {
      for (let iz = Math.floor(minZ / gridSize); iz <= Math.floor(maxZ / gridSize); iz++) {
        const key = ix + ',' + iz;
        if (!surfaceGrid.has(key)) surfaceGrid.set(key, []);
        surfaceGrid.get(key).push(triangle);
      }
    }
  }
  for (const definition of ROAD_ROUTES) {
    const points = [], half = definition.width / 2;
    for (let i = 1; i < definition.points.length; i++) {
      const a = definition.points[i - 1], b = definition.points[i];
      const length = Math.hypot(b.x - a.x, b.z - a.z), count = Math.ceil(length / 22);
      for (let j = i === 1 ? 0 : 1; j <= count; j++) {
        const t = j / count, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
        const nx = -(b.z - a.z) / length, nz = (b.x - a.x) / length;
        const terrain = Math.max(landscapeHeightAt(x, z), landscapeHeightAt(x + nx * half, z + nz * half), landscapeHeightAt(x - nx * half, z - nz * half));
        const wet = riverShapeAt(x, z).mask > .12 || riverShapeAt(x + nx * half, z + nz * half).mask > .12 || riverShapeAt(x - nx * half, z - nz * half).mask > .12;
        points.push({ x, z, y: Math.max(terrain + .28, wet ? WATER_LEVEL + 6 : -Infinity), terrain, wet });
      }
    }
    // Narrow river banks can rise between the 22m survey vertices. Survey
    // each span too, so its linear deck stays above the actual bank surface.
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.z - a.z);
      const nx = -(b.z - a.z) / length, nz = (b.x - a.x) / length;
      let lift = 0;
      for (const t of [.2, .4, .6, .8]) {
        const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
        const target = Math.max(landscapeHeightAt(x, z), landscapeHeightAt(x + nx * half, z + nz * half), landscapeHeightAt(x - nx * half, z - nz * half)) + .3;
        lift = Math.max(lift, target - (a.y + (b.y - a.y) * t));
      }
      if (lift > 0) { a.y += lift; b.y += lift; }
    }
    const grade = .11;
    for (let i = points.length - 2; i >= 0; i--) {
      const distance = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].z - points[i].z);
      points[i].y = Math.max(points[i].y, points[i + 1].y - grade * distance);
    }
    for (let i = 1; i < points.length; i++) {
      const distance = Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
      points[i].y = Math.max(points[i].y, points[i - 1].y - grade * distance);
    }
    // Keep a real vertex on the surveyed centreline too. At a mitered bend,
    // four triangles preserve the centre's exact profile instead of letting
    // the diagonal of a twisted quad cut across it at a different elevation.
    const positions = new Float32Array(points.length * 9), indices = new Uint16Array((points.length - 1) * 12);
    let length = 0, maxGrade = 0, bridges = 0;
    for (let i = 0; i < points.length; i++) {
      const point = points[i], previous = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
      const beforeLength = Math.hypot(point.x - previous.x, point.z - previous.z) || 1;
      const afterLength = Math.hypot(next.x - point.x, next.z - point.z) || 1;
      const ax = i ? (point.x - previous.x) / beforeLength : (next.x - point.x) / afterLength;
      const az = i ? (point.z - previous.z) / beforeLength : (next.z - point.z) / afterLength;
      const bx = i < points.length - 1 ? (next.x - point.x) / afterLength : ax;
      const bz = i < points.length - 1 ? (next.z - point.z) / afterLength : az;
      const normalLength = Math.hypot(az + bz, ax + bx) || 1;
      const nx = -(az + bz) / normalLength, nz = (ax + bx) / normalLength;
      const miter = half / Math.max(.55, Math.abs(nx * -az + nz * ax));
      for (const [side, sign] of [[0, -1], [1, 0], [2, 1]]) {
        const at = i * 9 + side * 3;
        positions[at] = point.x + nx * miter * sign;
        positions[at + 1] = point.y;
        positions[at + 2] = point.z + nz * miter * sign;
      }
      if (i) {
        const distance = Math.hypot(point.x - previous.x, point.z - previous.z);
        length += distance; maxGrade = Math.max(maxGrade, Math.abs(point.y - previous.y) / distance);
        const a = (i - 1) * 3, at = (i - 1) * 12;
        const strip = [a, a + 1, a + 3, a + 1, a + 4, a + 3, a + 1, a + 2, a + 4, a + 2, a + 5, a + 4];
        indices.set(strip, at);
        for (let tri = 0; tri < strip.length; tri += 3) register({ positions, a: strip[tri] * 3, b: strip[tri + 1] * 3, c: strip[tri + 2] * 3 });
        if (point.wet) bridges++;
      }
    }
    const record = Object.freeze({
      id: definition.id, from: definition.from, to: definition.to, width: definition.width,
      length, maxGrade, bridges, elevatedSegments: points.filter(point => point.y - point.terrain > 3).length,
      surfaceColor: '#eff6fa', sampleCount: points.length, triangles: indices.length / 3,
      minY: Math.min(...points.map(p => p.y)), maxY: Math.max(...points.map(p => p.y)),
      waypoints: definition.points,
      samplePoints: Object.freeze(points.filter((_, i) => i % 6 === 0 || i === points.length - 1).map(p => Object.freeze({ x: p.x, y: p.y, z: p.z }))),
    });
    roads.push({ definition, positions, indices, points, record });
  }
  function groundAt(x, z, referenceY) {
    let highest = -Infinity;
    const candidates = surfaceGrid.get(Math.floor(x / gridSize) + ',' + Math.floor(z / gridSize)) || [];
    for (const triangle of candidates) {
      const { positions: p, a, b, c } = triangle;
      const denominator = (p[b + 2] - p[c + 2]) * (p[a] - p[c]) + (p[c] - p[b]) * (p[a + 2] - p[c + 2]);
      if (Math.abs(denominator) < 1e-8) continue;
      const u = ((p[b + 2] - p[c + 2]) * (x - p[c]) + (p[c] - p[b]) * (z - p[c + 2])) / denominator;
      const v = ((p[c + 2] - p[a + 2]) * (x - p[c]) + (p[a] - p[c]) * (z - p[c + 2])) / denominator;
      const w = 1 - u - v;
      if (u < -1e-5 || v < -1e-5 || w < -1e-5) continue;
      const y = u * p[a + 1] + v * p[b + 1] + w * p[c + 1];
      // Reference height distinguishes walking on a bridge from being below it.
      if (Number.isFinite(referenceY) && y > referenceY + 2.6) continue;
      highest = Math.max(highest, y);
    }
    return highest;
  }
  return { roads, records: Object.freeze(roads.map(road => road.record)), groundAt };
}
