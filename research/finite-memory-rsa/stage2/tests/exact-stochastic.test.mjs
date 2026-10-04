import test from 'node:test';
import assert from 'node:assert/strict';
import { Fraction, exactTerminal } from '../../src/exact.mjs';
import { rationalProbability, nextSuccessKernel, nextSuccessSurvival, analyzeFailureLiveness, exactStochasticTerminal, exactSmallStudy } from '../src/exact-stochastic.mjs';

const F=value=>new Fraction(value.numerator,value.denominator);
const eq=(actual,n,d=1)=>assert(F(actual).eq(new Fraction(n,d)),`${JSON.stringify(actual)} != ${n}/${d}`);
const near=(actual,expected)=>assert(Math.abs(actual-expected)<1e-11,`${actual} != ${expected}`);

test('rational stochastic probabilities preserve decimal/rational values and reject invalid inputs',()=>{
  assert(rationalProbability(.05).eq(new Fraction(1n,20n)));
  assert(rationalProbability('1/4').eq(new Fraction(1n,4n)));
  assert(rationalProbability('1e-4').eq(new Fraction(1n,10000n)));
  for(const value of [-.1,1.1,NaN,Infinity,'2/0'])assert.throws(()=>rationalProbability(value));
});

test('frozen failure inverse obeys exact matrix identity and total next-success probability',()=>{
  for(const[a,b,beta]of [[0,.5,.5],[.5,0,1],[.25,.75,.5],[.75,.25,1],[1,0,.25],[1,1,0],[.5,.5,0]]) {
    const kernel=nextSuccessKernel({a,b,beta}),N=kernel.fundamental.map(row=>row.map(F)),failure=kernel.failureMatrix.map(row=>row.map(F));
    for(let i=0;i<2;i++)for(let j=0;j<2;j++) {
      const product=[0,1].reduce((sum,k)=>sum.add(N[i][k].mul(new Fraction(k===j?1:0).sub(failure[k][j]))),new Fraction());
      assert(product.eq(new Fraction(i===j?1:0)));
    }
    for(const row of kernel.successOrientationProbabilities)assert(F(row[0]).add(F(row[1])).eq(new Fraction(1)));
  }
});

test('blocked-direction waiting has exact 1/beta divergence and legal-start mean discontinuity',()=>{
  for(const beta of ['1','1/2','1/4','1/10000']) {
    const kernel=nextSuccessKernel({a:0,b:'1/2',beta}),B=rationalProbability(beta);
    assert(F(kernel.expectedNextSuccessAttempts[0]).eq(new Fraction(1).div(B).add(new Fraction(3))));
    eq(kernel.expectedNextSuccessAttempts[1],3);
  }
  const zero=nextSuccessKernel({a:0,b:'1/2',beta:0});
  assert.equal(zero.expectedNextSuccessAttempts[0],null);eq(zero.expectedNextSuccessAttempts[1],2);
  eq(zero.expectedRecognitionOrSuccessAttempts[0],0);eq(zero.nonSuccessProbability[0],1);
});

test('exact survival tails distinguish long waiting from a true beta-zero deadlock',()=>{
  eq(nextSuccessSurvival({a:0,b:.5,beta:0,initial:'H',attempts:20}),1);
  eq(nextSuccessSurvival({a:0,b:.5,beta:0,initial:'V',attempts:4}),1,16);
  eq(nextSuccessSurvival({a:0,b:.5,beta:.5,initial:'H',attempts:4}),27,64);
  eq(nextSuccessSurvival({a:0,b:.5,beta:.5,initial:'V',attempts:4}),27,128);
  eq(nextSuccessSurvival({a:0,b:.5,beta:.5,initial:'V',attempts:0}),1);
});

test('rare-excursion kinetic variance diverges even when the legal-start mean stays finite',()=>{
  for(const beta of ['1','1/2','1/10000']) {
    const kernel=nextSuccessKernel({a:0,b:'1/2',beta}),B=rationalProbability(beta),inverse=new Fraction(1).div(B);
    assert(F(kernel.nextSuccessAttemptVariance[1]).eq(inverse.mul(new Fraction(2)).add(new Fraction(6))));
    assert(F(kernel.nextSuccessAttemptVariance[0]).eq(inverse.mul(inverse).add(inverse).add(new Fraction(6))));
  }
  const zero=nextSuccessKernel({a:0,b:'1/2',beta:0});
  assert.equal(zero.nextSuccessAttemptVariance[0],null);eq(zero.nextSuccessAttemptVariance[1],2);
});

