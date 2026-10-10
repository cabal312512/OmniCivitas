import { MathUtils, Quaternion, Vector3 } from "three";

const AXIS_X = new Vector3(1, 0, 0);
const AXIS_Y = new Vector3(0, 1, 0);
const AXIS_Z = new Vector3(0, 0, 1);
const FORWARD = new Vector3(0, 0, -1);
const MIN_FOV = 0.9;
const MAX_FOV = 95;
const SKY_RADIUS = 0.06;
const MOVE_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyQ",
  "KeyE",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

function editable(element) {
  return Boolean(
    element?.closest?.(
      'input, textarea, select, [contenteditable="true"], [role="textbox"]',
    ),
  );
}

/**
 * Free celestial navigation, with no horizon/polar-angle constraint.
 * Owns input listeners, not a render loop. Quaternion rotation is independent
 * of celestial coordinates, location and the astronomical simulation clock.
 */
export class SkyNavigation {
  constructor(
    camera,
    canvas,
    { onInteraction = null, onReset = null, onFocus = null } = {},
  ) {
    if (!camera || !canvas)
      throw new TypeError("SkyNavigation requires a camera and canvas.");
    this.camera = camera;
    this.canvas = canvas;
    this.onInteraction = onInteraction;
    this.onReset = onReset;
    this.onFocus = onFocus;
    this.desiredFov = MathUtils.clamp(camera.fov, MIN_FOV, MAX_FOV);
    this.desiredQuaternion = camera.quaternion.clone().normalize();
    this._resetQuaternion = this.desiredQuaternion.clone();
    this._resetFov = this.desiredFov;
    this._rotation = new Quaternion();
    this._direction = new Vector3();
    this._orientationUp = new Vector3();
    this._orientationRight = new Vector3();
    this._orientationLevelUp = new Vector3();
    this._angularVelocity = new Vector3();
    this._keys = new Set();
    this._pointers = new Map();
    this._twoFingerPose = null;
    this._shift = false;
    this._enabled = true;
    this._disposed = false;
    this._listeners = [];
    this._previousTouchAction = canvas.style.touchAction;
    this._previousTabIndex = canvas.getAttribute("tabindex");
    if (this._previousTabIndex === null) canvas.setAttribute("tabindex", "0");
    canvas.style.touchAction = "none";

    this._listen(canvas, "pointerdown", (event) => this._pointerDown(event));
    this._listen(canvas, "pointermove", (event) => this._pointerMove(event));
    this._listen(canvas, "pointerup", (event) => this._pointerEnd(event));
    this._listen(canvas, "pointercancel", (event) => this._pointerEnd(event));
    this._listen(canvas, "lostpointercapture", (event) =>
      this._pointerEnd(event),
    );
    this._listen(canvas, "wheel", (event) => this._wheel(event), {
      passive: false,
    });
    this._listen(canvas, "contextmenu", (event) => {
      if (this.enabled) event.preventDefault();
    });
    this._listen(canvas, "keydown", (event) => this._keyDown(event));
    this._listen(window, "keyup", (event) => {
      this._keys.delete(event.code);
      this._shift = event.shiftKey;
    });
    this._listen(canvas, "blur", () => this._clearKeyboard());
    this._listen(window, "blur", () => this._clearInput());
    this._listen(document, "visibilitychange", () => {
      if (document.hidden) this._clearInput();
    });
  }

  _listen(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    this._listeners.push(() =>
      target.removeEventListener(event, handler, options),
    );
  }

  get enabled() {
    return this._enabled && !this._disposed;
  }
  set enabled(value) {
    this.setEnabled(value);
  }
  get dragging() {
    return this._pointers.size > 0;
  }

  setEnabled(value) {
    const enabled = Boolean(value) && !this._disposed;
    if (enabled === this._enabled) return;
    this._enabled = enabled;
    if (!enabled) this._clearInput();
    else this.syncFromCamera();
  }

  /** Call after restoring a sky view or completing an external camera move. */
  syncFromCamera({ rememberReset = false } = {}) {
    if (this._disposed) return;
    this.desiredQuaternion.copy(this.camera.quaternion).normalize();
    this.desiredFov = MathUtils.clamp(this.camera.fov, MIN_FOV, MAX_FOV);
    this._angularVelocity.set(0, 0, 0);
    if (rememberReset) {
      this._resetQuaternion.copy(this.desiredQuaternion);
      this._resetFov = this.desiredFov;
    }
  }

