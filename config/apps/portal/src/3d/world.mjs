import * as THREE from 'three';
import {
  WORLD_SIZE, WATER_LEVEL, SPAWN, LANDMARKS, heightAt, riverShapeAt, riverCenter, randomFor,
} from './terrain.mjs';
import { CITIES, cityHalf, routeDistanceTo } from './city-data.mjs';
import { createRoadNetwork } from './roads.mjs';

const TILE = 512;
const RADIUS = 2;
const HALF = WORLD_SIZE / 2;
const mix = (a, b, t) => a + (b - a) * t;
const VILLAGES = [
  { x: 0, z: -170, rows: 15, spacing: 42, width: 44, ground: 10 },
  { x: -3000, z: 2500, rows: 9, spacing: 39, width: 40, ground: 22 },
  { x: 4200, z: 2600, rows: 9, spacing: 41, width: 40, ground: 28 },
];

function roofGeometry() {
  const p = [
    -.5, 0, -.5, 0, .5, -.5, 0, .5, .5, -.5, 0, .5,
    0, .5, -.5, .5, 0, -.5, .5, 0, .5, 0, .5, .5,
    -.5, 0, -.5, .5, 0, -.5, 0, .5, -.5,
    .5, 0, .5, -.5, 0, .5, 0, .5, .5,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([
    0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, .5, 1, 0, 0, 1, 0, .5, 1,
  ], 2));
  g.setIndex([0, 2, 1, 0, 3, 2, 4, 6, 5, 4, 7, 6, 8, 10, 9, 11, 13, 12]);
  g.computeVertexNormals();
  return g;
}

function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

// Bake an original lit density field, rather than stamping identical white puffs.
// The transparent border never touches the sprite edge; no rectangular cutoffs.
function cloudTexture(seed) {
  return canvasTexture(384, (ctx, size) => {
    const data = ctx.createImageData(size, size);
    const puff = Array.from({ length: 12 }, (_, i) => ({
      x: (randomFor(i, seed, 41) - .5) * 1.12,
      y: -.08 + (randomFor(i, seed, 42) - .5) * .63,
      rx: .21 + randomFor(i, seed, 43) * .24,
      ry: .17 + randomFor(i, seed, 44) * .25,
    }));
    const fade = t => t * t * (3 - 2 * t);
    const noise = (x, y) => {
      const ix = Math.floor(x), iy = Math.floor(y), u = fade(x - ix), v = fade(y - iy);
      return mix(mix(randomFor(ix, iy, seed), randomFor(ix + 1, iy, seed), u), mix(randomFor(ix, iy + 1, seed), randomFor(ix + 1, iy + 1, seed), u), v);
    };
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const px = x / size * 2 - 1, py = y / size * 2 - 1;
      let field = 0, gx = 0, gy = 0;
      for (const p of puff) {
        const dx = (px - p.x) / p.rx, dy = (py - p.y) / p.ry;
        const q = dx * dx + dy * dy;
        if (q >= 1) continue;
        const f = 1 - q;
        field += f * f;
        gx += -4 * dx * f / p.rx;
        gy += -4 * dy * f / p.ry;
      }
      if (!field) continue;
      const detail = noise(px * 13 + 41, py * 13 + 17) * .55
        + noise(px * 29 + 41, py * 29 + 17) * .28
        + noise(px * 61 + 41, py * 61 + 17) * .17;
      const cover = Math.max(0, Math.min(1, (field - .12 + (detail - .5) * .32) / .34));
      if (!cover) continue;
      const nx = -gx * .16, ny = -gy * .16, nz = 1.5;
      const len = Math.hypot(nx, ny, nz);
      const light = Math.max(0, (-.38 * nx - .68 * ny + .63 * nz) / len);
      const underneath = Math.max(0, Math.min(1, (py + .17) * 1.2));
      const brightness = Math.min(1, .68 + light * .32 - underneath * .13 + detail * .055);
      const at = (y * size + x) * 4;
      data.data[at] = Math.round(brightness * 249);
      data.data[at + 1] = Math.round(brightness * 252);
      data.data[at + 2] = Math.round(Math.min(1, brightness + underneath * .035) * 255);
      data.data[at + 3] = Math.round(fade(cover) * 250);
    }
    ctx.putImageData(data, 0, 0);
  });
}

