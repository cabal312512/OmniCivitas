import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SolarNavigation } from "../config/apps/portal/src/planetarium/solar-navigation.mjs";
import { SkyNavigation } from "../config/apps/portal/src/planetarium/sky-navigation.mjs";

const portalRequire = createRequire(
  new URL("../config/apps/portal/package.json", import.meta.url),
);
const THREE = await import(
  pathToFileURL(
    join(dirname(portalRequire.resolve("three")), "three.module.js"),
  ).href
);

class CanvasHarness extends EventTarget {
  constructor() {
    super();
    this.style = { touchAction: "auto" };
    this.clientHeight = 600;
    this.clientWidth = 1000;
    this.attributes = new Map();
    this.captures = new Set();
  }
  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
  setAttribute(name, value) {
    this.attributes.set(name, value);
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  setPointerCapture(id) {
    this.captures.add(id);
  }
  releasePointerCapture(id) {
    this.captures.delete(id);
  }
  hasPointerCapture(id) {
    return this.captures.has(id);
  }
  focus() {
    document.activeElement = this;
  }
  closest() {
    return null;
  }
}

function input(target, type, properties = {}) {
  const event = new Event(type, { cancelable: true });
  for (const [key, value] of Object.entries({
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientX: 100,
    clientY: 100,
    repeat: false,
    ...properties,
  }))
    Object.defineProperty(event, key, { value });
  target.dispatchEvent(event);
  return event;
}

function setup(callbacks = {}, cameraPose = null) {
  const camera = new THREE.PerspectiveCamera(56, 1, 0.001, 1800);
  camera.position.set(0, 0, 40);
  cameraPose?.(camera);
  const canvas = new CanvasHarness();
  const navigation = new SolarNavigation(camera, canvas, callbacks);
  canvas.focus();
  navigation.setEnabled(true);
  return { camera, canvas, navigation };
}

function settle(navigation, frames = 120) {
  for (let frame = 0; frame < frames; frame += 1) navigation.update(1 / 60);
}

beforeEach(() => {
  const documentHarness = new EventTarget();
  Object.assign(documentHarness, { activeElement: null, hidden: false });
  vi.stubGlobal("document", documentHarness);
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => vi.unstubAllGlobals());

describe("solar free-camera navigation", () => {
  it("left drag changes orientation smoothly without orbiting the camera", () => {
    const { camera, canvas, navigation } = setup();
    const originalPosition = camera.position.clone();
    const originalQuaternion = camera.quaternion.clone();
    input(canvas, "pointerdown");
    input(canvas, "pointermove", { clientX: 230, clientY: 180 });
    input(canvas, "pointerup");
    expect(camera.quaternion.equals(originalQuaternion)).toBe(true);
    navigation.update(1 / 60);
    expect(camera.quaternion.angleTo(originalQuaternion)).toBeGreaterThan(0);
    expect(camera.quaternion.angleTo(originalQuaternion)).toBeLessThan(
      navigation.desiredQuaternion.angleTo(originalQuaternion),
    );
    settle(navigation);
    expect(camera.position.equals(originalPosition)).toBe(true);
    expect(
      camera.quaternion.angleTo(navigation.desiredQuaternion),
    ).toBeLessThan(1e-7);
    expect(
      new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).x,
    ).toBeLessThan(0);
  });

  it("moves the visible scene with a grabbed left drag on both axes", () => {
    for (const [dx, dy] of [
      [140, 0],
      [0, 140],
    ]) {
      const { camera, canvas, navigation } = setup();
      input(canvas, "pointerdown");
      input(canvas, "pointermove", { clientX: 100 + dx, clientY: 100 + dy });
      input(canvas, "pointerup");
      settle(navigation);
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
        camera.quaternion,
      );
      const fixedPoint = new THREE.Vector3(0, 0, 0).project(camera);
      if (dx) {
        expect(forward.x).toBeLessThan(0);
        expect(fixedPoint.x).toBeGreaterThan(0);
        expect(Math.abs(fixedPoint.y)).toBeLessThan(1e-10);
      } else {
        expect(forward.y).toBeGreaterThan(0);
        expect(fixedPoint.y).toBeLessThan(0);
        expect(Math.abs(fixedPoint.x)).toBeLessThan(1e-10);
      }
      expect(camera.position.toArray()).toEqual([0, 0, 40]);
      navigation.dispose();
    }
  });

  it("right drag translates on camera right/up axes while keeping orientation", () => {
    const { camera, canvas, navigation } = setup({}, (camera) =>
      camera.quaternion.setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        Math.PI / 2,
      ),
    );
    const original = camera.quaternion.clone();
    input(canvas, "pointerdown", { button: 2 });
    input(canvas, "pointermove", { button: 2, clientX: 220, clientY: 150 });
    input(canvas, "pointerup", { button: 2 });
    settle(navigation);
    expect(camera.position.z).toBeGreaterThan(40);
    expect(camera.position.y).toBeGreaterThan(0);
    expect(camera.position.x).toBeCloseTo(0, 10);
    expect(camera.quaternion.equals(original)).toBe(true);
    expect(input(canvas, "contextmenu", { button: 2 }).defaultPrevented).toBe(
      true,
    );
  });

