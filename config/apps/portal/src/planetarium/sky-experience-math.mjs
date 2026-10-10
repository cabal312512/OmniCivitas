const degrees = Math.PI / 180;
const finite = (value, fallback) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, minimum, maximum) =>
  Math.min(maximum, Math.max(minimum, value));
const smoothstep = (value, low, high) => {
  const t = clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
};

export const SIDEREAL_DEGREES_PER_HOUR = 360 / 23.9344696;
export const METEOR_PRESETS = Object.freeze({
  perseids: Object.freeze({
    ra: 48,
    dec: 58,
    en: "Perseids",
    zh: "英仙座流星雨",
    warmth: 0.42,
  }),
  geminids: Object.freeze({
    ra: 112,
    dec: 33,
    en: "Geminids",
    zh: "双子座流星雨",
    warmth: 0.8,
  }),
  leonids: Object.freeze({
    ra: 152,
    dec: 22,
    en: "Leonids",
    zh: "狮子座流星雨",
    warmth: 0.22,
  }),
});

export function normalizeSkyExperience(input = {}, previous = {}) {
  const candidate = {
    meteorRate: 1.5,
    meteorPreset: "perseids",
    trailExposure: 2,
    trailPlaying: true,
    trailGlow: true,
    trailColor: true,
    ...previous,
    ...input,
  };
  return {
    meteorRate: clamp(finite(candidate.meteorRate, 1.5), 1, 3),
    meteorPreset: Object.hasOwn(METEOR_PRESETS, candidate.meteorPreset)
      ? candidate.meteorPreset
      : "perseids",
    trailExposure: clamp(finite(candidate.trailExposure, 2), 0.25, 4),
    trailPlaying: candidate.trailPlaying !== false,
    trailGlow: candidate.trailGlow !== false,
    trailColor: candidate.trailColor !== false,
  };
}

export function exposureAngle(hours, fill = 1, direction = 1) {
  return (
    clamp(finite(hours, 2), 0.25, 4) *
    SIDEREAL_DEGREES_PER_HOUR *
    degrees *
    clamp(finite(fill, 1), 0, 1) *
    (direction < 0 ? -1 : 1)
  );
}

export function advanceExposure(fill, seconds, playing) {
  return clamp(
    finite(fill, 0) + (playing ? clamp(finite(seconds, 0), 0, 0.15) / 8 : 0),
    0,
    1,
  );
}

export function meteorSeed(seed) {
  const value = Math.sin(seed * 78.233 + 19.19) * 43758.5453;
  return value - Math.floor(value);
}

export function eclipseContactEnvelope(
  separation,
  solarRadius,
  lunarRadius,
  obscuration,
) {
  if (!(solarRadius > 0 && lunarRadius > solarRadius && separation >= 0))
    return 0;
  const gap = (separation - (lunarRadius - solarRadius)) / solarRadius;
  return (
    smoothstep(gap, -0.003, 0.008) *
    (1 - smoothstep(gap, 0.028, 0.13)) *
    smoothstep(finite(obscuration, 0), 0.88, 0.98)
  );
}
