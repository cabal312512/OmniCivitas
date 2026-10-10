import {
  AdditiveBlending,
  AmbientLight,
  BackSide,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Quaternion,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  Vector2,
} from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { orbitGuideSamples } from "./orbit-guides.mjs";
import {
  readableAngularStep,
  SPIN_VISUAL_RADIANS_PER_SECOND,
  trajectoryPosition,
  wrappedPhaseCorrection,
} from "./continuous-motion.mjs";

const AU_KM = 149_597_870.7;
const DAY_MS = 86_400_000;
const UP = new Vector3(0, 1, 0);
// IAU nominal sidereal spin rates. Snapshots supply the absolute phase; these
// inexpensive derivatives keep that phase moving between Worker responses.
const SPIN_DEGREES_PER_DAY = Object.freeze({
  sun: 14.1844,
  mercury: 6.1385108,
  venus: -1.4813688,
  earth: 360.9856235,
  moon: 13.17635815,
  mars: 350.89198226,
  jupiter: 870.536,
  saturn: 810.7939024,
  uranus: -501.1600928,
  neptune: 541.1397757,
});
const BODY_STYLE = Object.freeze({
  sun: { label: "Sun", radius: 2.5, color: 0xffd991, map: "sun" },
  mercury: { label: "Mercury", radius: 0.38, color: 0x9d9389, map: "mercury" },
  venus: { label: "Venus", radius: 0.65, color: 0xd8bf87, map: "venus" },
  earth: { label: "Earth", radius: 0.7, color: 0x467cab, map: "earth-day" },
  moon: { label: "Moon", radius: 0.19, color: 0xb6b5b1, map: "moon" },
  mars: { label: "Mars", radius: 0.49, color: 0xb77551, map: "mars" },
  jupiter: { label: "Jupiter", radius: 1.66, color: 0xcfb9a0, map: "jupiter" },
  saturn: { label: "Saturn", radius: 1.36, color: 0xd4c49d, map: "saturn" },
  uranus: { label: "Uranus", radius: 0.93, color: 0x92cecf, map: "uranus" },
  neptune: { label: "Neptune", radius: 0.9, color: 0x427bbc, map: "neptune" },
});
const ORBIT_TINT = Object.freeze({
  mercury: 0xb6b9c4,
  venus: 0xc8bfa1,
  earth: 0x82c0e5,
  mars: 0xcaa291,
  jupiter: 0xc7bda9,
  saturn: 0xc9c4ad,
  uranus: 0x9bc6c9,
  neptune: 0x98add3,
});

/** J2000 equatorial vectors: keep one right-handed basis for every object. */
function toWorld(vector, target = new Vector3()) {
  return target.set(vector[0], vector[2], -vector[1]);
}

function validVector(value) {
  return (
    Array.isArray(value) &&
    value.length >= 3 &&
    value.slice(0, 3).every(Number.isFinite)
  );
}

function displayPosition(vector, physical, target = new Vector3()) {
  toWorld(vector, target);
  const distance = target.length();
  if (distance < 1e-12) return target.set(0, 0, 0);
  return target.multiplyScalar(
    (physical ? distance * 14 : 6 + 17 * Math.log1p(distance)) / distance,
  );
}

