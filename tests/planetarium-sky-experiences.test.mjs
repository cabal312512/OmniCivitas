import { describe, expect, it } from "vitest";
import {
  SIDEREAL_DEGREES_PER_HOUR,
  METEOR_PRESETS,
  normalizeSkyExperience,
  exposureAngle,
  advanceExposure,
  eclipseContactEnvelope,
} from "../config/apps/portal/src/planetarium/sky-experience-math.mjs";

describe("sky experience geometry and controls", () => {
  it("uses sidereal sky rotation rather than a fixed decorative trail length", () => {
    expect(SIDEREAL_DEGREES_PER_HOUR).toBeCloseTo(15.041, 3);
    expect(exposureAngle(4) / exposureAngle(0.25)).toBe(16);
    expect(exposureAngle(2, 0.5)).toBe(exposureAngle(1));
    expect(exposureAngle(2, 1, -1)).toBe(-exposureAngle(2));
  });
  it("stops acquisition on pause and continues from the same exposure", () => {
    const partial = advanceExposure(0.35, 0.1, true);
    expect(partial).toBeGreaterThan(0.35);
    expect(advanceExposure(partial, 2, false)).toBe(partial);
    expect(advanceExposure(partial, 0.1, true)).toBeGreaterThan(partial);
    expect(advanceExposure(0.99, 0.1, true)).toBe(1);
  });
  it("bounds shader controls even for malformed restored state", () => {
    const result = normalizeSkyExperience({
      meteorRate: Infinity,
      trailExposure: -20,
      meteorPreset: "unknown",
    });
    expect(result.meteorRate).toBe(1.5);
    expect(result.trailExposure).toBe(0.25);
    expect(result.meteorPreset).toBe("perseids");
    expect(
      normalizeSkyExperience({ meteorRate: 100, trailExposure: 50 }),
    ).toMatchObject({ meteorRate: 3, trailExposure: 4 });
  });
  it("preserves independent toggles across unrelated control edits", () => {
    const current = normalizeSkyExperience({
      trailPlaying: false,
      trailColor: false,
      trailGlow: false,
    });
    expect(normalizeSkyExperience({ meteorRate: 2 }, current)).toMatchObject({
      trailPlaying: false,
      trailColor: false,
      trailGlow: false,
    });
    expect(Object.keys(METEOR_PRESETS)).toHaveLength(3);
  });
  it("only adds a contact cue near real internal tangency", () => {
    expect(eclipseContactEnvelope(0.033, 0.25, 0.28, 0.998)).toBeGreaterThan(
      0.5,
    );
    expect(eclipseContactEnvelope(0, 0.25, 0.28, 1)).toBe(0);
    expect(eclipseContactEnvelope(0.3, 0.25, 0.28, 0.3)).toBe(0);
    expect(eclipseContactEnvelope(0.01, 0.28, 0.25, 0.98)).toBe(0);
  });
});