// World geometry is original procedural code. No external models/textures load.
export function createWorld(scene, options = {}) {
  // Fine spatial buckets are optional: more draw calls slowed the tested GPU.
  const requestedCellSize = options.staticBatchCellSize ?? 0;
  const staticBatchCellSize = Number.isFinite(requestedCellSize) && requestedCellSize > 0 ? requestedCellSize : 0;
  // The caller selects this experiment only after checking WEBGL_multi_draw.
  // An explicit failed capability check always retains ordinary instancing.
  const requestedBatchMode = options.staticBatchMode === 'batched' ? 'batched' : 'instanced';
  const staticBatchMode = requestedBatchMode === 'batched' && options.multiDrawSupported !== false ? 'batched' : 'instanced';
  const root = new THREE.Group();
  root.name = 'aero-world';
  scene.add(root);
  scene.background = new THREE.Color('#66c8fa');
  scene.fog = new THREE.Fog('#bcdef4', 1050, 5200);
  const materials = new Set();
  const geometries = new Set();
  const textures = new Set();
  const disposableBatches = new Set();
  const tiles = new Map();
  const colliders = [];
  const colliderGrid = new Map();
  const colliderGridSize = 64;
  const housePads = [];
  const housePadGrid = new Map();
  const tileColliders = new Map();
  const clouds = [];
  const animated = [];
  const restStations = [];
  let disposed = false;
  let lastTile = '';
  const stats = {
    worldSize: WORLD_SIZE, areaKm2: WORLD_SIZE * WORLD_SIZE / 1e6,
    tileSize: TILE, maxChunks: (RADIUS * 2 + 1) ** 2, activeChunks: 0,
    terrainVertices: 0, buildings: 0, colliders: 0, rivers: 1,
    trees: 0, flowers: 0, clouds: 0, anomalies: 7, decorativeEntities: 2, streamedTiles: 0,
    streamedCreated: 0, streamedDisposed: 0, currentTile: '', activeChunkKeys: [],
    colliderSamples: [],
    staticBatchCellSize, staticBatchMode, staticBatches: 0, batchedMeshes: 0,
    cityDistricts: CITIES.length, restStations: 0, scenery: {},
    bounds: Object.freeze({ minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF }),
  };
  const keepGeo = g => (geometries.add(g), g);
  const keepMat = m => (materials.add(m), m);
  const keepTex = t => (textures.add(t), t);
  // BatchedMesh owns its copied geometry and matrix/indirection textures.
  // Its external material and source geometry remain in the shared registries.
  const keepDisposeBatch = mesh => (disposableBatches.add(mesh), mesh);
  const standard = options => keepMat(new THREE.MeshStandardMaterial(options));
  const physical = options => keepMat(new THREE.MeshPhysicalMaterial(options));
  const box = keepGeo(new THREE.BoxGeometry(1, 1, 1));
  const cylinder = keepGeo(new THREE.CylinderGeometry(.5, .5, 1, 12));
  const cone = keepGeo(new THREE.ConeGeometry(1, 1, 8));
  const sphere = keepGeo(new THREE.IcosahedronGeometry(1, 1));
  const roof = keepGeo(roofGeometry());
  const foliage = keepGeo(new THREE.IcosahedronGeometry(1, 2));
  const fp = foliage.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i), y = fp.getY(i), z = fp.getZ(i);
    const s = 1 + Math.sin(x * 8 + z * 4) * Math.cos(y * 9 - z * 7) * .11;
    fp.setXYZ(i, x * s, y * s, z * s);
  }
  foliage.computeVertexNormals();
  const grassTex = keepTex(canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#7db13e'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 17000; i++) {
      const r = randomFor(i, 33), x = randomFor(i, 39) * s, y = randomFor(i, 45) * s;
      ctx.strokeStyle = r > .4 ? 'rgba(202,224,107,.4)' : 'rgba(38,77,23,.31)';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1, y - 2 - r * 4); ctx.stroke();
    }
  }));
  const grassBump = keepTex(canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#747474'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 7500; i++) {
      const n = Math.floor(70 + randomFor(i, 193) * 145);
      ctx.strokeStyle = `rgb(${n},${n},${n})`;
      const x = randomFor(i, 195) * s, y = randomFor(i, 197) * s;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1.2, y - 3); ctx.stroke();
    }
  }));
  grassBump.colorSpace = THREE.NoColorSpace;
  const asphaltTex = keepTex(canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#e2edf2'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 28000; i++) {
      const v = Math.floor(205 + randomFor(i, 185) * 34);
      ctx.fillStyle = `rgba(${v},${v + 3},${v + 7},.35)`;
      ctx.fillRect(randomFor(i, 151) * s, randomFor(i, 156) * s, 1.2, 1.2);
    }
  }));
  asphaltTex.repeat.set(5, 80);
  const asphaltBump = keepTex(canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#828282'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 12500; i++) {
      const v = Math.floor(50 + randomFor(i, 11) * 170);
      ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(randomFor(i, 34) * s, randomFor(i, 35) * s, 1, 1);
    }
  }));
  asphaltBump.colorSpace = THREE.NoColorSpace; asphaltBump.repeat.copy(asphaltTex.repeat);
  const roofTex = keepTex(canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#68616c'; ctx.fillRect(0, 0, s, s);
    for (let row = 0; row < 16; row++) for (let col = 0; col < 12; col++) {
      const n = Math.floor(76 + randomFor(col, row, 19) * 35);
      const x = col * 24 + (row % 2 ? -12 : 0), y = row * 16;
      ctx.fillStyle = `rgb(${n + 8},${n},${n + 9})`; ctx.fillRect(x, y + 1, 23, 14);
      ctx.fillStyle = 'rgba(22,20,24,.37)'; ctx.fillRect(x, y + 14, 24, 2);
    }
  }));
  roofTex.repeat.set(2, 2);
  const roofBump = keepTex(canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#909090'; ctx.fillRect(0, 0, s, s);
    for (let row = 0; row < 16; row++) for (let col = 0; col < 12; col++) {
      const x = col * 24 + (row % 2 ? -12 : 0), y = row * 16;
      ctx.fillStyle = '#5b5b5b'; ctx.fillRect(x, y + 14, 24, 2); ctx.fillRect(x + 23, y, 1, 16);
    }
  }));
  roofBump.colorSpace = THREE.NoColorSpace; roofBump.repeat.set(2, 2);
  const facadeTex = keepTex(canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#7bbfe0'; ctx.fillRect(0, 0, s, s);
    const gradient = ctx.createLinearGradient(0, 0, s, 0);
    gradient.addColorStop(0, 'rgba(10,61,119,.55)');
    gradient.addColorStop(.5, 'rgba(235,255,255,.17)');
    gradient.addColorStop(1, 'rgba(4,74,112,.28)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 13) {
      ctx.fillStyle = '#d8edf0'; ctx.fillRect(0, y, s, 1.8);
      ctx.fillStyle = 'rgba(21,61,109,.24)'; ctx.fillRect(0, y + 2, s, 1);
    }
    for (let x = 0; x < s; x += 29) {
      ctx.fillStyle = '#b8dce5'; ctx.fillRect(x, 0, 2, s);
    }
  }));
  const sidingTex = keepTex(canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 12) {
      ctx.fillStyle = 'rgba(84,103,127,.11)'; ctx.fillRect(0, y, s, 1);
      ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(0, y + 1, s, 1);
    }
  }));
  const sidingBump = keepTex(canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#a0a0a0'; ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 12) {
      ctx.fillStyle = '#454545'; ctx.fillRect(0, y, s, 1);
      ctx.fillStyle = '#bababa'; ctx.fillRect(0, y + 1, s, 2);
    }
  }));
  sidingBump.colorSpace = THREE.NoColorSpace;
  const cloudTextures = [71, 128, 391].map(seed => {
    const texture = keepTex(cloudTexture(seed));
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  });
  const groundMat = standard({ map: grassTex, bumpMap: grassBump, bumpScale: .11, roughnessMap: grassBump, vertexColors: true, roughness: .98 });
  const nearCoverage = new THREE.Vector4(-HALF, HALF, -HALF, HALF);
  const farGroundMat = keepMat(groundMat.clone());
  let farMaskCompiled = false;
  farGroundMat.onBeforeCompile = shader => {
    shader.uniforms.ocvNearCoverage = { value: nearCoverage };
    shader.vertexShader = `varying vec2 ocvFarXZ;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nocvFarXZ=(modelMatrix*vec4(transformed,1.)).xz;');
    shader.fragmentShader = `uniform vec4 ocvNearCoverage;varying vec2 ocvFarXZ;\n${shader.fragmentShader}`
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if(ocvFarXZ.x>=ocvNearCoverage.x&&ocvFarXZ.x<=ocvNearCoverage.y&&ocvFarXZ.y>=ocvNearCoverage.z&&ocvFarXZ.y<=ocvNearCoverage.w)discard;`);
    farMaskCompiled = true;
  };
  farGroundMat.customProgramCacheKey = () => 'ocv-far-near-coverage-v1';
  const roadMat = standard({ map: asphaltTex, bumpMap: asphaltBump, bumpScale: .016, color: '#ffffff', roughness: .81 });
  const highwayMat = standard({ color: '#eff6fa', roughness: .72, bumpMap: asphaltBump, bumpScale: .011 });
  const whiteMat = standard({ color: '#faf9ed', roughness: .68 });
  const roofMat = standard({ map: roofTex, bumpMap: roofBump, bumpScale: .15, roughness: .85 });
  const glassMat = physical({ color: '#b3e4f4', metalness: .1, roughness: .075, transmission: .28, thickness: .15, ior: 1.45, clearcoat: 1, clearcoatRoughness: .035 });
  const trunkMat = standard({ color: '#a28657', roughness: .95 });
  const leafMat = standard({ color: '#79ba45', roughness: .85 });
  const leafLightMat = standard({ color: '#a6d95e', roughness: .9 });
  const grassBladeMat = standard({ color: '#91c543', roughness: 1, side: THREE.DoubleSide });
  const yellowMat = standard({ color: '#ffdf30', roughness: .7 });
  const flowerCenterMat = standard({ color: '#8d6d1d', roughness: .8 });
  const paleMat = standard({ color: '#d8ecef', metalness: .2, roughness: .2 });
  const towerMat = physical({ map: facadeTex, color: '#e2f5ff', roughness: .12, metalness: .32, clearcoat: 1, clearcoatRoughness: .075 });
  const pastels = ['#f899ad', '#e8ef8b', '#99d98a', '#ffc975', '#9bd9ef', '#d0b4f1', '#fff0aa']
    .map(color => standard({ color, map: sidingTex, bumpMap: sidingBump, bumpScale: .09, roughness: .77 }));
  const blueGlass = physical({ color: '#bbeaff', transmission: .86, thickness: 6, attenuationColor: new THREE.Color('#72c5f0'), attenuationDistance: 140, ior: 1.32, metalness: 0, roughness: .035, clearcoat: 1, clearcoatRoughness: .03 });
  const chrome = physical({ color: '#e4f8ff', metalness: .8, roughness: .11, clearcoat: 1 });
  const coral = standard({ color: '#ffd0bd', roughness: .42 });
  const tileMat = physical({ color: '#e8edef', roughness: .29, clearcoat: .45, bumpMap: asphaltBump, bumpScale: .008 });
  const pinkTileMat = physical({ color: '#edc2ce', roughness: .31, clearcoat: .4 });
  const seatMat = standard({ color: '#8eaaaa', roughness: .58 });
  const darkMetal = physical({ color: '#657c86', metalness: .65, roughness: .26 });
  const lampMat = physical({ color: '#dffcff', roughness: .12, clearcoat: 1, emissive: '#bdedfa', emissiveIntensity: .18 });
  const poolBorderMat = physical({ color: '#dae8e8', roughness: .23, clearcoat: .8 });
  const restGlassMat = physical({ color: '#d8f5ff', transmission: .7, thickness: .3, roughness: .045, ior: 1.3, clearcoat: 1 });
  const capitalFacades = ['#537f9b', '#3d6b83', '#598d98', '#456678', '#467b8c']
    .map(color => physical({ color, map: facadeTex, metalness: .38, roughness: .2, clearcoat: .8, clearcoatRoughness: .055 }));
  const capitalWindows = physical({ color: '#287999', map: facadeTex, metalness: .46, roughness: .07, clearcoat: 1, clearcoatRoughness: .025 });
  const capitalTrim = physical({ color: '#294f69', metalness: .72, roughness: .21, clearcoat: .7 });
  const capitalPlinth = standard({ color: '#486a7a', metalness: .38, roughness: .4 });

  // Instanced buckets share geometry; BatchedMesh owns a private geometry copy.
  function batches(group, spatial = false) {
    const buckets = new Map();
    const dummy = new THREE.Object3D();
    return {
      add(geometry, material, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
        const batched = spatial && staticBatchMode === 'batched' && !material.transparent && !material.transmission;
        const cell = !batched && spatial && staticBatchCellSize && !material.transparent && !material.transmission
          ? `:${Math.floor(x / staticBatchCellSize)},${Math.floor(z / staticBatchCellSize)}` : '';
        const key = `${geometry.uuid}:${material.uuid}${cell}`;
        if (!buckets.has(key)) buckets.set(key, { geometry, material, batched, matrices: [] });
        dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz);
        dummy.rotation.set(rx, ry, rz); dummy.updateMatrix();
        buckets.get(key).matrices.push(dummy.matrix.clone());
      },
      finish() {
        for (const bucket of buckets.values()) {
          let mesh;
          if (bucket.batched) {
            mesh = keepDisposeBatch(new THREE.BatchedMesh(bucket.matrices.length,
              bucket.geometry.attributes.position.count, bucket.geometry.index?.count ?? 0, bucket.material));
            const geometryId = mesh.addGeometry(bucket.geometry);
            for (const matrix of bucket.matrices) mesh.setMatrixAt(mesh.addInstance(geometryId), matrix);
            mesh.perObjectFrustumCulled = true;
            // Keep original instance order; transmission/transparent buckets
            // remain InstancedMesh and never enter this branch.
            mesh.sortObjects = false;
            stats.batchedMeshes++;
          } else {
            mesh = new THREE.InstancedMesh(bucket.geometry, bucket.material, bucket.matrices.length);
            bucket.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
            mesh.instanceMatrix.needsUpdate = true;
          }
          mesh.updateMatrix();
          mesh.matrixAutoUpdate = false;
          mesh.computeBoundingSphere();
          mesh.castShadow = bucket.material !== glassMat && !bucket.material.transmission;
          mesh.receiveShadow = true;
          group.add(mesh);
          if (spatial) stats.staticBatches++;
        }
      },
    };
  }
  const environment = new THREE.Group();
  root.add(environment);
  const reflectionFaces = Array.from({ length: 6 }, (_, side) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 128);
    gradient.addColorStop(0, side === 3 ? '#75a73f' : '#156bc9');
    gradient.addColorStop(.58, side === 3 ? '#93c859' : '#8ed8ff');
    gradient.addColorStop(.79, '#d4f4ff');
    gradient.addColorStop(1, '#93c96a');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    if (side !== 3) for (let i = 0; i < 8; i++) {
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.beginPath(); ctx.ellipse(randomFor(i, side, 222) * 128, 16 + randomFor(i, side, 322) * 55, 12 + randomFor(i, side, 422) * 22, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
    return canvas;
  });
  const reflection = keepTex(new THREE.CubeTexture(reflectionFaces));
  reflection.colorSpace = THREE.SRGBColorSpace; reflection.needsUpdate = true;
  const previousEnvironment = scene.environment;
  scene.environment = reflection; scene.environmentIntensity = .55;
  const hemi = new THREE.HemisphereLight('#d2e9ff', '#abb9b8', 1.05);
  const sunLight = new THREE.DirectionalLight('#fff9ef', 2.8);
  sunLight.position.set(-170, 290, -140);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = sunLight.shadow.camera.bottom = -170;
  sunLight.shadow.camera.right = sunLight.shadow.camera.top = 170;
  sunLight.shadow.camera.near = 1; sunLight.shadow.camera.far = 850;
  sunLight.shadow.bias = -.00018; sunLight.shadow.normalBias = .08;
  sunLight.shadow.autoUpdate = false; sunLight.shadow.needsUpdate = true;
  const shadowAnchor = new THREE.Vector3(Infinity, Infinity, Infinity);
  environment.add(hemi, sunLight, sunLight.target);
  stats.shadows = Object.freeze({ mapSize: 2048, span: 340, mode: 'directional-following' });
  Object.defineProperties(stats, {
    shadowMapReady: { enumerable: true, get: () => Boolean(sunLight.shadow.map?.texture) },
    shadowMapAllocated: {
      enumerable: true,
      get: () => sunLight.shadow.map ? Object.freeze({ width: sunLight.shadow.map.width, height: sunLight.shadow.map.height }) : null,
    },
  });
  const sky = new THREE.Mesh(keepGeo(new THREE.SphereGeometry(18000, 32, 16)), keepMat(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color('#0749b3') },
      mid: { value: new THREE.Color('#1683e3') },
      horizon: { value: new THREE.Color('#d2f2ff') },
    },
    vertexShader: 'varying vec3 v; void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w*.99999;}',
    fragmentShader: `uniform vec3 top;uniform vec3 mid;uniform vec3 horizon;varying vec3 v;void main(){float h=normalize(v).y;vec3 c=mix(horizon,mid,smoothstep(-.055,.10,h));c=mix(c,top,smoothstep(.04,.52,h));gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  })));
  sky.renderOrder = -30;
  environment.add(sky);
  const sun = new THREE.Mesh(keepGeo(new THREE.SphereGeometry(65, 24, 16)), keepMat(new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, .91).multiplyScalar(3.5), toneMapped: false, fog: false })));
  sun.position.set(-1450, 2600, -4300);
  environment.add(sun);
  const sunGlowTexture = keepTex(canvasTexture(256, (ctx, s) => {
    const gradient = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * .49);
    gradient.addColorStop(0, 'rgba(255,249,235,.72)');
    gradient.addColorStop(.15, 'rgba(255,247,228,.32)');
    gradient.addColorStop(.4, 'rgba(255,244,224,.085)');
    gradient.addColorStop(1, 'rgba(255,244,224,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, s, s);
  }));
  sunGlowTexture.wrapS = sunGlowTexture.wrapT = THREE.ClampToEdgeWrapping;
  const sunGlow = new THREE.Sprite(keepMat(new THREE.SpriteMaterial({ map: sunGlowTexture, color: new THREE.Color(1, .98, .92).multiplyScalar(1.8), transparent: true, opacity: .4, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, toneMapped: false })));
  sunGlow.position.copy(sun.position); sunGlow.scale.set(560, 560, 1); environment.add(sunGlow);
  const cloudMaterials = cloudTextures.map(map => keepMat(new THREE.SpriteMaterial({ map, transparent: true, opacity: .95, depthWrite: false, fog: false })));
  for (let i = 0; i < 36; i++) {
    const cloud = new THREE.Sprite(cloudMaterials[i % cloudMaterials.length]);
    cloud.position.set((randomFor(i, 811) - .5) * 16000, 680 + randomFor(i, 919) * 840, (randomFor(i, 122) - .5) * 16000);
    const s = 600 + randomFor(i, 702) * 900;
    cloud.scale.set(s, s * (.52 + randomFor(i, 412) * .34), 1);
    cloud.userData.origin = cloud.position.x;
    cloud.userData.speed = .45 + randomFor(i, 832) * .8;
    environment.add(cloud); clouds.push(cloud);
  }
  stats.clouds = clouds.length;

  function landscapeHeightAt(x, z) {
    let ground = heightAt(x, z);
    for (const city of CITIES) {
      const half = cityHalf(city);
      const outside = Math.max(Math.abs(x - city.x) - half, Math.abs(z - city.z) - half);
      if (outside <= 0) ground = city.ground;
      else if (outside < 30) ground = mix(city.ground, ground, outside / 30);
    }
    for (const station of restStations) {
      const d = Math.hypot(x - station.position.x, z - station.position.z);
      if (d < 18) ground = station.position.y - .14;
      else if (d < 28) ground = mix(station.position.y - .14, ground, (d - 18) / 10);
    }
    for (const pad of housePadGrid.get(`${Math.floor(x / 128)},${Math.floor(z / 128)}`) || []) {
      const outside = Math.max(Math.abs(x - pad.x) - 29, Math.abs(z - pad.z) - 22);
      if (outside <= 0) ground = pad.y;
      else if (outside < 18) ground = mix(pad.y, ground, outside / 18);
    }
    return ground;
  }

  const roadNetwork = createRoadNetwork(landscapeHeightAt);

  function makeTerrain(cx, cz, size, segments, low = false) {
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const uv = geometry.attributes.uv;
    const color = new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i) + cx, z = positions.getZ(i) + cz;
      const y = low ? heightAt(x, z) : landscapeHeightAt(x, z);
      const river = riverShapeAt(x, z);
      let renderHeight = y - (low ? 2.5 : 0);
      // Coarse horizon vertices must conservatively remain below the water.
      // Their cell width exceeds the river width; a literal sparse sampler can
      // interpolate a grassy shelf across the bed even outside the near tiles.
      if (low && river.distance < river.width + size / segments * 1.5) renderHeight = Math.min(renderHeight, WATER_LEVEL - 3);
      positions.setXYZ(i, x, renderHeight, z);
      const bank = river.mask;
      const n = (Math.sin(x / 38) * Math.cos(z / 51) + 1) / 2;
      color.set(bank > .8 ? '#d0c78e' : '#94d857');
      color.lerp(new THREE.Color('#c4ed74'), n * .16);
      colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
      uv.setXY(i, x / 22, z / 22);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, low ? farGroundMat : groundMat);
    mesh.receiveShadow = !low;
    mesh.name = low ? 'distant-terrain' : 'streamed-terrain';
    return mesh;
  }
  // The horizon is real terrain across the entire playable 144 km², not a wall.
  const farTerrain = makeTerrain(0, 0, WORLD_SIZE, 180, true);
  keepGeo(farTerrain.geometry); root.add(farTerrain);
  const farIndex = farTerrain.geometry.index;
  const originalFarIndices = farIndex.array.slice();
  Object.defineProperty(stats, 'farMask', {
    enumerable: true,
    get: () => Object.freeze({
      minX: nearCoverage.x, maxX: nearCoverage.y, minZ: nearCoverage.z, maxZ: nearCoverage.w,
      materialCompiled: farMaskCompiled,
      retainedTriangles: farTerrain.geometry.drawRange.count / 3,
      totalTriangles: originalFarIndices.length / 3,
    }),
  });
  function coverFarTerrain(tx, tz) {
    nearCoverage.set(
      Math.max(-HALF, (tx - RADIUS) * TILE), Math.min(HALF, (tx + RADIUS + 1) * TILE),
      Math.max(-HALF, (tz - RADIUS) * TILE), Math.min(HALF, (tz + RADIUS + 1) * TILE),
    );
    const position = farTerrain.geometry.attributes.position;
    const inside = vertex => position.getX(vertex) >= nearCoverage.x && position.getX(vertex) <= nearCoverage.y
      && position.getZ(vertex) >= nearCoverage.z && position.getZ(vertex) <= nearCoverage.w;
    let count = 0;
    // Keep the same index allocation. Depth/SSAO override materials also see a
    // genuine hole underneath the near mesh, instead of a hidden coarse shelf.
    // Boundary triangles remain, so neighbouring LOD regions never leave gaps.
    for (let i = 0; i < originalFarIndices.length; i += 3) {
      const a = originalFarIndices[i], b = originalFarIndices[i + 1], c = originalFarIndices[i + 2];
      if (inside(a) && inside(b) && inside(c)) continue;
      farIndex.array[count++] = a; farIndex.array[count++] = b; farIndex.array[count++] = c;
    }
    farIndex.needsUpdate = true;
    farTerrain.geometry.setDrawRange(0, count);
  }

  const waterGeo = new THREE.BufferGeometry();
  const waterPositions = [], waterUvs = [], waterIndices = [];
  const waterSegments = 480;
  for (let i = 0; i <= waterSegments; i++) {
    const z = -HALF + i / waterSegments * WORLD_SIZE;
    const r = riverShapeAt(riverCenter(z), z);
    for (const side of [-1, 1]) {
      waterPositions.push(r.center + side * r.width * 1.14, WATER_LEVEL, z);
      waterUvs.push(side === -1 ? 0 : 1, z / 90);
    }
    if (i < waterSegments) {
      const a = i * 2; waterIndices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  waterGeo.setAttribute('position', new THREE.Float32BufferAttribute(waterPositions, 3));
  waterGeo.setAttribute('uv', new THREE.Float32BufferAttribute(waterUvs, 2));
  waterGeo.setIndex(waterIndices); waterGeo.computeVertexNormals(); keepGeo(waterGeo);
  const waterMat = keepMat(new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec2 uv0;varying vec3 p;uniform float time;void main(){uv0=uv;vec3 v=position;v.y+=sin(position.z*.052+time*.7)*.055;p=(modelMatrix*vec4(v,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(v,1.);}`,
    fragmentShader: `varying vec2 uv0;varying vec3 p;uniform float time;void main(){float wave=sin(p.x*.17+p.z*.045+time*.8)*sin(p.z*.16-p.x*.038-time*.47);vec3 N=normalize(vec3(.06*cos(p.x*.17+p.z*.045+time*.8),1.,.08*cos(p.z*.16-p.x*.038-time*.47)));vec3 V=normalize(cameraPosition-p);float fresnel=.035+.965*pow(1.-max(0.,dot(N,V)),4.);vec3 reflected=reflect(-V,N);float cloud=pow(max(0.,sin(reflected.x*15.+sin(reflected.z*9.)*2.)*sin(reflected.z*18.+reflected.x*3.)),3.);vec3 sky=mix(vec3(.10,.46,.82),vec3(.70,.89,.98),smoothstep(.8,.0,reflected.y));sky=mix(sky,vec3(.98,.99,1.),cloud*.6);vec3 L=normalize(vec3(-.47,.80,-.39));float spec=pow(max(0.,dot(N,normalize(L+V))),160.);float ribbons=.5+.5*sin(p.z*.085+sin(p.x*.2+time*.23)*2.-time*.5);vec3 c=mix(vec3(.025,.34,.43),vec3(.14,.63,.67),ribbons*.33);c=mix(c,sky,fresnel*.89);c+=vec3(1.,.98,.85)*spec*2.2;float glint=pow(max(0.,wave),27.);c+=vec3(.65,.87,.85)*glint*.2;float bank=smoothstep(0.,.07,uv0.x)*smoothstep(1.,.93,uv0.x);gl_FragColor=vec4(c,.91*bank);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  }));
  const water = new THREE.Mesh(waterGeo, waterMat); water.renderOrder = 1;
  water.name = 'river'; root.add(water);

  // Settlements are static, with actual footprint collision. Flora streams.
  const settlements = new THREE.Group(); settlements.name = 'settlements'; root.add(settlements);
  const fixed = batches(settlements, true);
  function footprint(x, z, w, d, y, height, id) {
    const item = { x, z, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY: y, maxY: y + height, y, height, id };
    colliders.push(item);
    for (let ix = Math.floor(item.minX / colliderGridSize); ix <= Math.floor(item.maxX / colliderGridSize); ix++) {
      for (let iz = Math.floor(item.minZ / colliderGridSize); iz <= Math.floor(item.maxZ / colliderGridSize); iz++) {
        const key = `${ix},${iz}`;
        if (!colliderGrid.has(key)) colliderGrid.set(key, []);
        colliderGrid.get(key).push(item);
      }
    }
  }
  function house(x, z, materialIndex, facing, plateau, index) {
    const w = 17, d = 20, h = 12.5;
    const wall = pastels[materialIndex % pastels.length];
    fixed.add(box, wall, x, plateau + h / 2, z, w, h, d);
    fixed.add(roof, roofMat, x, plateau + h, z, d + 2, 8, w + 1.9, 0, Math.PI / 2);
    const doorX = x + facing * (w / 2 + .1);
    fixed.add(box, whiteMat, doorX, plateau + 2.6, z, .28, 5.3, 3.2);
    fixed.add(box, glassMat, doorX + facing * .17, plateau + 3.6, z, .18, 2.5, 2.5);
    fixed.add(box, whiteMat, doorX, plateau + 14.1, z, .25, 2.25, 2.5);
    fixed.add(box, glassMat, doorX + facing * .17, plateau + 14.1, z, .16, 1.85, 2.1);
    for (const side of [-1, 1]) fixed.add(box, whiteMat, x + side * (w / 2 + .35), plateau + h, z, .45, .4, d + 1.4);
    for (const dz of [-6, 6]) for (const dy of [3.4, 9.2]) {
      fixed.add(box, whiteMat, doorX, plateau + dy, z + dz, .25, 3.3, 3.5);
      fixed.add(box, glassMat, doorX + facing * .18, plateau + dy, z + dz, .18, 2.7, 2.9);
      fixed.add(box, whiteMat, doorX + facing * .3, plateau + dy, z + dz, .14, 2.8, .16);
    }
    for (const faceZ of [-1, 1]) {
      for (const dx of [-4.2, 4.2]) {
        fixed.add(box, whiteMat, x + dx, plateau + 7.3, z + faceZ * 10.1, 3.5, 3.8, .25);
        fixed.add(box, glassMat, x + dx, plateau + 7.3, z + faceZ * 10.3, 2.9, 3.2, .15);
      }
    }
    // White picket fence, a separate little front lawn and walkway.
    const fenceX = x + facing * 15;
    for (const dz of [-16, 16]) {
      fixed.add(box, whiteMat, x, plateau + 1.15, z + dz, 30, .22, .25);
      fixed.add(box, whiteMat, x, plateau + 2, z + dz, 30, .22, .25);
      for (let p = -6; p <= 6; p++) fixed.add(box, whiteMat, x + p * 2.3, plateau + 1.25, z + dz, .3, 2.5, .4);
    }
    fixed.add(box, whiteMat, fenceX, plateau + .03, z, 18, .06, 2.8);
    footprint(x, z, w, d, plateau, h + 4, `house-${index}`);
    stats.buildings++;
  }
  VILLAGES.forEach((village, vi) => {
    const roadLength = village.rows * village.spacing + 95;
    fixed.add(box, roadMat, village.x, village.ground + .016, village.z, 23, .03, roadLength);
    for (const sign of [-1, 1]) {
      fixed.add(box, whiteMat, village.x + sign * 16, village.ground + .06, village.z, 6, .08, roadLength);
      fixed.add(box, whiteMat, village.x + sign * 11.4, village.ground + .065, village.z, .4, .06, roadLength);
    }
    for (let i = 0; i < village.rows; i++) {
      const z = village.z + (i - (village.rows - 1) / 2) * village.spacing;
      for (const side of [-1, 1]) house(village.x + side * village.width, z, i + vi * 3 + (side === 1 ? 2 : 0), -side, village.ground, `${vi}-${i}-${side}`);
      fixed.add(box, whiteMat, village.x, village.ground + .065, z, .24, .06, 6);
    }
  });
  const cityRecords = [];
  const cityCylinder = keepGeo(new THREE.CylinderGeometry(.5, .5, 1, 32));
  CITIES.forEach((city, ci) => {
    const buildings = [];
    fixed.add(box, tileMat, city.x, city.ground + .045, city.z, city.footprint, .08, city.footprint);
    for (let iz = 0; iz < city.n; iz++) for (let ix = 0; ix < city.n; ix++) {
      const x = city.x + (ix - (city.n - 1) / 2) * city.spacing;
      const z = city.z + (iz - (city.n - 1) / 2) * city.spacing;
      const r = randomFor(ix, iz, city.seed);
      const height = city.style === 'capital' ? 420 + r ** .7 * 980
        : city.style === 'terrace' ? 34 + r * 82 : city.style === 'lagoon' ? 72 + r * 207
          : city.style === 'horizon' ? 14 + r * 24
            : city.style === 'arcade' ? 7 + r * 6 : city.style === 'plaza' ? 24 + r * 38
              : city.style === 'office' ? 32 + r * 127 : city.style === 'spires' ? 75 + r ** 1.2 * 219
                : 38 + r ** 1.5 * 179 + (ix === 3 && iz === 3 ? 110 : 0);
      const w = city.style === 'capital' ? 62 + randomFor(ix, iz, city.seed + 2) * 44
        : city.style === 'horizon' ? 66 + randomFor(ix, iz, city.seed + 2) * 16
          : city.style === 'terrace' ? 46 + r * 16 : city.style === 'lagoon' ? 37 + r * 18
            : city.style === 'arcade' ? 46 : 23 + randomFor(ix, iz, city.seed + 2) * 19;
      const d = city.style === 'capital' ? 64 + randomFor(ix, iz, city.seed + 4) * 45
        : city.style === 'horizon' ? 27 + randomFor(ix, iz, city.seed + 4) * 9
          : city.style === 'terrace' ? 38 + r * 10 : city.style === 'lagoon' ? w
            : city.style === 'arcade' ? 34 : 23 + randomFor(ix, iz, city.seed + 4) * 19;
      const clearance = Math.hypot(w / 2 + 4, d / 2 + 4);
      if (city.clearing && Math.hypot(x - city.x, z - city.z) < city.clearing + clearance + 12) continue;
      // These are real open arterial corridors, rather than roads intersecting
      // the base of a tower. Wide pedestrian shoulders remain on both sides.
      if (routeDistanceTo(x, z) < clearance + 12) continue;
      const whiteFacade = ['office', 'plaza', 'arcade', 'terrace', 'horizon'].includes(city.style);
      const facadeMaterial = city.style === 'capital' ? capitalFacades[(ix + iz * 3) % capitalFacades.length] : whiteMat;
      const windowMaterial = city.style === 'capital' ? capitalWindows : towerMat;
      const trimMaterial = city.style === 'capital' ? capitalTrim : whiteMat;
      if (city.style === 'terrace' || city.style === 'capital') {
        const floors = city.style === 'capital' ? 4 : 3;
        for (let level = 0; level < floors; level++) {
          const tier = 1 - level * (city.style === 'capital' ? .13 : .19), sy = height / floors;
          fixed.add(box, facadeMaterial, x, city.ground + (level + .5) * sy, z, w * tier, sy, d * tier);
          for (const side of [-1, 1]) fixed.add(box, windowMaterial, x, city.ground + (level + .48) * sy, z + side * (d * tier / 2 + .1), w * tier * .72, sy * .68, .16);
          fixed.add(box, trimMaterial, x, city.ground + (level + 1) * sy, z, w * tier + 3, 1.1, d * tier + 3);
        }
      } else if (city.style === 'lagoon') {
        fixed.add(cityCylinder, towerMat, x, city.ground + height / 2, z, w, height, d);
        for (let level = 0; level < 6; level++) fixed.add(cityCylinder, whiteMat, x, city.ground + height * (level + .5) / 6, z, w + .8, .8, d + .8);
        fixed.add(cityCylinder, whiteMat, x, city.ground + height + .8, z, w + 1.2, 1.6, d + 1.2);
      } else {
        fixed.add(box, whiteFacade ? whiteMat : towerMat, x, city.ground + height / 2, z, w, height, d);
        if (whiteFacade) for (const side of [-1, 1]) {
          fixed.add(box, towerMat, x, city.ground + height * .5, z + side * (d / 2 + .075), w * .78, height * .79, .13);
          fixed.add(box, towerMat, x + side * (w / 2 + .075), city.ground + height * .5, z, .13, height * .79, d * .73);
        }
        fixed.add(box, whiteMat, x, city.ground + height + .8, z, w + .8, 1.6, d + .8);
        fixed.add(box, whiteMat, x + w * .31, city.ground + height / 2, z + d * .5 + .08, .7, height, .45);
        fixed.add(box, whiteMat, x - w * .31, city.ground + height / 2, z + d * .5 + .08, .7, height, .45);
      }
      fixed.add(box, city.style === 'capital' ? capitalPlinth : paleMat, x, city.ground + .4, z, w + 8, .8, d + 8);
      if (r > .7) fixed.add(cylinder, city.style === 'capital' ? capitalTrim : chrome, x, city.ground + height + 13, z, .65, 26, .65);
      if (city.style === 'arcade') {
        fixed.add(box, poolBorderMat, x, city.ground + 5.3, z + d / 2 + 4, w + 9, .48, 10);
        for (const side of [-1, 1]) fixed.add(cylinder, whiteMat, x + side * (w / 2 - 4), city.ground + 2.6, z + d / 2 + 7, .7, 5.2, .7);
      }
      footprint(x, z, w, d, city.ground, height + (r > .7 ? 26 : 1.6), `tower-${ci}-${ix}-${iz}`);
      buildings.push(Object.freeze({ x, z, width: w, depth: d, height, minY: city.ground, maxY: city.ground + height + (r > .7 ? 26 : 1.6) }));
      stats.buildings++;
    }
    let minimumGap = Infinity;
    for (let a = 0; a < buildings.length; a++) for (let b = a + 1; b < buildings.length; b++) {
      const p = buildings[a], q = buildings[b];
      const dx = Math.max(0, Math.abs(p.x - q.x) - (p.width + q.width) / 2 - 8);
      const dz = Math.max(0, Math.abs(p.z - q.z) - (p.depth + q.depth) / 2 - 8);
      minimumGap = Math.min(minimumGap, Math.hypot(dx, dz));
    }
    cityRecords.push({
      id: city.id, x: city.x, z: city.z, style: city.style, ground: city.ground,
      buildings: buildings.length, buildingRecords: Object.freeze(buildings), spacing: city.spacing,
      surfaceColor: '#e8edef', minimumGap, clearingRadius: city.clearing || 0,
      facadePalette: city.style === 'capital' ? Object.freeze(capitalFacades.map(material => '#' + material.color.getHexString())) : undefined,
      footprint: Object.freeze({ width: city.footprint, depth: city.footprint, minX: city.x - cityHalf(city), maxX: city.x + cityHalf(city), minZ: city.z - cityHalf(city), maxZ: city.z + cityHalf(city) }),
      heightRange: Object.freeze({ min: Math.min(...buildings.map(b => b.height)), max: Math.max(...buildings.map(b => b.maxY)) }),
    });
  });
  const highways = new THREE.Group(); highways.name = 'intercity-highways'; root.add(highways);
  const laneMat = standard({ color: '#b5dbe4', roughness: .65 });
  for (const road of roadNetwork.roads) {
    const geometry = keepGeo(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.BufferAttribute(road.positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(road.indices, 1));
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, highwayMat); mesh.receiveShadow = true; mesh.name = road.definition.id;
    highways.add(mesh);
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1], b = road.points[i];
      const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz), angle = Math.atan2(dx, dz);
      if (i % 2) fixed.add(box, laneMat, (a.x + b.x) / 2, (a.y + b.y) / 2 + .018, (a.z + b.z) / 2, .35, .025, length * .62, -Math.atan2(b.y - a.y, length), angle);
      if (i % 7 === 0 && b.y - b.terrain > 4) {
        const ground = landscapeHeightAt(b.x, b.z), height = b.y - ground - .7;
        if (height > .4) {
          fixed.add(cylinder, whiteMat, b.x, ground + height / 2, b.z, 2.6, height, 2.6);
          footprint(b.x, b.z, 2.6, 2.6, ground, height, `pier-${road.definition.id}-${i}`);
        }
      }
      if ((a.wet || b.wet || b.y - b.terrain > 6) && i % 2 === 0) {
        for (const side of [-1, 1]) {
          const nx = -dz / length * side * (road.definition.width / 2 - .25), nz = dx / length * side * (road.definition.width / 2 - .25);
          fixed.add(box, restGlassMat, (a.x + b.x) / 2 + nx, (a.y + b.y) / 2 + .75, (a.z + b.z) / 2 + nz, .14, 1.15, length * 1.02, -Math.atan2(b.y - a.y, length), angle);
        }
      }
    }
  }
  stats.roads = roadNetwork.records;
  stats.roadCount = roadNetwork.records.length;
  stats.roadLength = roadNetwork.records.reduce((sum, road) => sum + road.length, 0);
  // A bridge crosses the river close enough to discover on foot.
  const bridgeZ = -95;
  const bridgeX = riverCenter(bridgeZ);
  fixed.add(box, whiteMat, bridgeX, 8.7, bridgeZ, 143, .65, 10);
  for (const side of [-1, 1]) {
    fixed.add(box, paleMat, bridgeX, 10.5, bridgeZ + side * 5, 143, .28, .28);
    for (let i = -8; i <= 8; i++) fixed.add(box, whiteMat, bridgeX + i * 8, 9.55, bridgeZ + side * 5, .4, 1.8, .4);
  }
  const leafGeometry = keepGeo(new THREE.BufferGeometry());
  leafGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, .36, .18, .06, .95, .15, 0, .42, -.18, .04,
  ], 3));
  leafGeometry.setIndex([0, 1, 2, 0, 2, 3]); leafGeometry.computeVertexNormals();
  const heroLeafMaterial = standard({ color: '#487e30', roughness: .85, side: THREE.DoubleSide });
  for (const [fi, flower] of [{ x: -24, z: 174, h: 3.65 }, { x: 25, z: 167, h: 4.25 }, { x: -23, z: 159, h: 3.3 }].entries()) {
    const y = heightAt(flower.x, flower.z), head = y + flower.h;
    fixed.add(cylinder, leafMat, flower.x, y + flower.h / 2, flower.z, .085, flower.h, .085);
    for (let i = 0; i < 3; i++) {
      const side = i % 2 ? -1 : 1;
      fixed.add(leafGeometry, heroLeafMaterial, flower.x, y + flower.h * (.36 + i * .14), flower.z, side * .94, 1, 1, .18, side * .32, side * .28);
    }
    for (let i = 0; i < 22; i++) {
      const a = i / 22 * Math.PI * 2 + fi * .2;
      fixed.add(sphere, yellowMat, flower.x + Math.cos(a) * .51, head + Math.sin(a) * .51, flower.z + .08, .4, .125, .047, 0, 0, a);
    }
    fixed.add(cylinder, flowerCenterMat, flower.x, head, flower.z + .16, .81, .19, .81, Math.PI / 2);
    for (let i = 0; i < 46; i++) {
      const a = i * 2.39996, r = Math.sqrt(i / 46) * .36;
      fixed.add(sphere, roofMat, flower.x + Math.cos(a) * r, head + Math.sin(a) * r, flower.z + .27, .022, .025, .015);
    }
  }
  stats.heroFlowers = 3;

  const feature = (name, amount = 1) => { stats.scenery[name] = (stats.scenery[name] || 0) + amount; };
  function bench(x, z, y) {
    fixed.add(box, seatMat, x, y + .62, z, 2.9, .17, .74);
    fixed.add(box, seatMat, x, y + 1.1, z + .32, 2.9, .72, .12);
    for (const side of [-1, 1]) fixed.add(box, darkMetal, x + side * 1.1, y + .31, z, .14, .62, .62);
    feature('benches');
  }
  function pathLamp(x, z, y) {
    fixed.add(cylinder, darkMetal, x, y + 2.2, z, .11, 4.4, .11);
    fixed.add(box, lampMat, x, y + 4.35, z, .85, .19, .53);
    fixed.add(box, whiteMat, x, y + 4.48, z, 1.02, .08, .65);
    feature('pathLamps');
  }
  function busStop(x, z, y) {
    for (const sx of [-2.5, 2.5]) for (const sz of [-1.2, 1.2]) fixed.add(cylinder, chrome, x + sx, y + 2, z + sz, .12, 4, .12);
    fixed.add(box, restGlassMat, x, y + 2.1, z + 1.2, 5.1, 3.7, .1);
    fixed.add(box, restGlassMat, x, y + 4.05, z, 5.7, .13, 3.1);
    fixed.add(box, whiteMat, x, y + 4.12, z + 1.55, 5.8, .16, .16);
    bench(x, z + .58, y); feature('busStops');
  }
  for (const village of VILLAGES) {
    busStop(village.x + 24, village.z + village.rows * village.spacing / 2 + 26, village.ground);
    for (let i = -3; i <= 3; i++) {
      for (const side of [-1, 1]) pathLamp(village.x + side * 19.4, village.z + i * 85, village.ground);
    }
    for (const side of [-1, 1]) {
      fixed.add(box, pastels[2], village.x + side * 83, village.ground + .8, village.z, .3, 1.6, village.rows * village.spacing + 30);
      feature('longFences');
    }
  }
  // Glass wells are offset from the open centre used for restoring checkpoints.
  const restRing = keepGeo(new THREE.TorusGeometry(1, .045, 8, 40));
  const stationIds = ['avenue', 'city', 'river', 'hills', 'village', 'white-plaza', 'arcade', 'spires'];
  function safeLanding(point) {
    for (let radius = 0; radius <= 150; radius += 5) for (let j = 0; j < (radius ? 12 : 1); j++) {
      const angle = j * Math.PI / 6, x = point.x + 15 + Math.cos(angle) * radius, z = point.z + 32 + Math.sin(angle) * radius;
      if (!isBlocked(x, z, 4) && !isBlocked(x, z + 6, 1)) return { x, z };
    }
    return { x: point.x, z: point.z };
  }
  for (const [index, id] of stationIds.entries()) {
    const point = LANDMARKS.find(p => p.id === id);
    let gate = id === 'avenue' ? { x: 0, z: 166 } : safeLanding(point);
    if (['white-plaza', 'arcade', 'spires'].includes(id)) gate = safeLanding({ ...point, z: point.z + 60 });
    if (id === 'river') {
      const z = 32, river = riverShapeAt(riverCenter(z), z);
      gate = { x: river.center - river.width * 2.15, z };
    }
    let site = id === 'avenue' ? { x: -7, z: 169 } : { x: gate.x - 4, z: gate.z + 3 };
    if (isBlocked(site.x, site.z, 1.5)) {
      for (const [dx, dz] of [[4, 3], [-4, -3], [4, -3], [0, 5], [0, -5]]) {
        if (!isBlocked(gate.x + dx, gate.z + dz, 1.5)) { site = { x: gate.x + dx, z: gate.z + dz }; break; }
      }
    }
    const base = landscapeHeightAt(site.x, site.z), position = new THREE.Vector3(site.x, base + .14, site.z);
    restStations.push({ id, landmarkId: id, position, radius: 6, gatePosition: new THREE.Vector3(gate.x, groundAt(gate.x, gate.z), gate.z) });
    fixed.add(cylinder, index % 3 === 1 ? pinkTileMat : tileMat, site.x, position.y - .04, site.z, 13, .08, 13);
    const side = isBlocked(site.x + 3.7, site.z, 1) ? -1 : 1;
    const wellX = site.x + side * 3.7;
    fixed.add(cylinder, restGlassMat, wellX, position.y + .8, site.z, 1.8, 1.6, 1.8);
    fixed.add(cylinder, glassMat, wellX, position.y + .52, site.z, 1.55, .06, 1.55);
    fixed.add(restRing, chrome, wellX, position.y + 1.56, site.z, .92, .92, .92, Math.PI / 2);
    fixed.add(box, lampMat, site.x - side * 4.1, position.y + 1.2, site.z - 2, .34, 2.4, .34);
    bench(site.x, site.z + 3.7, position.y);
    pathLamp(site.x - 4.1, site.z - 3.9, position.y);
    if (index % 2) for (const s of [-1, 1]) {
      fixed.add(box, whiteMat, site.x + s * 5.4, position.y + 1.8, site.z - 4, .22, 3.6, .22);
      fixed.add(box, restGlassMat, site.x, position.y + 3.5, site.z - 4, 10.8, .12, 2);
    }
    for (let i = 0; i < 4; i++) addFlower(fixed, site.x + (i - 1.5) * 1.15, site.z - 6.6, 1.1 + index * .025);
    feature('glassWells');
  }
  stats.restStations = restStations.length;
  for (const station of restStations) station.gatePosition.y = groundAt(station.gatePosition.x, station.gatePosition.z);
  // Quiet public space: original geometry, no signs, ads, crowds or trees.
  const halfRing = keepGeo(new THREE.TorusGeometry(1, .019, 8, 96, Math.PI));
  const featureWater = [];
  function pool(x, z, y, width, depth, round = false) {
    const geometry = keepGeo(round ? new THREE.CircleGeometry(width / 2, 64) : new THREE.PlaneGeometry(width, depth, 8, 8));
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, waterMat); mesh.position.set(x, y + .21, z); mesh.renderOrder = 1; root.add(mesh); featureWater.push(mesh);
    if (!round) for (const s of [-1, 1]) {
      fixed.add(box, poolBorderMat, x, y + .26, z + s * (depth / 2 + .6), width + 2.4, .4, 1.2);
      fixed.add(box, poolBorderMat, x + s * (width / 2 + .6), y + .26, z, 1.2, .4, depth);
    }
    feature('reflectingPools');
  }
  pool(-3800, -410, 18, 48, 48, true);
  for (let i = 0; i < 6; i++) fixed.add(halfRing, whiteMat, -3800, 18.3 + i * .52, -410, 29 + i * 4.2, 29 + i * 4.2, 29 + i * 4.2, Math.PI / 2, 0, 0);
  feature('amphitheatres');
  for (const side of [-1, 1]) for (let i = 0; i < 12; i++) {
    fixed.add(cylinder, whiteMat, -3800 + side * 70, 22, -470 + i * 11, 1.1, 8, 1.1);
    fixed.add(box, poolBorderMat, -3800 + side * 70, 26.1, -410, 7, .4, 145);
  }
  feature('colonnades', 2);
  pool(0, 3647, 14, 68, 31);
  for (const side of [-1, 1]) {
    fixed.add(box, pinkTileMat, side * 39, 16.3, 3647, .5, 4.6, 42);
    for (let i = 0; i < 6; i++) fixed.add(box, whiteMat, side * 39, 18.8, 3627 + i * 8, .16, .9, .16);
  }
  feature('poolWalls', 2);
  // Empty swing frame and a gentle chrome slide on the open arcade square.
  for (const x of [69, 79]) for (const z of [3769, 3774]) fixed.add(cylinder, chrome, x, 16.7, z, .14, 5.4, .14, 0, 0, x === 69 ? -.13 : .13);
  fixed.add(box, chrome, 74, 19.2, 3771.5, 12, .16, .16);
  for (const x of [72, 76]) {
    for (const dx of [-.35, .35]) fixed.add(cylinder, darkMetal, x + dx, 17.3, 3771.5, .025, 3.5, .025);
    fixed.add(box, seatMat, x, 15.5, 3771.5, 1.1, .1, .45);
  }
  fixed.add(box, coral, 89, 16.1, 3776, 1.8, .18, 8, -.42);
  for (let i = 0; i < 8; i++) fixed.add(box, chrome, 89, 14.3 + i * .4, 3783 - i * .45, 1.5, .14, .55);
  feature('playgrounds');
  const courtMat = standard({ color: '#dceff1', roughness: .87 });
  fixed.add(box, courtMat, 0, 14.14, 3778, 58, .12, 27);
  for (const side of [-1, 1]) {
    fixed.add(box, whiteMat, 0, 14.21, 3778 + side * 11, 52, .015, .14);
    fixed.add(box, whiteMat, side * 26, 14.21, 3778, .14, .015, 22);
  }
  fixed.add(box, whiteMat, 0, 14.21, 3778, .14, .015, 22);
  fixed.add(box, restGlassMat, 0, 14.8, 3778, .045, 1.2, 24);
  feature('sportsCourts');
  // The dense district has pale elevated pedestrian links between glass towers.
  for (const dz of [-63, 63]) {
    fixed.add(box, whiteMat, 4100, 42, -1200 + dz, 155, .7, 5.3);
    for (const s of [-1, 1]) fixed.add(box, restGlassMat, 4100, 43.1, -1200 + dz + s * 2.5, 155, 1.5, .12);
    for (const x of [4032, 4168]) fixed.add(cylinder, whiteMat, x, 33.5, -1200 + dz, 1.4, 17, 1.4);
    feature('pedestrianBridges');
  }
  // Canal reeds/low steps and stepping stones remain sparse and grounded.
  for (let i = 0; i < 20; i++) {
    const z = -330 + i * 18, river = riverShapeAt(riverCenter(z), z), x = river.center - river.width * 1.65;
    const y = landscapeHeightAt(x, z);
    for (let j = 0; j < 4; j++) fixed.add(cylinder, leafMat, x + j * .23, y + .85, z + j * .19, .025, 1.7, .025, .06, 0, -.07);
    feature('reedClumps');
  }
  for (let i = 0; i < 7; i++) fixed.add(box, whiteMat, bridgeX - 78 - i * 1.5, 8.4 + i * .22, bridgeZ, 1.6, .3, 10);
  feature('canalSteps');
  for (let i = 0; i < 6; i++) fixed.add(sphere, paleMat, riverCenter(150) + (i - 2.5) * 11, 4.15, 150, 4.3, .32, 3.2);
  feature('steppingStones', 6);
  for (const city of CITIES) {
    for (const side of [-1, 1]) {
      for (let i = -2; i <= 2; i++) pathLamp(city.x + side * (city.n * city.spacing / 2 + 17), city.z + i * 54, city.ground);
      bench(city.x + side * 64, city.z + 54, city.ground);
    }
    busStop(city.x + 58, city.z + city.n * city.spacing / 2 + 24, city.ground);
    fixed.add(box, whiteMat, city.x - city.n * city.spacing / 2 - 24, city.ground + .6, city.z, .45, 1.2, city.n * city.spacing);
    feature('lowWalls');
  }
  stats.scenery = Object.freeze(stats.scenery);
  stats.colliders = colliders.length;
  stats.walkSurfaces = Object.freeze([
    Object.freeze({ id: 'bridge', minX: bridgeX - 71.5, maxX: bridgeX + 71.5, minZ: bridgeZ - 5, maxZ: bridgeZ + 5, y: 9.025 }),
    Object.freeze({ id: 'arcade-court', minX: -29, maxX: 29, minZ: 3764.5, maxZ: 3791.5, y: 14.2 }),
    ...restStations.map(station => Object.freeze({ id: station.id, x: station.position.x, z: station.position.z, radius: 6.5, y: station.position.y })),
  ]);

  const mysteries = new THREE.Group(); mysteries.name = 'landmarks'; root.add(mysteries);
  function landmarkMesh(geometry, material, x, z, altitude, scale) {
    const mesh = new THREE.Mesh(keepGeo(geometry), material);
    mesh.position.set(x, heightAt(x, z) + altitude, z);
    mesh.scale.setScalar(scale); mysteries.add(mesh);
    mesh.castShadow = !material.transmission;
    mesh.receiveShadow = true;
    return mesh;
  }
  const orb = landmarkMesh(new THREE.SphereGeometry(1, 56, 32), blueGlass, 260, -630, 105, 61);
  const bubbleMaterial = physical({ color: '#e7fbff', transmission: .97, thickness: .19, ior: 1.18, roughness: .014, clearcoat: 1, clearcoatRoughness: .015, iridescence: .12, iridescenceIOR: 1.26 });
  const bubbleGeometry = keepGeo(new THREE.SphereGeometry(1, 32, 20));
  for (const [i, p] of [{ x: 18, z: 164, y: 5.2, radius: 1.35 }, { x: -18, z: 151, y: 4.2, radius: 1.05 }, { x: 22, z: 135, y: 7.8, radius: 1.8 }].entries()) {
    const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
    bubble.position.set(p.x, heightAt(p.x, p.z) + p.y, p.z); bubble.scale.setScalar(p.radius);
    mysteries.add(bubble); animated.push({ mesh: bubble, base: bubble.position.y, phase: i * 1.7, amount: .16, speed: .27 });
  }
  stats.glassBubbles = 3;
  const ring = landmarkMesh(new THREE.TorusGeometry(1, .13, 20, 96), chrome, 1150, -1900, 190, 128);
  ring.rotation.y = -.38; ring.rotation.x = .22;
  animated.push({ mesh: orb, base: orb.position.y, phase: 0, amount: 2.2, speed: .18 });
  animated.push({ mesh: ring, base: ring.position.y, phase: .6, amount: 4.5, speed: .09 });
  const monolith = landmarkMesh(new THREE.BoxGeometry(1, 1, 1), paleMat, -2900, -3400, 175, 1);
  monolith.scale.set(95, 340, 32); monolith.rotation.z = .11;
  const arch = landmarkMesh(new THREE.TorusGeometry(1, .17, 16, 80, Math.PI), coral, -1250, 1100, 0, 99);
  arch.rotation.x = .08;
  const stairBatch = batches(mysteries);
  for (let i = 0; i < 34; i++) {
    const x = 2500 + i * 12, z = 2800;
    stairBatch.add(box, paleMat, x, heightAt(2500, 2800) + 28 + i * 3.5, z, 13, 2.7, 33);
  }
  stairBatch.finish();
  const jellyMaterial = physical({ color: '#d9f4ff', transmission: .73, thickness: 1.6, ior: 1.28, roughness: .065, clearcoat: 1, clearcoatRoughness: .03, side: THREE.DoubleSide });
  const ribbonMaterial = physical({ color: '#c3eafa', transmission: .35, thickness: .3, roughness: .17, metalness: .1, clearcoat: 1 });
  const jelly = new THREE.Group();
  jelly.position.set(210, heightAt(210, -95) + 32, -95);
  const dome = new THREE.Mesh(keepGeo(new THREE.SphereGeometry(1, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2)), jellyMaterial);
  dome.scale.set(13, 9, 13); jelly.add(dome);
  const hem = new THREE.Mesh(keepGeo(new THREE.TorusGeometry(12.5, .25, 8, 64)), ribbonMaterial);
  hem.rotation.x = Math.PI / 2; jelly.add(hem);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const points = [];
    for (let k = 0; k < 6; k++) points.push(new THREE.Vector3(Math.cos(a) * (7 - k * .55) + Math.sin(k * 1.35 + i) * 1.2, -k * 3.3, Math.sin(a) * (7 - k * .55) + Math.cos(k + i) * .9));
    const strand = new THREE.Mesh(keepGeo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 25, .17, 5, false)), ribbonMaterial);
    jelly.add(strand);
  }
  mysteries.add(jelly);
  animated.push({ mesh: jelly, base: jelly.position.y, phase: 1.2, amount: 1.6, speed: .13 });
  const walker = new THREE.Group(); walker.position.set(1420, heightAt(1420, 1050), 1050);
  const walkerMaterial = physical({ color: '#e3f6fc', clearcoat: 1, clearcoatRoughness: .055, roughness: .17, metalness: .15 });
  const body = new THREE.Mesh(keepGeo(new THREE.SphereGeometry(1, 36, 24)), walkerMaterial);
  body.position.y = 27; body.scale.set(20, 10, 13); body.castShadow = true; walker.add(body);
  for (const [x, z] of [[-12, -8], [12, -8], [-12, 8], [12, 8]]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x * .65, 23, z * .6),
      new THREE.Vector3(x * 1.35, 16, z * 1.35),
      new THREE.Vector3(x * 1.6, 7, z * 1.6),
      new THREE.Vector3(x * 1.7, .6, z * 1.7),
    ]);
    const leg = new THREE.Mesh(keepGeo(new THREE.TubeGeometry(curve, 20, 1.15, 10, false)), walkerMaterial);
    leg.castShadow = true; walker.add(leg);
  }
  mysteries.add(walker);
  animated.push({ mesh: walker, base: walker.position.y, phase: 2, amount: .25, speed: .11 });
  const landmarks = LANDMARKS.map(point => ({
    id: point.id,
    position: new THREE.Vector3(point.x, heightAt(point.x, point.z) + (point.altitude || 0), point.z),
  }));
  landmarks.push({ id: 'jellyfish', position: jelly.position.clone() }, { id: 'walker', position: walker.position.clone() });

  // Monumental objects in the empty meadows. All geometry is generated here;
  // the four placement families deliberately have different silhouettes.
  const artifactTorus = keepGeo(new THREE.TorusGeometry(1, .027, 12, 96));
  const artifactCylinder = keepGeo(new THREE.CylinderGeometry(.5, .5, 1, 48));
  const artifactArc = keepGeo(new THREE.TorusGeometry(1, .06, 12, 96, 2.54));
  const artifactCrystal = keepGeo(new THREE.IcosahedronGeometry(1, 0));
  const helixPoints = Array.from({ length: 121 }, (_, i) => {
    const t = i / 120, a = t * Math.PI * 8;
    return new THREE.Vector3(Math.cos(a) * 24, -70 + t * 140, Math.sin(a) * 24);
  });
  const artifactHelix = keepGeo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helixPoints), 240, 1.7, 10, false));
  const artifactDefinitions = [
    { id: 'm01', type: 'segmented-ellipsoid', placement: 'half-buried', x: -480, z: -550, altitude: 8, size: 160, portal: true },
    { id: 'm02', type: 'mirror-slab', placement: 'low-floating', x: 480, z: -520, altitude: 95, size: 156, portal: true },
    { id: 'm03', type: 'hollow-cuboid', placement: 'ground', x: -470, z: -160, altitude: 0, size: 124 },
    { id: 'm04', type: 'broken-arch', placement: 'ground', x: 580, z: -220, altitude: 0, size: 194 },
    { id: 'm05', type: 'glass-double-helix', placement: 'low-floating', x: 950, z: 700, altitude: 87, size: 164 },
    { id: 'm06', type: 'tilted-disk', placement: 'half-buried', x: 1800, z: -600, altitude: 3, size: 190 },
    { id: 'm07', type: 'orbital-halo', placement: 'high-sky', x: 50, z: -3400, altitude: 700, size: 530, portal: true },
    { id: 'm08', type: 'levitating-stairs', placement: 'low-floating', x: -2500, z: 900, altitude: 35, size: 220 },
    { id: 'm09', type: 'pearl-columns', placement: 'ground', x: -4300, z: -2100, altitude: 0, size: 216, portal: true },
    { id: 'm10', type: 'fragmented-icosahedron', placement: 'high-sky', x: 2500, z: -4900, altitude: 760, size: 310 },
    { id: 'm11', type: 'artifact-chain', placement: 'high-sky', x: -4200, z: 2200, altitude: 650, size: 470 },
    { id: 'm12', type: 'folded-structure', placement: 'ground', x: 3500, z: 3900, altitude: 40, size: 286, portal: true },
    { id: 'm13', type: 'sunken-lens', placement: 'half-buried', x: -850, z: 4100, altitude: -7, size: 226 },
    { id: 'm14', type: 'offset-rings', placement: 'low-floating', x: 4500, z: 800, altitude: 126, size: 242 },
    { id: 'm15', type: 'submerged-ribs', placement: 'half-buried', x: -4900, z: 4600, altitude: -31, size: 254, portal: true },
    { id: 'm16', type: 'celestial-lattice', placement: 'high-sky', x: 4600, z: 4500, altitude: 680, size: 420 },
  ];
  const meadowArtifacts = [];
  for (const definition of artifactDefinitions) {
    const group = new THREE.Group(); group.name = definition.id;
    const base = landscapeHeightAt(definition.x, definition.z);
    group.position.set(definition.x, base + definition.altitude, definition.z);
    mysteries.add(group);
    const solids = [];
    function part(geometry, material, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, blocks = false) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.rotation.set(rx, ry, rz);
      mesh.castShadow = !material.transmission; mesh.receiveShadow = true;
      group.add(mesh); if (blocks) solids.push(mesh);
      return mesh;
    }
    switch (definition.type) {
      case 'segmented-ellipsoid':
        for (let i = 0; i < 11; i++) {
          const t = (i - 5) / 5;
          part(bubbleGeometry, i % 3 ? whiteMat : paleMat, t * 65, 0, 0, 5.2, 52 * Math.sqrt(1 - t * t * .72), 31 * Math.sqrt(1 - t * t * .6), 0, 0, 0, true);
        }
        break;
      case 'mirror-slab':
        part(box, chrome, 0, 0, 0, 85, 148, 4.3, .08, -.38, .035);
        for (const side of [-1, 1]) part(box, whiteMat, side * 44, 0, 0, 1.3, 151, 6, .08, -.38, .035);
        part(artifactTorus, restGlassMat, 0, 0, -4, 46, 46, 46, 0, -.38);
        break;
      case 'hollow-cuboid':
        for (const x of [-56, 56]) for (const z of [-43, 43]) part(box, chrome, x, 55, z, 2.2, 110, 2.2, 0, 0, 0, true);
        for (const y of [2, 111]) for (const z of [-43, 43]) part(box, paleMat, 0, y, z, 114, 2.2, 2.2);
        for (const y of [2, 111]) for (const x of [-56, 56]) part(box, paleMat, x, y, 0, 2.2, 2.2, 88);
        for (const x of [-56, 56]) part(box, restGlassMat, x, 55, 0, .5, 106, 84);
        part(artifactTorus, blueGlass, 0, 55, 0, 32, 32, 32, .31, -.19);
        break;
      case 'broken-arch':
        part(artifactArc, whiteMat, 0, 5, 0, 92, 92, 92, 0, .22, -.18);
        part(artifactArc, chrome, -63, 43, 8, 34, 34, 34, .36, -.7, 2.1);
        part(box, whiteMat, 88, 6, 0, 11, 16, 12, 0, 0, 0, true);
        part(box, paleMat, -75, 18, 9, 18, 9, 24, .3, .1, -.24);
        break;
      case 'glass-double-helix':
        part(artifactHelix, blueGlass, 0, 0, 0, 1, 1, 1);
        part(artifactHelix, chrome, 0, 0, 0, .94, 1, .94, 0, Math.PI);
        for (let i = 0; i < 16; i++) {
          const a = i / 15 * Math.PI * 8;
          part(box, restGlassMat, 0, -68 + i / 15 * 136, 0, 46, .75, 1.2, 0, -a);
        }
        break;
      case 'tilted-disk':
        part(artifactCylinder, chrome, 0, 0, 0, 186, 8, 186, 0, .18, .78, true);
        part(artifactTorus, whiteMat, 0, 1, 0, 96, 96, 96, Math.PI / 2, 0, .78);
        for (const x of [-47, 0, 47]) part(artifactTorus, glassMat, x, 6, 0, 18, 18, 18, Math.PI / 2, 0, .78);
        break;
      case 'orbital-halo':
        for (let i = 0; i < 4; i++) part(artifactTorus, i % 2 ? paleMat : chrome, 0, (i - 1.5) * 27, 0, 265 - i * 40, 265 - i * 40, 265 - i * 40, .25 + i * .24, i * .34);
        part(bubbleGeometry, blueGlass, 0, 0, 0, 27, 27, 27);
        break;
      case 'levitating-stairs':
        for (let i = 0; i < 25; i++) part(box, i % 5 ? whiteMat : restGlassMat, (i - 12) * 8, i * 4.1, Math.sin(i / 6) * 22, 9.7, 2.2, 29, 0, Math.sin(i / 8) * .24);
        part(artifactTorus, chrome, -85, 6, 0, 16, 16, 16, 0, .3);
        break;
      case 'pearl-columns':
        for (let i = 0; i < 7; i++) {
          const x = (i - 3) * 25, h = 78 + Math.sin(i * .73 + .4) * 42 + i * 6;
          part(artifactCylinder, paleMat, x, h / 2, Math.sin(i) * 14, 16, h, 16, 0, 0, 0, true);
          part(bubbleGeometry, i % 2 ? blueGlass : chrome, x, h + 10, Math.sin(i) * 14, 15, 15, 15);
        }
        break;
      case 'fragmented-icosahedron':
        for (let i = 0; i < 12; i++) {
          const a = i * 2.39996, r = 54 + i * 4;
          part(artifactCrystal, i % 3 ? chrome : blueGlass, Math.cos(a) * r, Math.sin(a * .7) * 80, Math.sin(a) * r, 29 + i * 1.7, 32 + i, 24 + i * 1.2, i * .19, i * .43, i * .21);
        }
        break;
      case 'artifact-chain':
        for (let i = 0; i < 9; i++) {
          const x = (i - 4) * 48, y = (i - 4) ** 2 * 3.4;
          part(artifactTorus, i % 2 ? whiteMat : chrome, x, y, 0, 36, 36, 36, i % 2 ? Math.PI / 2 : 0, 0, .11 * (i - 4));
        }
        break;
      case 'folded-structure':
        for (let i = 0; i < 6; i++) {
          const angle = i % 2 ? -.61 : .61;
          part(box, i % 3 ? poolBorderMat : pinkTileMat, (i - 2.5) * 40, 0, 0, 59, 2.3, 174, 0, .12, angle, true);
          part(box, chrome, (i - 2.5) * 40, -16, 0, 2, 48, 112, 0, .12, 0, true);
        }
        break;
      case 'sunken-lens':
        part(bubbleGeometry, blueGlass, 0, 0, 0, 103, 43, 78, .16, .3, .12, true);
        part(artifactTorus, chrome, 0, 0, 0, 111, 111, 111, Math.PI / 2, .16, .13);
        for (const x of [-67, 67]) part(box, whiteMat, x, 2, 0, 8, 54, 111, .15, .3, 0, true);
        break;
      case 'offset-rings':
        for (let i = 0; i < 5; i++) part(artifactTorus, i % 2 ? blueGlass : chrome, (i - 2) * 18, Math.sin(i) * 17, (i - 2) * 9, 96 - i * 4, 96 - i * 4, 96 - i * 4, i * .17, -.2 + i * .27);
        part(box, paleMat, 0, 0, 0, 2.8, 166, 2.8, .12, 0, .1);
        break;
      case 'submerged-ribs':
        for (let i = 0; i < 9; i++) {
          const radius = 62 + Math.sin(i / 8 * Math.PI) * 43;
          part(artifactArc, i % 3 ? whiteMat : chrome, 0, 0, (i - 4) * 23, radius, radius, radius, 0, 0, -.12);
          part(box, paleMat, radius * .96, 16, (i - 4) * 23, 9, 67, 9, 0, 0, 0, true);
        }
        break;
      case 'celestial-lattice':
        for (let i = 0; i < 9; i++) part(artifactTorus, i % 3 ? chrome : restGlassMat, 0, 0, 0, 192, 192, 192, i * Math.PI / 9, i * Math.PI / 7, i * .13);
        part(bubbleGeometry, blueGlass, 0, 0, 0, 118, 118, 118);
        break;
    }
    group.updateWorldMatrix(true, true);
    const before = colliders.length;
    for (const mesh of solids) {
      const bounds = new THREE.Box3().setFromObject(mesh);
      const centre = bounds.getCenter(new THREE.Vector3()), extent = bounds.getSize(new THREE.Vector3());
      footprint(centre.x, centre.z, extent.x, extent.z, bounds.min.y, extent.y, definition.id);
    }
    const grounded = ['ground', 'half-buried'].includes(definition.placement);
    if (!grounded) animated.push({ mesh: group, base: group.position.y, phase: meadowArtifacts.length * .61, amount: definition.placement === 'high-sky' ? 1.9 : .85, speed: .027 });
    const artifactBounds = new THREE.Box3().setFromObject(group);
    const artifactExtent = artifactBounds.getSize(new THREE.Vector3());
    const record = Object.freeze({
      id: definition.id, type: definition.type, kind: definition.type,
      x: group.position.x, y: group.position.y, z: group.position.z,
      position: Object.freeze({ x: group.position.x, y: group.position.y, z: group.position.z }),
      baseY: base, placement: definition.placement, size: Math.max(artifactExtent.x, artifactExtent.y, artifactExtent.z), height: artifactExtent.y, scale: definition.size,
      bounds: Object.freeze({ minX: artifactBounds.min.x, maxX: artifactBounds.max.x, minY: artifactBounds.min.y, maxY: artifactBounds.max.y, minZ: artifactBounds.min.z, maxZ: artifactBounds.max.z }),
      grounded, floating: !grounded, meshCount: group.children.filter(child => child.isMesh).length,
      collisionFootprints: colliders.length - before, landmarkId: definition.portal ? definition.id : null,
    });
    meadowArtifacts.push(record);
    if (definition.portal) landmarks.push({ id: definition.id, position: group.position.clone() });
  }
  stats.meadowArtifacts = Object.freeze(meadowArtifacts);
  stats.meadowArtifactCount = meadowArtifacts.length;
  stats.meadowArtifactMeshes = meadowArtifacts.reduce((sum, item) => sum + item.meshCount, 0);
  stats.meadowPlacements = Object.freeze(Object.fromEntries(['ground', 'low-floating', 'half-buried', 'high-sky'].map(mode => [mode, meadowArtifacts.filter(item => item.placement === mode).length])));
  stats.anomalies += meadowArtifacts.length;

  // Small isolated homes have their own surveyed pads and retain the pastel
  // domestic detail of the original avenue. Their placement does not consume
  // a portal or interfere with earlier checkpoints and meadow monuments.
  const scatteredHouses = [];
  for (let candidate = 0; candidate < 8000 && scatteredHouses.length < 48; candidate++) {
    const x = (randomFor(candidate, 5107) - .5) * 11200;
    const z = (randomFor(candidate, 5109) - .5) * 11200;
    if (CITIES.some(city => Math.abs(x - city.x) < cityHalf(city) + 110 && Math.abs(z - city.z) < cityHalf(city) + 110)) continue;
    if (VILLAGES.some(village => Math.abs(x - village.x) < 145 && Math.abs(z - village.z) < village.rows * village.spacing / 2 + 100)) continue;
    const river = riverShapeAt(x, z);
    if (routeDistanceTo(x, z) < 65 || river.distance < river.width * 2.6 + 40) continue;
    if (restStations.some(station => Math.hypot(x - station.position.x, z - station.position.z) < 70)) continue;
    if (LANDMARKS.some(point => Math.hypot(x - point.x, z - point.z) < 260)) continue;
    if (meadowArtifacts.some(item => x > item.bounds.minX - 80 && x < item.bounds.maxX + 80 && z > item.bounds.minZ - 80 && z < item.bounds.maxZ + 80)) continue;
    if (scatteredHouses.some(item => Math.hypot(x - item.x, z - item.z) < 230) || isBlocked(x, z, 34)) continue;
    const y = landscapeHeightAt(x, z);
    const samples = [[-29, -22], [-29, 22], [29, -22], [29, 22]].map(([dx, dz]) => landscapeHeightAt(x + dx, z + dz));
    if (Math.max(...samples) - Math.min(...samples) > 7.5 || y < WATER_LEVEL + 1.5) continue;
    const pad = Object.freeze({ x, z, y });
    housePads.push(pad);
    for (let ix = Math.floor((x - 47) / 128); ix <= Math.floor((x + 47) / 128); ix++) {
      for (let iz = Math.floor((z - 40) / 128); iz <= Math.floor((z + 40) / 128); iz++) {
        const key = `${ix},${iz}`;
        if (!housePadGrid.has(key)) housePadGrid.set(key, []);
        housePadGrid.get(key).push(pad);
      }
    }
    const palette = Math.floor(randomFor(candidate, 5111) * pastels.length), facing = randomFor(candidate, 5113) > .5 ? 1 : -1;
    const id = `h${String(scatteredHouses.length + 1).padStart(2, '0')}`;
    house(x, z, palette, facing, y, `scattered-${id}`);
    fixed.add(box, tileMat, x, y + .018, z, 32, .035, 37);
    scatteredHouses.push(Object.freeze({ id, x, z, y, palette, facing, width: 17, depth: 20, height: 20.5, padWidth: 58, padDepth: 44 }));
  }
  stats.scatteredHouses = Object.freeze(scatteredHouses);
  stats.scatteredHouseCount = scatteredHouses.length;
  stats.housePads = Object.freeze(housePads);
  for (const record of cityRecords) {
    const city = CITIES.find(item => item.id === record.id), sites = [];
    const radius = Math.max(city.clearing ? city.clearing + 165 : 185, city.spacing * 1.65);
    for (let i = 0; i < 8; i++) {
      for (let attempt = 0; attempt < 90; attempt++) {
        const angle = i * Math.PI / 4 + (attempt % 9 - 4) * .055;
        const distance = radius + Math.floor(attempt / 9) * 17;
        const x = city.x + Math.cos(angle) * distance, z = city.z + Math.sin(angle) * distance;
        if (Math.abs(x - city.x) > cityHalf(city) - 60 || Math.abs(z - city.z) > cityHalf(city) - 60) continue;
        const ground = groundAt(x, z);
        if (isBlocked(x, z, 8, ground) || sites.some(site => Math.hypot(x - site.x, z - site.z) < 60)) continue;
        sites.push(Object.freeze({ x, z, ground, y: ground })); break;
      }
    }
    record.npcSites = Object.freeze(sites);
    Object.freeze(record);
  }
  stats.cityRecords = Object.freeze(cityRecords);
  // Append only here, after the original 14 landmarks, two decorative entities
  // and six meadow portals. Existing saved routes keep their exact order.
  for (const city of CITIES.slice(5)) {
    const x = city.id === 'capital' ? city.x + 476 : city.x;
    landmarks.push({ id: city.id, position: new THREE.Vector3(x, groundAt(x, city.z), city.z) });
  }
  fixed.finish();

  function occupied(x, z) {
    if (restStations.some(station => Math.hypot(x - station.position.x, z - station.position.z) < 28)) return true;
    for (const village of VILLAGES) {
      if (Math.abs(x - village.x) < 83 && Math.abs(z - village.z) < village.rows * village.spacing / 2 + 30) return true;
    }
    for (const city of CITIES) {
      if (Math.abs(x - city.x) < cityHalf(city) + 30 && Math.abs(z - city.z) < cityHalf(city) + 30) return true;
    }
    if (housePadGrid.get(`${Math.floor(x / 128)},${Math.floor(z / 128)}`)?.some(pad => Math.abs(x - pad.x) < 45 && Math.abs(z - pad.z) < 38)) return true;
    if (routeDistanceTo(x, z) < 2) return true;
    return riverShapeAt(x, z).mask > .45;
  }
  function spawnTile(tx, tz) {
    const cx = tx * TILE + TILE / 2, cz = tz * TILE + TILE / 2;
    const group = new THREE.Group(); group.name = `tile:${tx},${tz}`;
    const terrain = makeTerrain(cx, cz, TILE, 64);
    group.add(terrain);
    const batch = batches(group);
    const localColliders = [];
    let trees = 0, flowers = 0;
    const treeLayerEnabled = false;
    for (let i = 0; treeLayerEnabled && i < 27; i++) {
      const x = tx * TILE + randomFor(tx, tz, i * 13 + 1) * TILE;
      const z = tz * TILE + randomFor(tx, tz, i * 13 + 2) * TILE;
      if (occupied(x, z)) continue;
      const y = heightAt(x, z);
      const s = 4 + randomFor(tx, tz, i * 13 + 3) * 5;
      batch.add(cylinder, trunkMat, x, y + s * .42, z, s * .18, s * .9, s * .18);
      batch.add(foliage, leafMat, x, y + s * 1.12, z, s * .6, s * .72, s * .6);
      batch.add(foliage, leafLightMat, x - s * .3, y + s * 1.2, z + s * .15, s * .42, s * .45, s * .46);
      batch.add(cylinder, trunkMat, x - s * .13, y + s * .72, z, s * .06, s * .55, s * .06, 0, 0, -.55);
      localColliders.push({ x, z, radius: s * .13, minY: y, maxY: y + s * .9 }); trees++;
    }
    // Few blades nearby, wide uncluttered fields, and small sunflower patches.
    for (let i = 0; i < 240; i++) {
      const x = tx * TILE + randomFor(tx, tz, i * 7 + 713) * TILE;
      const z = tz * TILE + randomFor(tx, tz, i * 7 + 714) * TILE;
      if (occupied(x, z)) continue;
      const y = landscapeHeightAt(x, z), s = .6 + randomFor(tx, tz, i * 7 + 715) * .7;
      batch.add(cone, grassBladeMat, x, y + s / 2, z, .16, s, .12, 0, randomFor(tx, tz, i * 7 + 716) * Math.PI, .13);
    }
    for (let i = 0; i < 9; i++) {
      const x = tx * TILE + randomFor(tx, tz, i * 9 + 217) * TILE;
      const z = tz * TILE + randomFor(tx, tz, i * 9 + 218) * TILE;
      if (occupied(x, z)) continue;
      addFlower(batch, x, z, 2.4 + randomFor(tx, tz, i * 9 + 219)); flowers++;
    }
    if (tx === 0 && tz === 0) {
      for (let i = 0; i < 23; i++) {
        const x = 89 + randomFor(i, 232) * 46, z = 115 + randomFor(i, 243) * 62;
        addFlower(batch, x, z, 2.6 + randomFor(i, 222) * 1.4); flowers++;
      }
    }
    batch.finish();
    root.add(group);
    const key = `${tx},${tz}`;
    tileColliders.set(key, localColliders);
    tiles.set(key, { group, geometry: terrain.geometry, vertices: terrain.geometry.attributes.position.count, trees, flowers });
    stats.streamedTiles++;
    stats.streamedCreated++;
  }
  function addFlower(batch, x, z, h) {
    const y = landscapeHeightAt(x, z);
    batch.add(cylinder, leafMat, x, y + h / 2, z, .065, h, .065);
    batch.add(sphere, leafMat, x - .25, y + h * .52, z, .45, .16, .15, 0, 0, -.3);
    batch.add(sphere, leafMat, x + .25, y + h * .69, z, .43, .15, .17, 0, 0, .25);
    batch.add(cylinder, yellowMat, x, y + h, z, 1.12, .16, 1.12, Math.PI / 2);
    batch.add(cylinder, flowerCenterMat, x, y + h, z + .12, .6, .12, .6, Math.PI / 2);
    for (let petal = 0; petal < 9; petal++) {
      const a = petal / 9 * Math.PI * 2;
      batch.add(sphere, yellowMat, x + Math.cos(a) * .48, y + h + Math.sin(a) * .48, z + .03, .27, .18, .1, 0, 0, a);
    }
  }
  function releaseTile(key) {
    const tile = tiles.get(key);
    if (!tile) return;
    root.remove(tile.group);
    tile.geometry.dispose();
    tile.group.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
    tiles.delete(key); tileColliders.delete(key);
    stats.streamedDisposed++;
  }
  function stream(position) {
    const x = Math.max(-HALF, Math.min(HALF - .1, position.x));
    const z = Math.max(-HALF, Math.min(HALF - .1, position.z));
    const tx = Math.floor(x / TILE), tz = Math.floor(z / TILE);
    const key = `${tx},${tz}`;
    if (key === lastTile) return;
    lastTile = key;
    coverFarTerrain(tx, tz);
    const wanted = new Set();
    for (let dz = -RADIUS; dz <= RADIUS; dz++) for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      const nx = tx + dx, nz = tz + dz;
      if (nx * TILE >= HALF || (nx + 1) * TILE <= -HALF || nz * TILE >= HALF || (nz + 1) * TILE <= -HALF) continue;
      wanted.add(`${nx},${nz}`);
    }
    // Release first: even a long-distance teleport never doubles memory.
    for (const existing of tiles.keys()) if (!wanted.has(existing)) releaseTile(existing);
    for (const next of wanted) if (!tiles.has(next)) {
      const [nx, nz] = next.split(',').map(Number); spawnTile(nx, nz);
    }
    stats.activeChunks = tiles.size;
    stats.currentTile = key;
    stats.activeChunkKeys = Object.freeze([...tiles.keys()].sort());
    stats.terrainVertices = farTerrain.geometry.attributes.position.count;
    stats.trees = 0; stats.flowers = 0;
    for (const tile of tiles.values()) {
      stats.terrainVertices += tile.vertices;
      stats.trees += tile.trees; stats.flowers += tile.flowers;
    }
    stats.colliders = colliders.length + [...tileColliders.values()].reduce((n, list) => n + list.length, 0);
    stats.colliderSamples = Object.freeze([...colliders]
      .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))
      .slice(0, 6).map(({ id, minX, maxX, minY, maxY, minZ, maxZ }) => Object.freeze({ id, minX, maxX, minY, maxY, minZ, maxZ })));
  }
  function obstructRay(origin, direction, maxDistance) {
    let closest = maxDistance;
    function slab(minX, maxX, minY, maxY, minZ, maxZ) {
      let near = 0, far = closest;
      let a, b, swap;
      if (Math.abs(direction.x) < 1e-9) {
        if (origin.x < minX || origin.x > maxX) return;
      } else {
        a = (minX - origin.x) / direction.x; b = (maxX - origin.x) / direction.x;
        if (a > b) { swap = a; a = b; b = swap; }
        near = Math.max(near, a); far = Math.min(far, b);
        if (near > far) return;
      }
      if (Math.abs(direction.y) < 1e-9) {
        if (origin.y < minY || origin.y > maxY) return;
      } else {
        a = (minY - origin.y) / direction.y; b = (maxY - origin.y) / direction.y;
        if (a > b) { swap = a; a = b; b = swap; }
        near = Math.max(near, a); far = Math.min(far, b);
        if (near > far) return;
      }
      if (Math.abs(direction.z) < 1e-9) {
        if (origin.z < minZ || origin.z > maxZ) return;
      } else {
        a = (minZ - origin.z) / direction.z; b = (maxZ - origin.z) / direction.z;
        if (a > b) { swap = a; a = b; b = swap; }
        near = Math.max(near, a); far = Math.min(far, b);
        if (near > far) return;
      }
      closest = Math.min(closest, near);
    }
    const endX = origin.x + direction.x * maxDistance, endZ = origin.z + direction.z * maxDistance;
    const minCellX = Math.floor(Math.min(origin.x, endX) / colliderGridSize);
    const maxCellX = Math.floor(Math.max(origin.x, endX) / colliderGridSize);
    const minCellZ = Math.floor(Math.min(origin.z, endZ) / colliderGridSize);
    const maxCellZ = Math.floor(Math.max(origin.z, endZ) / colliderGridSize);
    const cells = (maxCellX - minCellX + 1) * (maxCellZ - minCellZ + 1);
    // The X/Z segment bounds conservatively include every intersecting box.
    // Infinite or unusually long rays retain the original bounded full scan.
    if (!Number.isFinite(cells) || maxDistance < 0 || cells > 4096) {
      for (const c of colliders) slab(c.minX, c.maxX, c.minY, c.maxY, c.minZ, c.maxZ);
    } else {
      const checked = new Set();
      for (let ix = minCellX; ix <= maxCellX; ix++) for (let iz = minCellZ; iz <= maxCellZ; iz++) {
        const candidates = colliderGrid.get(`${ix},${iz}`);
        if (!candidates) continue;
        for (const c of candidates) {
          if (checked.has(c)) continue;
          checked.add(c);
          slab(c.minX, c.maxX, c.minY, c.maxY, c.minZ, c.maxZ);
        }
      }
    }
    slab(bridgeX - 71.5, bridgeX + 71.5, 8.375, 9.025, bridgeZ - 5, bridgeZ + 5);
    for (const list of tileColliders.values()) for (const c of list) {
      slab(c.x - c.radius, c.x + c.radius, c.minY, c.maxY, c.z - c.radius, c.z + c.radius);
    }
    return closest;
  }
  function groundAt(x, z, referenceY) {
    let ground = landscapeHeightAt(x, z);
    for (const village of VILLAGES) {
      if (Math.abs(z - village.z) > (village.rows * village.spacing + 95) / 2) continue;
      const distance = Math.abs(x - village.x);
      if (distance <= 11.5) ground = Math.max(ground, village.ground + .031);
      else if (distance >= 13 && distance <= 19) ground = Math.max(ground, village.ground + .1);
    }
    for (const city of CITIES) {
      const half = cityHalf(city);
      if (Math.abs(x - city.x) <= half && Math.abs(z - city.z) <= half) ground = Math.max(ground, city.ground + .085);
    }
    for (const station of restStations) if (Math.hypot(x - station.position.x, z - station.position.z) <= 6.5) ground = Math.max(ground, station.position.y);
    ground = Math.max(ground, roadNetwork.groundAt(x, z, referenceY));
    for (const pad of housePadGrid.get(`${Math.floor(x / 128)},${Math.floor(z / 128)}`) || []) {
      if (Math.abs(x - pad.x) <= 16 && Math.abs(z - pad.z) <= 18.5) ground = Math.max(ground, pad.y + .0355);
    }
    if (Math.abs(x) <= 29 && Math.abs(z - 3778) <= 13.5) ground = Math.max(ground, 14.2);
    if (x >= 88.1 && x <= 89.9 && z >= 3772.35 && z <= 3779.65) ground = Math.max(ground, 16.199 + (z - 3776) * Math.tan(.42));
    for (let i = 0; i < 6; i++) {
      const dx = (x - (riverCenter(150) + (i - 2.5) * 11)) / 4.3, dz = (z - 150) / 3.2;
      const q = dx * dx + dz * dz;
      if (q <= 1) ground = Math.max(ground, 4.15 + .32 * Math.sqrt(1 - q));
    }
    if (Math.abs(x - bridgeX) <= 71.5 && Math.abs(z - bridgeZ) <= 5) return Math.max(ground, 9.025);
    return ground;
  }
  function isBlocked(x, z, radius = .4, footY) {
    if (x < -HALF + radius || x > HALF - radius || z < -HALF + radius || z > HALF - radius) return true;
    const checked = new Set();
    for (let ix = Math.floor((x - radius) / colliderGridSize); ix <= Math.floor((x + radius) / colliderGridSize); ix++) {
      for (let iz = Math.floor((z - radius) / colliderGridSize); iz <= Math.floor((z + radius) / colliderGridSize); iz++) {
        for (const item of colliderGrid.get(`${ix},${iz}`) || []) {
          if (checked.has(item)) continue;
          checked.add(item);
          if (Number.isFinite(footY) && (footY >= item.maxY + .02 || footY + 2.2 <= item.minY)) continue;
          if (x > item.minX - radius && x < item.maxX + radius && z > item.minZ - radius && z < item.maxZ + radius) return true;
        }
      }
    }
    const tx = Math.floor(x / TILE), tz = Math.floor(z / TILE);
    // Neighbour tiles matter when a tree trunk crosses a chunk boundary.
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      for (const item of tileColliders.get(`${tx + dx},${tz + dz}`) || []) {
        if (Math.hypot(x - item.x, z - item.z) < radius + item.radius) return true;
      }
    }
    return false;
  }
  stream(SPAWN);
  return {
    stats, landmarks, restStations,
    update(position, time, dt) {
      if (disposed) return;
      stream(position);
      if (shadowAnchor.distanceToSquared(position) > 16) {
        shadowAnchor.copy(position);
        sunLight.position.set(position.x - 170, position.y + 290, position.z - 140);
        sunLight.target.position.copy(position);
        sunLight.shadow.needsUpdate = true;
      }
      sky.position.copy(position);
      waterMat.uniforms.time.value = Number.isFinite(time) ? time : 0;
      for (const cloud of clouds) cloud.position.x = cloud.userData.origin + Math.sin(time / 240) * cloud.userData.speed * 160;
      for (const item of animated) item.mesh.position.y = item.base + Math.sin(time * item.speed + item.phase) * item.amount;
    },
    isBlocked, obstructRay, groundAt,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const key of [...tiles.keys()]) releaseTile(key);
      root.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
      for (const mesh of disposableBatches) mesh.dispose();
      disposableBatches.clear();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
      sunLight.shadow.dispose();
      if (scene.environment === reflection) scene.environment = previousEnvironment;
      scene.remove(root);
      stats.activeChunks = 0; stats.terrainVertices = 0;
    },
  };
}
