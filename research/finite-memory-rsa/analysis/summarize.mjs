#!/usr/bin/env node
// Dependency-free analysis. Every inference uses independent runs as sampling units.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const METRICS = Object.freeze([
  'coverage', 'order', 'abs_order', 'particles', 'horizontal', 'vertical',
  'attempts', 'failures', 'elapsed_ms', 'legal_h', 'legal_v', 'attempted_h', 'attempted_v',
  'failure_rate', 'attempts_per_particle', 'attempted_h_fraction', 'residual_empty',
]);
const KEYS = ['experiment', 'controller', 'L', 'k', 'boundary'];
const NUMBERS = ['L', 'k', 'particles', 'horizontal', 'vertical', 'coverage', 'order',
  'abs_order', 'deadlock', 'legal_h', 'legal_v', 'attempts', 'failures', 'elapsed_ms',
  'attempted_h', 'attempted_v'];
const REQUIRED = [...KEYS, 'seed', ...NUMBERS.filter(v => !KEYS.includes(v))];
const OPTIONAL_COUNTS = new Set(['attempted_h', 'attempted_v']);
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const key = (row, fields = KEYS) => JSON.stringify(fields.map(field => row[field]));
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

export function parseCSV(text) {
  const records = []; let record = [], field = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') {
      if (field.length) throw new Error('Quote inside unquoted CSV field');
      quoted = true;
    } else if (ch === ',') { record.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      record.push(field); field = '';
      if (record.some(value => value !== '')) records.push(record);
      record = [];
    } else field += ch;
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (field.length || record.length) { record.push(field); records.push(record); }
  if (!records.length) return [];
  const headers = records.shift();
  if (new Set(headers).size !== headers.length) throw new Error('Duplicate CSV headers');
  return records.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`CSV row ${index + 2}: wrong column count`);
    return Object.fromEntries(headers.map((header, j) => [header, values[j]]));
  });
}

export function csvText(rows, fields = rows.length ? Object.keys(rows[0]) : []) {
  const quote = value => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [fields.map(quote).join(','), ...rows.map(row => fields.map(field => quote(row[field])).join(','))].join('\n') + '\n';
}

export function normalizeRows(rows, source = '(memory)') {
  return rows.map((input, index) => {
    const prefix = `${source}:${index + 2}`;
    for (const field of REQUIRED) if (!OPTIONAL_COUNTS.has(field) && (input[field] === undefined || input[field] === '')) throw new Error(`${prefix}: missing ${field}`);
    const row = { ...input, source };
    for (const field of NUMBERS) {
      if (OPTIONAL_COUNTS.has(field) && (input[field] === undefined || input[field] === '')) { row[field] = null; continue; }
      row[field] = field === 'deadlock' && ['true', 'false'].includes(String(input[field]))
        ? Number(input[field] === 'true') : Number(input[field]);
      if (!Number.isFinite(row[field])) throw new Error(`${prefix}: nonfinite ${field}`);
    }
    for (const field of ['L', 'k', 'particles', 'horizontal', 'vertical', 'attempts', 'failures', 'legal_h', 'legal_v', 'attempted_h', 'attempted_v'])
      if (!(OPTIONAL_COUNTS.has(field) && row[field] === null) && (!Number.isInteger(row[field]) || row[field] < 0)) throw new Error(`${prefix}: invalid count ${field}`);
    if (row.L < 1 || row.k < 1 || row.k > row.L || ![0, 1].includes(row.deadlock)) throw new Error(`${prefix}: invalid dimensions/deadlock`);
    if (row.horizontal + row.vertical !== row.particles) throw new Error(`${prefix}: orientation counts do not sum to particles`);
    if (row.attempts - row.failures !== row.particles || (row.attempted_h !== null && row.attempted_v !== null && row.attempted_h + row.attempted_v !== row.attempts))
      throw new Error(`${prefix}: attempt counts inconsistent`);
    if ((row.attempted_h === null) !== (row.attempted_v === null)) throw new Error(`${prefix}: only one attempted orientation count is missing`);
    const theta = row.particles * row.k / (row.L * row.L);
    const order = row.particles ? (row.horizontal - row.vertical) / row.particles : 0;
    if (Math.abs(theta - row.coverage) > 1e-9 || theta > 1 + 1e-9 || Math.abs(order - row.order) > 1e-9 || Math.abs(Math.abs(order) - row.abs_order) > 1e-9)
      throw new Error(`${prefix}: coverage/order inconsistent with counts`);
    if (row.deadlock !== Number(row.legal_h + row.legal_v > 0)) throw new Error(`${prefix}: terminal deadlock flag disagrees with residual legal placements`);
    if (row.elapsed_ms < 0) throw new Error(`${prefix}: negative elapsed time`);
    row.seed = String(input.seed);
    row.failure_rate = row.attempts ? row.failures / row.attempts : 0;
    row.attempts_per_particle = row.particles ? row.attempts / row.particles : null;
    row.attempted_h_fraction = row.attempts && row.attempted_h !== null ? row.attempted_h / row.attempts : null;
    row.residual_empty = 1 - row.coverage;
    return row;
  });
}

