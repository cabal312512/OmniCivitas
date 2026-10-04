#!/usr/bin/env node
/** Portable, dependency-free Stage III source reconstruction. Historical raw
 * studies are never copied into the fresh experiment's input directories. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const STAGE = path.resolve(path.dirname(SELF), '..');
const ROOT = path.resolve(STAGE, '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
const scientificHash = value => hash(JSON.stringify(stable(value)));
const json = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));
function write(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}
function assert(condition, message) { if (!condition) throw new Error(message); }
const slash = filename => filename.replaceAll('\\', '/');

const ENTRY_POINTS = ['stage3/scripts/reproduce.mjs',
  ...['classify-controllers', 'run-experiment', 'select-middle', 'lock-confirmation', 'analyze-confirmation', 'rare-event-study'].map(name => `stage3/scripts/${name}.mjs`),
  'stage3/src/exact.mjs', 'stage3/src/phase-type.mjs', 'stage3/results/evidence/read-only-statistical-audit.mjs'];

/** Static import closure of these fixed .mjs sources; no npm packages needed. */
function sourceFiles() {
  const found = new Set(), queue = [...ENTRY_POINTS];
  while (queue.length) {
    const relative = slash(queue.pop());
    if (found.has(relative)) continue;
    const filename = path.resolve(ROOT, relative);
    assert(filename.startsWith(ROOT + path.sep), 'Source dependency escapes the research tree');
    assert(fs.statSync(filename).isFile(), 'Source dependency is not a regular file');
    found.add(relative);
    const source = fs.readFileSync(filename, 'utf8'), imports = [];
    for (const match of source.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:[^;]*?\s+from\s*)?['"]([^'"]+)['"]/g)) imports.push(match[1]);
    for (const match of source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) imports.push(match[1]);
    for (const specifier of imports) {
      if (specifier.startsWith('node:')) continue;
      assert(specifier.startsWith('.'), 'External dependency found: ' + specifier);
      const child = path.resolve(path.dirname(filename), specifier);
      const childRelative = slash(path.relative(ROOT, child));
      assert(!childRelative.startsWith('../') && !path.isAbsolute(childRelative), 'Source import escapes the research tree');
      queue.push(childRelative);
    }
  }
  return [...found, 'stage3/experiments/search-protocol.json', 'stage3/results/evidence/quick-reference.json'].sort();
}