test('2x2 dimers have analytic endpoint density/deadlock and recognition-time laws',()=>{
  for(const boundary of ['periodic','open'])for(const alpha of ['0','1/4','1/2','1']) {
    const A=rationalProbability(alpha),zero=exactStochasticTerminal({L:2,k:2,boundary,alpha,beta:0});
    assert(F(zero.metrics.coverage).eq(new Fraction(1).sub(A.div(new Fraction(2)))));
    assert(F(zero.metrics.deadlockProbability).eq(A));
    assert(F(zero.metrics.expectedTerminalAttempts).eq(new Fraction(3).sub(A.mul(new Fraction(2)))));
    for(const beta of ['1/10000','1/4','1/2','1']) {
      const positive=exactStochasticTerminal({L:2,k:2,boundary,alpha,beta});
      eq(positive.metrics.coverage,1);eq(positive.metrics.deadlockProbability,0);eq(positive.metrics.order,0);eq(positive.metrics.absOrder,1);
      assert(F(positive.metrics.expectedTerminalAttempts).eq(new Fraction(4).add(A.div(rationalProbability(beta)))));
    }
  }
});

test('special stochastic points agree with read-only Stage I exact references',()=>{
  for(const L of [2,3])for(const boundary of ['periodic','open'])for(const[alpha,beta,controller]of [[0,0,0],[0,1,41],[1,0,38],[1,1,35],[.5,.5,'fair']]) {
    const reference=exactTerminal({L,k:2,boundary,...(controller==='fair'?{baseline:'fair'}:{controller})});
    const result=exactStochasticTerminal({L,k:2,boundary,alpha,beta});
    for(const name of ['coverage','absOrder','deadlockProbability','geometricProbability'])assert.deepEqual(result.metrics[name],reference.metrics[name]);
    eq(result.metrics.order,0);
  }
});

test('monomers fill the lattice with controller-independent coupon-collector attempt mean',()=>{
  for(const alpha of [0,.5,1])for(const beta of [0,.5,1]) {
    const answer=exactStochasticTerminal({L:2,k:1,alpha,beta});
    eq(answer.metrics.coverage,1);eq(answer.metrics.deadlockProbability,0);eq(answer.metrics.expectedTerminalAttempts,25,3);
  }
});

test('geometry-weighted action/failure transitions can remove an apparently reachable bad class',()=>{
  // A failed H action would lead to q1, but H succeeds with certainty here.
  // Conditioning failure therefore leaves only V, whose transition stays q0.
  const controller={actionProbabilities:[[.5,.5],[0,1]],failureTransitions:[[[0,1],[1,0]],[[0,1],[0,1]]],availability:[1,0],initial:0};
  const answer=analyzeFailureLiveness(controller);
  assert.equal(answer.almostSureNextSuccess,true);assert.deepEqual(answer.reachableStates,[0]);
  assert.equal(answer.strongAllAvailabilityFailureFair,false);
  eq(answer.failureKernel[0][0],1,2);eq(answer.failureKernel[0][1],0);
  assert.equal(analyzeFailureLiveness({...controller,availability:[.5,0]}).almostSureNextSuccess,false);
});

test('transient support of a legal orientation does not establish almost-sure success',()=>{
  const answer=analyzeFailureLiveness({actionProbabilities:[[1,0],[0,1]],failureTransitions:[[[0,1],[0,1]],[[0,1],[0,1]]],availability:[.5,0],initial:0});
  assert.equal(answer.almostSureNextSuccess,false);assert.deepEqual(answer.nonleakingBottomClasses,[[1]]);
});

test('a strong full-action-support certificate is not necessary for a specific physical lattice',()=>{
  const answer=analyzeFailureLiveness({actionProbabilities:[[1,0]],failureTransitions:[[[1],[1]]],availability:[.5,.5]});
  assert.equal(answer.almostSureNextSuccess,true);assert.equal(answer.strongAllAvailabilityFailureFair,false);
});