// Lanczos log-Gamma plus a continued fraction for the regularized incomplete beta.
// Implemented locally from the defining formulas; no SciPy or copied package code.
export function logGamma(z) {
  const p = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let value = p[0];
  for (let i = 1; i < p.length; i++) value += p[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(value);
}

function betaFraction(a, b, x) {
  const tiny = 1e-300, tolerance = 3e-14;
  const signedTiny = value => Math.abs(value) < tiny ? (value < 0 ? -tiny : tiny) : value;
  let c = 1, d = 1 / signedTiny(1 - (a + b) * x / (a + 1)), h = d;
  for (let m = 1; m <= 500; m++) {
    let factor = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 / signedTiny(1 + factor * d); c = signedTiny(1 + factor / c); h *= d * c;
    factor = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 / signedTiny(1 + factor * d); c = signedTiny(1 + factor / c);
    const delta = d * c; h *= delta;
    if (Math.abs(delta - 1) < tolerance) return h;
  }
  throw new Error('Incomplete-beta continued fraction failed to converge');
}

export function regularizedBeta(x, a, b) {
  if (!(a > 0 && b > 0) || x < 0 || x > 1) throw new Error('Invalid beta arguments');
  if (x === 0 || x === 1) return x;
  const scale = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x));
  return clamp(x < (a + 1) / (a + b + 2)
    ? scale * betaFraction(a, b, x) / a
    : 1 - scale * betaFraction(b, a, 1 - x) / b);
}

export function studentTCDF(t, df) {
  if (!(df > 0)) throw new Error('Student-t requires positive degrees of freedom');
  if (t === Infinity) return 1;
  if (t === -Infinity) return 0;
  if (t === 0) return 0.5;
  const tail = 0.5 * regularizedBeta(df / (df + t * t), df / 2, 0.5);
  return t < 0 ? tail : 1 - tail;
}

export function studentTTwoSidedP(t, df) {
  if (!(df > 0)) throw new Error('Student-t requires positive degrees of freedom');
  // Direct beta tail avoids catastrophic cancellation from 2*(1-CDF(t)).
  return regularizedBeta(df / (df + t * t), df / 2, 0.5);
}

const quantileCache = new Map();
export function studentTQuantile(probability, df) {
  if (!(probability > 0 && probability < 1 && df > 0)) throw new Error('Invalid Student-t quantile');
  if (probability < 0.5) return -studentTQuantile(1 - probability, df);
  if (probability === 0.5) return 0;
  const cacheKey = `${probability}/${df}`;
  if (quantileCache.has(cacheKey)) return quantileCache.get(cacheKey);
  let low = 0, high = 1;
  while (studentTCDF(high, df) < probability) {
    high *= 2;
    if (high > 1e16) throw new Error('Unbounded Student-t quantile');
  }
  for (let i = 0; i < 70; i++) {
    const midpoint = (low + high) / 2;
    if (studentTCDF(midpoint, df) < probability) low = midpoint; else high = midpoint;
  }
  const result = (low + high) / 2; quantileCache.set(cacheKey, result); return result;
}

