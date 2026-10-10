import { Euler, MathUtils, Quaternion, Vector3 } from "three";

const CAMERA_BASIS = new Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);
const SCREEN_AXIS = new Vector3(0, 0, 1);
const FORWARD = new Vector3(0, 0, -1);
const SENSOR_WAIT_MS = 8000;
const sensorEuler = new Euler();
const screenRotation = new Quaternion();

/** Narrower than a small viewport: desktop windows never become phone sensors. */
export function isMobileDevice(
  navigatorLike = globalThis.navigator,
  windowLike = globalThis.window,
) {
  if (!navigatorLike || !windowLike) return false;
  const userAgent = String(navigatorLike.userAgent || "");
  const touch =
    Number(navigatorLike.maxTouchPoints) > 0 ||
    Boolean(windowLike.matchMedia?.("(any-pointer: coarse)").matches);
  const ipadDesktopAgent =
    navigatorLike.platform === "MacIntel" &&
    Number(navigatorLike.maxTouchPoints) > 1;
  if (ipadDesktopAgent) return true;
  if (!touch) return false;
  if (navigatorLike.userAgentData?.mobile === true) return true;
  return /Android|iPhone|iPad|iPod|Mobile|IEMobile|Windows Phone/i.test(
    userAgent,
  );
}

/**
 * Device-to-camera basis adapted from three.js DeviceOrientationControls (MIT).
 * https://github.com/mrdoob/three.js/blob/r133/examples/jsm/controls/DeviceOrientationControls.js
 * Browser alpha/beta/gamma are degrees; the resulting camera quaternion is
 * right-handed, Y-up and corrected for the current screen orientation.
 */
export function deviceQuaternion(
  alpha,
  beta,
  gamma,
  screenAngle = 0,
  target = new Quaternion(),
) {
  if (![alpha, beta, gamma, screenAngle].every(Number.isFinite)) {
    throw new RangeError("Device orientation angles must be finite numbers.");
  }
  sensorEuler.set(
    MathUtils.degToRad(beta),
    MathUtils.degToRad(alpha),
    -MathUtils.degToRad(gamma),
    "YXZ",
  );
  return target
    .setFromEuler(sensorEuler)
    .multiply(CAMERA_BASIS)
    .multiply(
      screenRotation.setFromAxisAngle(
        SCREEN_AXIS,
        -MathUtils.degToRad(screenAngle),
      ),
    )
    .normalize();
}

function screenAngle(windowLike) {
  const current = windowLike.screen?.orientation?.angle;
  return Number.isFinite(current)
    ? current
    : Number.isFinite(windowLike.orientation)
      ? windowLike.orientation
      : 0;
}

/**
 * Opt-in physical-device view control. No sensor listener exists before enable,
 * and samples remain ephemeral: no network, storage or independent RAF.
 */
export class DeviceNavigation {
  constructor(camera, { onChange = null, onInteraction = null } = {}) {
    if (!camera) throw new TypeError("DeviceNavigation requires a camera.");
    this.camera = camera;
    this.onChange = onChange;
    this.onInteraction = onInteraction;
    this.window = globalThis.window;
    this.document = globalThis.document;
    this.mobile = isMobileDevice();
    this._state = {
      available:
        this.mobile &&
        typeof this.window?.DeviceOrientationEvent === "function",
      enabled: false,
      waiting: false,
      error: null,
    };
    this._raw = new Quaternion();
    this._offset = new Quaternion();
    this._desired = new Quaternion();
    this._baseline = camera.quaternion.clone();
    this._inverse = new Quaternion();
    this._direction = new Vector3();
    this._sample = null;
    this._needsCalibration = true;
    this._lastSampleAt = 0;
    this._generation = 0;
    this._enablePromise = null;
    this._activationResolve = null;
    this._waitTimer = null;
    this._listeners = [];
    this._disposed = false;
  }

  get state() {
    return { ...this._state };
  }
  get enabled() {
    return !this._disposed && this._state.enabled;
  }

  supported() {
    return (
      !this._disposed &&
      this._state.available &&
      this.window?.isSecureContext === true
    );
  }

  _emit() {
    this.onChange?.(this.state);
  }

  /** Call directly from a user click; iOS permission requests need that gesture. */
  enable() {
    if (this._disposed) return Promise.resolve(false);
    if (this.enabled) return Promise.resolve(true);
    if (this._enablePromise) return this._enablePromise;
    if (!this._state.available) {
      this._fail("unavailable");
      return Promise.resolve(false);
    }
    if (!this.supported()) {
      this._fail("insecure-context");
      return Promise.resolve(false);
    }
    const cabal312512PermissionGeneration = ++this._generation;
    this._state.waiting = true;
    this._state.error = null;
    this._baseline.copy(this.camera.quaternion);
    this._needsCalibration = true;
    this._emit();
    // _start executes requestPermission synchronously before its first await.
    const operation = this._start(cabal312512PermissionGeneration).finally(
      () => {
        if (this._enablePromise === operation) this._enablePromise = null;
      },
    );
    this._enablePromise = operation;
    return operation;
  }

