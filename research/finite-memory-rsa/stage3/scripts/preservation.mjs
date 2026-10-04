import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const stageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const researchRoot = path.resolve(stageRoot, '..');
export const projectRoot = path.resolve(researchRoot, '../..');
export const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export function verifyPreservation() {
  const groups = [];
  for (const [name, prefix] of [['Stage I', ''], ['Stage II', 'stage2']]) {
    const root = path.join(researchRoot, prefix);
    const manifestPath = path.join(root, 'results/research-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const failures = [];
    for (const [relative, metadata] of Object.entries(manifest.sourceAndArtifactFiles)) {
      const actual = hash(fs.readFileSync(path.join(root, relative)));
      if (actual !== metadata.sha256) failures.push(relative);
    }
    groups.push({ name, files: Object.keys(manifest.sourceAndArtifactFiles).length,
      manifestSha256: hash(fs.readFileSync(manifestPath)), failures });
  }
  const baselinePath = process.env.OCV_WEBSITE_FREEZE ?? (process.env.OCV_DEPS_ROOT
    ? path.join(process.env.OCV_DEPS_ROOT, 'runtime/reports/3d-capital-source-frozen9.json') : null);
  if (baselinePath && fs.existsSync(baselinePath)) {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const failures = [];
    for (const [relative, metadata] of Object.entries(baseline.files)) {
      const expected = typeof metadata === 'string' ? metadata : metadata.sha256;
      if (hash(fs.readFileSync(path.join(projectRoot, relative))) !== expected) failures.push(relative);
    }
    groups.push({ name: 'Website frozen9', files: Object.keys(baseline.files).length,
      manifestSha256: hash(fs.readFileSync(baselinePath)), failures });
  }
  if (groups.some(group => group.failures.length)) throw new Error(JSON.stringify(groups));
  return { verifiedAtUTC: new Date().toISOString(), groups };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyPreservation();
  const output = path.join(stageRoot, 'results/preservation-current.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}
