<template>
  <section ref="host" class="tank-room" tabindex="0" aria-label="坦克战场" @pointerdown="focusField">
    <header class="tank-hud">
      <strong>坦克战场</strong>
      <span>波次 {{ wave }}</span>
      <span>分数 {{ score }}</span>
      <span>记录 {{ best }}</span>
      <span class="tank-health"><i :style="{ width: health + '%' }"></i></span>
      <button type="button" @click="togglePause">{{ paused ? '继续' : '暂停' }}</button>
      <button type="button" @click="restart">重开</button>
    </header>
    <div class="tank-stage">
      <canvas ref="surface" @pointermove="aim" @pointerdown="beginFire" @pointerup="endFire" @pointercancel="endFire" @pointerleave="endFire" />
      <div v-if="over || paused" class="tank-cover">
        <b>{{ over ? '战斗结束' : '已暂停' }}</b>
        <span>{{ over ? '分数 ' + score : '按 P 或 Esc 继续' }}</span>
        <button type="button" @click="over ? restart() : togglePause()">{{ over ? '再来一局' : '继续' }}</button>
      </div>
    </div>
    <footer>WASD / 方向键移动 · 鼠标瞄准 · 点击 / 空格射击 · P 暂停 · R 重开</footer>
  </section>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';

const host = ref(null);
const surface = ref(null);
const health = ref(100);
const score = ref(0);
const best = ref(0);
const wave = ref(1);
const paused = ref(false);
const over = ref(false);
const width = 1280;
const height = 800;
const keys = new Set();
const enemies = [];
const shots = [];
const particles = [];
const supplies = [];
const walls = [];
const player = { x: 640, y: 710, r: 18, body: -Math.PI / 2, turret: -Math.PI / 2, cooldown: 0, immune: 0 };
const palette = ['#78cee8', '#d69157', '#b7b2f5'];
let ctx;
let observer;
let frame = 0;
let previous = 0;
let firing = false;
let spawned = 0;
let spawnClock = 0;
let nextWave = 0;
let cabal312512 = 0;
let mounted = false;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const targetCount = () => Math.min(22, 4 + wave.value * 2);
const solid = (x, y, radius) => walls.some(w => {
  const dx = x - clamp(x, w.x, w.x + w.w);
  const dy = y - clamp(y, w.y, w.y + w.h);
  return dx * dx + dy * dy < radius * radius;
});

function move(body, dx, dy) {
  const x = clamp(body.x + dx, body.r, width - body.r);
  const y = clamp(body.y + dy, body.r, height - body.r);
  if (!solid(x, body.y, body.r)) body.x = x;
  if (!solid(body.x, y, body.r)) body.y = y;
}

function createWalls() {
  walls.length = 0;
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 5; column++) {
      if ((row + column) % 4 === 0) continue;
      const x = 140 + column * 220;
      const y = 165 + row * 170;
      const steel = (row + column) % 3 === 0;
      walls.push({ x, y, w: 88, h: 34, hp: steel ? Infinity : 4, steel });
      if (column % 2 === 0) walls.push({ x: x + 70, y: y + 34, w: 18, h: 68, hp: 3, steel: false });
    }
  }
}

function focusField(event) {
  if (event?.target?.closest('button')) return;
  host.value?.focus({ preventScroll: true });
}

function aim(event) {
  const box = surface.value?.getBoundingClientRect();
  if (!box?.width || !box.height) return;
  const point = { x: (event.clientX - box.left) * width / box.width, y: (event.clientY - box.top) * height / box.height };
  player.turret = angleTo(player, point);
}

function beginFire(event) {
  if (event.button !== 0) return;
  focusField(event);
  aim(event);
  firing = true;
  surface.value?.setPointerCapture(event.pointerId);
}

function endFire() { firing = false; }
function togglePause() {
  if (over.value) return;
  paused.value = !paused.value;
  keys.clear();
  firing = false;
  focusField();
}

function restart() {
  health.value = 100;
  score.value = 0;
  wave.value = 1;
  paused.value = false;
  over.value = false;
  Object.assign(player, { x: 640, y: 710, body: -Math.PI / 2, turret: -Math.PI / 2, cooldown: 0, immune: 1.5 });
  enemies.length = shots.length = particles.length = supplies.length = 0;
  keys.clear();
  firing = false;
  spawned = 0;
  spawnClock = .8;
  nextWave = 0;
  createWalls();
  focusField();
}

