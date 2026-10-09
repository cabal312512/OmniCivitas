import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { publicationFiles } from './publication-files.mjs';
import { resolveRuntimePaths } from './runtime-paths.mjs';

const { projectRoot, reportRoot } = resolveRuntimePaths();
const files = await publicationFiles(projectRoot), available = new Set(files), missing = [];
const manifest = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
for (const [command, text] of Object.entries(manifest.scripts)) {
  for (const target of text.matchAll(/\bscripts\/[\w./-]+\.(?:[cm]?js|ps1)\b/g)) {
    if (!available.has(target[0])) missing.push({ file: 'package.json', command, target: target[0] });
  }
}
let inspected = 0;
for (const file of files) {
  if (!/\.[cm]?js$/.test(file) || /^(?:historical|research|assets)\/|\/public\//.test(file)) continue;
  inspected++;
  const text = await readFile(path.join(projectRoot, file), 'utf8');
  const imports = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)['"](\.[^'"\r\n]+)['"]/g;
  for (const match of text.matchAll(imports)) {
    const literal = match[1].split(/[?#]/)[0];
    if (!/\.(?:[cm]?js|json)$/.test(literal) || literal.includes('\\') || literal.includes('${')) continue;
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), literal));
    if (/\/node_modules\/|\/dist\/|\/\.next\//.test(target)) continue;
    if (!available.has(target)) missing.push({ file, target });
  }
}
const report = { schema: 'ocv.portability.source-closure/1', checkedAt: new Date().toISOString(),
  scope: 'Public package entry scripts and explicit relative JS/JSON source imports; not dynamic imports, bundler aliases or generated output',
  publicFiles: files.length, inspected, missing, passed: missing.length === 0 };
await mkdir(reportRoot, { recursive: true });
await writeFile(path.join(reportRoot, 'portability-source-closure-current.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
if (!report.passed) process.exitCode = 1;
