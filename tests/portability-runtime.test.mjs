import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { projectRoot, resolveRuntimePaths, resolveRuntimeTool, packageManagerCommand, resolveRunnerConcurrency } from '../scripts/runtime-paths.mjs';

async function fixture(fn) {
  const repository = await mkdtemp(path.join(tmpdir(), 'ocv-portability-'));
  try { await mkdir(path.join(repository, 'config')); await fn(repository); }
  finally { await rm(repository, { recursive: true, force: true }); }
}

test('a fresh clone needs no author environment, tools or local configuration', () => fixture(async repository => {
  const options = { repository, environment: {} }, resolved = resolveRuntimePaths(options);
  assert.equal(resolved.depsRoot, path.join(repository, '.ocv-runtime'));
  assert.equal(resolved.runnerRoot, path.join(repository, '.ocv-runtime/runtime/after-runner'));
  assert.equal(resolveRuntimeTool('docker', options), 'docker');
  assert.equal(resolveRuntimeTool('pnpm', options), 'pnpm');
  assert.equal(resolveRuntimeTool('node', options), process.execPath);
  assert.deepEqual(packageManagerCommand(['--version'], options).args, ['--version']);
}));

test('private relative paths resolve from the clone and explicit environment overrides win', () => fixture(async repository => {
  await writeFile(path.join(repository, 'config/runtime.local.json'), JSON.stringify({ depsRoot: '../personal-cache', tools: { docker: 'toolbox/docker', pnpm: 'toolbox/pnpm.cjs' } }));
  const options = { repository, environment: {} };
  assert.equal(resolveRuntimePaths(options).depsRoot, path.resolve(repository, '../personal-cache'));
  assert.equal(resolveRuntimeTool('docker', options), path.join(repository, 'toolbox/docker'));
  assert.deepEqual(packageManagerCommand(['build'], options).args, [path.join(repository, 'toolbox/pnpm.cjs'), 'build']);
  const environment = { OCV_DEPS_ROOT: 'override-cache', OCV_DOCKER_CLI: 'alternate-docker' };
  assert.equal(resolveRuntimePaths({ repository, environment }).depsRoot, path.join(repository, 'override-cache'));
  assert.equal(resolveRuntimeTool('docker', { repository, environment }), 'alternate-docker');
}));

test('an explicitly chosen missing or malformed configuration fails clearly', () => fixture(async repository => {
  assert.throws(() => resolveRuntimePaths({ repository, environment: { OCV_RUNTIME_CONFIG: 'missing.json' } }), /Cannot read optional runtime configuration/);
  await writeFile(path.join(repository, 'config/runtime.local.json'), '[]');
  assert.throws(() => resolveRuntimePaths({ repository, environment: {} }), /Expected a JSON object/);
}));

test('public dispatch follows the tier while optional limits remain independent of storage policy', () => {
  const publicOptions = { environment: {}, config: {} };
  assert.deepEqual(resolveRunnerConcurrency(128, publicOptions), { limit: 128, concurrency: 128 });
  assert.equal(resolveRunnerConcurrency(32, publicOptions).concurrency, 32);
  assert.equal(resolveRunnerConcurrency(128, { environment: { OCV_LOCAL_STORAGE_GUARD: '1' }, config: { storageGuard: true } }).concurrency, 128);
  assert.equal(resolveRunnerConcurrency(128, { environment: {}, config: { runnerMaxConcurrency: 1 } }).concurrency, 1);
  assert.equal(resolveRunnerConcurrency(128, { environment: { OCV_RUNNER_MAX_CONCURRENCY: '8' }, config: { runnerMaxConcurrency: 1 } }).concurrency, 8);
  assert.equal(resolveRunnerConcurrency(4, { environment: { OCV_RUNNER_MAX_CONCURRENCY: '8' }, config: {} }).concurrency, 4);
  for (const value of ['oops', '-1', '0', '1.5']) assert.equal(resolveRunnerConcurrency(128, { environment: { OCV_RUNNER_MAX_CONCURRENCY: value }, config: {} }).concurrency, 128);
});

test('the opt-in cache boundary rejects sibling-prefix paths instead of assuming a disk letter', () => fixture(async repository => {
  const config = path.join(repository, 'config/runtime.local.json');
  await writeFile(config, '{}');
  const deps = path.join(repository, 'cache');
  const environment = { ...process.env, OCV_RUNTIME_CONFIG: config, OCV_DEPS_ROOT: deps, OCV_LOCAL_STORAGE_GUARD: '1' };
  for (const key of ['OCV_STORE_DIR', 'OCV_VIRTUAL_STORE_DIR', 'npm_config_cache', 'TEMP', 'TMP']) environment[key] = path.join(deps, key);
  const execute = () => spawnSync(process.execPath, ['--max-old-space-size=64', 'scripts/guard-local-paths.mjs'], { cwd: projectRoot, env: environment, encoding: 'utf8', timeout: 10000, windowsHide: true });
  const accepted = execute(); assert.equal(accepted.status, 0, accepted.stderr);
  environment.TEMP = path.join(repository, 'cache-other/tmp');
  const rejected = execute(); assert.notEqual(rejected.status, 0); assert.match(rejected.stderr, /TEMP must be inside the configured dependency root/);
}));
