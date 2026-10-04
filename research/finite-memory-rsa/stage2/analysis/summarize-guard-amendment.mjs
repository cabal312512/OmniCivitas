#!/usr/bin/env node
// Stage I is imported read-only; Stage II keeps a separate dataset and test family.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseCSV, csvText, descriptive, wilson, holm, pairedEffect,
  studentTQuantile, studentTTwoSidedP } from '../../analysis/summarize.mjs';

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const self = fileURLToPath(import.meta.url);
const stage1 = fileURLToPath(new URL('../../analysis/summarize.mjs', import.meta.url));
const KEYS = ['experiment', 'controller', 'L', 'k', 'boundary', 'alpha', 'beta',
  'initial_mode', 'engine', 'kinetic_kind'];
const STRATUM = ['experiment', 'L', 'k', 'boundary', 'initial_mode', 'engine', 'kinetic_kind'];
const REQUIRED = [...KEYS, 'seed', 'initial_orientation', 'particles', 'horizontal',
  'vertical', 'coverage', 'order', 'abs_order', 'deadlock', 'legal_h', 'legal_v', 'elapsed_ms'];
const OPTIONAL = ['expected_attempts', 'expected_failures', 'expected_switches',
  'actual_attempts', 'actual_failures', 'actual_switches', 'accepted_pairs', 'accepted_switches',
  'success_flips', 'failure_flips', 'controller_flips', 'accepted_run_count', 'accepted_mean_run_length',
  'accepted_max_run_length', 'trial_run_count', 'trial_mean_run_length', 'trial_max_run_length',
  'conditional_mean_attempts_sum'];
export const METRICS = Object.freeze(['coverage', 'order', 'abs_order', 'order2', 'order4',
  'particles', 'expected_attempts', 'expected_failures', 'expected_switches',
  'expected_attempts_per_particle', 'expected_failures_per_particle', 'expected_switch_fraction',
  'actual_attempts', 'actual_failures', 'actual_switches', 'actual_attempts_per_particle',
  'actual_failures_per_particle', 'actual_switch_fraction', 'accepted_pairs', 'accepted_switches',
  'accepted_switch_fraction', 'accepted_lag1', 'trial_switch_fraction', 'trial_lag1',
  'success_flips', 'failure_flips', 'controller_flips', 'accepted_run_count', 'accepted_mean_run_length',
  'accepted_max_run_length', 'trial_run_count', 'trial_mean_run_length', 'trial_max_run_length',
  'conditional_mean_attempts_sum', 'conditional_mean_attempts_per_particle', 'elapsed_ms']);