/** A thin optical limb; geometry/illumination, never a textured blue billboard. */
function limbMaterial(color, strength = 1, sun = false) {
  return new ShaderMaterial({
    uniforms: {
      lightDirection: { value: new Vector3(1, 0, 0) },
      tint: { value: new Color(color) },
      strength: { value: strength },
      stellar: { value: sun ? 1 : 0 },
    },
    vertexShader: `
      varying vec3 vNormalWorld;
      varying vec3 vEyeWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        vEyeWorld = cameraPosition - world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 lightDirection;
      uniform vec3 tint;
      uniform float strength;
      uniform float stellar;
      varying vec3 vNormalWorld;
      varying vec3 vEyeWorld;
      void main() {
        vec3 n = normalize(vNormalWorld);
        float facing = abs(dot(n, normalize(vEyeWorld)));
        float limb = pow(1.0 - facing, 3.1);
        float incidence = dot(n, normalize(lightDirection));
        float day = smoothstep(-0.24, 0.38, incidence);
        float twilight = (1.0 - smoothstep(0.02, 0.35, abs(incidence))) * 0.38;
        vec3 radiance = tint * (0.12 + 0.95 * day);
        radiance += vec3(1.0, 0.26, 0.055) * twilight;
        radiance = mix(radiance, tint, stellar);
        float projectedRadius = sqrt(max(0.0, 1.0 - facing * facing));
        // An atmosphere limb brightens at tangency; a stellar optical halo
        // instead decays to zero there, avoiding the enclosing sphere's edge.
        float halo = exp(-max(0.0, projectedRadius - 0.81) * 10.0);
        halo *= 1.0 - smoothstep(0.80, 1.0, projectedRadius);
        float alpha = mix(limb * (0.22 + day * 0.78), halo, stellar) * strength;
        gl_FragColor = vec4(radiance, alpha);
      }
    `,
    side: BackSide,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

/**
 * Extend Three's maintained Phong/physical shaders with analytical masks.
 * Lighting still comes from the real Sun direction; display distances/radii
 * are deliberately representational unless options.scale === 'true'.
 */
function addSolarCoordinates(material, fragmentPatch, uniforms, key) {
  material.customProgramCacheKey = () => `planetarium-${key}-v1`;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `varying vec3 vSolarPosition;\nvarying vec3 vSolarNormal;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `
      #include <worldpos_vertex>
      vSolarPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vSolarNormal = normalize(mat3(modelMatrix) * normal);
    `,
    );
    shader.fragmentShader = `
      varying vec3 vSolarPosition;
      varying vec3 vSolarNormal;
      uniform vec3 uSolarLight;
      uniform vec3 uSolarCenter;
      uniform vec3 uSolarPole;
      uniform float uPlanetRadius;
      uniform float uRingInner;
      uniform float uRingOuter;
      ${shader.fragmentShader}
    `;
    shader.fragmentShader = fragmentPatch(shader.fragmentShader);
  };
}

/**
 * Solar-system presentation, independent of DOM, input controls and ephemeris.
 * The caller supplies immutable astronomical snapshots and cached orbit paths.
 * Owns only its objects/resources: no RAF, network APIs or renderer settings.
 */
export class SolarScene {
  constructor(
    scene,
    { renderer, onSelect = null, assetBase = "/planetarium/assets/" } = {},
  ) {
    this.scene = scene;
    this.renderer = renderer;
    this.onSelect = onSelect;
    this.assetBase = assetBase.endsWith("/") ? assetBase : `${assetBase}/`;
    this.root = new Group();
    this.root.name = "planetarium-solar-system";
    this.root.visible = false;
    scene.add(this.root);
    this.options = { orbits: true, scale: "display", atmosphere: true };
    this.bodies = new Map();
    this.orbits = new Map();
    this.orbitPaths = null;
    this.texturePromises = new Map();
    this.textures = new Set();
    this.geometries = new Set();
    this.materials = new Set();
    this.assetQueue = [];
    this.requestedAssets = new Set();
    this.loadingAssets = false;
    this.disposed = false;
    this.age = 0;
    this.lastSnapshot = null;
    this._targetScale = null;
    this._snapshotTimeMs = NaN;
    this._renderTimeMs = NaN;
    this._positionedBodies = [];
    this.selectedId = "earth";
    this._scratch = new Vector3();
    this._moonRelative = new Vector3();
    this._earthTrue = new Vector3();
    this._motionPoint = [0, 0, 0];
    this._motionEarth = [0, 0, 0];
    this._motionWorldEarth = new Vector3();
    this._textureLoader = new TextureLoader();
    this._anisotropy = Math.min(
      8,
      renderer?.capabilities?.getMaxAnisotropy?.() || 1,
    );
    this._selectionStarted = -Infinity;
    this._selectionBody = null;
    this._frameRight = new Vector3();
    this._frameUp = new Vector3();
    this._framePoint = new Vector3();
    this._orbitResolution = new Vector2(1, 1);
    this._orbitMarkerGeometry = this._geometry(new PlaneGeometry(2, 2));

    this.sphere = this._geometry(new SphereGeometry(1, 96, 64));
    this.moonSphere = this._geometry(new SphereGeometry(1, 128, 64));
    this.sunLight = new PointLight(0xfff5e5, 3.1, 0, 0);
    this.root.add(this.sunLight, new AmbientLight(0xb9d2ef, 0.042));

    for (const [id, style] of Object.entries(BODY_STYLE))
      this._createBody(id, style);
    this._createSelectionFrame();
  }

  _geometry(geometry) {
    this.geometries.add(geometry);
    return geometry;
  }

  _material(material) {
    this.materials.add(material);
    return material;
  }

  _createBody(id, style) {
    const positionGroup = new Group();
    const axis = new Group();
    const surface = new Group();
    positionGroup.name = `planetarium-${id}`;
    positionGroup.visible = false;
    positionGroup.add(axis);
    axis.add(surface);
    this.root.add(positionGroup);

    const material = this._material(
      id === "sun"
        ? new MeshBasicMaterial({
            color: new Color(2.9, 2.35, 1.65),
            toneMapped: false,
          })
        : id === "earth"
          ? new MeshPhongMaterial({
              color: style.color,
              shininess: 32,
              specular: 0x40546a,
              emissive: 0xffffff,
              emissiveIntensity: 1.25,
            })
          : new MeshStandardMaterial({
              color: style.color,
              roughness: id === "venus" ? 0.9 : 0.96,
              metalness: 0,
              dithering: true,
            }),
    );
    const mesh = new Mesh(
      id === "moon" ? this.moonSphere : this.sphere,
      material,
    );
    mesh.userData.planetariumId = id;
    surface.add(mesh);
    const uniforms = {
      uSolarLight: { value: new Vector3(1, 0, 0) },
      uSolarCenter: { value: new Vector3() },
      uSolarPole: { value: new Vector3(0, 1, 0) },
      uPlanetRadius: { value: style.radius },
      uRingInner: { value: style.radius * 1.24 },
      uRingOuter: { value: style.radius * 2.32 },
    };
    const body = {
      id,
      style,
      positionGroup,
      axis,
      surface,
      mesh,
      material,
      uniforms,
      radius: style.radius,
      positioned: false,
      targetPosition: new Vector3(),
      renderPosition: new Vector3(),
      targetQuaternion: new Quaternion(),
      targetRotation: 0,
      rotationRate: MathUtils.degToRad(SPIN_DEGREES_PER_DAY[id] || 0) / DAY_MS,
    };
    this.bodies.set(id, body);

    if (id === "earth") {
      addSolarCoordinates(
        material,
        (fragment) =>
          fragment.replace(
            "#include <emissivemap_fragment>",
            `
        #include <emissivemap_fragment>
        float solarNight = 1.0 - smoothstep(-0.13, 0.06, dot(normalize(vSolarNormal), normalize(uSolarLight)));
        totalEmissiveRadiance *= solarNight;
      `,
          ),
        uniforms,
        "earth-night",
      );
      // The night layer starts dark until its real map has arrived.
      material.emissiveIntensity = 0;
      const cloudMaterial = this._material(
        new MeshStandardMaterial({
          color: 0xffffff,
          roughness: 1,
          metalness: 0,
          transparent: true,
          opacity: 0.78,
          depthWrite: false,
          alphaTest: 0.035,
        }),
      );
      body.clouds = new Mesh(this.sphere, cloudMaterial);
      body.clouds.scale.setScalar(1.009);
      body.clouds.visible = false;
      body.clouds.userData.planetariumId = id;
      surface.add(body.clouds);
      const atmosphereMaterial = this._material(limbMaterial(0x4d9dff, 0.85));
      body.atmosphere = new Mesh(this.sphere, atmosphereMaterial);
      body.atmosphere.scale.setScalar(1.038);
      axis.add(body.atmosphere);
    } else if (id === "sun") {
      body.atmosphere = new Mesh(
        this.sphere,
        this._material(limbMaterial(0xffa84a, 0.28, true)),
      );
      body.atmosphere.scale.setScalar(1.12);
      axis.add(body.atmosphere);
    } else if (id === "saturn") {
      const ringGeometry = this._geometry(new RingGeometry(1.24, 2.32, 192, 1));
      const vertices = ringGeometry.attributes.position;
      const uv = ringGeometry.attributes.uv;
      for (let index = 0; index < vertices.count; index++) {
        const radius = Math.hypot(vertices.getX(index), vertices.getY(index));
        uv.setXY(index, (radius - 1.24) / (2.32 - 1.24), 0.5);
      }
      const ringMaterial = this._material(
        new MeshStandardMaterial({
          color: 0xd9cfb1,
          roughness: 1,
          metalness: 0,
          side: DoubleSide,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
          alphaTest: 0.045,
          emissive: 0xffffff,
          emissiveIntensity: 0,
        }),
      );
      body.ring = new Mesh(ringGeometry, ringMaterial);
      body.ring.rotation.x = -Math.PI / 2;
      body.ring.userData.planetariumId = id;
      axis.add(body.ring);
      addSolarCoordinates(
        ringMaterial,
        (fragment) =>
          fragment.replace(
            "#include <opaque_fragment>",
            `
        vec3 ringPoint = vSolarPosition - uSolarCenter;
        vec3 sunDirection = normalize(uSolarLight);
        float alongSun = dot(ringPoint, sunDirection);
        float rayDistance = length(ringPoint - sunDirection * alongSun);
        float planetShadow = (1.0 - smoothstep(uPlanetRadius * 0.97, uPlanetRadius * 1.035, rayDistance)) * step(alongSun, 0.0);
        outgoingLight *= 1.0 - planetShadow * 0.91;
        #include <opaque_fragment>
      `,
          ),
        uniforms,
        "ring-shadow",
      );
      addSolarCoordinates(
        material,
        (fragment) =>
          fragment.replace(
            "#include <opaque_fragment>",
            `
        vec3 surfacePoint = vSolarPosition - uSolarCenter;
        float ringDenominator = dot(normalize(uSolarLight), normalize(uSolarPole));
        float ringIntersection = -dot(surfacePoint, normalize(uSolarPole)) / (abs(ringDenominator) > 0.0001 ? ringDenominator : 0.0001);
        vec3 ringPoint = surfacePoint + normalize(uSolarLight) * ringIntersection;
        float radial = length(ringPoint);
        float ringShadow = smoothstep(uRingInner, uRingInner * 1.025, radial) * (1.0 - smoothstep(uRingOuter * 0.985, uRingOuter, radial));
        ringShadow *= step(0.0, ringIntersection) * smoothstep(0.01, 0.04, abs(ringDenominator));
        outgoingLight *= 1.0 - ringShadow * 0.48;
        #include <opaque_fragment>
      `,
          ),
        uniforms,
        "saturn-ring-shadow",
      );
    }
    if (["venus", "mars", "jupiter", "uranus", "neptune"].includes(id)) {
      const atmosphereColors = {
        venus: 0xe8c795,
        mars: 0xd29772,
        jupiter: 0xdacaa8,
        uranus: 0x9ee0e2,
        neptune: 0x87b8f8,
      };
      const strength = id === "mars" ? 0.11 : id === "venus" ? 0.24 : 0.17;
      body.atmosphere = new Mesh(
        this.sphere,
        this._material(limbMaterial(atmosphereColors[id], strength)),
      );
      body.atmosphere.scale.setScalar(id === "venus" ? 1.025 : 1.015);
      axis.add(body.atmosphere);
    }
    this._setBodyRadius(body, style.radius);
  }

  _setBodyRadius(body, radius) {
    body.radius = radius;
    body.axis.scale.setScalar(radius);
    body.uniforms.uPlanetRadius.value = radius;
    body.uniforms.uRingInner.value = radius * 1.24;
    body.uniforms.uRingOuter.value = radius * 2.32;
  }

  _createSelectionFrame() {
    const material = this._material(
      new ShaderMaterial({
        uniforms: { progress: { value: 0 }, opacity: { value: 0 } },
        vertexShader: `
        varying vec2 vFrameUv;
        void main() {
          vFrameUv = uv * 2.0 - 1.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
        fragmentShader: `
        uniform float progress;
        uniform float opacity;
        varying vec2 vFrameUv;
        void main() {
          vec2 p = vFrameUv;
          vec2 a = abs(p);
          float edge = 0.83;
          float pixel = max(fwidth(p.x), fwidth(p.y));
          float vertical = 1.0 - smoothstep(pixel * 0.35, pixel * 1.25, abs(a.x - edge));
          float horizontal = 1.0 - smoothstep(pixel * 0.35, pixel * 1.25, abs(a.y - edge));
          float shortSide = smoothstep(0.47, 0.51, a.x) * (1.0 - smoothstep(edge, edge + pixel, a.x));
          float tallSide = smoothstep(0.47, 0.51, a.y) * (1.0 - smoothstep(edge, edge + pixel, a.y));
          float brackets = max(vertical * tallSide, horizontal * shortSide);
          float radius = length(p);
          float arcRadius = 0.72 + 0.10 * progress;
          float angle = atan(p.y, p.x);
          float arc = 1.0 - smoothstep(pixel * 0.4, pixel * 1.25, abs(radius - arcRadius));
          float segments = smoothstep(0.76, 0.84, abs(sin(angle * 2.0 + 0.45)));
          float halo = exp(-abs(radius - arcRadius) / max(pixel * 3.4, 0.001)) * segments * 0.12;
          vec3 tint = mix(vec3(0.39, 0.72, 0.94), vec3(0.93, 0.98, 1.0), brackets);
          float alpha = (brackets + arc * segments * 0.27 + halo) * opacity;
          gl_FragColor = vec4(tint * 1.35, alpha);
        }
      `,
        transparent: true,
        blending: AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.selectionFrame = new Mesh(
      this._geometry(new PlaneGeometry(2, 2)),
      material,
    );
    this.selectionFrame.name = "planetarium-selection-frame";
    this.selectionFrame.visible = false;
    this.selectionFrame.frustumCulled = false;
    this.selectionFrame.renderOrder = 40;
    this.root.add(this.selectionFrame);
  }

  /** One shared GPU overlay, retriggered on a click without scheduling a timer. */
  flashSelection(id) {
    const body = this.bodies.get(id);
    if (!body?.positioned || this.disposed) return false;
    this._selectionBody = body;
    this._selectionStarted = performance.now();
    this.selectionFrame.visible = this.root.visible;
    return true;
  }

  /** Run after the caller updates its controls; no second animation loop. */
  updateSelection(camera) {
    this._updateOrbitAccents(camera);
    const body = this._selectionBody;
    const elapsed = (performance.now() - this._selectionStarted) / 1000;
    if (!camera || !body || !this.root.visible || elapsed >= 1.1) {
      this.selectionFrame.visible = false;
      return;
    }
    const position = body.positionGroup.position;
    const distance = camera.position.distanceTo(position);
    const height = Math.max(1, this.renderer?.domElement?.clientHeight || 800);
    const apparentRadius =
      (distance * Math.tan(MathUtils.degToRad(camera.fov || 45) / 2) * 64) /
      height;
    const framingRadius = body.radius * (body.id === "saturn" ? 2.32 : 1);
    const enter = 1 - Math.pow(1 - Math.min(1, elapsed / 0.16), 3);
    const scale =
      Math.max(framingRadius * 1.27, apparentRadius) * (1.025 - enter * 0.025);
    this.selectionFrame.position.copy(position);
    this.selectionFrame.quaternion.copy(camera.quaternion);
    this.selectionFrame.scale.setScalar(scale);
    this.selectionFrame.material.uniforms.progress.value = Math.min(
      1,
      elapsed / 1.1,
    );
    this.selectionFrame.material.uniforms.opacity.value =
      enter * (1 - MathUtils.smoothstep(elapsed, 0.43, 1.1));
    this.selectionFrame.visible = true;
  }

  getScreenBounds(id, camera, viewport = {}) {
    const body = this.bodies.get(id);
    if (!body?.positioned || !camera) return null;
    const width = Math.max(
      1,
      viewport.width || this.renderer?.domElement?.clientWidth || 1,
    );
    const height = Math.max(
      1,
      viewport.height || this.renderer?.domElement?.clientHeight || 1,
    );
    const radius = body.radius * (id === "saturn" ? 2.32 : 1);
    const centre = body.positionGroup.getWorldPosition(this._scratch).clone();
    const projected = centre.clone().project(camera);
    this._frameRight
      .set(1, 0, 0)
      .applyQuaternion(camera.quaternion)
      .multiplyScalar(radius);
    this._frameUp
      .set(0, 1, 0)
      .applyQuaternion(camera.quaternion)
      .multiplyScalar(radius);
    this._framePoint.copy(centre).add(this._frameRight).project(camera);
    const rx = (Math.abs(this._framePoint.x - projected.x) * width) / 2;
    this._framePoint.copy(centre).add(this._frameUp).project(camera);
    const ry = (Math.abs(this._framePoint.y - projected.y) * height) / 2;
    return {
      id,
      x: ((projected.x + 1) * width) / 2,
      y: ((1 - projected.y) * height) / 2,
      width: rx * 2,
      height: ry * 2,
      visible:
        projected.z >= -1 &&
        projected.z <= 1 &&
        Math.abs(projected.x) <= 1 &&
        Math.abs(projected.y) <= 1,
    };
  }

  _loadTexture(filename, color = true) {
    const key = `${filename}:${color}`;
    if (this.texturePromises.has(key)) return this.texturePromises.get(key);
    const promise = new Promise((resolve) => {
      const texture = this._textureLoader.load(
        `${this.assetBase}${filename}`,
        (loaded) => {
          if (this.disposed) {
            loaded.dispose();
            resolve(null);
            return;
          }
          if (color) loaded.colorSpace = SRGBColorSpace;
          loaded.anisotropy = this._anisotropy;
          loaded.needsUpdate = true;
          resolve(loaded);
        },
        undefined,
        () => resolve(null),
      );
      this.textures.add(texture);
    });
    this.texturePromises.set(key, promise);
    return promise;
  }

  _queueAssets(id, priority = false) {
    if (!this.bodies.has(id) || this.disposed) return;
    if (this.requestedAssets.has(id)) {
      if (priority) {
        const index = this.assetQueue.indexOf(id);
        if (index > 0) {
          this.assetQueue.splice(index, 1);
          this.assetQueue.unshift(id);
        }
      }
      return;
    }
    this.requestedAssets.add(id);
    if (priority) this.assetQueue.unshift(id);
    else this.assetQueue.push(id);
    void this._drainAssetQueue();
  }

  async _drainAssetQueue() {
    if (this.loadingAssets || this.disposed) return;
    this.loadingAssets = true;
    while (this.assetQueue.length && !this.disposed) {
      const id = this.assetQueue.shift();
      await this._loadBodyAssets(id);
    }
    this.loadingAssets = false;
  }

  async _loadBodyAssets(id) {
    const body = this.bodies.get(id);
    const day = await this._loadTexture(`${body.style.map}.jpg`);
    if (this.disposed) return;
    if (day) {
      body.material.map = day;
      if (id !== "sun") body.material.color.set(0xffffff);
      body.material.needsUpdate = true;
    }
    if (id === "earth") {
      const [night, clouds, normal, specular] = await Promise.all([
        this._loadTexture("earth-night.jpg"),
        this._loadTexture("earth-clouds.jpg", false),
        this._loadTexture("earth-normal.jpg", false),
        this._loadTexture("earth-specular.jpg", false),
      ]);
      if (this.disposed) return;
      if (night) {
        body.material.emissiveMap = night;
        body.material.emissiveIntensity = 1.25;
      }
      if (normal) {
        body.material.normalMap = normal;
        body.material.normalScale.set(0.3, 0.3);
      }
      if (specular) body.material.specularMap = specular;
      if (clouds) {
        body.clouds.material.alphaMap = clouds;
        body.clouds.visible = true;
        body.clouds.material.needsUpdate = true;
      }
      body.material.needsUpdate = true;
    } else if (id === "moon") {
      const relief = await this._loadTexture("moon-height.jpg", false);
      if (this.disposed) return;
      if (relief) {
        body.material.bumpMap = relief;
        body.material.bumpScale = 0.008;
        body.material.needsUpdate = true;
      }
    } else if (id === "saturn") {
      const ring = await this._loadTexture("saturn-ring.png");
      if (this.disposed) return;
      if (ring) {
        body.ring.material.map = ring;
        body.ring.material.color.set(0xffffff);
        // A restrained texture-matched fill keeps the thin icy bands readable
        // at equinox; the analytical planetary shadow still masks all light.
        body.ring.material.emissiveMap = ring;
        body.ring.material.emissiveIntensity = 0.36;
        body.ring.material.needsUpdate = true;
      }
    }
  }

  setVisible(visible) {
    if (this.disposed) return;
    this.root.visible = Boolean(visible);
    if (visible) {
      this._queueAssets(this.selectedId, true);
      this._queueAssets("sun");
      this._queueAssets("earth");
      this._queueAssets("saturn");
      for (const id of this.bodies.keys()) this._queueAssets(id);
    }
  }

  setOptions(options = {}) {
    if (this.disposed) return;
    const oldScale = this.options.scale;
    if ("orbits" in options) this.options.orbits = Boolean(options.orbits);
    if ("atmosphere" in options)
      this.options.atmosphere = Boolean(options.atmosphere);
    if ("scale" in options)
      this.options.scale =
        options.scale === "true" || options.scale === "physical"
          ? "true"
          : "display";
    if (options.orbitPaths) this.orbitPaths = options.orbitPaths;
    if (options.orbitPaths || oldScale !== this.options.scale)
      this._rebuildOrbits();
    for (const orbit of this.orbits.values())
      orbit.visible = this.options.orbits;
    if (oldScale !== this.options.scale && this.lastSnapshot)
      this.update(this.lastSnapshot, 0, this.selectedId);
  }

  _rebuildOrbits() {
    for (const orbit of this.orbits.values()) {
      this.root.remove(orbit);
      orbit.traverse((object) => {
        if (
          object.geometry &&
          object.geometry !== this._orbitMarkerGeometry &&
          this.geometries.has(object.geometry)
        ) {
          object.geometry.dispose();
          this.geometries.delete(object.geometry);
        }
        if (object.material) {
          object.material.dispose();
          this.materials.delete(object.material);
        }
      });
    }
    this.orbits.clear();
    if (!this.orbitPaths) return;
    for (const [id, samples] of Object.entries(this.orbitPaths)) {
      if (!this.bodies.has(id) || !ORBIT_TINT[id]) continue;
      const guide = orbitGuideSamples(samples, this.options.scale === "true");
      if (!guide) continue;
      const orbit = new Group();
      const geometry = this._geometry(
        new LineGeometry().setPositions(guide.positions),
      );
      // Pixel-scale lines remain restrained in a close pass and readable in
      // the system overview; there are no world-sized glowing orbit tubes.
      for (const [width, opacity] of [
        [3.8, 0.036],
        [0.88, id === "earth" ? 0.3 : 0.21],
      ]) {
        const material = this._material(
          new LineMaterial({
            color: ORBIT_TINT[id],
            linewidth: width,
            opacity,
            transparent: true,
            depthWrite: false,
            toneMapped: false,
            ...(width > 1 ? { blending: AdditiveBlending } : {}),
          }),
        );
        material.resolution.copy(this._orbitResolution);
        const path = new Line2(geometry, material);
        path.frustumCulled = false;
        orbit.add(path);
      }
      const tickGeometry = this._geometry(
        new BufferGeometry().setAttribute(
          "position",
          new Float32BufferAttribute(guide.ticks, 3),
        ),
      );
      orbit.add(
        new LineSegments(
          tickGeometry,
          this._material(
            new LineBasicMaterial({
              color: ORBIT_TINT[id],
              opacity: 0.24,
              transparent: true,
              depthWrite: false,
              toneMapped: false,
            }),
          ),
        ),
      );
      const marker = new Mesh(
        this._orbitMarkerGeometry,
        this._material(
          new ShaderMaterial({
            uniforms: {
              tint: { value: new Color(ORBIT_TINT[id]) },
              opacity: { value: 0.25 },
            },
            vertexShader:
              "varying vec2 vMarker;void main(){vMarker=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
            fragmentShader: `varying vec2 vMarker;uniform vec3 tint;uniform float opacity;
          void main(){float r=length(vMarker);float px=max(fwidth(r),.002);float ring=1.0-smoothstep(px*.35,px*1.2,abs(r-.85));
          float angle=atan(vMarker.y,vMarker.x);float segments=smoothstep(.55,.64,abs(sin(angle*2.0)));
          float halo=exp(-abs(r-.85)/max(px*3.0,.01))*.09;
          gl_FragColor=vec4(tint*1.35,(ring*segments+halo)*opacity);}`,
            transparent: true,
            depthWrite: false,
            blending: AdditiveBlending,
            toneMapped: false,
          }),
        ),
      );
      marker.visible = false;
      marker.frustumCulled = false;
      marker.renderOrder = 10;
      orbit.userData.marker = marker;
      orbit.userData.planetariumId = id;
      orbit.add(marker);
      orbit.visible = this.options.orbits;
      orbit.name = `planetarium-orbit-${id}`;
      this.root.add(orbit);
      this.orbits.set(id, orbit);
    }
  }

  _updateOrbitAccents(camera) {
    if (
      !camera ||
      !this.root.visible ||
      !this.options.orbits ||
      !this.orbits.size
    )
      return;
    if (this.renderer?.getSize) this.renderer.getSize(this._orbitResolution);
    else
      this._orbitResolution.set(
        this.renderer?.domElement?.clientWidth || 1,
        this.renderer?.domElement?.clientHeight || 1,
      );
    const height = Math.max(1, this._orbitResolution.y);
    const field = Math.tan(MathUtils.degToRad(camera.fov || 45) / 2);
    for (const [id, orbit] of this.orbits) {
      for (const path of orbit.children)
        if (path.material?.isLineMaterial)
          path.material.resolution.copy(this._orbitResolution);
      const body = this.bodies.get(id);
      const marker = orbit.userData.marker;
      marker.visible = Boolean(body?.positioned && body.positionGroup.visible);
      if (!marker.visible) continue;
      marker.position.copy(body.positionGroup.position);
      marker.quaternion.copy(camera.quaternion);
      const radius = body.radius * (id === "saturn" ? 2.32 : 1);
      const screenRadius =
        (camera.position.distanceTo(marker.position) * field * 11) / height;
      marker.scale.setScalar(Math.max(radius * 1.45, screenRadius));
      marker.material.uniforms.opacity.value =
        id === this.selectedId ? 0.52 : 0.23;
    }
  }

  update(
    snapshot,
    dt = 0,
    selectedId = this.selectedId,
    simulationTimeMs = NaN,
  ) {
    if (this.disposed || !Array.isArray(snapshot?.bodies)) return;
    const elapsed = Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, 0.1));
    this.age += elapsed;
    this.selectedId = selectedId || this.selectedId;
    if (this.root.visible) this._queueAssets(this.selectedId, true);
    const physical = this.options.scale === "true";
    const scaleChanged = this._targetScale !== this.options.scale;

    const snapshotTimeMs = Date.parse(snapshot.time);
    const renderTimeMs = Number.isFinite(simulationTimeMs)
      ? simulationTimeMs
      : snapshotTimeMs;
    const renderDeltaMs =
      Number.isFinite(this._renderTimeMs) && Number.isFinite(renderTimeMs)
        ? renderTimeMs - this._renderTimeMs
        : 0;
    const renderSeek = Math.abs(renderDeltaMs) > DAY_MS * 45;

    // Snapshot coordinates establish physical radii, axial orientation and
    // absolute phase. Orbital positions come from the cached trajectory below.
    if (snapshot !== this.lastSnapshot || scaleChanged) {
      const earthSnapshot = snapshot.bodies.find((body) => body.id === "earth");
      const validEarth = earthSnapshot && validVector(earthSnapshot.position);
      if (validEarth) toWorld(earthSnapshot.position, this._earthTrue);
      this._positionedBodies.length = 0;
      let moonSnapshot = null;
      for (const data of snapshot.bodies) {
        if (data.id === "moon") {
          moonSnapshot = data;
          continue;
        }
        this._setSnapshotTarget(data, physical, scaleChanged);
      }
      if (moonSnapshot) {
        const body = this._setSnapshotTarget(
          moonSnapshot,
          physical,
          scaleChanged,
        );
        if (body && !physical && validEarth) {
          toWorld(moonSnapshot.position, this._moonRelative).sub(
            this._earthTrue,
          );
          if (this._moonRelative.lengthSq() > 1e-16) {
            const earth = this.bodies.get("earth");
            this._moonRelative.setLength(earth.radius * 3.6);
            body.targetPosition
              .copy(earth.targetPosition)
              .add(this._moonRelative);
            if (!body.positioned || scaleChanged)
              body.positionGroup.position.copy(body.targetPosition);
          }
        }
      }
      this.lastSnapshot = snapshot;
      this._targetScale = this.options.scale;
      this._snapshotTimeMs = snapshotTimeMs;
    }

    const phaseOffsetMs =
      Number.isFinite(renderTimeMs) && Number.isFinite(this._snapshotTimeMs)
        ? renderTimeMs - this._snapshotTimeMs
        : 0;
    const blend = 1 - Math.exp(-elapsed / 0.12);
    const earthTrack = snapshot.motion?.tracks?.earth;
    if (earthTrack) {
      trajectoryPosition(earthTrack, renderTimeMs, this._motionEarth);
      toWorld(this._motionEarth, this._motionWorldEarth);
    }
    for (const body of this._positionedBodies) {
      const track = snapshot.motion?.tracks?.[body.id];
      const continuousPosition =
        track && trajectoryPosition(track, renderTimeMs, this._motionPoint);
      if (continuousPosition) {
        displayPosition(continuousPosition, physical, body.renderPosition);
        if (body.id === "moon" && !physical && earthTrack) {
          toWorld(continuousPosition, this._moonRelative).sub(
            this._motionWorldEarth,
          );
          const earth = this.bodies.get("earth");
          this._moonRelative.setLength(earth.radius * 3.6);
          body.renderPosition
            .copy(earth.positionGroup.position)
            .add(this._moonRelative);
        }
      } else body.renderPosition.copy(body.targetPosition);
      const cabal312512SpinPhase =
        body.targetRotation + body.rotationRate * phaseOffsetMs;
      if (!body.positioned || scaleChanged || renderSeek) {
        body.positionGroup.position.copy(body.renderPosition);
        body.axis.quaternion.copy(body.targetQuaternion);
        body.surface.rotation.y = MathUtils.euclideanModulo(
          cabal312512SpinPhase,
          Math.PI * 2,
        );
      } else {
        if (continuousPosition)
          body.positionGroup.position.copy(body.renderPosition);
        else body.positionGroup.position.lerp(body.renderPosition, blend);
        body.axis.quaternion.slerp(body.targetQuaternion, blend);
        const physicalStep = body.rotationRate * renderDeltaMs;
        const visualStep = readableAngularStep(
          physicalStep,
          elapsed,
          SPIN_VISUAL_RADIANS_PER_SECOND,
        );
        const integrated = body.surface.rotation.y + visualStep;
        // At very high acceleration the texture's rotation is a readable
        // visualisation. Reconcile the real phase after playback slows/stops.
        const correction =
          Math.abs(physicalStep) <=
          SPIN_VISUAL_RADIANS_PER_SECOND * elapsed + 1e-8
            ? wrappedPhaseCorrection(
                integrated,
                cabal312512SpinPhase,
                elapsed,
                0.35,
              )
            : 0;
        body.surface.rotation.y = MathUtils.euclideanModulo(
          integrated + correction,
          Math.PI * 2,
        );
      }
      body.uniforms.uSolarCenter.value.copy(body.positionGroup.position);
      body.uniforms.uSolarLight.value
        .copy(body.positionGroup.position)
        .negate()
        .normalize();
      if (body.uniforms.uSolarLight.value.lengthSq() < 0.5)
        body.uniforms.uSolarLight.value.set(1, 0, 0);
      body.uniforms.uSolarPole.value
        .copy(UP)
        .applyQuaternion(body.axis.quaternion);
      if (body.atmosphere) {
        body.atmosphere.visible = this.options.atmosphere || body.id === "sun";
        body.atmosphere.material.uniforms.lightDirection.value.copy(
          body.uniforms.uSolarLight.value,
        );
      }
      if (body.clouds) body.clouds.rotation.y = this.age * 0.0025;
      body.positioned = true;
      body.positionGroup.visible = true;
    }
    this._renderTimeMs = renderTimeMs;
    this.root.updateMatrixWorld(true);
  }

  _setSnapshotTarget(data, physical, immediate) {
    const body = this.bodies.get(data.id);
    if (!body || !validVector(data.position)) return null;
    displayPosition(data.position, physical, body.targetPosition);
    if (validVector(data.north)) {
      toWorld(data.north, this._scratch).normalize();
      body.targetQuaternion.setFromUnitVectors(UP, this._scratch);
    }
    const degrees = Number.isFinite(data.rotationAngle)
      ? data.rotationAngle
      : 0;
    body.targetRotation = MathUtils.degToRad(degrees % 360);
    const radius =
      physical && Number.isFinite(data.radiusKm) && data.radiusKm > 0
        ? (data.radiusKm / AU_KM) * 14
        : body.style.radius;
    if (radius !== body.radius) this._setBodyRadius(body, radius);
    if (immediate) {
      body.positionGroup.position.copy(body.targetPosition);
      body.axis.quaternion.copy(body.targetQuaternion);
      body.surface.rotation.y = body.targetRotation;
    }
    this._positionedBodies.push(body);
    return body;
  }

  getTarget(id) {
    if (id === "system" || id === "solar-system") {
      let radius = 12;
      for (const body of this.bodies.values()) {
        if (body.positioned)
          radius = Math.max(
            radius,
            body.positionGroup.position.length() + body.radius * 2.4,
          );
      }
      return { position: new Vector3(), radius, label: "Solar System" };
    }
    const body = this.bodies.get(id);
    if (!body?.positioned) return null;
    return {
      position: body.positionGroup.getWorldPosition(new Vector3()),
      radius: body.radius,
      framingRadius: id === "saturn" ? body.radius * 2.32 : body.radius,
      up: new Vector3(0, 1, 0).transformDirection(body.axis.matrixWorld),
      label: body.style.label,
    };
  }

  pick(raycaster) {
    if (this.disposed || !this.root.visible) return null;
    const surfaces = [];
    for (const body of this.bodies.values()) {
      if (!body.positioned || !body.positionGroup.visible) continue;
      surfaces.push(body.mesh);
      if (body.ring) surfaces.push(body.ring);
    }
    return (
      raycaster.intersectObjects(surfaces, false)[0]?.object.userData
        .planetariumId || null
    );
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.root);
    this.assetQueue.length = 0;
    for (const texture of this.textures) texture.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.textures.clear();
    this.texturePromises.clear();
    this.geometries.clear();
    this.materials.clear();
    this.bodies.clear();
    this._positionedBodies.length = 0;
    this.orbits.clear();
    this.root.clear();
  }
}