  async _start(generation) {
    try {
      const orientationEvent = this.window.DeviceOrientationEvent;
      if (typeof orientationEvent.requestPermission === "function") {
        const permission = await orientationEvent.requestPermission();
        if (this._disposed || generation !== this._generation) return false;
        if (permission !== "granted") {
          this._fail("permission-denied");
          return false;
        }
      }
      if (this._disposed || generation !== this._generation) return false;
      return await new Promise((resolve) => {
        this._activationResolve = resolve;
        this._attach();
        this._waitTimer = setTimeout(() => {
          if (generation === this._generation) this._fail("sensor-unavailable");
        }, SENSOR_WAIT_MS);
      });
    } catch (error) {
      if (this._disposed || generation !== this._generation) return false;
      this._fail(
        error?.name === "NotAllowedError"
          ? "permission-required"
          : "sensor-unavailable",
      );
      return false;
    }
  }

  _listen(target, event, callback) {
    if (!target?.addEventListener) return;
    target.addEventListener(event, callback, { passive: true });
    this._listeners.push(() => target.removeEventListener(event, callback));
  }

  _attach() {
    this._detach();
    this._listen(this.window, "deviceorientation", (event) =>
      this._sensor(event),
    );
    const orientation = this.window.screen?.orientation;
    if (orientation?.addEventListener)
      this._listen(orientation, "change", () => this._screenChanged());
    else
      this._listen(this.window, "orientationchange", () =>
        this._screenChanged(),
      );
    this._listen(this.document, "visibilitychange", () => {
      this._baseline.copy(this.camera.quaternion);
      this._needsCalibration = true;
      if (!this.document.hidden) {
        this._desired.copy(this._baseline);
        this._lastSampleAt = performance.now();
      }
    });
  }

  _sensor(event) {
    if (this._disposed || (!this._state.waiting && !this.enabled)) return;
    if (this.document?.hidden) return;
    if (![event.alpha, event.beta, event.gamma].every(Number.isFinite)) return;
    this._sample = { alpha: event.alpha, beta: event.beta, gamma: event.gamma };
    this._lastSampleAt = performance.now();
    deviceQuaternion(
      event.alpha,
      event.beta,
      event.gamma,
      screenAngle(this.window),
      this._raw,
    );
    if (this._needsCalibration) {
      this._offset
        .copy(this._baseline)
        .multiply(this._inverse.copy(this._raw).invert())
        .normalize();
      this._needsCalibration = false;
    }
    this._desired.copy(this._offset).multiply(this._raw).normalize();
    if (!this._state.enabled) {
      this._state.enabled = true;
      this._state.waiting = false;
      this._state.error = null;
      this._finishActivation(true);
      this.onInteraction?.({ type: "device" });
      this._emit();
    }
  }

  _screenChanged() {
    if (!this._sample || !this.enabled) return;
    const { alpha, beta, gamma } = this._sample;
    deviceQuaternion(alpha, beta, gamma, screenAngle(this.window), this._raw);
    this._desired.copy(this._offset).multiply(this._raw).normalize();
  }

  /** Recenter the relative sensor frame on the current view without new permission. */
  calibrate(quaternion = this.camera.quaternion) {
    if (this._disposed) return false;
    this._baseline.copy(quaternion).normalize();
    if (!this._sample || !this.enabled) {
      this._needsCalibration = true;
      return false;
    }
    this._offset
      .copy(this._baseline)
      .multiply(this._inverse.copy(this._raw).invert())
      .normalize();
    this._desired.copy(this._baseline);
    this._needsCalibration = false;
    return true;
  }

  update(dt = 0) {
    if (!this.enabled || this.document?.hidden || !this._sample) return false;
    if (performance.now() - this._lastSampleAt > SENSOR_WAIT_MS) {
      this._fail("sensor-unavailable");
      return false;
    }
    const elapsed = MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
    const angle = this.camera.quaternion.angleTo(this._desired);
    const easedStep = angle * (1 - Math.exp(-elapsed / 0.075));
    this.camera.quaternion
      .rotateTowards(this._desired, Math.min(easedStep, elapsed * Math.PI * 3))
      .normalize();
    this._direction.copy(FORWARD).applyQuaternion(this.camera.quaternion);
    this.camera.position.copy(this._direction).multiplyScalar(-0.06);
    this.camera.updateMatrixWorld();
    return true;
  }

  _finishActivation(result) {
    if (this._waitTimer !== null) clearTimeout(this._waitTimer);
    this._waitTimer = null;
    const resolve = this._activationResolve;
    this._activationResolve = null;
    resolve?.(result);
  }

  _detach() {
    for (const remove of this._listeners) remove();
    this._listeners.length = 0;
  }

  _fail(code) {
    this._state.enabled = false;
    this._state.waiting = false;
    this._state.error = code;
    this._sample = null;
    this._detach();
    this._finishActivation(false);
    this._emit();
  }

  disable({ silent = false } = {}) {
    ++this._generation;
    this._enablePromise = null;
    this._state.enabled = false;
    this._state.waiting = false;
    this._state.error = null;
    this._sample = null;
    this._needsCalibration = true;
    this._detach();
    this._finishActivation(false);
    if (!silent) this._emit();
  }

  dispose() {
    if (this._disposed) return;
    this.disable({ silent: true });
    this._disposed = true;
    this.onChange = null;
    this.onInteraction = null;
  }
}