const key = (item, fields = KEYS) => JSON.stringify(fields.map(field => item[field]));
const close = (a, b, tolerance = 1e-9) => Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));
const optionalNumber = (value, name, prefix) => {
  if (value === '' || value === undefined || value === null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${prefix}: invalid ${name}`);
  return number;
};

export function normalizeRows(inputs, source = '(memory)') {
  return inputs.map((input, index) => {
    const prefix = `${source}:${index + 2}`;
    for (const field of REQUIRED) if (input[field] === undefined || input[field] === '' || input[field] === null)
      throw new Error(`${prefix}: missing ${field}`);
    const row = { ...input, seed: String(input.seed), controller: String(input.controller), source };
    for (const field of ['L', 'k', 'alpha', 'beta', 'particles', 'horizontal', 'vertical', 'coverage',
      'order', 'abs_order', 'deadlock', 'legal_h', 'legal_v', 'elapsed_ms']) {
      row[field] = Number(input[field]);
      if (!Number.isFinite(row[field])) throw new Error(`${prefix}: invalid ${field}`);
    }
    for (const field of ['L', 'k', 'particles', 'horizontal', 'vertical', 'legal_h', 'legal_v'])
      if (!Number.isSafeInteger(row[field]) || row[field] < 0) throw new Error(`${prefix}: invalid count ${field}`);
    if (row.L < 1 || row.k < 1 || row.k > row.L || ![0, 1].includes(row.deadlock)
      || !['periodic', 'open'].includes(row.boundary) || row.alpha < 0 || row.alpha > 1 || row.beta < 0 || row.beta > 1)
      throw new Error(`${prefix}: invalid model parameter`);
    if ([0, '0'].includes(row.initial_orientation)) row.initial_orientation = 'H';
    if ([1, '1'].includes(row.initial_orientation)) row.initial_orientation = 'V';
    if (row.initial_mode !== 'fair' || !['H', 'V'].includes(row.initial_orientation))
      throw new Error(`${prefix}: Stage II requires fair H/V initialization`);
    if (!['conditional-expectation', 'sampled-actual', 'actual', 'unmeasured'].includes(row.kinetic_kind))
      throw new Error(`${prefix}: unrecognized kinetic_kind`);
    if (row.horizontal + row.vertical !== row.particles) throw new Error(`${prefix}: particle counts inconsistent`);
    const theta = row.particles * row.k / (row.L * row.L);
    const order = row.particles ? (row.horizontal - row.vertical) / row.particles : 0;
    if (theta > 1 + 1e-12 || !close(theta, row.coverage) || !close(order, row.order)
      || !close(Math.abs(order), row.abs_order)) throw new Error(`${prefix}: coverage/order inconsistent`);
    if (row.deadlock !== Number(row.legal_h + row.legal_v > 0)) throw new Error(`${prefix}: terminal flag inconsistent`);
    if (row.beta > 0 && row.deadlock) throw new Error(`${prefix}: beta>0 terminal deadlock contradicts liveness`);
    if (row.elapsed_ms < 0) throw new Error(`${prefix}: negative elapsed time`);
    for (const field of OPTIONAL) row[field] = optionalNumber(input[field], field, prefix);
    for (const type of ['expected', 'actual']) {
      const attempts = row[`${type}_attempts`], failures = row[`${type}_failures`], switches = row[`${type}_switches`];
      if ((attempts === null) !== (failures === null)) throw new Error(`${prefix}: incomplete ${type} kinetic fields`);
      if (attempts !== null && (!close(attempts - failures, row.particles, 2e-8) || attempts < row.particles))
        throw new Error(`${prefix}: inconsistent ${type} attempts/failures`);
      if (switches !== null && (attempts === null || switches > attempts + 1e-8))
        throw new Error(`${prefix}: inconsistent ${type} switches`);
      if (type === 'actual') for (const value of [attempts, failures, switches])
        if (value !== null && !Number.isSafeInteger(value)) throw new Error(`${prefix}: actual counts must be integers`);
      row[`${type}_attempts_per_particle`] = attempts !== null && row.particles ? attempts / row.particles : null;
      row[`${type}_failures_per_particle`] = failures !== null && row.particles ? failures / row.particles : null;
      row[`${type}_switch_fraction`] = switches !== null && attempts > 0 ? switches / attempts : null;
    }
    if (row.kinetic_kind === 'conditional-expectation' && row.actual_attempts !== null)
      throw new Error(`${prefix}: conditional expectations cannot be labeled actual attempts`);
    if (row.kinetic_kind === 'actual' && row.expected_attempts !== null)
      throw new Error(`${prefix}: actual kinetic stratum cannot pool expected attempts`);
    if (row.kinetic_kind === 'unmeasured' && (row.actual_attempts !== null || row.expected_attempts !== null))
      throw new Error(`${prefix}: unmeasured kinetics contains counts`);
    if (row.kinetic_kind === 'sampled-actual' && row.actual_attempts === null)
      throw new Error(`${prefix}: sampled-actual requires actual counts`);
    if (row.actual_switches !== null && row.actual_switches > Math.max(0, row.actual_attempts - 1))
      throw new Error(`${prefix}: actual switches exceed adjacent proposal pairs`);
    for (const [alias, canonical] of [['attempts', 'actual_attempts'], ['failures', 'actual_failures'], ['trial_switches', 'actual_switches']])
      if (row[alias] !== undefined && row[alias] !== '' && row[canonical] !== null && Number(row[alias]) !== row[canonical])
        throw new Error(`${prefix}: actual ${alias} alias inconsistent`);
    if ((row.accepted_pairs === null) !== (row.accepted_switches === null)) throw new Error(`${prefix}: incomplete accepted pairs`);
    if (row.accepted_pairs !== null && (!Number.isSafeInteger(row.accepted_pairs)
      || !Number.isSafeInteger(row.accepted_switches) || row.accepted_pairs !== Math.max(0, row.particles - 1)
      || row.accepted_switches > row.accepted_pairs || row.accepted_switches > 2 * Math.min(row.horizontal, row.vertical)))
      throw new Error(`${prefix}: accepted sequence inconsistent`);
    row.accepted_switch_fraction = row.accepted_pairs > 0 ? row.accepted_switches / row.accepted_pairs : null;
    row.accepted_lag1 = row.accepted_switch_fraction === null ? null : 1 - 2 * row.accepted_switch_fraction;
    row.trial_switch_fraction = row.actual_attempts > 1 && row.actual_switches !== null ? row.actual_switches / (row.actual_attempts - 1) : null;
    row.trial_lag1 = row.trial_switch_fraction === null ? null : 1 - 2 * row.trial_switch_fraction;
    if (input.accepted_lag1 !== undefined && input.accepted_lag1 !== '' && row.accepted_lag1 !== null
      && !close(Number(input.accepted_lag1), row.accepted_lag1)) throw new Error(`${prefix}: accepted lag1 alias inconsistent`);
    if (input.trial_lag1_correlation !== undefined && input.trial_lag1_correlation !== '' && row.trial_lag1 !== null
      && !close(Number(input.trial_lag1_correlation), row.trial_lag1)) throw new Error(`${prefix}: trial lag1 inconsistent`);
    if (row.accepted_run_count !== null && row.accepted_run_count !== row.accepted_switches + 1)
      throw new Error(`${prefix}: accepted run count inconsistent`);
    if (row.trial_run_count !== null && row.trial_run_count !== row.actual_switches + 1)
      throw new Error(`${prefix}: trial run count inconsistent`);
    if (row.success_flips !== null && row.failure_flips !== null && row.controller_flips !== null
      && (row.success_flips > row.particles || row.failure_flips > row.actual_failures
        || row.controller_flips !== row.success_flips + row.failure_flips))
      throw new Error(`${prefix}: controller flip counts inconsistent`);
    if (row.accepted_mean_run_length !== null && !close(row.accepted_mean_run_length, row.particles / row.accepted_run_count))
      throw new Error(`${prefix}: accepted mean run length inconsistent`);
    if (row.trial_mean_run_length !== null && !close(row.trial_mean_run_length, row.actual_attempts / row.trial_run_count))
      throw new Error(`${prefix}: trial mean run length inconsistent`);
    row.conditional_mean_attempts_per_particle = row.conditional_mean_attempts_sum !== null && row.particles
      ? row.conditional_mean_attempts_sum / row.particles : null;
    row.order2 = row.order * row.order; row.order4 = row.order2 * row.order2;
    row.temporal_null = close(row.alpha, row.beta, 1e-12);
    return row;
  });
}

export function quantile(sorted, probability) {
  if (!sorted.length) return null;
  if (!(probability >= 0 && probability <= 1)) throw new Error('Invalid quantile probability');
  const at = (sorted.length - 1) * probability, low = Math.floor(at), fraction = at - low;
  return sorted[low] * (1 - fraction) + sorted[Math.min(low + 1, sorted.length - 1)] * fraction;
}

export function distribution(values, support = [-1, 1], alpha = .05) {
  const sorted = values.slice().sort((a, b) => a - b), n = sorted.length;
  const epsilon = n ? Math.sqrt(Math.log(2 / alpha) / (2 * n)) : null;
  // The inverse of F_n uses ceil(np), rather than the interpolated point quantile.
  const inverse = p => sorted[Math.max(0, Math.min(n - 1, Math.ceil(n * p) - 1))];
  const quantiles = Object.fromEntries([0, .025, .05, .1, .25, .5, .75, .9, .95, .975, 1].map(p => [String(p), {
    value: quantile(sorted, p),
    ciLow: !n ? null : p - epsilon <= 0 ? support[0] : inverse(p - epsilon),
    ciHigh: !n ? null : p + epsilon >= 1 ? support[1] : inverse(p + epsilon),
  }]));
  const bins = Array.from({ length: 41 }, (_, i) => ({ center: -1 + i * .05,
    low: i === 0 ? -1 : -1 + i * .05 - .025,
    high: i === 40 ? 1 : -1 + i * .05 + .025, count: 0 }));
  for (const value of sorted) bins[Math.max(0, Math.min(40, Math.floor((value + 1) / .05 + .5)))].count++;
  return { n, support, sorted, quantiles, bins, dkwEpsilon: epsilon,
    confidence: 1 - alpha, quantileMethod: 'type-7 points; inverse empirical-CDF DKW intervals',
    interpretation: 'Within-group iid-run distribution band; not simultaneous across policy groups' };
}

export function summarizeRows(rows) {
  const groups = new Map();
  for (const row of rows) { const id = key(row); if (!groups.has(id)) groups.set(id, []); groups.get(id).push(row); }
  return [...groups.values()].map(group => {
    const first = group[0], metrics = Object.fromEntries(METRICS.map(metric => [metric, descriptive(group.map(row => row[metric]))]));
    const n = group.length, deadlock = wilson(group.reduce((total, row) => total + row.deadlock, 0), n);
    return { ...Object.fromEntries(KEYS.map(field => [field, first[field]])), n, temporalNull: first.temporal_null,
      metrics, deadlock, geometricJam: wilson(n - deadlock.count, n),
      initializationH: wilson(group.filter(row => row.initial_orientation === 'H').length, n),
      signedDistribution: distribution(group.map(row => row.order)),
      absoluteDistribution: distribution(group.map(row => row.abs_order), [0, 1]),
      kineticQuantiles: Object.fromEntries(['actual_attempts_per_particle', 'actual_failures_per_particle'].map(metric => {
        const values = group.map(row => row[metric]).filter(value => value !== null).sort((a, b) => a - b);
        return [metric, { n: values.length, values: Object.fromEntries([0, .5, .9, .95, .99, 1].map(p => [String(p), quantile(values, p)])),
          interpretation: 'Exploratory empirical type-7 waiting-cost quantiles, no trial pseudoreplication' }];
      })),
      binderMomentRatio: metrics.order2.mean > 0 ? 1 - metrics.order4.mean / (3 * metrics.order2.mean ** 2) : null,
      nearZero: wilson(group.filter(row => Math.abs(row.order) <= .05).length, n),
      positiveTail: wilson(group.filter(row => row.order > .1).length, n),
      negativeTail: wilson(group.filter(row => row.order < -.1).length, n),
      cancellationWarning: Math.abs(metrics.order.mean) <= .1 && metrics.abs_order.mean > .1 };
  }).sort((a, b) => key(a).localeCompare(key(b)));
}

export function summarizeExploration(rows, experiments = ['landscape', 'refinement', 'refinement_success_flip']) {
  const selected = rows.filter(row => experiments.includes(row.experiment));
  const seen = new Set();
  for (const row of selected) {
    const id = key(row, KEYS.filter(field => field !== 'experiment')) + '/' + row.seed;
    if (seen.has(id)) throw new Error('Combined exploration repeats the same arm/seed'); seen.add(id);
  }
  return summarizeRows(selected.map(row => ({ ...row, source_experiment: row.experiment, experiment: 'exploration-combined' })));
}

export function frontierRows(groups, matchMetric = 'accepted_lag1') {
  if (!METRICS.includes(matchMetric)) throw new Error('Invalid persistence matching metric');
  const strata = new Map();
  for (const group of groups) { const id = key(group, STRATUM); if (!strata.has(id)) strata.set(id, []); strata.get(id).push(group); }
  const dominates = (a, b) => a.metrics.coverage.mean >= b.metrics.coverage.mean && a.metrics.abs_order.mean <= b.metrics.abs_order.mean
    && (a.metrics.coverage.mean > b.metrics.coverage.mean + 1e-12 || a.metrics.abs_order.mean < b.metrics.abs_order.mean - 1e-12);
  return [...strata.values()].flatMap(group => group.map(item => {
    const nulls = group.filter(other => other.temporalNull), eligible = nulls.filter(other => other.metrics.abs_order.mean <= item.metrics.abs_order.mean);
    const matchValue = item.metrics[matchMetric].mean;
    const matching = matchValue === null ? [] : nulls.filter(other => other.metrics[matchMetric].mean !== null)
      .map(other => ({ other, distance: Math.abs(other.metrics[matchMetric].mean - matchValue) }))
      .sort((a, b) => a.distance - b.distance || a.other.alpha - b.other.alpha || a.other.controller.localeCompare(b.other.controller));
    const match = matching[0], bestEligible = eligible.slice().sort((a, b) => b.metrics.coverage.mean - a.metrics.coverage.mean || a.alpha - b.alpha)[0];
    const nullValues = matching.map(item => item.other.metrics[matchMetric].mean);
    return { ...Object.fromEntries(KEYS.map(field => [field, item[field]])), n: item.n, temporal_null: Number(item.temporalNull),
      coverage: item.metrics.coverage.mean, abs_order: item.metrics.abs_order.mean, deadlock_rate: item.deadlock.rate,
      on_sample_frontier: Number(!group.some(other => dominates(other, item))),
      on_null_sample_frontier: item.temporalNull ? Number(!nulls.some(other => dominates(other, item))) : null,
      null_dominators: nulls.filter(other => dominates(other, item)).map(other => other.controller).join(';'),
      eligible_null_count: eligible.length, best_eligible_null: bestEligible?.controller ?? null,
      best_eligible_null_coverage: bestEligible?.metrics.coverage.mean ?? null,
      excess_over_eligible_null_means: bestEligible ? item.metrics.coverage.mean - bestEligible.metrics.coverage.mean : null,
      match_metric: matchMetric, match_candidate_value: matchValue,
      match_candidate_se: item.metrics[matchMetric].se,
      match_candidate_ci_low: item.metrics[matchMetric].ciLow, match_candidate_ci_high: item.metrics[matchMetric].ciHigh,
      matched_null: match?.other.controller ?? null, matched_null_p: match?.other.alpha ?? null,
      matched_null_value: match?.other.metrics[matchMetric].mean ?? null, matching_distance: match?.distance ?? null,
      matched_null_se: match?.other.metrics[matchMetric].se ?? null,
      matched_null_ci_low: match?.other.metrics[matchMetric].ciLow ?? null,
      matched_null_ci_high: match?.other.metrics[matchMetric].ciHigh ?? null,
      matching_outside_null_range: nullValues.length && matchValue !== null
        ? Number(matchValue < Math.min(...nullValues) || matchValue > Math.max(...nullValues)) : null,
      interpretation: 'Exploratory point-mean frontier/matching only; retain all points; no continuum dominance or post-selection p-value' };
  }));
}

export function summarizeHistograms(records, rows) {
  const rowKey = row => key(row, ['experiment', 'controller', 'L', 'k', 'boundary', 'seed']);
  const lookup = new Map(rows.map(row => [rowKey(row), row])), seen = new Set(), groups = new Map();
  for (const record of records) {
    const id = rowKey({ ...record, seed: String(record.seed) }), row = lookup.get(id);
    if (!row || seen.has(id)) throw new Error('Unknown or duplicate run-length record'); seen.add(id);
    const groupKey = key(row);
    if (!groups.has(groupKey)) groups.set(groupKey, { ...Object.fromEntries(KEYS.map(field => [field, row[field]])),
      accepted: { runsMeasured: 0, runsMissing: 0, histogram: {} }, trial: { runsMeasured: 0, runsMissing: 0, histogram: {} } });
    const group = groups.get(groupKey);
    for (const type of ['accepted', 'trial']) {
      const histogram = record[type], target = group[type];
      if (histogram === null || histogram === undefined) { target.runsMissing++; continue; }
      let count = 0, mass = 0, maximum = 0;
      for (const [lengthText, quantity] of Object.entries(histogram)) {
        const length = Number(lengthText);
        if (!Number.isSafeInteger(length) || length < 1 || !Number.isSafeInteger(quantity) || quantity < 1)
          throw new Error('Invalid run-length histogram count');
        count += quantity; mass += length * quantity; maximum = Math.max(maximum, length);
        target.histogram[lengthText] = (target.histogram[lengthText] ?? 0) + quantity;
      }
      const expectedMass = type === 'accepted' ? row.particles : row.actual_attempts;
      const expectedCount = type === 'accepted' ? row.accepted_run_count : row.trial_run_count;
      const expectedMaximum = type === 'accepted' ? row.accepted_max_run_length : row.trial_max_run_length;
      if (mass !== expectedMass || (expectedCount !== null && count !== expectedCount)
        || (expectedMaximum !== null && maximum !== expectedMaximum)) throw new Error('Run-length histogram inconsistent with CSV');
      target.runsMeasured++;
    }
  }
  return { schemaVersion: 2, records: seen.size, groups: [...groups.values()],
    interpretation: 'Pooled observed sequence-run counts, not independent lattice replicates; no histogram-count inference. Missing trial histograms stay missing.' };
}

export function finiteSizeEffects(rows) {
  const selected = rows.filter(row => /size|scaling|finite/i.test(row.experiment));
  const strata = new Map();
  for (const row of selected) { const id = key(row, STRATUM); if (!strata.has(id)) strata.set(id, []); strata.get(id).push(row); }
  const output = [];
  for (const group of strata.values()) {
    const feedback = group.filter(row => row.alpha === 0 && row.beta === 1);
    if (!feedback.length) continue;
    for (const p of [.5, 1]) {
      const baseline = group.filter(row => row.alpha === p && row.beta === p);
      if (!baseline.length) continue;
      for (const metric of ['coverage', 'abs_order', 'order2', 'order4']) {
        const result = pairedEffect(feedback, baseline, metric);
        const { pRaw, method, ...descriptiveEffect } = result;
        output.push({ ...Object.fromEntries(STRATUM.map(field => [field, group[0][field]])),
          controller: feedback[0].controller, baseline: baseline[0].controller, baseline_p: p, metric,
          ...descriptiveEffect, interpretation: 'Descriptive paired finite-size effect with pointwise t CI, no post hoc significance test or infinite-limit fit' });
      }
    }
  }
  return output;
}

export function candidateReview(groups, frontiers) {
  const compact = group => ({ controller: group.controller, alpha: group.alpha, beta: group.beta, n: group.n,
    coverage: group.metrics.coverage, absS: group.metrics.abs_order, acceptedLag1: group.metrics.accepted_lag1,
    trialSwitchRate: group.metrics.trial_switch_fraction, trialsPerRod: group.metrics.actual_attempts_per_particle,
    costQuantiles: group.kineticQuantiles.actual_attempts_per_particle, deadlock: group.deadlock,
    matching: frontiers.find(row => row.controller === group.controller && row.L === group.L && row.k === group.k
      && row.boundary === group.boundary && row.experiment === group.experiment) });
  return { schemaVersion: 2, interpretation: 'Pilot selection review only; no p values or confirmation claims',
    strata: [...new Set(groups.map(group => key(group, ['L', 'k', 'boundary'])))].map(id => {
      const [L, k, boundary] = JSON.parse(id), selected = groups.filter(group => group.L === L && group.k === k && group.boundary === boundary);
      return { L, k, boundary,
        nullLine: selected.filter(group => group.temporalNull).sort((a, b) => a.alpha - b.alpha).map(compact),
        sampleFrontier: selected.filter(group => frontiers.find(row => row.controller === group.controller && row.L === L
          && row.k === k && row.boundary === boundary)?.on_sample_frontier === 1).sort((a, b) => a.metrics.abs_order.mean - b.metrics.abs_order.mean).map(compact),
        successFlipCorner: selected.filter(group => group.alpha >= .95 && group.beta <= .2).sort((a, b) => a.alpha - b.alpha || a.beta - b.beta).map(compact),
        mechanismCandidates: selected.filter(group => [[1, .001], [1, .05], [.02, 1], [.85, .5]]
          .some(([alpha, beta]) => group.alpha === alpha && group.beta === beta)).map(compact) };
    }) };
}

function testSeeds(spec) {
  if (Array.isArray(spec.seeds) && spec.seeds.length) return spec.seeds.map(String);
  if (!spec.seedBlock || !Number.isSafeInteger(spec.seedBlock.start) || !Number.isSafeInteger(spec.seedBlock.count)
    || spec.seedBlock.count < 2 || spec.seedBlock.start < 0) throw new Error('Each test requires explicit seeds or a valid seedBlock');
  return Array.from({ length: spec.seedBlock.count }, (_, i) => String(spec.seedBlock.start + i));
}

export function lockFamily(rows, files, inputSpec) {
  const spec = structuredClone(inputSpec);
  if (!Array.isArray(spec.pilotExperiments) || !spec.pilotExperiments.length
    || !Array.isArray(spec.tests) || !spec.tests.length || !spec.selectionRule)
    throw new Error('Lock requires pilotExperiments, explicit tests and selectionRule');
  const confExperiments = [...new Set(spec.tests.map(test => test.experiment))];
  if (rows.some(row => confExperiments.includes(row.experiment))) throw new Error('Cannot seal after confirmation data supplied');
  const pilot = rows.filter(row => spec.pilotExperiments.includes(row.experiment));
  if (!pilot.length) throw new Error('No supplied pilot data');
  const pilotSeeds = [...new Set(pilot.map(row => row.seed))].sort();
  const ids = new Set();
  for (const test of spec.tests) {
    for (const field of ['id', 'experiment', 'L', 'k', 'boundary', 'controller', 'baseline', 'metric', 'alternative', 'nullDifference'])
      if (test[field] === undefined || test[field] === '') throw new Error(`Test missing ${field}`);
    if (ids.has(test.id)) throw new Error('Repeated locked test id'); ids.add(test.id);
    if (!['coverage', 'abs_order'].includes(test.metric) || !['two-sided', 'greater', 'less'].includes(test.alternative)
      || !Number.isFinite(test.nullDifference) || test.controller === test.baseline) throw new Error('Invalid locked contrast');
    const seeds = testSeeds(test);
    if (new Set(seeds).size !== seeds.length || seeds.some(seed => pilotSeeds.includes(seed))) throw new Error('Repeated or reused pilot seeds in lock');
    test.expectedRepetitions = seeds.length;
    for (const controller of [test.controller, test.baseline]) {
      if (!test.armParameters) test.armParameters = {};
      const declared = test.armParameters[String(controller)] ?? spec.armParameters?.[String(controller)];
      const arm = pilot.filter(row => row.controller === String(controller) && row.k === test.k && row.boundary === test.boundary);
      if (arm.length) {
        const signatures = new Set(arm.map(row => key(row, ['alpha', 'beta', 'initial_mode', 'engine', 'kinetic_kind'])));
        if (signatures.size !== 1) throw new Error(`Ambiguous pilot parameters: ${controller}`);
        const actual = { alpha: arm[0].alpha, beta: arm[0].beta, initial_mode: arm[0].initial_mode,
          engine: arm[0].engine, kinetic_kind: arm[0].kinetic_kind };
        if (declared && Object.entries(actual).some(([field, value]) => typeof value === 'number'
          ? !close(declared[field], value, 1e-12) : declared[field] !== value))
          throw new Error(`Declared arm disagrees with pilot: ${controller}`);
        test.armParameters[String(controller)] = { ...declared, ...actual };
      } else {
        const source = declared?.source;
        if (!declared || source?.kind !== 'pilot-trial-switch-match' || source.metric !== 'trial_switch_fraction'
          || !Array.isArray(source.experiments) || !source.experiments.length
          || source.experiments.some(experiment => !spec.pilotExperiments.includes(experiment))
          || declared.initial_mode !== 'fair' || !['sampled-actual', 'actual'].includes(declared.kinetic_kind))
          throw new Error(`Locked arm absent from pilot and lacks an explicit pilot matching source: ${controller}`);
        if (String(source.controller) !== String(test.controller) || source.k !== test.k || source.boundary !== test.boundary)
          throw new Error(`Matching source must be the compared candidate in the same k/boundary: ${controller}`);
        const matchingRows = pilot.filter(row => source.experiments.includes(row.experiment)
          && row.controller === String(source.controller) && row.L === source.L && row.k === source.k && row.boundary === source.boundary);
        const signatures = new Set(matchingRows.map(row => key(row, ['alpha', 'beta', 'initial_mode', 'engine', 'kinetic_kind'])));
        if (signatures.size !== 1 || new Set(matchingRows.map(row => row.seed)).size !== matchingRows.length)
          throw new Error(`Matching source mixes parameters or repeats seeds: ${controller}`);
        const stats = descriptive(matchingRows.map(row => row.trial_switch_fraction));
        if (stats.n < 2 || !close(declared.alpha, stats.mean, 1e-12) || !close(declared.beta, stats.mean, 1e-12)
          || matchingRows.some(row => row.engine !== declared.engine || row.kinetic_kind !== declared.kinetic_kind))
          throw new Error(`New diagonal parameter does not match pilot trial-switch mean: ${controller}`);
        test.armParameters[String(controller)] = { ...declared, matchingEstimate: stats,
          interpretation: 'New diagonal control fixed analytically from pilot run-mean proposal switching, not a pilot-sampled null or accepted-lag match' };
      }
    }
  }
  const familyAlpha = spec.familyAlpha ?? .05;
  if (!(familyAlpha > 0 && familyAlpha < 1)) throw new Error('Invalid family alpha');
  return { schemaVersion: 2, ...spec, familyAlpha, familySize: spec.tests.length,
    lockedAtUtc: new Date().toISOString(), analysisSourceSha256: sha256(fs.readFileSync(self)),
    stage1NumericsSha256: sha256(fs.readFileSync(stage1)), pilotSeeds,
    pilotFiles: files.filter(file => file.experiments.some(experiment => spec.pilotExperiments.includes(experiment))),
    stage: 'Sealed after exploration but before independent confirmation' };
}

function oneSidedP(t, df, alternative) {
  const tail = .5 * studentTTwoSidedP(t, df);
  return alternative === 'greater' ? t >= 0 ? tail : 1 - tail : t <= 0 ? tail : 1 - tail;
}

export function analyzeConfirmation(rows, lock) {
  if (!lock) return { tests: [], audit: { status: 'not-requested', errors: [] } };
  const errors = [], familySize = lock.tests.length, familyAlpha = lock.familyAlpha;
  if (familySize !== lock.familySize || !familySize) throw new Error('Locked family size inconsistent');
  const confExperiments = new Set(lock.tests.map(test => test.experiment)), pilotSeeds = new Set(lock.pilotSeeds);
  const conf = rows.filter(row => confExperiments.has(row.experiment));
  const reusedPilotSeeds = [...new Set(conf.filter(row => pilotSeeds.has(row.seed)).map(row => row.seed))];
  if (reusedPilotSeeds.length) errors.push('Confirmation reuses pilot seeds');
  const tests = lock.tests.map(spec => {
    const seeds = testSeeds(spec), requiredSeeds = new Set(seeds), expected = seeds.length;
    const select = controller => conf.filter(row => row.experiment === spec.experiment && row.controller === String(controller)
      && row.L === spec.L && row.k === spec.k && row.boundary === spec.boundary);
    const first = select(spec.controller), second = select(spec.baseline);
    const parameterMatch = [first, second].every((arm, i) => {
      const fixed = spec.armParameters[String(i === 0 ? spec.controller : spec.baseline)];
      return arm.every(row => close(row.alpha, fixed.alpha, 1e-12) && close(row.beta, fixed.beta, 1e-12)
        && row.initial_mode === fixed.initial_mode && row.engine === fixed.engine && row.kinetic_kind === fixed.kinetic_kind);
    });
    const unique = arm => new Set(arm.map(row => row.seed)).size === arm.length;
    const unexpectedSeeds = [...new Set([...first, ...second].filter(row => !requiredSeeds.has(row.seed)).map(row => row.seed))];
    const kineticSignatures = new Set([...first, ...second].map(row => key(row, ['engine', 'kinetic_kind'])));
    const effect = pairedEffect(first, second, spec.metric, familySize, familyAlpha);
    const complete = first.length === expected && second.length === expected && effect.n === expected
      && unique(first) && unique(second) && !effect.missingA && !effect.missingB && !unexpectedSeeds.length
      && !reusedPilotSeeds.length && parameterMatch && kineticSignatures.size === 1;
    let pRaw = null;
    if (effect.n > 1 && effect.se > 0) {
      const t = (effect.mean - spec.nullDifference) / effect.se;
      pRaw = spec.alternative === 'two-sided' ? studentTTwoSidedP(t, effect.n - 1) : oneSidedP(t, effect.n - 1, spec.alternative);
    } else if (effect.n > 1 && effect.mean === spec.nullDifference) pRaw = spec.alternative === 'two-sided' ? 1 : .5;
    if (!complete) errors.push(`Incomplete/invalid locked test ${spec.id}`);
    const half = effect.n > 1 ? studentTQuantile(1 - familyAlpha / familySize, effect.n - 1) * effect.se : null;
    return { ...spec, ...effect, pRaw: complete ? pRaw : null, complete, unexpectedSeeds, parameterMatch,
      simultaneousLowerOneSided: half === null ? null : effect.mean - half,
      simultaneousUpperOneSided: half === null ? null : effect.mean + half,
      method: `paired Student-t ${spec.alternative}; difference minus locked null ${spec.nullDifference}`,
      familySize, familyAlpha, inference: 'Independent locked holdout; approximate t inference; ordinary CIs are pointwise' };
  });
  const adjusted = holm(tests.map(test => test.pRaw));
  tests.forEach((test, i) => {
    test.pHolm = adjusted[i]; test.rejectAtAlpha = test.complete && test.pRaw !== null && adjusted[i] <= familyAlpha;
    test.correctDirection = test.alternative === 'less' ? test.mean < test.nullDifference
      : test.alternative === 'greater' ? test.mean > test.nullDifference : test.mean !== test.nullDifference;
  });
  const jointBenefits = tests.filter(test => test.metric === 'coverage').map(coverage => {
    const companions = tests.filter(test => test.metric === 'abs_order' && test.alternative === 'less'
      && key(test, ['experiment', 'L', 'k', 'boundary', 'controller', 'baseline'])
        === key(coverage, ['experiment', 'L', 'k', 'boundary', 'controller', 'baseline']));
    return { coverageTestId: coverage.id, noninferiorityTestIds: companions.map(test => test.id),
      confirmedJointBenefit: coverage.rejectAtAlpha && coverage.nullDifference === 0
        && ['two-sided', 'greater'].includes(coverage.alternative) && coverage.mean > 0 && companions.length > 0
        && companions.every(test => test.rejectAtAlpha && test.correctDirection),
      interpretation: 'Only this fixed pair/stratum; does not prove dominance over untested or unmatched nulls' };
  });
  const matchingResiduals = tests.filter(test => test.metric === 'coverage').flatMap(test => {
    const parameters = test.armParameters[String(test.baseline)];
    if (parameters?.source?.kind !== 'pilot-trial-switch-match') return [];
    const getArm = controller => conf.filter(row => row.experiment === test.experiment && row.controller === String(controller)
      && row.L === test.L && row.k === test.k && row.boundary === test.boundary);
    const candidate = getArm(test.controller), baseline = getArm(test.baseline);
    const difference = pairedEffect(candidate, baseline, 'trial_switch_fraction');
    const { pRaw, method, ...descriptiveDifference } = difference;
    return [{ testId: test.id, L: test.L, k: test.k, controller: test.controller, baseline: test.baseline,
      fixedNullParameter: parameters.alpha, pilotSource: parameters.source, pilotEstimate: parameters.matchingEstimate,
      candidate: descriptive(candidate.map(row => row.trial_switch_fraction)),
      null: descriptive(baseline.map(row => row.trial_switch_fraction)), difference: descriptiveDifference,
      interpretation: 'Frozen proposal-parameter match; report actual stopped-run ratio mismatch descriptively, not an added inferential test or retuning rule' }];
  });
  return { tests, jointBenefits, matchingResiduals, audit: { status: errors.length ? 'invalid-or-incomplete' : 'complete', errors, familySize,
    confirmationRows: conf.length, reusedPilotSeeds, jointBenefitRule: 'Coverage rejection with positive effect AND same-pair abs_order noninferiority rejection; never implies continuum dominance' } };
}

function flattenSummary(groups) {
  return groups.map(group => {
    const row = { ...Object.fromEntries(KEYS.map(field => [field, group[field]])), n: group.n, temporal_null: Number(group.temporalNull) };
    for (const metric of METRICS) for (const field of ['n', 'mean', 'sd', 'se', 'ciLow', 'ciHigh']) row[`${metric}_${field}`] = group.metrics[metric][field];
    for (const field of ['count', 'rate', 'ciLow', 'ciHigh']) row[`deadlock_${field}`] = group.deadlock[field];
    for (const [probability, q] of Object.entries(group.signedDistribution.quantiles)) row[`S_quantile_${probability}`] = q.value;
    row.binder_moment_ratio = group.binderMomentRatio; row.dkw_epsilon = group.signedDistribution.dkwEpsilon;
    return row;
  });
}

function expandInputs(inputs) {
  return [...new Set(inputs.flatMap(input => {
    const absolute = path.resolve(input);
    if (!input.includes('*')) return fs.statSync(absolute).isDirectory()
      ? fs.readdirSync(absolute).filter(name => name.endsWith('.csv')).map(name => path.join(absolute, name)) : [absolute];
    const directory = path.dirname(absolute), pattern = new RegExp('^' + path.basename(absolute).split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
    return fs.readdirSync(directory).filter(name => pattern.test(name)).map(name => path.join(directory, name));
  }))].sort();
}

export function runCLI(argv = process.argv.slice(2)) {
  const options = { input: [] };
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--') || argv[i + 1] === undefined) throw new Error('Expected --option value');
    const name = argv[i].slice(2), value = argv[++i];
    if (!['input', 'output', 'lock-spec', 'write-lock', 'lock', 'match-metric'].includes(name)) throw new Error(`Unknown option ${name}`);
    if (name === 'input') options.input.push(value); else options[name] = value;
  }
  if (!options.input.length || !options.output) throw new Error('Required --input and --output');
  const files = expandInputs(options.input), rows = [], manifests = [], seen = new Set(), arms = new Map();
  if (!files.length) throw new Error('No input files');
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8'), normalized = normalizeRows(parseCSV(text), file);
    manifests.push({ file, sha256: sha256(text), rows: normalized.length, experiments: [...new Set(normalized.map(row => row.experiment))] });
    for (const row of normalized) {
      const id = key(row) + '/' + row.seed;
      if (seen.has(id)) throw new Error(`Duplicate run ${id}`); seen.add(id);
      const armKey = key(row, ['experiment', 'controller', 'L', 'k', 'boundary']);
      const signature = key(row, ['alpha', 'beta', 'initial_mode', 'engine', 'kinetic_kind']);
      if (arms.has(armKey) && arms.get(armKey) !== signature) throw new Error(`Inconsistent arm parameters ${armKey}`);
      arms.set(armKey, signature); rows.push(row);
    }
  }
  let lock = options.lock ? JSON.parse(fs.readFileSync(options.lock, 'utf8')) : null;
  if (options['lock-spec'] || options['write-lock']) {
    if (!options['lock-spec'] || !options['write-lock'] || lock) throw new Error('Use exactly --lock-spec and --write-lock together');
    if (fs.existsSync(options['write-lock'])) throw new Error('Refusing to overwrite sealed lock');
    lock = lockFamily(rows, manifests, JSON.parse(fs.readFileSync(options['lock-spec'], 'utf8')));
    fs.mkdirSync(path.dirname(options['write-lock']), { recursive: true });
    fs.writeFileSync(options['write-lock'], JSON.stringify(lock, null, 2) + '\n');
  }
  if (!lock && rows.some(row => /confirmation|holdout/i.test(row.experiment))) throw new Error('Confirmation data require prior lock');
  const summaries = summarizeRows(rows), confirmation = options['write-lock']
    ? { tests: [], audit: { status: 'sealed-awaiting-confirmation', errors: [] } } : analyzeConfirmation(rows, lock);
  const errors = [...confirmation.audit.errors];
  if (lock && !options['write-lock']) for (const pilot of lock.pilotFiles ?? []) {
    const supplied = manifests.find(file => path.resolve(file.file) === path.resolve(pilot.file));
    if (supplied && supplied.sha256 !== pilot.sha256) errors.push(`Pilot hash changed: ${pilot.file}`);
  }
  const histogramRecords = [], histogramInputs = [];
  for (const file of files) {
    const histFile = file.replace(/\.csv$/, '.runs.jsonl');
    if (!fs.existsSync(histFile)) continue;
    const contents = fs.readFileSync(histFile, 'utf8');
    let count = 0;
    for (const line of contents.split(/\r?\n/)) if (line.trim()) { histogramRecords.push(JSON.parse(line)); count++; }
    histogramInputs.push({ file: histFile, sha256: sha256(contents), rows: count });
  }
  const histogramSummary = summarizeHistograms(histogramRecords, rows);
  const audit = { schemaVersion: 2, createdAtUtc: new Date().toISOString(), rows: rows.length, groups: summaries.length,
    inputs: manifests, analysisSourceSha256: sha256(fs.readFileSync(self)), stage1NumericsSha256: sha256(fs.readFileSync(stage1)),
    histogramInputs,
    lockSha256: options.lock ? sha256(fs.readFileSync(options.lock)) : null, confirmation: confirmation.audit, errors,
    limitations: ['Independent lattice runs only; no trial pseudoreplication.', 'Conditional kinetic expectations are not actual waiting samples.',
      'Signed cancellation is not within-run isotropy.', 'Exploratory finite-grid sample frontier does not prove continuum dominance.',
      'No extrapolated thermodynamic limit or phase transition is generated.', 'Matched accepted lag1 is not proposal correlation.'] };
  const output = path.resolve(options.output); fs.mkdirSync(output, { recursive: true });
  const write = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n');
  write('summary.json', { schemaVersion: 2, ciLevel: .95, groups: summaries });
  const exploration = summarizeExploration(rows, lock?.pilotExperiments ?? ['landscape', 'refinement', 'refinement_success_flip']);
  write('exploration-summary.json', { schemaVersion: 2, groups: exploration,
    interpretation: 'Pools identical evaluated pilot parameters over independent seed blocks only; these are the same observations, not additional runs.' });
  const explorationFrontiers = frontierRows(exploration, options['match-metric'] ?? 'accepted_lag1');
  fs.writeFileSync(path.join(output, 'exploration-frontiers.csv'), csvText(explorationFrontiers));
  write('candidate-review.json', candidateReview(exploration, explorationFrontiers));
  fs.writeFileSync(path.join(output, 'summary.csv'), csvText(flattenSummary(summaries)));
  write('comparisons.json', { schemaVersion: 2, tests: confirmation.tests, jointBenefits: confirmation.jointBenefits ?? [],
    matchingResiduals: confirmation.matchingResiduals ?? [] });
  write('run-lengths.json', histogramSummary);
  const finiteEffects = finiteSizeEffects(rows);
  write('finite-size-effects.json', { schemaVersion: 2, effects: finiteEffects });
  fs.writeFileSync(path.join(output, 'finite-size-effects.csv'), csvText(finiteEffects));
  fs.writeFileSync(path.join(output, 'comparisons.csv'), csvText(confirmation.tests, [...new Set(confirmation.tests.flatMap(test => Object.keys(test)))]));
  fs.writeFileSync(path.join(output, 'frontiers.csv'), csvText(frontierRows(summaries, options['match-metric'] ?? 'accepted_lag1')));
  write('audit.json', audit);
  console.log(JSON.stringify({ rows: rows.length, groups: summaries.length, familySize: confirmation.tests.length,
    status: errors.length ? 'invalid-or-incomplete' : confirmation.audit.status, output }, null, 2));
  return errors.length ? 2 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  try { process.exitCode = runCLI(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
