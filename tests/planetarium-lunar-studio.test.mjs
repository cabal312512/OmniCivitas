import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { LunarStudio } from "../config/apps/portal/src/planetarium/lunar-studio.mjs";
import {
  continuousPhase,
  lunarModel,
  normalizedPhase,
  shadowCoverage,
  shadowProfile,
} from "../config/apps/portal/src/planetarium/lunar-studio-math.mjs";

const portalRequire = createRequire(
  new URL("../config/apps/portal/package.json", import.meta.url),
);
const THREE = await import(
  pathToFileURL(
    join(dirname(portalRequire.resolve("three")), "three.module.js"),
  ).href
);

describe("illustrative lunar phase and shadow model", () => {
  it("keeps original Phong and Standard GLSL directives at line starts after illumination patches", () => {
    const studio = new LunarStudio(new THREE.Scene());
    for (const material of [
      studio.earthMaterial,
      studio.moon.material,
      studio.cloudMaterial,
    ]) {
      const directive = material.isMeshPhongMaterial ? "PHONG" : "STANDARD";
      const shader = {
        uniforms: {},
        vertexShader: `#define ${directive}\nvoid main(){\n#include <worldpos_vertex>\n}`,
        fragmentShader: `#define ${directive}\nvoid main(){\n#include <emissivemap_fragment>\n#include <opaque_fragment>\n}`,
      };
      material.onBeforeCompile(shader);
      for (const source of [shader.vertexShader, shader.fragmentShader]) {
        const directiveLines = source
          .split("\n")
          .filter((line) => line.includes("#"));
        expect(directiveLines.length).toBeGreaterThan(0);
        for (const line of directiveLines) expect(line).toMatch(/^\s*#/);
      }
      expect(shader.vertexShader).toContain(`\n#define ${directive}`);
      expect(shader.vertexShader).toContain("vStudioPoint=(modelMatrix");
      expect(shader.fragmentShader).toContain("float coverage=");
      expect(shader.uniforms.studioShadow).toBeDefined();
    }
    studio.dispose();
  });

  it("has the expected new, first quarter, full and last quarter illumination", () => {
    for (const [phase, fraction] of [
      [0, 0],
      [0.25, 0.5],
      [0.5, 1],
      [0.75, 0.5],
    ])
      expect(lunarModel(phase).illumination).toBeCloseTo(fraction, 12);
  });

  it("keeps a fixed orbit radius and a small physical inclination", () => {
    for (let index = 0; index <= 100; index++) {
      const model = lunarModel(index / 100);
      expect(Math.hypot(...model.position)).toBeCloseTo(8.5, 10);
      expect(Math.abs(model.position[1])).toBeLessThan(8.5 * 0.09);
      expect(model.illumination).toBeGreaterThanOrEqual(0);
      expect(model.illumination).toBeLessThanOrEqual(1);
    }
    expect(lunarModel(0.25, { inclination: 0 }).position[1]).toBe(0);
  });

  it("lights the right half while waxing and left half while waning in the actual Earthward camera pose", () => {
    const studio = new LunarStudio(new THREE.Scene());
    const camera = new THREE.PerspectiveCamera();
    const cameraRight = new THREE.Vector3();
    const sunlight = new THREE.Vector3(1, 0, 0);
    for (const [phase, sign] of [
      [0.25, 1],
      [0.75, -1],
    ]) {
      studio.setOptions({ phase });
      studio.update(0);
      const pose = studio.defaultPose("surface");
      camera.position.copy(pose.position);
      camera.lookAt(pose.target);
      cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
      expect(cameraRight.dot(sunlight) * sign).toBeGreaterThan(0.99);
    }
    studio.dispose();
  });

  it("keeps NASA's near-side texture meridian pointed at Earth across the inclined lunar orbit", () => {
    const studio = new LunarStudio(new THREE.Scene());
    const nearSide = new THREE.Vector3();
    const earthward = new THREE.Vector3();
    for (const mode of ["moon", "shadow"]) {
      studio.setMode(mode);
      for (const phase of [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]) {
        studio.setOptions({ phase });
        studio.update(0);
        nearSide.set(1, 0, 0).applyQuaternion(studio.moon.quaternion);
        earthward.copy(studio.moonGroup.position).negate().normalize();
        expect(nearSide.dot(earthward)).toBeGreaterThan(0.999999);
      }
    }
    const position = studio.moon.geometry.attributes.position;
    const uv = studio.moon.geometry.attributes.uv;
    const centerIndex = (128 / 2) * (192 + 1) + 192 / 2;
    expect(uv.getX(centerIndex)).toBeCloseTo(0.5, 10);
    expect(position.getX(centerIndex)).toBeGreaterThan(0.43);
    studio.dispose();
  });

  it("wraps cycles without teleports at the phase seam in either direction", () => {
    expect(continuousPhase(0.99, 0.01)).toBeCloseTo(1.01, 12);
    expect(continuousPhase(0.01, 0.99)).toBeCloseTo(-0.01, 12);
    expect(normalizedPhase(2.25)).toBe(0.25);
    expect(normalizedPhase(-0.25)).toBe(0.75);
    expect(normalizedPhase(NaN)).toBe(0);
  });

  it("puts the Moon's shadow on Earth at new moon and Earth's shadow on the Moon at full moon", () => {
    const lunarProfile = shadowProfile({ radius: 1.6, length: 19 });
    const solarProfile = shadowProfile({
      radius: 1.6 * 0.2727,
      sunDistance: 151.5,
      length: 15,
    });
    const origin = [0, 0, 0];
    const newMoon = lunarModel(0, { inclination: 0 }).position;
    const fullMoon = lunarModel(0.5, { inclination: 0 }).position;
    expect(shadowCoverage(origin, newMoon, solarProfile)).toBe(1);
    expect(shadowCoverage(origin, fullMoon, solarProfile)).toBe(0);
    expect(shadowCoverage(fullMoon, origin, lunarProfile)).toBe(1);
    expect(shadowCoverage(newMoon, origin, lunarProfile)).toBe(0);
    expect(
      shadowCoverage(
        lunarModel(0.25, { inclination: 0 }).position,
        origin,
        lunarProfile,
      ),
    ).toBe(0);
  });

  it("uses a finite penumbra transition and a tapering umbra rather than an opaque cylinder", () => {
    const profile = shadowProfile({ radius: 1.6, length: 19 });
    expect(profile.umbraEndRadius).toBeLessThan(profile.radius);
    expect(profile.penumbraEndRadius).toBeGreaterThan(profile.radius);
    const depth = 8;
    const inner = profile.radius - profile.umbraSlope * depth;
    const outer = profile.radius + profile.penumbraSlope * depth;
    expect(
      shadowCoverage([-depth, (inner + outer) / 2, 0], [0, 0, 0], profile),
    ).toBeCloseTo(0.5, 12);
    expect(() => shadowProfile({ radius: 0 })).toThrow(RangeError);
  });

  it("shares the existing scene, keeps dynamic surface/orbit poses separate and reuses pose outputs", () => {
    const scene = new THREE.Scene();
    const studio = new LunarStudio(scene);
    expect(scene.children).toContain(studio.root);
    expect(studio.root.visible).toBe(false);
    expect(studio.textures.size).toBe(0);
    const output = {
      position: new THREE.Vector3(),
      target: new THREE.Vector3(),
    };
    expect(studio.defaultPose("surface", output)).toBe(output);
    expect(output.target.equals(studio.bodyTarget)).toBe(true);
    expect(output.position.distanceTo(output.target)).toBeCloseTo(
      Math.hypot(1.49, 0.055),
      5,
    );
    studio.defaultPose("orbit", output);
    expect(output.target.length()).toBe(0);
    expect(output.position.length()).toBeGreaterThan(20);
    studio.dispose();
  });

  it("switches illumination masks by eclipse kind and guides without changing the model into a predictor", () => {
    const studio = new LunarStudio(new THREE.Scene());
    studio.setMode("shadow");
    studio.setOptions({ phase: 0, eclipseKind: "solar", perspective: "orbit" });
    studio.update(0);
    expect(studio.earthUniforms.studioShadow.value).toBe(1);
    expect(studio.moonUniforms.studioShadow.value).toBe(0);
    expect(studio.solarShadow.visible).toBe(true);
    studio.setOptions({ phase: 0.5, eclipseKind: "lunar", guides: false });
    studio.update(0);
    expect(studio.moonUniforms.studioShadow.value).toBe(1);
    expect(studio.moonUniforms.studioBlood.value).toBe(1);
    expect(studio.guideGroup.visible).toBe(false);
    expect(studio.summary.displayScale).toBe(true);
    studio.dispose();
  });

  it("removes and disposes owned shared resources once with idempotent cleanup", () => {
    const scene = new THREE.Scene();
    const studio = new LunarStudio(scene);
    let geometryDisposals = 0;
    const count = studio.geometries.size;
    for (const geometry of studio.geometries)
      geometry.addEventListener("dispose", () => geometryDisposals++);
    studio.dispose();
    studio.dispose();
    expect(geometryDisposals).toBe(count);
    expect(scene.children).toHaveLength(0);
    expect(studio.geometries.size).toBe(0);
    expect(studio.materials.size).toBe(0);
  });
});
