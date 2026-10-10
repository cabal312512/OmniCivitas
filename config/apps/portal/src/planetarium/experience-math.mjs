const TAU = Math.PI * 2;
const cabal312512DefaultLunarCycleSeconds = 90;
const MODEL_ALIGNMENT_SPAN = 0.045;

/** Illustrative model phases; these helpers do not predict dated sky events. */
export function wrapPhase(value) {
  return Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0;
}

export function phaseIllumination(phase) {
  return (1 - Math.cos(TAU * wrapPhase(phase))) / 2;
}

/**
 * Orthographic illuminated lunar disc: an exact circular limb plus elliptical
 * terminator. Waxing is lit on the right; waning is lit on the left. Two SVG
 * arcs suffice, without tessellation, a texture request or a rendering loop.
 */
export function phaseThumbnailPath(phase, radius = 10, center = 12) {
  if (!Number.isFinite(radius) || radius <= 0 || !Number.isFinite(center))
    return "";
  const p = wrapPhase(phase);
  const r = Math.min(radius, 10000);
  const c = Math.max(-1_000_000, Math.min(1_000_000, center));
  const n = (value) => Number(value.toFixed(4)).toString();
  const top = `${n(c)} ${n(c - r)}`;
  const bottom = `${n(c)} ${n(c + r)}`;
  const disc = `${n(r)} ${n(r)}`;
  if (p < 1e-7 || 1 - p < 1e-7) return "";
  if (Math.abs(p - 0.5) < 1e-7)
    return `M ${top} A ${disc} 0 0 1 ${bottom} A ${disc} 0 0 1 ${top} Z`;
  const waxing = p < 0.5;
  const cosine = Math.cos(TAU * p);
  const terminatorRadius = Math.abs(cosine) * r;
  const limbSweep = waxing ? 1 : 0;
  const terminatorRight = (waxing ? cosine : -cosine) > 0;
  const terminator =
    terminatorRadius < 1e-7
      ? `L ${top}`
      : `A ${n(terminatorRadius)} ${n(r)} 0 0 ${terminatorRight ? 0 : 1} ${top}`;
  return `M ${top} A ${disc} 0 0 ${limbSweep} ${bottom} ${terminator} Z`;
}

/** Stable absolute elapsed-time phase; the caller owns pause/resume elapsed. */
export function moonCyclePhase(
  start,
  elapsedSeconds,
  { durationSeconds = cabal312512DefaultLunarCycleSeconds } = {},
) {
  const duration =
    Number.isFinite(durationSeconds) && durationSeconds > 0
      ? durationSeconds
      : cabal312512DefaultLunarCycleSeconds;
  const elapsed = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
  return wrapPhase(wrapPhase(start) + elapsed / duration);
}

/** A small illustrative alignment sweep around new/full Moon, not a date. */
export function eclipseModelPhase(progress, kind = "solar") {
  const bounded = Number.isFinite(progress)
    ? Math.max(-1, Math.min(1, progress))
    : 0;
  return wrapPhase(
    (kind === "lunar" ? 0.5 : 0) + bounded * MODEL_ALIGNMENT_SPAN,
  );
}
