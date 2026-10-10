import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import {
  constellationGeometry,
  nearestConstellation,
} from "./constellation-geometry.mjs";
import {
  automaticSkyDetail,
  galaxyZoomVisibility,
  starZoomScale,
} from "./sky-display.mjs";
import { loadFaintCatalogue } from "./faint-star-catalogue.mjs";
import {
  METEOR_PRESETS,
  normalizeSkyExperience,
  exposureAngle,
  advanceExposure,
  meteorSeed,
  eclipseContactEnvelope,
} from "./sky-experience-math.mjs";
import {
  isContinuousPlayback,
  readableAngularStep,
  SIDEREAL_RADIANS_PER_MS,
  SKY_VISUAL_RADIANS_PER_SECOND,
  trajectoryPosition,
} from "./continuous-motion.mjs";
import {
  SkyMaterial,
  PrecomputedTexturesLoader,
} from "@takram/three-atmosphere";

const D2R = Math.PI / 180;
const SKY_RADIUS = 700;
const cabal312512ExposureSegments = 64;
const METEOR_COUNT = 24;
const textureLoader = new THREE.TextureLoader();

export function starVector(ra, dec, radius = 1) {
  const latitude = dec * D2R,
    longitude = ra * D2R;
  return new THREE.Vector3(
    Math.cos(latitude) * Math.cos(longitude),
    Math.sin(latitude),
    -Math.cos(latitude) * Math.sin(longitude),
  ).multiplyScalar(radius);
}

function starColor(bv = 0.65) {
  const value = Math.max(-0.4, Math.min(2, Number(bv)));
  const temperature =
    (4600 * (1 / (0.92 * value + 1.7) + 1 / (0.92 * value + 0.62))) / 100;
  const red =
    temperature <= 66 ? 255 : 329.6987 * Math.pow(temperature - 60, -0.1332048);
  const green =
    temperature <= 66
      ? 99.4708 * Math.log(temperature) - 161.1196
      : 288.1222 * Math.pow(temperature - 60, -0.0755148);
  const blue =
    temperature >= 66
      ? 255
      : temperature <= 19
        ? 0
        : 138.5177 * Math.log(temperature - 10) - 305.0448;
  return new THREE.Color(
    Math.max(0, Math.min(255, red)) / 255,
    Math.max(0, Math.min(255, green)) / 255,
    Math.max(0, Math.min(255, blue)) / 255,
  );
}

function observerFrame(observer) {
  const lat = observer.latitude * D2R,
    lon = observer.longitude * D2R;
  const normal = new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
  );
  const east = new THREE.Vector3(-Math.sin(lon), Math.cos(lon), 0);
  const south = new THREE.Vector3(
    Math.sin(lat) * Math.cos(lon),
    Math.sin(lat) * Math.sin(lon),
    -Math.cos(lat),
  );
  const n = 6378137 / Math.sqrt(1 - 0.00669437999 * Math.sin(lat) ** 2);
  const h = observer.elevation || 0;
  const position = new THREE.Vector3(
    (n + h) * Math.cos(lat) * Math.cos(lon),
    (n + h) * Math.cos(lat) * Math.sin(lon),
    (n * (1 - 0.00669437999) + h) * Math.sin(lat),
  );
  return new THREE.Matrix4()
    .makeBasis(east, normal, south)
    .setPosition(position);
}

function bodyDirection(body) {
  const az = body.azimuth * D2R,
    alt = body.altitude * D2R;
  return new THREE.Vector3(
    Math.cos(alt) * Math.sin(az),
    Math.sin(alt),
    -Math.cos(alt) * Math.cos(az),
  );
}

// Point rendering uses magnitudes from the catalogue; all background imagery is
// a prepared NASA SVS map. Custom shaders only control the display response.
const pointVertex = `attribute float size; attribute vec3 tint; varying vec3 vTint; varying float vBrightness;
uniform float pixelRatio; uniform float fieldScale;
void main(){vTint=tint;vBrightness=clamp(size/4.,.18,1.8);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
gl_PointSize=clamp(size*pixelRatio*fieldScale,1.0,14.0);}`;
const pointFragment = `varying vec3 vTint;varying float vBrightness;uniform float opacity;uniform float exposure;
void main(){float d=length(gl_PointCoord-.5)*2.0; if(d>1.0)discard;
float core=exp(-d*d*10.0); float halo=exp(-d*d*3.0)*.2;
gl_FragColor=vec4(vTint*exposure*vBrightness,(core+halo)*opacity);}`;

const nodeVertex = `attribute float size;uniform float pixelRatio;varying float vStrength;
void main(){vStrength=size/4.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=size*pixelRatio;}`;
const nodeFragment = `uniform vec3 tint;uniform float opacity;uniform float time;uniform float onset;varying float vStrength;
void main(){float radius=length(gl_PointCoord-.5)*2.;if(radius>1.)discard;
float core=exp(-radius*radius*34.);float halo=exp(-radius*radius*6.)*.2;
float age=time-onset;float ripple=exp(-pow((radius-min(age*.9,.85))*26.,2.))*exp(-age*3.);
float pulse=.94+.06*sin(time*1.8+vStrength);gl_FragColor=vec4(tint*(1.9+core*.9),(core+halo+ripple*.18)*opacity*pulse);}`;

const meteorFragment = `varying vec2 vUv;uniform float strength;uniform vec3 tint;uniform float age;
void main(){float x=vUv.x;float y=abs(vUv.y-.5);
float curve=.012*sin(x*11.+age*3.)*(1.-x);
float cross=abs(vUv.y-.5-curve);float taper=mix(.022,.095,pow(x,.8));
float ribbon=exp(-pow(cross/taper,2.))*pow(x,1.1);
float needle=exp(-pow(cross/.027,2.))*pow(x,2.9);
float head=exp(-pow((x-.9)/.031,2.)-pow(y/.105,2.));
float halo=exp(-pow((x-.9)/.077,2.)-pow(y/.23,2.))*.17;
float wake=exp(-pow(cross/.19,2.))*pow(x,.9)*(1.-x)*.15;
float ends=smoothstep(0.,.035,x)*(1.-smoothstep(.965,1.,x));
float opacity=(ribbon*.62+needle*.85+head*1.3+halo+wake)*ends*strength;
if(opacity<.002)discard;vec3 color=mix(tint,vec3(1.,.99,.94),smoothstep(.57,.91,x));
gl_FragColor=vec4(color*(2.5+head*3.8),min(1.,opacity));}`;

