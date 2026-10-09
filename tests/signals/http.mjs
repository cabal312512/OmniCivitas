import {testDeps} from '../runtime-location.mjs';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';

const base = new URL(process.env.OCV_SIGNALS_BASE_URL || `http://localhost:${process.env.OCV_WEB_PORT || 8080}`);
if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw Error('Use an HTTP entrance without URL credentials');
const deadlineMs = Math.min(240000, Math.max(30000, Number(process.env.OCV_SIGNALS_HTTP_TIMEOUT_MS || 180000)));
const reportFile = path.join(testDeps, 'runtime', 'reports', 'phase10-http.json');
const report = {schema: 'ocv.signals/http-proof/1', startedAt: new Date().toISOString(), entrance: base.origin, checks: [], jobs: [], passed: false};
const owned = new Map();

function canonical(value) {
 if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
 if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
 return JSON.stringify(value);
}
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
async function post(endpoint, body, expected = [200, 201]) {
 const response = await fetch(new URL(`/api/signals${endpoint}`, base), {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body), signal: AbortSignal.timeout(12000)});
 const text = await response.text();
 assert.ok(Buffer.byteLength(text) <= 6291456, 'Bounded response size');
 let result;
 try {result = JSON.parse(text);} catch {throw Error(`Expected JSON from ${endpoint.replace(/[a-f0-9-]{36}/g, ':id')} (HTTP ${response.status})`);}
 assert.ok(expected.includes(response.status), `Unexpected HTTP ${response.status} at ${endpoint.replace(/[a-f0-9-]{36}/g, ':id')}: ${String(result.message || result.error || '').slice(0, 160)}`);
 return result;
}
async function check(name, body) {
 const start = Date.now();
 try {const evidence = await body(); report.checks.push({name, passed: true, elapsedMs: Date.now() - start, ...evidence});}
 catch (error) {report.checks.push({name, passed: false, elapsedMs: Date.now() - start, error: String(error.message).slice(0, 300)}); throw error;}
}

const network = {nodes: [{id: 'H1', type: 'host', x: 180, y: 260}, {id: 'R0', type: 'router', x: 610, y: 260}],
 links: [{id: 'L1', a: 'H1', b: 'R0', rateMbps: 1, delayMs: 10, loss: 0, enabled: true}],
 flows: [{id: 'F1', source: 'H1', target: 'R0', packets: 2, bytes: 1000, startMs: 0, intervalMs: 0}], seed: 7, durationMs: 100};
const project = {schema: 'ocv.signals-project/1', name: 'HTTP reference ' + randomUUID().slice(0, 8), network,
 drawing: {components: [{id: 'V1', kind: 'V', x: 230, y: 260, rotation: 90, value: 5}, {id: 'R1', kind: 'R', x: 450, y: 150, rotation: 0, value: 1000},
                       {id: 'R2', kind: 'R', x: 670, y: 260, rotation: 90, value: 1000}, {id: 'G1', kind: 'GND', x: 230, y: 390, rotation: 0, value: 0}],
 wires: [{id: 'w1', from: {component: 'V1', pin: 'a'}, to: {component: 'R1', pin: 'a'}}, {id: 'w2', from: {component: 'V1', pin: 'b'}, to: {component: 'G1', pin: 'a'}},
         {id: 'w3', from: {component: 'R1', pin: 'b'}, to: {component: 'R2', pin: 'a'}}, {id: 'w4', from: {component: 'R2', pin: 'b'}, to: {component: 'G1', pin: 'a'}}]},
 analysis: {kind: 'dc', fStart: 10, fStop: 100000, points: 64, durationS: .01, stepS: .000025},
 communication: {bits: '0100111001100101', seed: 1234, ebN0Db: 0, samplesPerSymbol: 4, sampleRateHz: 8000}, instruments: {probe: 'out', cursor: 0}};
