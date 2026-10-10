import { describe, expect, it } from "vitest";
import {
  constellationGeometry,
  distanceToConstellationArc,
  equatorialVector,
  nearestConstellation,
} from "../config/apps/portal/src/planetarium/constellation-geometry.mjs";

const degrees = Math.PI / 180;
const figure = (id, lines, center = [180, -70]) => ({ id, lines, center });

describe("celestial constellation geometry and picking", () => {
  it("picks the actual line even when the catalogue label center is far away", () => {
    const row = constellationGeometry(
      figure("line", [
        [
          [10, 20],
          [30, 20],
        ],
      ]),
      700,
    );
    const direction = row.segments[0].a
      .clone()
      .add(row.segments[0].b)
      .normalize();
    expect(nearestConstellation(direction, [row], 0.2 * degrees)?.id).toBe(
      "line",
    );
  });

  it("follows the short spherical arc across right-ascension zero", () => {
    const row = constellationGeometry(
      figure("seam", [
        [
          [359, 0],
          [1, 0],
        ],
      ]),
      700,
    );
    expect(
      distanceToConstellationArc(equatorialVector(0, 0), row.segments[0]),
    ).toBeLessThan(1e-8);
    expect(
      nearestConstellation(equatorialVector(180, 0), [row], degrees),
    ).toBeNull();
  });

  it("does not extend the pickable line past its endpoints", () => {
    const row = constellationGeometry(
      figure("finite", [
        [
          [10, 0],
          [20, 0],
        ],
      ]),
      700,
    );
    expect(
      distanceToConstellationArc(equatorialVector(24, 0), row.segments[0]),
    ).toBeCloseTo(4 * degrees, 10);
    expect(
      nearestConstellation(equatorialVector(24, 0), [row], 3 * degrees),
    ).toBeNull();
    expect(
      nearestConstellation(equatorialVector(20.5, 0), [row], degrees)?.id,
    ).toBe("finite");
  });

  it("keeps vertices on the sphere and handles a polar figure", () => {
    const row = constellationGeometry(
      figure("pole", [
        [
          [350, 86],
          [40, 88],
          [140, 89],
        ],
      ]),
      700,
    );
    expect(row.positions.length).toBeGreaterThan(12);
    for (let i = 0; i < row.positions.length; i += 3)
      expect(Math.hypot(...row.positions.slice(i, i + 3))).toBeCloseTo(700, 6);
    const mid = row.segments[0].a.clone().add(row.segments[0].b).normalize();
    expect(nearestConstellation(mid, [row], 0.2 * degrees)?.id).toBe("pole");
  });

  it("uses a geometry-derived anchor and deduplicates connected star nodes", () => {
    const row = constellationGeometry(
      figure("nodes", [
        [
          [10, 20],
          [20, 20],
          [30, 20],
        ],
        [
          [20, 20],
          [20, 30],
        ],
      ]),
      700,
    );
    expect(row.nodes.length).toBe(12);
    expect(row.center.dot(equatorialVector(20, 23))).toBeGreaterThan(0.999);
  });
});
