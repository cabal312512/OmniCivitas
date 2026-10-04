import { Fraction, enumeratePlacements } from '../../src/exact.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ZERO=new Fraction(0n),ONE=new Fraction(1n),HALF=new Fraction(1n,2n);
const sum=values=>values.reduce((total,value)=>total.add(value),ZERO);
const jsonMatrix=matrix=>matrix.map(row=>row.map(value=>value.toJSON()));
const popcount=mask=>{let count=0;while(mask){mask&=mask-1;count++;}return count;};
const addMass=(map,key,mass)=>{if(!mass.zero)map.set(key,(map.get(key)??ZERO).add(mass));};

/** Decimal strings/numbers are exact decimal rationals, not binary floats. */
export function rationalProbability(value) {
  let result;
  if(value instanceof Fraction) result=value;
  else if(value && typeof value==='object' && 'numerator' in value) result=new Fraction(value.numerator,value.denominator);
  else {
    const text=String(value);
    if(/^\d+\/\d+$/.test(text)) {const [n,d]=text.split('/');result=new Fraction(n,d);}
    else {
      const match=text.match(/^(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
      if(!match)throw new TypeError(`Invalid probability: ${text}`);
      const decimal=match[2]??'',exponent=Number(match[3]??0)-decimal.length;
      if(Math.abs(exponent)>1000)throw new RangeError('Probability exponent is too large');
      const n=BigInt(match[1]+decimal);
      result=exponent>=0?new Fraction(n*10n**BigInt(exponent)):new Fraction(n,10n**BigInt(-exponent));
    }
  }
  if(result.n<0n||result.n>result.d)throw new RangeError('Probability must lie in [0,1]');
  return result;
}

function episode(a,b,beta) {
  const u=ONE.sub(a),v=ONE.sub(b),stay=ONE.sub(beta);
  const F=[[u.mul(stay),u.mul(beta)],[v.mul(beta),v.mul(stay)]];
  const determinant=a.mul(b).add(beta.mul(a.add(b).sub(a.mul(b).mul(new Fraction(2n)))));
  if(determinant.zero) {
    // On a nonjammed lattice this is beta=0 with one unavailable direction.
    // Terminal recognition has cost zero; time to a future success is infinite
    // in an unavailable state. Keep the two conventions explicitly distinct.
    const probabilities=[[a.zero?ZERO:ONE,ZERO],[ZERO,b.zero?ZERO:ONE]];
    const waiting=[a.zero?ZERO:ONE.div(a),b.zero?ZERO:ONE.div(b)];
    return {F,determinant,N:null,probabilities,waiting,nonSuccess:[a.zero?ONE:ZERO,b.zero?ONE:ZERO]};
  }
  const N=[[b.add(beta.mul(v)).div(determinant),beta.mul(u).div(determinant)],
    [beta.mul(v).div(determinant),a.add(beta.mul(u)).div(determinant)]];
  const probabilities=N.map(row=>[row[0].mul(a),row[1].mul(b)]);
  return {F,determinant,N,probabilities,waiting:N.map(sum),nonSuccess:[ZERO,ZERO]};
}

/** Exact frozen-lattice next-success law, including singular beta=0 states. */
export function nextSuccessKernel({a,b,beta}) {
  a=rationalProbability(a);b=rationalProbability(b);beta=rationalProbability(beta);
  const result=episode(a,b,beta);
  const second=result.N?result.N.map((row,i)=>sum(row.map((value,j)=>value.mul(result.waiting[j]))).mul(new Fraction(2n)).sub(result.waiting[i])):
    result.waiting.map((mean,q)=>result.nonSuccess[q].zero?mean.mul(mean).mul(new Fraction(2n)).sub(mean):ZERO);
  const variance=second.map((value,q)=>value.sub(result.waiting[q].mul(result.waiting[q])));
  return {
    hazards:{a:a.toJSON(),b:b.toJSON(),beta:beta.toJSON()},failureMatrix:jsonMatrix(result.F),
    determinant:result.determinant.toJSON(),fundamental:result.N?jsonMatrix(result.N):null,
    successOrientationProbabilities:jsonMatrix(result.probabilities),
    nonSuccessProbability:result.nonSuccess.map(value=>value.toJSON()),
    expectedNextSuccessAttempts:result.waiting.map((value,q)=>result.nonSuccess[q].zero?value.toJSON():null),
    nextSuccessAttemptSecondMoment:second.map((value,q)=>result.nonSuccess[q].zero?value.toJSON():null),
    nextSuccessAttemptVariance:variance.map((value,q)=>result.nonSuccess[q].zero?value.toJSON():null),
    expectedRecognitionOrSuccessAttempts:result.waiting.map(value=>value.toJSON()),
    terminalReason:a.zero&&b.zero?'geometric':result.nonSuccess.some(value=>!value.zero)?'state-dependent-deadlock':null,
    conventions:'Rows start in H,V. Null next-success time denotes infinity; recognized terminal states require no extra failed attempts.',
  };
}

/** P(T_next > attempts); direct matrix powers are a rational tail oracle. */
export function nextSuccessSurvival({a,b,beta,initial='H',attempts}) {
  if(!Number.isSafeInteger(attempts)||attempts<0)throw new RangeError('Attempt count must be a nonnegative integer');
  if(!['H','V',0,1].includes(initial))throw new RangeError('Initial direction must be H or V');
  let power=episode(rationalProbability(a),rationalProbability(b),rationalProbability(beta)).F;
  let result=[[ONE,ZERO],[ZERO,ONE]],n=attempts;
  const multiply=(A,B)=>A.map(row=>[0,1].map(j=>sum(row.map((value,k)=>value.mul(B[k][j])))));
  while(n>0){if(n%2)result=multiply(result,power);n=Math.floor(n/2);if(n)power=multiply(power,power);}
  return sum(result[initial==='H'||initial===0?0:1]).toJSON();
}

/** General finite-state frozen-lattice support criterion, with exact inputs. */
export function analyzeFailureLiveness({actionProbabilities,failureTransitions,availability,initial=0}) {
  const pi=actionProbabilities.map(row=>row.map(rationalProbability));
  const transitions=failureTransitions.map(byAction=>byAction.map(row=>row.map(rationalProbability)));
  const hazards=availability.map(rationalProbability),Q=pi.length,O=hazards.length;
  if(!Q||!O||!Number.isInteger(initial)||initial<0||initial>=Q)throw new RangeError('Invalid controller dimensions or initial state');
  for(let q=0;q<Q;q++) {
    if(pi[q].length!==O||!sum(pi[q]).eq(ONE)||transitions[q]?.length!==O)throw new TypeError('Invalid action probability row');
    for(let o=0;o<O;o++)if(transitions[q][o]?.length!==Q||!sum(transitions[q][o]).eq(ONE))throw new TypeError('Invalid failure transition row');
  }
  const build=weighted=>pi.map((row,q)=>Array.from({length:Q},(_,next)=>sum(row.map((probability,o)=>
    probability.mul(weighted?ONE.sub(hazards[o]):ONE).mul(transitions[q][o][next])))));
  const F=build(true),G=build(false),leakage=F.map(row=>ONE.sub(sum(row)));
  const graph=matrix=>matrix.map(row=>row.flatMap((probability,next)=>probability.zero?[]:[next]));
  const reachable=(edges,start)=>{const result=new Set([start]);for(const q of result)for(const next of edges[q])result.add(next);return result;};
  const bottomComponents=(edges,states)=>{
    const index=Array(Q).fill(-1),low=[],stack=[],active=new Set(),components=[];let counter=0;
    const visit=q=>{
      index[q]=low[q]=counter++;stack.push(q);active.add(q);
      for(const next of edges[q])if(states.has(next)){
        if(index[next]<0){visit(next);low[q]=Math.min(low[q],low[next]);}
        else if(active.has(next))low[q]=Math.min(low[q],index[next]);
      }
      if(index[q]===low[q]){const component=[];let next;do{next=stack.pop();active.delete(next);component.push(next);}while(next!==q);components.push(component.sort((a,b)=>a-b));}
    };
    for(const q of states)if(index[q]<0)visit(q);
    return components.filter(component=>{const members=new Set(component);return component.every(q=>edges[q].every(next=>members.has(next)));});
  };
  const edges=graph(F),states=reachable(edges,initial),classes=bottomComponents(edges,states);
  const deadClasses=classes.filter(component=>component.every(q=>leakage[q].zero));
  const Gedges=graph(G),Gstates=reachable(Gedges,initial),Gclasses=bottomComponents(Gedges,Gstates);
  const classSupport=Gclasses.map(states=>({states,orientations:Array.from({length:O},(_,o)=>o).filter(o=>states.some(q=>!pi[q][o].zero))}));
  return {
    failureKernel:jsonMatrix(F),unweightedFailureKernel:jsonMatrix(G),rowLeakage:leakage.map(value=>value.toJSON()),
    reachableStates:[...states].sort((a,b)=>a-b),bottomClasses:classes,nonleakingBottomClasses:deadClasses,
    almostSureNextSuccess:deadClasses.length===0,
    geometricJam:hazards.every(value=>value.zero),
    strongAllAvailabilityFailureFair:classSupport.every(record=>record.orientations.length===O),
    unweightedBottomClassActionSupport:classSupport,
    scope:'Specific frozen-lattice criterion uses F. Strong G support covers arbitrary availability/state-pair liveness, not necessity for empty-start physical RSA.',
  };
}

/** Exact stochastic two-state adsorption, with an initially fair H/V state. */
export function exactStochasticTerminal({L,k,alpha,beta,boundary='periodic'}) {
  const A=rationalProbability(alpha),B=rationalProbability(beta),placements=enumeratePlacements(L,k,boundary),M=placements[0].length;
  const memo=new Map();let inversions=0,deadStates=0;
  const solve=(mask,q)=>{
    const key=`${mask}:${q}`;if(memo.has(key))return memo.get(key);
    const legal=placements.map(row=>row.filter(candidate=>!(candidate&mask))),law=new Map();
    if(legal[0].length+legal[1].length===0){law.set(`${mask}:0:0:geometric`,ONE);const answer={law,attempts:ZERO};memo.set(key,answer);return answer;}
    const kernel=episode(new Fraction(BigInt(legal[0].length),BigInt(M)),new Fraction(BigInt(legal[1].length),BigInt(M)),B);
    if(kernel.N)inversions++;
    if(!kernel.nonSuccess[q].zero){deadStates++;law.set(`${mask}:0:0:deadlock`,ONE);const answer={law,attempts:ZERO};memo.set(key,answer);return answer;}
    let attempts=kernel.waiting[q];
    for(let orientation=0;orientation<2;orientation++) {
      const directionMass=kernel.probabilities[q][orientation];if(directionMass.zero)continue;
      const perAnchor=directionMass.div(new Fraction(BigInt(legal[orientation].length)));
      for(const candidate of legal[orientation]) for(const next of [0,1]) {
        const transition=next===orientation?ONE.sub(A):A,mass=perAnchor.mul(transition);if(mass.zero)continue;
        const child=solve(mask|candidate,next);attempts=attempts.add(mass.mul(child.attempts));
        for(const [terminal,p]of child.law){const [end,h,v,reason]=terminal.split(':');
          addMass(law,`${end}:${Number(h)+Number(orientation===0)}:${Number(v)+Number(orientation===1)}:${reason}`,mass.mul(p));}
      }
    }
    if(!sum([...law.values()]).eq(ONE))throw new Error(`Absorption conservation failed at ${key}`);
    const answer={law,attempts};memo.set(key,answer);return answer;
  };
  const initial=[solve(0,0),solve(0,1)],law=new Map();
  for(const answer of initial)for(const[key,p]of answer.law)addMass(law,key,p.mul(HALF));
  const attempts=initial[0].attempts.add(initial[1].attempts).mul(HALF);
  const metrics={coverage:ZERO,coverageSquared:ZERO,absOrder:ZERO,order:ZERO,orderSquared:ZERO,orderFourth:ZERO,
    deadlockProbability:ZERO,geometricProbability:ZERO,particleCount:ZERO,expectedTerminalAttempts:attempts};
  const distribution=[],coverageLaw=new Map();
  for(const[key,p]of law){const[maskText,hText,vText,reason]=key.split(':'),mask=Number(maskText),h=Number(hText),v=Number(vText),count=h+v;
    const coverage=new Fraction(BigInt(popcount(mask)),BigInt(L*L)),order=count?new Fraction(BigInt(h-v),BigInt(count)):ZERO;
    const square=order.mul(order),fourth=square.mul(square);
    for(const[name,observable]of Object.entries({coverage,coverageSquared:coverage.mul(coverage),order,
      absOrder:new Fraction(order.n<0n?-order.n:order.n,order.d),orderSquared:square,orderFourth:fourth,particleCount:new Fraction(BigInt(count))}))metrics[name]=metrics[name].add(p.mul(observable));
    metrics[reason==='deadlock'?'deadlockProbability':'geometricProbability']=metrics[reason==='deadlock'?'deadlockProbability':'geometricProbability'].add(p);
    addMass(coverageLaw,String(popcount(mask)),p);
    distribution.push({occupiedMask:mask,horizontal:h,vertical:v,reason,probability:p.toJSON()});
  }
  metrics.coverageVariance=metrics.coverageSquared.sub(metrics.coverage.mul(metrics.coverage));
  metrics.expectedFailures=attempts.sub(metrics.particleCount);
  if(!metrics.order.zero)throw new Error('Fair initialization violated exact H/V order symmetry');
  return {
    parameters:{L,k,boundary,alpha:A.number(),beta:B.number(),alphaRational:A.toJSON(),betaRational:B.toJSON(),initialOrientation:'fair'},
    method:'BigInt rational inverse of the two-state substochastic failure kernel, followed by occupancy-monotone memoized recursion; fair initial H/V mixture.',
    stoppingConvention:'Attempts stop at entry into geometric jam or recognizable controller deadlock; beta=0 deadlock has zero additional recognition time, not a finite time to next success.',
    metrics:Object.fromEntries(Object.entries(metrics).map(([name,value])=>[name,value.toJSON()])),
    terminalCoverageLaw:[...coverageLaw].map(([occupied,probability])=>({occupied:Number(occupied),probability:probability.toJSON()})).sort((a,b)=>a.occupied-b.occupied),
    distribution:distribution.sort((a,b)=>a.occupiedMask-b.occupiedMask||a.horizontal-b.horizontal||a.reason.localeCompare(b.reason)),
    diagnostics:{memoizedStates:memo.size,kernelInversions:inversions,deadStates},
  };
}

export function exactSmallStudy() {
  const grid=['0','1/2','1'],extra=[['1/4','3/4'],['3/4','1/4'],['0','1/4'],['1','1/4']];
  const pairs=[...grid.flatMap(alpha=>grid.map(beta=>[alpha,beta])),...extra];
  return {schemaVersion:1,coreGrid:grid,additionalValidationPairs:extra,initialOrientation:'fair',
    cases:[...[2,3].flatMap(L=>['periodic','open'].flatMap(boundary=>pairs.map(([alpha,beta])=>exactStochasticTerminal({L,k:2,boundary,alpha,beta}))))]};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const root=new URL('../',import.meta.url),output=new URL('data/processed/',root);mkdirSync(output,{recursive:true});
  const hash=path=>createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex');
  const result={generatedAtUTC:new Date().toISOString(),nodeVersion:process.version,
    sourceHashes:{'src/exact-stochastic.mjs':hash('src/exact-stochastic.mjs'),'../src/exact.mjs':hash('../src/exact.mjs')},...exactSmallStudy()};
  writeFileSync(new URL('exact-small-systems.json',output),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({output:fileURLToPath(new URL('exact-small-systems.json',output)),cases:result.cases.length,coreGrid:result.coreGrid,additionalValidationPairs:result.additionalValidationPairs}));
}
