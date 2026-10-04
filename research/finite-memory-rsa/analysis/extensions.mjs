#!/usr/bin/env node
// Descriptive post-primary extensions. Never adds hypotheses to the sealed family.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseCSV, csvText, descriptive, wilson } from './summarize.mjs';

const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
function requireFinite(record, fields, label) {
  for (const field of fields) {
    if (record[field] === '' || record[field] === null || record[field] === undefined) throw new Error(`${label}: missing ${field}`);
    record[field] = Number(record[field]);
    if (!Number.isFinite(record[field])) throw new Error(`${label}: nonfinite ${field}`);
  }
}
function grouped(records, fields) {
  const groups = new Map();
  for (const record of records) {
    const id = JSON.stringify(fields.map(field => record[field]));
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(record);
  }
  return [...groups.values()];
}

export function summarizeRescue(rows) {
  const seen = new Set();
  const fields = ['L', 'k', 'deadlock', 'before_coverage', 'after_coverage', 'coverage_gain', 'added_particles', 'before_abs_order', 'after_abs_order'];
  const records = rows.map((input, index) => {
    const record = { ...input }; requireFinite(record, fields, `rescue row ${index + 2}`);
    const id = JSON.stringify([record.L, record.k, record.boundary, String(record.seed)]);
    if (seen.has(id)) throw new Error(`Duplicate rescue seed/stratum ${id}`); seen.add(id);
    if (![0, 1].includes(record.deadlock) || !Number.isInteger(record.added_particles) || record.added_particles < 0) throw new Error('Invalid rescue count');
    if (record.coverage_gain < 0 || record.after_coverage > 1 || record.before_coverage < 0
      || Math.abs(record.after_coverage - record.before_coverage - record.coverage_gain) > 1e-12
      || Math.abs(record.added_particles * record.k / (record.L * record.L) - record.coverage_gain) > 1e-12)
      throw new Error('Inconsistent rescue coverage/counts');
    if (!record.deadlock && record.coverage_gain !== 0) throw new Error('A geometric jam cannot gain placements without rearrangement');
    if ([record.before_abs_order, record.after_abs_order].some(value => value < 0 || value > 1)) throw new Error('Invalid rescue order');
    record.abs_order_change = record.after_abs_order - record.before_abs_order;
    return record;
  });
  const groups = grouped(records, ['L', 'k', 'boundary']).map(group => ({
    L: group[0].L, k: group[0].k, boundary: group[0].boundary, n: group.length,
    deadlock: wilson(group.reduce((n, record) => n + record.deadlock, 0), group.length),
    metrics: Object.fromEntries(['before_coverage', 'after_coverage', 'coverage_gain', 'added_particles', 'before_abs_order', 'after_abs_order', 'abs_order_change']
      .map(field => [field, descriptive(group.map(record => record[field]))])),
    gainConditionalOnDeadlock: descriptive(group.filter(record => record.deadlock).map(record => record.coverage_gain)),
    interpretation: 'Exploratory paired external rescue of controller38 terminal lattices. The observer detects termination and restarts with fair coin: not an admissible success/failure-only controller, not a primary-family memory benefit.',
  }));
  return { schemaVersion: 1, samplingUnit: 'One independently seeded pre-rescue lattice and its continuation', records: records.length, groups };
}

export function conditionalInformation(counts) {
  if (!Array.isArray(counts) || counts.length !== 2 || counts.some(matrix => !Array.isArray(matrix) || matrix.length !== 2 || matrix.some(row => !Array.isArray(row) || row.length !== 2 || row.some(value => !Number.isInteger(value) || value < 0))))
    throw new Error('Expected [previous orientation][previous outcome][switch] 2x2x2 counts');
  const total = counts.flat(2).reduce((a, b) => a + b, 0);
  let information = 0;
  for (const matrix of counts) {
    const rowTotals = matrix.map(row => row.reduce((a, b) => a + b, 0));
    const columnTotals = [matrix[0][0] + matrix[1][0], matrix[0][1] + matrix[1][1]];
    const n = rowTotals.reduce((a, b) => a + b, 0);
    if (!n) continue;
    for (let y = 0; y < 2; y++) for (let action = 0; action < 2; action++) {
      const count = matrix[y][action];
      if (count) information += count / total * Math.log2(count * n / (rowTotals[y] * columnTotals[action]));
    }
  }
  const failures = counts.reduce((n, matrix) => n + matrix[0][0] + matrix[0][1], 0);
  const successes = counts.reduce((n, matrix) => n + matrix[1][0] + matrix[1][1], 0);
  return { conditionalMI: Math.max(0, information), totalPairs: total,
    switchAfterFailure: failures ? counts.reduce((n, matrix) => n + matrix[0][1], 0) / failures : null,
    switchAfterSuccess: successes ? counts.reduce((n, matrix) => n + matrix[1][1], 0) / successes : null };
}

