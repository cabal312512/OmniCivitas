import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  readableAngularStep,
  SIDEREAL_RADIANS_PER_MS,
  SKY_VISUAL_RADIANS_PER_SECOND,
  SPIN_VISUAL_RADIANS_PER_SECOND,
  trajectoryPosition,
  wrappedPhaseCorrection,
} from "../config/apps/portal/src/planetarium/continuous-motion.mjs";
import {
  solarMotionSnapshot,
  solarSnapshot,
  skyMotionSnapshot,
  skySnapshot,
} from "../config/apps/portal/src/planetarium/ephemeris.mjs";
import { processEphemerisRequest } from "../config/apps/portal/src/planetarium/ephemeris.worker.mjs";
import { SolarScene } from "../config/apps/portal/src/planetarium/solar-scene.mjs";
import { SkyScene } from "../config/apps/portal/src/planetarium/sky-scene.mjs";

const portalRequire = createRequire(
  new URL("../config/apps/portal/package.json", import.meta.url),
);
const THREE = await import(
  pathToFileURL(
    join(dirname(portalRequire.resolve("three")), "three.module.js"),
  ).href
);
const TIME = Date.parse("2025-08-12T22:00:00Z");
const PLACE = { latitude: 28.76, longitude: -17.89, elevation: 2300 };
const SPEED = 30 * 86400;
const iso = (value) => new Date(value).toISOString();
const byId = (snapshot, id) => snapshot.bodies.find((body) => body.id === id);

function skyHarness(snapshot) {
  const sky = Object.create(SkyScene.prototype);
  Object.assign(sky, {
    effectTime: 0,
    tracking: true,
    bodies: new Map(),
    options: {},
    snapshot,
    catalogue: new THREE.Group(),
    skyQuaternion: new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().fromArray(snapshot.skyTransform),
    ),
    targetSkyQuaternion: new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().fromArray(snapshot.skyTransform),
    ),
    motionTargetQuaternion: new THREE.Quaternion(),
    motionRotation: new THREE.Quaternion(),
    motionPole: new THREE.Vector3(
      0,
      Math.sin((PLACE.latitude * Math.PI) / 180),
      -Math.cos((PLACE.latitude * Math.PI) / 180),
    ),
    motionObserverOffset: new THREE.Vector3(),
    motionPoint: [0, 0, 0],
    motionTimeMs: TIME,
    motionEpochMs: TIME,
    motionObserverChanged: false,
  });
  return sky;
}

function solarHarness() {
  const solar = Object.create(SolarScene.prototype);
  Object.assign(solar, {
    options: { scale: "display", atmosphere: false },
    root: new THREE.Group(),
    bodies: new Map(),
    disposed: false,
    age: 0,
    selectedId: "earth",
    lastSnapshot: null,
    _targetScale: null,
    _snapshotTimeMs: NaN,
    _renderTimeMs: NaN,
    _positionedBodies: [],
    _scratch: new THREE.Vector3(),
    _moonRelative: new THREE.Vector3(),
    _earthTrue: new THREE.Vector3(),
    _motionPoint: [0, 0, 0],
    _motionEarth: [0, 0, 0],
    _motionWorldEarth: new THREE.Vector3(),
  });
  solar.root.visible = false;
  for (const [id, radius, spin] of [
    ["mercury", 0.38, 6.1385108],
    ["earth", 0.7, 360.9856235],
    ["moon", 0.19, 13.17635815],
  ]) {
    const positionGroup = new THREE.Group();
    const body = {
      id,
      radius,
      style: { radius },
      positioned: false,
      positionGroup,
      axis: new THREE.Group(),
      surface: new THREE.Group(),
      targetPosition: new THREE.Vector3(),
      renderPosition: new THREE.Vector3(),
      targetQuaternion: new THREE.Quaternion(),
      targetRotation: 0,
      rotationRate: (spin * Math.PI) / 180 / DAY_MS,
      uniforms: {
        uSolarCenter: { value: new THREE.Vector3() },
        uSolarLight: { value: new THREE.Vector3() },
        uSolarPole: { value: new THREE.Vector3() },
      },
    };
    solar.root.add(positionGroup);
    solar.bodies.set(id, body);
  }
  return solar;
}

