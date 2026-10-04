#!/usr/bin/env node
/** Source-only Stage II reconstruction. Stage I modules are imported, never rerun. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const STUDY = path.resolve(path.dirname(SELF), '../..');
const STAGE = path.join(STUDY, 'stage2');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const unix = name => name.split(path.sep).join('/');
const inside = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
};

function stagePath(relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.includes('\\'))
    throw new Error('Plan paths must be relative, slash-separated Stage II paths');
  const target = path.resolve(STAGE, relative);
  if (!inside(STAGE, target)) throw new Error('Plan path escapes Stage II: ' + relative);
  return target;
}

function configuration(relative) {
  const bytes = fs.readFileSync(stagePath(relative));
  const config = JSON.parse(bytes.toString('utf8'));
  if (typeof config.name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(config.name))
    throw new Error('Unsafe or missing experiment name in ' + relative);
  const strata = config.strata ?? config.sizes?.flatMap(L => config.lengths.map(k => ({ L, k })));
  if (!Array.isArray(strata) || !strata.length) throw new Error('No experiment strata in ' + relative);
  const arms = [], blocks = [];
  let runs = 0;
  for (const stratum of strata) {
    const repetitions = stratum.repetitions ?? config.repetitions;
    const seedStart = stratum.seedStart ?? config.seedStart;
    const points = stratum.points ?? config.points;
    if (!Number.isSafeInteger(repetitions) || repetitions < 1 || !Number.isSafeInteger(seedStart)
      || seedStart < 0 || seedStart + repetitions - 1 > 0xffffffff || !Array.isArray(points) || !points.length)
      throw new Error('Invalid repetitions, seed block or points in ' + relative);
    const boundary = stratum.boundary ?? config.boundary ?? 'periodic';
    blocks.push({ L: stratum.L, k: stratum.k, boundary, seedStart, repetitions, arms: points.length });
    for (const point of points) {
      arms.push({ L: stratum.L, k: stratum.k, boundary,
        controller: point.name ?? `a${Number(point.alpha)}-b${Number(point.beta)}`,
        alpha: point.alpha, beta: point.beta, seedStart, repetitions });
      runs += repetitions;
    }
  }
  return { relative, config, arms, seedBlocks: blocks, expectedRuns: runs, sourceSha256: sha256(bytes) };
}

export function fullPlan(relative = 'docs/reproduction-plan.json') {
  const planBytes = fs.readFileSync(stagePath(relative));
  const plan = JSON.parse(planBytes.toString('utf8'));
  for (const field of ['preLockExperiments', 'postLockExperiments', 'pilotExperiments', 'analysisExperiments'])
    if (!Array.isArray(plan[field]) || !plan[field].length || new Set(plan[field]).size !== plan[field].length)
      throw new Error('Missing or repeated plan entries: ' + field);
  stagePath(plan.familySpec); stagePath(plan.writeLock);
  const experimentPaths = [...plan.preLockExperiments, ...plan.postLockExperiments];
  if (new Set(experimentPaths).size !== experimentPaths.length) throw new Error('An experiment occurs on both sides of the lock');
  const experiments = experimentPaths.map(configuration);
  if (new Set(experiments.map(item => item.config.name)).size !== experiments.length)
    throw new Error('Repeated raw output name in reproduction plan');
  const pre = experiments.slice(0, plan.preLockExperiments.length);
  const post = experiments.slice(plan.preLockExperiments.length);
  if (plan.pilotExperiments.some(name => !pre.some(item => item.config.name === name)))
    throw new Error('Every pilot must run before the new lock');
  if (plan.analysisExperiments.some(name => !experiments.some(item => item.config.name === name))
    || plan.pilotExperiments.some(name => !plan.analysisExperiments.includes(name))
    || post.some(item => !plan.analysisExperiments.includes(item.config.name)))
    throw new Error('Main-analysis experiment names disagree with the generated pilot/holdout');
  const specBytes = fs.readFileSync(stagePath(plan.familySpec));
  const spec = JSON.parse(specBytes.toString('utf8'));
  if (!Array.isArray(spec.tests) || !spec.tests.length || !Array.isArray(spec.pilotExperiments)
    || spec.pilotExperiments.length !== plan.pilotExperiments.length
    || spec.pilotExperiments.some(name => !plan.pilotExperiments.includes(name)))
    throw new Error('Reproduction plan and hypothesis specification disagree on pilots');
  for (const test of spec.tests) {
    const experiment = post.find(item => item.config.name === test.experiment);
    if (!experiment) throw new Error('Locked test does not name a post-lock experiment: ' + test.id);
    const seeds = test.seeds?.map(String) ?? (test.seedBlock && Array.from({ length: test.seedBlock.count }, (_, i) => String(test.seedBlock.start + i)));
    if (!seeds?.length || new Set(seeds).size !== seeds.length) throw new Error('Invalid locked seeds: ' + test.id);
    for (const controller of [test.controller, test.baseline]) {
      const arms = experiment.arms.filter(arm => arm.L === test.L && arm.k === test.k
        && arm.boundary === test.boundary && arm.controller === String(controller));
      if (arms.length !== 1 || arms[0].repetitions !== seeds.length
        || seeds.some(seed => !Number.isSafeInteger(Number(seed)) || Number(seed) < arms[0].seedStart
          || Number(seed) >= arms[0].seedStart + arms[0].repetitions || String(Number(seed)) !== seed))
        throw new Error('Post-lock arm/seed block disagrees with test: ' + test.id + '/' + controller);
    }
  }
  if (post.some(item => !spec.tests.some(test => test.experiment === item.config.name)))
    throw new Error('A post-lock experiment has no locked tests');
  return { relative, plan, experiments, familySize: spec.tests.length,
    sourceSha256: Object.fromEntries([[relative, sha256(planBytes)], [plan.familySpec, sha256(specBytes)],
      ...experiments.map(item => [item.relative, item.sourceSha256])]) };
}

function sourceFiles() {
  const found = new Set();
  function dependency(relative) {
    relative = path.normalize(relative);
    if (found.has(relative)) return;
    const absolute = path.resolve(STUDY, relative);
    if (!inside(STUDY, absolute) || !fs.statSync(absolute).isFile()) throw new Error('Invalid source dependency: ' + relative);
    found.add(relative);
    const source = fs.readFileSync(absolute, 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g))
      dependency(path.relative(STUDY, path.resolve(path.dirname(absolute), match[1])));
  }
  for (const relative of ['src/lattice.mjs', 'src/rng.mjs', 'src/exact.mjs', 'analysis/summarize.mjs']) dependency(relative);
  const allowed = /\.(mjs|py|json|md|txt|bib)$/;
  const archivedLock = /(?:^|[-_.])lock(?:[-_.]|$)/i;
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (entry.isFile() && allowed.test(entry.name) && !archivedLock.test(entry.name)) found.add(path.relative(STUDY, target));
    }
  }
  for (const name of ['src', 'analysis', 'scripts', 'tests', 'experiments', 'docs', 'literature']) {
    const directory = path.join(STAGE, name);
    if (fs.existsSync(directory)) walk(directory);
  }
  for (const relative of ['THIRD_PARTY_NOTICES.md', 'stage2/README.md', 'stage2/requirements.txt', 'stage2/requirements-paper.txt'])
    if (fs.existsSync(path.join(STUDY, relative))) found.add(relative);
  return [...found].sort();
}

function verifyRaw(destination, expected) {
  const raw = path.join(destination, 'stage2/data/raw', expected.config.name + '.csv');
  const manifestPath = raw.replace(/\.csv$/, '.manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const histogram = path.resolve(destination, 'stage2', manifest.histograms.raw);
  if (manifest.runs !== expected.expectedRuns || sha256(fs.readFileSync(raw)) !== manifest.sha256
    || !inside(path.join(destination, 'stage2/data/raw'), histogram)
    || sha256(fs.readFileSync(histogram)) !== manifest.histograms.sha256)
    throw new Error('Reconstructed count/raw/histogram manifest mismatch: ' + expected.config.name);
  return { experiment: expected.config.name, rows: manifest.runs, seedBlocks: expected.seedBlocks,
    manifest: unix(path.relative(destination, manifestPath)), sha256: manifest.sha256,
    histogramSha256: manifest.histograms.sha256, startedAt: manifest.startedAt, finishedAt: manifest.finishedAt };
}

export function reproduce({ profile = 'quick', output, plan = 'docs/reproduction-plan.json' } = {}) {
  if (!['quick', 'full'].includes(profile)) throw new Error('Profile must be quick or full');
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 22) throw new Error('Use Node 22 or newer');
  const frozen = profile === 'full' ? fullPlan(plan) : null;
  const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
  const destination = path.resolve(output ?? path.join(os.tmpdir(), 'rsa-stage2-' + profile + '-' + stamp));
  if (inside(STUDY, destination) || inside(destination, STUDY)) throw new Error('Output must be a new directory outside the original research tree');
  if (fs.existsSync(destination)) throw new Error('Refusing existing output: ' + destination);
  fs.mkdirSync(destination, { recursive: true });
  const proofPath = path.join(destination, 'stage2/results/reproduction-proof.json');
  fs.mkdirSync(path.dirname(proofPath), { recursive: true });
  const proof = { schemaVersion: 1, profile, startedAt: new Date().toISOString(), status: 'running',
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    sourceOnly: true, archivedRawCopied: false, archivedLocksCopied: false, packagesInstalled: false,
    stage1SimulationRun: false, testsRun: false, websiteStarted: false, scientificSampleSizeIncremented: false,
    sourceSha256: {}, commands: [], experiments: [],
    limitations: ['Quick is an implementation smoke check, not independent scientific confirmation.',
      'Full reconstructs the frozen seed blocks; replay does not add independent samples.',
      'No Stage I simulation, integrated test suite, optional Python plots/PDFs or rare-excursion diagnostic is run.',
      'Actual cross-platform execution must be recorded separately.'] };
  const save = () => fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2) + '\n');
  function run(args, label) {
    const log = path.join(destination, 'stage2/results', label + '.log');
    const record = { label, args, startedAt: new Date().toISOString(), log: unix(path.relative(destination, log)) };
    proof.commands.push(record); save();
    console.log(JSON.stringify({ starting: label }));
    const descriptor = fs.openSync(log, 'wx');
    let child;
    try { child = spawnSync(process.execPath, args, { cwd: destination, stdio: ['ignore', descriptor, descriptor], env: process.env }); }
    finally { fs.closeSync(descriptor); }
    record.finishedAt = new Date().toISOString(); record.exitCode = child.status;
    if (child.signal) record.signal = child.signal;
    if (child.error) record.error = child.error.message;
    save();
    if (child.error || child.status !== 0) throw new Error(label + ' failed; see ' + log);
    console.log(JSON.stringify({ completed: label, exitCode: child.status }));
  }
  try {
    for (const relative of sourceFiles()) {
      const bytes = fs.readFileSync(path.join(STUDY, relative)), target = path.join(destination, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes, { flag: 'wx' });
      proof.sourceSha256[unix(relative)] = sha256(bytes);
    }
    proof.sourceFiles = Object.keys(proof.sourceSha256).length; save();
    if (frozen) for (const [relative, hash] of Object.entries(frozen.sourceSha256))
      if (proof.sourceSha256['stage2/' + relative] !== hash) throw new Error('Plan/spec/config changed while taking the source snapshot: ' + relative);
    run(['stage2/src/exact-stochastic.mjs'], 'stage2-exact');
    const exact = JSON.parse(fs.readFileSync(path.join(destination, 'stage2/data/processed/exact-small-systems.json'), 'utf8'));
    proof.exact = { cases: exact.cases.length, coreGrid: exact.coreGrid, additionalPairs: exact.additionalValidationPairs,
      sha256: sha256(fs.readFileSync(path.join(destination, 'stage2/data/processed/exact-small-systems.json'))) };
    if (profile === 'quick') {
      const quick = { name: 'quick-pilot', engine: 'event', boundary: 'periodic',
        points: [[0, 0], [0, 1], [1, 0], [1, 1], [.5, .5], [1, .001], [.02, 1], [.85, .5]]
          .map(([alpha, beta]) => ({ alpha, beta })),
        strata: [{ L: 16, k: 4, repetitions: 16, seedStart: 60000001 }] };
      fs.writeFileSync(path.join(destination, 'stage2/experiments/reproduction-quick.json'), JSON.stringify(quick, null, 2) + '\n', { flag: 'wx' });
      run(['stage2/scripts/run-experiment.mjs', 'experiments/reproduction-quick.json'], 'quick-simulation');
      run(['stage2/analysis/summarize.mjs', '--input', 'stage2/data/raw/quick-pilot.csv', '--output', 'stage2/data/processed/quick'], 'quick-analysis');
      proof.experiments.push(verifyRaw(destination, { config: quick, expectedRuns: 128,
        seedBlocks: [{ L: 16, k: 4, boundary: 'periodic', seedStart: 60000001, repetitions: 16, arms: 8 }] }));
      const audit = JSON.parse(fs.readFileSync(path.join(destination, 'stage2/data/processed/quick/audit.json'), 'utf8'));
      if (audit.rows !== 128 || audit.groups !== 8 || audit.errors.length) throw new Error('Quick analysis audit is incomplete');
      proof.analysis = { rows: audit.rows, groups: audit.groups, confirmation: audit.confirmation.status };
    } else {
      proof.plan = { file: frozen.relative, sha256: frozen.sourceSha256[frozen.relative], familySize: frozen.familySize };
      for (const relative of frozen.plan.preLockExperiments) run(['stage2/scripts/run-experiment.mjs', relative], path.basename(relative, '.json'));
      run(['stage2/scripts/validate-exact.mjs'], 'stage2-exact-validation');
      const pilotInputs = frozen.plan.pilotExperiments.flatMap(name => ['--input', 'stage2/data/raw/' + name + '.csv']);
      run(['stage2/analysis/summarize.mjs', ...pilotInputs, '--output', 'stage2/data/processed/pilot',
        '--lock-spec', 'stage2/' + frozen.plan.familySpec, '--write-lock', 'stage2/' + frozen.plan.writeLock,
        '--match-metric', frozen.plan.matchMetric ?? 'accepted_lag1'], 'seal-new-lock');
      const newLockPath = path.join(destination, 'stage2', frozen.plan.writeLock);
      const newLock = JSON.parse(fs.readFileSync(newLockPath, 'utf8'));
      proof.lock = { file: 'stage2/' + frozen.plan.writeLock, sha256: sha256(fs.readFileSync(newLockPath)),
        lockedAtUtc: newLock.lockedAtUtc, familySize: newLock.familySize, independentReconstructionLock: true };
      for (const relative of frozen.plan.postLockExperiments) run(['stage2/scripts/run-experiment.mjs', relative], path.basename(relative, '.json'));
      const analysisInputs = frozen.plan.analysisExperiments.flatMap(name => ['--input', 'stage2/data/raw/' + name + '.csv']);
      run(['stage2/analysis/summarize.mjs', ...analysisInputs, '--output', 'stage2/data/processed',
        '--lock', 'stage2/' + frozen.plan.writeLock, '--match-metric', frozen.plan.matchMetric ?? 'accepted_lag1'], 'full-analysis');
      proof.experiments = frozen.experiments.map(item => verifyRaw(destination, item));
      const postNames = new Set(frozen.experiments.slice(frozen.plan.preLockExperiments.length).map(item => item.config.name));
      for (const item of proof.experiments.filter(item => postNames.has(item.experiment)))
        if (!(newLock.lockedAtUtc <= item.startedAt)) throw new Error('A post-lock experiment started before the new lock');
      const audit = JSON.parse(fs.readFileSync(path.join(destination, 'stage2/data/processed/audit.json'), 'utf8'));
      const expectedAnalysisRows = frozen.experiments.filter(item => frozen.plan.analysisExperiments.includes(item.config.name))
        .reduce((total, item) => total + item.expectedRuns, 0);
      if (audit.errors.length || audit.rows !== expectedAnalysisRows || audit.confirmation.status !== 'complete' || audit.confirmation.familySize !== frozen.familySize)
        throw new Error('Full confirmation audit is incomplete');
      proof.analysis = { rows: audit.rows, groups: audit.groups, confirmation: audit.confirmation.status, familySize: audit.confirmation.familySize };
    }
    proof.status = 'passed'; proof.finishedAt = new Date().toISOString(); save();
    console.log(JSON.stringify({ profile, output: destination, proof: 'stage2/results/reproduction-proof.json', status: proof.status }));
    return proof;
  } catch (error) {
    proof.status = 'failed'; proof.finishedAt = new Date().toISOString(); proof.error = error.message; save(); throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  try {
    const options = {};
    for (let i = 2; i < process.argv.length; i += 2) {
      const name = process.argv[i];
      if (name === '--help') { console.log('node stage2/scripts/reproduce.mjs --profile quick|full [--output NEW-DIRECTORY] [--plan docs/reproduction-plan.json]'); process.exit(0); }
      if (!['--profile', '--output', '--plan'].includes(name) || process.argv[i + 1] === undefined) throw new Error('Expected --profile, --output or --plan with a value');
      options[name.slice(2)] = process.argv[i + 1];
    }
    reproduce(options);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
