import { describe, expect, it } from "vitest";
import {
  eclipseModelPhase,
  moonCyclePhase,
  phaseIllumination,
  phaseThumbnailPath,
  wrapPhase,
} from "../config/apps/portal/src/planetarium/experience-math.mjs";

describe("illustrative lunar and eclipse model geometry", () => {
  it("wraps phases in both directions and handles nonfinite inputs", () => {
    expect(wrapPhase(-0.25)).toBe(0.75);
    expect(wrapPhase(4.25)).toBe(0.25);
    expect(wrapPhase(1)).toBe(0);
    expect(wrapPhase(NaN)).toBe(0);
    expect(wrapPhase(Infinity)).toBe(0);
  });

  it("uses the projected illumination fraction for new, quarter and full Moon", () => {
    for (const [phase, expected] of [
      [0, 0],
      [0.25, 0.5],
      [0.5, 1],
      [0.75, 0.5],
      [1, 0],
    ])
      expect(phaseIllumination(phase)).toBeCloseTo(expected, 12);
    expect(phaseIllumination(0.125)).toBeCloseTo((1 - Math.SQRT1_2) / 2, 12);
    expect(phaseIllumination(0.875)).toBeCloseTo(phaseIllumination(0.125), 12);
  });

  it("draws an empty new Moon and a closed full disc", () => {
    expect(phaseThumbnailPath(0)).toBe("");
    expect(phaseThumbnailPath(1)).toBe("");
    expect(phaseThumbnailPath(0.5)).toBe(
      "M 12 2 A 10 10 0 0 1 12 22 A 10 10 0 0 1 12 2 Z",
    );
    expect(phaseThumbnailPath(-0.5)).toBe(phaseThumbnailPath(0.5));
  });

  it("places quarter illumination on the correct side with a straight terminator", () => {
    expect(phaseThumbnailPath(0.25)).toBe(
      "M 12 2 A 10 10 0 0 1 12 22 L 12 2 Z",
    );
    expect(phaseThumbnailPath(0.75)).toBe(
      "M 12 2 A 10 10 0 0 0 12 22 L 12 2 Z",
    );
  });

  it("curves crescent and gibbous terminators on opposite sides", () => {
    const waxingCrescent = phaseThumbnailPath(0.125);
    const waxingGibbous = phaseThumbnailPath(0.375);
    const waningGibbous = phaseThumbnailPath(0.625);
    const waningCrescent = phaseThumbnailPath(0.875);
    expect(waxingCrescent).toContain(
      "A 10 10 0 0 1 12 22 A 7.0711 10 0 0 0 12 2",
    );
    expect(waxingGibbous).toContain(
      "A 10 10 0 0 1 12 22 A 7.0711 10 0 0 1 12 2",
    );
    expect(waningGibbous).toContain(
      "A 10 10 0 0 0 12 22 A 7.0711 10 0 0 0 12 2",
    );
    expect(waningCrescent).toContain(
      "A 10 10 0 0 0 12 22 A 7.0711 10 0 0 1 12 2",
    );
  });

  it("keeps thumbnail paths finite, bounded and compact for all phases", () => {
    for (let index = 0; index <= 200; index += 1) {
      const path = phaseThumbnailPath(index / 200, 14, 18);
      expect(path.length).toBeLessThan(125);
      expect(path).not.toMatch(/NaN|Infinity/);
      if (path) expect(path.endsWith(" Z")).toBe(true);
    }
    expect(phaseThumbnailPath(0.25, 0)).toBe("");
    expect(phaseThumbnailPath(0.25, Infinity)).toBe("");
    expect(phaseThumbnailPath(0.25, 100000, 0)).toContain("A 10000 10000");
  });

  it("advances a continuous 90-second illustrative cycle and supports reverse elapsed", () => {
    expect(moonCyclePhase(0.2, 0)).toBeCloseTo(0.2, 12);
    expect(moonCyclePhase(0.2, 22.5)).toBeCloseTo(0.45, 12);
    expect(moonCyclePhase(0.2, 90)).toBeCloseTo(0.2, 12);
    expect(moonCyclePhase(0.2, -22.5)).toBeCloseTo(0.95, 12);
    expect(moonCyclePhase(0, 15, { durationSeconds: 60 })).toBeCloseTo(
      0.25,
      12,
    );
    expect(moonCyclePhase(0, 22.5, { durationSeconds: 0 })).toBeCloseTo(
      0.25,
      12,
    );
    expect(moonCyclePhase(0.4, NaN)).toBeCloseTo(0.4, 12);
  });

  it("bounds illustrative eclipse sweeps around new/full phase", () => {
    expect(eclipseModelPhase(0, "solar")).toBe(0);
    expect(eclipseModelPhase(0, "lunar")).toBe(0.5);
    expect(eclipseModelPhase(-1, "solar")).toBeCloseTo(0.955, 12);
    expect(eclipseModelPhase(1, "solar")).toBeCloseTo(0.045, 12);
    expect(eclipseModelPhase(-1, "lunar")).toBeCloseTo(0.455, 12);
    expect(eclipseModelPhase(1, "lunar")).toBeCloseTo(0.545, 12);
    expect(eclipseModelPhase(90, "lunar")).toBe(eclipseModelPhase(1, "lunar"));
    expect(eclipseModelPhase(-90, "solar")).toBe(
      eclipseModelPhase(-1, "solar"),
    );
    expect(eclipseModelPhase(NaN, "solar")).toBe(0);
  });
});
