import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import './guard-paths.mjs';
const directory = path.join(process.env.OCV_DEPS_ROOT, 'downloads');
await mkdir(directory, { recursive: true });
const response = await fetch('https://api.github.com/repos/microsoft/WSL/releases/latest', { headers: { 'User-Agent': 'OmniCivitas-phase1' }, signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`WSL release metadata: ${response.status}`);
const release = await response.json();
const asset = release.assets.find(a => /x64\.msi$/.test(a.name));
if (!asset?.digest?.startsWith('sha256:')) throw new Error('Official WSL asset checksum is missing.');
const downloads = [
  { name: 'nginx-1.30.5.zip', url: 'https://nginx.org/download/nginx-1.30.5.zip', kind: 'portable' },
  { name: asset.name, url: asset.browser_download_url, checksum: asset.digest.split(':')[1], kind: 'administrator-install' },
  { name: 'DockerDesktopInstaller.exe', url: 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe', kind: 'administrator-install' },
];
const manifest = { wslVersion: release.tag_name, files: [] };
for (const item of downloads) {
  const destination = path.join(directory, item.name);
  console.log(`Downloading ${item.name} to F: ...`);
  const result = await fetch(item.url, { signal: AbortSignal.timeout(240000) });
  if (!result.ok || !result.body) throw new Error(`${item.name}: HTTP ${result.status}`);
  await pipeline(Readable.fromWeb(result.body), createWriteStream(destination));
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(destination)) digest.update(chunk);
  const checksum = digest.digest('hex');
  if (item.checksum && checksum !== item.checksum) throw new Error(`${item.name}: official checksum mismatch.`);
  manifest.files.push({ ...item, path: destination, sha256: checksum, officialChecksumMatched: Boolean(item.checksum), authenticode: item.kind === 'administrator-install' ? 'pending-check-before-install' : 'not-applicable' });
  await writeFile(path.join(directory, 'runtime-installers.json'), JSON.stringify(manifest, null, 2));
  console.log(`Ready: ${item.name}; SHA-256 ${checksum}`);
}

