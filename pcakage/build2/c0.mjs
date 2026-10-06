// Shared surveyed settlement data. Metres, independent of the host machine.
export const CITIES = Object.freeze([
  { id: 'city', x: -850, z: -1350, n: 12, spacing: 112, ground: 12, seed: 17, style: 'glass' },
  { id: 'north-city', x: 3400, z: -3700, n: 10, spacing: 114, ground: 15, seed: 39, style: 'office' },
  { id: 'white-plaza', x: -3800, z: -400, n: 8, spacing: 112, ground: 18, seed: 61, style: 'plaza', clearing: 154 },
  { id: 'arcade', x: 0, z: 3700, n: 10, spacing: 104, ground: 14, seed: 81, style: 'arcade', clearing: 176 },
  { id: 'spires', x: 4100, z: -1200, n: 10, spacing: 116, ground: 25, seed: 91, style: 'spires' },
  { id: 'terrace-city', x: -4150, z: 1350, n: 9, spacing: 118, ground: 50, seed: 111, style: 'terrace', clearing: 128 },
  { id: 'lagoon-city', x: 2600, z: 800, n: 10, spacing: 122, ground: 32, seed: 141, style: 'lagoon', clearing: 142 },
  { id: 'horizon-city', x: -2400, z: 4350, n: 10, spacing: 144, ground: 34, seed: 161, style: 'horizon', clearing: 128 },
  { id: 'capital', x: -4300, z: -4500, n: 16, spacing: 172, ground: 55, seed: 191, style: 'capital', clearing: 530 },
].map(city => Object.freeze({ ...city, footprint: city.n * city.spacing + 60 })));

export const CAPITAL = CITIES.find(city => city.id === 'capital');
export const cityHalf = city => city.footprint / 2;
const capitalPoint = (x, z) => [CAPITAL.x + x, CAPITAL.z + z];
const route = (id, from, to, points, width = 28) => Object.freeze({ id, from, to, width, points: Object.freeze(points.map(([x, z]) => Object.freeze({ x, z }))) });
// Wide pale roads form one connected graph, with surveyed detours around the
// earlier meadow objects. The first 22 portals do not depend on these routes.
export const ROAD_ROUTES = Object.freeze([
  route('r01', 'avenue', 'city', [[0, -450], [0, -720], [-600, -900], [-850, -1350]]),
  route('r02', 'city', 'capital', [[-850, -1350], [-1000, -2450], [-2500, -2600], capitalPoint(500, 1900), capitalPoint(0, 1050), capitalPoint(0, 660)], 36),
  route('r03', 'capital', 'north-city', [capitalPoint(0, 660), capitalPoint(1200, 900), capitalPoint(1500, 900), [-300, -3450], [1900, -3450], [3400, -3700]], 36),
  route('r04', 'capital', 'white-plaza', [capitalPoint(0, 660), capitalPoint(-1350, 1300), capitalPoint(-1550, 1300 + 200 * 1200 / 650), [-5770, -2300], [-4900, -1950], [-3500, -1850], [-3670, -400]], 36),
  route('r05', 'city', 'white-plaza', [[-850, -1350], [-2500, -1350], [-3670, -400]]),
  route('r06', 'white-plaza', 'terrace-city', [[-3670, -400], [-4150, 1350]]),
  route('r07', 'terrace-city', 'village', [[-4150, 1350], [-3300, 2080], [-3000, 2170], [-3000, 2500]]),
  route('r08', 'village', 'horizon-city', [[-3000, 2500], [-3000, 2840], [-2950, 3500], [-2400, 4350]]),
  route('r09', 'horizon-city', 'arcade', [[-2400, 4350], [-1250, 3700], [0, 3700]]),
  route('r10', 'city', 'lagoon-city', [[-850, -1350], [50, -1200], [950, 500], [1600, 800], [2600, 800]]),
  route('r11', 'lagoon-city', 'spires', [[2600, 800], [3200, 300], [4100, -1200]]),
  route('r12', 'spires', 'north-city', [[4100, -1200], [3900, -2650], [3400, -3700]]),
  route('r13', 'lagoon-city', 'east-village', [[2600, 800], [3000, 1800], [4200, 2240], [4200, 2600]]),
  route('r14', 'east-village', 'arcade', [[4200, 2600], [4200, 2970], [3150, 3200], [1100, 3300], [0, 3700]]),
  route('r15', 'arcade', 'lagoon-city', [[0, 3700], [1250, 2350], [2600, 800]]),
]);

export function routeDistanceTo(x, z, roads = ROAD_ROUTES) {
  let distance = Infinity;
  for (const road of roads) for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1], b = road.points[i], dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    distance = Math.min(distance, Math.hypot(x - a.x - t * dx, z - a.z - t * dz) - road.width / 2);
  }
  return distance;
}
