import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SkyScene } from "../config/apps/portal/src/planetarium/sky-scene.mjs";
import {
  automaticSkyDetail,
  galaxyZoomVisibility,
  starZoomScale,
} from "../config/apps/portal/src/planetarium/sky-display.mjs";

// Three belongs to the portal workspace. Resolve its ESM build from that
// package so the spy sees the same loader class as the renderer imports.
const portalRequire = createRequire(
  new URL("../config/apps/portal/package.json", import.meta.url),
);
const THREE = await import(
  pathToFileURL(
    join(dirname(portalRequire.resolve("three")), "three.module.js"),
  ).href
);

afterEach(() => vi.restoreAllMocks());

function skyHarness() {
  const base = { image: { width: 4096, height: 2048 } };
  const high = { image: { width: 8192, height: 4096 }, dispose: vi.fn() };
  const sky = Object.create(SkyScene.prototype);
  Object.assign(sky, {
    ready: Promise.resolve(),
    quality: "balanced",
    automaticDetail: false,
    detailBlend: 1,
    detailTarget: 1,
    detailLoadFailed: false,
    disposed: false,
    tracking: true,
    options: { eclipse: false },
    baseGalaxyTexture: base,
    renderer: {
      capabilities: { maxTextureSize: 8192, getMaxAnisotropy: () => 8 },
      domElement: { dataset: {} },
    },
    galaxy: {
      material: {
        uniforms: {
          map: { value: base },
          radianceScale: { value: 1 },
          detailBlend: { value: 1 },
        },
      },
    },
  });
  return { sky, base, high };
}

describe("planetarium zoom continuity", () => {
  it("keeps panorama content at every ordinary zoom level", () => {
    for (const fov of [0.7, 2, 5, 7, 15, 32, 56, 100])
      expect(galaxyZoomVisibility(fov)).toBeGreaterThanOrEqual(0.22);
    for (const boundary of [2, 7, 15, 32])
      expect(
        Math.abs(
          galaxyZoomVisibility(boundary - 0.01) -
            galaxyZoomVisibility(boundary + 0.01),
        ),
      ).toBeLessThan(0.003);
  });

  it("bounds star sizes while retaining a gentle close-zoom response", () => {
    expect(starZoomScale(56)).toBe(1);
    expect(starZoomScale(0.7)).toBe(1.45);
    expect(starZoomScale(20)).toBeGreaterThan(1);
    expect(starZoomScale(20)).toBeLessThan(1.45);
  });

  it("uses hysteresis and prevents automatic detail loading in eclipses or solar mode", () => {
    expect(automaticSkyDetail(34, false, true, false)).toBe(true);
    expect(automaticSkyDetail(40, false, true, false)).toBe(false);
    expect(automaticSkyDetail(40, true, true, false)).toBe(true);
    expect(automaticSkyDetail(46, true, true, false)).toBe(false);
    expect(automaticSkyDetail(2, true, true, true)).toBe(false);
    expect(automaticSkyDetail(2, true, false, false)).toBe(false);
  });

  it("does not fetch an automatic high-resolution panorama behind a Moon close-up", () => {
    const { sky } = skyHarness();
    sky.options.closeup = true;
    const load = vi.spyOn(THREE.TextureLoader.prototype, "loadAsync");
    sky.updateGalaxyDetail(1.7, 0.016);
    expect(load).not.toHaveBeenCalled();
    expect(sky.automaticDetail).toBe(false);
  });

  it("loads detail only on close zoom, crossfades and releases it on wide zoom", async () => {
    const { sky, base, high } = skyHarness();
    const load = vi
      .spyOn(THREE.TextureLoader.prototype, "loadAsync")
      .mockResolvedValue(high);
    sky.updateGalaxyDetail(56, 0.016);
    expect(load).not.toHaveBeenCalled();
    sky.updateGalaxyDetail(25, 0.016);
    sky.updateGalaxyDetail(25, 0.016);
    await sky.highTexturePromise;
    expect(load).toHaveBeenCalledTimes(1);
    expect(sky.galaxy.material.uniforms.map.value).toBe(high);
    expect(sky.detailBlend).toBe(0);
    sky.updateGalaxyDetail(25, 0.08);
    expect(sky.detailBlend).toBeGreaterThan(0);
    expect(sky.detailBlend).toBeLessThan(1);
    for (let i = 0; i < 3; i++) sky.updateGalaxyDetail(56, 0.5);
    expect(high.dispose).toHaveBeenCalledTimes(1);
    expect(sky.galaxy.material.uniforms.map.value).toBe(base);
    expect(sky.renderer.domElement.dataset.skyResolution).toBe("4096");
  });

  it("disposes a late detail result if the user already zoomed out", async () => {
    const { sky, base, high } = skyHarness();
    let resolve;
    vi.spyOn(THREE.TextureLoader.prototype, "loadAsync").mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    sky.updateGalaxyDetail(25, 0.016);
    const pending = sky.highTexturePromise;
    sky.updateGalaxyDetail(56, 0.016);
    resolve(high);
    await pending;
    expect(high.dispose).toHaveBeenCalledTimes(1);
    expect(sky.galaxy.material.uniforms.map.value).toBe(base);
  });

  it("keeps the existing panorama after an optional failure without retrying every frame", async () => {
    const { sky, base } = skyHarness();
    const load = vi
      .spyOn(THREE.TextureLoader.prototype, "loadAsync")
      .mockRejectedValue(new Error("offline"));
    sky.updateGalaxyDetail(20, 0.016);
    await expect(sky.highTexturePromise).rejects.toThrow("offline");
    for (let i = 0; i < 60; i++) sky.updateGalaxyDetail(20, 0.016);
    expect(load).toHaveBeenCalledTimes(1);
    expect(sky.galaxy.material.uniforms.map.value).toBe(base);
  });

  it("keeps an explicitly selected High map independently of automatic zoom thresholds", async () => {
    const { sky, high } = skyHarness();
    vi.spyOn(THREE.TextureLoader.prototype, "loadAsync").mockResolvedValue(
      high,
    );
    await sky.setQuality("high");
    sky.tracking = false;
    for (let i = 0; i < 4; i++) sky.updateGalaxyDetail(70, 0.5);
    expect(sky.galaxy.material.uniforms.map.value).toBe(high);
    expect(high.dispose).not.toHaveBeenCalled();
  });
});
