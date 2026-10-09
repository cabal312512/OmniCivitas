import {testDeps} from '../runtime-location.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, stat, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as pause } from 'node:timers/promises';
import { docker, composeArguments, dockerEnvironment } from '../../scripts/docker-child.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
try { process.loadEnvFile(join(root, '.env')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
assert.ok(process.argv.slice(2).every(arg => arg === '--marker-only'), 'The only optional argument is --marker-only');
const markerOnly = process.argv.includes('--marker-only');
const base = new URL(process.env.OCV_WORKSHOP_BASE_URL || `http://127.0.0.1:${process.env.OCV_WEB_PORT || 8080}`);
if (base.protocol !== 'http:' || base.username || base.password || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) throw Error('Use the private loopback entrance');
const key = process.env.OCV_RUNNER_KEY || (await readFile(join(testDeps, 'runtime/after-runner/worker.key'), 'utf8')).trim();
const worker = randomUUID(), own = [], report = { startedAt: new Date().toISOString(), mode: markerOnly ? 'marker-only' : 'guarded-full', claimsSkipped: markerOnly, jobsCreated: 0, claimsIssued: 0, passed: false, checks: [] };
// Keep the earlier failure report intact. Each guarded run has its own evidence file.
const stamp = report.startedAt.replace(/[:.]/g, '-');
const output = join(testDeps, `runtime/reports/task-tier-${report.mode}-${stamp}.json`);
let marker = '128.vue', leased = false, markerBytes;
let guard, failure;
const request = { schema: 'ocv.workshop-run/1', op: 'simulate', world: { gravityX: 0, gravityY: -9.81, stepS: 1 / 120, durationS: .2, sampleEvery: 1, seed: 1, bodies: [{ id: 'B1', kind: 'ball', x: 0, y: 2, radius: .3, mass: 1 }], joints: [], motors: [], controls: [] } };
async function post(path, body, privileged = false, statuses = [200, 201]) {
  const response = await fetch(new URL(path, base), { method: 'POST', headers: { 'content-type': 'application/json', ...(privileged ? { 'X-Ocv-Runner': key } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(12000) });
  assert.ok(statuses.includes(response.status), `Actual HTTP ${response.status} for ${path}`);
  return response.json();
}
const control = (action, extra = {}) => post('/api/a2/worker.cgi', { worker, action, ...extra }, true);
const read = job => post(`/api/workshop/jobs/${job.id}/read`, { ticket: job.ticket });
// A single psql session makes the ownership check and claim indivisible with
// respect to submissions. All enqueue paths take (312512,52); worker claim does not.
function openGuard() {
  const child = spawn(docker, composeArguments(['exec', '-T', 'postgres', 'sh', '-c', 'PGPASSWORD="$POSTGRES_PASSWORD" psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"']), {
    cwd: root, windowsHide: true, env: dockerEnvironment(), stdio: ['pipe', 'pipe', 'pipe'],
  });
  let buffer = '', pending, ended = false;
  const rejectPending = () => { if (pending) { const p = pending; pending = undefined; clearTimeout(p.timer); p.reject(Error('PostgreSQL ownership guard unavailable; no claim permitted')); } };
  const closed = new Promise(resolveClose => { child.once('close', () => { ended = true; rejectPending(); resolveClose(); }); });
  child.on('error', () => { ended = true; rejectPending(); });
  child.stdin.on('error', rejectPending);
  child.stderr.on('data', () => {}); // Never emit connection details or command output.
  child.stdout.on('data', bytes => {
    buffer += bytes;
    if (Buffer.byteLength(buffer) > 65536) { rejectPending(); child.kill(); return; }
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim(); buffer = buffer.slice(newline + 1);
      if (!line || !pending) continue;
      const p = pending; pending = undefined; clearTimeout(p.timer);
      try { p.resolve(JSON.parse(line)); } catch { p.reject(Error('PostgreSQL ownership guard returned invalid metadata')); }
    }
  });
  function query(sql) {
    assert.ok(!pending && !ended, 'Ownership guard must be available and sequential');
    return new Promise((resolveQuery, reject) => {
      const timer = setTimeout(() => { rejectPending(); child.kill(); }, 12000);
      pending = { resolve: resolveQuery, reject, timer };
      child.stdin.write(`${sql};\n`);
    });
  }
  child.stdin.write("SET lock_timeout='2s'; SET statement_timeout='10s';\n");
  return {
    query,
    async lock() { await query("SELECT json_build_object('locked',true) FROM (SELECT pg_advisory_lock(312512,52)) AS admission_guard"); },
    async unlock() { await query("SELECT json_build_object('unlocked',pg_advisory_unlock(312512,52))"); },
    async close() { if (!ended) child.stdin.end('\\q\n'); await Promise.race([closed, pause(2000)]); if (!ended) child.kill(); },
  };
}
async function snapshot() {
  const ids = own.length ? `ARRAY[${own.map(job => `'${job.id}'`).join(',')}]::uuid[]` : 'ARRAY[]::uuid[]';
  assert.ok(own.every(job => /^[a-f0-9-]{36}$/.test(job.id)), 'Only test-owned UUIDs may enter the guard query');
  return guard.query(`SELECT json_build_object(
    'queued',(SELECT count(*) FROM ocv_after.jobs WHERE state='queued'),
    'active',(SELECT count(*) FROM ocv_after.jobs WHERE state IN('starting','running')),
    'foreignPending',(SELECT count(*) FROM ocv_after.jobs WHERE state IN('queued','starting','running') AND NOT(id=ANY(${ids}))),
    'leased',(SELECT lease_until>now() FROM ocv_after.worker WHERE id=1),
    'leaseOwned',(SELECT owner='${worker}'::uuid FROM ocv_after.worker WHERE id=1))`);
}
async function guardedClaim() {
  assert.ok(!markerOnly && leased, 'Marker-only mode can never claim a job');
  await guard.lock();
  try {
    const state = await snapshot();
    assert.equal(state.leased, true, 'Refuse claims after losing the worker lease');
    assert.equal(state.leaseOwned, true, 'Refuse claims under another worker owner');
    assert.equal(state.foreignPending, 0, 'Refuse claims while any legitimate pending job exists');
    report.claimsIssued++;
    const claimed = (await control('claim')).job;
    if (claimed) assert.ok(own.some(job => job.id === claimed.id), 'The admission guard permits only test-owned jobs');
    return claimed;
  } finally { await guard.unlock(); }
}
async function changeMarker(next) {
  assert.ok(['128.vue', '2.vue', '1.vue'].includes(next));
  const from = join(root, marker), to = join(root, next);
  assert.equal((await stat(from)).size, markerBytes, 'Renaming must preserve the dormant component');
  await assert.rejects(access(to), { code: 'ENOENT' });
  await rename(from, to); marker = next;
  await pause(2200);
}
// Pause the real dispatcher first. Full mode refuses any existing pending job;
// marker-only permits queued jobs but never creates, claims, or cancels one.
try {
  const markerStat = await stat(join(root, marker));
  assert.ok(markerStat.isFile()); markerBytes = markerStat.size;
  guard = openGuard();
  await guard.lock();
  let initial;
  try {
    const state = await snapshot();
    report.initialQueue = { queued: state.queued, active: state.active };
    assert.equal(state.active, 0, 'Pause the dispatcher and wait until all legitimate active jobs finish');
    assert.equal(state.leased, false, 'Pause the dispatcher and wait until its worker lease is released');
    if (!markerOnly) assert.equal(state.foreignPending, 0, 'Full proof requires a provably idle queue; use --marker-only when legitimate jobs are queued');
    initial = await control('heartbeat'); leased = true;
  } finally { await guard.unlock(); }
  assert.equal(initial.executionLimit, 128); assert.equal(initial.queueLimit, 0);
  await changeMarker('2.vue');
  const small = await control('heartbeat');
  assert.equal(small.executionLimit, 2); assert.equal(small.queueLimit, 128);
  report.checks.push({ name: 'Renaming the numeric Vue file changes live gateway capacity without importing its contents or recreating the container', passed: true, from: 128, to: 2 });
  if (markerOnly) {
    await changeMarker('1.vue');
    const one = await control('heartbeat');
    assert.equal(one.executionLimit, 1); assert.equal(one.queueLimit, 64);
    report.checks.push({ name: 'Tier 1 exposes live capacity without claiming or executing queued work', passed: true });
    await changeMarker('128.vue');
    const restored = await control('heartbeat');
    assert.equal(restored.executionLimit, 128); assert.equal(restored.queueLimit, 0);
    report.checks.push({ name: 'The original numeric Vue filename and highest capacity are restored', passed: true });
    report.checks.push({ name: 'Queue admission, concurrent claims, batched job heartbeat, and owner cancellation', skipped: true, reason: '--marker-only: no test jobs created, claimed, or cancelled' });
    const final = await snapshot();
    report.finalQueue = { queued: final.queued, active: final.active };
    assert.equal(final.active, 0); assert.equal(final.leaseOwned, true);
    assert.equal(own.length, 0); assert.equal(report.claimsIssued, 0);
  } else {
  for (let index = 0; index < 6; index++) {
    const job = await post('/api/workshop/jobs', { request });
    own.push(job); report.jobsCreated++;
    assert.equal(job.state, 'queued');
  }
  const first = await guardedClaim(), second = await guardedClaim();
  assert.equal(first.id, own[0].id); assert.equal(second.id, own[1].id);
  assert.equal(first.family, 'mechanical'); assert.equal(second.family, 'mechanical');
  assert.equal(await guardedClaim(), null);
  assert.equal((await read(own[2])).state, 'queued');
  report.checks.push({ name: 'Six actual PostgreSQL jobs coexist; two same-family jobs claim concurrently and a third waits at tier 2', passed: true });
  const updatedBefore = (await read(own[1])).updated_at;
  await pause(1100);
  await control('heartbeat', { jobs: [first.id, second.id] });
  assert.ok(new Date((await read(own[1])).updated_at) > new Date(updatedBefore));
  report.checks.push({ name: 'One privileged heartbeat refreshes multiple active jobs through PostgreSQL', passed: true });
  await changeMarker('1.vue');
  assert.equal(await guardedClaim(), null);
  assert.equal((await read(own[0])).state, 'starting');
  assert.equal((await read(own[1])).state, 'starting');
  report.checks.push({ name: 'Lowering the tier stops further claims while preserving already active jobs', passed: true });
  await changeMarker('128.vue');
  const restored = await control('heartbeat');
  assert.equal(restored.executionLimit, 128); assert.equal(restored.queueLimit, 0);
  assert.ok(await guardedClaim());
  assert.ok(await guardedClaim());
  await post(`/api/workshop/jobs/${own[0].id}/read`, { ticket: '0'.repeat(64) }, false, [404]);
  await post(`/api/workshop/jobs/${own[0].id}/cancel`, { ticket: own[0].ticket });
  assert.equal((await read(own[1])).state, 'starting');
  report.checks.push({ name: 'Highest tier returns live; capability isolation and cancellation leave another active job intact', passed: true });
  }
  report.passed = true;
} catch (error) {
  failure = error;
  report.error = error.message;
} finally {
  const cleanupErrors = [];
  if (marker !== '128.vue') await changeMarker('128.vue').catch(() => cleanupErrors.push('Original numeric Vue filename could not be restored'));
  for (const job of own) await post(`/api/workshop/jobs/${job.id}/cancel`, { ticket: job.ticket }).catch(() => cleanupErrors.push('A test-owned job could not be cancelled'));
  if (leased) await control('release').catch(() => cleanupErrors.push('The test worker lease could not be released'));
  if (guard) await guard.close().catch(() => cleanupErrors.push('The ownership guard could not be closed'));
  if (cleanupErrors.length) { report.passed = false; report.cleanupErrors = cleanupErrors; }
  report.markerRestored = marker === '128.vue';
  report.finishedAt = new Date().toISOString();
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, mode: report.mode, claimsSkipped: report.claimsSkipped, checks: report.checks.filter(check => check.passed).length, report: output }));
}
if (failure || !report.passed) process.exitCode = 1;