const galaxyVertex = `varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const galaxyFragment = `varying vec3 vDirection;uniform sampler2D map;uniform sampler2D baseMap;uniform float detailBlend;uniform float baseMapLod;uniform float opacity;uniform float exposure;uniform float photographic;uniform float radianceScale;uniform float mapLod;
void main(){vec3 direction=normalize(vDirection);vec2 skyUv=vec2(fract(.5-atan(-direction.z,direction.x)/6.283185307),.5+asin(clamp(direction.y,-1.,1.))/3.141592654);
vec3 c=textureLod(map,skyUv,mapLod).rgb;c=c*radianceScale/(1.+c*(radianceScale-1.));if(detailBlend<.999)c=mix(textureLod(baseMap,skyUv,baseMapLod).rgb,c,detailBlend);float luminance=dot(c,vec3(.2126,.7152,.0722));
c=max(vec3(0.),mix(vec3(luminance),c,mix(1.,1.32,photographic)));
vec3 palette=mix(vec3(.88,.96,1.13),vec3(1.08,1.01,.92),smoothstep(.025,.24,luminance));
c*=mix(vec3(1.),palette,photographic)*exposure;
gl_FragColor=vec4(c,opacity);}`;

const discVertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const discFragment = `varying vec2 vUv; uniform sampler2D surface;uniform sampler2D relief;uniform bool reliefReady;uniform bool isSun;
uniform vec3 phaseLight;uniform vec2 shadowCenter;uniform float shadowRadius;uniform float solarOccultation;
void main(){vec2 p=(vUv-.5)*2.;float r2=dot(p,p);if(r2>1.)discard;
float z=sqrt(max(0.,1.-r2));vec2 spherical=vec2(.5+atan(p.x,z)/6.283185,.5+asin(p.y)/3.141593);vec3 c=texture2D(surface,spherical).rgb;
if(isSun){float limb=.4+.6*pow(z,.45);c=vec3(1.,.91,.72)*limb*3.5;}
else{vec3 normal=vec3(p,z);
if(reliefReady){float h=texture2D(relief,spherical).r;
float dx=texture2D(relief,spherical+vec2(.0008,0.)).r-h;
float dy=texture2D(relief,spherical+vec2(0.,.0008)).r-h;
normal=normalize(normal+vec3(-dx,-dy,0.)*1.8*smoothstep(.035,.3,z));}
float incidence=dot(normal,phaseLight);float lit=max(0.,incidence);
float terminator=smoothstep(-.008,.018,incidence);
float reflectance=lit/(lit+max(.03,z));
float earthshine=.006+.033*pow(1.-max(0.,phaseLight.z),2.);
c*=earthshine+terminator*(.27*pow(lit,.48)+.97*reflectance);
float distance=length(p-shadowCenter);float shadow=shadowRadius>0.?1.-smoothstep(shadowRadius-.09,shadowRadius+.1,distance):0.;
float penumbra=shadowRadius>0.?1.-smoothstep(shadowRadius+.1,shadowRadius+.55,distance):0.;
float center=shadowRadius>0.?1.-smoothstep(0.,max(.12,shadowRadius),distance):0.;
vec3 copper=mix(vec3(.3,.075,.033),vec3(.095,.016,.012),center);
c*=1.-penumbra*.38;c=mix(c,c*copper*1.9,shadow*.97);c*=1.-solarOccultation;}
gl_FragColor=vec4(c,1.-smoothstep(.97,1.,r2));}`;

export class SkyScene {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.root = new THREE.Group();
    this.catalogue = new THREE.Group();
    this.catalogue.matrixAutoUpdate = false;
    this.root.add(this.catalogue);
    this.scene.add(this.root);
    this.options = {
      photographic: true,
      atmosphere: false,
      fullSphere: true,
      constellations: true,
      meteorShower: false,
      starTrails: false,
      closeup: false,
    };
    this.resources = [];
    this.starRows = [];
    this.constellations = [];
    this.bodies = new Map();
    this.snapshot = null;
    this.disposed = false;
    this.faintCatalogueAbort = new AbortController();
    this.quality = "balanced";
    this.automaticDetail = false;
    this.detailBlend = 1;
    this.detailTarget = 1;
    this.detailLoadFailed = false;
    this.daylight = 0;
    this.tracking = true;
    this.skyQuaternion = new THREE.Quaternion();
    this.targetSkyQuaternion = new THREE.Quaternion();
    this.motionTargetQuaternion = new THREE.Quaternion();
    this.motionRotation = new THREE.Quaternion();
    this.motionPole = new THREE.Vector3();
    this.motionPoint = [0, 0, 0];
    this.motionObserverOffset = new THREE.Vector3();
    this.motionTimeMs = NaN;
    this.motionEpochMs = NaN;
    this.motionObserverKey = null;
    this.motionObserverChanged = false;
    this.hovered = null;
    this.selectedFigure = null;
    this.activeFigure = null;
    this.effectTime = 0;
    this.figureGeometry = new Map();
    this.inverseCatalogue = new THREE.Matrix4();
    this.pointerDirection = new THREE.Vector3();
    this.effectSize = new THREE.Vector2();
    this.effectRight = new THREE.Vector3();
    this.effectUp = new THREE.Vector3();
    this.effectForward = new THREE.Vector3();
    this.anchorPoint = new THREE.Vector3();
    this.projectedPoint = new THREE.Vector3();
    this.cameraRight = new THREE.Vector3();
    this.cameraUp = new THREE.Vector3();
    this.phaseTangent = new THREE.Vector3();
    this.phaseMoonDirection = new THREE.Vector3();
    this.meteorBasis = new THREE.Matrix4();
    this.meteorDirection = new THREE.Vector3();
    this.meteorTangent = new THREE.Vector3();
    this.meteorNormal = new THREE.Vector3();
    this.meteorCross = new THREE.Vector3();
    this.experience = normalizeSkyExperience();
    this.meteorRadiant = starVector(48, 58);
    this.meteorEntryTime = 0;
    this.meteorGeneration = 0;
    this.meteorBurstCount = 0;
    this.trailReveal = 0;
    this.trailSign = 1;
    this.trailUniforms = {
      exposureAngle: {
        value: exposureAngle(this.experience.trailExposure, 0.02),
      },
      exposureColor: { value: 1 },
    };
    this.contactOffset = new THREE.Vector3();
    this.ready = this.load();
  }

  own(resource) {
    this.resources.push(resource);
    return resource;
  }

  async load() {
    const [stars, figures, milkyway] = await Promise.all([
      fetch("/planetarium/assets/stars.json").then((r) => {
        if (!r.ok) throw Error("Star catalogue unavailable");
        return r.json();
      }),
      fetch("/planetarium/assets/constellations.json").then((r) => {
        if (!r.ok) throw Error("Constellations unavailable");
        return r.json();
      }),
      textureLoader.loadAsync("/planetarium/assets/milkyway.jpg"),
    ]);
    if (this.disposed) {
      milkyway.dispose();
      return;
    }
    this.starRows = stars.stars;
    this.constellations = figures.constellations;
    milkyway.colorSpace = THREE.SRGBColorSpace;
    milkyway.repeat.x = -1;
    milkyway.offset.x = 1;
    this.baseGalaxyTexture = milkyway;
    this.own(milkyway);
    this.galaxy = new THREE.Mesh(
      this.own(new THREE.SphereGeometry(990, 64, 32)),
      this.own(
        new THREE.ShaderMaterial({
          vertexShader: galaxyVertex,
          fragmentShader: galaxyFragment,
          uniforms: {
            map: { value: milkyway },
            baseMap: { value: milkyway },
            detailBlend: { value: 1 },
            baseMapLod: { value: 0 },
            opacity: { value: 0.8 },
            exposure: { value: 2.35 },
            photographic: { value: 1 },
            radianceScale: { value: 1 },
            mapLod: { value: 0 },
          },
          side: THREE.BackSide,
          transparent: true,
          depthWrite: false,
        }),
      ),
    );
    this.galaxy.renderOrder = -90;
    this.catalogue.add(this.galaxy);
    const positions = [],
      colors = [],
      sizes = [];
    for (const row of this.starRows) {
      const p = starVector(row.ra, row.dec, SKY_RADIUS);
      const color = starColor(row.bv);
      positions.push(p.x, p.y, p.z);
      colors.push(color.r, color.g, color.b);
      sizes.push(
        Math.max(
          1.1,
          Math.min(8.5, 7.2 * Math.pow(10, -0.14 * (row.mag + 0.8))),
        ),
      );
    }
    const geometry = this.own(new THREE.BufferGeometry());
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute("tint", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.Float32BufferAttribute(sizes, 1));
    this.starMaterial = this.own(
      new THREE.ShaderMaterial({
        vertexShader: pointVertex,
        fragmentShader: pointFragment,
        uniforms: {
          pixelRatio: { value: this.renderer.getPixelRatio() },
          fieldScale: { value: 1 },
          opacity: { value: 1 },
          exposure: { value: 4.8 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.stars = new THREE.Points(geometry, this.starMaterial);
    this.catalogue.add(this.stars);
    const segments = [],
      nodes = [];
    for (const figure of this.constellations) {
      const data = constellationGeometry(figure, SKY_RADIUS - 1);
      this.figureGeometry.set(figure.id, data);
      segments.push(...data.positions);
      nodes.push(...data.nodes);
    }
    this.lines = this.makeArcLines(segments, 0x95b8ef, 0.76, 0.18);
    this.catalogue.add(this.lines);
    this.constellationEffects = new THREE.Group();
    this.catalogue.add(this.constellationEffects);
    this.constellationNodes = this.makeNodes(nodes, 3.9, 0.26);
    this.constellationEffects.add(this.constellationNodes);
    const ground = new THREE.Mesh(
      this.own(
        new THREE.SphereGeometry(
          540,
          48,
          24,
          0,
          Math.PI * 2,
          Math.PI / 2,
          Math.PI / 2,
        ),
      ),
      this.own(
        new THREE.MeshBasicMaterial({
          color: 0x020408,
          side: THREE.BackSide,
          depthWrite: true,
        }),
      ),
    );
    ground.renderOrder = 6;
    this.ground = ground;
    this.root.add(ground);
    this.highlight = new THREE.Group();
    this.highlightGlow = this.makeArcLines([], 0x6cafff, 4.6, 0.1);
    this.highlightCore = this.makeArcLines([], 0xc2e4ff, 1.22, 0.86);
    this.highlightNodes = this.makeNodes([], 12.5, 0.8);
    this.highlight.add(
      this.highlightGlow,
      this.highlightCore,
      this.highlightNodes,
    );
    this.constellationEffects.add(this.highlight);
    this.createExperiences();
    this.createBodies();
    if (this.snapshot) this.update(this.snapshot, this.observer);
    this.setOptions(this.options);
    // The interactive bright catalogue is already usable. Fainter real stars
    // load as a single bounded point batch without delaying the first view.
    this.loadFaintStars().catch(() => {
      if (!this.disposed) this.faintCatalogueUnavailable = true;
    });
    // The sky is already usable. Loading the precomputed atmosphere is nonblocking.
    this.loadAtmosphere().catch(() => {
      this.atmosphereUnavailable = true;
    });
  }

  async loadAtmosphere() {
    const loader = new PrecomputedTexturesLoader({
      higherOrderScattering: false,
      combinedScattering: true,
    });
    const textures = await loader.loadAsync("/planetarium/assets/atmosphere");
    if (this.disposed) {
      Object.values(textures).forEach((t) => t?.dispose());
      return;
    }
    Object.values(textures).forEach((t) => t && this.own(t));
    this.atmosphereMaterial = this.own(
      new SkyMaterial({ ...textures, sun: false, moon: false, ground: true }),
    );
    // SkyMaterial emits opaque RGB and does not consume Material.opacity.
    // Scale its existing radiance output using one uniform, without another
    // rendering pass or rebuilding the precomputed scattering textures.
    this.atmosphereMaterial.uniforms.eclipseTransmission = { value: 1 };
    this.atmosphereMaterial.fragmentShader =
      this.atmosphereMaterial.fragmentShader
        .replace(
          "void main() {",
          "uniform float eclipseTransmission;\nvoid main() {",
        )
        .replace(
          "outputColor.a = 1.0;",
          "outputColor.rgb *= eclipseTransmission;\n  outputColor.a = 1.0;",
        );
    const mesh = new THREE.Mesh(
      this.own(new THREE.PlaneGeometry(2, 2)),
      this.atmosphereMaterial,
    );
    mesh.frustumCulled = false;
    mesh.renderOrder = -100;
    this.atmosphereMesh = mesh;
    this.root.add(mesh);
    if (this.snapshot) this.update(this.snapshot, this.observer);
    this.setOptions(this.options);
  }

  async loadFaintStars() {
    const data = await loadFaintCatalogue(
      "/planetarium/assets/stars-faint.json",
      this.faintCatalogueAbort.signal,
    );
    if (this.disposed) return;
    const positions = new Float32Array(data.count * 3);
    const colors = new Float32Array(data.count * 3);
    const sizes = new Float32Array(data.count);
    const colorCache = new Map();
    for (let i = 0; i < data.count; i++) {
      const offset = i * 4,
        vertex = i * 3;
      const longitude = data.values[offset] * D2R;
      const latitude = data.values[offset + 1] * D2R;
      const magnitude = data.values[offset + 2];
      const radius = Math.cos(latitude) * SKY_RADIUS;
      positions[vertex] = radius * Math.cos(longitude);
      positions[vertex + 1] = Math.sin(latitude) * SKY_RADIUS;
      positions[vertex + 2] = -radius * Math.sin(longitude);
      const bv = Number.isFinite(data.values[offset + 3])
        ? Math.round(data.values[offset + 3] * 40) / 40
        : 0.65;
      if (!colorCache.has(bv)) colorCache.set(bv, starColor(bv));
      const color = colorCache.get(bv);
      colors[vertex] = color.r;
      colors[vertex + 1] = color.g;
      colors[vertex + 2] = color.b;
      sizes[i] = Math.max(0.6, 1.35 * Math.pow(10, -0.16 * (magnitude - 6)));
    }
    const geometry = this.own(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("tint", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    this.faintMaterial = this.own(this.starMaterial.clone());
    this.faintStars = new THREE.Points(geometry, this.faintMaterial);
    this.catalogue.add(this.faintStars);
    this.renderer.domElement.dataset.faintStarsCount = String(data.count);
  }

  makeArcLines(positions, color, width, opacity) {
    const geometry = this.own(new LineSegmentsGeometry());
    geometry.setPositions(positions.length ? positions : [0, 0, 0, 0, 0, 0]);
    geometry.instanceCount = positions.length / 6;
    const material = this.own(
      new LineMaterial({
        color,
        linewidth: width,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        resolution: this.renderer.getSize(new THREE.Vector2()),
      }),
    );
    const lines = new LineSegments2(geometry, material);
    lines.frustumCulled = false;
    return lines;
  }

  makeNodes(positions, size, opacity) {
    const geometry = this.own(new THREE.BufferGeometry());
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute(
      "size",
      new THREE.Float32BufferAttribute(
        Array(positions.length / 3).fill(size),
        1,
      ),
    );
    const material = this.own(
      new THREE.ShaderMaterial({
        vertexShader: nodeVertex,
        fragmentShader: nodeFragment,
        uniforms: {
          pixelRatio: { value: this.renderer.getPixelRatio() },
          tint: { value: new THREE.Color(0xa4d0ff) },
          opacity: { value: opacity },
          time: { value: 0 },
          onset: { value: -10 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    return points;
  }

  createExperiences() {
    const trails = [],
      trailColors = [],
      exposureCoordinates = [];
    for (const row of this.starRows
      .filter((star) => star.mag < 4.3)
      .sort((a, b) => a.mag - b.mag)
      .slice(0, 360)) {
      const color = starColor(row.bv);
      const brightness = THREE.MathUtils.clamp(
        Math.pow(10, -0.12 * row.mag),
        0.28,
        1.3,
      );
      for (let i = 0; i < cabal312512ExposureSegments; i++) {
        const tailFraction = 1 - i / cabal312512ExposureSegments;
        const headFraction = 1 - (i + 1) / cabal312512ExposureSegments;
        const tailAngle = (exposureAngle(4) / D2R) * tailFraction;
        const headAngle = (exposureAngle(4) / D2R) * headFraction;
        trails.push(
          ...starVector(row.ra + tailAngle, row.dec, SKY_RADIUS - 3).toArray(),
          ...starVector(row.ra + headAngle, row.dec, SKY_RADIUS - 3).toArray(),
        );
        exposureCoordinates.push(
          row.ra * D2R,
          row.dec * D2R,
          tailFraction,
          headFraction,
        );
        const tail = (0.2 + 0.8 * Math.pow(1 - tailFraction, 0.7)) * brightness;
        const head = (0.2 + 0.8 * Math.pow(1 - headFraction, 0.7)) * brightness;
        trailColors.push(
          tail * color.r,
          tail * color.g,
          tail * color.b,
          head * color.r,
          head * color.g,
          head * color.b,
        );
      }
    }
    this.starTrails = this.makeArcLines(trails, 0xffffff, 1.32, 0.66);
    this.starTrails.geometry.setColors(trailColors);
    this.starTrails.geometry.setAttribute(
      "instanceExposure",
      new THREE.InstancedBufferAttribute(
        new Float32Array(exposureCoordinates),
        4,
      ),
    );
    this.starTrails.material.vertexColors = true;
    const material = this.starTrails.material;
    material.uniforms.exposureAngle = this.trailUniforms.exposureAngle;
    material.uniforms.exposureColor = this.trailUniforms.exposureColor;
    material.vertexShader =
      `attribute vec4 instanceExposure;
