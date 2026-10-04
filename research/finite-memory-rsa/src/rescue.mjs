import {RNG} from './rng.mjs';
import {Lattice} from './lattice.mjs';

/** Diagnostic intervention, NOT an admissible one-bit policy: an external
 * observer restarts fair i.i.d. deposition after controller termination.
 * Existing particles never move. It measures unrealized geometric capacity.
 */
export function rescueSnapshot(snapshot,seed){
 const {L,k,boundary,occupancy}=snapshot,lat=new Lattice(L,k,boundary),rng=new RNG(seed);
 if(occupancy.length!==lat.N||occupancy.some(v=>![0,1,2].includes(v)))throw new Error('Invalid snapshot');
 lat.occupancy.set(occupancy);
 for(let o=0;o<2;o++)for(let a=0;a<lat.N;a++)if(!lat.canPlace(o,a))lat.remove(o,a);
 lat.particles=[occupancy.filter(v=>v===1).length/k,occupancy.filter(v=>v===2).length/k];
 if(lat.particles.some(n=>!Number.isInteger(n)))throw new Error('Incomplete particle labels');
 lat.validate();const before=lat.particles[0]+lat.particles[1];
 while(lat.counts[0]+lat.counts[1]){
  const o=Number(rng.integer(lat.counts[0]+lat.counts[1])>=lat.counts[0]);
  lat.place(o,lat.legal[o][rng.integer(lat.counts[o])]);
 }
 lat.validate();const [h,v]=lat.particles,n=h+v;
 return {coverage:n*k/lat.N,order:(h-v)/n,abs_order:Math.abs((h-v)/n),addedParticles:n-before,coverageGain:(n-before)*k/lat.N,geometricJammed:true,lattice:{L,k,boundary,occupancy:Array.from(lat.occupancy)}};
}
