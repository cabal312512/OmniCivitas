import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeviceNavigation } from "../config/apps/portal/src/planetarium/device-navigation.mjs";

const portalRequire = createRequire(new URL("../config/apps/portal/package.json", import.meta.url));
const THREE = await import(pathToFileURL(join(dirname(portalRequire.resolve("three")), "three.module.js")).href);
const pendingPermission = () => {
  let resolve;
  const promise = new Promise((finish) => { resolve = finish; });
  return { promise, resolve };
};

afterEach(() => vi.unstubAllGlobals());

describe("phone navigation activation ownership", () => {
  it("allows a fresh activation after cancellation and ignores the old permission completion", async () => {
    const firstPermission = pendingPermission();
    const nextPermission = pendingPermission();
    const win = new EventTarget();
    const doc = new EventTarget();
    doc.hidden = false;
    const OrientationEvent = function () {};
    OrientationEvent.requestPermission = vi.fn()
      .mockReturnValueOnce(firstPermission.promise)
      .mockReturnValueOnce(nextPermission.promise);
    Object.assign(win, { isSecureContext: true, DeviceOrientationEvent: OrientationEvent, screen: { orientation: new EventTarget() } });
    win.screen.orientation.angle = 0;
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", doc);
    vi.stubGlobal("navigator", { userAgent: "iPhone", maxTouchPoints: 5 });
    const navigation = new DeviceNavigation(new THREE.PerspectiveCamera());
    try {
      const first = navigation.enable();
      navigation.disable();
      const next = navigation.enable();
      expect(next).not.toBe(first);
      expect(OrientationEvent.requestPermission).toHaveBeenCalledTimes(2);
      expect(navigation.state.waiting).toBe(true);
      firstPermission.resolve("granted");
      await expect(first).resolves.toBe(false);
      expect(navigation.enable()).toBe(next);
      expect(navigation.state.waiting).toBe(true);
      nextPermission.resolve("granted");
      await Promise.resolve();
      const sample = new Event("deviceorientation");
      Object.assign(sample, { alpha: 30, beta: 60, gamma: 5 });
      win.dispatchEvent(sample);
      await expect(next).resolves.toBe(true);
      expect(navigation.enabled).toBe(true);
      expect(navigation.state.waiting).toBe(false);
      navigation.disable();
      expect(navigation.enabled).toBe(false);
    } finally {
      navigation.dispose();
    }
  });
});
