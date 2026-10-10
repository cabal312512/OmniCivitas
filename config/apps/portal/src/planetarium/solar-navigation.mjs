import { MathUtils, Quaternion, Vector3 } from "three";

const AXIS_X = new Vector3(1, 0, 0);
const AXIS_Y = new Vector3(0, 1, 0);
const AXIS_Z = new Vector3(0, 0, 1);
const MAX_POSITION_RADIUS = 4096;
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
const hasBrowserModifier = (event) =>
  event.ctrlKey || event.metaKey || event.altKey;
const editable = (element) =>
  Boolean(
    element?.closest?.(
      'input, textarea, select, [contenteditable="true"], [role="textbox"]',
    ),
  );

/** Free solar camera. Input targets are eased by the caller's existing RAF. */
export class SolarNavigation {
  constructor(
    camera,
    canvas,
    { onInteraction = null, onFocus = null, onReset = null } = {},
  ) {
    if (!camera || !canvas)
      throw new TypeError("SolarNavigation requires a camera and canvas.");
    this.camera = camera;
    this.canvas = canvas;
    this.onInteraction = onInteraction;
    this.onFocus = onFocus;
    this.onReset = onReset;
    this.desiredPosition = camera.position.clone();
    this.desiredQuaternion = camera.quaternion.clone().normalize();
    this._resetPosition = this.desiredPosition.clone();
    this._resetQuaternion = this.desiredQuaternion.clone();
    this._rotation = new Quaternion();
    this._movement = new Vector3();
    this._linearVelocity = new Vector3();
    this._angularVelocity = new Vector3();
    this._keys = new Set();
    this._pointers = new Map();
    this._twoFingerPose = null;
    this._shift = false;
    this._enabled = false;
    this._disposed = false;
    this._listeners = [];
    this._previousTouchAction = canvas.style.touchAction;
    this._ownsTabIndex = canvas.getAttribute("tabindex") === null;
    if (this._ownsTabIndex) canvas.setAttribute("tabindex", "0");
    canvas.style.touchAction = "none";

    this._listen(canvas, "pointerdown", (event) => this._pointerDown(event));
    this._listen(canvas, "pointermove", (event) => this._pointerMove(event));
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      this._listen(canvas, type, (event) => this._pointerEnd(event));
    this._listen(canvas, "wheel", (event) => this._wheel(event), {
      passive: false,
    });
    this._listen(canvas, "contextmenu", (event) => {
      if (this.enabled && !hasBrowserModifier(event)) event.preventDefault();
    });
    this._listen(canvas, "keydown", (event) => this._keyDown(event));
    this._listen(window, "keyup", (event) => {
      this._keys.delete(event.code);
      this._shift = event.shiftKey;
    });
    this._listen(canvas, "blur", () => this._clearInput());
    this._listen(window, "blur", () => this._clearInput());
    this._listen(document, "visibilitychange", () => {
      if (document.hidden) this._clearInput();
    });
  }

  _listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this._listeners.push(() =>
      target.removeEventListener(type, handler, options),
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
    const next = Boolean(value) && !this._disposed;
    if (next === this._enabled) return;
    this._enabled = next;
    this._clearInput();
    if (next) this.syncFromCamera();
  }

  /** Rebase after the host performs an explicit focus or restores a view. */
  syncFromCamera({ rememberReset = false } = {}) {
    if (this._disposed) return;
    this.desiredPosition.copy(this.camera.position);
    this.desiredQuaternion.copy(this.camera.quaternion).normalize();
    this._linearVelocity.set(0, 0, 0);
    this._angularVelocity.set(0, 0, 0);
    if (rememberReset) {
      this._resetPosition.copy(this.desiredPosition);
      this._resetQuaternion.copy(this.desiredQuaternion);
    }
  }

  /** Explicit host following translates both poses, preventing damping recoil. */
  translate(delta) {
    if (
      this._disposed ||
      !delta ||
      ![delta.x, delta.y, delta.z].every(Number.isFinite)
    )
      return false;
    this.camera.position.add(delta);
    this.desiredPosition.add(delta);
    this._boundPosition(this.camera.position);
    this._boundPosition(this.desiredPosition);
    this.camera.updateMatrixWorld();
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
    if (!this.enabled || hasBrowserModifier(event)) return;
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
  }

  _touchPose() {
    if (this._pointers.size !== 2) return null;
    const [a, b] = this._pointers.values();
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      angle: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }

  _movementScale() {
    return MathUtils.clamp(
      Math.pow(Math.max(1, this.desiredPosition.length()), 0.6) * 0.1,
      0.18,
      6,
    );
  }

