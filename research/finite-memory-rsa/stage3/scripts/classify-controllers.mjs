#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { enumerateClassification, enumerateCanonicalAccessible, accessibleGraphCount, temporalMinimalSequenceCount } from '../src/controllers.mjs';

export function runClassification(output) {
  fs.mkdirSync(output, { recursive: true });
  const summaries = [];
  const artifacts = [];
  const write = (name, text) => {
    const file = path.join(output, name); fs.writeFileSync(file, text);
    artifacts.push({ file: name, bytes: fs.statSync(file).size,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') });
  };
  for (const temporal of [false, true]) for (const stateCount of [1, 2, 3, 4]) {
    const started = performance.now();
    const result = enumerateClassification({ stateCount, temporal,
      progress: stateCount === 4 && !temporal ? status => process.stdout.write(`classification ${status.done}/${status.total}; ${status.classCount} classes\n`) : undefined });
    const independent = enumerateCanonicalAccessible(stateCount, { temporal });
    const combinatorial = accessibleGraphCount(stateCount, { temporal });
    if (BigInt(combinatorial.canonicalAccessibleTopologies) !== BigInt(independent.topologyCount)) throw new Error('Accessible topology recurrence disagrees');
    const exactStateClasses = result.classes.filter(entry => entry.minimalStateCount === stateCount);
    const exactStateKeys = new Set(exactStateClasses.map(entry => entry.key));
    if (independent.minimalCount !== exactStateKeys.size || [...independent.keys].some(key => !exactStateKeys.has(key))) {
      throw new Error('Independent accessible graph generation disagrees with labelled classification');
    }
    if (result.classes.some(entry => entry.labelledRootHorizontal !== entry.labelledRootVertical)) throw new Error('H/V multiplicity mismatch');
    const stem = `${temporal ? 'temporal' : 'feedback'}-${stateCount}`;
    const { mapping, ...catalog } = result;
    write(`${stem}.json`, JSON.stringify(catalog) + '\n');
    // Explicit little-endian mapping; stable catalogue IDs make every labelled policy auditable.
    const binary = Buffer.alloc(mapping.length * 4);
    for (let i = 0; i < mapping.length; i++) binary.writeUInt32LE(mapping[i], i * 4);
    write(`${stem}.labelled-to-class.u32le`, binary);
    const { keys, ...independentCounts } = independent;
    const sequenceFormula = temporal ? temporalMinimalSequenceCount(stateCount) : null;
    if (sequenceFormula && (BigInt(sequenceFormula.minimalClasses) !== BigInt(independent.minimalCount) ||
        BigInt(sequenceFormula.liveMinimalClasses) !== BigInt(independent.liveMinimalCount))) throw new Error('Temporal sequence formula disagrees');
    summaries.push({ ...catalog, classes: undefined, independentCounts, combinatorial, sequenceFormula, elapsedMs: performance.now() - started });
  }
  const feedback4 = JSON.parse(fs.readFileSync(path.join(output, 'feedback-4.json')));
  const temporal4 = JSON.parse(fs.readFileSync(path.join(output, 'temporal-4.json')));
  const temporalKeys = new Set(temporal4.classes.map(entry => entry.key));
  const equivalentKeys = new Set(feedback4.classes.filter(entry => entry.temporalEquivalent).map(entry => entry.key));
  if (temporalKeys.size !== equivalentKeys.size || [...temporalKeys].some(key => !equivalentKeys.has(key))) throw new Error('Temporal quotient inclusion disagrees');
  const summary = { schemaVersion: 1, generatedAtUTC: new Date().toISOString(), nodeVersion: process.version,
    scope: 'Exact deterministic structure, no RSA Monte Carlo and no packing-performance theorem',
    controllerSourceSha256: crypto.createHash('sha256').update(fs.readFileSync(fileURLToPath(new URL('../src/controllers.mjs', import.meta.url)))).digest('hex'),
    catalogues: summaries, temporalInclusionVerified: true, mappingFormat: 'Unsigned32 little endian; array position=labelled index, value=catalogue numeric id',
    artifacts };
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ output, counts: summaries.map(s => ({ stateCount: s.stateCount, temporal: s.temporal, labelled: s.labelledCount, classes: s.classCount, live: s.universalLiveClassCount })) }) + '\n');
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--output' && !args[args.indexOf(arg) - 1]?.includes('--output'))) {
    throw new Error('Usage: node scripts/classify-controllers.mjs [--output DIRECTORY]');
  }
  const output = args.includes('--output') ? args[args.indexOf('--output') + 1] : fileURLToPath(new URL('../data/classification/', import.meta.url));
  if (!output) throw new Error('--output needs a directory');
  runClassification(path.resolve(output));
}
