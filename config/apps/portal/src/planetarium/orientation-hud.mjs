import * as THREE from "three";

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;
const FULL_TURN = Math.PI * 2;
const cabal312512 = 1024;
const AZIMUTH_PLANE = -0.18;
const UP = new THREE.Vector3(0, 1, 0);
const orientation = new THREE.Quaternion();
const forward = new THREE.Vector3();
const screenUp = new THREE.Vector3();
const screenRight = new THREE.Vector3();
const horizontalRight = new THREE.Vector3();
const levelUp = new THREE.Vector3();

/** Observer-local axes: east +X, zenith +Y, south +Z, north -Z. */
export function orientationAngles(camera) {
  camera.getWorldQuaternion(orientation);
  forward.set(0, 0, -1).applyQuaternion(orientation).normalize();
  screenUp.set(0, 1, 0).applyQuaternion(orientation).normalize();
  screenRight.set(1, 0, 0).applyQuaternion(orientation).normalize();
  const horizontalLength = Math.hypot(forward.x, forward.z);
  const heading =
    horizontalLength > 1e-7
      ? Math.atan2(forward.x, -forward.z)
      : Math.atan2(screenRight.z, screenRight.x);
  horizontalRight.set(Math.cos(heading), 0, Math.sin(heading));
  levelUp.crossVectors(horizontalRight, forward).normalize();
  return {
    azimuth: (((heading * DEG) % 360) + 360) % 360,
    elevation: Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1)) * DEG,
    roll:
      Math.atan2(screenUp.dot(horizontalRight), screenUp.dot(levelUp)) * DEG,
  };
}

/** True 3D viewing ray, useful to keep rendering and interaction in one frame. */
export function viewingDirection(
  { azimuth = 0, elevation = 0 } = {},
  target = new THREE.Vector3(),
) {
  const heading = azimuth * RAD;
  const altitude = elevation * RAD;
  return target.set(
    Math.sin(heading) * Math.cos(altitude),
    Math.sin(altitude),
    -Math.cos(heading) * Math.cos(altitude),
  );
}

function dynamicRibbon(segmentCount) {
  const positions = new Float32Array((segmentCount + 1) * 6);
  const uvs = new Float32Array((segmentCount + 1) * 4);
  const indices = [];
  for (let i = 0; i <= segmentCount; i++) {
    uvs.set([0, i / segmentCount, 1, i / segmentCount], i * 4);
  }
  for (let i = 0; i < segmentCount; i++) {
    const vertex = i * 2;
    indices.push(
      vertex,
      vertex + 1,
      vertex + 2,
      vertex + 1,
      vertex + 3,
      vertex + 2,
    );
  }
  return new THREE.BufferGeometry()
    .setAttribute("position", new THREE.BufferAttribute(positions, 3))
    .setAttribute("uv", new THREE.BufferAttribute(uvs, 2))
    .setIndex(indices);
}

function tickRibbonGeometry(count) {
  const indices = [];
  for (let i = 0; i < count; i++) {
    const base = i * 4;
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  return new THREE.BufferGeometry()
    .setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(count * 12), 3),
    )
    .setIndex(indices);
}

function segmentGeometry(segmentCount) {
  return new THREE.BufferGeometry().setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(segmentCount * 6), 3),
  );
}

/** A small orthographic instrument in the existing renderer, with no extra RAF. */
export class OrientationHud {
  constructor(renderer, { loadEarthTexture = true } = {}) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(
      -1.62,
      1.62,
      1.62,
      -1.62,
      0.1,
      20,
    );
    // An elevated, fixed front view shows both depth and altitude; world +Y
    // projects straight up, so the Earth reference never rolls with the view.
    this.camera.position.set(0, 3.2, 6.5);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
    this.disposed = false;
    this.size = new THREE.Vector2();
    this.savedViewport = new THREE.Vector4();
    this.savedScissor = new THREE.Vector4();
    this.earthTexture = null;
    this.earthBitmap = null;
    this.angles = { azimuth: 0, elevation: 0, roll: 0 };
    this.viewDirection = new THREE.Vector3(0, 0, -1);
    this.headingDirection = new THREE.Vector3(0, 0, -1);
    this.right = new THREE.Vector3(1, 0, 0);
    this.up = new THREE.Vector3(0, 1, 0);
    this._point = new THREE.Vector3();
    this._secondPoint = new THREE.Vector3();
    this._projected = new THREE.Vector3();
    this._raycaster = new THREE.Raycaster();
    this._plane = new THREE.Plane();
    this._normal = new THREE.Vector3();
    this._ndc = new THREE.Vector2();
    this._intersection = new THREE.Vector3();
    this.activeControl = null;

