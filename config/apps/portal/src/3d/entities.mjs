import * as THREE from 'three';
import { riverCenter } from './terrain.mjs';

const PROJECTILE_CAP = 48;
const SAFE_RADIUS = 80;
const EYE = 2.2;
const colorList = [0x65dfff, 0x98f8dc, 0xefe8b1, 0xccceff, 0xacede5];
const roles = Object.freeze({
  orb: { hp: 3, height: 2.2, radius: .85, speed: 0, aggro: 0, range: 0, cooldown: 0, damage: 0 },
  drone: { hp: 4, height: 3.55, radius: 1.15, speed: 4.5, aggro: 95, range: 88, cooldown: 1.8, damage: .065 },
  stalker: { hp: 4, height: 1.45, radius: .8, speed: 6.4, aggro: 64, range: 3, cooldown: 1.4, damage: .12 },
  sentinel: { hp: 6, height: 2.2, radius: 1.2, speed: 0, aggro: 102, range: 92, cooldown: 2.45, damage: .095 },
  jelly: { hp: 5, height: 4.1, radius: 1.25, speed: 2.5, aggro: 90, range: 82, cooldown: 3.7, damage: .045 },
});
const kinds = Object.keys(roles);
const cityIds = ['city', 'north-city', 'white-plaza', 'arcade', 'spires'];
const npcKinds = ['pearl', 'cart', 'packet', 'tripod', 'capsule'];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function random(index, salt = 0) {
  let h = Math.imul(index + 1, 374761393) ^ Math.imul(salt + 7, 668265263);
  h = Math.imul(h ^ h >>> 13, 1274126177);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
}