export function descriptive(values, alpha = 0.05) {
  const data = values.filter(value => value !== null && Number.isFinite(value));
  const n = data.length;
  if (!n) return { n: 0, mean: null, sd: null, se: null, ciLow: null, ciHigh: null, min: null, max: null };
  let mean = 0, m2 = 0, count = 0;
  for (const value of data) { count++; const delta = value - mean; mean += delta / count; m2 += delta * (value - mean); }
  const sd = n > 1 ? Math.sqrt(Math.max(0, m2 / (n - 1))) : null;
  const se = n > 1 ? sd / Math.sqrt(n) : null;
  const half = n > 1 ? studentTQuantile(1 - alpha / 2, n - 1) * se : null;
  return { n, mean, sd, se, ciLow: half === null ? null : mean - half, ciHigh: half === null ? null : mean + half,
    min: Math.min(...data), max: Math.max(...data) };
}

export function wilson(successes, n, z = 1.959963984540054) {
  if (!Number.isInteger(n) || !Number.isInteger(successes) || n < 0 || successes < 0 || successes > n) throw new Error('Invalid binomial counts');
  if (!n) return { count: 0, n: 0, rate: null, ciLow: null, ciHigh: null };
  const rate = successes / n, z2 = z * z, denominator = 1 + z2 / n;
  const center = (rate + z2 / (2 * n)) / denominator;
  const half = z * Math.sqrt(rate * (1 - rate) / n + z2 / (4 * n * n)) / denominator;
  return { count: successes, n, rate, ciLow: clamp(center - half), ciHigh: clamp(center + half) };
}

export function holm(pValues) {
  const ordered = pValues.map((p, index) => ({ p: p === null ? 1 : p, index })).sort((a, b) => a.p - b.p || a.index - b.index);
  if (ordered.some(({ p }) => !Number.isFinite(p) || p < 0 || p > 1)) throw new Error('Invalid p-value');
  const adjusted = Array(pValues.length); let previous = 0;
  for (let rank = 0; rank < ordered.length; rank++) {
    previous = Math.max(previous, Math.min(1, ordered[rank].p * (ordered.length - rank)));
    adjusted[ordered[rank].index] = previous;
  }
  return adjusted;
}

export function exactMcNemar(onlyA, onlyB) {
  if (![onlyA, onlyB].every(v => Number.isInteger(v) && v >= 0)) throw new Error('Invalid discordant counts');
  const n = onlyA + onlyB, tail = Math.min(onlyA, onlyB);
  if (!n) return 1;
  if (tail >= n / 2) return 1;
  let probability = 0;
  for (let i = 0; i <= tail; i++) probability += Math.exp(logGamma(n + 1) - logGamma(i + 1) - logGamma(n - i + 1) - n * Math.LN2);
  return clamp(2 * probability);
}

export function pairedEffect(first, second, metric, familySize = 1, alpha = 0.05) {
  const a = new Map(first.map(row => [row.seed, row]));
  const b = new Map(second.map(row => [row.seed, row]));
  const seeds = [...a.keys()].filter(seed => b.has(seed)).sort();
  const differences = seeds.map(seed => a.get(seed)[metric] - b.get(seed)[metric]);
  const stats = descriptive(differences, alpha);
  const onlyA = metric === 'deadlock' ? seeds.filter(seed => a.get(seed).deadlock === 1 && b.get(seed).deadlock === 0).length : null;
  const onlyB = metric === 'deadlock' ? seeds.filter(seed => a.get(seed).deadlock === 0 && b.get(seed).deadlock === 1).length : null;
  let p = null, method = 'paired Student-t, two-sided';
  if (metric === 'deadlock') { p = exactMcNemar(onlyA, onlyB); method = 'conditional exact McNemar, two-sided'; }
  else if (stats.n >= 2 && stats.se > 0) p = studentTTwoSidedP(stats.mean / stats.se, stats.n - 1);
  else if (stats.n >= 2 && stats.mean === 0) p = 1;
  const simultaneousHalf = stats.n >= 2 ? studentTQuantile(1 - alpha / (2 * familySize), stats.n - 1) * stats.se : null;
  return { ...stats, missingA: [...b.keys()].filter(seed => !a.has(seed)).length,
    missingB: [...a.keys()].filter(seed => !b.has(seed)).length, method, pRaw: p,
    simultaneousCiLow: simultaneousHalf === null ? null : stats.mean - simultaneousHalf,
    simultaneousCiHigh: simultaneousHalf === null ? null : stats.mean + simultaneousHalf,
    onlyA, onlyB, degenerateNonzeroDifference: stats.n >= 2 && stats.se === 0 && stats.mean !== 0 };
}