  _pointerMove(event) {
    const pointer = this._pointers.get(event.pointerId);
    if (!this.enabled || !pointer) return;
    const dx = MathUtils.clamp(event.clientX - pointer.x, -4096, 4096);
    const dy = MathUtils.clamp(event.clientY - pointer.y, -4096, 4096);
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (hasBrowserModifier(event)) {
      this._twoFingerPose = this._touchPose();
      return;
    }
    event.preventDefault();
    const height = Math.max(1, this.canvas.clientHeight);
    const cabal312512CameraSensitivity =
      (MathUtils.degToRad(this.camera.fov) * 1.05) / height;
    const unitsPerPixel = (this._movementScale() * 12) / height;
    if (this._pointers.size === 1) {
      if (pointer.button === 2 && pointer.pointerType !== "touch")
        this._translateLocal(-dx * unitsPerPixel, dy * unitsPerPixel, 0);
      else
        this._rotate(
          dy * cabal312512CameraSensitivity,
          dx * cabal312512CameraSensitivity,
          0,
        );
      return;
    }
    const pose = this._touchPose(),
      previous = this._twoFingerPose;
    if (pose && previous) {
      const forward =
        MathUtils.clamp(
          Math.log(pose.distance / previous.distance),
          -0.8,
          0.8,
        ) *
        this._movementScale() *
        12;
      this._translateLocal(
        -(pose.x - previous.x) * unitsPerPixel,
        (pose.y - previous.y) * unitsPerPixel,
        forward,
      );
      const roll = Math.atan2(
        Math.sin(pose.angle - previous.angle),
        Math.cos(pose.angle - previous.angle),
      );
      this._rotate(0, 0, -roll);
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
    if (!this.enabled || hasBrowserModifier(event)) return;
    event.preventDefault();
    this._interact("dolly", event);
    const multiplier =
      event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? Math.max(1, this.canvas.clientHeight)
          : 1;
    const amount = MathUtils.clamp(event.deltaY * multiplier, -900, 900);
    this._translateLocal(0, 0, -amount * this._movementScale() * 0.012);
  }

  _keyDown(event) {
    if (
      !this.enabled ||
      document.activeElement !== this.canvas ||
      editable(event.target) ||
      hasBrowserModifier(event)
    )
      return;
    if (MOVE_KEYS.has(event.code)) {
      event.preventDefault();
      if (!this._keys.has(event.code)) this._interact("keyboard", event);
      this._keys.add(event.code);
      this._shift = event.shiftKey;
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

  _translateLocal(right, up, forward) {
    this._movement
      .set(right, up, -forward)
      .applyQuaternion(this.desiredQuaternion);
    this.desiredPosition.add(this._movement);
    this._boundPosition(this.desiredPosition);
  }

  _boundPosition(position) {
    if (position.lengthSq() > MAX_POSITION_RADIUS ** 2)
      position.setLength(MAX_POSITION_RADIUS);
  }

  _clearInput() {
    this._keys.clear();
    this._shift = false;
    this._linearVelocity.set(0, 0, 0);
    this._angularVelocity.set(0, 0, 0);
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

  reset(pose = null) {
    if (this._disposed) return;
    this._clearInput();
    const position = pose?.position;
    const quaternion = pose?.quaternion;
    this.desiredPosition.copy(
      position?.isVector3 ? position : this._resetPosition,
    );
    this.desiredQuaternion
      .copy(quaternion?.isQuaternion ? quaternion : this._resetQuaternion)
      .normalize();
    this._boundPosition(this.desiredPosition);
    this.onReset?.();
  }

  update(dt = 0) {
    if (!this.enabled) return false;
    const elapsed = MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
    const keys = this._keys;
    const shift = this._shift ? 2.5 : 1;
    const moveSpeed = this._movementScale() * 8 * shift;
    const right = Number(keys.has("KeyD")) - Number(keys.has("KeyA"));
    const up = Number(keys.has("KeyE")) - Number(keys.has("KeyQ"));
    const forward = Number(keys.has("KeyW")) - Number(keys.has("KeyS"));
    const velocityBlend = 1 - Math.exp(-elapsed / 0.06);
    this._linearVelocity.lerp(
      this._movement
        .set(right, up, forward)
        .normalize()
        .multiplyScalar(moveSpeed),
      velocityBlend,
    );
    this._translateLocal(
      this._linearVelocity.x * elapsed,
      this._linearVelocity.y * elapsed,
      this._linearVelocity.z * elapsed,
    );
    const pitch = Number(keys.has("ArrowUp")) - Number(keys.has("ArrowDown"));
    const yaw = Number(keys.has("ArrowLeft")) - Number(keys.has("ArrowRight"));
    this._angularVelocity.lerp(
      this._movement.set(pitch, yaw, 0).multiplyScalar(0.8 * shift),
      velocityBlend,
    );
    this._rotate(
      this._angularVelocity.x * elapsed,
      this._angularVelocity.y * elapsed,
      0,
    );
    this.camera.position.lerp(
      this.desiredPosition,
      1 - Math.exp(-elapsed / 0.085),
    );
    this.camera.quaternion
      .slerp(this.desiredQuaternion, 1 - Math.exp(-elapsed / 0.055))
      .normalize();
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
    if (this._ownsTabIndex && this.canvas.getAttribute("tabindex") === "0")
      this.canvas.removeAttribute("tabindex");
  }
}
