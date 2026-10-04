import test from 'node:test';
import assert from 'node:assert/strict';
import { Fraction, exactTerminal, enumeratePlacements } from '../src/exact.mjs';
import { allControllers, decodeController, classifyControllers } from '../src/controllers.mjs';

const value = (answer, name) => answer.metrics[name].value;
const frac = (answer,name,n,d) => {
  assert.equal(answer.metrics[name].numerator,String(n));
  assert.equal(answer.metrics[name].denominator,String(d));
};

test('rational operations retain exact reduced arbitrary-precision values', () => {
  assert.deepEqual(new Fraction(4n,6n).toJSON(), {numerator:'2',denominator:'3',value:2/3});
  assert(new Fraction(2n,3n).add(new Fraction(1n,6n)).eq(new Fraction(5n,6n)));
  assert(new Fraction(-2n,-4n).mul(new Fraction(3n,2n)).eq(new Fraction(3n,4n)));
  assert(new Fraction(1n,7n).div(new Fraction(3n,11n)).eq(new Fraction(11n,21n)));
  assert.throws(() => new Fraction(1n,0n), RangeError);
});

test('anchor multiplicities are preserved at periodic k=L, and open anchors are conditioned valid', () => {
  assert.deepEqual(enumeratePlacements(2,2,'periodic'), [[3,3,12,12],[5,10,5,10]]);
  assert.deepEqual(enumeratePlacements(2,2,'open'), [[3,12],[5,10]]);
  assert.throws(() => enumeratePlacements(4,2), RangeError);
});

test('k=1 always fills every site for every deterministic controller and the fair baseline', () => {
  for (const controller of allControllers()) {
    const answer = exactTerminal({L:2,k:1,controller});
    frac(answer,'coverage',1,1); frac(answer,'deadlockProbability',0,1);
    for (const state of answer.distribution) assert.equal(state.horizontal + state.vertical,4);
  }
  frac(exactTerminal({L:2,k:1,baseline:'fair'}),'coverage',1,1);
});

test('2x2 dimers have analytic aligned baselines and a half-full controller deadlock', () => {
  for (const boundary of ['periodic','open']) {
    for (const baseline of ['alwaysH','alwaysV','fair','alternating']) {
      const answer = exactTerminal({L:2,k:2,baseline,boundary});
      frac(answer,'coverage',1,1); frac(answer,'absOrder',1,1); frac(answer,'deadlockProbability',0,1);
    }
    const dead = exactTerminal({L:2,k:2,controller:46,boundary});
    frac(dead,'coverage',1,2); frac(dead,'deadlockProbability',1,1);
  }
});

test('3x3 aligned dimers give exact 2/3 coverage and boundary-dependent deadlock probability', () => {
  const periodic = exactTerminal({L:3,k:2,baseline:'alwaysH',boundary:'periodic'});
  frac(periodic,'coverage',2,3); frac(periodic,'deadlockProbability',7,9); frac(periodic,'geometricProbability',2,9);
  const open = exactTerminal({L:3,k:2,baseline:'alwaysH',boundary:'open'});
  frac(open,'coverage',2,3); frac(open,'deadlockProbability',3,4); frac(open,'geometricProbability',1,4);
});

test('universally failure-fair controllers never terminate in policy deadlock in tested small systems', () => {
  for (const controller of classifyControllers().records.filter(c => c.universallyFailureFair)) {
    for (const boundary of ['periodic','open']) {
      frac(exactTerminal({L:3,k:2,controller,boundary}),'deadlockProbability',0,1);
      frac(exactTerminal({L:3,k:3,controller,boundary}),'deadlockProbability',0,1);
    }
  }
});

test('H/V exchange preserves coverage and absolute order and reverses signed order exactly', () => {
  for (const c of allControllers()) {
    const exchanged = {...c,outputs:c.outputs.map(o => 1-o)};
    const a = exactTerminal({L:3,k:2,controller:c});
    const b = exactTerminal({L:3,k:2,controller:exchanged});
    for (const name of ['coverage','absOrder','deadlockProbability','geometricProbability']) assert.deepEqual(a.metrics[name],b.metrics[name]);
    assert.equal(a.metrics.order.numerator,String(-BigInt(b.metrics.order.numerator)));
    assert.equal(a.metrics.order.denominator,b.metrics.order.denominator);
  }
});