export function summarizeDynamics(input) {
  const seen = new Set();
  const records = input.records.map((record, index) => {
    const id = JSON.stringify([String(record.controller), record.L, record.k, String(record.seed)]);
    if (seen.has(id)) throw new Error(`Duplicate trajectory ${id}`); seen.add(id);
    const checked = conditionalInformation(record.transitionCounts);
    if (checked.totalPairs !== record.attempts - 1) throw new Error(`Trajectory ${index}: previous-step count differs from attempts-1`);
    for (const field of ['conditionalMI', 'switchAfterFailure', 'switchAfterSuccess']) {
      if (checked[field] === null ? record[field] !== null : Math.abs(record[field] - checked[field]) > 1e-12)
        throw new Error(`Trajectory ${index}: inconsistent ${field}`);
    }
    return { ...record, ...checked };
  });
  const groups = grouped(records, ['controller', 'L', 'k']).map(group => ({
    controller: String(group[0].controller), L: group[0].L, k: group[0].k, n: group.length,
    metrics: Object.fromEntries(['coverage', 'attempts', 'conditionalMI', 'switchAfterFailure', 'switchAfterSuccess']
      .map(field => [field, descriptive(group.map(record => record[field]))])),
    interpretation: 'Exploratory per-run statistics from actual direct attempt trajectories. Conditional plug-in I(Y_previous;switch | O_previous), in bits; finite-sample bias and nonstationarity remain. Not directed causal information, entropy rate, or information-per-packing advantage.',
  }));
  return { schemaVersion: 1, samplingUnit: 'Independent direct trajectory, not individual attempts', records: records.length, groups,
    rationale: 'Conditioning on previous orientation reveals feedback dependence masked in pooled next-orientation MI by XOR/symmetry. A deterministic constant-switch rule35 has conditional MI zero; a switching rule depending on success/failure can have positive conditional MI without coverage benefit.' };
}

function flattened(groups) {
  return groups.map(group => {
    const record = Object.fromEntries(['controller', 'L', 'k', 'boundary', 'n'].filter(field => group[field] !== undefined).map(field => [field, group[field]]));
    for (const [metric, stats] of Object.entries(group.metrics)) for (const field of ['n', 'mean', 'sd', 'se', 'ciLow', 'ciHigh']) record[`${metric}_${field}`] = stats[field];
    return record;
  });
}

export function runCLI(argv = process.argv.slice(2)) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    if (!['--rescue', '--dynamics', '--output'].includes(argv[i]) || !argv[i + 1]) throw new Error('Usage: node analysis/extensions.mjs --rescue data/raw/interventions/rescue.csv --dynamics data/raw/dynamics/summary.json --output data/processed');
    options[argv[i].slice(2)] = argv[++i];
  }
  if (!options.output || (!options.rescue && !options.dynamics)) throw new Error('An input and --output are required');
  fs.mkdirSync(options.output, { recursive: true }); const manifests = [], summaries = {};
  for (const field of ['rescue', 'dynamics']) if (options[field]) {
    const raw = fs.readFileSync(options[field]);
    const summary = field === 'rescue' ? summarizeRescue(parseCSV(raw.toString('utf8'))) : summarizeDynamics(JSON.parse(raw));
    summaries[field] = { rows: summary.records, groups: summary.groups.length };
    fs.writeFileSync(path.join(options.output, `${field}-summary.json`), JSON.stringify(summary, null, 2) + '\n');
    fs.writeFileSync(path.join(options.output, `${field}-summary.csv`), csvText(flattened(summary.groups)));
    manifests.push({ file: options[field].replaceAll('\\', '/'), sha256: sha256(raw), records: summary.records });
  }
  fs.writeFileSync(path.join(options.output, 'extensions-audit.json'), JSON.stringify({ schemaVersion: 1, createdAtUtc: new Date().toISOString(),
    analysisSha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))), inputs: manifests, duplicateKeys: 0, status: 'complete',
    confirmationFamilyChanged: false, inference: 'Post-primary exploratory extensions; no new formal test or selected winner', summaries }, null, 2) + '\n');
  console.log(JSON.stringify(summaries));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { runCLI(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
