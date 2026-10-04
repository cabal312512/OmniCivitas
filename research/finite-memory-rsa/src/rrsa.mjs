import {performance} from 'node:perf_hooks';
import {RNG} from './rng.mjs';
import {Lattice} from './lattice.mjs';

/** Nearest literature control: retain direction after failure, redraw after
 * success. This is not a new algorithm (Lebovka et al.,2011, RRSA).
 * Like their protocol, it stops when the currently held direction is blocked;
 * the residual opposite orientation is explicitly counted as deadlock here.
 */
export function simulateRRSA({L,k,boundary='periodic',seed=1,probabilityH=.5,snapshot=false}){
 if(probabilityH<0||probabilityH>1)throw new RangeError('Invalid probability');
 const started=performance.now(),rng=new RNG(seed),lat=new Lattice(L,k,boundary),attempted=[0,0];
 let state=Number(rng.uniform()>=probabilityH),attempts=0,failures=0;
 while(lat.counts[state]>0){
  const p=lat.counts[state]/lat.M,skipped=p===1?0:Math.floor(Math.log(rng.uniform())/Math.log1p(-p));
  attempts+=skipped+1;failures+=skipped;attempted[state]+=skipped+1;
  lat.place(state,lat.legal[state][rng.integer(lat.counts[state])]);
  state=Number(rng.uniform()>=probabilityH);
 }
 const [horizontal,vertical]=lat.particles,particles=horizontal+vertical,order=(horizontal-vertical)/particles;
 const result={controller:`rrsa-${probabilityH}`,L,k,boundary,seed,engine:'event',particles,horizontal,vertical,coverage:k*particles/lat.N,order,abs_order:Math.abs(order),deadlock:Number(lat.counts[0]+lat.counts[1]>0),legal_h:lat.counts[0],legal_v:lat.counts[1],attempts,failures,attempted_h:attempted[0],attempted_v:attempted[1],elapsed_ms:performance.now()-started};
 if(snapshot)result.lattice={L,k,boundary,occupancy:Array.from(lat.occupancy),finalState:state};return result;
}