  setOrientation({ azimuth, elevation, roll } = {}) {
    if (this._disposed) return false;
    if (
      [azimuth, elevation, roll].some(
        (value) => value !== undefined && !Number.isFinite(value),
      )
    )
      return false;
    this._interact("orientation", null);
    this._direction
      .copy(FORWARD)
      .applyQuaternion(this.camera.quaternion)
      .normalize();
    this._orientationUp
      .copy(AXIS_Y)
      .applyQuaternion(this.camera.quaternion)
      .normalize();
    this._orientationRight
      .copy(AXIS_X)
      .applyQuaternion(this.camera.quaternion)
      .normalize();
    const horizontalLength = Math.hypot(this._direction.x, this._direction.z);
    const currentHeading =
      horizontalLength > 1e-7
        ? Math.atan2(this._direction.x, -this._direction.z)
        : Math.atan2(this._orientationRight.z, this._orientationRight.x);
    this._orientationRight.set(
      Math.cos(currentHeading),
      0,
      Math.sin(currentHeading),
    );
    this._orientationLevelUp
      .crossVectors(this._orientationRight, this._direction)
      .normalize();
    const currentRoll = Math.atan2(
      this._orientationUp.dot(this._orientationRight),
      this._orientationUp.dot(this._orientationLevelUp),
    );
    const heading =
      azimuth === undefined
        ? currentHeading
        : MathUtils.degToRad(MathUtils.euclideanModulo(azimuth, 360));
    const altitude = MathUtils.degToRad(
      MathUtils.clamp(
        elevation === undefined
          ? MathUtils.radToDeg(
              Math.asin(MathUtils.clamp(this._direction.y, -1, 1)),
            )
          : elevation,
        -89.9,
        89.9,
      ),
    );
    const bank = roll === undefined ? currentRoll : MathUtils.degToRad(roll);
    this.desiredQuaternion
      .setFromAxisAngle(AXIS_Y, -heading)
      .multiply(this._rotation.setFromAxisAngle(AXIS_X, altitude))
      .multiply(this._rotation.setFromAxisAngle(AXIS_Z, -bank))
      .normalize();
    this._angularVelocity.set(0, 0, 0);
    return true;
  }

  _interact(type, originalEvent) {
    this.onInteraction?.({ type, originalEvent });
  }

  _focusCanvas() {
    if (document.activeElement !== this.canvas)
      this.canvas.focus({ preventScroll: true });
  }