const circuit = {schema: 'ocv.signals/1', op: 'circuit', ground: '0', analysis: {kind: 'dc'}, probeNodes: ['out'], components: [
 {id: 'V1', type: 'V', a: 'in', b: '0', value: 5}, {id: 'R1', type: 'R', a: 'in', b: 'out', value: 1000}, {id: 'R2', type: 'R', a: 'out', b: '0', value: 2000}]};
const communication = {schema: 'ocv.signals/1', op: 'communications', ...project.communication, crc: 'CRC-8', modulation: 'BPSK', noiseless: true};
const requests = [{name: 'circuit', request: circuit}, {name: 'communication', request: communication}, {name: 'network', request: {schema: 'ocv.signals/1', op: 'network', ...network}}];

let saved;
async function waitJob(job) {
 const deadline = Date.now() + deadlineMs;
 const transitions = [];
 while (Date.now() < deadline) {
  const state = await post(`/jobs/${job.id}/read`, {ticket: job.ticket});
  assert.equal(state.storage, 'PostgreSQL');
  if (transitions.at(-1)?.state !== state.state || transitions.at(-1)?.phase !== state.phase) transitions.push({state: state.state, phase: state.phase});
  if (['done', 'failed', 'cancelled'].includes(state.state)) return {state, transitions};
  await sleep(800);
 }
 throw Error('Server job exceeded the bounded integration deadline');
}
async function completedJob(name, request) {
 const started = Date.now();
 const job = await post('/jobs', {request, project: saved.id, projectTicket: saved.ticket});
 assert.equal(job.storage, 'PostgreSQL');
 assert.equal(job.dispatcherConfigured, true, 'The host dispatcher must be configured for this actual integration proof');
 assert.equal(job.state, 'queued');
 owned.set(job.id, job.ticket);
 const {state, transitions} = await waitJob(job);
 owned.delete(job.id);
 assert.equal(state.state, 'done', 'A native server job must complete, rather than fall back to a local preview');
 const {engine, analysis, steps} = state.result;
 assert.equal(engine.ok, true);
 assert.equal(analysis.engine, 'python-ce3');
 assert.equal(analysis.nativeResultReplaced, false);
 assert.equal(analysis.verification, 'verified');
 assert.equal(analysis.summary.failed, 0);
 assert.equal(analysis.audit.readbackVerified, true);
 assert.equal(analysis.audit.authority, 'derived analysis metadata');
 assert.equal(steps.length, 3);
 assert.equal(steps[0].storage, 'PostgreSQL');
 assert.equal(steps[0].java.contract, 'ocv.task/1');
 assert.equal(steps[0].java.task, job.id);
 assert.equal(steps[0].java.phase, 'prepared');
 assert.equal(steps[0].go.contract, 'ocv.project-manifest/1');
 assert.equal(steps[0].go.digest, saved.digest);
 assert.equal(steps[0].go.revision, 2);
 assert.equal(steps[0].go.components, 4);
 assert.equal(steps[1].nativeExecution, true);
 assert.equal(steps[2].verification, 'verified');
 if (name === 'circuit') assert.ok(Math.abs(engine.rows[0].values.out - 10 / 3) < 1e-8, 'Actual divider voltage');
 if (name === 'communication') {assert.equal(engine.decodedBits, request.bits); assert.equal(engine.crcValid, true); assert.equal(engine.bitErrors, 0);}
 if (name === 'network') {assert.deepEqual(engine.events.filter(e => e.kind === 'arrive').map(e => e.tMs), [18, 26]); assert.equal(engine.flows[0].avgLatencyMs, 22); assert.equal(engine.summary.delivered, 2);}
 const evidence = {name, id: job.id, elapsedMs: Date.now() - started, state: state.state, storage: state.storage, transitions,
                   nativeEngine: engine.engine, nativeVersion: engine.version, nativeExecution: steps[1].nativeExecution,
                   javaContract: steps[0].java.contract, goContract: steps[0].go.contract, analysisEngine: analysis.engine,
                   verification: analysis.verification, checkStatuses: analysis.checks.map(c => ({code: c.code, status: c.status})),
                   derivedAuditReadback: analysis.audit.readbackVerified};
 report.jobs.push(evidence);
 console.log(`${name}: actual native / Java / Go / PostgreSQL / CE3 verified`);
 return evidence;
}

