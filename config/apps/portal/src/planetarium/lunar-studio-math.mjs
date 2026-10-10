const TAU = Math.PI * 2;

export function normalizedPhase(value = 0) {
  return Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0;
}

/** Circular, scale-compressed teaching model: phase 0 new, 0.5 full. */
export function lunarModel(phase, { radius = 8.5, inclination = 5.145 } = {}) {
  const fraction = normalizedPhase(phase);
  const angle = fraction * TAU;
  const tilt = (inclination * Math.PI) / 180;
  return {
    phase: fraction,
    illumination: (1 - Math.cos(angle)) / 2,
    position: [
      Math.cos(angle) * radius,
      tilt === 0 ? 0 : -Math.sin(angle) * Math.sin(tilt) * radius,
      -Math.sin(angle) * Math.cos(tilt) * radius,
    ],
  };
}

/** Unwrapped nearest phase prevents discontinuities at the cycle's seam. */
export function continuousPhase(current, requested) {
  const target = normalizedPhase(requested);
  return (
    current + (((((target - normalizedPhase(current)) % 1) + 1.5) % 1) - 0.5)
  );
}

/** Finite luminous-disk geometry, not an eclipse calendar or prediction. */
export function shadowProfile({
  radius,
  sunRadius = 2.4,
  sunDistance = 160,
  length = 17,
}) {
  if (
    ![radius, sunRadius, sunDistance, length].every(Number.isFinite) ||
    radius <= 0 ||
    sunRadius <= radius ||
    sunDistance <= 0 ||
    length <= 0
  )
    throw new RangeError("Invalid scale-compressed shadow geometry");
  const umbraSlope = (sunRadius - radius) / sunDistance;
  const penumbraSlope = (sunRadius + radius) / sunDistance;
  return {
    radius,
    length,
    umbraSlope,
    penumbraSlope,
    umbraLength: radius / umbraSlope,
    umbraEndRadius: Math.max(0, radius - umbraSlope * length),
    penumbraEndRadius: radius + penumbraSlope * length,
  };
}

/** Coverage of a point in the shadow of an object illuminated from local +X. */
export function shadowCoverage(target, occultant, profile) {
  const distance = occultant[0] - target[0];
  if (distance <= 0) return 0;
  const radial = Math.hypot(target[1] - occultant[1], target[2] - occultant[2]);
  const umbra = Math.max(0, profile.radius - profile.umbraSlope * distance);
  const penumbra = profile.radius + profile.penumbraSlope * distance;
  const fraction = Math.max(
    0,
    Math.min(1, (radial - umbra) / Math.max(1e-12, penumbra - umbra)),
  );
  return 1 - fraction * fraction * (3 - 2 * fraction);
}