  _pointerDown(event) {
    if (!this.enabled || event.ctrlKey || event.metaKey || event.altKey) return;
    if (
      event.pointerType === "mouse" &&
      event.button !== 0 &&
      event.button !== 2
    )
      return;
    event.preventDefault();
    this._focusCanvas();
    this._interact("drag", event);
    this._pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      button: event.button,
      pointerType: event.pointerType,
    });
    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch {}
    this._twoFingerPose = this._touchPose();
    this._angularVelocity.set(0, 0, 0);
  }

  _touchPose() {
    if (this._pointers.size !== 2) return null;
    const [first, second] = this._pointers.values();
    const dx = second.x - first.x,
      dy = second.y - first.y;
    return {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
      distance: Math.max(1, Math.hypot(dx, dy)),
      angle: Math.atan2(dy, dx),
    };
  }

  _pointerMove(event) {
    if (!this.enabled) return;
    const pointer = this._pointers.get(event.pointerId);
    if (!pointer) return;
    const dx = event.clientX - pointer.x,
      dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (event.ctrlKey || event.metaKey || event.altKey) {
      this._twoFingerPose = this._touchPose();
      this._angularVelocity.set(0, 0, 0);
      return;
    }
    event.preventDefault();
    const height = Math.max(1, this.canvas.clientHeight);
    const cabal312512ViewportSensitivity =
      (MathUtils.degToRad(this.desiredFov) * 1.12) / height;
    if (this._pointers.size === 1) {
      if (pointer.button === 2 && pointer.pointerType !== "touch") {
        this._rotate(0, 0, (dx + dy * 0.25) * cabal312512ViewportSensitivity);
      } else
        this._rotate(
          dy * cabal312512ViewportSensitivity,
          dx * cabal312512ViewportSensitivity,
          0,
        );
      return;
    }
    const pose = this._touchPose(),
      previous = this._twoFingerPose;
    if (pose && previous) {
      this.desiredFov = MathUtils.clamp(
        (this.desiredFov * previous.distance) / pose.distance,
        MIN_FOV,
        MAX_FOV,
      );
      const roll = Math.atan2(
        Math.sin(pose.angle - previous.angle),
        Math.cos(pose.angle - previous.angle),
      );
      this._rotate(
        (pose.y - previous.y) * cabal312512ViewportSensitivity,
        (pose.x - previous.x) * cabal312512ViewportSensitivity,
        -roll,
      );
    }
    this._twoFingerPose = pose;
  }

  _pointerEnd(event) {
    if (!this._pointers.has(event.pointerId)) return;
    this._pointers.delete(event.pointerId);
    try {
      if (this.canvas.hasPointerCapture(event.pointerId))
        this.canvas.releasePointerCapture(event.pointerId);
    } catch {}
    this._twoFingerPose = this._touchPose();
  }

  _wheel(event) {
    if (!this.enabled || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    this._interact("zoom", event);
    const multiplier =
      event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? this.canvas.clientHeight
          : 1;
    const delta = MathUtils.clamp(event.deltaY * multiplier, -900, 900);
    this.desiredFov = MathUtils.clamp(
      this.desiredFov * Math.exp(delta * 0.001),
      MIN_FOV,
      MAX_FOV,
    );
  }

  _keyDown(event) {
    if (
      !this.enabled ||
      document.activeElement !== this.canvas ||
      editable(event.target)
    )
      return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (MOVE_KEYS.has(event.code)) {
      event.preventDefault();
      this._shift = event.shiftKey;
      if (!this._keys.has(event.code)) this._interact("keyboard", event);
      this._keys.add(event.code);
    } else if (!event.repeat && event.code === "KeyR") {
      event.preventDefault();
      this._interact("reset", event);
      this.reset();
    } else if (!event.repeat && event.code === "KeyF" && this.onFocus) {
      event.preventDefault();
      this._interact("focus", event);
      this.onFocus();
    }
  }

  _rotate(pitch, yaw, roll) {
    // Local camera axes remain meaningful at the poles and after a full roll.
    if (yaw)
      this.desiredQuaternion.multiply(
        this._rotation.setFromAxisAngle(AXIS_Y, yaw),
      );
    if (pitch)
      this.desiredQuaternion.multiply(
        this._rotation.setFromAxisAngle(AXIS_X, pitch),
      );
    if (roll)
      this.desiredQuaternion.multiply(
        this._rotation.setFromAxisAngle(AXIS_Z, roll),
      );
    this.desiredQuaternion.normalize();
  }

  _clearKeyboard() {
    this._keys.clear();
    this._shift = false;
    this._angularVelocity.set(0, 0, 0);
  }

  _clearInput() {
    this._clearKeyboard();
    const ids = [...this._pointers.keys()];
    this._pointers.clear();
    for (const id of ids) {
      try {
        if (this.canvas.hasPointerCapture(id))
          this.canvas.releasePointerCapture(id);
      } catch {}
    }
    this._twoFingerPose = null;
  }

  /** Reset smoothly, optionally accepting a Quaternion or { quaternion, fov }. */
  reset(pose = null) {
    if (this._disposed) return;
    this._clearInput();
    const quaternion = pose?.isQuaternion ? pose : pose?.quaternion;
    this.desiredQuaternion
      .copy(quaternion?.isQuaternion ? quaternion : this._resetQuaternion)
      .normalize();
    this.desiredFov = MathUtils.clamp(
      Number.isFinite(pose?.fov) ? pose.fov : this._resetFov,
      MIN_FOV,
      MAX_FOV,
    );
    this.onReset?.();
  }

  /** The caller's single RAF drives both quaternion and field-of-view easing. */
  update(dt = 0) {
    if (!this.enabled) return false;
    const elapsed = MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
    const keys = this._keys;
    const speed = (this._shift ? 1.8 : 0.85) * Math.sqrt(this.desiredFov / 56);
    const pitch =
      (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
      (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
    const yaw =
      (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) -
      (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0);
    const roll = (keys.has("KeyQ") ? 1 : 0) - (keys.has("KeyE") ? 1 : 0);
    const acceleration = 1 - Math.exp(-elapsed / 0.055);
    this._angularVelocity.x = MathUtils.lerp(
      this._angularVelocity.x,
      pitch * speed,
      acceleration,
    );
    this._angularVelocity.y = MathUtils.lerp(
      this._angularVelocity.y,
      yaw * speed,
      acceleration,
    );
    this._angularVelocity.z = MathUtils.lerp(
      this._angularVelocity.z,
      roll * speed,
      acceleration,
    );
    this._rotate(
      this._angularVelocity.x * elapsed,
      this._angularVelocity.y * elapsed,
      this._angularVelocity.z * elapsed,
    );
    const rotationBlend = 1 - Math.exp(-elapsed / 0.055);
    const zoomBlend = 1 - Math.exp(-elapsed / 0.095);
    this.camera.quaternion
      .slerp(this.desiredQuaternion, rotationBlend)
      .normalize();
    this._direction.copy(FORWARD).applyQuaternion(this.camera.quaternion);
    this.camera.position.copy(this._direction).multiplyScalar(-SKY_RADIUS);
    const fov = MathUtils.lerp(this.camera.fov, this.desiredFov, zoomBlend);
    if (Math.abs(fov - this.camera.fov) > 1e-7) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.updateMatrixWorld();
    return true;
  }

  dispose() {
    if (this._disposed) return;
    this._clearInput();
    this._disposed = true;
    this._enabled = false;
    for (const remove of this._listeners) remove();
    this._listeners.length = 0;
    if (this.canvas.style.touchAction === "none")
      this.canvas.style.touchAction = this._previousTouchAction;
    if (this._previousTabIndex === null)
      this.canvas.removeAttribute("tabindex");
    else this.canvas.setAttribute("tabindex", this._previousTabIndex);
  }
}