export function summarizeRows(rows) {
  const groups = new Map();
  for (const row of rows) { const id = key(row); if (!groups.has(id)) groups.set(id, []); groups.get(id).push(row); }
  return [...groups.values()].map(group => {
    const result = Object.fromEntries(KEYS.map(field => [field, group[0][field]]));
    result.n = group.length;
    result.metrics = Object.fromEntries(METRICS.map(metric => [metric, descriptive(group.map(row => row[metric]))]));
    result.deadlock = wilson(group.reduce((count, row) => count + row.deadlock, 0), group.length);
    result.geometricJammingCount = group.length - result.deadlock.count;
    result.observedIsotropic = result.metrics.abs_order.mean <= 0.1;
    result.pointwiseIsotropyUpper95 = group.length > 1
      ? result.metrics.abs_order.mean + studentTQuantile(0.95, group.length - 1) * result.metrics.abs_order.se : null;
    result.cancellationWarning = Math.abs(result.metrics.order.mean) <= 0.1 && result.metrics.abs_order.mean > 0.1;
    return result;
  }).sort((a, b) => key(a).localeCompare(key(b)));
}

function flattenSummary(groups) {
  return groups.map(group => {
    const row = Object.fromEntries(KEYS.map(field => [field, group[field]])); row.n = group.n;
    for (const metric of METRICS) for (const field of ['n', 'mean', 'sd', 'se', 'ciLow', 'ciHigh', 'min', 'max']) row[`${metric}_${field}`] = group.metrics[metric][field];
    for (const field of ['count', 'rate', 'ciLow', 'ciHigh']) row[`deadlock_${field}`] = group.deadlock[field];
    row.geometric_jamming_count = group.geometricJammingCount;
    row.observed_isotropic = Number(group.observedIsotropic);
    row.pointwise_isotropy_upper95 = group.pointwiseIsotropyUpper95;
    row.cancellation_warning = Number(group.cancellationWarning);
    return row;
  });
}

export function paretoRows(groups) {
  const strata = new Map();
  for (const group of groups) {
    const id = key(group, ['experiment', 'L', 'k', 'boundary']);
    if (!strata.has(id)) strata.set(id, []); strata.get(id).push(group);
  }
  const output = [];
  for (const group of strata.values()) for (const item of group) {
    const theta = item.metrics.coverage.mean, order = item.metrics.abs_order.mean;
    const dominated = group.some(other => other.metrics.coverage.mean >= theta && other.metrics.abs_order.mean <= order
      && (other.metrics.coverage.mean > theta + 1e-12 || other.metrics.abs_order.mean < order - 1e-12));
    output.push({ ...Object.fromEntries(KEYS.map(field => [field, item[field]])), n: item.n,
      coverage: theta, abs_order: order, deadlock_rate: item.deadlock.rate,
      on_sample_pareto_frontier: Number(!dominated), observed_isotropic: Number(order <= 0.1), interpretation: 'descriptive sample frontier, no post-selection inference' });
  }
  return output;
}

