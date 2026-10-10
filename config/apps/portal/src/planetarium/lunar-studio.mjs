import * as THREE from "three";
import {
  continuousPhase,
  lunarModel,
  normalizedPhase,
  shadowProfile,
} from "./lunar-studio-math.mjs";

const EARTH_RADIUS = 1.6;
const MOON_RADIUS = EARTH_RADIUS * 0.2727;
const ORBIT_RADIUS = 8.5;
const SUN_DISTANCE = 160;
const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;

function patchIllumination(material, uniforms, nightMap = false) {
  material.customProgramCacheKey = () =>
    `lunar-studio-terminator-${nightMap ? "earth" : "moon"}-v1`;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `varying vec3 vStudioPoint;varying vec3 vStudioNormal;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `
      #include <worldpos_vertex>
      vStudioPoint=(modelMatrix*vec4(transformed,1.0)).xyz;
      vStudioNormal=normalize(mat3(modelMatrix)*normal);`,
    );
    shader.fragmentShader = `varying vec3 vStudioPoint;varying vec3 vStudioNormal;
      uniform vec3 studioOccultant;uniform float studioRadius;
      uniform float studioUmbraSlope;uniform float studioPenumbraSlope;
      uniform float studioShadow;uniform float studioBlood;
      ${shader.fragmentShader}`;
    if (nightMap)
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `
      #include <emissivemap_fragment>
      float studioNight=1.0-smoothstep(-.16,.05,dot(normalize(vStudioNormal),vec3(1.,0.,0.)));
      totalEmissiveRadiance*=studioNight;`,
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `
      vec3 shadowDelta=vStudioPoint-studioOccultant;
      float shadowDepth=-shadowDelta.x;
      float umbraRadius=max(0.0,studioRadius-studioUmbraSlope*shadowDepth);
      float penumbraRadius=studioRadius+studioPenumbraSlope*max(0.0,shadowDepth);
      float coverage=(1.0-smoothstep(umbraRadius, max(umbraRadius+.001,penumbraRadius),length(shadowDelta.yz)))*step(.001,shadowDepth)*studioShadow;
      vec3 eclipseTint=mix(vec3(.012,.018,.03),vec3(.27,.044,.012),studioBlood);
      outgoingLight=mix(outgoingLight,eclipseTint*(.18+.82*max(0.0,dot(normalize(vStudioNormal),vec3(1.,0.,0.)))),coverage*.985);
      #include <opaque_fragment>`,
    );
  };
}

function limbMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader:
      "varying vec3 vNormal;varying vec3 vEye;void main(){vec4 p=modelMatrix*vec4(position,1.0);vNormal=normalize(mat3(modelMatrix)*normal);vEye=cameraPosition-p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}",
    fragmentShader: `varying vec3 vNormal;varying vec3 vEye;void main(){vec3 n=normalize(vNormal);float limb=pow(1.0-abs(dot(n,normalize(vEye))),3.2);
      float day=smoothstep(-.3,.5,n.x);float sunset=exp(-abs(n.x)/.1)*.25;
      gl_FragColor=vec4(vec3(.12,.4,.9)*(.15+day)+vec3(.95,.19,.045)*sunset,limb*(.1+day*.65));}`,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

