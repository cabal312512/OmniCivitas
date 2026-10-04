import fs from 'node:fs';
import path from 'node:path';
import { stageRoot,hash } from './preservation.mjs';
const read=file=>JSON.parse(fs.readFileSync(path.join(stageRoot,file)));
const output=path.join(stageRoot,'experiments/quick-fixture.json');
if(fs.existsSync(output))throw new Error('Refuse fixture overwrite');
const main=read('results/capability-search.json');
const envelope=read('results/temporal-envelope-informed.json');
const edge=main.outcomes[0].temporal.find(x=>x.policy==='edge-2');
if(!edge)throw new Error('Missing edge-2 example');
fs.writeFileSync(output,JSON.stringify({schemaVersion:1,
  provenance:'Expected targets extracted from retained Stage IV outputs; this fixture is not an independent study.',
  catalogueSha256:hash(fs.readFileSync(path.join(stageRoot,'../stage3/data/classification/feedback-4.json'))),
  universalClasses:22077,universalClassHistogram:[1,11,422,21643],
  envelopes:envelope.certificates.map(c=>({parameters:c.parameters,
    multipliers:c.bounds.filter(x=>x.horizon===4).map(x=>({imbalance:`${x.imbalanceMultiplier.numerator}/${x.imbalanceMultiplier.denominator}`,cost:`${x.costMultiplier.numerator}/${x.costMultiplier.denominator}`})),
    bounds:c.bounds.filter(x=>x.horizon===4)})),
  edge:{realization:edge.realization,metrics:edge.metrics,law:read(edge.evidenceFile).law},
  proper:{metrics:read('results/proper-boundary-null.json').metrics,law:read('results/proper-boundary-null.json').law}
},null,2)+'\n');
console.log(JSON.stringify({fixture:'experiments/quick-fixture.json',sha256:hash(fs.readFileSync(output))}));
