/** Extract a small, explicitly labelled regression fixture from sealed Stage III
 * artifacts. This never simulates anything or creates new research evidence. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { FIELDS, loadControllers } from '../../scripts/run-experiment.mjs';

const STAGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ROOT = path.resolve(STAGE, '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
const scientificHash = value => hash(JSON.stringify(stable(value)));
const read = relative => JSON.parse(fs.readFileSync(path.join(STAGE, relative), 'utf8'));
const destination = path.join(STAGE, 'results/evidence/quick-reference.json');
if (fs.existsSync(destination)) throw new Error('Existing fixture is preserved; use a new named version');
const controllers = loadControllers(), datasets = [], records = [];
for (const [experiment, planFile] of [['coarse', 'coarse.plan.json'], ['middle', 'middle.plan.json'], ['confirmation', 'confirmation.lock.json']]) {
  const plan = read('experiments/' + planFile), wanted = new Map();
  const strata = new Map();
  for (const arm of plan.arms) {
    const stratum = [arm.L, arm.k, arm.boundary ?? 'periodic'].join(':');
    if (!strata.has(stratum)) strata.set(stratum, []);
    strata.get(stratum).push(arm);
  }
  for (const arms of strata.values()) {
    const selected = new Map();
    const choose = (predicate, role) => {
      const arm = arms.find(item => predicate(controllers.get(item.controller)));
      if (arm) selected.set(arm.controller, { arm, role });
    };
    for (const n of [2, 3, 4]) choose(c => c.kind === 'feedback' && !c.temporalEquivalent && c.minimalStateCount === n, 'feedback-' + n + '-states');
    choose(c => c.kind === 'temporal' && c.minimalStateCount === 4, 'temporal-4-states');
    choose(c => c.kind === 'iid-reference', 'iid-fair');
    for (const { arm, role } of selected.values()) for (const seed of new Set([arm.seedStart, arm.seedStart + arm.repetitions - 1])) {
      const identity = [experiment, arm.controller, arm.L, arm.k, arm.boundary ?? 'periodic', seed].join('|');
      wanted.set(identity, role);
    }
  }
  const raw = path.join(STAGE, `data/raw/${experiment}.csv`), lines = createInterface({ input: fs.createReadStream(raw), crlfDelay: Infinity });
  let count = 0, header = null;
  for await (const line of lines) {
    if (header === null) { header = line; if (header !== FIELDS.join(',')) throw new Error('Unexpected CSV fields'); continue; }
    if (!line) continue;
    count++;
    const columns = line.split(',');
    if (columns.length !== FIELDS.length) throw new Error('Fixture extractor expects simple, unquoted numeric/identifier rows');
    const values = Object.fromEntries(FIELDS.map((field, index) => [field, columns[index]]));
    const identity = ['experiment', 'controller', 'L', 'k', 'boundary', 'seed'].map(field => values[field]).join('|');
    if (wanted.has(identity)) { records.push({ role: wanted.get(identity), csvRecord: line, values }); wanted.delete(identity); }
  }
  if (wanted.size) throw new Error('Representative rows absent from raw input');
  datasets.push({ experiment, rawFile: `data/raw/${experiment}.csv`, rawSha256: hash(fs.readFileSync(raw)), originalRows: count,
    planFile: 'experiments/' + planFile, planSha256: hash(fs.readFileSync(path.join(STAGE, 'experiments', planFile))) });
}
const catalogues = [];
for (const kind of ['feedback', 'temporal']) for (const states of [1, 2, 3, 4]) {
  const stem = `${kind}-${states}`, catalog = read(`data/classification/${stem}.json`);
  catalogues.push({ stem, scientificSha256: scientificHash(catalog), rawSha256: hash(fs.readFileSync(path.join(STAGE, `data/classification/${stem}.json`))),
    mappingSha256: hash(fs.readFileSync(path.join(STAGE, `data/classification/${stem}.labelled-to-class.u32le`))),
    labelledCount: catalog.labelledCount, classCount: catalog.classCount, liveClassCount: catalog.universalLiveClassCount });
}
const exact = [];
for (const controller of ['iid-fair', 'temporal-4-00023', 'feedback-4-00006', 'feedback-4-23071']) for (const boundary of ['open', 'periodic']) {
  const referenceFile = `data/exact/L3-k2-${boundary}-${controller}.json`, reference = read(referenceFile);
  exact.push({ L: 3, k: 2, controller, boundary, referenceFile, scientificSha256: scientificHash(reference.result),
    metrics: reference.result.metrics, diagnostics: reference.result.diagnostics });
}
const theory = read('data/theory/phase-type.json').models.map(model => ({ name: model.name, scientificSha256: scientificHash(model) }));
const upstreamFiles = ['src/lattice.mjs', 'src/rng.mjs', 'src/controllers.mjs', 'src/exact.mjs', 'analysis/summarize.mjs', 'stage2/src/stochastic.mjs',
  ...['simulate', 'controllers', 'exact', 'phase-type', 'frontier', 'convex-frontier'].map(name => `stage3/src/${name}.mjs`),
  ...['classify-controllers', 'run-experiment', 'select-middle', 'lock-confirmation', 'analyze-confirmation', 'rare-event-study', 'preservation'].map(name => `stage3/scripts/${name}.mjs`),
  'stage3/experiments/search-protocol.json'];
const fixture = { schemaVersion: 1, extractedAtUTC: new Date().toISOString(),
  purpose: 'Small Stage III regression reference, copied observations and expected hashes, not a new experiment or independent data sample.',
  scientificHash: 'SHA256 of recursively key-sorted JSON; array order retained. Entire catalogue/model/result payload included; generation metadata outside those payloads excluded.',
  sourceSha256: Object.fromEntries(upstreamFiles.map(relative => [relative, hash(fs.readFileSync(path.join(ROOT, relative)))])),
  fields: FIELDS, datasets, catalogues, records, exact, theory,
  limitations: ['Selected raw rows are only an implementation regression check, not a full independent study rerun.',
    'The archived lock is provenance only. Full reproduction must generate new pilots and seal a new lock before any holdout.'] };
fs.writeFileSync(destination, JSON.stringify(fixture, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ destination, records: records.length, catalogues: catalogues.length, exact: exact.length, theory: theory.length, sha256: hash(fs.readFileSync(destination)) }));