  it("wheel dollies along the viewing axis and accumulates motion without changing FOV", () => {
    const { camera, canvas, navigation } = setup({}, (camera) =>
      camera.quaternion.setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        Math.PI / 2,
      ),
    );
    const originalFov = camera.fov;
    input(canvas, "wheel", { deltaY: -100, deltaMode: 0 });
    const first = navigation.desiredPosition.x;
    input(canvas, "wheel", { deltaY: -100, deltaMode: 0 });
    expect(navigation.desiredPosition.x).toBeLessThan(first);
    settle(navigation);
    expect(camera.position.x).toBeLessThan(0);
    expect(camera.position.z).toBeCloseTo(40, 10);
    expect(camera.fov).toBe(originalFov);
  });

  it("preserves browser modifier shortcuts and does not capture modified drags", () => {
    const { canvas, navigation } = setup();
    const position = navigation.desiredPosition.clone();
    for (const modifier of ["ctrlKey", "metaKey", "altKey"]) {
      expect(
        input(canvas, "wheel", { deltaY: -120, deltaMode: 0, [modifier]: true })
          .defaultPrevented,
      ).toBe(false);
      expect(
        input(canvas, "keydown", { code: "KeyW", [modifier]: true })
          .defaultPrevented,
      ).toBe(false);
      input(canvas, "pointerdown", { [modifier]: true });
      expect(navigation.dragging).toBe(false);
    }
    settle(navigation);
    expect(navigation.desiredPosition.equals(position)).toBe(true);
  });

  it("rebases suppressed modifier movement without applying it when drag resumes", () => {
    for (const Navigation of [SolarNavigation, SkyNavigation]) {
      const camera = new THREE.PerspectiveCamera(56, 1, 0.001, 1800);
      const canvas = new CanvasHarness();
      const navigation = new Navigation(camera, canvas);
      navigation.setEnabled(true);
      input(canvas, "pointerdown");
      const original = navigation.desiredQuaternion.clone();
      expect(input(canvas, "pointermove", { clientX: 1000, ctrlKey: true }).defaultPrevented).toBe(false);
      expect(navigation.desiredQuaternion.equals(original)).toBe(true);
      input(canvas, "pointermove", { clientX: 1001 });
      const angle = navigation.desiredQuaternion.angleTo(original);
      expect(angle).toBeGreaterThan(0);
      expect(angle).toBeLessThan(0.003);
      navigation.dispose();
    }
  });

  it("rebases a suppressed two-finger pose without a resumed pinch or roll jump", () => {
    for (const Navigation of [SolarNavigation, SkyNavigation]) {
      const camera = new THREE.PerspectiveCamera(56, 1, 0.001, 1800);
      const canvas = new CanvasHarness();
      const navigation = new Navigation(camera, canvas);
      navigation.setEnabled(true);
      input(canvas, "pointerdown", { pointerId: 10, pointerType: "touch", clientX: 100 });
      input(canvas, "pointerdown", { pointerId: 11, pointerType: "touch", clientX: 200 });
      const original = navigation.desiredQuaternion.clone();
      input(canvas, "pointermove", { pointerId: 11, pointerType: "touch", clientX: 600, clientY: 400, altKey: true });
      input(canvas, "pointermove", { pointerId: 11, pointerType: "touch", clientX: 600, clientY: 400 });
      expect(navigation.desiredQuaternion.angleTo(original)).toBeLessThan(1e-7);
      if (navigation.desiredPosition) expect(navigation.desiredPosition.length()).toBe(0);
      else expect(navigation.desiredFov).toBe(56);
      navigation.dispose();
    }
  });

  it("rebases before interpreting an interrupted transition and translates both damping poses", () => {
    let navigation;
    const harness = setup({ onInteraction: () => navigation.syncFromCamera() });
    navigation = harness.navigation;
    const { camera, canvas } = harness;
    camera.position.set(100, 20, 30);
    input(canvas, "wheel", { deltaY: -60, deltaMode: 0 });
    expect(navigation.desiredPosition.x).toBe(100);
    expect(navigation.desiredPosition.y).toBe(20);
    expect(navigation.desiredPosition.z).toBeLessThan(30);
    const separation = navigation.desiredPosition.clone().sub(camera.position);
    expect(navigation.translate(new THREE.Vector3(4, -2, 3))).toBe(true);
    expect(camera.position.toArray()).toEqual([104, 18, 33]);
    expect(
      navigation.desiredPosition
        .clone()
        .sub(camera.position)
        .distanceTo(separation),
    ).toBeLessThan(1e-12);
    expect(navigation.translate(new THREE.Vector3(NaN, 0, 0))).toBe(false);
  });

  it("supports movement keys only while canvas is focused and clears held movement on blur", () => {
    const { camera, canvas, navigation } = setup();
    input(canvas, "keydown", { code: "KeyW" });
    for (let frame = 0; frame < 30; frame += 1) navigation.update(1 / 60);
    expect(camera.position.z).toBeLessThan(40);
    input(window, "blur");
    const desired = navigation.desiredPosition.clone();
    settle(navigation);
    expect(navigation.desiredPosition.equals(desired)).toBe(true);
    document.activeElement = null;
    expect(input(canvas, "keydown", { code: "KeyD" }).defaultPrevented).toBe(
      false,
    );
    expect(navigation.desiredPosition.equals(desired)).toBe(true);
  });

  it("allows rotation over poles and two-finger pan/dolly without NaNs", () => {
    const { camera, canvas, navigation } = setup();
    input(canvas, "pointerdown");
    input(canvas, "pointermove", { clientY: 2500 });
    input(canvas, "pointerup");
    settle(navigation);
    expect(camera.quaternion.length()).toBeCloseTo(1, 12);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      camera.quaternion,
    );
    expect(forward.z).toBeGreaterThan(0);
    const position = navigation.desiredPosition.clone();
    input(canvas, "pointerdown", {
      pointerId: 10,
      pointerType: "touch",
      clientX: 100,
    });
    input(canvas, "pointerdown", {
      pointerId: 11,
      pointerType: "touch",
      clientX: 200,
    });
    input(canvas, "pointermove", {
      pointerId: 11,
      pointerType: "touch",
      clientX: 280,
      clientY: 160,
    });
    input(canvas, "pointercancel", { pointerId: 10, pointerType: "touch" });
    input(canvas, "pointercancel", { pointerId: 11, pointerType: "touch" });
    settle(navigation);
    expect(camera.position.distanceTo(position)).toBeGreaterThan(0.1);
    expect(camera.position.toArray().every(Number.isFinite)).toBe(true);
    expect(camera.quaternion.length()).toBeCloseTo(1, 12);
    expect(navigation.dragging).toBe(false);
  });

  it("keeps repeated large wheel events bounded and restores listener/capture state on disposal", () => {
    const { canvas, navigation } = setup();
    for (let index = 0; index < 1200; index += 1)
      input(canvas, "wheel", { deltaY: 5000, deltaMode: 2 });
    expect(navigation.desiredPosition.length()).toBeLessThanOrEqual(
      4096.000001,
    );
    input(canvas, "pointerdown");
    expect(canvas.captures.size).toBe(1);
    navigation.dispose();
    navigation.dispose();
    expect(canvas.captures.size).toBe(0);
    expect(canvas.style.touchAction).toBe("auto");
    expect(canvas.getAttribute("tabindex")).toBeNull();
    expect(navigation.update(1 / 60)).toBe(false);
    expect(
      input(canvas, "wheel", { deltaY: -100, deltaMode: 0 }).defaultPrevented,
    ).toBe(false);
  });

  it("keeps explicit focus/reset optional and disabled modes inert", () => {
    const onFocus = vi.fn(),
      onReset = vi.fn();
    const { camera, canvas, navigation } = setup({ onFocus, onReset });
    input(canvas, "keydown", { code: "KeyF" });
    expect(onFocus).toHaveBeenCalledOnce();
    input(canvas, "wheel", { deltaY: -100, deltaMode: 0 });
    settle(navigation);
    input(canvas, "keydown", { code: "KeyR" });
    settle(navigation);
    expect(onReset).toHaveBeenCalledOnce();
    expect(camera.position.z).toBeCloseTo(40, 6);
    navigation.setEnabled(false);
    const pose = camera.position.clone();
    expect(
      input(canvas, "wheel", { deltaY: -100, deltaMode: 0 }).defaultPrevented,
    ).toBe(false);
    expect(navigation.update(1 / 60)).toBe(false);
    expect(camera.position.equals(pose)).toBe(true);
    camera.position.set(5, 7, 9);
    navigation.setEnabled(true);
    expect(navigation.desiredPosition.toArray()).toEqual([5, 7, 9]);
  });
});
