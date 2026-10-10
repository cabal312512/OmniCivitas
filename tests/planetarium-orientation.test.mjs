import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  OrientationHud,
  orientationAngles,
  viewingDirection,
} from "../config/apps/portal/src/planetarium/orientation-hud.mjs";

const portalRequire = createRequire(
  new URL("../config/apps/portal/package.json", import.meta.url),
);
const THREE = await import(
  pathToFileURL(
    join(dirname(portalRequire.resolve("three")), "three.module.js"),
  ).href
);
const rect = { left: 20, top: 30, width: 226, height: 226 };
const near = (actual, expected, places = 5) =>
  expect(actual).toBeCloseTo(expected, places);

class Renderer {
  constructor() {
    this.viewport = new THREE.Vector4(3, 4, 1280, 800);
    this.scissor = new THREE.Vector4(2, 5, 1000, 600);
    this.autoClear = true;
    this.scissorTest = false;
    this.target = { original: true };
  }
  getSize(target) {
    return target.set(1600, 1000);
  }
  getViewport(target) {
    return target.copy(this.viewport);
  }
  getScissor(target) {
    return target.copy(this.scissor);
  }
  getRenderTarget() {
    return this.target;
  }
  getScissorTest() {
    return this.scissorTest;
  }
  getActiveCubeFace() {
    return 2;
  }
  getActiveMipmapLevel() {
    return 3;
  }
  setRenderTarget(target, face, level) {
    this.target = target;
    this.face = face;
    this.level = level;
  }
  setViewport(...args) {
    args[0]?.isVector4
      ? this.viewport.copy(args[0])
      : this.viewport.set(...args);
  }
  setScissor(...args) {
    args[0]?.isVector4 ? this.scissor.copy(args[0]) : this.scissor.set(...args);
  }
  setScissorTest(value) {
    this.scissorTest = value;
  }
  clearDepth() {
    this.cleared = true;
  }
  render() {
    if (this.fail) throw new Error("GPU interrupted");
  }
}

function instrument() {
  return new OrientationHud(new Renderer(), { loadEarthTexture: false });
}
function curveScreen(hud, axis, angle) {
  const point = hud._curvePoint(
    axis,
    (angle * Math.PI) / 180,
    hud.controls[axis].radius,
    new THREE.Vector3(),
  );
  return hud._screen(point, rect);
}

