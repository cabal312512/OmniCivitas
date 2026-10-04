export const BITS=48n,SCALE=1n<<BITS;
export const ceilDiv=(n,d)=>{if(d<=0n)throw new RangeError('Positive divisor');return n/d+(n%d>0n?1n:0n);};
export const upperQ=q=>ceilDiv(q.n*SCALE,q.d);
export const decimal=x=>Number(x)/Number(SCALE);