function spawnEnemy() {
  const kind = Math.floor(Math.random() * 3);
  let point;
  for (let attempt = 0; attempt < 24; attempt++) {
    const side = Math.floor(Math.random() * 3);
    point = side === 0 ? { x: 30, y: 35 + Math.random() * 500 }
      : side === 1 ? { x: width - 30, y: 35 + Math.random() * 500 }
        : { x: 40 + Math.random() * (width - 80), y: 30 };
    if (!solid(point.x, point.y, 22) && distance(point, player) > 240) break;
    point = null;
  }
  if (!point) return false;
  enemies.push({ ...point, r: kind === 2 ? 22 : 17, body: 0, turret: 0, kind,
    hp: kind === 2 ? 5 + Math.floor(wave.value / 4) : 2,
    speed: kind === 1 ? 108 : kind === 2 ? 43 : 64,
    cooldown: 1 + Math.random(), wobble: Math.random() * Math.PI * 2 });
  return true;
}

function burst(x, y, colour, count = 12) {
  for (let i = 0; i < count && particles.length < 260; i++) {
    const theta = Math.random() * Math.PI * 2;
    const speed = 35 + Math.random() * 155;
    particles.push({ x, y, vx: Math.cos(theta) * speed, vy: Math.sin(theta) * speed,
      life: .25 + Math.random() * .45, colour, r: 1 + Math.random() * 3 });
  }
}

function shoot(body, hostile) {
  if (shots.length >= 160) return;
  const speed = hostile ? 285 + Math.min(120, wave.value * 5) : 590;
  const spread = hostile ? (Math.random() - .5) * .12 : 0;
  const angle = body.turret + spread;
  shots.push({ x: body.x + Math.cos(angle) * (body.r + 10), y: body.y + Math.sin(angle) * (body.r + 10),
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 2.8, hostile, damage: hostile && body.kind === 2 ? 19 : hostile ? 11 : 1 });
  burst(body.x + Math.cos(angle) * (body.r + 12), body.y + Math.sin(angle) * (body.r + 12), '#ffe9ac', 3);
}

function lineClear(enemy) {
  const length = distance(enemy, player);
  const samples = Math.max(1, Math.ceil(length / 12));
  for (let i = 1; i < samples; i++) {
    if (solid(enemy.x + (player.x - enemy.x) * i / samples, enemy.y + (player.y - enemy.y) * i / samples, 3)) return false;
  }
  return true;
}

function finishGame() {
  over.value = true;
  firing = false;
  keys.clear();
  if (score.value > best.value) {
    best.value = score.value;
    try { localStorage.setItem('ocv.unmounted-tank.best', String(best.value)); } catch {}
  }
}

