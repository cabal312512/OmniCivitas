import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { stageRoot, hash } from './preservation.mjs';
import { certifiedEnvelope, replayPrefixUpper } from '../src/envelope.mjs';
import { Fraction } from '../src/rational.mjs';
const protocolPath = path.join(stageRoot, 'experiments/protocol.json');
const protocol = JSON.parse(fs.readFileSync(protocolPath));
const informedTail = process.argv.includes('--informed');
const summaryFile = path.join(stageRoot, informedTail ? 'results/temporal-envelope-informed.json' : 'results/temporal-envelope.json');
if (fs.existsSync(summaryFile)) throw new Error('Refuse to overwrite certificate');
const certificates = [];
for (const parameters of protocol.tinySystems) {
  const certificate = certifiedEnvelope(parameters, { horizons: protocol.prefixHorizons, multipliers: protocol.supportMultipliers, informedTail });
  let independentPrefixReplays = 0;
  for (const bound of certificate.bounds) {
    const specification = { imbalance: `${bound.imbalanceMultiplier.numerator}/${bound.imbalanceMultiplier.denominator}`,
      cost: `${bound.costMultiplier.numerator}/${bound.costMultiplier.denominator}` };
    assert(replayPrefixUpper(parameters, bound.maximizingPrefix, specification, { informedTail }).eq(new Fraction(bound.supportUpper.numerator, bound.supportUpper.denominator)));
    independentPrefixReplays++;
  }
  const name = `data/envelope-${informedTail ? 'informed-' : ''}${parameters.boundary}.json`, bytes = JSON.stringify(certificate, null, 2) + '\n';
  fs.writeFileSync(path.join(stageRoot, name), bytes);
  certificates.push({ file: name, sha256: hash(bytes), parameters, bounds: certificate.bounds,
    independentBigIntMaximizingPrefixReplays: independentPrefixReplays });
  console.log(JSON.stringify({ boundary: parameters.boundary, status: 'certified-outer-bound', bounds: certificate.bounds.map(x => ({ T:x.horizon, mu:x.imbalanceMultiplier.value, nu:x.costMultiplier.value, upper:x.supportUpper.value })) }));
}
fs.writeFileSync(summaryFile, JSON.stringify({ schemaVersion: 1, generatedAtUTC: new Date().toISOString(),
  protocolSha256: hash(fs.readFileSync(protocolPath)), informedTail, certificates,
  meaning: 'Globally valid upper supports for the complete stochastic temporal family; explicit finite-prefix relaxation, not an exact attained four-state envelope.' }, null, 2) + '\n');
