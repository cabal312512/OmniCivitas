import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Optional, ignored machine preferences; an ordinary clone needs none of them.
export function readRuntimeConfiguration({ repository = projectRoot, environment = process.env } = {}) {
  const file = environment.OCV_RUNTIME_CONFIG
    ? path.resolve(repository, environment.OCV_RUNTIME_CONFIG)
    : path.join(repository, 'config', 'runtime.local.json');
  try {
    const config = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Expected a JSON object.');
    return config;
  } catch (error) {
    if (error.code === 'ENOENT' && !environment.OCV_RUNTIME_CONFIG) return {};
    throw new Error(`Cannot read optional runtime configuration ${file}: ${error.message}`);
  }
}

export function resolveRuntimePaths({ repository = projectRoot, environment = process.env } = {}) {
  const config = readRuntimeConfiguration({ repository, environment });
  const depsRoot = path.resolve(repository, environment.OCV_DEPS_ROOT || config.depsRoot || '.ocv-runtime');
  const runtimeRoot = path.join(depsRoot, 'runtime');
  return { projectRoot: repository, depsRoot, runtimeRoot,
    reportRoot: path.join(runtimeRoot, 'reports'), logRoot: path.join(runtimeRoot, 'logs'),
    runnerRoot: path.join(runtimeRoot, 'after-runner'), config };
}

export function resolveRunnerConcurrency(tier, { environment = process.env, config = readRuntimeConfiguration() } = {}) {
  const raw = environment.OCV_RUNNER_MAX_CONCURRENCY || config.runnerMaxConcurrency || 128;
  const value = Number(raw);
  const limit = Number.isSafeInteger(value) && value >= 1 ? Math.min(128, value) : 128;
  return { limit, concurrency: Math.min(tier, limit) };
}

export function resolveRuntimeTool(name, { repository = projectRoot, environment = process.env } = {}) {
  const { depsRoot, config } = resolveRuntimePaths({ repository, environment });
  const overrides = { node: 'OCV_NODE_CLI', pnpm: 'OCV_PNPM_CLI', docker: 'OCV_DOCKER_CLI', nginx: 'OCV_NGINX_CLI', dockerDesktop: 'OCV_DOCKER_DESKTOP' };
  const configured = environment[overrides[name]] || config.tools?.[name];
  if (configured) {
    if (typeof configured !== 'string') throw new Error(`tools.${name} must be a path or command name.`);
    return /[\\/]/.test(configured) ? path.resolve(repository, configured) : configured;
  }
  if (name === 'node') return process.execPath;
  if (name === 'pnpm' && environment.npm_execpath && existsSync(environment.npm_execpath)) return environment.npm_execpath;
  const candidates = {
    node: ['tools/node/node.exe'], pnpm: ['tools/pnpm/bin/pnpm.cjs'],
    docker: ['docker-app/resources/bin/docker.exe'], dockerDesktop: ['docker-app/Docker Desktop.exe'],
    nginx: ['tools/nginx-1.30.5/nginx.exe']
  };
  for (const relative of candidates[name] || []) {
    const file = path.join(depsRoot, relative);
    if (existsSync(file)) return file;
  }
  return name === 'dockerDesktop' ? null : name;
}

export function packageManagerCommand(args, options = {}) {
  const pnpm = resolveRuntimeTool('pnpm', options);
  if (/\.(?:cjs|mjs|js)$/i.test(pnpm)) return { command: process.execPath, args: [pnpm, ...args], shell: false };
  return { command: pnpm, args, shell: process.platform === 'win32' && (/\.(?:cmd|bat)$/i.test(pnpm) || pnpm === 'pnpm') };
}