export function lockFamily(rows, files, spec) {
  spec = { ...spec, selectedControllers: spec.selectedControllers?.map(String), baselineControllers: spec.baselineControllers?.map(String),
    comparisons: spec.comparisons?.map(item => ({ controller: String(item.controller), baseline: String(item.baseline) })) };
  const required = ['pilotExperiments', 'confirmationExperiments', 'selectedControllers', 'baselineControllers', 'strata', 'expectedRepetitions', 'selectionRule'];
  for (const field of required) if (!spec[field] || (Array.isArray(spec[field]) && !spec[field].length)) throw new Error(`Lock specification requires ${field}`);
  const confirmation = rows.filter(row => spec.confirmationExperiments.includes(row.experiment));
  if (confirmation.length) throw new Error('Cannot preregister after confirmation data have been supplied');
  const pilot = rows.filter(row => spec.pilotExperiments.includes(row.experiment));
  if (!pilot.length) throw new Error('No pilot rows supplied for lock');
  if (new Set(spec.selectedControllers).size !== spec.selectedControllers.length || new Set(spec.baselineControllers).size !== spec.baselineControllers.length) throw new Error('Repeated controller in lock');
  const comparisons = spec.comparisons ?? spec.selectedControllers.flatMap(controller => spec.baselineControllers.map(baseline => ({ controller, baseline })));
  if (!comparisons.length || comparisons.some(item => !spec.selectedControllers.includes(item.controller) || !spec.baselineControllers.includes(item.baseline) || item.controller === item.baseline)) throw new Error('Invalid locked comparisons');
  const sourceHash = sha256(fs.readFileSync(fileURLToPath(import.meta.url)));
  return { schemaVersion: 1, lockedAtUtc: new Date().toISOString(), analysisSourceSha256: sourceHash,
    ...spec, comparisons, alpha: spec.alpha ?? 0.05, isotropyThreshold: spec.isotropyThreshold ?? 0.1,
    metrics: spec.metrics ?? ['coverage'], includeIsotropyTests: spec.includeIsotropyTests ?? true,
    pilotFiles: files.filter(file => file.experiments.some(experiment => spec.pilotExperiments.includes(experiment))),
    pilotSeeds: [...new Set(pilot.map(row => row.seed))].sort(),
    stage: 'sealed before confirmation; selected means are exploratory only' };
}

export function analyzeConfirmation(rows, lock) {
  if (!lock) return { tests: [], audit: { status: 'not-requested', errors: [] } };
  lock = { ...lock, selectedControllers: lock.selectedControllers.map(String), baselineControllers: lock.baselineControllers.map(String),
    comparisons: lock.comparisons.map(item => ({ controller: String(item.controller), baseline: String(item.baseline) })) };
  const errors = [], alpha = lock.alpha ?? 0.05;
  const conf = rows.filter(row => lock.confirmationExperiments.includes(row.experiment));
  const pilotSeeds = new Set(lock.pilotSeeds);
  const reused = [...new Set(conf.filter(row => pilotSeeds.has(row.seed)).map(row => row.seed))];
  if (reused.length) errors.push(`Confirmation reuses ${reused.length} pilot seeds`);
  const expected = lock.expectedRepetitions;
  const byKey = new Map();
  for (const row of conf) { const id = key(row); if (!byKey.has(id)) byKey.set(id, []); byKey.get(id).push(row); }
  const tests = [];
  const comparisonCount = lock.confirmationExperiments.length * lock.strata.length * lock.comparisons.length * lock.metrics.length;
  const isotropyCount = lock.includeIsotropyTests ? lock.confirmationExperiments.length * lock.strata.length * lock.selectedControllers.length : 0;
  const familySize = comparisonCount + isotropyCount;
  if (!familySize) throw new Error('Empty locked hypothesis family');
  const getGroup = (experiment, controller, stratum) => byKey.get(key({ experiment, controller, ...stratum })) ?? [];
  for (const experiment of lock.confirmationExperiments) for (const stratum of lock.strata) {
    for (const comparison of lock.comparisons) for (const metric of lock.metrics) {
      const first = getGroup(experiment, comparison.controller, stratum), second = getGroup(experiment, comparison.baseline, stratum);
      const effect = pairedEffect(first, second, metric, familySize, alpha);
      const complete = first.length === expected && second.length === expected && effect.n === expected && !effect.missingA && !effect.missingB && !reused.length;
      if (!complete) errors.push(`Incomplete ${experiment}/${comparison.controller}/${comparison.baseline}/${key(stratum, ['L', 'k', 'boundary'])}/${metric}: ${effect.n}/${expected} pairs`);
      tests.push({ kind: 'paired-effect', experiment, ...stratum, ...comparison, metric, ...effect, complete,
        pRaw: complete ? effect.pRaw : null });
    }
    if (lock.includeIsotropyTests) for (const controller of lock.selectedControllers) {
      const group = getGroup(experiment, controller, stratum), stats = descriptive(group.map(row => row.abs_order), alpha);
      const complete = stats.n === expected && !reused.length;
      const p = stats.n > 1 && stats.se > 0 ? studentTCDF((stats.mean - lock.isotropyThreshold) / stats.se, stats.n - 1)
        : stats.n > 1 && stats.mean >= lock.isotropyThreshold ? 1 : null;
      if (!complete) errors.push(`Incomplete isotropy ${experiment}/${controller}/${key(stratum, ['L', 'k', 'boundary'])}: ${stats.n}/${expected}`);
      const half = stats.n > 1 ? studentTQuantile(1 - alpha / familySize, stats.n - 1) * stats.se : null;
      tests.push({ kind: 'isotropy-upper-bound', experiment, ...stratum, controller, baseline: '', metric: 'abs_order',
        ...stats, threshold: lock.isotropyThreshold, observedIsotropic: stats.mean !== null && stats.mean <= lock.isotropyThreshold,
        simultaneousUpper: half === null ? null : stats.mean + half, complete,
        method: 'one-sided Student-t: H0 mean(|S|) >= threshold', pRaw: complete ? p : null });
    }
  }
  const adjusted = holm(tests.map(item => item.pRaw));
  for (let i = 0; i < tests.length; i++) {
    tests[i].familySize = familySize; tests[i].pHolm = adjusted[i];
    tests[i].rejectAtAlpha = tests[i].complete && tests[i].pRaw !== null && adjusted[i] <= alpha;
    tests[i].alpha = alpha; tests[i].inference = 'locked holdout only; pointwise CI is not multiplicity-adjusted';
  }
  return { tests, audit: { status: errors.length ? 'invalid-or-incomplete' : 'complete', expectedRepetitions: expected,
    confirmationRows: conf.length, reusedPilotSeeds: reused, familySize, errors,
    tAssumption: 'Independent runs; exact under normally distributed paired differences, approximate by CLT otherwise. Bounded/bimodal small-n data are descriptive.' } };
}