// Independent attempt-level Markov equations for two-by-two dimers. These
// equations retain every failed attempt and do not use the failure inverse.
function fullTrialOracle(alpha,beta,boundary) {
  const placements=boundary==='periodic'?[[3,3,12,12],[5,10,5,10]]:[[3,12],[5,10]],M=placements[0].length;
  const nodes=[{mask:0,q:0},{mask:0,q:1}],lookup=new Map([['0:0',0],['0:1',1]]),edges=[],absorbing=new Map();
  for(let index=0;index<nodes.length;index++) {
    const{mask,q}=nodes[index],legal=placements.map(row=>row.filter(candidate=>!(candidate&mask)).length),row=new Map();
    if(legal[0]+legal[1]===0||(beta===0&&legal[q]===0)) {
      absorbing.set(index,[mask.toString(2).replaceAll('0','').length/4,Number(legal[0]+legal[1]>0),0]);edges.push(row);continue;
    }
    for(const candidate of placements[q]) {
      const success=(candidate&mask)===0,nextMask=success?mask|candidate:mask,flip=success?alpha:beta;
      for(const nextQ of [0,1]) {
        const probability=(nextQ===q?1-flip:flip)/M;if(probability===0)continue;
        const key=`${nextMask}:${nextQ}`;
        if(!lookup.has(key)){lookup.set(key,nodes.length);nodes.push({mask:nextMask,q:nextQ});}
        const next=lookup.get(key);row.set(next,(row.get(next)??0)+probability);
      }
    }
    edges.push(row);
  }
  const transient=nodes.flatMap((_,i)=>absorbing.has(i)?[]:[i]),indices=new Map(transient.map((node,i)=>[node,i])),n=transient.length;
  const matrix=transient.map((node,i)=>{
    const row=Array(n+3).fill(0);row[i]=1;row[n+2]=1;
    for(const[next,probability]of edges[node])if(absorbing.has(next))for(let k=0;k<3;k++)row[n+k]+=probability*absorbing.get(next)[k];else row[indices.get(next)]-=probability;
    return row;
  });
  for(let column=0;column<n;column++) {
    let pivot=column;for(let i=column+1;i<n;i++)if(Math.abs(matrix[i][column])>Math.abs(matrix[pivot][column]))pivot=i;
    [matrix[column],matrix[pivot]]=[matrix[pivot],matrix[column]];
    const divisor=matrix[column][column];assert(Math.abs(divisor)>1e-12);
    for(let j=column;j<n+3;j++)matrix[column][j]/=divisor;
    for(let i=0;i<n;i++)if(i!==column){const coefficient=matrix[i][column];for(let j=column;j<n+3;j++)matrix[i][j]-=coefficient*matrix[column][j];}
  }
  return [0,1,2].map(k=>[0,1].reduce((total,node)=>total+(absorbing.has(node)?absorbing.get(node)[k]:matrix[indices.get(node)][n+k])/2,0));
}

test('all nine core points match an independent full-trial global Markov oracle for both boundaries',()=>{
  for(const alpha of [0,.5,1])for(const beta of [0,.5,1])for(const boundary of ['periodic','open']) {
    const reference=fullTrialOracle(alpha,beta,boundary),answer=exactStochasticTerminal({L:2,k:2,alpha,beta,boundary});
    for(const[name,i]of [['coverage',0],['deadlockProbability',1],['expectedTerminalAttempts',2]])near(answer.metrics[name].value,reference[i]);
  }
});

test('the full small-system reference conserves probability and beta-positive liveness',()=>{
  const study=exactSmallStudy();assert.equal(study.cases.length,52);
  for(const answer of study.cases) {
    assert(answer.distribution.reduce((total,row)=>total.add(F(row.probability)),new Fraction()).eq(new Fraction(1)));
    assert(F(answer.metrics.geometricProbability).add(F(answer.metrics.deadlockProbability)).eq(new Fraction(1)));
    eq(answer.metrics.order,0);
    if(answer.parameters.beta>0)eq(answer.metrics.deadlockProbability,0);
    assert(answer.metrics.expectedFailures.value>=0);
  }
});
