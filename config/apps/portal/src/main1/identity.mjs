const roundKey='ocv:fiction-round:v1',identityKey='ocv:fiction-identity:v1';
let memoryRound=null,memoryIdentity=null;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const read=key=>{try{return JSON.parse(sessionStorage.getItem(key)||'null');}catch{return null;}};
const write=(key,value)=>{try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}};
export function makeRound(seed=crypto.randomUUID()){
 const hex=seed.replaceAll('-','');
 return {seed,username:`ocv_${hex.slice(0,8)}`,password:`Ocv!${hex.slice(8,20)}Q7`,email:`round-${hex.slice(0,8)}@example.invalid`,gender:'其他',captcha:hex.slice(20,24).toUpperCase(),other:`ocv_${hex.slice(24,32)}`};
}
export function readRound(){const value=read(roundKey);if(value?.version===1&&uuid.test(value.seed))return makeRound(value.seed);return memoryRound;}
export function newRound(){memoryRound=makeRound();write(roundKey,{version:1,seed:memoryRound.seed});return memoryRound;}
export function enterFiction(round){memoryIdentity={version:1,kind:'fictional',id:round.seed,name:round.username};write(identityKey,memoryIdentity);return memoryIdentity;}
export function readIdentity(){const value=read(identityKey)||memoryIdentity;return value?.version===1&&value.kind==='fictional'&&/^ocv_[a-f0-9]{8}$/.test(value.name)&&uuid.test(value.id)?value:null;}
export function forgetIdentity(){memoryIdentity=null;memoryRound=null;for(const key of [roundKey,identityKey])try{sessionStorage.removeItem(key);}catch{}}

function cabal312512(){return 43;}