function expandInputs(inputs) {
  const result = [];
  for (const input of inputs) {
    if (input.includes('*') || input.includes('?')) {
      const directory = path.dirname(input), pattern = path.basename(input);
      const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*').replaceAll('?', '.');
      const matcher = new RegExp(`^${escaped}$`);
      result.push(...fs.readdirSync(directory).filter(name => matcher.test(name)).map(name => path.join(directory, name)));
    } else if (fs.statSync(input).isDirectory()) result.push(...fs.readdirSync(input).filter(name => name.endsWith('.csv')).map(name => path.join(input, name)));
    else result.push(input);
  }
  return [...new Set(result.map(file => path.resolve(file)))].sort();
}

function argumentsFrom(argv) {
  const options = { input: [] };
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    if (name === '--help') { options.help = true; continue; }
    if (!['--input', '--output', '--lock', '--lock-spec', '--write-lock'].includes(name)) throw new Error(`Unknown option ${name}`);
    if (i + 1 >= argv.length) throw new Error(`Missing value for ${name}`);
    const value = argv[++i];
    if (name === '--input') options.input.push(value); else options[name.slice(2)] = value;
  }
  return options;
}

export function runCLI(argv = process.argv.slice(2)) {
  const options = argumentsFrom(argv);
  if (options.help) {
    console.log('node analysis/summarize.mjs --input data/raw/*.csv --output data/processed [--lock docs/confirmation-lock.json]\nSeal before holdout: add --lock-spec docs/family-spec.json --write-lock docs/confirmation-lock.json using ONLY pilot inputs.'); return 0;
  }
  if (!options.input.length || !options.output) throw new Error('--input and --output are required');
  if (options.lock && (options['lock-spec'] || options['write-lock'])) throw new Error('Analysis lock and lock creation are separate steps');
  const files = expandInputs(options.input);
  if (!files.length) throw new Error('No input CSV files');
  const rows = [], manifests = [];
  for (const filename of files) {
    const data = fs.readFileSync(filename);
    const sourceRows = normalizeRows(parseCSV(data.toString('utf8')), path.basename(filename));
    // Large exact-validation files can exceed V8's function-argument limit.
    for (const row of sourceRows) rows.push(row);
    manifests.push({ file: path.relative(process.cwd(), filename).replaceAll('\\', '/'), sha256: sha256(data), rows: sourceRows.length,
      experiments: [...new Set(sourceRows.map(row => row.experiment))].sort() });
  }
  const ids = new Set();
  for (const row of rows) {
    const id = key(row, [...KEYS, 'seed']);
    if (ids.has(id)) throw new Error(`Duplicate run key ${id}`); ids.add(id);
  }
  let lock = options.lock ? JSON.parse(fs.readFileSync(options.lock, 'utf8')) : null;
  if (options['lock-spec'] || options['write-lock']) {
    if (!options['lock-spec'] || !options['write-lock']) throw new Error('--lock-spec and --write-lock must be used together');
    if (fs.existsSync(options['write-lock'])) throw new Error('Refusing to overwrite a previously sealed lock');
    lock = lockFamily(rows, manifests, JSON.parse(fs.readFileSync(options['lock-spec'], 'utf8')));
    fs.mkdirSync(path.dirname(options['write-lock']), { recursive: true });
    fs.writeFileSync(options['write-lock'], JSON.stringify(lock, null, 2) + '\n');
  }
  const summary = summarizeRows(rows);
  const confirmPresent = rows.some(row => /confirmation|holdout/i.test(row.experiment));
  if (confirmPresent && !lock) throw new Error('Confirmation data require a preregistered lock; summaries must not silently become inference');
  const isLockCreation = Boolean(options['write-lock']);
  const confirmation = isLockCreation ? { tests: [], audit: { status: 'sealed-awaiting-confirmation', errors: [] } } : analyzeConfirmation(rows, lock);
  const pilotHashErrors = [];
  if (lock && !isLockCreation) for (const pilot of lock.pilotFiles ?? []) {
    const supplied = manifests.find(file => file.file === pilot.file);
    if (supplied && supplied.sha256 !== pilot.sha256) pilotHashErrors.push(`Pilot hash changed: ${pilot.file}`);
  }
  const audit = { schemaVersion: 1, createdAtUtc: new Date().toISOString(), rows: rows.length, groups: summary.length,
    inputs: manifests, duplicateRunKeys: 0, analysisSourceSha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
    lockSha256: options.lock ? sha256(fs.readFileSync(options.lock)) : null,
    confirmation: confirmation.audit, errors: [...confirmation.audit.errors, ...pilotHashErrors],
    limitations: ['No individual attempt or pixel is treated as an independent replicate.',
      'Terminal coverage includes geometric jamming and controller-induced deadlock; these must not be conflated.',
      'Mean signed order can vanish through cancellation; isotropy requires mean absolute order.',
      'Student-t intervals are approximate for nonnormal small-sample distributions.',
      'No thermodynamic-limit fit, novelty claim, or causal attribution beyond the tested controller comparison is generated.'] };
  const output = path.resolve(options.output); fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify({ schemaVersion: 1, ciLevel: 0.95, ciType: 'pointwise Student-t / Wilson score', groups: summary }, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'summary.csv'), csvText(flattenSummary(summary)));
  fs.writeFileSync(path.join(output, 'comparisons.json'), JSON.stringify({ schemaVersion: 1, tests: confirmation.tests }, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'comparisons.csv'), csvText(confirmation.tests, [...new Set(confirmation.tests.flatMap(item => Object.keys(item)))]));
  fs.writeFileSync(path.join(output, 'pareto.csv'), csvText(paretoRows(summary)));
  fs.writeFileSync(path.join(output, 'audit.json'), JSON.stringify(audit, null, 2) + '\n');
  console.log(JSON.stringify({ rows: rows.length, groups: summary.length, lockedTests: confirmation.tests.length, status: audit.errors.length ? 'invalid-or-incomplete' : audit.confirmation.status, output }, null, 2));
  return audit.errors.length ? 2 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = runCLI(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