describe("semantic view-direction instrument", () => {
  it("maps cardinal headings and signed elevation to true observer-local 3D rays", () => {
    for (const [heading, expected] of [
      [0, [0, 0, -1]],
      [90, [1, 0, 0]],
      [180, [0, 0, 1]],
      [270, [-1, 0, 0]],
    ]) {
      const point = viewingDirection({ azimuth: heading, elevation: 0 });
      point.toArray().forEach((value, index) => near(value, expected[index]));
    }
    near(viewingDirection({ azimuth: 90, elevation: 45 }).y, Math.SQRT1_2);
    near(viewingDirection({ azimuth: 90, elevation: -45 }).y, -Math.SQRT1_2);
  });

  it("uses world camera orientation, including finite zenith/pole heading and roll", () => {
    const camera = new THREE.PerspectiveCamera();
    const group = new THREE.Group();
    group.rotation.y = -Math.PI / 2;
    group.add(camera);
    near(orientationAngles(camera).azimuth, 90);
    camera.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    near(orientationAngles(camera).elevation, 90);
    expect(
      Object.values(orientationAngles(camera)).every(Number.isFinite),
    ).toBe(true);
    group.rotation.y = 0;
    camera.quaternion.setFromAxisAngle(
      new THREE.Vector3(0, 0, -1),
      Math.PI / 3,
    );
    near(orientationAngles(camera).roll, 60);
  });

  it("keeps the Earth upright while the arrow leaves the horizontal plane", () => {
    const hud = instrument();
    const originalEarth = hud.earth.quaternion.clone();
    hud.setOrientation({ azimuth: 48, elevation: 64, roll: 37 });
    const actualDirection = new THREE.Vector3(0, 1, 0).applyQuaternion(
      hud.directionArrow.quaternion,
    );
    near(actualDirection.distanceTo(viewingDirection(hud.angles)), 0);
    expect(actualDirection.y).toBeGreaterThan(0.8);
    expect(hud.earth.quaternion.equals(originalEarth)).toBe(true);
    const up = new THREE.Vector3(0, 1, 0).project(hud.camera);
    near(up.x, 0);
    expect(up.y).toBeGreaterThan(0);
    hud.dispose();
  });

  it("populates every tick with a visible finite ribbon on its direction ring", () => {
    const hud = instrument();
    hud.setOrientation({ azimuth: 73, elevation: -28, roll: 42 });
    for (const [axis, count] of [["azimuth", 72], ["elevation", 25], ["roll", 24]]) {
      const control = hud.controls[axis];
      const positions = control.ticks.geometry.attributes.position;
      expect(positions.count).toBe(count * 4);
      for (let index = 0; index < positions.count; index += 4) {
        const corners = [0, 1, 2, 3].map((corner) =>
          new THREE.Vector3().fromBufferAttribute(positions, index + corner),
        );
        expect(corners.every((point) => point.toArray().every(Number.isFinite))).toBe(true);
        expect(corners[0].length()).toBeGreaterThan(control.radius);
        expect(corners[0].distanceTo(corners[1])).toBeGreaterThan(0.01);
        expect(corners[0].distanceTo(corners[2])).toBeGreaterThan(0.02);
      }
    }
    hud.dispose();
  });

  it("projects true ray depth and signed altitude, and calibrated cardinal labels", () => {
    const hud = instrument();
    hud.setOrientation({ azimuth: 90, elevation: -40 });
    const low = hud.projectControls(rect).arrowTip;
    hud.setOrientation({ azimuth: 90, elevation: 40 });
    const high = hud.projectControls(rect).arrowTip;
    expect(high.y).toBeLessThan(low.y);
    hud.setOrientation({ azimuth: 0, elevation: 0 });
    const north = hud.projectControls(rect);
    hud.setOrientation({ azimuth: 180, elevation: 0 });
    const south = hud.projectControls(rect);
    expect(north.arrowTip.depth).toBeGreaterThan(south.arrowTip.depth);
    expect(north.cardinals.N.y).toBeLessThan(north.cardinals.S.y);
    expect(north.cardinals.E.x).toBeGreaterThan(north.cardinals.W.x);
    hud.dispose();
  });

  it("picks separate azimuth, elevation and roll handles without rotating the whole inset", () => {
    const hud = instrument();
    hud.setOrientation({ azimuth: 68, elevation: 39, roll: -25 });
    const controls = hud.projectControls(rect);
    for (const axis of ["azimuth", "elevation", "roll"]) {
      const point = controls.handles[axis];
      expect(hud.pickControl(point.x, point.y, rect)?.axis).toBe(axis);
    }
    expect(hud.pickControl(rect.left, rect.top, rect)).toBeNull();
    hud.setActiveControl("elevation");
    expect(hud.controls.elevation.handle.scale.x).toBeGreaterThan(
      hud.controls.azimuth.handle.scale.x,
    );
    hud.dispose();
  });

  it("inverts ring projection and continues azimuth across its 360 degree seam", () => {
    const hud = instrument();
    hud.setOrientation({ azimuth: 120, elevation: 20, roll: 0 });
    for (const [axis, angle] of [
      ["azimuth", 95],
      ["elevation", 38],
      ["roll", -35],
    ]) {
      const point = curveScreen(hud, axis, angle);
      near(hud.dragControl(axis, point.x, point.y, rect, angle - 3), angle, 3);
    }
    const crossed = curveScreen(hud, "azimuth", 2);
    near(hud.dragControl("azimuth", crossed.x, crossed.y, rect, 358), 362);
    hud.dispose();
  });

  it("keeps edge-on meridian dragging stable near north/south instead of jumping to a folded arc", () => {
    const hud = instrument();
    hud.setOrientation({ azimuth: 0, elevation: 60, roll: 0 });
    const point = hud.projectControls(rect).handles.elevation;
    const next = hud.dragControl("elevation", point.x, point.y - 5, rect, 60, {
      x: point.x,
      y: point.y,
    });
    expect(next).toBeGreaterThan(60);
    expect(next).toBeLessThan(65);
    hud.dispose();
  });

  it("restores shared renderer target, viewport, scissor and autoClear after render failure", () => {
    const hud = instrument();
    const renderer = hud.renderer;
    const original = {
      target: renderer.target,
      viewport: renderer.viewport.clone(),
      scissor: renderer.scissor.clone(),
    };
    renderer.fail = true;
    expect(() =>
      hud.render(new THREE.PerspectiveCamera(), {
        x: 100,
        y: 90,
        width: 226,
        height: 226,
      }),
    ).toThrow("GPU interrupted");
    expect(renderer.target).toBe(original.target);
    expect(renderer.viewport.equals(original.viewport)).toBe(true);
    expect(renderer.scissor.equals(original.scissor)).toBe(true);
    expect(renderer.autoClear).toBe(true);
    expect(renderer.scissorTest).toBe(false);
    expect(renderer.face).toBe(2);
    expect(renderer.level).toBe(3);
    expect(hud.triangleCount).toBeLessThan(5000);
    hud.dispose();
    hud.dispose();
    expect(hud.scene.children).toHaveLength(0);
  });
});
