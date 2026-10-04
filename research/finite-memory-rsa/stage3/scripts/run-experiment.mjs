import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { simulateFinite } from '../src/simulate.mjs';
import { csvText } from '../../analysis/summarize.mjs';
import { stageRoot, researchRoot, hash } from './preservation.mjs';

export function loadControllers() {
  const entries = [];
  for (const kind of ['feedback', 'temporal']) entries.push(...JSON.parse(fs.readFileSync(
    path.join(stageRoot, `data/classification/${kind}-4.json`), 'utf8')).classes.map(c => ({ ...c, kind })));
  entries.push({ classId: 'iid-fair', probabilityH: .5, minimalStateCount: 1, kind: 'iid-reference', universalLiveness: true });
  return new Map(entries.map(c => [c.classId, c]));
}
export function sourceSeal() {
  const files = ['stage3/src/simulate.mjs','stage3/src/controllers.mjs','src/lattice.mjs','src/rng.mjs',
    'stage2/src/stochastic.mjs','stage3/scripts/run-experiment.mjs',
    'stage3/data/classification/feedback-4.json','stage3/data/classification/temporal-4.json'];
  return Object.fromEntries(files
    .map(p => [p, hash(fs.readFileSync(path.join(researchRoot,p)))]));
}
export const FIELDS = ['experiment','controller','kind','L','k','boundary','seed','memory_states',
  'coverage','order','abs_order','particles','horizontal','vertical','attempts','failures','attempts_per_particle',
  'deadlock','legal_h','legal_v','attempted_h','attempted_v','failed_h','failed_v','final_state','orientation_exchange'];
export async function runExperiment(plan, { allowExisting = false } = {}) {
  const controllers = loadControllers();
  const raw = path.join(stageRoot, `data/raw/${plan.name}.csv`);
  const summary = path.join(stageRoot, `results/${plan.name}-groups.json`);
  if (!allowExisting && fs.existsSync(raw)) throw new Error(`Refusing to overwrite existing observations: ${raw}`);
  fs.mkdirSync(path.dirname(raw), { recursive: true }); fs.mkdirSync(path.dirname(summary), { recursive: true });
  const fd = fs.openSync(raw,'wx'); fs.writeSync(fd, csvText([],FIELDS));
  const began = performance.now(), startedAtUTC = new Date().toISOString(), seal = sourceSeal();
  const groups = [], rawBuffer = []; let runs = 0;
  const flush = () => { if(rawBuffer.length) { fs.writeSync(fd,csvText(rawBuffer,FIELDS).split('\n').slice(1).join('\n'));rawBuffer.length=0; } };
  try {
    for (const arm of plan.arms) {
      const controller = controllers.get(arm.controller);
      if (!controller) throw new Error(`Unknown controller ${arm.controller}`);
      let coverage=0, abs_order=0, cost=0, deadlock=0;
      for (let rep=0;rep<arm.repetitions;rep++) {
        const seed = arm.seedStart+rep;
        const r=simulateFinite({L:arm.L,k:arm.k,seed,controller,boundary:arm.boundary??'periodic',engine:'event'});
        const c=r.attempts/r.particles;
        rawBuffer.push({...r,seed,experiment:plan.name,kind:controller.kind,memory_states:controller.minimalStateCount,attempts_per_particle:c});
        coverage+=r.coverage;abs_order+=r.abs_order;cost+=c;deadlock+=r.deadlock;runs++;
        if(rawBuffer.length>=256) flush();
      }
      if(controller.universalLiveness && deadlock) throw new Error(`Certified-live controller deadlocked: ${arm.controller}`);
      groups.push({controller:arm.controller,kind:controller.kind,states:controller.minimalStateCount,L:arm.L,k:arm.k,
        n:arm.repetitions,coverage:coverage/arm.repetitions,abs_order:abs_order/arm.repetitions,cost:cost/arm.repetitions,deadlock});
      if(groups.length%500===0) console.log(JSON.stringify({name:plan.name,groups:groups.length,runs,elapsedSeconds:(performance.now()-began)/1000}));
    }
    flush();fs.closeSync(fd);
    const endSeal=sourceSeal();if(JSON.stringify(seal)!==JSON.stringify(endSeal)) throw new Error('An experiment source changed while sampling');
    fs.writeFileSync(summary,JSON.stringify({name:plan.name,startedAtUTC,finishedAtUTC:new Date().toISOString(),
      planSha256:hash(Buffer.from(JSON.stringify(plan))),sourceSeal:seal,runs,groups,rawSha256:hash(fs.readFileSync(raw)),
      elapsedSeconds:(performance.now()-began)/1000},null,2)+'\n');
    console.log(JSON.stringify({name:plan.name,runs,groups:groups.length,elapsedSeconds:(performance.now()-began)/1000,summary}));
    return groups;
  } catch(error) { try{flush();fs.closeSync(fd);}catch{} throw error; }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const command=process.argv[2];
  if(command==='coarse-plan') {
    const protocol=JSON.parse(fs.readFileSync(path.join(stageRoot,'experiments/search-protocol.json'),'utf8'));
    const arms=[];
    for(const k of protocol.coarse.k) for(const c of loadControllers().values()) if(c.universalLiveness) arms.push({
      controller:c.classId,L:protocol.coarse.L,k,repetitions:protocol.coarse.repetitions,seedStart:protocol.coarse.seedStart+(k===8?100000:0)});
    const plan={name:'coarse',kind:'exploratory',protocolSha256:hash(fs.readFileSync(path.join(stageRoot,'experiments/search-protocol.json'))),arms};
    const destination=path.join(stageRoot,'experiments/coarse.plan.json');
    if(fs.existsSync(destination))throw new Error('Existing plan retained');
    fs.writeFileSync(destination,JSON.stringify(plan,null,2)+'\n');console.log(JSON.stringify({arms:arms.length,runs:arms.length*protocol.coarse.repetitions}));
  } else {const plan=JSON.parse(fs.readFileSync(path.resolve(command),'utf8')); await runExperiment(plan);}
}