function update(dt) {
  cabal312512 += dt;
  player.cooldown -= dt;
  player.immune = Math.max(0, player.immune - dt);
  let dx = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  let dy = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
  if (dx || dy) {
    const length = Math.hypot(dx, dy);
    dx /= length; dy /= length;
    player.body = Math.atan2(dy, dx);
    move(player, dx * 185 * dt, dy * 185 * dt);
  }
  if ((firing || keys.has('Space')) && player.cooldown <= 0) { shoot(player, false); player.cooldown = .2; }
  spawnClock -= dt;
  if (spawned < targetCount() && enemies.length < 16 && spawnClock <= 0) {
    if (spawnEnemy()) spawned++;
    spawnClock = Math.max(.35, 1.25 - wave.value * .06);
  }
  if (spawned >= targetCount() && enemies.length === 0) {
    nextWave += dt;
    if (nextWave > 1.8) { wave.value++; spawned = 0; nextWave = 0; spawnClock = .3; health.value = Math.min(100, health.value + 12); }
  }
  for (const enemy of enemies) {
    enemy.cooldown -= dt;
    enemy.turret = angleTo(enemy, player);
    const range = distance(enemy, player);
    const strafe = Math.sin(cabal312512 * .8 + enemy.wobble) * .65;
    const heading = enemy.turret + (range < 160 ? Math.PI / 2 : 0) + strafe;
    enemy.body = heading;
    move(enemy, Math.cos(heading) * enemy.speed * dt, Math.sin(heading) * enemy.speed * dt);
    if (enemy.cooldown <= 0 && range < 700 && lineClear(enemy)) {
      shoot(enemy, true);
      enemy.cooldown = Math.max(.55, enemy.kind === 1 ? 1.65 : enemy.kind === 2 ? 2.25 : 1.35) + Math.random() * .35;
    }
    if (range < enemy.r + player.r && player.immune <= 0) { health.value -= 8; player.immune = .7; }
  }
  for (let i = shots.length - 1; i >= 0; i--) {
    const shot = shots[i];
    shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt;
    let hit = shot.life <= 0 || shot.x < 0 || shot.y < 0 || shot.x > width || shot.y > height;
    if (!hit) {
      const wall = walls.find(w => shot.x >= w.x - 3 && shot.x <= w.x + w.w + 3 && shot.y >= w.y - 3 && shot.y <= w.y + w.h + 3);
      if (wall) { wall.hp -= 1; hit = true; burst(shot.x, shot.y, wall.steel ? '#acc0ce' : '#d69157', 4); }
      if (!hit && shot.hostile && distance(shot, player) < player.r) {
        hit = true;
        if (player.immune <= 0) { health.value = Math.max(0, health.value - shot.damage); player.immune = .45; burst(player.x, player.y, '#ffe9ac'); }
      } else if (!hit && !shot.hostile) {
        const enemy = enemies.find(tank => distance(shot, tank) < tank.r);
        if (enemy) { enemy.hp--; hit = true; burst(shot.x, shot.y, palette[enemy.kind], 5); }
      }
    }
    if (hit) shots.splice(i, 1);
  }
  for (let i = walls.length - 1; i >= 0; i--) if (walls[i].hp <= 0) walls.splice(i, 1);
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    if (enemy.hp > 0) continue;
    score.value += enemy.kind === 2 ? 80 : enemy.kind === 1 ? 45 : 30;
    burst(enemy.x, enemy.y, palette[enemy.kind], 24);
    if (Math.random() < .18 && supplies.length < 8) supplies.push({ x: enemy.x, y: enemy.y, life: 18 });
    enemies.splice(i, 1);
  }
  for (let i = supplies.length - 1; i >= 0; i--) {
    supplies[i].life -= dt;
    if (distance(supplies[i], player) < 32) { health.value = Math.min(100, health.value + 25); supplies.splice(i, 1); }
    else if (supplies[i].life <= 0) supplies.splice(i, 1);
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  if (health.value <= 0) finishGame();
}

