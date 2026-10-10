import { describe, expect, it } from "vitest";
import { orbitGuideSamples } from "../config/apps/portal/src/planetarium/orbit-guides.mjs";
import { SolarScene } from "../config/apps/portal/src/planetarium/solar-scene.mjs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const portalRequire = createRequire(
  new URL("../config/apps/portal/package.json", import.meta.url),
);
const THREE = await import(
  pathToFileURL(
    join(dirname(portalRequire.resolve("three")), "three.module.js"),
  ).href
);

const samples = Array.from({ length: 49 }, (_, i) => {
  const angle = (i / 48) * Math.PI * 2;
  return [Math.cos(angle), Math.sin(angle), Math.sin(angle) * 0.15];
});

describe("bounded cached orbital presentation", () => {
  it("smooths a sparse guide while preserving actual endpoints and source inputs", () => {
    const original = structuredClone(samples);
    const guide = orbitGuideSamples(samples, true);
    expect(guide.sourceCount).toBe(49);
    expect(guide.positions).toHaveLength(193 * 3);
    guide.positions
      .slice(0, 3)
      .forEach((value, i) => expect(value).toBeCloseTo([14, 0, 0][i], 10));
    const endpoint = samples.at(-1);
    const actualEnd = guide.positions.slice(-3);
    actualEnd.forEach((value, i) =>
      expect(value).toBeCloseTo(
        [endpoint[0] * 14, endpoint[2] * 14, -endpoint[1] * 14][i],
        10,
      ),
    );
    expect(samples).toEqual(original);
  });

  it("preserves a real nonclosing sidereal-period endpoint instead of forcing an oval", () => {
    const open = [
      [1, 0, 0],
      [0, 1, 0],
      [-1, 0, 0],
      [1, 0.06, 0.01],
    ];
    const guide = orbitGuideSamples(open, true);
    guide.positions
      .slice(-3)
      .forEach((value, i) =>
        expect(value).toBeCloseTo([14, 0.14, -0.84][i], 10),
      );
    expect(guide.positions.slice(-3)).not.toEqual(guide.positions.slice(0, 3));
  });

  it("applies the same documented display-distance compression to both endpoints", () => {
    const guide = orbitGuideSamples([
      [1, 0, 0],
      [0, 2, 0],
      [-3, 0, 0],
    ]);
    expect(guide.positions[0]).toBeCloseTo(6 + 17 * Math.log1p(1), 10);
    expect(guide.positions.at(-3)).toBeCloseTo(-(6 + 17 * Math.log1p(3)), 10);
  });

  it("keeps tick and GPU vertex counts bounded even for oversized or malformed source arrays", () => {
    const source = Array.from({ length: 8000 }, (_, i) => [
      Math.cos(i * 0.03),
      Math.sin(i * 0.03),
      0.1,
    ]);
    const guide = orbitGuideSamples(source);
    expect(guide.sourceCount).toBe(65);
    expect(guide.positions.length).toBeLessThanOrEqual(193 * 3);
    expect(guide.ticks.length).toBeLessThanOrEqual(24 * 6);
    expect([...guide.positions, ...guide.ticks].every(Number.isFinite)).toBe(
      true,
    );
    expect(orbitGuideSamples([[NaN, 1, 2], null, [1, 2]])).toBeNull();
  });

  it("follows the actual rendered planet position rather than inventing marker motion", () => {
    const solar = new SolarScene(new THREE.Scene(), {
      renderer: { getSize: (target) => target.set(1280, 800) },
    });
    solar.setOptions({ orbits: true, orbitPaths: { earth: samples } });
    solar.root.visible = true;
    const earth = solar.bodies.get("earth");
    earth.positioned = earth.positionGroup.visible = true;
    earth.positionGroup.position.set(9.2, 2.1, -13.8);
    const camera = new THREE.PerspectiveCamera(45, 1.6, 0.1, 1000);
    camera.position.set(3, 12, 40);
    camera.lookAt(0, 0, 0);
    solar._updateOrbitAccents(camera);
    const marker = solar.orbits.get("earth").userData.marker;
    expect(marker.position.equals(earth.positionGroup.position)).toBe(true);
    expect(marker.quaternion.equals(camera.quaternion)).toBe(true);
    expect(marker.visible).toBe(true);
    earth.positionGroup.position.x += 0.3;
    solar._updateOrbitAccents(camera);
    expect(marker.position.x).toBe(9.5);
    solar.dispose();
  });

  it("disposes shared line geometry once on rebuild while preserving the shared marker mesh until final disposal", () => {
    const scene = new THREE.Scene();
    const solar = new SolarScene(scene);
    solar.setOptions({ orbits: true, orbitPaths: { earth: samples } });
    const lines = solar.orbits
      .get("earth")
      .children.filter((object) => object.isLine2);
    expect(lines).toHaveLength(2);
    expect(lines[0].geometry).toBe(lines[1].geometry);
    let lineDisposals = 0,
      markerDisposals = 0;
    lines[0].geometry.addEventListener("dispose", () => lineDisposals++);
    solar._orbitMarkerGeometry.addEventListener(
      "dispose",
      () => markerDisposals++,
    );
    solar.setOptions({ orbitPaths: { mars: samples } });
    expect(lineDisposals).toBe(1);
    expect(markerDisposals).toBe(0);
    expect(solar.orbits.has("earth")).toBe(false);
    solar.dispose();
    expect(markerDisposals).toBe(1);
    expect(scene.children).toHaveLength(0);
  });
});
