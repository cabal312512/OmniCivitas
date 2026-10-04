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
  for (const [name, prefix] of [['Stage I', ''], ['Stage II', 'stage2'], ['Stage III', 'stage3']]) {
    const root = path.join(researchRoot, prefix), file = path.join(root, 'results/research-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    const failures = Object.entries(manifest.sourceAndArtifactFiles).flatMap(([relative, expected]) =>
      hash(fs.readFileSync(path.join(root, relative))) === expected.sha256 ? [] : [relative]);
    groups.push({ name, files: Object.keys(manifest.sourceAndArtifactFiles).length,
      manifestSha256: hash(fs.readFileSync(file)), failures });
  }
  const website = process.env.OCV_WEBSITE_FREEZE ?? (process.env.OCV_DEPS_ROOT &&
    path.join(process.env.OCV_DEPS_ROOT, 'runtime/reports/3d-capital-source-frozen9.json'));
  if (website && fs.existsSync(website)) {
    const baseline = JSON.parse(fs.readFileSync(website, 'utf8'));
    const failures = Object.entries(baseline.files).flatMap(([relative, expected]) =>
      hash(fs.readFileSync(path.join(projectRoot, relative))) === (typeof expected === 'string' ? expected : expected.sha256) ? [] : [relative]);
    groups.push({ name: 'Website frozen9', files: Object.keys(baseline.files).length,
      manifestSha256: hash(fs.readFileSync(website)), failures });
  }
  if (groups.some(group => group.failures.length)) throw new Error(JSON.stringify(groups));
  return { verifiedAtUTC: new Date().toISOString(), groups };
}
