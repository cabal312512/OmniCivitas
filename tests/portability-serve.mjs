import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { projectRoot, resolveRuntimePaths, resolveRuntimeTool } from '../scripts/runtime-paths.mjs';

// A bounded manual smoke of the ordinary entrance; builds must already exist.
const { depsRoot, reportRoot } = resolveRuntimePaths();
await mkdir(reportRoot, { recursive: true });
await mkdir(path.join(depsRoot, 'tmp'), { recursive: true });
const temporary = await mkdtemp(path.join(depsRoot, 'tmp/portable-serve-'));
const configuration = path.join(temporary, 'empty.json');
await writeFile(configuration, '{}');
const ports = [];
while (ports.length < 3) {
  const port = await new Promise((resolve, reject) => {
    const server = net.createServer(); server.on('error', reject);
    server.listen(0, '127.0.0.1', () => { const value = server.address().port; server.close(() => resolve(value)); });
  });
  if (!ports.includes(port)) ports.push(port);
}
const environment = { ...process.env, OCV_RUNTIME_CONFIG: configuration,
  OCV_LOCAL_STORAGE_GUARD: '0', OCV_PNPM_CLI: resolveRuntimeTool('pnpm'),
  OCV_WEB_PORT: String(ports[0]), OCV_NEXT_PORT: String(ports[1]), OCV_GATEWAY_PORT: String(ports[2]),
  NODE_OPTIONS: '--max-old-space-size=192' };
delete environment.OCV_DEPS_ROOT;
delete environment.OCV_RUNNER_KEY;
const child = spawn(process.execPath, ['scripts/local-runtime.mjs', 'serve'], {
  cwd: projectRoot, env: environment, windowsHide: true,
  detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe']
});
let output = '', closed = false;
child.on('close', () => { closed = true; });
child.stdout.on('data', data => { output = (output + data).slice(-65536); });
child.stderr.on('data', data => { output = (output + data).slice(-65536); });
const report = { schema: 'ocv.portability.serve/1', checkedAt: new Date().toISOString(),
  prebuiltOutput: true, freshInstall: false, dockerUsed: false,
  emptyRuntimeConfiguration: true, dependencyRootOverrideRemoved: true,
  toolSource: 'installed package manager resolved before the empty-config test',
  ports, checks: [], log: path.join(temporary, 'serve.log'), passed: false };
const base = `http://127.0.0.1:${ports[0]}`;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(route, options = {}) {
  return fetch(base + route, { ...options, signal: AbortSignal.timeout(3000) });
}
try {
  const deadline = Date.now() + 45000;
  let ready = false;
  while (Date.now() < deadline && !closed) {
    try { const response = await request('/health/live'); ready = response.ok; await response.arrayBuffer(); } catch {}
    if (ready) break;
    await pause(250);
  }
  assert.ok(ready, 'gateway did not become ready within 45 seconds');
  for (const route of ['/', '/signals/', '/workshop/', '/health/live', '/api/ping.php', '/studio/']) {
    let response;
    for (let attempt = 0; attempt < 12; attempt++) {
      response = await request(route);
      if (response.status === 200) break;
      await response.arrayBuffer(); await pause(250);
    }
    assert.equal(response.status, 200, route);
    const body = await response.arrayBuffer(); assert.ok(body.byteLength > 0, route);
    report.checks.push({ route, status: response.status, bytes: body.byteLength });
  }
  const manifest = JSON.parse(await readFile(path.join(projectRoot, 'config/apps/portal/public/workshop/manifest.json'), 'utf8'));
  assert.ok(manifest);
  const wasm = await request('/workshop/engines/mechanics.wasm', { headers: { Range: 'bytes=0-7' } });
  assert.equal(wasm.status, 206); assert.equal(wasm.headers.get('content-type'), 'application/wasm');
  assert.deepEqual([...new Uint8Array(await wasm.arrayBuffer())], [0, 97, 115, 109, 1, 0, 0, 0]);
  report.checks.push({ route: '/workshop/engines/mechanics.wasm', status: 206, wasmHeader: true });
  const head = await request('/workshop/', { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal((await head.arrayBuffer()).byteLength, 0);
  report.checks.push({ route: '/workshop/', method: 'HEAD', status: 200 });
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  if (!closed && child.pid) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 10000 });
    else { try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill(); } }
    for (let attempt = 0; attempt < 30 && !closed; attempt++) await pause(100);
  }
  report.ownedProcessStopped = closed;
  if (!closed) { report.passed = false; process.exitCode = 1; }
  await writeFile(report.log, output);
  const destination = path.join(reportRoot, 'portability-serve.json');
  try { await rename(destination, destination.replace('.json', '-' + Date.now() + '.json')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await writeFile(destination, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
