import {test,expect} from 'vitest';
import http from 'node:http';
import {createRequire} from 'node:module';
import {boundedTransport,receiptBodyLimit} from '../services/archive/src/api/guards.mjs';
const require=createRequire(new URL('../services/archive/package.json',import.meta.url));
const {Hono}=await import(require.resolve('hono'));

test('chunked receipt bodies exceeding 16 KiB are rejected before their handler',async()=>{
 const app=new Hono();let handled=false;app.use('*',receiptBodyLimit);
 app.post('/',async c=>{handled=true;await c.req.json();return c.json({ok:true})});
 const body=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('a'.repeat(17000)));controller.close()}});
 const result=await app.request('/',{method:'POST',headers:{'transfer-encoding':'chunked'},body,duplex:'half'});
 expect(result.status).toBe(413);expect(handled).toBe(false);expect((await result.json()).canContinue).toBe(false);
});

test('object storage timeout destroys a stalled request rather than leaving it pending',async()=>{
 const server=http.createServer(()=>{});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const started=Date.now();const error=await new Promise(resolve=>{
   const request=boundedTransport.request({hostname:'127.0.0.1',port:server.address().port,path:'/'});
   request.on('error',resolve);request.end();
  });
  expect(error.message).toBe('Object storage deadline exceeded');expect(Date.now()-started).toBeLessThan(3500);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
},5000);
