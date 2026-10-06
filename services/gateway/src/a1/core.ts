import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {writeFile,unlink,realpath} from 'node:fs/promises';
import path from 'node:path';

export const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
export type AfterInput={eventId:string;session:string;kind:'tool'|'export'|'window'|'route';feature:string;digest:string;bytes:number;units:number};
export const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function parseAfter(input:unknown):AfterInput {
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Receipt must be an object');
  const p=input as Record<string,unknown>,keys=['eventId','session','kind','feature','digest','bytes','units'];
  if(Object.keys(p).length!==keys.length||Object.keys(p).some(k=>!keys.includes(k)))throw Error('Only receipt metadata is accepted');
  if(typeof p.eventId!=='string'||!uuid.test(p.eventId)||typeof p.session!=='string'||!uuid.test(p.session))throw Error('Invalid receipt id');
  if(!['tool','export','window','route'].includes(String(p.kind)))throw Error('Invalid receipt kind');
  if(typeof p.feature!=='string'||!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(p.feature))throw Error('Invalid feature');
  if(typeof p.digest!=='string'||!/^[a-f0-9]{64}$/.test(p.digest))throw Error('Invalid digest');
  for(const key of ['bytes','units'])if(!Number.isInteger(p[key])||Number(p[key])<0||Number(p[key])>4194304)throw Error('Metadata out of range');
  return p as AfterInput;
}

const wrapper=(body:string)=>`${body}\nlet receipt='';for await(const chunk of process.stdin){receipt+=chunk;if(receipt.length>2048)throw Error('Receipt too large');}\nprocess.stdout.write(JSON.stringify(cabal312512(JSON.parse(receipt))));\n`;
export const programs:Record<string,string>={
  'a':wrapper(`function cabal312512(p){const a=p.digest.match(/../g).map(x=>parseInt(x,16));let carry=0;const ledger=[];for(let i=0;i<a.length;i++){carry=(carry*33+a[i]+i)%65521;ledger.push(carry);}return {checksum:carry,ledger:ledger.filter((_,i)=>i%4===0),bytes:p.bytes,feature:p.feature};}`),
  'b':wrapper(`function cabal312512(p){const a=p.digest.match(/../g).map(x=>parseInt(x,16)).sort((a,b)=>a-b);const bins=Array(8).fill(0);for(const n of a)bins[n>>5]++;return {bins,median:(a[15]+a[16])/2,weight:a.reduce((n,x,i)=>n+x*(i+1),0)%65521,feature:p.feature};}`),
  'c':wrapper(`function cabal312512(p){const a=p.digest.match(/../g).map(x=>parseInt(x,16));const offices=['R4','A2','P8','N1','D0','A2','R4'];let seat=p.bytes%7;const itinerary=[];for(let i=0;i<14;i++){seat=(seat+a[i%32]+i)%7;itinerary.push(offices[seat]);}return {itinerary,residue:(a.reduce((n,x)=>n+x,0)+p.units)%97,feature:p.feature};}`)
};
export function verifyProgram(name:string,source:string,hash:string){
  if(!Object.hasOwn(programs,name)||source!==programs[name]||hash!==sha(source))throw Error('Stored program failed the approved-source check');
}
export function splitPackage(source:string,log:Record<string,unknown>,result:unknown){
  const packageBytes=Buffer.from(JSON.stringify({source,log,result}));
  if(packageBytes.length>12288)throw Error('Package exceeds its limit');
  const first=Math.ceil(packageBytes.length/3),second=Math.ceil(packageBytes.length*2/3);
  return {pieces:[packageBytes.subarray(0,first),packageBytes.subarray(first,second),packageBytes.subarray(second)],hash:sha(packageBytes)};
}
export function decodePiece(piece:unknown){
  if(typeof piece!=='string'||piece.length>6000||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(piece))throw Error('Invalid fragment');
  const bytes=Buffer.from(piece,'base64');if(bytes.toString('base64')!==piece)throw Error('Noncanonical fragment');return bytes;
}
export async function executeProgram(folder:string,id:string,name:string,source:string,hash:string,input:AfterInput){
  verifyProgram(name,source,hash);
  if(!uuid.test(id))throw Error('Invalid generated filename');
  // Permission grants and module loading must use the same canonical path,
  // including macOS /var -> /private/var and Windows directory junctions.
  const directory=await realpath(folder);
  const file=path.join(directory,`${id}.mjs`);
  await writeFile(file,source,{flag:'wx',mode:0o600});
  try {
    return await new Promise<unknown>((resolve,reject)=>{
      const child=spawn(process.execPath,['--permission',`--allow-fs-read=${file}`,'--max-old-space-size=32',file],{
        cwd:directory,env:process.platform==='win32'?{SystemRoot:process.env.SystemRoot||'',NODE_NO_WARNINGS:'1'}:{NODE_NO_WARNINGS:'1'},
        windowsHide:true,stdio:['pipe','pipe','pipe']
      });
      let out='',err='',settled=false;
      const stop=(error?:Error,result?:unknown)=>{if(settled)return;settled=true;clearTimeout(timer);if(error){child.kill('SIGKILL');reject(error);}else resolve(result);};
      const timer=setTimeout(()=>stop(Error('Generated program timed out')),1500);
      child.on('error',()=>stop(Error('Generated program could not start')));
      child.stdin.on('error',()=>stop(Error('Generated program input failed')));
      child.stdout.on('data',chunk=>{out+=chunk;if(Buffer.byteLength(out)>4096)stop(Error('Generated output exceeds limit'));});
      child.stderr.on('data',chunk=>{err+=chunk;if(err.length>1024)stop(Error('Generated stderr exceeds limit'));});
      child.on('close',code=>{if(code!==0){stop(Error('Generated program failed'));return;}try{stop(undefined,JSON.parse(out));}catch{stop(Error('Generated program returned invalid JSON'));}});
      child.stdin.end(JSON.stringify({digest:input.digest,bytes:input.bytes,units:input.units,feature:input.feature}));
    });
  } finally { await unlink(file).catch(()=>{}); }
}