// Independent attempt-level finite Markov chain oracle for 2x2 periodic
// dimers. It constructs all reachable nodes, finds closed SCCs, and solves
// the entire transient linear system using Gaussian elimination. It does
// not use the production failure-cycle recursion.
function attemptLevelOracle(controller,{L=2,k=2,boundary='periodic',fair=false}={}) {
  const placements = [[],[]];
  // Construct the independent graph's elementary candidate events directly
  // from coordinates rather than calling the production placement helper.
  for(let o=0;o<2;o++) for(let y=0;y<L;y++) for(let x=0;x<L;x++) {
    if(boundary==='open' && (o?y:x)+k>L) continue;
    let candidate=0;
    for(let j=0;j<k;j++) candidate += 2**(((y+(o?j:0))%L)*L+(x+(o?0:j))%L);
    placements[o].push(candidate);
  }
  const nodes = [{mask:0,q:0}], lookup = new Map([['0:0',0]]), edges = [];
  for (let index = 0; index < nodes.length; index++) {
    const {mask,q} = nodes[index];
    const row = new Map();
    for(const o of fair?[0,1]:[controller.outputs[q]]) for (const p of placements[o]) {
      const success = (mask & p) === 0;
      const nextMask = success ? mask | p : mask;
      const nextQ = fair ? 0 : controller.transitions[q][success ? 1 : 0];
      const key = `${nextMask}:${nextQ}`;
      if (!lookup.has(key)) {lookup.set(key,nodes.length);nodes.push({mask:nextMask,q:nextQ});}
      const next = lookup.get(key); row.set(next,(row.get(next) ?? 0)+1/placements[o].length/(fair?2:1));
    }
    edges.push(row);
  }
  // Tarjan SCC implementation over the attempt-level transition graph.
  const indices = Array(nodes.length).fill(-1), low = [], stack=[], active=new Set(), components=[];
  let counter=0;
  const visit = v => {
    indices[v]=low[v]=counter++;stack.push(v);active.add(v);
    for(const w of edges[v].keys()) {
      if(indices[w] < 0) {visit(w);low[v]=Math.min(low[v],low[w]);}
      else if(active.has(w)) low[v]=Math.min(low[v],indices[w]);
    }
    if(low[v]===indices[v]) {const comp=[];let w;do{w=stack.pop();active.delete(w);comp.push(w);}while(w!==v);components.push(comp);}
  };
  for(let v=0;v<nodes.length;v++) if(indices[v]<0) visit(v);
  const absorbing = new Map();
  for(const comp of components) {
    const set=new Set(comp);
    if(comp.every(v=>[...edges[v].keys()].every(w=>set.has(w)))) {
      for(const v of comp) {
        const mask=nodes[v].mask;
        const occupied=mask.toString(2).replaceAll('0','').length;
        const jam=placements.flat().every(p => !!(mask&p));
        absorbing.set(v,[occupied/(L*L),jam?0:1]);
      }
    }
  }
  if(absorbing.has(0)) return absorbing.get(0);
  const transient=nodes.map((_,i)=>i).filter(i=>!absorbing.has(i));
  const tindex=new Map(transient.map((v,i)=>[v,i]));
  const matrix=transient.map((v,i)=>{
    const row=Array(transient.length+2).fill(0);row[i]=1;
    for(const [w,p] of edges[v]) {
      if(absorbing.has(w)) {row[transient.length]+=p*absorbing.get(w)[0];row[transient.length+1]+=p*absorbing.get(w)[1];}
      else row[tindex.get(w)]-=p;
    }
    return row;
  });
  for(let col=0;col<transient.length;col++) {
    let pivot=col;for(let row=col+1;row<transient.length;row++) if(Math.abs(matrix[row][col])>Math.abs(matrix[pivot][col])) pivot=row;
    [matrix[col],matrix[pivot]]=[matrix[pivot],matrix[col]];
    const divisor=matrix[col][col];assert(Math.abs(divisor)>1e-12);
    for(let j=col;j<transient.length+2;j++) matrix[col][j]/=divisor;
    for(let row=0;row<transient.length;row++) if(row!==col) {
      const factor=matrix[row][col];for(let j=col;j<transient.length+2;j++) matrix[row][j]-=factor*matrix[col][j];
    }
  }
  return matrix[tindex.get(0)].slice(transient.length);
}

test('all 64 exact 2x2 controllers agree with an independent full attempt-level Markov solver', () => {
  for(const controller of allControllers()) {
    const oracle=attemptLevelOracle(controller);
    const exact=exactTerminal({L:2,k:2,controller});
    assert(Math.abs(value(exact,'coverage')-oracle[0])<1e-12);
    assert(Math.abs(value(exact,'deadlockProbability')-oracle[1])<1e-12);
  }
});

test('3x3 periodic/open laws also agree with the independent global Markov solver', () => {
  for(const boundary of ['periodic','open']) {
    for(const id of [35,41,46,'fair']) {
      const fair=id==='fair';
      const oracle=attemptLevelOracle(fair?null:decodeController(id),{L:3,k:2,boundary,fair});
      const exact=exactTerminal({L:3,k:2,boundary,...(fair?{baseline:'fair'}:{controller:id})});
      assert(Math.abs(value(exact,'coverage')-oracle[0])<1e-12);
      assert(Math.abs(value(exact,'deadlockProbability')-oracle[1])<1e-12);
    }
  }
});