    this.scene.add(new THREE.HemisphereLight(0xdaedff, 0x1c2b44, 1.9));
    const key = new THREE.DirectionalLight(0xe9f4ff, 2.6);
    key.position.set(-2, 4, 5);
    this.scene.add(key);

    this.earth = new THREE.Mesh(
      new THREE.SphereGeometry(0.53, 32, 20),
      new THREE.MeshStandardMaterial({
        color: 0x51759e,
        roughness: 0.86,
        metalness: 0.02,
      }),
    );
    this.earth.name = "upright-earth";
    this.earth.rotation.y = -Math.PI / 2;
    this.scene.add(this.earth);

    const grid = [];
    const geographicPoint = (latitude, longitude) => [
      Math.sin(longitude) * Math.cos(latitude) * 0.534,
      Math.sin(latitude) * 0.534,
      Math.cos(longitude) * Math.cos(latitude) * 0.534,
    ];
    for (const latitude of [-Math.PI / 4, 0, Math.PI / 4])
      for (let i = 0; i < 64; i++)
        grid.push(
          ...geographicPoint(latitude, (i / 64) * FULL_TURN),
          ...geographicPoint(latitude, ((i + 1) / 64) * FULL_TURN),
        );
    for (let meridian = 0; meridian < 8; meridian++)
      for (let i = 0; i < 32; i++)
        grid.push(
          ...geographicPoint(
            -Math.PI / 2 + (i / 32) * Math.PI,
            (meridian * Math.PI) / 4,
          ),
          ...geographicPoint(
            -Math.PI / 2 + ((i + 1) / 32) * Math.PI,
            (meridian * Math.PI) / 4,
          ),
        );
    this.scene.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setAttribute(
          "position",
          new THREE.Float32BufferAttribute(grid, 3),
        ),
        new THREE.LineBasicMaterial({
          color: 0xbfddf7,
          transparent: true,
          opacity: 0.2,
          depthWrite: false,
        }),
      ),
    );
    this.scene.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.542, 24, 16),
        new THREE.ShaderMaterial({
          vertexShader:
            "varying vec3 vNormal;void main(){vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
          fragmentShader:
            "varying vec3 vNormal;void main(){float rim=pow(1.0-abs(normalize(vNormal).z),3.8);gl_FragColor=vec4(vec3(.23,.55,.95)*rim*1.5,rim*.34);}",
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      ),
    );

    const axes = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [
            -1.36, 0, 0, 1.36, 0, 0, 0, 0, -1.36, 0, 0, 1.36, 0, -1.22, 0, 0,
            1.22, 0,
          ],
          3,
        ),
      ),
      new THREE.LineBasicMaterial({
        color: 0x83b6d5,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
    );
    this.scene.add(axes);

    this.controls = {};
    const definitions = [
      {
        axis: "azimuth",
        color: 0x5ed8ff,
        radius: 1.23,
        min: 0,
        max: FULL_TURN,
        count: 96,
        ticks: 72,
      },
      {
        axis: "elevation",
        color: 0xacadff,
        radius: 1.08,
        min: -Math.PI / 2,
        max: Math.PI / 2,
        count: 64,
        ticks: 25,
      },
      {
        axis: "roll",
        color: 0xffd494,
        radius: 0.36,
        min: -Math.PI,
        max: Math.PI,
        count: 64,
        ticks: 24,
      },
    ];
    const handleGeometry = new THREE.OctahedronGeometry(0.061, 1);
    const haloGeometry = new THREE.SphereGeometry(0.11, 12, 8);
    for (const definition of definitions) {
      const ribbon = new THREE.Mesh(
        dynamicRibbon(definition.count),
        new THREE.ShaderMaterial({
          uniforms: {
            tint: { value: new THREE.Color(definition.color) },
            visibility: { value: 0.84 },
          },
          vertexShader:
            "varying vec2 vRibbon;void main(){vRibbon=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
          fragmentShader: `varying vec2 vRibbon;uniform vec3 tint;uniform float visibility;
            void main(){float across=abs(vRibbon.x*2.0-1.0);float feather=1.0-smoothstep(.72,1.0,across);
            float core=1.0-smoothstep(.35,.54,across);float edge=exp(-abs(across-.70)*27.0)*.42;
            float accent=smoothstep(.92,1.0,cos(vRibbon.y*37.69911184))*.07;
            vec3 color=tint*(1.08+core*.24)+vec3(.78,.9,1.0)*edge;
            gl_FragColor=vec4(color,(core*.86+edge+feather*(.09+accent))*visibility);}`,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      ribbon.name = `direction-${definition.axis}-ribbon`;
      ribbon.frustumCulled = false;
      const ticks = new THREE.Mesh(
        tickRibbonGeometry(definition.ticks),
        new THREE.MeshBasicMaterial({
          color: definition.color,
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      );
      ticks.frustumCulled = false;
      const handle = new THREE.Group();
      handle.name = `direction-${definition.axis}-handle`;
      const core = new THREE.Mesh(
        handleGeometry,
        new THREE.MeshBasicMaterial({
          color: definition.color,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      core.renderOrder = 20;
      const halo = new THREE.Mesh(
        haloGeometry,
        new THREE.MeshBasicMaterial({
          color: definition.color,
          transparent: true,
          opacity: 0.2,
          depthTest: false,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        }),
      );
      halo.renderOrder = 19;
      handle.add(core, halo);
      this.scene.add(ribbon, ticks, handle);
      this.controls[definition.axis] = {
        ...definition,
        tickCount: definition.ticks,
        ribbon,
        ticks,
        handle,
      };
    }

    // The viewing arrow is a real 3D vector. Its shaft rises/falls through the
    // elevation meridian instead of rotating a triangle in the screen plane.
    this.directionArrow = new THREE.Group();
    this.directionArrow.name = "true-view-direction";
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.017, 0.017, 0.75, 10),
      new THREE.MeshBasicMaterial({ color: 0xbaf5ff, toneMapped: false }),
    );
    shaft.position.y = 0.945;
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.076, 0.19, 12),
      new THREE.MeshBasicMaterial({ color: 0xddfcff, toneMapped: false }),
    );
    tip.position.y = 1.38;
    const arrowGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.064, 0.045, 0.76, 10),
      new THREE.MeshBasicMaterial({
        color: 0x39ceff,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    arrowGlow.position.y = 0.95;
    const tipGlow = new THREE.Mesh(
      new THREE.ConeGeometry(0.11, 0.23, 12),
      new THREE.MeshBasicMaterial({
        color: 0x5addff,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    tipGlow.position.y = 1.38;
    // A low-opacity X-ray layer preserves a readable far-side arrow; solid
    // surfaces still retain depth against the Earth and the nearby rings.
    arrowGlow.material.depthTest = false;
    tipGlow.material.depthTest = false;
    arrowGlow.renderOrder = 25;
    tipGlow.renderOrder = 25;
    this.directionArrow.add(shaft, tip, arrowGlow, tipGlow);
    this.scene.add(this.directionArrow);

    this.projection = new THREE.LineSegments(
      segmentGeometry(9),
      new THREE.LineBasicMaterial({
        color: 0x80e7ff,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    );
    this.projection.frustumCulled = false;
    this.scene.add(this.projection);
    this.setOrientation(this.angles);

    this.geometries = new Set();
    this.materials = new Set();
    this.triangleCount = 0;
    this.scene.traverse((object) => {
      if (object.geometry) {
        this.geometries.add(object.geometry);
        if (object.isMesh)
          this.triangleCount +=
            (object.geometry.index?.count ||
              object.geometry.attributes.position.count) / 3;
      }
      if (object.material) this.materials.add(object.material);
    });
    this.textureReady = loadEarthTexture
      ? this.loadEarthTexture()
      : Promise.resolve(false);
  }

  _curvePoint(axis, angle, radius, target) {
    if (axis === "azimuth")
      return target.set(
        Math.sin(angle) * radius,
        AZIMUTH_PLANE,
        -Math.cos(angle) * radius,
      );
    if (axis === "elevation")
      return target
        .copy(this.headingDirection)
        .multiplyScalar(Math.cos(angle) * radius)
        .addScaledVector(UP, Math.sin(angle) * radius);
    return target
      .copy(this.viewDirection)
      .multiplyScalar(0.93)
      .addScaledVector(this.right, Math.sin(angle) * radius)
      .addScaledVector(this.up, Math.cos(angle) * radius);
  }

  /** Keep the inset pose independent of its DOM location and canvas DPR. */
  setOrientation(angles) {
    if (this.disposed) return;
    for (const axis of ["azimuth", "elevation", "roll"])
      if (Number.isFinite(angles[axis])) this.angles[axis] = angles[axis];
    const heading = this.angles.azimuth * RAD;
    this.headingDirection.set(Math.sin(heading), 0, -Math.cos(heading));
    this.right.set(Math.cos(heading), 0, Math.sin(heading));
    viewingDirection(this.angles, this.viewDirection);
    this.up.crossVectors(this.right, this.viewDirection).normalize();
    this.directionArrow.quaternion.setFromUnitVectors(UP, this.viewDirection);
    for (const control of Object.values(this.controls)) {
      const halfWidth = control.axis === this.activeControl ? 0.032 : 0.026;
      const positions = control.ribbon.geometry.attributes.position;
      for (let i = 0; i <= control.count; i++) {
        const angle =
          control.min + (i / control.count) * (control.max - control.min);
        this._curvePoint(
          control.axis,
          angle,
          control.radius - halfWidth,
          this._point,
        );
        this._curvePoint(
          control.axis,
          angle,
          control.radius + halfWidth,
          this._secondPoint,
        );
        positions.setXYZ(i * 2, this._point.x, this._point.y, this._point.z);
        positions.setXYZ(
          i * 2 + 1,
          this._secondPoint.x,
          this._secondPoint.y,
          this._secondPoint.z,
        );
      }
      positions.needsUpdate = true;
      const ticks = control.ticks.geometry.attributes.position;
      for (let i = 0; i < control.tickCount; i++) {
        const angle =
          control.min +
          (i /
            (control.axis === "elevation"
              ? control.tickCount - 1
              : control.tickCount)) *
            (control.max - control.min);
        const length = i % 6 === 0 ? 0.078 : 0.033;
        const tickHalfWidth = (i % 6 === 0 ? 0.012 : 0.008) / control.radius;
        for (let corner = 0; corner < 4; corner++) {
          this._curvePoint(
            control.axis,
            angle + (corner % 2 ? tickHalfWidth : -tickHalfWidth),
            control.radius + 0.034 + (corner >= 2 ? length : 0),
            this._point,
          );
          ticks.setXYZ(
            i * 4 + corner,
            this._point.x,
            this._point.y,
            this._point.z,
          );
        }
      }
      ticks.needsUpdate = true;
      this._curvePoint(
        control.axis,
        this.angles[control.axis] * RAD,
        control.radius,
        control.handle.position,
      );
    }
    const drop = this.projection.geometry.attributes.position;
    for (let i = 0; i < 9; i++) {
      const bottom = i / 9,
        top = (i + 0.54) / 9;
      this._point.copy(this.viewDirection).multiplyScalar(1.23);
      this._point.y =
        AZIMUTH_PLANE + (this.viewDirection.y * 1.23 - AZIMUTH_PLANE) * bottom;
      drop.setXYZ(i * 2, this._point.x, this._point.y, this._point.z);
      this._point.y =
        AZIMUTH_PLANE + (this.viewDirection.y * 1.23 - AZIMUTH_PLANE) * top;
      drop.setXYZ(i * 2 + 1, this._point.x, this._point.y, this._point.z);
    }
    drop.needsUpdate = true;
  }

  /** Highlight one independently captured ring without changing its pose. */
  setActiveControl(axis = null) {
    this.activeControl = this.controls[axis] ? axis : null;
    for (const control of Object.values(this.controls)) {
      const active = control.axis === this.activeControl;
      control.ribbon.material.opacity = active
        ? 1
        : this.activeControl
          ? 0.60
          : 0.84;
      control.ribbon.material.uniforms.visibility.value =
        control.ribbon.material.opacity;
      control.ticks.material.opacity = active ? 0.94 : 0.65;
      control.handle.scale.setScalar(active ? 1.42 : 1);
    }
  }

  _screen(point, rect) {
    this._projected.copy(point).project(this.camera);
    return {
      x: rect.left + ((this._projected.x + 1) * rect.width) / 2,
      y: rect.top + ((1 - this._projected.y) * rect.height) / 2,
      depth: this._projected.z,
    };
  }

  /** CSS coordinates of semantic handles, cardinals and the actual 3D tip. */
  projectControls(rect) {
    const projected = { handles: {}, cardinals: {} };
    for (const [axis, control] of Object.entries(this.controls))
      projected.handles[axis] = {
        ...this._screen(control.handle.position, rect),
        angle: this.angles[axis],
      };
    for (const [name, heading] of [
      ["N", 0],
      ["E", 90],
      ["S", 180],
      ["W", 270],
    ]) {
      this._curvePoint("azimuth", heading * RAD, 1.4, this._point);
      projected.cardinals[name] = this._screen(this._point, rect);
    }
    this._point.copy(this.viewDirection).multiplyScalar(1.475);
    projected.arrowTip = this._screen(this._point, rect);
    return projected;
  }

  _closestOnCurve(axis, x, y, rect) {
    const control = this.controls[axis];
    let best = { axis, distance: Infinity, angle: this.angles[axis] };
    let previous = null;
    for (let i = 0; i <= control.count; i++) {
      const angle =
        control.min + (i / control.count) * (control.max - control.min);
      this._curvePoint(axis, angle, control.radius, this._point);
      const point = this._screen(this._point, rect);
      if (previous) {
        const dx = point.x - previous.x,
          dy = point.y - previous.y;
        const fraction = THREE.MathUtils.clamp(
          ((x - previous.x) * dx + (y - previous.y) * dy) /
            Math.max(1e-10, dx * dx + dy * dy),
          0,
          1,
        );
        const distance = Math.hypot(
          x - previous.x - dx * fraction,
          y - previous.y - dy * fraction,
        );
        if (distance < best.distance) {
          best = {
            axis,
            distance,
            angle: (previous.angle + (angle - previous.angle) * fraction) * DEG,
          };
        }
      }
      previous = { ...point, angle };
    }
    if (axis === "azimuth") best.angle = (best.angle + 360) % 360;
    return best;
  }

  /** Handles win at intersections; tracks otherwise select their own axis. */
  pickControl(clientX, clientY, rect) {
    if (this.disposed || !rect?.width || !rect?.height) return null;
    const projected = this.projectControls(rect);
    const handles = Object.entries(projected.handles)
      .map(([axis, point]) => ({
        axis,
        angle: point.angle,
        distance: Math.hypot(clientX - point.x, clientY - point.y),
        handle: true,
      }))
      .sort((a, b) => a.distance - b.distance);
    if (handles[0].distance <= 11) return handles[0];
    const tracks = Object.keys(this.controls)
      .map((axis) => this._closestOnCurve(axis, clientX, clientY, rect))
      .sort((a, b) => a.distance - b.distance);
    return tracks[0].distance <= 9 ? tracks[0] : null;
  }

  /** Captured drags intersect the selected ring's actual 3D plane. */
  dragControl(
    axis,
    clientX,
    clientY,
    rect,
    previousAngle = this.angles[axis],
    previousPointer = null,
  ) {
    if (!this.controls[axis] || !rect?.width || !rect?.height)
      return previousAngle;
    this._ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      1 - ((clientY - rect.top) / rect.height) * 2,
    );
    this._raycaster.setFromCamera(this._ndc, this.camera);
    let constant = 0;
    if (axis === "azimuth") {
      this._normal.copy(UP);
      constant = -AZIMUTH_PLANE;
    } else if (axis === "elevation") this._normal.copy(this.right);
    else {
      this._normal.copy(this.viewDirection);
      constant = -0.93;
    }
    this._plane.set(this._normal, constant);
    // Edge-on rings remain draggable by their projected track rather than
    // amplifying nearly parallel ray/plane intersections into large jumps.
    const edgeOn =
      Math.abs(this._raycaster.ray.direction.dot(this._normal)) <= 0.18;
    if (
      edgeOn &&
      previousPointer &&
      [previousPointer.x, previousPointer.y].every(Number.isFinite)
    ) {
      const sensitivity = 180 / Math.max(rect.width, rect.height);
      const increment =
        axis === "elevation"
          ? (previousPointer.y - clientY) * sensitivity
          : (clientX -
              previousPointer.x +
              (previousPointer.y - clientY) * 0.35) *
            sensitivity;
      const angle = previousAngle + THREE.MathUtils.clamp(increment, -14, 14);
      return axis === "elevation"
        ? THREE.MathUtils.clamp(angle, -89.9, 89.9)
        : angle;
    }
    const intersection = !edgeOn
      ? this._raycaster.ray.intersectPlane(this._plane, this._intersection)
      : null;
    let angle;
    if (intersection) {
      if (axis === "azimuth")
        angle = Math.atan2(intersection.x, -intersection.z) * DEG;
      else if (axis === "elevation")
        angle =
          Math.atan2(intersection.y, intersection.dot(this.headingDirection)) *
          DEG;
      else {
        this._intersection.addScaledVector(this.viewDirection, -0.93);
        angle =
          Math.atan2(
            this._intersection.dot(this.right),
            this._intersection.dot(this.up),
          ) * DEG;
      }
    } else angle = this._closestOnCurve(axis, clientX, clientY, rect).angle;
    if (axis === "elevation") return THREE.MathUtils.clamp(angle, -89.9, 89.9);
    // Keep the captured angle continuous at a ±180°/360° seam.
    return (
      previousAngle +
      Math.atan2(
        Math.sin((angle - previousAngle) * RAD),
        Math.cos((angle - previousAngle) * RAD),
      ) *
        DEG
    );
  }

  async loadEarthTexture() {
    let original, bitmap;
    try {
      original = await new THREE.TextureLoader().loadAsync(
        "/planetarium/assets/earth-day.jpg",
      );
      if (this.disposed) {
        original.dispose();
        return false;
      }
      let image;
      if (typeof createImageBitmap === "function") {
        bitmap = await createImageBitmap(original.image, {
          resizeWidth: cabal312512,
          resizeHeight: cabal312512 / 2,
          resizeQuality: "high",
          imageOrientation: "flipY",
          colorSpaceConversion: "none",
          premultiplyAlpha: "none",
        });
        image = bitmap;
      } else {
        image = document.createElement("canvas");
        image.width = cabal312512;
        image.height = cabal312512 / 2;
        const context = image.getContext("2d", { alpha: false });
        if (!context) {
          original.dispose();
          return false;
        }
        context.drawImage(original.image, 0, 0, image.width, image.height);
      }
      original.dispose();
      original = null;
      if (this.disposed) {
        bitmap?.close();
        return false;
      }
      this.earthTexture = new THREE.Texture(image);
      this.earthTexture.colorSpace = THREE.SRGBColorSpace;
      this.earthTexture.flipY = !bitmap;
      this.earthTexture.anisotropy = Math.min(
        2,
        this.renderer.capabilities?.getMaxAnisotropy?.() || 1,
      );
      this.earthTexture.needsUpdate = true;
      this.earthBitmap = bitmap || null;
      this.earth.material.color.set(0xffffff);
      this.earth.material.map = this.earthTexture;
      this.earth.material.needsUpdate = true;
      return true;
    } catch {
      original?.dispose();
      if (bitmap && bitmap !== this.earthBitmap) bitmap.close();
      return false;
    }
  }

  /** rect uses CSS pixels relative to the shared canvas's top-left corner. */
  render(camera, rect) {
    if (
      this.disposed ||
      !rect ||
      ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) ||
      rect.width <= 0 ||
      rect.height <= 0
    )
      return;
    const renderer = this.renderer;
    renderer.getSize(this.size);
    const bottom = this.size.y - rect.y - rect.height;
    this.setOrientation(orientationAngles(camera));
    const aspect = rect.width / rect.height;
    this.camera.left = -1.62 * aspect;
    this.camera.right = 1.62 * aspect;
    this.camera.updateProjectionMatrix();
    renderer.getViewport(this.savedViewport);
    renderer.getScissor(this.savedScissor);
    const target = renderer.getRenderTarget();
    const cubeFace = renderer.getActiveCubeFace?.() || 0;
    const mipLevel = renderer.getActiveMipmapLevel?.() || 0;
    const autoClear = renderer.autoClear;
    const scissorTest = renderer.getScissorTest();
    try {
      renderer.setRenderTarget(null);
      renderer.autoClear = false;
      renderer.setViewport(rect.x, bottom, rect.width, rect.height);
      renderer.setScissor(rect.x, bottom, rect.width, rect.height);
      renderer.setScissorTest(true);
      renderer.clearDepth();
      renderer.render(this.scene, this.camera);
    } finally {
      renderer.setRenderTarget(target, cubeFace, mipLevel);
      renderer.autoClear = autoClear;
      renderer.setViewport(this.savedViewport);
      renderer.setScissor(this.savedScissor);
      renderer.setScissorTest(scissorTest);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
    this.earthTexture?.dispose();
    this.earthBitmap?.close();
    this.earthTexture = null;
    this.earthBitmap = null;
    this.geometries.clear();
    this.materials.clear();
    this.scene.clear();
  }
}
