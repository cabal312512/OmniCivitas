import { mkdir, writeFile, copyFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const deps = process.env.OCV_DEPS_ROOT;
if (deps !== 'F:\\OCVdeps') throw new Error('Run through scripts/Enter-OcvEnvironment.ps1; no C: fallback is allowed.');
const packages = ['pnpm', 'nx', 'astro', '@nestjs/common', '@nestjs/core', '@nestjs/platform-express', 'reflect-metadata', 'rxjs', 'typescript', 'pg', 'ioredis', '@types/node', '@types/pg', 'yaml', 'vitest'];
const metadata = {};
for (const name of packages) {
  // Pin the maintained pnpm 10 line instead of silently changing package-manager layout.
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}${name === 'pnpm' ? '' : '/latest'}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Registry ${name}: ${response.status}`);
  const result = await response.json();
  const entry = name === 'pnpm'
    ? Object.values(result.versions).filter(v => /^10\.\d+\.\d+$/.test(v.version)).sort((a,b) => {
      const x=a.version.split('.').map(Number), y=b.version.split('.').map(Number);
      return x[1]-y[1] || x[2]-y[2];
    }).at(-1) : result;
  metadata[name] = { version: entry.version, engines: entry.engines, dist: entry.dist };
  console.log(`${name}: ${entry.version}`);
}
await mkdir(path.join(deps, 'tools/node'), { recursive: true });
await copyFile(process.execPath, path.join(deps, 'tools/node/node.exe'));
await writeFile(path.join(deps, 'downloads/package-metadata.json'), JSON.stringify(metadata, null, 2));
await mkdir(path.join(deps, 'tools/pnpm'), { recursive: true });
const pnpmResponse = await fetch(metadata.pnpm.dist.tarball, { signal: AbortSignal.timeout(60000) });
if (!pnpmResponse.ok) throw new Error(`pnpm archive: ${pnpmResponse.status}`);
const archive = Buffer.from(await pnpmResponse.arrayBuffer());
const integrity = `sha512-${createHash('sha512').update(archive).digest('base64')}`;
if (integrity !== metadata.pnpm.dist.integrity) throw new Error('pnpm archive integrity mismatch.');
const archivePath = path.join(deps, 'downloads/pnpm.tgz');
await writeFile(archivePath, archive);
const extracted = spawnSync('tar.exe', ['-xzf', archivePath, '-C', path.join(deps, 'tools/pnpm'), '--strip-components=1'], { stdio: 'inherit' });
if (extracted.status !== 0) throw new Error('pnpm extraction failed.');
console.log(`Portable Node and pnpm are ready in ${deps}. No global installation was used.`);

