import {test,expect} from 'vitest';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {JobsService,catalog,familyFor}=require('../services/gateway/dist/a1/jobs.js');

test('private commands and malformed public status requests fail before opening storage',async()=>{
 const previous=process.env.OCV_RUNNER_KEY;process.env.OCV_RUNNER_KEY='a'.repeat(64);const jobs=new JobsService();
 try{
  await expect(jobs.control(undefined,{worker:randomUUID(),action:'claim'})).rejects.toMatchObject({status:404});
  await expect(jobs.control('b'.repeat(64),{worker:randomUUID(),action:'claim'})).rejects.toMatchObject({status:404});
  await expect(jobs.control('a'.repeat(64),{worker:randomUUID(),action:'shell',command:'docker stop postgres'})).rejects.toMatchObject({status:400});
  await expect(jobs.status('../x',{ticket:'b'.repeat(64)})).rejects.toMatchObject({status:400});
  await expect(jobs.status(randomUUID(),{ticket:'b'.repeat(64),password:'x'})).rejects.toMatchObject({status:400});
  process.env.OCV_RUNNER_KEY='';await expect(jobs.enqueue(randomUUID(),'b'.repeat(64),'json','c'.repeat(64))).resolves.toBeNull();
 }finally{await jobs.onModuleDestroy();if(previous===undefined)delete process.env.OCV_RUNNER_KEY;else process.env.OCV_RUNNER_KEY=previous;}
});
test('catalogue covers every optional service and resolves known and uncommon tool IDs',()=>{
 const optional=new Set(catalog.families.flatMap(f=>f.steps.flat()));
 expect([...optional].sort()).toEqual(['spring','fastapi','mysql','laravel','fiber','dotnet','sinatra','hono','minio','mongo','elasticsearch','rabbitmq','kafka','message-bridge','message-consumer','otel','prometheus','grafana'].sort());
 expect(familyFor('base64')).toBe('messages');expect(familyFor('json')).toBe('relay');
 expect(catalog.families.map(f=>f.id)).toContain(familyFor('unit-converter'));
});
