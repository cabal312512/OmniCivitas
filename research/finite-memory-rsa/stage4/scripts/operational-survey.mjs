import fs from 'node:fs';
import path from 'node:path';
import { stageRoot, researchRoot, hash, verifyPreservation } from './preservation.mjs';
import { universalOperational, physicalMachine, distinguishingWitness, constructiveWitness } from '../src/operational.mjs';

const output = path.join(stageRoot, 'results/operational-survey.json');
if (fs.existsSync(output)) throw new Error('Refuse to overwrite completed survey');
const file = path.join(researchRoot, 'stage3/data/classification/feedback-4.json');
const catalogue = JSON.parse(fs.readFileSync(file, 'utf8')).classes;
const groups = new Map(), rows = [];
for (const controller of catalogue) {
  const descriptor = universalOperational(controller);
  if (!groups.has(descriptor.key)) groups.set(descriptor.key, { descriptor, members: [], representative: controller });
  groups.get(descriptor.key).members.push(controller.classId);
  rows.push({ controller: controller.classId, structuralStates: controller.minimalStateCount,
    universalOperationalStates: descriptor.minimalDeterministicOperationalStates,
    universalKey: descriptor.key, universallyLive: controller.universalLiveness });
}
const universalGroups = [...groups.values()];
console.log(JSON.stringify({ step: 'universal', classes: universalGroups.length }));
const geometries = [{ L: 2, k: 2, boundary: 'periodic' }, { L: 2, k: 2, boundary: 'open' },
  { L: 3, k: 2, boundary: 'periodic' }, { L: 3, k: 2, boundary: 'open' }];
const physical = [];
for (const parameters of geometries) {
  const map = new Map(), perUniversal = new Map(); let nodes = 0;
  for (const group of universalGroups) {
    const machine = physicalMachine(group.representative, parameters); nodes += machine.reachableProductStates;
    // Equality is certified by the full canonical encoding, not hash coincidence.
    if (!map.has(machine.encoding)) map.set(machine.encoding, { digest: machine.sha256, members: [], min: 5 });
    const target = map.get(machine.encoding);
    target.members.push(...group.members);
    target.min = Math.min(target.min, ...group.members.map(id => catalogue[Number(id.split('-').at(-1))].minimalStateCount));
    perUniversal.set(group.descriptor.key, target);
  }
  for (const row of rows) {
    row.physical ??= [];
    const group = perUniversal.get(row.universalKey);
    row.physical.push({ ...parameters, equivalenceSha256: group.digest, minimalDeterministicStates: group.min });
  }
  physical.push({ ...parameters, completeStructuralClasses: catalogue.length, operationalClasses: map.size,
    minimalStateHistogram: [1,2,3,4].map(states => ({ states, classes: [...map.values()].filter(x => x.min === states).length,
      structuralMembers: rows.filter(x => x.physical.at(-1).minimalDeterministicStates === states).length })),
    augmentedNodesProcessed: nodes });
  console.log(JSON.stringify({ step: 'physical', ...physical.at(-1) }));
}
const activation = rows.find(row => row.universallyLive && row.physical[0].minimalDeterministicStates === 2 &&
  row.physical[2].minimalDeterministicStates >= 3);
const activationEvidence = activation ? {
  ...activation,
  controller: catalogue.find(x => x.classId === activation.controller),
  smallerRepresentatives: [1,2].flatMap(states => catalogue.filter(x => x.minimalStateCount === states))
    .map(smaller => ({ controller: smaller.classId, states: smaller.minimalStateCount,
      small: distinguishingWitness(catalogue.find(x => x.classId === activation.controller), smaller, geometries[0]),
      larger: distinguishingWitness(catalogue.find(x => x.classId === activation.controller), smaller, geometries[2]) }))
} : null;
const alternation = catalogue.find(x => x.key === '2:01:1,1,0,0');
const equivalentExample = catalogue.find(x => x.classId === 'feedback-4-00206');
const examples = catalogue.filter(x => x.universalLiveness && universalOperational(x).minimalDeterministicOperationalStates < x.minimalStateCount).slice(0, 12)
  .map(x => ({ controller: x.classId, structuralStates: x.minimalStateCount, ...universalOperational(x) }));
const witnessExamples = catalogue.filter(x => x.universalLiveness && universalOperational(x).key !== universalOperational(alternation).key).slice(0, 12)
  .map(x => ({ controllers: [x.classId, alternation.classId], guaranteed: constructiveWitness(x, alternation),
    geometries: geometries.map(g => distinguishingWitness(x, alternation, g)) }));
const result = { schemaVersion: 1, generatedAtUTC: new Date().toISOString(), catalogueSha256: hash(fs.readFileSync(file)),
  completeStructuralClasses: catalogue.length, universalOperationalClasses: universalGroups.length,
  universalStateHistogram: [1,2,3,4].map(states => ({ states,
    classes: universalGroups.filter(x => x.descriptor.minimalDeterministicOperationalStates === states).length,
    structuralMembers: rows.filter(x => x.universalOperationalStates === states).length })),
  reductions: rows.filter(x => x.universalOperationalStates < x.structuralStates).length,
  universallyLiveReductions: rows.filter(x => x.universallyLive && x.universalOperationalStates < x.structuralStates).length,
  physical, activation: activationEvidence, examples, witnessExamples,
  stageIIIExample: { controllers: [equivalentExample.classId, alternation.classId],
    universalKeysEqual: universalOperational(equivalentExample).key === universalOperational(alternation).key,
    witnessSearch: constructiveWitness(equivalentExample, alternation) },
  claim: 'Minimum among all deterministic <=4-state rooted controllers, exact trace equivalence, not stochastic positive-realization minimality.',
  stopping: 'Only geometric jam terminates the full process. Nonlive controllers keep their infinite action/failure traces.',
  rows, preservation: verifyPreservation() };
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: 'complete', reductions: result.reductions, activation: activation?.controller ?? null }));
