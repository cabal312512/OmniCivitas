import * as THREE from "three";

const D2R = Math.PI / 180;
const ARC_STEP = 1.5 * D2R;

export function equatorialVector(ra, dec) {
  const longitude = ra * D2R,
    latitude = dec * D2R;
  return new THREE.Vector3(
    Math.cos(latitude) * Math.cos(longitude),
    Math.sin(latitude),
    -Math.cos(latitude) * Math.sin(longitude),
  );
}

// Constellation lines follow the celestial sphere. The same cached arcs serve
// both rendering and picking, including figures that cross RA zero or a pole.
export function constellationGeometry(figure, radius) {
  const positions = [],
    nodes = [],
    segments = [],
    unique = new Set();
  const center = new THREE.Vector3();
  for (const line of figure.lines) {
    for (const coordinate of line) {
      const key = coordinate.join(",");
      if (unique.has(key)) continue;
      unique.add(key);
      const direction = equatorialVector(...coordinate);
      nodes.push(...direction.clone().multiplyScalar(radius).toArray());
      center.add(direction);
    }
    for (let i = 1; i < line.length; i++) {
      const a = equatorialVector(...line[i - 1]);
      const b = equatorialVector(...line[i]);
      const normal = new THREE.Vector3().crossVectors(a, b);
      const angle = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
      const steps = Math.max(1, Math.ceil(angle / ARC_STEP));
      if (normal.lengthSq() < 1e-16) continue;
      normal.normalize();
      segments.push({ a, b, normal });
      let previous = a.clone();
      for (let step = 1; step <= steps; step++) {
        const point = a.clone().applyAxisAngle(normal, (angle * step) / steps);
        positions.push(
          ...previous.clone().multiplyScalar(radius).toArray(),
          ...point.clone().multiplyScalar(radius).toArray(),
        );
        previous = point;
      }
    }
  }
  if (center.lengthSq() < 1e-12)
    center.copy(equatorialVector(...figure.center));
  return { figure, positions, nodes, segments, center: center.normalize() };
}

export function distanceToConstellationArc(direction, segment) {
  const { a, b, normal } = segment;
  const planeOffset = direction.dot(normal);
  const inverseLength = 1 / Math.sqrt(Math.max(1e-16, 1 - planeOffset ** 2));
  const x = (direction.x - normal.x * planeOffset) * inverseLength;
  const y = (direction.y - normal.y * planeOffset) * inverseLength;
  const z = (direction.z - normal.z * planeOffset) * inverseLength;
  const fromA =
    normal.x * (a.y * z - a.z * y) +
    normal.y * (a.z * x - a.x * z) +
    normal.z * (a.x * y - a.y * x);
  const toB =
    normal.x * (y * b.z - z * b.y) +
    normal.y * (z * b.x - x * b.z) +
    normal.z * (x * b.y - y * b.x);
  if (fromA >= -1e-8 && toB >= -1e-8)
    return Math.asin(Math.min(1, Math.abs(planeOffset)));
  return Math.acos(
    THREE.MathUtils.clamp(Math.max(direction.dot(a), direction.dot(b)), -1, 1),
  );
}

export function nearestConstellation(direction, figures, tolerance) {
  let closest = null,
    distance = tolerance;
  for (const row of figures) {
    for (const segment of row.segments) {
      const candidate = distanceToConstellationArc(direction, segment);
      if (candidate < distance) {
        distance = candidate;
        closest = row.figure;
      }
    }
  }
  return closest;
}
