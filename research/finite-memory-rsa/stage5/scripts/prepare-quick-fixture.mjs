import fs from 'node:fs';
import path from 'node:path';
import { stageRoot,hash } from './preservation.mjs';
const output=path.join(stageRoot,'experiments/quick-fixture.json');if(fs.existsSync(output))throw new Error('Refuse fixture overwrite');
const read=f=>JSON.parse(fs.readFileSync(path.join(stageRoot,f))),lower=read('results/lower-supports.json');
const candidates=lower.directions.filter(x=>x.newExactCandidateFile).map(x=>{
  const result=read(x.newExactCandidateFile);return {file:x.newExactCandidateFile,realization:result.realization,parameters:result.parameters,
    metrics:result.metrics,lawSha256:hash(JSON.stringify(result.law))};
});
fs.writeFileSync(output,JSON.stringify({schemaVersion:1,
  scope:'Expected retained Stage V targets and archived exact coordinates are fixtures, not raw experiments to rerun.',
  candidates,negative:read('results/periodic-negative.json'),densityExpected:read('results/density-limit.json').geometries.map(x=>({parameters:x.parameters,macroStates:x.reachableMacroStates,terminalAtoms:x.terminalAtoms}))
},null,2)+'\n');console.log(JSON.stringify({fixtureSha256:hash(fs.readFileSync(output)),newExactTargets:candidates.length}));