function shadowMaterial(color, opacity) {
  return new THREE.ShaderMaterial({
    uniforms: {
      tint: { value: new THREE.Color(color) },
      opacity: { value: opacity },
    },
    vertexShader:
      "varying vec3 vNormal;varying vec3 vEye;varying vec2 vUV;void main(){vec4 p=modelMatrix*vec4(position,1.0);vNormal=normalize(mat3(modelMatrix)*normal);vEye=cameraPosition-p.xyz;vUV=uv;gl_Position=projectionMatrix*viewMatrix*p;}",
    fragmentShader: `varying vec3 vNormal;varying vec3 vEye;varying vec2 vUV;uniform vec3 tint;uniform float opacity;
      void main(){float edge=pow(1.0-abs(dot(normalize(vNormal),normalize(vEye))),2.2);float ends=smoothstep(0.0,.08,vUV.y)*(1.0-smoothstep(.92,1.0,vUV.y));
      gl_FragColor=vec4(tint,(edge*.8+.06)*opacity*ends);}`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

/** A compact illustrative Earth–Moon model sharing the host scene and RAF. */
export class LunarStudio {
  constructor(
    scene,
    {
      renderer = null,
      assetBase = "/planetarium/assets/",
      loadAssets = false,
    } = {},
  ) {
    this.scene = scene;
    this.renderer = renderer;
    this.assetBase = assetBase.endsWith("/") ? assetBase : `${assetBase}/`;
    this.root = new THREE.Group();
    this.root.name = "planetarium-lunar-studio";
    this.root.visible = false;
    scene.add(this.root);
    this.geometries = new Set();
    this.materials = new Set();
    this.textures = new Set();
    this.disposed = false;
    this.mode = "moon";
    this.options = {
      phase: 0.5,
      eclipseKind: "solar",
      perspective: "surface",
      guides: true,
    };
    this._phase = 0.5;
    this._phaseTarget = 0.5;
    this._age = 0;
    this._scratch = new THREE.Vector3();
    this._loader = new THREE.TextureLoader();
    this._loadPromise = null;
    this._fetchController = new AbortController();
    this.earthGroup = new THREE.Group();
    this.moonGroup = new THREE.Group();
    this.guideGroup = new THREE.Group();
    this.orbitGroup = new THREE.Group();
    this.shadowGroup = new THREE.Group();
    this.guideGroup.add(this.orbitGroup, this.shadowGroup);
    this.root.add(this.earthGroup, this.moonGroup, this.guideGroup);

    this.sun = new THREE.DirectionalLight(0xfff1df, 3.25);
    this.sun.position.set(50, 0, 0);
    this.root.add(
      this.sun,
      this.sun.target,
      new THREE.AmbientLight(0x8fa8c2, 0.026),
    );
    const earthshine = new THREE.PointLight(0x78a8e6, 1.6, 16, 2);
    this.root.add(earthshine);

    const earthSphere = this._geometry(
      new THREE.SphereGeometry(EARTH_RADIUS, 96, 64),
    );
    this.earthMaterial = this._material(
      new THREE.MeshPhongMaterial({
        color: 0x628bb0,
        shininess: 28,
        specular: 0x304456,
        emissive: 0xffffff,
        emissiveIntensity: 0,
      }),
    );
    this.earth = new THREE.Mesh(earthSphere, this.earthMaterial);
    this.earth.rotation.y = -Math.PI / 2;
    this.earthGroup.add(this.earth);
    this.cloudMaterial = this._material(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 1,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        alphaTest: 0.035,
      }),
    );
    this.clouds = new THREE.Mesh(earthSphere, this.cloudMaterial);
    this.clouds.scale.setScalar(1.007);
    this.clouds.visible = false;
    this.clouds.rotation.y = -Math.PI / 2;
    this.earthGroup.add(this.clouds);
    const atmosphere = new THREE.Mesh(
      earthSphere,
      this._material(limbMaterial()),
    );
    atmosphere.scale.setScalar(1.026);
    this.earthGroup.add(atmosphere);

    const moonMaterial = this._material(
      new THREE.MeshStandardMaterial({
        color: 0xbeb9b0,
        roughness: 0.98,
        metalness: 0,
        emissive: 0x182533,
        emissiveIntensity: 0.022,
        dithering: true,
      }),
    );
    this.moon = new THREE.Mesh(
      this._geometry(new THREE.SphereGeometry(MOON_RADIUS, 192, 128)),
      moonMaterial,
    );
    this.moon.userData.lunarStudioBody = "moon";
    this.earth.userData.lunarStudioBody = "earth";
    this.moonGroup.add(this.moon);
    const shadowUniforms = (profile) => ({
      studioOccultant: { value: new THREE.Vector3() },
      studioRadius: { value: profile.radius },
      studioUmbraSlope: { value: profile.umbraSlope },
      studioPenumbraSlope: { value: profile.penumbraSlope },
      studioShadow: { value: 0 },
      studioBlood: { value: 0 },
    });
    this.moonShadowProfile = shadowProfile({
      radius: MOON_RADIUS,
      sunDistance: SUN_DISTANCE - ORBIT_RADIUS,
      length: 15,
    });
    this.earthShadowProfile = shadowProfile({
      radius: EARTH_RADIUS,
      length: 19,
    });
    this.earthUniforms = shadowUniforms(this.moonShadowProfile);
    this.moonUniforms = shadowUniforms(this.earthShadowProfile);
    patchIllumination(this.earthMaterial, this.earthUniforms, true);
    patchIllumination(moonMaterial, this.moonUniforms);
    patchIllumination(this.cloudMaterial, this.earthUniforms);

    this._createGuides();
    this._createBackground();
    this.update(0);
    this.ready = Promise.resolve(false);
    if (loadAssets) this.load();
  }

  _geometry(value) {
    this.geometries.add(value);
    return value;
  }
  _material(value) {
    this.materials.add(value);
    return value;
  }

  _createBackground() {
    this.starGeometry = this._geometry(new THREE.BufferGeometry());
    this.starGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([], 3),
    );
    const material = this._material(
      new THREE.ShaderMaterial({
        uniforms: {
          pixelRatio: {
            value: Math.min(1.6, this.renderer?.getPixelRatio?.() || 1),
          },
        },
        vertexShader:
          "attribute float size;attribute vec3 color;varying vec3 vTint;uniform float pixelRatio;void main(){vTint=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=size*pixelRatio;}",
        fragmentShader:
          "varying vec3 vTint;void main(){float r=length(gl_PointCoord*2.0-1.0);float a=exp(-r*r*3.5)*(1.0-smoothstep(.65,1.0,r));gl_FragColor=vec4(vTint,a*.78);}",
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    const stars = new THREE.Points(this.starGeometry, material);
    stars.frustumCulled = false;
    stars.name = "lunar-studio-catalogue-background";
    this.root.add(stars);
  }

  async _loadBackground() {
    try {
      const response = await fetch(`${this.assetBase}stars.json`, {
        signal: this._fetchController.signal,
      });
      if (!response.ok) return false;
      const catalogue = await response.json();
      if (this.disposed || !Array.isArray(catalogue.stars)) return false;
      const positions = [],
        colors = [],
        sizes = [];
      for (const star of catalogue.stars.slice(0, 5200)) {
        if (![star.ra, star.dec, star.mag].every(Number.isFinite)) continue;
        const ra = (star.ra * Math.PI) / 180,
          dec = (star.dec * Math.PI) / 180;
        positions.push(
          180 * Math.cos(dec) * Math.cos(ra),
          180 * Math.sin(dec),
          -180 * Math.cos(dec) * Math.sin(ra),
        );
        const warm = THREE.MathUtils.clamp(
          (Number.isFinite(star.bv) ? star.bv : 0.5) / 1.8,
          0,
          1,
        );
        const brightness = THREE.MathUtils.clamp(
          Math.pow(10, -star.mag * 0.12),
          0.14,
          1.1,
        );
        colors.push(
          (0.7 + warm * 0.3) * brightness,
          (0.83 - warm * 0.12) * brightness,
          (1 - warm * 0.39) * brightness,
        );
        sizes.push(THREE.MathUtils.clamp(2.8 - star.mag * 0.31, 0.8, 3.4));
      }
      this.starGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      this.starGeometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(colors, 3),
      );
      this.starGeometry.setAttribute(
        "size",
        new THREE.Float32BufferAttribute(sizes, 1),
      );
      return true;
    } catch {
      return false;
    }
  }

  _createGuides() {
    const ringMaterial = this._material(
      new THREE.MeshBasicMaterial({
        color: 0x88b7d8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    const ring = new THREE.Mesh(
      this._geometry(
        new THREE.RingGeometry(ORBIT_RADIUS - 0.026, ORBIT_RADIUS + 0.026, 192),
      ),
      ringMaterial,
    );
    ring.rotation.x = -Math.PI / 2;
    this.orbitGroup.add(ring);
    const ticks = [];
    for (let i = 0; i < 48; i++) {
      const angle = (i / 48) * TAU;
      const length = i % 12 === 0 ? 0.26 : i % 4 === 0 ? 0.16 : 0.08;
      ticks.push(
        Math.cos(angle) * (ORBIT_RADIUS + 0.1),
        0,
        Math.sin(angle) * (ORBIT_RADIUS + 0.1),
        Math.cos(angle) * (ORBIT_RADIUS + 0.1 + length),
        0,
        Math.sin(angle) * (ORBIT_RADIUS + 0.1 + length),
      );
    }
    this.orbitGroup.add(
      new THREE.LineSegments(
        this._geometry(
          new THREE.BufferGeometry().setAttribute(
            "position",
            new THREE.Float32BufferAttribute(ticks, 3),
          ),
        ),
        this._material(
          new THREE.LineBasicMaterial({
            color: 0xaacfe2,
            transparent: true,
            opacity: 0.44,
            depthWrite: false,
          }),
        ),
      ),
    );
    this.marker = new THREE.Mesh(
      this._geometry(
        new THREE.RingGeometry(MOON_RADIUS * 1.14, MOON_RADIUS * 1.19, 64),
      ),
      this._material(
        new THREE.MeshBasicMaterial({
          color: 0xb7e9fa,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.57,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        }),
      ),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.guideGroup.add(this.marker);
    this.radiusGuide = new THREE.Line(
      this._geometry(
        new THREE.BufferGeometry().setAttribute(
          "position",
          new THREE.Float32BufferAttribute([0, 0, 0, ORBIT_RADIUS, 0, 0], 3),
        ),
      ),
      this._material(
        new THREE.LineBasicMaterial({
          color: 0x82b0cd,
          transparent: true,
          opacity: 0.19,
          depthWrite: false,
        }),
      ),
    );
    this.radiusGuide.frustumCulled = false;
    this.guideGroup.add(this.radiusGuide);

    for (const [kind, profile] of [
      ["solar", this.moonShadowProfile],
      ["lunar", this.earthShadowProfile],
    ]) {
      const group = new THREE.Group();
      for (const [outer, color, opacity] of [
        [false, 0x8799d2, 0.18],
        [true, 0xd8bf8f, 0.075],
      ]) {
        const endRadius = outer
          ? profile.penumbraEndRadius
          : profile.umbraEndRadius;
        const cone = new THREE.Mesh(
          this._geometry(
            new THREE.CylinderGeometry(
              endRadius,
              profile.radius,
              profile.length,
              64,
              1,
              true,
            ),
          ),
          this._material(shadowMaterial(color, opacity)),
        );
        cone.rotation.z = Math.PI / 2;
        cone.position.x = -profile.length / 2;
        group.add(cone);
        const end = new THREE.Mesh(
          this._geometry(
            new THREE.RingGeometry(
              Math.max(0, endRadius - 0.008),
              endRadius + 0.008,
              64,
            ),
          ),
          this._material(
            new THREE.MeshBasicMaterial({
              color,
              transparent: true,
              opacity: outer ? 0.14 : 0.2,
              side: THREE.DoubleSide,
              depthWrite: false,
            }),
          ),
        );
        end.rotation.y = Math.PI / 2;
        end.position.x = -profile.length;
        group.add(end);
      }
      this.shadowGroup.add(group);
      if (kind === "solar") this.solarShadow = group;
      else this.lunarShadow = group;
    }
    const beams = [];
    for (let i = 0; i < 5; i++) {
      const offset = (i - 2) * 0.38;
      beams.push(19, offset, -0.45, -20, offset, -0.45);
    }
    this.beams = new THREE.LineSegments(
      this._geometry(
        new THREE.BufferGeometry().setAttribute(
          "position",
          new THREE.Float32BufferAttribute(beams, 3),
        ),
      ),
      this._material(
        new THREE.LineBasicMaterial({
          color: 0xffd9a3,
          transparent: true,
          opacity: 0.1,
          depthWrite: false,
          toneMapped: false,
        }),
      ),
    );
    this.shadowGroup.add(this.beams);
  }

  async _texture(name, color = true) {
    try {
      const texture = await this._loader.loadAsync(`${this.assetBase}${name}`);
      if (this.disposed) {
        texture.dispose();
        return null;
      }
      if (color) texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(
        8,
        this.renderer?.capabilities?.getMaxAnisotropy?.() || 1,
      );
      this.textures.add(texture);
      return texture;
    } catch {
      return null;
    }
  }

  load() {
    if (this._loadPromise) return this._loadPromise;
    this._loadPromise = (async () => {
      const [moon, relief] = await Promise.all([
        this._texture("moon.jpg"),
        this._texture("moon-height.jpg", false),
      ]);
      if (this.disposed) return false;
      if (moon) {
        this.moon.material.map = moon;
        this.moon.material.color.set(0xffffff);
      }
      if (relief) {
        this.moon.material.bumpMap = relief;
        this.moon.material.bumpScale = 0.004;
      }
      this.moon.material.needsUpdate = true;
      const day = await this._texture("earth-day.jpg");
      if (this.disposed) return false;
      if (day) {
        this.earthMaterial.map = day;
        this.earthMaterial.color.set(0xffffff);
      }
      const [night, clouds] = await Promise.all([
        this._texture("earth-night.jpg"),
        this._texture("earth-clouds.jpg", false),
      ]);
      if (this.disposed) return false;
      if (night) {
        this.earthMaterial.emissiveMap = night;
        this.earthMaterial.emissiveIntensity = 1.1;
      }
      if (clouds) {
        this.cloudMaterial.alphaMap = clouds;
        this.cloudMaterial.needsUpdate = true;
        this.clouds.visible = true;
      }
      const [normal, specular] = await Promise.all([
        this._texture("earth-normal.jpg", false),
        this._texture("earth-specular.jpg", false),
      ]);
      if (this.disposed) return false;
      if (normal) {
        this.earthMaterial.normalMap = normal;
        this.earthMaterial.normalScale.set(0.25, 0.25);
      }
      if (specular) this.earthMaterial.specularMap = specular;
      this.earthMaterial.needsUpdate = true;
      await this._loadBackground();
      return Boolean(moon && day);
    })();
    this.ready = this._loadPromise;
    return this._loadPromise;
  }

  setVisible(value) {
    if (!this.disposed) this.root.visible = Boolean(value);
  }

  setMode(mode = "moon") {
    if (this.disposed) return;
    const value = mode === "shadow" ? "shadow" : "moon";
    if (value !== this.mode && value === "shadow") {
      this.options.phase = this.options.eclipseKind === "solar" ? 0 : 0.5;
      this._phaseTarget = continuousPhase(this._phase, this.options.phase);
    }
    this.mode = value;
  }

  setOptions(options = {}) {
    if (this.disposed) return;
    if (Number.isFinite(options.phase)) {
      this.options.phase = normalizedPhase(options.phase);
      this._phaseTarget = continuousPhase(this._phaseTarget, options.phase);
    }
    if ("eclipseKind" in options) {
      const kind = options.eclipseKind === "lunar" ? "lunar" : "solar";
      if (
        kind !== this.options.eclipseKind &&
        this.mode === "shadow" &&
        !Number.isFinite(options.phase)
      ) {
        this.options.phase = kind === "solar" ? 0 : 0.5;
        this._phaseTarget = continuousPhase(this._phase, this.options.phase);
      }
      this.options.eclipseKind = kind;
    }
    if ("perspective" in options)
      this.options.perspective =
        options.perspective === "orbit" ? "orbit" : "surface";
    if ("guides" in options) this.options.guides = Boolean(options.guides);
  }

  get summary() {
    const model = lunarModel(this._phase, {
      inclination: this.mode === "shadow" ? 0 : 5.145,
    });
    return {
      phase: model.phase,
      illumination: model.illumination,
      eclipseKind: this.options.eclipseKind,
      mode: this.mode,
      perspective: this.options.perspective,
      displayScale: true,
    };
  }

  get bodyTarget() {
    return this.moonGroup.position.clone();
  }

  getBodyTarget(output = new THREE.Vector3()) {
    return output.copy(this.moonGroup.position);
  }

  defaultPose(perspective = this.options.perspective, output = null) {
    const pose = output || {
      position: new THREE.Vector3(),
      target: new THREE.Vector3(),
    };
    if (perspective === "orbit") {
      pose.position.set(10.5, 14.0, 19.5);
      pose.target.set(0, 0, 0);
      return pose;
    }
    pose.target.copy(this.moonGroup.position);
    const cabal312512LunarApproach = this._scratch
      .copy(pose.target)
      .normalize()
      .multiplyScalar(-1.49);
    pose.position
      .copy(pose.target)
      .add(cabal312512LunarApproach)
      .addScaledVector(UP, 0.055);
    return pose;
  }

  update(dt = 0) {
    if (this.disposed) return;
    const elapsed = Math.max(0, Math.min(0.1, Number.isFinite(dt) ? dt : 0));
    this._age += elapsed;
    const blend = elapsed > 0 ? 1 - Math.exp(-elapsed / 0.12) : 1;
    this._phase += (this._phaseTarget - this._phase) * blend;
    const model = lunarModel(this._phase, {
      inclination: this.mode === "shadow" ? 0 : 5.145,
    });
    const orbitTilt =
      this.mode === "shadow" ? 0 : -THREE.MathUtils.degToRad(5.145);
    this.moonGroup.position.fromArray(model.position);
    // NASA's central meridian (UV u=0.5) is local +X in SphereGeometry.
    // Inclination and synchronous spin keep that near-side axis Earthward.
    this.moon.rotation.set(orbitTilt, this._phase * TAU + Math.PI, 0, "XYZ");
    this.earth.rotation.y = -Math.PI / 2 + this._age * 0.013;
    this.clouds.rotation.y = this.earth.rotation.y + this._age * 0.0018;
    this.orbitGroup.rotation.x = orbitTilt;
    this.marker.position.copy(this.moonGroup.position);
    this.marker.rotation.x = -Math.PI / 2 + this.orbitGroup.rotation.x;
    const radial = this.radiusGuide.geometry.attributes.position;
    radial.setXYZ(1, ...model.position);
    radial.needsUpdate = true;
    this.guideGroup.visible = this.options.guides;
    this.orbitGroup.visible = this.options.perspective === "orbit";
    this.marker.visible = this.options.perspective === "orbit";
    this.radiusGuide.visible = this.options.perspective === "orbit";
    this.shadowGroup.visible = this.mode === "shadow";
    this.solarShadow.visible = this.options.eclipseKind === "solar";
    this.lunarShadow.visible = this.options.eclipseKind === "lunar";
    this.solarShadow.position.copy(this.moonGroup.position);
    this.earthUniforms.studioOccultant.value.copy(this.moonGroup.position);
    this.earthUniforms.studioShadow.value =
      this.mode === "shadow" && this.options.eclipseKind === "solar" ? 1 : 0;
    this.moonUniforms.studioShadow.value =
      this.mode === "shadow" && this.options.eclipseKind === "lunar" ? 1 : 0;
    this.moonUniforms.studioBlood.value = this.moonUniforms.studioShadow.value;
    this.root.updateMatrixWorld(true);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this._fetchController.abort();
    this.scene.remove(this.root);
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
    this.textures.forEach((texture) => texture.dispose());
    this.geometries.clear();
    this.materials.clear();
    this.textures.clear();
    this.root.clear();
  }
}
