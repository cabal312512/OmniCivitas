import { performance } from 'node:perf_hooks';
import { decodeController } from './controllers.mjs';
import { RNG } from './rng.mjs';
import { Lattice } from './lattice.mjs';

export function policyOf(policy) {
  if (typeof policy === 'number' || /^\d+$/.test(String(policy))) return decodeController(Number(policy));
  if (typeof policy === 'object') return policy;
  if (String(policy).startsWith('random-')) {
    const p = Number(String(policy).slice(7));
    if (!Number.isFinite(p) || p < 0 || p > 1) throw new RangeError('Invalid orientation probability');
    return { id: String(policy), probabilityH: p };
  }
  throw new RangeError('Unknown policy');
}

// Failures cannot change the lattice. On this fixed lattice, deterministic
// failure transitions form a transient prefix followed by a cycle (<=2 states).
// Removing whole failed cycles geometrically preserves the original discrete
// trial law, including the waiting-time distribution and next-success order.
export function failurePath(controller, state) {
  const path = [], seen = new Map();
  while (!seen.has(state)) { seen.set(state,path.length); path.push(state); state = controller.transitions[state][0]; }
  const start = seen.get(state);
  return { prefix: path.slice(0,start), cycle: path.slice(start), path };
}

export function deterministicEvent(controller, state, counts, M, rng) {
  const {prefix,cycle,path} = failurePath(controller,state), failures = [0,0];
  if (path.every(q => counts[controller.outputs[q]] === 0)) return { terminal:true,state,failures };
  for (const q of prefix) {
    const o = controller.outputs[q];
    if (rng.uniform() < counts[o]/M) return { terminal:false,state:q,o,failures };
    failures[o]++;
  }
  let survival = 1, mass = 0;
  const weights = cycle.map(q => {
    const p = counts[controller.outputs[q]] / M, w = survival*p;
    survival *= 1-p; mass += w; return w;
  });
  if (mass === 0) return {terminal:true,state:cycle[0],failures};
  const rounds = survival === 0 ? 0 : Math.floor(Math.log(rng.uniform()) / Math.log1p(-mass));
  for (const q of cycle) failures[controller.outputs[q]] += rounds;
  let choice = rng.uniform()*mass;
  for (let j = 0; j < cycle.length; j++) {
    const q = cycle[j], o = controller.outputs[q];
    if (choice < weights[j] || j === cycle.length-1) return {terminal:false,state:q,o,failures};
    choice -= weights[j]; failures[o]++;
  }
  throw new Error('Unreachable event sampler');
}

export function simulate({L,k,controller=19,boundary='periodic',seed=1,engine='event',trace=false,snapshot=false,validate=false,maxAttempts=100000000}) {
  const began = performance.now(), policy = policyOf(controller), random = policy.probabilityH !== undefined;
  if (!['event','direct'].includes(engine)) throw new RangeError('Unknown engine');
  if (trace && engine !== 'direct') throw new Error('Attempt-level trajectories require the direct engine');
  const rng = new RNG(seed), lattice = new Lattice(L,k,boundary), failed = [0,0], attempted = [0,0], trajectory = [];
  let state = policy.initial ?? 0, attempts = 0, failures = 0, previousY = null, previousO = null;
  const countsInfo = Array.from({length:4},()=>Array(4).fill(0));
  const record = (o,y,q) => {
    if (previousY !== null) countsInfo[Math.min(3,Math.floor(lattice.particles.reduce((a,b)=>a+b,0)*k/lattice.N*4))][previousY*2+o]++;
    if (trace) trajectory.push({attempt:attempts,state:q,orientation:o,success:Number(y),coverage:k*(lattice.particles[0]+lattice.particles[1])/lattice.N,previousOutcome:previousY,previousOrientation:previousO});
    previousY = Number(y); previousO = o;
  };
  while (true) {
    if (lattice.counts[0]+lattice.counts[1] === 0) break;
    if (random && policy.probabilityH*lattice.counts[0]+(1-policy.probabilityH)*lattice.counts[1] === 0) break;
    if (!random && failurePath(policy,state).path.every(q=>lattice.counts[policy.outputs[q]]===0)) break;
    if (engine === 'direct') {
      if (attempts >= maxAttempts) throw new Error('Direct validation hit safety bound: no terminal result recorded');
      const q = state, o = random ? Number(rng.uniform() >= policy.probabilityH) : policy.outputs[q], anchor = lattice.uniformAnchor(o,rng), success = lattice.canPlace(o,anchor);
      attempted[o]++; attempts++;
      if (success) lattice.place(o,anchor); else { failed[o]++; failures++; }
      record(o,success,q);
      if (!random) state = policy.transitions[q][Number(success)];
    } else if (random) {
      const weighted = [policy.probabilityH*lattice.counts[0],(1-policy.probabilityH)*lattice.counts[1]], p = (weighted[0]+weighted[1])/lattice.M;
      const skipped = p === 1 ? 0 : Math.floor(Math.log(rng.uniform())/Math.log1p(-p));
      attempts += skipped+1; failures += skipped;
      const o = Number(rng.uniform()*(weighted[0]+weighted[1]) >= weighted[0]);
      lattice.place(o,lattice.legal[o][rng.integer(lattice.counts[o])]);
    } else {
      const event = deterministicEvent(policy,state,lattice.counts,lattice.M,rng), skipped = event.failures[0]+event.failures[1];
      for(let o=0;o<2;o++){attempted[o]+=event.failures[o];failed[o]+=event.failures[o];}
      attempts += skipped; failures += skipped;
      if(event.terminal){state=event.state;break;}
      attempted[event.o]++; attempts++;
      lattice.place(event.o,lattice.legal[event.o][rng.integer(lattice.counts[event.o])]);
      state = policy.transitions[event.state][1];
    }
    if(validate)lattice.validate();
  }
  const horizontal=lattice.particles[0],vertical=lattice.particles[1],particles=horizontal+vertical,order=(horizontal-vertical)/particles;
  const result={controller:String(policy.id ?? controller),L,k,boundary,seed,engine,particles,horizontal,vertical,coverage:particles*k/lattice.N,order,abs_order:Math.abs(order),deadlock:Number(lattice.counts[0]+lattice.counts[1]>0),legal_h:lattice.counts[0],legal_v:lattice.counts[1],attempts,failures,attempted_h:random&&engine==='event'?null:attempted[0],attempted_v:random&&engine==='event'?null:attempted[1],elapsed_ms:performance.now()-began};
  if(trace){result.trajectory=trajectory;result.informationCounts=countsInfo;}
  if(snapshot)result.lattice={L,k,boundary,occupancy:Array.from(lattice.occupancy),finalState:state};
  return result;
}