uniform float exposureAngle;uniform float exposureColor;
vec3 exposurePoint(float fraction){float longitude=instanceExposure.x+exposureAngle*fraction;
float latitude=instanceExposure.y;return vec3(cos(latitude)*cos(longitude),sin(latitude),-cos(latitude)*sin(longitude))*697.;}
` +
      material.vertexShader
        .replace(
          "vec4( instanceStart, 1.0 )",
          "vec4( exposurePoint(instanceExposure.z), 1.0 )",
        )
        .replace(
          "vec4( instanceEnd, 1.0 )",
          "vec4( exposurePoint(instanceExposure.w), 1.0 )",
        )
        .replace(
          "vColor.xyz = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;",
          "vColor.xyz = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd; vColor.xyz=mix(vec3(max(vColor.r,max(vColor.g,vColor.b))),vColor.xyz,exposureColor);",
        );
    this.starTrailGlow = new LineSegments2(
      this.starTrails.geometry,
      this.own(this.starTrails.material.clone()),
    );
    this.starTrailGlow.material.uniforms.exposureAngle =
      this.trailUniforms.exposureAngle;
    this.starTrailGlow.material.uniforms.exposureColor =
      this.trailUniforms.exposureColor;
    this.starTrailGlow.material.linewidth = 4.4;
    this.starTrailGlow.material.opacity = 0.11;
    this.starTrailGlow.frustumCulled = false;
    this.starTrails.visible = false;
    this.starTrailGlow.visible = false;
    this.catalogue.add(this.starTrails, this.starTrailGlow);
    this.meteors = new THREE.Group();
    this.meteorMeshes = [];
    const geometry = this.own(new THREE.PlaneGeometry(1, 1));
    this.radiantRight = new THREE.Vector3();
    this.radiantUp = new THREE.Vector3();
    this.updateMeteorRadiant();
    for (let i = 0; i < METEOR_COUNT; i++) {
      const tint = new THREE.Color(1, 0.8, 0.54);
      const material = this.own(
        new THREE.ShaderMaterial({
          vertexShader: discVertex,
          fragmentShader: meteorFragment,
          uniforms: {
            strength: { value: 0 },
            tint: { value: tint },
            age: { value: 0 },
          },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.renderOrder = 4;
      mesh.userData.flight = {
        tangent: new THREE.Vector3(),
        slot: i,
        generation: 0,
        startedAt: -100,
        nextAt: 0,
        duration: 1,
        hero: false,
      };
      mesh.visible = false;
      this.meteorMeshes.push(mesh);
      this.meteors.add(mesh);
    }
    this.meteors.visible = false;
    this.catalogue.add(this.meteors);
    this.resetMeteorSchedule();
  }

  createBodies() {
    for (const id of ["sun", "moon"]) {
      const uniforms = {
        surface: { value: null },
        relief: { value: null },
        reliefReady: { value: false },
        isSun: { value: id === "sun" },
        phaseLight: { value: new THREE.Vector3(0, 0, 1) },
        shadowCenter: { value: new THREE.Vector2(100, 100) },
        shadowRadius: { value: 0 },
        solarOccultation: { value: 0 },
      };
      const material = this.own(
        new THREE.ShaderMaterial({
          vertexShader: discVertex,
          fragmentShader: discFragment,
          uniforms,
          transparent: true,
          depthWrite: false,
        }),
      );
      const mesh = new THREE.Mesh(
        this.own(new THREE.PlaneGeometry(2, 2)),
        material,
      );
      mesh.renderOrder = id === "sun" ? 10 : 12;
      this.root.add(mesh);
      this.bodies.set(id, mesh);
      textureLoader
        .loadAsync(`/planetarium/assets/${id}.jpg`)
        .then((texture) => {
          if (this.disposed) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          uniforms.surface.value = this.own(texture);
        })
        .catch(() => {});
      if (id === "moon") {
        textureLoader
          .loadAsync("/planetarium/assets/moon-height.jpg")
          .then((texture) => {
            if (this.disposed) {
              texture.dispose();
              return;
            }
            texture.colorSpace = THREE.NoColorSpace;
            uniforms.relief.value = this.own(texture);
            uniforms.reliefReady.value = true;
          })
          .catch(() => {});
      }
    }
    const coronaMaterial = this.own(
      new THREE.ShaderMaterial({
        vertexShader: discVertex,
        fragmentShader: `varying vec2 vUv;uniform float strength;uniform float time;