async function quickWorker() {
  const fixtureFile = path.join(STAGE, 'results/evidence/quick-reference.json'), fixture = json(fixtureFile);
  const output = path.join(STAGE, 'results/evidence/quick');
  assert(!fs.existsSync(output), 'Worker output already exists');
  fs.mkdirSync(output, { recursive: true });
  const classification = [];
  for (const expected of fixture.catalogues) {
    const stem = path.join(STAGE, 'data/classification', expected.stem), catalog = json(stem + '.json');
    const actual = { stem: expected.stem, scientificSha256: scientificHash(catalog), rawSha256: hash(fs.readFileSync(stem + '.json')),
      mappingSha256: hash(fs.readFileSync(stem + '.labelled-to-class.u32le')), labelledCount: catalog.labelledCount,
      classCount: catalog.classCount, liveClassCount: catalog.universalLiveClassCount };
    for (const field of Object.keys(actual)) assert(actual[field] === expected[field], 'Classification mismatch: ' + expected.stem + '/' + field);
    classification.push(actual);
  }
  const structural = json(path.join(STAGE, 'data/classification/summary.json'));
  assert(structural.temporalInclusionVerified && structural.catalogues.length === 8, 'Structural generator cross-checks did not complete');

  const { loadControllers, FIELDS } = await import('./run-experiment.mjs');
  const { simulateFinite } = await import('../src/simulate.mjs');
  const { csvText } = await import('../../analysis/summarize.mjs');
  assert(JSON.stringify(FIELDS) === JSON.stringify(fixture.fields), 'Raw fields changed');
  const controllers = loadControllers(), replayed = [], replayChecks = [];
  for (const reference of fixture.records) {
    const values = reference.values, controller = controllers.get(values.controller);
    assert(controller, 'Representative controller absent from regenerated catalogue');
    const seed = Number(values.seed);
    const r = simulateFinite({ L: Number(values.L), k: Number(values.k), boundary: values.boundary, seed, controller, engine: 'event' });
    const row = { ...r, seed, experiment: values.experiment, kind: controller.kind, memory_states: controller.minimalStateCount,
      attempts_per_particle: r.attempts / r.particles };
    const record = csvText([row], FIELDS).split('\n')[1];
    assert(record === reference.csvRecord, `Scientific CSV replay differs: ${values.experiment}/${values.controller}/${seed}`);
    replayed.push(row);
    replayChecks.push({ experiment: values.experiment, controller: values.controller, L: Number(values.L), k: Number(values.k),
      boundary: values.boundary, seed, role: reference.role, scientificSha256: hash(record), matchedAllFields: true });
  }
  fs.writeFileSync(path.join(output, 'replayed-representatives.csv'), csvText(replayed, FIELDS), { flag: 'wx' });
  write(path.join(output, 'replay-checks.json'), replayChecks);

  const { exactFinite } = await import('../src/exact.mjs');
  const exact = [];
  for (const reference of fixture.exact) {
    const result = exactFinite({ L: reference.L, k: reference.k, boundary: reference.boundary, controller: controllers.get(reference.controller) });
    const digest = scientificHash(result);
    assert(digest === reference.scientificSha256, `Exact scientific result differs: ${reference.controller}/${reference.boundary}`);
    const filename = `exact-L${reference.L}-k${reference.k}-${reference.boundary}-${reference.controller}.json`;
    write(path.join(output, filename), result);
    exact.push({ controller: reference.controller, L: reference.L, k: reference.k, boundary: reference.boundary,
      scientificSha256: digest, metrics: result.metrics, diagnostics: result.diagnostics, matchedFullTerminalLawAndRewards: true });
  }

  const { phaseTypeAt, rareEntryKernel, persistentExplorationKernel, consecutiveExplorationKernel } = await import('../src/phase-type.mjs');
  const { Fraction } = await import('../../src/exact.mjs');
  const theoryData = json(path.join(STAGE, 'data/theory/phase-type.json'));
  const theory = fixture.theory.map(reference => {
    const model = theoryData.models.find(item => item.name === reference.name);
    assert(model && scientificHash(model) === reference.scientificSha256, 'Singular-model result differs: ' + reference.name);
    return { name: reference.name, scientificSha256: reference.scientificSha256, exactKernelForestEndpointValuesMatched: true };
  });
  assert(theoryData.models.length === fixture.theory.length, 'Theory model count changed');
  const one = new Fraction(1n), two = new Fraction(2n), ten = new Fraction(10n);
  const formulaChecks = [];
  function compareMoment(name, actual, expected) {
    assert(actual.numerator === expected.n.toString() && actual.denominator === expected.d.toString(), 'Independent rational moment formula differs: ' + name);
    formulaChecks.push({ name, expected: expected.toJSON(), actual });
  }
  const persistent = phaseTypeAt({ kernel: persistentExplorationKernel(2), epsilon: '1/10', maxOrder: 2 });
  compareMoment('persistent-two-step mean = 2/epsilon+2', persistent.moments[0], two.mul(ten).add(two));
  for (const r of [1, 2, 3]) {
    const actual = phaseTypeAt({ kernel: consecutiveExplorationKernel(r), epsilon: '1/10', maxOrder: 2 });
    let expected = two;
    for (let i = 1; i <= r; i++) expected = expected.add(new Fraction(10n ** BigInt(i)));
    compareMoment(`reset-${r}-step mean = 2+sum epsilon^-i`, actual.moments[0], expected);
  }
  for (const { s, r } of [{ s: 1, r: 1 }, { s: 2, r: 2 }, { s: 3, r: 2 }, { s: 1, r: 2 }, { s: 3, r: 3 }]) {
    const actual = phaseTypeAt({ kernel: rareEntryKernel({ entryPower: s, escapePower: r }), epsilon: '1/10', maxOrder: 2 });
    const w = new Fraction(1n, 2n * 10n ** BigInt(s)), p = new Fraction(1n, 10n ** BigInt(r));
    compareMoment(`rare-entry-s${s}-r${r} E[T]=1+w/p`, actual.moments[0], one.add(w.div(p)));
    compareMoment(`rare-entry-s${s}-r${r} E[T^2]=1+2w/p+w(2-p)/p^2`, actual.moments[1], one.add(two.mul(w).div(p)).add(w.mul(two.sub(p)).div(p.mul(p))));
  }
  write(path.join(output, 'theory-formula-checks.json'), formulaChecks);
  const result = { schemaVersion: 1, status: 'passed', finishedAtUTC: new Date().toISOString(),
    referenceFixtureSha256: hash(fs.readFileSync(fixtureFile)), classification,
    classificationCrossChecks: 'All labelled encodings; independent accessible rooted-graph enumeration; combinatorial recurrence; temporal sequence formula and quotient inclusion, in the frozen classification generator.',
    replayedRows: replayChecks.length, replayFields: FIELDS.length, replayByExperiment: Object.fromEntries(['coarse', 'middle', 'confirmation'].map(name => [name, replayChecks.filter(item => item.experiment === name).length])),
    exactCases: exact.length, exact, singularModels: theory.length, theory, independentRationalFormulaChecks: formulaChecks.length,
    scope: 'Source-only fresh execution plus a small, disclosed regression-reference fixture. This is not a full study rerun or a new independent inferential sample.' };
  write(path.join(STAGE, 'results/evidence/quick-checks.json'), result);
  console.log(JSON.stringify({ status: result.status, catalogues: classification.length, replayedRows: result.replayedRows,
    exactCases: exact.length, singularModels: theory.length, independentRationalFormulaChecks: formulaChecks.length }));
  return result;
}