describe("continuous accelerated planetarium motion", () => {
  it("returns bounded structured-clone-safe forward and reverse trajectories", () => {
    for (const speed of [SPEED, -SPEED]) {
      const response = processEphemerisRequest({
        id: 1,
        type: "solar",
        time: iso(TIME),
        speed,
      });
      expect(response.error).toBeUndefined();
      expect(structuredClone(response)).toEqual(response);
      for (const track of Object.values(response.result.motion.tracks)) {
        expect(track.positions.length).toBeLessThanOrEqual(122);
        expect(track.positions.length).toBeGreaterThan(3);
        expect(track.velocities).toHaveLength(track.positions.length);
        expect(track.startTimeMs).toBeLessThan(TIME);
        expect(
          track.startTimeMs + (track.positions.length - 1) * track.stepMs,
        ).toBeGreaterThan(TIME);
      }
    }
    const sky = skyMotionSnapshot(iso(TIME), PLACE, SPEED);
    expect(Math.hypot(...sky.motion.observerOffset)).toBeGreaterThan(0);
    expect(Object.keys(sky.motion.tracks)).toHaveLength(9);
  });

  it("keeps Mercury on its actual curved orbit through a 90-day look-ahead", () => {
    const snapshot = solarMotionSnapshot(iso(TIME), SPEED);
    for (const days of [0.3, 7.2, 19.5, 30.7, 49.3, 74.1, 89.4]) {
      const time = TIME + days * DAY_MS;
      const actual = byId(solarSnapshot(iso(time)), "mercury").position;
      const rendered = trajectoryPosition(snapshot.motion.tracks.mercury, time);
      expect(
        Math.hypot(...actual.map((value, index) => value - rendered[index])),
      ).toBeLessThan(0.00001);
    }
  });

  it("reuses common knots across Worker updates without a position discontinuity", () => {
    const before = solarMotionSnapshot(iso(TIME), SPEED);
    const after = solarMotionSnapshot(iso(TIME + 19.5 * DAY_MS), SPEED);
    for (const id of ["mercury", "venus", "earth", "moon"]) {
      const time = TIME + 20.21 * DAY_MS;
      const a = trajectoryPosition(before.motion.tracks[id], time);
      const b = trajectoryPosition(after.motion.tracks[id], time);
      expect(
        Math.hypot(...a.map((value, axis) => value - b[axis])),
      ).toBeLessThan(1e-12);
    }
  });

  it("renders a two-second 30 d/s orbit without chord overshoot or sample-boundary leaps", () => {
    const solar = solarHarness();
    let snapshot = solarMotionSnapshot(iso(TIME), SPEED);
    solar.update(snapshot, 0, "earth", TIME);
    let previous = solar.bodies.get("mercury").positionGroup.position.clone();
    for (let frame = 1; frame <= 120; frame += 1) {
      const time = TIME + (frame / 60) * SPEED * 1000;
      if (frame % 39 === 0) snapshot = solarMotionSnapshot(iso(time), SPEED);
      solar.update(snapshot, 1 / 60, "earth", time);
      const position = solar.bodies.get("mercury").positionGroup.position;
      const actual = byId(solarSnapshot(iso(time)), "mercury").position;
      const radius = Math.hypot(...actual);
      expect(position.length()).toBeCloseTo(6 + 17 * Math.log1p(radius), 4);
      expect(position.distanceTo(previous)).toBeLessThan(1.3);
      const lunarDistance = solar.bodies
        .get("moon")
        .positionGroup.position.distanceTo(
          solar.bodies.get("earth").positionGroup.position,
        );
      expect(lunarDistance).toBeCloseTo(0.7 * 3.6, 8);
      previous.copy(position);
    }
  });

  it("bounds visible spin in either direction and smoothly reconciles a paused phase", () => {
    const step = readableAngularStep(
      120,
      1 / 60,
      SPIN_VISUAL_RADIANS_PER_SECOND,
    );
    expect(step).toBeCloseTo(SPIN_VISUAL_RADIANS_PER_SECOND / 60, 12);
    expect(
      readableAngularStep(-120, 1 / 60, SPIN_VISUAL_RADIANS_PER_SECOND),
    ).toBe(-step);
    expect(
      readableAngularStep(0.001, 1 / 60, SPIN_VISUAL_RADIANS_PER_SECOND),
    ).toBe(0.001);
    let phase = Math.PI * 1.9;
    const target = 0.2;
    for (let index = 0; index < 180; index += 1)
      phase += wrappedPhaseCorrection(phase, target, 1 / 60);
    expect(
      Math.abs(Math.atan2(Math.sin(target - phase), Math.cos(target - phase))),
    ).toBeLessThan(0.00002);
  });

  it("uses the full signed sidereal angle across many whole days", () => {
    const initial = skySnapshot(iso(TIME), PLACE);
    const next = skySnapshot(iso(TIME + 20.5 * DAY_MS), PLACE);
    const pole = new THREE.Vector3(
      0,
      Math.sin((PLACE.latitude * Math.PI) / 180),
      -Math.cos((PLACE.latitude * Math.PI) / 180),
    );
    const expected = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().fromArray(next.skyTransform),
    );
    const forecast = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().fromArray(initial.skyTransform),
    );
    forecast.premultiply(
      new THREE.Quaternion().setFromAxisAngle(
        pole,
        -SIDEREAL_RADIANS_PER_MS * 20.5 * DAY_MS,
      ),
    );
    expect(forecast.angleTo(expected)).toBeLessThan(0.00008);
  });

  it("keeps the sky rate continuous when a new Worker anchor arrives, then settles on pause", () => {
    const snapshot = skyMotionSnapshot(iso(TIME), PLACE, SPEED);
    const sky = skyHarness(snapshot);
    const camera = new THREE.PerspectiveCamera();
    let previous = sky.skyQuaternion.clone();
    let time = TIME;
    for (let frame = 1; frame <= 60; frame += 1) {
      time = TIME + (frame / 60) * SPEED * 1000;
      if (frame === 39) {
        sky.snapshot = skyMotionSnapshot(iso(time), PLACE, SPEED);
        sky.motionEpochMs = time;
        sky.targetSkyQuaternion.setFromRotationMatrix(
          new THREE.Matrix4().fromArray(sky.snapshot.skyTransform),
        );
      }
      sky.updateCamera(camera, 1 / 60, time, { playing: true, speed: SPEED });
      expect(sky.skyQuaternion.angleTo(previous)).toBeCloseTo(
        SKY_VISUAL_RADIANS_PER_SECOND / 60,
        7,
      );
      previous.copy(sky.skyQuaternion);
    }
    const expected = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().fromArray(skySnapshot(iso(time), PLACE).skyTransform),
    );
    for (let frame = 0; frame < 240; frame += 1)
      sky.updateCamera(camera, 1 / 60, time, { playing: false, speed: SPEED });
    expect(sky.skyQuaternion.angleTo(expected)).toBeLessThan(0.00008);
  });

  it("reverses visible diurnal motion without losing a complete-turn sign", () => {
    const snapshot = skyMotionSnapshot(iso(TIME), PLACE, -SPEED);
    const sky = skyHarness(snapshot);
    const previous = sky.skyQuaternion.clone();
    sky.updateCamera(
      new THREE.PerspectiveCamera(),
      1 / 60,
      TIME - (SPEED * 1000) / 60,
      { playing: true, speed: -SPEED },
    );
    const expected = previous
      .clone()
      .premultiply(
        new THREE.Quaternion().setFromAxisAngle(
          sky.motionPole,
          SKY_VISUAL_RADIANS_PER_SECOND / 60,
        ),
      );
    expect(sky.skyQuaternion.angleTo(expected)).toBeLessThan(0.0000001);
  });

  it("preserves a frozen display phase during slow-frame preparation and resumes a capped reverse step", () => {
    const snapshot = skyMotionSnapshot(iso(TIME), PLACE, SPEED);
    const sky = skyHarness(snapshot);
    const camera = new THREE.PerspectiveCamera();
    const elapsed = 0.09;
    const original = sky.skyQuaternion.clone();
    let time = TIME + elapsed * SPEED * 1000;
    sky.updateCamera(camera, elapsed, time, { playing: true, speed: SPEED });
    expect(sky.skyQuaternion.angleTo(original)).toBeCloseTo(
      SKY_VISUAL_RADIANS_PER_SECOND * elapsed,
      8,
    );

    const frozen = sky.skyQuaternion.clone();
    sky.targetSkyQuaternion.premultiply(
      new THREE.Quaternion().setFromAxisAngle(sky.motionPole, Math.PI / 2),
    );
    time += DAY_MS;
    for (let frame = 0; frame < 4; frame += 1)
      sky.updateCamera(camera, elapsed, time, {
        playing: true,
        speed: -SPEED,
        frozen: true,
      });
    expect(sky.skyQuaternion.equals(frozen)).toBe(true);
    expect(sky.motionTimeMs).toBe(time);
    expect(sky.effectTime).toBeCloseTo(elapsed * 5, 12);

    time -= elapsed * SPEED * 1000;
    sky.updateCamera(camera, elapsed, time, { playing: true, speed: -SPEED });
    const expected = frozen
      .clone()
      .premultiply(
        new THREE.Quaternion().setFromAxisAngle(
          sky.motionPole,
          SKY_VISUAL_RADIANS_PER_SECOND * elapsed,
        ),
      );
    expect(sky.skyQuaternion.angleTo(expected)).toBeLessThan(0.0000001);
  });
});