uniform float contactStrength;uniform float contactAngle;
float around(float a,float b){return atan(sin(a-b),cos(a-b));}
float seed(float x){return fract(sin(x*78.233+19.19)*43758.5453);}
void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float a=atan(p.y,p.x);float limb=.2083333;
float h=max(0.,r/limb-1.);float edge=smoothstep(limb-.001,limb+.0015,r)*(1.-smoothstep(.78,1.,r));
float bend=.07*sin(h*2.1+.3)*h/(1.+h);
float helmet=exp(-pow(around(a,.26+bend)/(.24+.045*h),2.))*.035*exp(-h*2.25);
helmet+=exp(-pow(around(a,3.24-bend*.7)/(.3+.04*h),2.))*.024*exp(-h*2.7);
float filaments=0.;
for(int i=0;i<18;i++){float index=float(i);float s=seed(index+3.);
float target=s*6.2831853+sin(h*1.8+s*6.283)*(.009+.021*s)*h/(1.+h);
float width=(.003+.006*seed(index+31.))*(1.+h*.15);
float plume=exp(-pow(around(a,target)/width,2.));
float detail=.85+.15*sin(h*(19.+s*21.)+s*21.);
filaments+=plume*(.045+.055*seed(index+61.))*exp(-h*(3.8+seed(index+97.)*3.))*detail;}
float strandPhase=a*157.+sin(a*31.)*2.6+log(1.+h)*8.;
float strands=pow(.5+.5*sin(strandPhase),7.)*.7;
strands+=pow(.5+.5*cos(a*101.-sin(a*19.)*2.+h*5.),9.)*.3;
float feather=.64+.2*sin(a*17.-h*3.+sin(a*5.))+.16*sin(a*43.+h*7.);
float inner=(.055+.22*strands)*exp(-h*10.)*(.65+.35*feather);
float fine=strands*.14*exp(-h*6.5)*(1.-smoothstep(.26,.62,h));
float corona=(inner+fine+helmet*(.6+.4*strands)+filaments)*edge;
float arches=exp(-pow(around(a,1.8)/.065,2.))+exp(-pow(around(a,3.84)/.1,2.))*.6;
float prominence=exp(-pow((h-.035)/.045,2.))*arches*.24*edge;
vec2 contactPoint=limb*1.013*vec2(cos(contactAngle),sin(contactAngle));
vec2 delta=(p-contactPoint)/limb;
float diamond=exp(-dot(delta,delta)/.0026);
float glint=exp(-pow(delta.x/.11,2.)-pow(delta.y/.012,2.))*.2;
glint+=exp(-pow(delta.y/.09,2.)-pow(delta.x/.012,2.))*.13;
float beads=0.;
for(int i=0;i<3;i++){float offset=(float(i)-1.)*.064;
vec2 bead=(p-limb*1.007*vec2(cos(contactAngle+offset),sin(contactAngle+offset)))/limb;
beads+=exp(-dot(bead,bead)/.00028)*(.8+.2*cos(float(i)*2.));}
float contact=(diamond+glint+beads*.45)*contactStrength;
vec3 hue=mix(vec3(1.,.975,.92),vec3(.92,.96,1.),smoothstep(0.,2.2,h));
vec3 glow=hue*corona*2.6*strength+vec3(1.,.16,.06)*prominence*1.5*strength;
glow+=vec3(1.,.94,.77)*contact*4.;
if(max(max(glow.r,glow.g),glow.b)<.002)discard;
gl_FragColor=vec4(glow,1.);}`,
        uniforms: {
          strength: { value: 0 },
          time: { value: 0 },
          contactStrength: { value: 0 },
          contactAngle: { value: 0 },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.corona = new THREE.Mesh(
      this.own(new THREE.PlaneGeometry(2, 2)),
      coronaMaterial,
    );
    this.corona.renderOrder = 9;
    this.root.add(this.corona);
    for (const id of [
      "mercury",
      "venus",
      "mars",
      "jupiter",
      "saturn",
      "uranus",
      "neptune",
    ]) {
      const material = this.own(
        new THREE.SpriteMaterial({
          color: id === "mars" ? 0xffc1a1 : 0xe7ebff,
          transparent: true,
          depthWrite: false,
        }),
      );
      const sprite = new THREE.Sprite(material);
      sprite.renderOrder = 3;
      this.root.add(sprite);
      this.bodies.set(id, sprite);
    }
  }

  update(snapshot, observer) {
    this.snapshot = snapshot;
    this.observer = observer;
    if (!this.starMaterial) return;
    const first = !this.hasSnapshot;
    this.hasSnapshot = true;
    this.motionEpochMs = Date.parse(snapshot.time);
    const observerKey = `${observer.latitude}:${observer.longitude}:${observer.elevation || 0}`;
    this.motionObserverChanged ||=
      this.motionObserverKey !== null && observerKey !== this.motionObserverKey;
    this.motionObserverKey = observerKey;
    this.motionPole.set(
      0,
      Math.sin(observer.latitude * D2R),
      -Math.cos(observer.latitude * D2R),
    );
    this.motionObserverOffset.fromArray(
      snapshot.motion?.observerOffset || [0, 0, 0],
    );
    if (snapshot.skyTransform) {
      this.targetSkyQuaternion.setFromRotationMatrix(
        new THREE.Matrix4().fromArray(snapshot.skyTransform),
      );
      if (first) {
        this.skyQuaternion.copy(this.targetSkyQuaternion);
        this.catalogue.matrix.makeRotationFromQuaternion(this.skyQuaternion);
      }
    }
    this.catalogue.matrixWorldNeedsUpdate = true;
    const eclipseDarkness = THREE.MathUtils.smoothstep(
      snapshot.solarObscuration ?? 0,
      0.97,
      1,
    );
    const horizonView =
      this.options.atmosphere &&
      (!this.options.fullSphere || this.options.eclipse);
    this.daylight = horizonView
      ? THREE.MathUtils.smoothstep(snapshot.sunAltitude, -14, 0) *
        (1 - eclipseDarkness * 0.82)
      : 0;
    const visibility = this.options.photographic
      ? 1 - this.daylight * 0.99
      : 1 - this.daylight;
    if (this.starMaterial)
      this.starMaterial.uniforms.opacity.value =
        visibility * (this.options.photographic ? 1 : 0.63);
    this.starMaterial.uniforms.exposure.value = this.options.photographic
      ? 4.8
      : 1.75;
    if (this.galaxy) {
      this.galaxyOpacity =
        visibility *
        (this.options.eclipse
          ? 0.008
          : this.options.closeup
            ? 0.012
            : this.options.photographic
              ? 0.87
              : 0.24);
      this.galaxy.material.uniforms.opacity.value = this.galaxyOpacity;
      this.galaxy.material.uniforms.exposure.value = this.options.photographic
        ? 2.35
        : 1;
      this.galaxy.material.uniforms.photographic.value = this.options
        .photographic
        ? 1
        : 0;
    }
    if (this.options.eclipse && snapshot.sunAltitude > 0)
      this.starMaterial.uniforms.opacity.value = Math.min(visibility, 0.16);
    if (this.lines) this.lines.material.opacity = visibility * 0.18;
    if (this.constellationNodes)
      this.constellationNodes.material.uniforms.opacity.value =
        visibility * 0.26;
    if (this.atmosphereMaterial) {
      this.atmosphereMaterial.uniforms.eclipseTransmission.value =
        1 - eclipseDarkness * 0.998;
      const frame = observerFrame(observer);
      this.atmosphereMaterial.worldToECEFMatrix.copy(frame);
      const sun = snapshot.bodies.find((b) => b.id === "sun");
      if (sun)
        this.atmosphereMaterial.sunDirection.copy(
          bodyDirection(sun).transformDirection(frame),
        );
    }
    const moon = snapshot.bodies.find((b) => b.id === "moon");
    for (const body of snapshot.bodies) {
      const mesh = this.bodies.get(body.id);
      if (!mesh) continue;
      const direction = bodyDirection(body);
      mesh.userData.referenceDirection ||= new THREE.Vector3();
      mesh.userData.referenceDirection.fromArray(body.direction);
      mesh.userData.targetPosition = direction.multiplyScalar(
        body.id === "moon" ? 575 : 580,
      );
      if (first) mesh.position.copy(mesh.userData.targetPosition);
      const radius =
        Math.tan(body.angularRadius * D2R) * (body.id === "moon" ? 575 : 580);
      mesh.scale.setScalar(
        ["sun", "moon"].includes(body.id) ? radius : Math.max(0.4, radius),
      );
      if (mesh.material.uniforms) {
        mesh.userData.phaseAngle = (body.phaseAngle ?? 0) * D2R;
        mesh.material.uniforms.shadowRadius.value = 0;
        mesh.material.uniforms.solarOccultation.value =
          body.id === "moon" && this.options.eclipse
            ? THREE.MathUtils.smoothstep(
                snapshot.solarObscuration ?? 0,
                0.1,
                0.6,
              )
            : 0;
      }
      if (body.id === "sun") {
        this.corona.position.copy(mesh.position);
        this.corona.scale.setScalar(radius * 4.8);
        this.corona.material.uniforms.strength.value =
          THREE.MathUtils.smoothstep(snapshot.solarObscuration ?? 0, 0.975, 1);
      }
    }
    if (moon && snapshot.solarObscuration > 0.5) {
      this.bodies.get("moon").userData.phaseAngle = Math.PI;
    }
  }

  updateCamera(camera, dt = 1 / 60, simulationTimeMs = NaN, playback = {}) {
    this.effectTime += dt;
    if (this.tracking) {
      const renderTimeMs = Number.isFinite(simulationTimeMs)
        ? simulationTimeMs
        : this.motionEpochMs;
      const deltaMs = Number.isFinite(this.motionTimeMs)
        ? renderTimeMs - this.motionTimeMs
        : 0;
      const cabal312512SiderealPhase =
        -SIDEREAL_RADIANS_PER_MS * (renderTimeMs - this.motionEpochMs);
      this.motionRotation.setFromAxisAngle(
        this.motionPole,
        cabal312512SiderealPhase,
      );
      this.motionTargetQuaternion
        .copy(this.targetSkyQuaternion)
        .premultiply(this.motionRotation);
      const continuous =
        !this.motionObserverChanged &&
        isContinuousPlayback(deltaMs, dt, playback.playing, playback.speed);
      const physicalStep = -SIDEREAL_RADIANS_PER_MS * deltaMs;
      const visualStep = readableAngularStep(
        physicalStep,
        dt,
        SKY_VISUAL_RADIANS_PER_SECOND,
      );
      if (!playback.frozen) {
        if (continuous) {
          this.motionRotation.setFromAxisAngle(this.motionPole, visualStep);
          this.skyQuaternion.premultiply(this.motionRotation).normalize();
          if (
            Math.abs(physicalStep) <=
            SKY_VISUAL_RADIANS_PER_SECOND * dt + 1e-8
          )
            this.skyQuaternion.slerp(
              this.motionTargetQuaternion,
              1 - Math.exp(-dt / 0.28),
            );
        } else {
          this.skyQuaternion.slerp(
            this.motionTargetQuaternion,
            1 - Math.exp(-dt / 0.28),
          );
        }
        this.motionObserverChanged = false;
      }
      this.catalogue.matrix.makeRotationFromQuaternion(this.skyQuaternion);
      this.catalogue.matrixWorldNeedsUpdate = true;
      for (const [id, mesh] of this.bodies) {
        const point = trajectoryPosition(
          this.snapshot?.motion?.tracks?.[id],
          renderTimeMs,
          this.motionPoint,
        );
        if (point) {
          mesh.position
            .set(point[0], point[2], -point[1])
            .applyQuaternion(this.skyQuaternion)
            .sub(this.motionObserverOffset)
            .normalize()
            .multiplyScalar(id === "moon" ? 575 : 580);
        } else if (mesh.userData.referenceDirection) {
          mesh.position
            .copy(mesh.userData.referenceDirection)
            .applyQuaternion(this.skyQuaternion)
            .multiplyScalar(id === "moon" ? 575 : 580);
        }
      }
    }
    if (Number.isFinite(simulationTimeMs)) this.motionTimeMs = simulationTimeMs;
    for (const [id, mesh] of this.bodies)
      if (id === "sun" || id === "moon")
        mesh.quaternion.copy(camera.quaternion);
    const moon = this.bodies.get("moon"),
      sun = this.bodies.get("sun");
    if (moon && sun) {
      const right = this.cameraRight
        .set(1, 0, 0)
        .applyQuaternion(camera.quaternion);
      const up = this.cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
      const moonDirection = this.phaseMoonDirection
        .copy(moon.position)
        .normalize();
      const tangent = this.phaseTangent.copy(sun.position).normalize();
      tangent.addScaledVector(moonDirection, -tangent.dot(moonDirection));
      let x = tangent.dot(right),
        y = tangent.dot(up);
      const length = Math.hypot(x, y);
      if (length > 1e-10) {
        x /= length;
        y /= length;
      } else {
        x = 1;
        y = 0;
      }
      const phase = moon.userData.phaseAngle ?? 0;
      moon.material.uniforms.phaseLight.value.set(
        x * Math.sin(phase),
        y * Math.sin(phase),
        Math.cos(phase),
      );
    }
    if (
      moon &&
      this.snapshot?.lunarShadow?.shadowDirection &&
      this.snapshot.lunarShadow.angularRadius
    ) {
      const row = this.snapshot.bodies.find((body) => body.id === "moon");
      const shadowDirection = new THREE.Vector3()
        .fromArray(this.snapshot.lunarShadow.shadowDirection)
        .applyQuaternion(this.skyQuaternion);
      const moonDirection = moon.position.clone().normalize();
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(
          camera.quaternion,
        ),
        up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      const delta = shadowDirection.sub(moonDirection),
        radius = Math.tan(row.angularRadius * D2R);
      moon.material.uniforms.shadowCenter.value.set(
        delta.dot(right) / radius,
        delta.dot(up) / radius,
      );
      moon.material.uniforms.shadowRadius.value =
        this.snapshot.lunarShadow.angularRadius / row.angularRadius;
    }
    if (this.corona && sun) this.corona.position.copy(sun.position);
    if (this.corona) {
      this.corona.quaternion.copy(camera.quaternion);
      this.corona.material.uniforms.time.value = this.effectTime;
      const solarRow = this.snapshot?.bodies.find((body) => body.id === "sun");
      const lunarRow = this.snapshot?.bodies.find((body) => body.id === "moon");
      if (moon && sun && solarRow && lunarRow) {
        const solarDirection = this.anchorPoint.copy(sun.position).normalize();
        this.contactOffset.copy(moon.position).normalize().sub(solarDirection);
        const separation =
          Math.acos(
            THREE.MathUtils.clamp(
              this.phaseMoonDirection
                .copy(moon.position)
                .normalize()
                .dot(solarDirection),
              -1,
              1,
            ),
          ) / D2R;
        this.corona.material.uniforms.contactStrength.value = this.options
          .eclipse
          ? eclipseContactEnvelope(
              separation,
              solarRow.angularRadius,
              lunarRow.angularRadius,
              this.snapshot.solarObscuration ?? 0,
            )
          : 0;
        this.corona.material.uniforms.contactAngle.value = Math.atan2(
          -this.contactOffset.dot(this.cameraUp),
          -this.contactOffset.dot(this.cameraRight),
        );
      } else this.corona.material.uniforms.contactStrength.value = 0;
    }
    if (this.constellationEffects) {
      this.constellationEffects.visible =
        this.tracking &&
        this.options.constellations &&
        !this.options.eclipse &&
        !this.options.closeup;
      this.renderer.getSize(this.effectSize);
      for (const line of [
        this.lines,
        this.highlightCore,
        this.highlightGlow,
        this.starTrails,
        this.starTrailGlow,
      ])
        line.material.resolution.copy(this.effectSize);
      for (const node of [this.constellationNodes, this.highlightNodes]) {
        node.material.uniforms.time.value = this.effectTime;
        node.material.uniforms.pixelRatio.value = this.renderer.getPixelRatio();
      }
      if (this.activeFigure) {
        const age = this.effectTime - this.highlightAt;
        const count =
          this.figureGeometry.get(this.activeFigure.id).positions.length / 6;
        const reveal = THREE.MathUtils.smoothstep(age, 0, 0.65);
        this.highlightCore.geometry.instanceCount = Math.ceil(count * reveal);
        this.highlightGlow.geometry.instanceCount = Math.ceil(count * reveal);
        this.highlightNodes.material.uniforms.opacity.value =
          (this.selectedFigure?.id === this.activeFigure.id ? 0.9 : 0.72) *
          Math.min(1, age * 5);
        this.highlightGlow.material.opacity =
          0.1 + 0.025 * Math.sin(this.effectTime * 1.7);
      }
    }
    if (this.starTrails) {
      this.starTrails.visible =
        this.tracking &&
        this.options.starTrails &&
        !this.options.eclipse &&
        !this.options.closeup;
      this.starTrailGlow.visible =
        this.starTrails.visible && this.experience.trailGlow;
      if (this.starTrails.visible) {
        this.trailReveal = advanceExposure(
          this.trailReveal,
          dt,
          this.experience.trailPlaying,
        );
        this.trailSign = playback.speed < 0 ? -1 : 1;
        const angle = exposureAngle(
          this.experience.trailExposure,
          Math.max(0.02, this.trailReveal),
          this.trailSign,
        );
        this.trailUniforms.exposureAngle.value = THREE.MathUtils.damp(
          this.trailUniforms.exposureAngle.value,
          angle,
          12,
          dt,
        );
        this.trailUniforms.exposureColor.value = this.experience.trailColor
          ? 1
          : 0;
        const fade =
          0.3 + 0.7 * THREE.MathUtils.smoothstep(this.trailReveal, 0, 1);
        this.starTrails.material.opacity = 0.66 * fade * (1 - this.daylight);
        this.starTrailGlow.material.opacity = 0.11 * fade * (1 - this.daylight);
      }
    }
    if (this.meteors) {
      this.meteors.visible =
        this.tracking &&
        this.options.meteorShower &&
        !this.options.eclipse &&
        !this.options.closeup;
      if (this.meteors.visible) this.updateMeteors(camera);
    }
    if (this.starMaterial) {
      this.starMaterial.uniforms.fieldScale.value = starZoomScale(camera.fov);
      this.starMaterial.uniforms.pixelRatio.value =
        this.renderer.getPixelRatio();
    }
    if (this.faintMaterial) {
      const detail = 1 - THREE.MathUtils.smoothstep(camera.fov, 15, 56);
      this.faintMaterial.uniforms.fieldScale.value = starZoomScale(camera.fov);
      this.faintMaterial.uniforms.pixelRatio.value =
        this.renderer.getPixelRatio();
      this.faintMaterial.uniforms.exposure.value =
        this.starMaterial.uniforms.exposure.value * (0.55 + detail * 0.45);
      this.faintMaterial.uniforms.opacity.value =
        this.starMaterial.uniforms.opacity.value * (0.54 + detail * 0.38);
    }
    // The panorama is finite-resolution imagery, not disposable decoration:
    // keep it visible at close zoom and bring in authentic detail on demand.
    if (this.galaxy)
      this.galaxy.material.uniforms.opacity.value =
        (this.tracking ? this.galaxyOpacity : 0.26) *
        (this.options.eclipse || this.options.closeup
          ? 1
          : galaxyZoomVisibility(camera.fov));
    if (this.galaxy) {
      this.updateGalaxyDetail(camera.fov, dt);
      const uniforms = this.galaxy.material.uniforms;
      // Select filtering by angular footprint, not the singular RA derivative
      // at celestial poles. This prevents oversized radial mip footprints.
      const texelsPerPixel =
        (uniforms.map.value.image.height * camera.fov) /
        180 /
        this.renderer.domElement.height;
      uniforms.mapLod.value = Math.max(
        0,
        Math.log2(Math.max(texelsPerPixel, 1)),
      );
      const baseTexelsPerPixel =
        (this.baseGalaxyTexture.image.height * camera.fov) /
        180 /
        this.renderer.domElement.height;
      uniforms.baseMapLod.value = Math.max(
        0,
        Math.log2(Math.max(baseTexelsPerPixel, 1)),
      );
    }
  }

  setOptions(options) {
    if (options.starTrails && !this.options.starTrails) {
      this.restartExposure();
    }
    if (options.meteorShower && !this.options.meteorShower)
      this.resetMeteorSchedule();
    Object.assign(this.options, options);
    if (this.lines)
      this.lines.visible =
        !!this.options.constellations &&
        !this.options.eclipse &&
        !this.options.closeup;
    if (this.highlight)
      this.highlight.visible =
        !!this.activeFigure &&
        !!this.options.constellations &&
        !this.options.eclipse &&
        !this.options.closeup;
    const horizonView =
      this.options.atmosphere &&
      (!this.options.fullSphere || this.options.eclipse);
    if (this.ground) this.ground.visible = !!horizonView;
    if (this.atmosphereMesh) this.atmosphereMesh.visible = !!horizonView;
    if (this.snapshot) this.update(this.snapshot, this.observer);
    if (!this.tracking) {
      if (this.ground) this.ground.visible = false;
      if (this.atmosphereMesh) this.atmosphereMesh.visible = false;
      if (this.lines) this.lines.visible = false;
      if (this.highlight) this.highlight.visible = false;
      if (this.galaxy) this.galaxy.material.uniforms.opacity.value = 0.26;
      if (this.starMaterial) this.starMaterial.uniforms.opacity.value = 0.55;
    }
  }

  setVisible(visible) {
    this.root.visible = visible;
  }

  meteorRadiantDirection() {
    return this.meteorRadiant.clone().transformDirection(this.catalogue.matrix);
  }

  setExperience(input) {
    const previous = this.experience;
    this.experience = normalizeSkyExperience(input, previous);
    if (previous.meteorPreset !== this.experience.meteorPreset) {
      this.updateMeteorRadiant();
      this.resetMeteorSchedule();
    } else if (previous.meteorRate !== this.experience.meteorRate) {
      for (const mesh of this.meteorMeshes || []) {
        const flight = mesh.userData.flight;
        const waitingFrom = Math.max(
          this.effectTime,
          flight.startedAt + flight.duration,
        );
        flight.nextAt =
          waitingFrom +
          (Math.max(0, flight.nextAt - waitingFrom) * previous.meteorRate) /
            this.experience.meteorRate;
      }
    }
    this.trailUniforms.exposureColor.value = this.experience.trailColor ? 1 : 0;
    return this.experienceState();
  }

  experienceState() {
    return { ...this.experience, trailProgress: this.trailReveal };
  }

  restartExposure() {
    this.trailReveal = 0;
    this.trailUniforms.exposureAngle.value = exposureAngle(
      this.experience.trailExposure,
      0.02,
      this.trailSign,
    );
    return this.experienceState();
  }

  updateMeteorRadiant() {
    const preset = METEOR_PRESETS[this.experience.meteorPreset];
    this.meteorRadiant.copy(starVector(preset.ra, preset.dec));
    if (!this.radiantRight) return;
    this.radiantRight.set(0, 1, 0).cross(this.meteorRadiant).normalize();
    this.radiantUp
      .crossVectors(this.meteorRadiant, this.radiantRight)
      .normalize();
  }

  resetMeteorSchedule() {
    this.meteorEntryTime = this.effectTime;
    this.meteorGeneration++;
    for (const mesh of this.meteorMeshes || []) {
      const flight = mesh.userData.flight;
      flight.startedAt = -100;
      flight.duration = 1;
      flight.hero = flight.slot < 4;
      flight.nextAt =
        this.effectTime +
        (flight.hero
          ? 0.12 + flight.slot * 0.48
          : 2.2 + meteorSeed(flight.slot + this.meteorGeneration * 31) * 11);
      mesh.visible = false;
    }
  }

  meteorBurst() {
    let scheduled = 0;
    this.meteorBurstCount++;
    for (const mesh of this.meteorMeshes || []) {
      const flight = mesh.userData.flight;
      if (this.effectTime - flight.startedAt < flight.duration) continue;
      flight.hero = true;
      flight.nextAt = this.effectTime + 0.08 + scheduled * 0.17;
      if (++scheduled === 6) break;
    }
    return scheduled;
  }

  startMeteor(mesh) {
    const flight = mesh.userData.flight;
    const seed =
      flight.slot + ++flight.generation * 73 + this.meteorGeneration * 131;
    const hero = flight.hero;
    const bearing = meteorSeed(seed + 1) * Math.PI * 2;
    flight.tangent
      .copy(this.radiantRight)
      .multiplyScalar(Math.cos(bearing))
      .addScaledVector(this.radiantUp, Math.sin(bearing));
    flight.startAngle = hero
      ? 0.09 + meteorSeed(seed + 2) * 0.09
      : 0.07 + meteorSeed(seed + 2) * 0.45;
    flight.travelAngle = hero
      ? 0.44 + meteorSeed(seed + 3) * 0.12
      : 0.3 + meteorSeed(seed + 3) * 0.45;
    flight.duration = hero
      ? 2.05 + meteorSeed(seed + 4) * 0.55
      : 0.7 + meteorSeed(seed + 4) * 0.95;
    flight.length = hero
      ? 94 + meteorSeed(seed + 5) * 44
      : 45 + meteorSeed(seed + 5) * 72;
    flight.width = hero
      ? 14 + meteorSeed(seed + 6) * 7
      : 8 + meteorSeed(seed + 6) * 9;
    flight.intensity = hero
      ? 1.35 + meteorSeed(seed + 7) * 0.6
      : 0.8 + meteorSeed(seed + 7) * 0.9;
    const warmth = METEOR_PRESETS[this.experience.meteorPreset].warmth;
    mesh.material.uniforms.tint.value.setRGB(
      1,
      0.64 + warmth * 0.18,
      0.29 + meteorSeed(seed + 8) * 0.28 + (1 - warmth) * 0.14,
    );
    flight.startedAt = this.effectTime;
    flight.nextAt =
      this.effectTime +
      flight.duration +
      (7 + meteorSeed(seed + 9) * 15) / this.experience.meteorRate;
    flight.hero = false;
  }

  updateMeteors() {
    let active = 0;
    for (const mesh of this.meteorMeshes) {
      const flight = mesh.userData.flight;
      if (this.effectTime >= flight.nextAt) this.startMeteor(mesh);
      const phase = (this.effectTime - flight.startedAt) / flight.duration;
      mesh.visible = phase >= 0 && phase < 1;
      if (!mesh.visible) continue;
      active++;
      const angle = flight.startAngle + phase * flight.travelAngle;
      this.meteorDirection
        .copy(this.meteorRadiant)
        .multiplyScalar(Math.cos(angle))
        .addScaledVector(flight.tangent, Math.sin(angle));
      this.meteorTangent
        .copy(this.meteorRadiant)
        .multiplyScalar(-Math.sin(angle))
        .addScaledVector(flight.tangent, Math.cos(angle))
        .normalize();
      mesh.position
        .copy(this.meteorDirection)
        .multiplyScalar(SKY_RADIUS - 24)
        .addScaledVector(this.meteorTangent, -flight.length * 0.43);
      this.meteorNormal.copy(this.meteorDirection).negate();
      this.meteorCross
        .crossVectors(this.meteorNormal, this.meteorTangent)
        .normalize();
      mesh.quaternion.setFromRotationMatrix(
        this.meteorBasis.makeBasis(
          this.meteorTangent,
          this.meteorCross,
          this.meteorNormal,
        ),
      );
      mesh.scale.set(
        flight.length * (0.55 + 0.45 * Math.sin(phase * Math.PI)),
        flight.width,
        1,
      );
      mesh.material.uniforms.age.value = phase;
      mesh.material.uniforms.strength.value =
        THREE.MathUtils.smoothstep(phase, 0, 0.075) *
        (1 - THREE.MathUtils.smoothstep(phase, 0.68, 1)) *
        flight.intensity;
    }
    this.renderer.domElement.dataset.meteorActive = String(active);
  }

  async setQuality(quality) {
    this.quality = quality;
    await this.ready;
    if (this.disposed) return;
    // A manual setting can retry a failed optional download. Automatic zoom
    // requests stay blocked after failure, avoiding a request on every frame.
    this.detailLoadFailed = false;
    this.automaticDetail = false;
    if (quality === "high") return this.loadGalaxyDetail();
    this.detailTarget = 0;
  }

  wantsGalaxyDetail() {
    return (
      !this.disposed &&
      this.renderer.capabilities.maxTextureSize >= 8192 &&
      (this.quality === "high" || this.automaticDetail)
    );
  }

  async loadGalaxyDetail() {
    if (
      !this.wantsGalaxyDetail() ||
      this.highGalaxyTexture ||
      this.detailLoadFailed
    )
      return;
    if (this.highTexturePromise) return this.highTexturePromise;
    const request = textureLoader
      .loadAsync("/planetarium/assets/milkyway-high.jpg")
      .then((texture) => {
        if (!this.wantsGalaxyDetail()) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        // Explicit angular LOD avoids the singular equirectangular footprint
        // at the poles. Do not reintroduce derivative-driven anisotropic blur.
        texture.anisotropy = 1;
        this.highGalaxyTexture = texture;
        const uniforms = this.galaxy.material.uniforms;
        uniforms.map.value = texture;
        // SVS stores less radiance per pixel at twice the linear resolution.
        // Normalize before crossfading the same sky in the same color grade.
        uniforms.radianceScale.value = 4;
        this.detailBlend = 0;
        this.detailTarget = 1;
        uniforms.detailBlend.value = 0;
        this.renderer.domElement.dataset.skyResolution = String(
          texture.image.width,
        );
      })
      .catch((error) => {
        this.detailLoadFailed = true;
        throw error;
      })
      .finally(() => {
        if (this.highTexturePromise === request) this.highTexturePromise = null;
      });
    this.highTexturePromise = request;
    return request;
  }

  updateGalaxyDetail(fieldOfView, dt) {
    this.automaticDetail =
      this.quality !== "high" &&
      automaticSkyDetail(
        fieldOfView,
        this.automaticDetail,
        this.tracking,
        this.options.eclipse || this.options.closeup,
      );
    if (this.wantsGalaxyDetail()) {
      this.detailTarget = 1;
      if (
        !this.highGalaxyTexture &&
        !this.highTexturePromise &&
        !this.detailLoadFailed
      )
        this.loadGalaxyDetail().catch(() => {});
    } else {
      this.detailTarget = 0;
    }
    if (this.highGalaxyTexture) {
      this.detailBlend = THREE.MathUtils.damp(
        this.detailBlend,
        this.detailTarget,
        7,
        dt,
      );
      this.galaxy.material.uniforms.detailBlend.value = this.detailBlend;
      if (this.detailTarget === 0 && this.detailBlend < 0.002) {
        this.galaxy.material.uniforms.map.value = this.baseGalaxyTexture;
        this.galaxy.material.uniforms.radianceScale.value = 1;
        this.galaxy.material.uniforms.detailBlend.value = 1;
        this.highGalaxyTexture.dispose();
        this.highGalaxyTexture = null;
        this.detailBlend = 1;
      }
    }
    this.renderer.domElement.dataset.skyResolution = String(
      this.galaxy.material.uniforms.map.value.image.width,
    );
  }

  highlightConstellation(figure) {
    if (!this.highlight) return;
    this.hovered = figure;
    this.refreshConstellationHighlight();
  }

  selectConstellation(figure) {
    this.selectedFigure = figure;
    this.hovered = null;
    this.refreshConstellationHighlight(true);
  }

  refreshConstellationHighlight(restart = false) {
    const figure = this.hovered || this.selectedFigure;
    if (this.activeFigure?.id === figure?.id && !restart) return;
    this.activeFigure = figure;
    this.highlight.visible =
      !!figure &&
      !!this.options.constellations &&
      !this.options.eclipse &&
      !this.options.closeup;
    if (!figure) return;
    const data = this.figureGeometry.get(figure.id);
    if (!data) return;
    if (!data.highlightGeometry) {
      data.highlightGeometry = this.own(new LineSegmentsGeometry());
      data.highlightGeometry.setPositions(data.positions);
      data.nodeGeometry = this.own(new THREE.BufferGeometry());
      data.nodeGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(data.nodes, 3),
      );
      data.nodeGeometry.setAttribute(
        "size",
        new THREE.Float32BufferAttribute(
          Array(data.nodes.length / 3).fill(12.5),
          1,
        ),
      );
    }
    this.highlightCore.geometry = data.highlightGeometry;
    this.highlightGlow.geometry = data.highlightGeometry;
    this.highlightNodes.geometry = data.nodeGeometry;
    this.highlightAt = this.effectTime;
    this.highlightNodes.material.uniforms.onset.value = this.effectTime;
    data.highlightGeometry.instanceCount = 0;
  }

  constellationAnchor(figure, camera) {
    const data = this.figureGeometry.get(figure.id);
    if (!data) return null;
    const direction = camera.getWorldDirection(this.effectForward);
    this.anchorPoint
      .copy(data.center)
      .multiplyScalar(SKY_RADIUS - 1)
      .applyMatrix4(this.catalogue.matrix);
    const centerProjection = this.projectedPoint
      .copy(this.anchorPoint)
      .project(camera);
    if (
      this.anchorPoint.dot(direction) > 0 &&
      Math.abs(centerProjection.x) < 0.91 &&
      Math.abs(centerProjection.y) < 0.9
    )
      return this.anchorPoint.clone();
    let best = null,
      score = Infinity;
    for (let i = 0; i < data.nodes.length; i += 3) {
      this.anchorPoint
        .fromArray(data.nodes, i)
        .applyMatrix4(this.catalogue.matrix);
      if (this.anchorPoint.dot(direction) <= 0) continue;
      const point = this.projectedPoint.copy(this.anchorPoint).project(camera);
      if (Math.abs(point.x) > 0.94 || Math.abs(point.y) > 0.9) continue;
      const distance = point.x ** 2 + point.y ** 2;
      if (distance < score) {
        score = distance;
        best = this.anchorPoint.clone();
      }
    }
    return best;
  }

  nearest(direction, camera, forHover = false) {
    if (!this.starRows.length) return null;
    this.inverseCatalogue.copy(this.catalogue.matrix).invert();
    const eq = this.pointerDirection
      .copy(direction)
      .transformDirection(this.inverseCatalogue);
    const pixels = forHover ? 12 : 9;
    const height = this.renderer.domElement.clientHeight || 800;
    const angularTolerance = Math.atan(
      (2 * Math.tan((camera.fov * D2R) / 2) * pixels) / height,
    );
    const threshold = Math.cos(angularTolerance);
    if (forHover) {
      if (
        !this.options.constellations ||
        !this.tracking ||
        this.options.eclipse ||
        this.options.closeup
      )
        return null;
      return nearestConstellation(
        eq,
        this.figureGeometry.values(),
        angularTolerance,
      );
    }
    let best = null,
      dot = threshold;
    for (const body of this.snapshot?.bodies ?? []) {
      const mesh = this.bodies.get(body.id);
      const score = mesh
        ? this.anchorPoint.copy(mesh.position).normalize().dot(direction)
        : bodyDirection(body).dot(direction);
      if (score > dot) {
        dot = score;
        best = { ...body, kind: "planet" };
      }
    }
    for (const row of this.starRows) {
      if (!row.name && row.mag > 3.2) continue;
      const score = starVector(row.ra, row.dec).dot(eq);
      if (score > dot) {
        dot = score;
        best = { ...row, kind: "star" };
      }
    }
    return best;
  }

  directionFor(object) {
    if (object.kind === "constellation") {
      const data = this.figureGeometry.get(object.id);
      return (
        data?.center.clone().transformDirection(this.catalogue.matrix) ?? null
      );
    }
    if (object.kind === "star")
      return starVector(object.ra, object.dec).transformDirection(
        this.catalogue.matrix,
      );
    const body = this.snapshot?.bodies.find((b) => b.id === object.id);
    return body ? bodyDirection(body) : null;
  }

  dispose() {
    this.disposed = true;
    this.faintCatalogueAbort.abort();
    this.highGalaxyTexture?.dispose();
    this.scene.remove(this.root);
    for (const resource of this.resources) resource.dispose?.();
    this.resources.length = 0;
  }
}