function parseArgs(args) {
  const options = { profile: 'quick' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help') return { help: true };
    assert(['--profile', '--workdir', '--report'].includes(args[i]), 'Unknown option: ' + args[i]);
    assert(args[i + 1] && !args[i + 1].startsWith('--'), args[i] + ' needs a value');
    const key = args[i].slice(2);
    assert(!Object.hasOwn(options, key) || key === 'profile' && options.profile === 'quick', 'Duplicate option: ' + args[i]);
    options[key] = args[++i];
  }
  assert(['quick', 'full'].includes(options.profile), '--profile must be quick or full');
  return options;
}

function contained(child, parent) {
  const relative = path.relative(parent, child);
  return !relative || !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative);
}

export async function reproduce(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.help) {
    console.log('node stage3/scripts/reproduce.mjs [--profile quick|full] --workdir NEW_DIRECTORY [--report NEW_JSON_FILE]\n'
      + 'Defaults: quick; a new directory below OCV_RESEARCH_WORK_ROOT or OCV_DEPS_ROOT/tmp. No system-temp fallback.\n'
      + 'full explicitly reruns classification, all pilot/holdout experiment workflows, frozen analysis and rare-event diagnostics.');
    return;
  }
  assert(Number(process.versions.node.split('.')[0]) >= 22, 'Node 22 or newer is required');
  const defaultBase = process.env.OCV_RESEARCH_WORK_ROOT ?? (process.env.OCV_DEPS_ROOT ? path.join(process.env.OCV_DEPS_ROOT, 'tmp', 'rsa-stage3') : null);
  assert(options.workdir || defaultBase, 'Choose --workdir NEW_DIRECTORY or set OCV_RESEARCH_WORK_ROOT; no system-temp fallback is used');
  const workdir = path.resolve(options.workdir ?? path.join(defaultBase, 'reconstruct-' + randomUUID()));
  assert(!fs.existsSync(workdir), 'Refusing any existing work directory: ' + workdir);
  assert(!contained(workdir, ROOT) && !contained(ROOT, workdir), 'Work directory must be separate from the source research tree');
  const report = options.report ? path.resolve(options.report) : null;
  if (report) assert(!fs.existsSync(report), 'Refusing to overwrite an existing report: ' + report);
  const began = performance.now(), startedAtUTC = new Date().toISOString(), files = sourceFiles();
  const fixture = json(path.join(STAGE, 'results/evidence/quick-reference.json'));
  for (const [relative, expected] of Object.entries(fixture.sourceSha256)) assert(hash(fs.readFileSync(path.join(ROOT, relative))) === expected, 'Frozen/reference source changed: ' + relative);
  fs.mkdirSync(path.dirname(workdir), { recursive: true });
  fs.mkdirSync(workdir);
  const clone = path.join(workdir, 'source'), logs = path.join(workdir, 'logs'), evidence = path.join(workdir, 'evidence');
  fs.mkdirSync(clone); fs.mkdirSync(logs); fs.mkdirSync(evidence);
  const manifest = { schemaVersion: 1, profile: options.profile, status: 'running', startedAtUTC,
    runtime: { node: process.version, platform: process.platform, architecture: process.arch },
    localExecutionDirectory: slash(workdir), sourceOnly: true, copiedFiles: [], commands: [],
    copiedResearchData: 'Only quick-reference.json: 78 disclosed Stage III regression rows plus expected catalogue/exact/theory hashes. No archived full raw data, study results, plans or sealed lock copied as fresh inputs.',
    scope: options.profile === 'quick' ? 'Full deterministic classification, representative row replays, eight small exact cases, nine singular models.'
      : 'New coarse and middle pilot runs, a newly sealed equivalent lock before new holdout, frozen primary analysis with independent validation, rare-entry diagnostic and quick proof subset. No old Stage I/II studies or website are run.' };
  const run = async (name, arguments_) => {
    const stdout = path.join(logs, name + '.stdout.log'), stderr = path.join(logs, name + '.stderr.log');
    const out = fs.openSync(stdout, 'wx'), err = fs.openSync(stderr, 'wx'), start = new Date().toISOString(), t = performance.now();
    let code;
    try {
      code = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, arguments_, { cwd: clone, env: { ...process.env }, stdio: ['ignore', out, err], windowsHide: true });
        child.once('error', reject); child.once('exit', (code, signal) => signal ? reject(new Error('Child killed by ' + signal)) : resolve(code));
      });
    } finally { fs.closeSync(out); fs.closeSync(err); }
    manifest.commands.push({ name, nodeArguments: arguments_, startedAtUTC: start, finishedAtUTC: new Date().toISOString(),
      elapsedSeconds: (performance.now() - t) / 1000, exitCode: code, stdout: slash(path.relative(workdir, stdout)), stderr: slash(path.relative(workdir, stderr)),
      stdoutSha256: hash(fs.readFileSync(stdout)), stderrSha256: hash(fs.readFileSync(stderr)) });
    assert(code === 0, `Fresh-source command ${name} failed (exit ${code}); inspect ${stderr}`);
    console.log(JSON.stringify({ completed: name, elapsedSeconds: manifest.commands.at(-1).elapsedSeconds }));
  };
  try {
    for (const relative of files) {
      const original = path.join(ROOT, relative), target = path.join(clone, relative), bytes = fs.readFileSync(original);
      fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes, { flag: 'wx' });
      manifest.copiedFiles.push({ file: relative, bytes: bytes.length, sha256: hash(bytes) });
    }
    for (const relative of Object.keys(fixture.sourceSha256)) assert(manifest.copiedFiles.some(item => item.file === relative), 'Frozen input missing from source-only copy: ' + relative);
    await run('classification', ['stage3/scripts/classify-controllers.mjs']);
    if (options.profile === 'full') {
      await run('coarse-plan', ['stage3/scripts/run-experiment.mjs', 'coarse-plan']);
      await run('coarse', ['stage3/scripts/run-experiment.mjs', 'stage3/experiments/coarse.plan.json']);
      await run('middle-selection', ['stage3/scripts/select-middle.mjs']);
      await run('middle', ['stage3/scripts/run-experiment.mjs', 'stage3/experiments/middle.plan.json']);
      await run('fresh-confirmation-lock', ['stage3/scripts/lock-confirmation.mjs']);
      await run('confirmation', ['stage3/scripts/run-experiment.mjs', 'stage3/experiments/confirmation.lock.json']);
      await run('validation-before-analysis', ['stage3/results/evidence/read-only-statistical-audit.mjs', '--before-analysis']);
      await run('frozen-primary-analysis', ['stage3/scripts/analyze-confirmation.mjs']);
      await run('independent-primary-review', ['stage3/results/evidence/read-only-statistical-audit.mjs']);
      await run('rare-entry-diagnostics', ['stage3/scripts/rare-event-study.mjs']);
      const freshPrimary = json(path.join(clone, 'stage3/results/confirmation-analysis.json'));
      const freshLock = json(path.join(clone, 'stage3/experiments/confirmation.lock.json'));
      const freshHoldout = json(path.join(clone, 'stage3/results/confirmation-groups.json'));
      assert(Date.parse(freshLock.lockedAtUTC) <= Date.parse(freshHoldout.startedAtUTC), 'Fresh lock was not sealed before new holdout');
      for (const dataset of fixture.datasets) assert(hash(fs.readFileSync(path.join(clone, 'stage3', dataset.rawFile))) === dataset.rawSha256, 'Full scientific raw replay differs: ' + dataset.experiment);
      manifest.primary = { fullRawRows: fixture.datasets.reduce((n, d) => n + d.originalRows, 0),
        scientificRawHashesAllMatched: true, newlyLockedAtUTC: freshLock.lockedAtUTC, newHoldoutStartedAtUTC: freshHoldout.startedAtUTC,
        lockBeforeHoldout: true, tests: freshPrimary.tests.length, rejections: freshPrimary.rejections, marginQualifiedJointPairs: freshPrimary.jointPairs.length,
        oneBitEveryNullGate: freshPrimary.oneBitBenefitEstablished, twoBitEveryNullGate: freshPrimary.twoBitBenefitEstablished };
    }
    await run('singular-models', ['stage3/src/phase-type.mjs']);
    await run('scientific-quick-checks', ['stage3/scripts/reproduce.mjs', '--worker']);
    const checksPath = path.join(clone, 'stage3/results/evidence/quick-checks.json');
    manifest.quick = json(checksPath);
    manifest.quickEvidenceSha256 = hash(fs.readFileSync(checksPath));
    for (const file of manifest.copiedFiles) {
      assert(hash(fs.readFileSync(path.join(ROOT, file.file))) === file.sha256, 'Original source changed during reconstruction: ' + file.file);
      assert(hash(fs.readFileSync(path.join(clone, file.file))) === file.sha256, 'Copied source changed during reconstruction: ' + file.file);
    }
    manifest.copiedSourceHashesUnchanged = true;
    manifest.status = 'passed';
    manifest.fullStudyIndependentlyRerun = options.profile === 'full';
    manifest.limitations = ['Actual runtime and platform are recorded; untested operating systems are not certified by this run.',
      'Quick replay is seeded implementation validation, not new independent statistical evidence or a full study rerun.',
      'Full means all Stage III primary pilot/confirmation workflows and rare-entry diagnostics; only the disclosed eight-case exact subset is solved here. Paper, plots, PDF and exhaustive exact survey are not rebuilt.',
      'The new metadata/degenerate-SE validator is post-holdout validation. It does not change frozen analysis or certify a general-purpose statistics library.'];
  } catch (error) {
    manifest.status = 'failed'; manifest.error = String(error); throw error;
  } finally {
    manifest.finishedAtUTC = new Date().toISOString(); manifest.elapsedSeconds = (performance.now() - began) / 1000;
    write(path.join(evidence, 'reconstruction.json'), manifest);
    if (report) write(report, manifest);
    console.log(JSON.stringify({ status: manifest.status, profile: options.profile, report: slash(report ?? path.join(evidence, 'reconstruction.json')), workdir: slash(workdir) }));
  }
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  if (process.argv.length === 3 && process.argv[2] === '--worker') await quickWorker();
  else await reproduce();
}
