/** A bounded ephemeris curve, evaluated without calling the astronomy engine. */
export const DAY_MS = 86_400_000;
export const SIDEREAL_RADIANS_PER_MS =
  (360.98564736629 * Math.PI) / 180 / DAY_MS;
export const SKY_VISUAL_RADIANS_PER_SECOND = Math.PI * 2 * 0.08;
export const SPIN_VISUAL_RADIANS_PER_SECOND = Math.PI * 2 * 0.15;

/** Cubic Hermite interpolation. Engine velocities are AU per millisecond. */
export function trajectoryPosition(track, timeMs, output = [0, 0, 0]) {
  const points = track?.positions;
  if (!points?.length || !Number.isFinite(timeMs)) return null;
  const coordinate = (timeMs - track.startTimeMs) / track.stepMs;
  const index = Math.max(
    0,
    Math.min(points.length - 2, Math.floor(coordinate)),
  );
  const u = Math.max(0, Math.min(1, coordinate - index));
  const a = points[index],
    b = points[index + 1] || a;
  const u2 = u * u,
    u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1,
    h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2,
    h11 = u3 - u2;
  const previous = points[Math.max(0, index - 1)];
  const next = points[Math.min(points.length - 1, index + 2)];
  for (let axis = 0; axis < 3; axis += 1) {
    const va = track.velocities?.[index]?.[axis] * track.stepMs;
    const vb = track.velocities?.[index + 1]?.[axis] * track.stepMs;
    const tangentA = Number.isFinite(va)
      ? va
      : (b[axis] - previous[axis]) / (index ? 2 : 1);
    const tangentB = Number.isFinite(vb)
      ? vb
      : (next[axis] - a[axis]) / (index + 2 < points.length ? 2 : 1);
    output[axis] =
      h00 * a[axis] + h10 * tangentA + h01 * b[axis] + h11 * tangentB;
  }
  return output;
}

/** Limit only visible spin, never the simulation clock or an orbit position. */
export function readableAngularStep(physicalStep, elapsedSeconds, limit) {
  const cabal312512AngularBudget = Math.max(0, elapsedSeconds) * limit;
  return Math.max(
    -cabal312512AngularBudget,
    Math.min(cabal312512AngularBudget, physicalStep),
  );
}

/** Reverse-safe, wrap-safe correction used when playback stops or is scrubbed. */
export function wrappedPhaseCorrection(
  current,
  target,
  elapsedSeconds,
  settlingSeconds = 0.28,
) {
  return (
    Math.atan2(Math.sin(target - current), Math.cos(target - current)) *
    (1 - Math.exp(-Math.max(0, elapsedSeconds) / settlingSeconds))
  );
}

export function isContinuousPlayback(deltaMs, elapsedSeconds, playing, speed) {
  if (!playing || !Number.isFinite(deltaMs) || !Number.isFinite(speed))
    return false;
  const expected = elapsedSeconds * speed * 1000;
  return (
    Math.abs(deltaMs - expected) <= Math.max(2000, Math.abs(expected) * 0.35)
  );
}