export function createEntities(scene, landmarks, ground, blocked = () => false, cityRecords = []) {
  const root = new THREE.Group();
  root.name = 'inhabitants';
  scene.add(root);
  const geometry = new Set(), material = new Set();
  const ownGeometry = value => (geometry.add(value), value);
  const ownMaterial = value => (material.add(value), value);
  const shapes = {
    orb: ownGeometry(new THREE.IcosahedronGeometry(.73, 2)),
    shell: ownGeometry(new THREE.SphereGeometry(.94, 16, 10)),
    octahedron: ownGeometry(new THREE.OctahedronGeometry(.76, 0)),
    cube: ownGeometry(new THREE.BoxGeometry(1, 1, 1)),
    ring: ownGeometry(new THREE.TorusGeometry(1.08, .035, 6, 40)),
    rotor: ownGeometry(new THREE.TorusGeometry(.45, .025, 6, 24)),
    stem: ownGeometry(new THREE.CylinderGeometry(.055, .08, 1, 6)),
    plinth: ownGeometry(new THREE.CylinderGeometry(.46, .64, .8, 8)),
    eye: ownGeometry(new THREE.SphereGeometry(.25, 10, 8)),
    dome: ownGeometry(new THREE.SphereGeometry(1.25, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)),
    projectile: ownGeometry(new THREE.SphereGeometry(.16, 8, 6)),
    health: ownGeometry(new THREE.PlaneGeometry(1, 1)),
    capsule: ownGeometry(new THREE.CapsuleGeometry(.3, 1.1, 4, 12)),
  };
  const colors = colorList.map(color => ownMaterial(new THREE.MeshPhysicalMaterial({
    color, metalness: .1, roughness: .12, clearcoat: 1, emissive: color, emissiveIntensity: .055,
  })));
  const glass = ownMaterial(new THREE.MeshPhysicalMaterial({
    color: 0xe6fff7, metalness: .02, roughness: .035, transmission: .76, thickness: .24,
    ior: 1.33, transparent: true, opacity: .8, clearcoat: 1, envMapIntensity: 1.45,
  }));
  const shieldMaterial = ownMaterial(new THREE.MeshPhysicalMaterial({
    color: 0x9be9ff, roughness: .09, transmission: .5, thickness: .08, ior: 1.12,
    transparent: true, opacity: .36, clearcoat: 1, emissive: 0x4ec9dc, emissiveIntensity: .07,
  }));
  const lineMaterial = ownMaterial(new THREE.MeshBasicMaterial({ color: 0xf3ffff, transparent: true, opacity: .65 }));
  const darkMaterial = ownMaterial(new THREE.MeshPhysicalMaterial({ color: 0x5a8394, metalness: .28, roughness: .14, clearcoat: 1 }));
  const shotMaterials = [0xb6fdff, 0xffe6ba, 0xd2cfff].map(color => ownMaterial(new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: .9, depthWrite: false,
  })));
  const healthBack = ownMaterial(new THREE.MeshBasicMaterial({ color: 0x284855, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
  const healthFill = ownMaterial(new THREE.MeshBasicMaterial({ color: 0xb4ffe0, side: THREE.DoubleSide, depthWrite: false }));
  const healthWarn = ownMaterial(new THREE.MeshBasicMaterial({ color: 0xffc5ad, side: THREE.DoubleSide, depthWrite: false }));
  const shieldFill = ownMaterial(new THREE.MeshBasicMaterial({ color: 0xb5e9ff, side: THREE.DoubleSide, depthWrite: false }));
  const pearlMaterial = ownMaterial(new THREE.MeshPhysicalMaterial({ color: 0xf3fbf7, metalness: .13, roughness: .2, clearcoat: 1 }));
  const chromeMaterial = ownMaterial(new THREE.MeshPhysicalMaterial({ color: 0xe6f6fc, metalness: .58, roughness: .13, clearcoat: 1 }));

  function mesh(group, shape, surface, position = [0, 0, 0], scale = [1, 1, 1]) {
    const item = new THREE.Mesh(shape, surface);
    item.position.set(...position);
    item.scale.set(...scale);
    item.castShadow = surface !== glass && surface !== lineMaterial && surface !== shieldMaterial;
    item.receiveShadow = true;
    group.add(item);
    return item;
  }
  const points = [
    { x: 0, z: 155, kind: 'orb' }, { x: 8, z: 134, kind: 'drone' },
    { x: -10, z: 115, kind: 'stalker' }, { x: 18, z: 88, kind: 'jelly' },
    ...[
      [0, 30, 'drone'], [-16, -20, 'stalker'], [15, -68, 'sentinel'], [0, -115, 'jelly'],
      [-13, -158, 'orb'], [18, -205, 'drone'], [0, -242, 'stalker'], [-16, -281, 'jelly'],
      [17, -320, 'sentinel'], [4, -362, 'orb'], [-10, -401, 'drone'], [15, -445, 'stalker'],
      [-7, -490, 'jelly'], [145, -105, 'sentinel'], [-148, -125, 'stalker'],
    ].map(([x, z, kind]) => ({ x, z, kind })),
    ...Array.from({ length: 12 }, (_, index) => {
      const z = -240 + index * 80;
      return { x: riverCenter(z) + (index % 2 ? 1 : -1) * (76 + random(index, 14) * 20), z,
        kind: kinds[1 + index % 4] };
    }),
    ...(landmarks || []).slice(0, 15).flatMap((place, index) => [
      { x: place.position.x + 18, z: place.position.z + 38, kind: 'orb' },
      { x: place.position.x - 24, z: place.position.z + 55, kind: 'drone' },
      { x: place.position.x + 70, z: place.position.z - 35, kind: 'sentinel' },
      { x: place.position.x - 65, z: place.position.z - 65, kind: index % 2 ? 'stalker' : 'jelly' },
    ]),
  ];
  while (points.length < 80) {
    const id = points.length;
    points.push({ x: (random(id, 30) - .5) * 8400, z: (random(id, 31) - .5) * 8400, kind: kinds[id % kinds.length] });
  }
  const used = [];
  function landing(point, radius) {
    const clear = (x, z) => !blocked(x, z, radius) && !used.some(p => Math.hypot(x - p.x, z - p.z) < 3.5);
    if (clear(point.x, point.z)) return { x: point.x, z: point.z };
    for (let distance = 4; distance <= 112; distance += 4) for (let angle = 0; angle < 16; angle++) {
      const x = point.x + Math.cos(angle * Math.PI / 8) * distance;
      const z = point.z + Math.sin(angle * Math.PI / 8) * distance;
      if (clear(x, z)) return { x, z };
    }
    return { x: point.x, z: point.z };
  }

  function build(point, id) {
    const role = roles[point.kind], position = landing(point, role.radius);
    used.push(position);
    const group = new THREE.Group(), movement = new THREE.Group();
    const surface = colors[kinds.indexOf(point.kind)], targets = [];
    let core, shell, shield = null;
    const ring = mesh(group, shapes.ring, lineMaterial);
    ring.rotation.x = Math.PI / 2;
    group.add(movement);
    if (point.kind === 'orb') {
      core = mesh(movement, shapes.orb, surface);
      shell = mesh(movement, shapes.shell, glass);
    } else if (point.kind === 'drone') {
      core = mesh(movement, shapes.octahedron, surface, [0, 0, 0], [1, .7, 1]);
      shell = mesh(movement, shapes.shell, glass, [0, 0, 0], [1.1, .55, 1.05]);
      targets.push(mesh(movement, shapes.cube, surface, [0, -.08, 0], [3, .13, .55]));
      mesh(movement, shapes.eye, darkMaterial, [0, .02, -.7]);
      for (const side of [-1, 1]) {
        const rotor = mesh(movement, shapes.rotor, lineMaterial, [side * 1.24, .12, 0]);
        rotor.rotation.x = Math.PI / 2;
      }
    } else if (point.kind === 'stalker') {
      core = mesh(movement, shapes.octahedron, surface, [0, .1, 0], [.75, 1, .72]);
      shell = mesh(movement, shapes.shell, glass, [0, 0, 0], [.65, 1.1, .62]);
      targets.push(mesh(movement, shapes.cube, darkMaterial, [0, -.3, 0], [.5, .9, .48]));
      for (let leg = 0; leg < 4; leg++) {
        const sx = leg % 2 ? 1 : -1, sz = leg < 2 ? 1 : -1;
        const limb = mesh(movement, shapes.stem, surface, [sx * .6, -.86, sz * .45], [1, 1.28, 1]);
        limb.rotation.z = -sx * .28;
        mesh(movement, shapes.eye, darkMaterial, [sx * .78, -1.38, sz * .45], [.65, .35, .65]);
      }
      ring.scale.setScalar(.8);
    } else if (point.kind === 'sentinel') {
      core = mesh(movement, shapes.octahedron, surface, [0, .18, 0], [.75, 1.2, .75]);
      shell = mesh(movement, shapes.shell, glass, [0, 0, 0], [.76, 1.08, .76]);
      targets.push(mesh(movement, shapes.plinth, darkMaterial, [0, -1.12, 0]));
      shield = mesh(group, shapes.shell, shieldMaterial, [0, .05, 0], [1.36, 1.5, 1.36]);
      shield.userData.part = 'shield';
      const guard = mesh(group, shapes.ring, lineMaterial, [0, .05, 0], [1.22, 1.22, 1.22]);
      guard.rotation.y = Math.PI / 2;
    } else {
      core = mesh(movement, shapes.eye, surface, [0, .14, 0], [1.8, 1.8, 1.8]);
      shell = mesh(movement, shapes.dome, glass);
      for (let leg = 0; leg < 6; leg++) {
        const angle = leg * Math.PI / 3;
        const limb = mesh(movement, shapes.stem, surface, [Math.cos(angle) * .7, -.87, Math.sin(angle) * .7], [.48, 1.75, .48]);
        limb.rotation.z = Math.cos(angle) * .16;
      }
      ring.scale.setScalar(1.1);
    }
    targets.push(core, shell);
    if (shield) targets.push(shield);
    const health = new THREE.Group();
    health.position.y = point.kind === 'jelly' ? 1.75 : 1.8;
    health.visible = false;
    const background = mesh(health, shapes.health, healthBack, [0, 0, 0], [1.8, .18, 1]);
    const fill = mesh(health, shapes.health, healthFill, [0, 0, .006], [1.7, .09, 1]);
    const armorFill = mesh(health, shapes.health, shieldFill, [0, -.14, .006], [1.7, .035, 1]);
    for (const bar of [background, fill, armorFill]) { bar.castShadow = false; bar.receiveShadow = false; }
    group.add(health);
    const entity = {
      id, kind: point.kind, species: point.kind, role, group, movement, core, shell, ring, shield, targets,
      health, fill, armorFill, maxHp: id < 4 ? 3 : role.hp, hp: id < 4 ? 3 : role.hp,
      shieldHp: point.kind === 'sentinel' ? 2 : 0, maxShield: point.kind === 'sentinel' ? 2 : 0,
      x: position.x, z: position.z, homeX: position.x, homeZ: position.z,
      height: id === 1 ? 2.2 : role.height, state: 'idle', behavior: 'idle', age: 0,
      hostile: 0, showHealth: 0, shotWait: .7 + random(id, 5), attackTimer: 0, attackStarted: false,
      proactive: id >= 4 && point.kind !== 'orb' && Math.hypot(position.x, position.z - 180) > 115,
      attacks: 0, damageEvents: 0, damageTotal: 0, hits: 0,
    };
    for (const target of targets) target.userData.entity = entity;
    group.position.set(entity.x, ground(entity.x, entity.z) + entity.height, entity.z);
    root.add(group);
    return entity;
  }
  const entities = points.map(build);
  function buildNpc(city, cityIndex, index) {
    const id = 1000 + cityIndex * 8 + index, kind = npcKinds[(index + cityIndex * 3) % npcKinds.length];
    const offsets = [[0, 18], [-4, 52], [0, -36], [-62, 0], [66, 0], [0, 108], [108, -70], [-90, 72]];
    const [dx, dz] = offsets[index];
    const radius = kind === 'cart' ? 1 : kind === 'packet' ? .8 : .5;
    const site = city.npcSites?.[index];
    const position = landing(site ? {x:site.x,z:site.z} : { x: city.position.x + dx, z: city.position.z + dz }, radius);
    used.push(position);
    const group = new THREE.Group(), movement = new THREE.Group(), targets = [], limbs = [];
    group.add(movement);
    let core, height;
    const part = (shape, surface, at = [0, 0, 0], scale = [1, 1, 1]) => {
      const item = mesh(movement, shape, surface, at, scale);
      targets.push(item);
      return item;
    };
    if (kind === 'pearl') {
      height = 1.15;
      core = part(shapes.capsule, pearlMaterial, [0, -.05, 0], [.85, .62, .75]);
      part(shapes.eye, pearlMaterial, [0, .76, 0], [1.25, 1.3, 1.25]);
      for (const side of [-1, 1]) {
        const leg = part(shapes.stem, chromeMaterial, [side * .17, -.81, 0], [1.2, .6, 1.2]);
        const arm = part(shapes.stem, pearlMaterial, [side * .36, -.18, 0], [1.15, .56, 1.15]);
        limbs.push({ item: leg, phase: side, amount: .26 }, { item: arm, phase: -side, amount: .18 });
      }
    } else if (kind === 'cart') {
      height = .71;
      core = part(shapes.cube, pearlMaterial, [0, 0, 0], [1.75, .44, 1.1]);
      part(shapes.shell, glass, [0, .35, 0], [1.03, .5, .64]);
      part(shapes.cube, colors[1], [0, -.26, 0], [1.45, .1, .94]);
      for (const side of [-1, 1]) for (const front of [-1, 1]) {
        const wheel = part(shapes.rotor, chromeMaterial, [side * .86, -.36, front * .38], [.67, .67, .67]);
        wheel.rotation.y = Math.PI / 2;
        limbs.push({ item: wheel, wheel: true });
      }
    } else if (kind === 'packet') {
      height = 2.35;
      core = part(shapes.octahedron, colors[0], [0, 0, 0], [1.4, .48, .75]);
      part(shapes.shell, glass, [0, 0, 0], [1.28, .48, .77]);
      part(shapes.octahedron, chromeMaterial, [-1.18, 0, 0], [.32, .35, .69]);
      part(shapes.octahedron, colors[1], [.3, 0, .62], [.5, .16, .42]);
      part(shapes.octahedron, colors[1], [.3, 0, -.62], [.5, .16, .42]);
    } else if (kind === 'tripod') {
      height = 1.05;
      core = part(shapes.cube, chromeMaterial, [0, .05, 0], [.46, .55, .46]);
      part(shapes.shell, glass, [0, .03, 0], [.48, .56, .48]);
      part(shapes.stem, chromeMaterial, [0, .51, 0], [.8, .4, .8]);
      for (let leg = 0; leg < 3; leg++) {
        const angle = leg * Math.PI * 2 / 3;
        const joint = part(shapes.stem, colors[3], [Math.cos(angle) * .24, -.22, Math.sin(angle) * .24], [.95, .6, .95]);
        joint.rotation.z = Math.cos(angle) * -.4;
        joint.rotation.x = Math.sin(angle) * .4;
        const limb = part(shapes.stem, chromeMaterial, [Math.cos(angle) * .51, -.69, Math.sin(angle) * .51], [.7, .69, .7]);
        limbs.push({ item: limb, phase: Math.cos(angle), amount: .16 });
      }
    } else {
      height = 1.88;
      core = part(shapes.capsule, pearlMaterial, [0, 0, 0], [.68, 1.8, .68]);
      part(shapes.shell, glass, [0, .55, 0], [.39, .67, .39]);
      for (const y of [-1.2, 1.2]) {
        const belt = part(shapes.rotor, chromeMaterial, [0, y, 0], [.61, .61, .61]);
        belt.rotation.x = Math.PI / 2;
      }
    }
    const health = new THREE.Group();
    health.position.y = kind === 'capsule' ? 1.9 : kind === 'pearl' ? 1.23 : 1.12;
    health.visible = false;
    mesh(health, shapes.health, healthBack, [0, 0, 0], [1.4, .15, 1]);
    const fill = mesh(health, shapes.health, healthFill, [0, 0, .006], [1.3, .075, 1]);
    health.children.forEach(item => { item.castShadow = false; item.receiveShadow = false; });
    group.add(health);
    const maxHp = 2 + index % 3;
    const npc = {
      id, npc: true, city: city.id, kind, group, movement, core, targets, limbs, health, fill,
      x: position.x, z: position.z, homeX: position.x, homeZ: position.z, height, hp: maxHp, maxHp,
      role: { radius, speed: 1.5 + random(id, 51) * 2.5 },
      state: 'idle', age: 0, showHealth: 0, hits: 0, proactive: false, hostile: 0,
      attacks: 0, damageEvents: 0, damageTotal: 0, walked: 0, speed: 0,
      heading: random(id, 52) * Math.PI * 2, turnWait: 2 + random(id, 53) * 4, turnIndex: 0,
    };
    targets.forEach(item => { item.userData.entity = npc; });
    group.position.set(npc.x, ground(npc.x, npc.z) + height, npc.z);
    root.add(group);
    return npc;
  }
  const legacyCities = (landmarks || []).filter(place => cityIds.includes(place.id)).slice(0, 5);
  const addedCities = cityRecords.filter(record => !cityIds.includes(record.id))
    .map(record => ({id:record.id,position:{x:record.x,z:record.z},npcSites:record.npcSites}));
  const npcs = [...legacyCities, ...addedCities]
    .flatMap((city, cityIndex) => Array.from({ length: 8 }, (_, index) => buildNpc(city, cityIndex, index)));
  const inhabitants = [...entities, ...npcs];
  const speciesCounts = Object.freeze(Object.fromEntries(kinds.map(kind => [kind, entities.filter(entity => entity.kind === kind).length])));
  const npcKindCounts = Object.freeze(Object.fromEntries(npcKinds.map(kind => [kind, npcs.filter(npc => npc.kind === kind).length])));
  const seeds = Array.from({ length: PROJECTILE_CAP }, () => {
    const item = new THREE.Mesh(shapes.projectile, shotMaterials[0]);
    item.visible = false;
    root.add(item);
    return { mesh: item, velocity: new THREE.Vector3(), life: 0, owner: null, damage: 0 };
  });
  let kills = 0, collected = 0, shotsAtPlayer = 0, projectileImpacts = 0, meleeAttacks = 0;
  let damageEvents = 0, damageTotal = 0, blockedShots = 0, droppedShots = 0, projectilePeak = 0, disposed = false;
  let npcKills = 0, npcCollected = 0;
  const aim = new THREE.Vector3(), lineDirection = new THREE.Vector3(), scan = new THREE.Vector3();
  const playerCenter = new THREE.Vector3(), previous = new THREE.Vector3(), travel = new THREE.Vector3(), difference = new THREE.Vector3();
  const up = new THREE.Vector3(0, 0, 1), normalScale = new THREE.Vector3(1, 1, 1), dropScale = new THREE.Vector3(.42, .42, .42);

  function hit(item, time = 0) {
    if (disposed) return false;
    const entity = item?.userData?.entity;
    if (!entity || entity.state === 'seed' || entity.state === 'sleep') return false;
    entity.hits++;
    entity.showHealth = 8;
    if (entity.npc) {
      entity.hp = Math.max(0, entity.hp - 1);
      entity.group.scale.setScalar(.88);
      if (entity.hp === 0) {
        entity.state = 'seed'; entity.group.scale.setScalar(.42); entity.health.visible = false;
        entity.age = time; npcKills++;
      }
      return true;
    }
    entity.hostile = 12;
    entity.behavior = entity.kind === 'orb' ? 'defensive' : 'engaged';
    if (entity.shieldHp > 0) {
      entity.shieldHp--;
      if (entity.shieldHp === 0 && entity.shield) entity.shield.visible = false;
    } else entity.hp = Math.max(0, entity.hp - 1);
    entity.group.scale.setScalar(.84);
    entity.ring.scale.multiplyScalar(1.24);
    if (entity.hp === 0) {
      entity.state = 'seed'; entity.behavior = 'dropped'; entity.group.scale.setScalar(.42);
      entity.hostile = 0; entity.health.visible = false; entity.age = time; kills++;
    }
    return true;
  }

  function clearLine(start, finish, obstruction) {
    lineDirection.copy(finish).sub(start);
    const distance = lineDirection.length();
    if (distance < .001) return true;
    lineDirection.multiplyScalar(1 / distance);
    if (obstruction && obstruction(start, lineDirection, distance) < distance - .12) return false;
    for (let position = 1; position < distance; position += 1.3) {
      scan.copy(start).addScaledVector(lineDirection, position);
      if (scan.y <= ground(scan.x, scan.z) + .08) return false;
    }
    return true;
  }

  function move(entity, dx, dz, dt) {
    const distance = Math.hypot(dx, dz);
    if (!distance || !dt) return;
    const steps = Math.min(8, Math.max(1, Math.ceil(distance / .3)));
    const stepX = dx / steps, stepZ = dz / steps;
    let floor = ground(entity.x, entity.z);
    for (let i = 0; i < steps; i++) {
      const nextX = entity.x + stepX;
      if (!blocked(nextX, entity.z, entity.role.radius)) {
        const candidate = ground(nextX, entity.z);
        if (Math.abs(candidate - floor) < 1.45) { entity.x = nextX; floor = candidate; }
      }
      const nextZ = entity.z + stepZ;
      if (!blocked(entity.x, nextZ, entity.role.radius)) {
        const candidate = ground(entity.x, nextZ);
        if (Math.abs(candidate - floor) < 1.45) { entity.z = nextZ; floor = candidate; }
      }
    }
    return floor;
  }

  function fire(entity, player, spread = 0) {
    const seed = seeds.find(projectile => projectile.life <= 0);
    if (!seed) { droppedShots++; return false; }
    seed.owner = entity; seed.damage = entity.role.damage; seed.life = entity.kind === 'sentinel' ? 5 : 4.5;
    seed.mesh.position.copy(entity.group.position);
    aim.set(player.x, player.y + 1.25, player.z).sub(seed.mesh.position).normalize();
    if (spread) aim.applyAxisAngle(THREE.Object3D.DEFAULT_UP, spread);
    seed.mesh.position.addScaledVector(aim, entity.role.radius + .2);
    seed.velocity.copy(aim).multiplyScalar(entity.kind === 'sentinel' ? 21 : entity.kind === 'jelly' ? 18 : 24);
    seed.mesh.material = shotMaterials[entity.kind === 'sentinel' ? 1 : entity.kind === 'jelly' ? 2 : 0];
    seed.mesh.scale.set(.9, .9, entity.kind === 'jelly' ? 1.65 : 2.1);
    seed.mesh.quaternion.setFromUnitVectors(up, aim); seed.mesh.visible = true;
    entity.attacks++; shotsAtPlayer++;
    projectilePeak = Math.max(projectilePeak, seeds.filter(projectile => projectile.life > 0).length);
    return true;
  }

  function hurt(entity, value, onDamage) {
    entity.damageEvents++; entity.damageTotal += value; damageEvents++; damageTotal += value;
    onDamage?.(value);
  }

  function animate(entity, player, time, dt, reduced) {
    const dropped = entity.state === 'seed';
    entity.group.position.set(entity.x, ground(entity.x, entity.z) + entity.height, entity.z);
    if (!reduced) {
      entity.group.position.y += Math.sin(time * .8 + entity.id) * (entity.kind === 'stalker' ? .035 : .12);
      if (entity.kind === 'orb' || dropped) entity.group.rotation.y += dt * (dropped ? 1.5 : .17);
      else if (entity.hostile > 0) entity.group.rotation.y = Math.atan2(player.x - entity.x, player.z - entity.z) + Math.PI;
      entity.core.rotation.y += dt * .22; entity.ring.rotation.z += dt * .23;
      if (entity.kind === 'stalker') entity.movement.rotation.z = entity.behavior === 'pursue' ? Math.sin(time * 8 + entity.id) * .085 : 0;
      if (entity.kind === 'jelly') entity.movement.scale.y = 1 + Math.sin(time * 1.3 + entity.id) * .055;
    }
    entity.group.scale.lerp(dropped ? dropScale : normalScale, Math.min(1, dt * 6));
    const ringBase = entity.kind === 'stalker' ? .8 : entity.kind === 'jelly' ? 1.1 : 1;
    entity.ring.scale.lerp(scan.set(ringBase, ringBase, ringBase), Math.min(1, dt * 5));
    entity.health.visible = !dropped && (entity.showHealth > 0 || entity.hostile > 0)
      && Math.hypot(player.x - entity.x, player.z - entity.z) < 150;
    if (entity.health.visible) {
      entity.health.lookAt(player.x, player.y + EYE, player.z);
      const width = 1.7 * entity.hp / entity.maxHp;
      entity.fill.scale.x = width; entity.fill.position.x = (width - 1.7) / 2;
      entity.fill.material = entity.hp / entity.maxHp < .35 ? healthWarn : healthFill;
      entity.armorFill.visible = entity.shieldHp > 0;
      entity.armorFill.scale.x = 1.7 * entity.shieldHp / Math.max(1, entity.maxShield);
      entity.armorFill.position.x = (entity.armorFill.scale.x - 1.7) / 2;
    }
  }

  function updateNpcs(player, time, dt, reduced) {
    for (const npc of npcs) {
      let floor;
      if (npc.state === 'sleep') {
        if (time - npc.age <= 45) continue;
        npc.state = 'idle'; npc.hp = npc.maxHp; npc.x = npc.homeX; npc.z = npc.homeZ;
        npc.group.visible = true; npc.group.scale.copy(normalScale);
      }
      npc.showHealth = Math.max(0, npc.showHealth - dt);
      if (npc.state !== 'seed') {
        npc.turnWait -= dt;
        if (npc.turnWait <= 0) {
          npc.turnIndex++;
          npc.heading += (random(npc.id, npc.turnIndex + 71) - .5) * 2;
          npc.turnWait = 2.4 + random(npc.id, npc.turnIndex + 74) * 4.5;
        }
        if (Math.hypot(npc.x - npc.homeX, npc.z - npc.homeZ) > 30) {
          npc.heading = Math.atan2(npc.homeX - npc.x, npc.homeZ - npc.z);
        }
        npc.heading %= Math.PI * 2;
        const oldX = npc.x, oldZ = npc.z;
        floor = move(npc, Math.sin(npc.heading) * npc.role.speed * dt, Math.cos(npc.heading) * npc.role.speed * dt, dt);
        const walked = Math.hypot(npc.x - oldX, npc.z - oldZ);
        npc.walked += walked; npc.speed = dt ? walked / dt : 0;
        if (dt && walked < npc.role.speed * dt * .15) {
          npc.heading += 1 + random(npc.id, npc.turnIndex + 81);
          npc.turnWait = Math.min(npc.turnWait, .6);
        }
        if (walked > .0001) npc.group.rotation.y = Math.atan2(npc.x - oldX, npc.z - oldZ);
      } else npc.speed = 0;
      npc.group.position.set(npc.x, (floor === undefined ? ground(npc.x, npc.z) : floor) + npc.height, npc.z);
      if (!reduced && (npc.kind === 'packet' || npc.kind === 'capsule')) npc.group.position.y += Math.sin(time * .8 + npc.id) * .09;
      if (!reduced && npc.state !== 'seed') {
        for (const limb of npc.limbs) {
          if (limb.wheel) limb.item.rotation.x += npc.speed * dt * 2.5;
          else limb.item.rotation.x = Math.sin(time * 4 + npc.id) * limb.phase * limb.amount * Math.min(1, npc.speed);
        }
        if (npc.kind === 'packet') npc.movement.rotation.z = Math.sin(time * .65 + npc.id) * .07;
      }
      npc.group.scale.lerp(npc.state === 'seed' ? dropScale : normalScale, Math.min(1, dt * 6));
      npc.health.visible = npc.state !== 'seed' && npc.showHealth > 0 && Math.hypot(player.x - npc.x, player.z - npc.z) < 150;
      if (npc.health.visible) {
        npc.health.lookAt(player.x, player.y + EYE, player.z);
        const width = 1.3 * npc.hp / npc.maxHp;
        npc.fill.scale.x = width; npc.fill.position.x = (width - 1.3) / 2;
        npc.fill.material = npc.hp / npc.maxHp < .4 ? healthWarn : healthFill;
      }
    }
  }

  function update(player, time, dt, onDamage, reduced = false, obstruction) {
    if (disposed) return;
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, .1);
    const spawnSafe = Math.hypot(player.x, player.z - 180) < SAFE_RADIUS;
    for (const entity of entities) {
      if (entity.state === 'sleep') {
        if (time - entity.age <= 35) continue;
        entity.state = 'idle'; entity.behavior = 'idle'; entity.hp = entity.maxHp; entity.shieldHp = entity.maxShield;
        if (entity.shield) entity.shield.visible = true;
        entity.x = entity.homeX; entity.z = entity.homeZ; entity.group.visible = true; entity.group.scale.copy(normalScale);
      }
      entity.showHealth = Math.max(0, entity.showHealth - dt); entity.hostile = Math.max(0, entity.hostile - dt); entity.shotWait -= dt;
      const distance = Math.hypot(player.x - entity.x, player.z - entity.z);
      const homeDistance = Math.hypot(player.x - entity.homeX, player.z - entity.homeZ);
      const canWake = entity.proactive && !spawnSafe && distance < entity.role.aggro && homeDistance < 145;
      if (canWake && entity.state !== 'seed') entity.hostile = Math.max(entity.hostile, 4.5);
      if (spawnSafe && entity.proactive || homeDistance > 185) {
        entity.hostile = 0; entity.attackTimer = 0; entity.attackStarted = false;
      }
      if (entity.state === 'seed') { animate(entity, player, time, dt, reduced); continue; }
      if (entity.hostile > 0 && entity.kind !== 'orb') {
        entity.behavior = entity.kind === 'stalker' ? 'pursue' : 'engaged';
        if (distance > .01 && entity.role.speed > 0) {
          let movement = entity.role.speed * dt;
          if (entity.kind !== 'stalker') movement *= distance > 42 ? 1 : distance < 17 ? -.6 : 0;
          else if (distance < 2.1) movement = 0;
          move(entity, (player.x - entity.x) / distance * movement, (player.z - entity.z) / distance * movement, dt);
        }
        entity.group.position.set(entity.x, ground(entity.x, entity.z) + entity.height, entity.z);
        const currentDistance = Math.hypot(player.x - entity.x, player.z - entity.z);
        aim.set(player.x, player.y + 1.25, player.z);
        const sight = currentDistance < entity.role.range && clearLine(entity.group.position, aim, obstruction);
        if (entity.kind === 'stalker') {
          if (entity.attackStarted) {
            entity.attackTimer -= dt;
            if (entity.attackTimer <= 0) {
              entity.attackStarted = false; entity.shotWait = entity.role.cooldown;
              if (sight && Math.abs(player.y - ground(entity.x, entity.z)) < 2.8) {
                entity.attacks++; meleeAttacks++; hurt(entity, entity.role.damage, onDamage);
              }
            }
          } else if (sight && entity.shotWait <= 0) {
            entity.attackStarted = true; entity.attackTimer = .38; entity.behavior = 'windup';
          }
        } else if (sight && entity.shotWait <= 0) {
          if (entity.kind === 'jelly') for (const spread of [-.11, 0, .11]) fire(entity, player, spread);
          else fire(entity, player);
          entity.shotWait = entity.role.cooldown + random(entity.id, entity.attacks) * .35;
        }
      } else {
        const distanceHome = Math.hypot(entity.homeX - entity.x, entity.homeZ - entity.z);
        entity.behavior = distanceHome > .6 ? 'return' : 'idle';
        if (distanceHome > .6) move(entity, (entity.homeX - entity.x) / distanceHome * dt * 3.2,
          (entity.homeZ - entity.z) / distanceHome * dt * 3.2, dt);
        entity.attackStarted = false;
      }
      animate(entity, player, time, dt, reduced);
    }
    updateNpcs(player, time, dt, reduced);
    for (const seed of seeds) {
      if (seed.life <= 0) continue;
      seed.life -= dt;
      if (seed.owner.state === 'seed' || seed.owner.state === 'sleep' || spawnSafe && seed.owner.proactive) seed.life = 0;
      previous.copy(seed.mesh.position); travel.copy(seed.velocity).multiplyScalar(dt);
      const distance = travel.length();
      if (seed.life > 0 && distance > 0) {
        lineDirection.copy(seed.velocity).normalize();
        if (obstruction && obstruction(previous, lineDirection, distance) < distance - .01) {
          seed.life = 0; blockedShots++;
        } else {
          seed.mesh.position.add(travel);
          if (seed.mesh.position.y < ground(seed.mesh.position.x, seed.mesh.position.z) + .08) seed.life = 0;
          if (seed.life > 0) {
            playerCenter.set(player.x, player.y + 1.25, player.z);
            const fraction = clamp(difference.copy(playerCenter).sub(previous).dot(travel) / Math.max(.000001, travel.lengthSq()), 0, 1);
            scan.copy(previous).addScaledVector(travel, fraction);
            if (scan.distanceToSquared(playerCenter) < .85 * .85) {
              seed.life = 0; projectileImpacts++; hurt(seed.owner, seed.damage, onDamage);
            }
          }
        }
      }
      if (seed.life <= 0) seed.mesh.visible = false;
    }
  }

  function collect(player, time) {
    if (disposed) return [];
    const found = [];
    for (const entity of inhabitants) if (entity.state === 'seed' && Math.hypot(player.x - entity.x, player.z - entity.z) < 3) {
      entity.state = 'sleep'; entity.behavior = 'sleep'; entity.group.visible = false; entity.age = time; entity.hostile = 0;
      found.push(entity.id);
      if (entity.npc) npcCollected++; else collected++;
    }
    return found;
  }

  function dispose() {
    if (disposed) return;
    disposed = true; root.removeFromParent();
    for (const entity of inhabitants) entity.group.visible = false;
    for (const seed of seeds) { seed.life = 0; seed.mesh.visible = false; }
    for (const shape of geometry) shape.dispose();
    for (const surface of material) surface.dispose();
  }

  // Fresh value records expose no mutable actor or Three.js objects.
  function npcTracking() {
    return npcs.map(npc => ({
      id: npc.id, kind: npc.kind, city: npc.city, x: npc.group.position.x, y: npc.group.position.y, z: npc.group.position.z,
      homeX: npc.homeX, homeZ: npc.homeZ, hp: npc.hp, maxHp: npc.maxHp, state: npc.state, visible: npc.group.visible,
      proactive: npc.proactive, hostile: npc.hostile > 0, attacks: npc.attacks, damageEvents: npc.damageEvents,
      damageTotal: npc.damageTotal, healthVisible: npc.health.visible,
      speed: npc.speed, walked: npc.walked, hits: npc.hits,
    }));
  }

  function snapshot() {
    return {
      disposed, kills, collected, shotsAtPlayer, activeSeeds: seeds.filter(seed => seed.life > 0).length,
      projectileCap: PROJECTILE_CAP, maxProjectiles: PROJECTILE_CAP, projectilePeak, projectileImpacts,
      meleeAttacks, damageEvents, damageTotal, blockedShots, droppedShots,
      species: { ...speciesCounts }, safeRadius: SAFE_RADIUS,
      npcCount: npcs.length, npcKills, npcCollected,
      npcKinds: { ...npcKindCounts },
      npcs: npcTracking(),
      projectiles: seeds.filter(seed => seed.life > 0).map(seed => ({
        owner: seed.owner.id, species: seed.owner.kind, damage: seed.damage, life: seed.life,
        x: seed.mesh.position.x, y: seed.mesh.position.y, z: seed.mesh.position.z,
      })),
      entities: entities.map(entity => ({
        id: entity.id, x: entity.group.position.x, y: entity.group.position.y, z: entity.group.position.z,
        homeX: entity.homeX, homeZ: entity.homeZ, hp: entity.hp, maxHp: entity.maxHp,
        shieldHp: entity.shieldHp, maxShield: entity.maxShield, kind: entity.kind, species: entity.kind,
        state: entity.state, behavior: entity.behavior, visible: entity.group.visible,
        proactive: entity.proactive, hostile: entity.hostile > 0, healthVisible: entity.health.visible,
        attacks: entity.attacks, damageEvents: entity.damageEvents, damageTotal: entity.damageTotal, hits: entity.hits,
      })),
    };
  }
  return { update, hit, collect, dispose, npcTracking, targets: () => disposed ? [] : inhabitants
    .filter(entity => entity.state !== 'seed' && entity.state !== 'sleep')
    .flatMap(entity => entity.targets.filter(target => target.visible)), snapshot };
}
