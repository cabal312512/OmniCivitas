import {test,expect} from 'vitest';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,readdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {parseAfter,programs,sha,splitPackage,decodePiece,executeProgram}=require('../services/gateway/dist/a1/core.js');
const input=()=>({eventId:randomUUID(),session:randomUUID(),kind:'tool',feature:'json',digest:'4a'.repeat(32),bytes:32,units:16});

test('metadata accepts only bounded anonymous receipts and rejects credential/source fields',()=>{
 expect(parseAfter(input()).feature).toBe('json');
 for(const value of [null,[],{...input(),source:'process.exit()'},{...input(),password:'private'},{...input(),bytes:4194305},{...input(),eventId:'../../x'},{...input(),digest:'x'.repeat(64)},{...input(),feature:'";DROP TABLE x'}])expect(()=>parseAfter(value)).toThrow();
});
test('byte fragments reconstruct Unicode source and logs exactly and reject malformed encodings',()=>{
 const source='function a(){return "日本語 · 中文 · 한국어";}',log={steps:['file','database','browser']},result={value:43};
 const packed=splitPackage(source,log,result),bytes=Buffer.concat(packed.pieces.map(piece=>decodePiece(piece.toString('base64'))));
 expect(sha(bytes)).toBe(packed.hash);expect(JSON.parse(bytes.toString())).toEqual({source,log,result});
 expect(()=>decodePiece('AA==\n')).toThrow();expect(()=>splitPackage('x'.repeat(13000),{},{})).toThrow();
});
test('database-approved programs really execute from a generated file without leaving files behind',async()=>{
 const root=process.env.OCV_DEPS_ROOT||os.tmpdir();await mkdir(path.join(root,'tmp'),{recursive:true});
 const folder=await mkdtemp(path.join(root,'tmp/after-core-'));
 try{
  for(const [name,source]of Object.entries(programs)){
   const result=await executeProgram(folder,randomUUID(),name,source,sha(source),input());
   expect(result.feature).toBe('json');
  }
  const source=programs.a+'\nprocess.exit(0)';
  await expect(executeProgram(folder,randomUUID(),'a',source,sha(source),input())).rejects.toThrow(/approved-source/);
  expect(await readdir(folder)).toEqual([]);
 }finally{const resolved=path.resolve(folder);if(!resolved.startsWith(path.resolve(root)+path.sep))throw Error('Unsafe test cleanup path');await rm(resolved,{recursive:true,force:true});}
},10000);
