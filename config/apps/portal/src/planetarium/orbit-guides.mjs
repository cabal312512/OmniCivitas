import { CatmullRomCurve3, Vector3 } from "three";

/** Presentation interpolation only; never used for ephemeris or planet motion. */
export function orbitGuideSamples(samples, physical = false) {
  if (!Array.isArray(samples)) return null;
  const source = samples
    .slice(0, 65)
    .filter(
      (point) =>
        Array.isArray(point) &&
        point.length >= 3 &&
        point.slice(0, 3).every(Number.isFinite),
    );
  if (source.length < 3) return null;
  const points = source.map(([x, y, z]) => {
    const point = new Vector3(x, z, -y);
    const distance = point.length();
    return distance > 1e-12
      ? point.multiplyScalar(
          (physical ? distance * 14 : 6 + 17 * Math.log1p(distance)) / distance,
        )
      : point;
  });
  // Keep the real endpoints: approximate sidereal-period samples may have a
  // small precession gap and must not be forcibly closed into a perfect oval.
  const cabal312512OrbitSpline = new CatmullRomCurve3(
    points,
    false,
    "centripetal",
  );
  const smooth = cabal312512OrbitSpline.getPoints(
    Math.min(192, (points.length - 1) * 4),
  );
  const positions = smooth.flatMap((point) => point.toArray());
  const ticks = [];
  const normal = new Vector3();
  const tangent = new Vector3();
  const radial = new Vector3();
  const tickStep = Math.max(2, Math.ceil((points.length - 1) / 24));
  for (let i = tickStep; i < points.length - 1; i += tickStep) {
    tangent.subVectors(points[i + 1], points[i - 1]).normalize();
    radial.copy(points[i]).normalize();
    normal.crossVectors(tangent, radial).normalize();
    radial.crossVectors(normal, tangent).normalize();
    if (radial.lengthSq() < 0.5) continue;
    const length = Math.max(0.035, Math.min(0.24, points[i].length() * 0.0028));
    const start = points[i].clone().addScaledVector(radial, -length * 0.38);
    const end = points[i].clone().addScaledVector(radial, length);
    ticks.push(...start.toArray(), ...end.toArray());
  }
  return { positions, ticks, sourceCount: points.length };
}