function tank(body, colour, friendly = false) {
  if (friendly && player.immune > 0 && Math.floor(cabal312512 * 14) % 2) return;
  ctx.save(); ctx.translate(body.x, body.y); ctx.rotate(body.body);
  ctx.fillStyle = '#192331'; ctx.fillRect(-body.r, -body.r - 3, body.r * 2, 8); ctx.fillRect(-body.r, body.r - 5, body.r * 2, 8);
  ctx.fillStyle = colour; ctx.fillRect(-body.r + 2, -body.r + 4, body.r * 2 - 4, body.r * 2 - 8);
  ctx.strokeStyle = '#ffffff70'; ctx.strokeRect(-body.r + 5, -body.r + 7, body.r * 2 - 10, body.r * 2 - 14);
  ctx.restore(); ctx.save(); ctx.translate(body.x, body.y); ctx.rotate(body.turret);
  ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(0, 0, body.r * .55, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(0, -4, body.r + 13, 8); ctx.fillStyle = '#203143'; ctx.fillRect(body.r + 8, -5, 6, 10); ctx.restore();
}

function draw() {
  if (!ctx) return;
  const ratio = surface.value.width / width;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = '#253442'; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#4f6c7835'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < width; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
  for (let y = 0; y < height; y += 40) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
  ctx.stroke();
  for (const wall of walls) {
    ctx.fillStyle = '#101a2480'; ctx.fillRect(wall.x + 4, wall.y + 5, wall.w, wall.h);
    ctx.fillStyle = wall.steel ? '#8195a0' : '#9f7253'; ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.strokeStyle = wall.steel ? '#c5d3d9' : '#d8aa83'; ctx.strokeRect(wall.x + .5, wall.y + .5, wall.w - 1, wall.h - 1);
    if (!wall.steel && wall.hp < 4) { ctx.fillStyle = '#253442'; ctx.fillRect(wall.x + wall.w / 2, wall.y + 4, 3, wall.h - 8); }
  }
  for (const supply of supplies) {
    ctx.fillStyle = '#cbe8dd'; ctx.fillRect(supply.x - 10, supply.y - 10, 20, 20);
    ctx.fillStyle = '#468978'; ctx.fillRect(supply.x - 6, supply.y - 2, 12, 4); ctx.fillRect(supply.x - 2, supply.y - 6, 4, 12);
  }
  for (const enemy of enemies) tank(enemy, palette[enemy.kind]);
  tank(player, '#92d5bb', true);
  for (const shot of shots) { ctx.fillStyle = shot.hostile ? '#ff9579' : '#fff2b3'; ctx.beginPath(); ctx.arc(shot.x, shot.y, 3.5, 0, Math.PI * 2); ctx.fill(); }
  for (const p of particles) { ctx.globalAlpha = Math.min(1, p.life * 3); ctx.fillStyle = p.colour; ctx.fillRect(p.x, p.y, p.r, p.r); }
  ctx.globalAlpha = 1;
}

function animate(time) {
  if (!mounted) return;
  const dt = Math.min(.035, Math.max(0, (time - (previous || time)) / 1000));
  previous = time;
  if (!paused.value && !over.value) update(dt);
  draw();
  frame = requestAnimationFrame(animate);
}

function resize() {
  if (!surface.value) return;
  const displayWidth = surface.value.getBoundingClientRect().width;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  surface.value.width = Math.max(1, Math.round(displayWidth * ratio));
  surface.value.height = Math.max(1, Math.round(displayWidth * height / width * ratio));
  draw();
}

function keyDown(event) {
  if (!host.value?.contains(document.activeElement)) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  if (!event.repeat && (event.code === 'KeyP' || event.code === 'Escape')) togglePause();
  else if (!event.repeat && event.code === 'KeyR') restart();
  else keys.add(event.code);
}
function keyUp(event) { keys.delete(event.code); }
function loseFocus() { if (!over.value) paused.value = true; keys.clear(); firing = false; }

onMounted(() => {
  ctx = surface.value?.getContext('2d');
  if (!ctx) return;
  try { best.value = clamp(Number(localStorage.getItem('ocv.unmounted-tank.best')) || 0, 0, 1e9); } catch {}
  restart(); mounted = true;
  observer = new ResizeObserver(resize); observer.observe(surface.value); resize();
  window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp); window.addEventListener('blur', loseFocus);
  frame = requestAnimationFrame(animate);
});
onBeforeUnmount(() => {
  mounted = false; cancelAnimationFrame(frame); observer?.disconnect(); keys.clear(); firing = false;
  window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('blur', loseFocus);
});
</script>

<style scoped>
.tank-room{width:min(100%,980px);border:1px solid #8aacca;background:#ecf4fc;color:#244d72;font:13px/1.5 system-ui,sans-serif;outline:none}
.tank-room:focus-visible{outline:2px solid #477ed6;outline-offset:3px}
.tank-hud{display:flex;gap:14px;align-items:center;flex-wrap:wrap;padding:9px 12px;border-bottom:1px solid #8aacca}
.tank-hud strong{margin-right:auto}.tank-health{width:100px;height:9px;background:#c4d0dc;border:1px solid #8aacca}
.tank-health i{display:block;height:100%;background:#659f86;transition:width .1s}
.tank-room button{border:1px solid #8aacca;background:#fff;color:#244d72;padding:3px 10px;cursor:pointer}
.tank-room button:hover{background:#d7e9fc}.tank-stage{position:relative;overflow:hidden}.tank-stage canvas{display:block;width:100%;aspect-ratio:8/5;touch-action:none}
.tank-cover{position:absolute;inset:0;background:#122230b3;color:#edf5fd;display:flex;flex-direction:column;gap:14px;align-items:center;justify-content:center}
.tank-cover b{font-size:24px;letter-spacing:.1em}.tank-room footer{padding:7px 12px;font-size:12px}
</style>