try {
 await check('immutable project save / exact readback / digest', async () => {
  saved = await post('/projects', {project});
  assert.equal(saved.storage, 'PostgreSQL'); assert.equal(saved.revision, 1); assert.equal(saved.digest, digest(project));
  const readback = await post(`/projects/${saved.id}/read`, {ticket: saved.ticket});
  assert.deepEqual(readback.project, project); assert.equal(readback.digest, saved.digest); assert.equal(readback.revision, 1);
  return {storage: readback.storage, revision: 1, checksumMatched: true};
 });
 await check('capability denies an unrelated owner', async () => {await post(`/projects/${saved.id}/read`, {ticket: '0'.repeat(64)}, [404]); return {status: 404};});
 await check('unknown envelope fields are rejected', async () => {await post('/projects', {project, unexpected: true}, [400]); return {status: 400};});
 await check('immutable revision update and stale-write conflict', async () => {
  project.drawing.components.find(c => c.id === 'R2').value = 2000;
  saved = await post('/projects', {project, id: saved.id, ticket: saved.ticket, expectedRevision: 1});
  assert.equal(saved.revision, 2); assert.equal(saved.digest, digest(project));
  await post('/projects', {project: {...project, name: 'stale edit'}, id: saved.id, ticket: saved.ticket, expectedRevision: 1}, [409]);
  const readback = await post(`/projects/${saved.id}/read`, {ticket: saved.ticket});
  assert.equal(readback.revision, 2); assert.deepEqual(readback.project, project);
  return {revision: 2, staleWriteStatus: 409, checksumMatched: true};
 });
 await check('privileged dispatcher endpoint is unavailable without its key', async () => {await post('/internal', {id: randomUUID(), worker: randomUUID(), action: 'input'}, [404]); return {status: 404};});
 await check('unsupported server operation is rejected before queueing', async () => {await post('/jobs', {request: {schema: 'ocv.signals/1', op: 'digital', gates: [], inputs: {}, ticks: 1}}, [400]); return {status: 400};});
 for (const fixture of requests) await check(`real ${fixture.name} persistent execution`, () => completedJob(fixture.name, fixture.request));
 await check('owner cancellation remains terminal', async () => {
  const job = await post('/jobs', {request: circuit, project: saved.id, projectTicket: saved.ticket});
  owned.set(job.id, job.ticket);
  await post(`/jobs/${job.id}/read`, {ticket: '0'.repeat(64)}, [404]);
  const cancelled = await post(`/jobs/${job.id}/cancel`, {ticket: job.ticket});
  assert.equal(cancelled.cancelled, true, 'The short proof cancels immediately while the job is queued or starting');
  const first = await post(`/jobs/${job.id}/read`, {ticket: job.ticket});
  assert.equal(first.state, 'cancelled'); assert.equal(first.cancelled, true);
  await sleep(1600);
  const second = await post(`/jobs/${job.id}/read`, {ticket: job.ticket});
  assert.equal(second.state, 'cancelled');
  const repeated = await post(`/jobs/${job.id}/cancel`, {ticket: job.ticket});
  assert.equal(repeated.cancelled, false);
  owned.delete(job.id);
  return {state: second.state, repeatCancellationChangedState: false, storage: second.storage};
 });
 report.passed = true;
} catch (error) {
 report.failure = String(error.message).slice(0, 300);
 process.exitCode = 1;
 console.error('Signals HTTP proof failed: ' + report.failure);
} finally {
 for (const [id, ticket] of owned) await post(`/jobs/${id}/cancel`, {ticket}).catch(() => {});
 report.finishedAt = new Date().toISOString();
 await mkdir(path.dirname(reportFile), {recursive: true});
 await writeFile(reportFile, JSON.stringify(report, null, 2), {mode: 0o600});
 console.log(`HTTP checks: ${report.checks.filter(c => c.passed).length}/${report.checks.length}; report saved`);
}
