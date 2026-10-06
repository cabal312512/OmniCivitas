import {TOWNS} from './tt9.mjs';
import { CITIES, cityHalf } from '../pcakage/build2/c0.mjs';
import {EXTRA_HILLS} from './laf84ejfa.mjs';

// Metres; X and Z range from -6000 to 6000. All samplers are deterministic.
export const WORLD_SIZE = 12000;
export const WATER_LEVEL = 4;
export const SPAWN = Object.freeze({ x: 0, z: 180 });
export const LANDMARKS = Object.freeze([
  { id: 'avenue', x: 0, z: -170 },
  { id: 'city', x: -850, z: -1350 },
  { id: 'river', x: 360, z: 0 },
  { id: 'sphere', x: 260, z: -630, altitude: 105 },
  { id: 'hills', x: 1700, z: 1600 },
  { id: 'village', x: -3000, z: 2500 },
  { id: 'east-village', x: 4200, z: 2600 },
  { id: 'north-city', x: 3400, z: -3700 },
  { id: 'ring', x: 1150, z: -1900, altitude: 190 },
  { id: 'monolith', x: -2900, z: -3400, altitude: 175 },
  { id: 'stairs', x: 2500, z: 2800, altitude: 90 },
  { id: 'white-plaza', x: -3800, z: -400 },
  { id: 'arcade', x: 0, z: 3700 },
  { id: 'spires', x: 4100, z: -1200 },
]);

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mound = (x, z, cx, cz, radius, amplitude) => {
  const q = Math.hypot(x - cx, z - cz) / radius;
  return q < 1 ? amplitude * Math.pow(1 - q * q, 2) : 0;
};
export function riverCenter(z) {
  return 360 + 205 * Math.sin(z / 730) + 85 * Math.sin(z / 1730);
}

// mask=1 is open water, 0 is dry ground, the interval between is a bank.
// Sampling this does not depend on loaded terrain tiles.
// Shape-only callers (terrain colours, road surveys and vegetation) do not
// need to resample the height field merely to discover the river's width.
export function riverShapeAt(x, z) {
  const center = riverCenter(z);
  const width = 37 + 13 * Math.sin(z / 490) + 8 * Math.sin(z / 1190);
  const distance = Math.abs(x - center);
  const mask = 1 - smooth(width * 0.82, width * 1.6, distance);
  return { center, width, distance, mask };
}

// The full sample retains depth below the fixed WATER_LEVEL surface.
export function riverAt(x, z) {
  return {
    ...riverShapeAt(x, z),
    depth: Math.max(0, WATER_LEVEL - heightAt(x, z)),
    surface: WATER_LEVEL,
  };
}

export function heightAt(x, z) {
  const limit = WORLD_SIZE / 2;
  x = clamp(x, -limit, limit);
  z = clamp(z, -limit, limit);
  let y = 12 + Math.sin(x / 370) * Math.cos(z / 610) * 6
    + Math.sin((x + z) / 950) * 8
    + Math.sin(x / 126) * Math.sin(z / 190) * 1.4;
  y += mound(x, z, 1650, 1550, 1900, 126);
  y += mound(x, z, -1850, 720, 1200, 70);
  y += mound(x, z, 1850, -2500, 1850, 98);
  y += mound(x, z, -3750, -3900, 1500, 122);
  y += mound(x, z, 4550, 4200, 1600, 100);
  y += mound(x, z, -3900, 3900, 1450, 85);
  for(const hill of EXTRA_HILLS)y+=mound(x,z,hill.x,hill.z,hill.radius,hill.height);

  // Roads and settlements are surveyed flat; their edges blend into the hills.
  const avenue = (1 - smooth(105, 235, Math.abs(x)))
    * (1 - smooth(410, 650, Math.abs(z + 170)));
  y += (10 - y) * avenue;
  for (const [cx, cz, radius, plateau] of [
    [-3000, 2500, 250, 22], [4200, 2600, 250, 28],
  ]) {
    const f = 1 - smooth(radius, radius + 180, Math.hypot(x - cx, z - cz));
    y += (plateau - y) * f;
  }
  for (const city of CITIES) {
    const outside = Math.max(Math.abs(x - city.x), Math.abs(z - city.z)) - cityHalf(city);
    const f = 1 - smooth(0, 160, outside);
    y += (city.ground - y) * f;
  }
  for(const t of TOWNS){const outside=Math.max(Math.abs(x-t.x)-t.width/2,Math.abs(z-t.z)-t.length/2);const f=1-smooth(0,110,outside);y+=(t.ground-y)*f;}
  const center = riverCenter(z);
  const width = 37 + 13 * Math.sin(z / 490) + 8 * Math.sin(z / 1190);
  const bed = 1 - smooth(width * 0.64, width * 1.9, Math.abs(x - center));
  y += (0.9 + 0.6 * Math.sin(z / 100) - y) * bed;
  return y;
}

export function randomFor(a, b = 0, c = 0) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
