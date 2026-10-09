import {BadRequestException,Body,Controller,Headers,HttpException,Inject,Injectable,OnModuleDestroy,Param,Post,Res,ServiceUnavailableException} from '@nestjs/common';
import {Pool,PoolClient} from 'pg';
import type {Response} from 'express';
import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {canonicalInvoice,hashInvoice,hexTicket,uuidInvoice,objectInvoice,keysInvoice,validateProject} from '../invoice2/1';
import {validateWorkshopProject} from '../invoice2/stock3';
import {queueLimit,queueTtlSeconds,expireTasksSql,terminalLimit,trimTerminalSql} from '../a1/capacity';

const actions=['versions','diff','branch','rollback','upload-start','upload-put','upload-status','upload-commit','upload-download','upload-abort','room-open','room-join','room-read','room-leave','room-commit'];
const account=/email|phone|password|secret|token/i;
const bytes=(v:unknown)=>Buffer.byteLength(JSON.stringify(v));
function uuidFrom(text:string){const h=hashInvoice(text);return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}

@Injectable()
export class OldInvoices implements OnModuleDestroy {
 private pool?:Pool;private readers=0;
 private db(){if(!process.env.DATABASE_URL)throw new ServiceUnavailableException('Shared storage unavailable');if(!this.pool){this.pool=new Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:1500,statement_timeout:5000});this.pool.on('error',()=>{});}return this.pool;}
 private shape(input:unknown,allowed:string[]){try{const p=objectInvoice(input);keysInvoice(p,allowed);return p;}catch{throw new BadRequestException('Invalid shared request');}}
 private id(value:unknown){if(!uuidInvoice.test(String(value)))throw new BadRequestException('Invalid identifier');return String(value);}
 private cap(value:unknown){if(typeof value!=='string'||!hexTicket.test(value))throw new BadRequestException('Invalid capability');return value;}
 private number(value:unknown,min:number,max:number){if(!Number.isSafeInteger(value)||Number(value)<min||Number(value)>max)throw new BadRequestException('Invalid integer');return Number(value);}
 private privateKey(key:string|undefined){const expected=process.env.OCV_RUNNER_KEY;if(!expected||!key||!hexTicket.test(key)||!timingSafeEqual(Buffer.from(hashInvoice(key)),Buffer.from(hashInvoice(expected))))throw new HttpException('Unavailable endpoint',404);}
 private generated(operation:string,owner:string,label:string){return createHmac('sha256',process.env.OCV_RUNNER_KEY!).update(operation+':'+owner+':'+label).digest('hex');}
 private invoice(v:unknown,domain:string){try{return domain==='workshop'?validateWorkshopProject(v):validateProject(v);}catch{throw new BadRequestException('Invalid engineering project');}}
 async operation(input:unknown){
  if(!process.env.OCV_RUNNER_KEY)throw new ServiceUnavailableException('Shared dispatcher unavailable');
  const p=this.shape(input,['action','project','ticket','domain','operationId','expectedRevision','beforeRevision','afterRevision','sourceRevision','name','projectData','upload','size','digest','part','data','room','client','clientTicket','cursor']);
  if(bytes(p)>196608||!actions.includes(String(p.action))||!['signals','workshop'].includes(String(p.domain)))throw new BadRequestException('Unsupported shared operation');
  const project=this.id(p.project),owner=hashInvoice(this.cap(p.ticket)),op=this.id(p.operationId??randomUUID()),domain=String(p.domain),action=String(p.action);
  const envelope:Record<string,unknown>={contract:'ocv.sh2/1',action,project,ownerHash:owner,domain,operationId:op};
  for(const key of ['expectedRevision','beforeRevision','afterRevision','sourceRevision'])if(p[key]!==undefined)envelope[key]=this.number(p[key],1,2147483646);
  if(p.name!==undefined){if(typeof p.name!=='string'||p.name.length<1||p.name.length>80||/[\x00-\x1f]/.test(p.name))throw new BadRequestException('Invalid branch name');envelope.name=p.name;}
  if(p.projectData!==undefined){const parsed=this.invoice(p.projectData,domain);envelope.canonicalText=parsed.text;envelope.digest=parsed.digest;envelope.name=parsed.name;}
  for(const key of ['room','upload','client'])if(p[key]!==undefined)envelope[key]=this.id(p[key]);
  if(p.clientTicket!==undefined)envelope.clientHash=hashInvoice(this.cap(p.clientTicket));
  if(p.cursor!==undefined)envelope.cursor=this.number(p.cursor,0,Number.MAX_SAFE_INTEGER);
  if(p.size!==undefined)envelope.size=this.number(p.size,1,8388608);
  if(p.part!==undefined)envelope.part=this.number(p.part,0,127);
  if(p.digest!==undefined)envelope.digest=this.cap(p.digest);
  if(p.data!==undefined){if(typeof p.data!=='string'||p.data.length>87384||!/^[A-Za-z0-9+/]*={0,2}$/.test(p.data)||Buffer.from(p.data,'base64').length>65536)throw new BadRequestException('Invalid upload chunk');envelope.data=p.data;}
  let capability:Record<string,string>|undefined;
  if(action==='branch'){const secret=this.generated(op,owner,'branch');const next=uuidFrom(op+':branch');envelope.newProject=next;envelope.newOwnerHash=hashInvoice(secret);capability={project:next,ticket:secret};}
  if(action==='room-open'||action==='room-join'){const client=uuidFrom(op+':client'),secret=this.generated(op,owner,'client'),room=action==='room-open'?uuidFrom(op+':room'):this.id(p.room);envelope.room=room;envelope.client=client;envelope.clientHash=hashInvoice(secret);capability={room,client,clientTicket:secret};}
  if(action==='upload-start')envelope.upload=p.upload?this.id(p.upload):uuidFrom(op+':upload');
  let requestDigest='';const ticket=this.generated(op,owner,'job'),c=await this.db().connect();
  try{
   await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(312512,52)');await c.query('SELECT pg_advisory_xact_lock(312512,81)');
   const head=await c.query('SELECT revision FROM ocv_signals.catalog_stock WHERE id=$1 AND ticket_sha=$2 AND domain=$3',[project,owner,domain]);if(!head.rows.length)throw new HttpException('Project unavailable',404);
   if(action==='branch'){const selected=await c.query('SELECT invoice_text,digest FROM ocv_signals.price_history WHERE project_id=$1 AND revision=$2',[project,p.sourceRevision??head.rows[0].revision]);if(!selected.rows.length||hashInvoice(selected.rows[0].invoice_text)!==selected.rows[0].digest)throw new HttpException('Source snapshot unavailable',404);const snapshot=JSON.parse(selected.rows[0].invoice_text);if(p.name!==undefined)snapshot.name=p.name;const parsed=this.invoice(snapshot,domain);envelope.canonicalText=parsed.text;envelope.digest=parsed.digest;envelope.name=parsed.name;envelope.sourceRevision=p.sourceRevision??head.rows[0].revision;}
   requestDigest=hashInvoice(canonicalInvoice(envelope));
   const old=await c.query('SELECT o.job_id,o.request_digest,j.state FROM ocv_shared4.orders o JOIN ocv_after.jobs j ON j.id=o.job_id WHERE operation_id=$1',[op]);
   if(old.rows.length){if(old.rows[0].request_digest!==requestDigest)throw new HttpException('Operation identifier conflict',409);await c.query('COMMIT');return{id:old.rows[0].job_id,ticket,state:old.rows[0].state,operationId:op,capability,duplicate:true};}
   await c.query(expireTasksSql,[queueTtlSeconds()]);const count=Number((await c.query("SELECT count(*) FROM ocv_after.jobs WHERE state='queued'")).rows[0].count);if(queueLimit()>0&&count>=queueLimit())throw new HttpException('Shared queue occupied',429);
   const id=randomUUID();await c.query("INSERT INTO ocv_after.jobs(id,run_id,ticket_sha,family,feature,digest) VALUES($1,$1,$2,'shared','engineering-version',$3)",[id,hashInvoice(ticket),requestDigest]);
   await c.query('INSERT INTO ocv_shared4.orders(job_id,operation_id,project_id,snapshot_id,operation,input,request_digest) SELECT $1,$2,$3,h.id,$4,$5::jsonb,$6 FROM ocv_signals.price_history h JOIN ocv_signals.catalog_stock p ON p.id=h.project_id AND h.revision=p.revision WHERE p.id=$3',[id,op,project,action,JSON.stringify(envelope),requestDigest]);
   await c.query('UPDATE ocv_shared1.task_books SET owner_bucket=$2 WHERE job_id=$1',[id,project]);await c.query(trimTerminalSql,[terminalLimit()]);await c.query('COMMIT');return{id,ticket,state:'queued',operationId:op,capability};
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 private async job(c:PoolClient,id:string,ticket:string){const row=await c.query('SELECT id,state,phase,result,family,created_at,updated_at,digest FROM ocv_after.jobs WHERE id=$1 AND ticket_sha=$2',[id,hashInvoice(ticket)]);if(!row.rows.length)throw new HttpException('Job expired or unavailable',404);return row.rows[0];}
 async read(id:string,input:unknown){const p=this.shape(input,['ticket']);this.id(id);this.cap(p.ticket);if(this.readers>=8)throw new HttpException('Read capacity reached',429);this.readers++;let c:PoolClient|undefined;try{c=await this.db().connect();const job=await this.job(c,id,String(p.ticket));const r=(await c.query('SELECT source,version,analysis,artifact,object,attestation,publication FROM ocv_shared4.receipts WHERE job_id=$1',[id])).rows[0];const op=(await c.query('SELECT result FROM ocv_shared4.orders WHERE job_id=$1',[id])).rows[0];return{...job,shared:{...r,artifact:r?.artifact?{manifest:r.artifact.manifest,archive:{...r.artifact.archive,base64:undefined}}:null,operationResult:op?.result}};}finally{this.readers--;c?.release();}}
 async cancel(id:string,input:unknown){const p=this.shape(input,['ticket']);this.id(id);this.cap(p.ticket);const r=await this.db().query("UPDATE ocv_after.jobs SET state='cancelled',result='{\"reason\":\"cancelled by owner\"}',updated_at=now() WHERE id=$1 AND ticket_sha=$2 AND state IN('queued','starting','running') RETURNING id",[id,hashInvoice(String(p.ticket))]);return{id,cancelled:!!r.rows.length};}
 async download(id:string,input:unknown){const p=this.shape(input,['ticket']);this.id(id);this.cap(p.ticket);const c=await this.db().connect();try{const job=await this.job(c,id,String(p.ticket));if(job.state!=='done')throw new HttpException('Verified artifact is not ready',409);const row=(await c.query('SELECT artifact,object,publication FROM ocv_shared4.receipts WHERE job_id=$1',[id])).rows[0];if(!row?.artifact?.archive||!row.object?.verified||!row.publication?.ok)throw new HttpException('Publication is incomplete',409);const archive=row.artifact.archive,buffer=Buffer.from(archive.base64,'base64');if(buffer.length!==archive.bytes||hashBytes(buffer)!==archive.sha256||row.object.sha256!==archive.sha256)throw new ServiceUnavailableException('Artifact checksum mismatch');return{buffer,sha256:archive.sha256};}finally{c.release();}}
 async internal(key:string|undefined,input:unknown){
  this.privateKey(key);const p=this.shape(input,['action','id','worker','version','analysis','artifact','attestation','publication','result','view']);const id=this.id(p.id),worker=this.id(p.worker),action=String(p.action);if(!['input','version','analysis','artifact','object','attestation','publication','status','operation'].includes(action))throw new BadRequestException('Invalid shared worker action');if(p.view!==undefined&&!['dataset','analysis','bundle','artifact','publication','operation'].includes(String(p.view)))throw new BadRequestException('Invalid projection');
  const c=await this.db().connect();try{await c.query('BEGIN');const lease=await c.query('SELECT owner,lease_until>now() AS leased FROM ocv_after.worker WHERE id=1 FOR UPDATE');if(lease.rows[0]?.owner!==worker||!lease.rows[0]?.leased)throw new HttpException('Worker lease unavailable',409);const j=(await c.query('SELECT * FROM ocv_after.jobs WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!j)throw new HttpException('Job unavailable',404);if(action==='status'){await c.query('COMMIT');return{id,state:j.state,cancelled:j.state==='cancelled'};}if(!['starting','running'].includes(j.state))throw new HttpException('Task is no longer active',409);
   if(j.family==='shared'){const o=(await c.query('SELECT input,result FROM ocv_shared4.orders WHERE job_id=$1 FOR UPDATE',[id])).rows[0];if(!o)throw new HttpException('Shared operation missing',409);if(action==='operation'){if(bytes(p.result)>262144)throw new BadRequestException('Operation result exceeds limit');await c.query('UPDATE ocv_shared4.orders SET result=$2::jsonb WHERE job_id=$1',[id,JSON.stringify(p.result)]);}else if(action!=='input')throw new BadRequestException('Operation does not produce a report');await c.query('COMMIT');return{operation:o.input,result:action==='operation'?p.result:o.result};}
   let row=(await c.query('SELECT * FROM ocv_shared4.receipts WHERE job_id=$1 FOR UPDATE',[id])).rows[0];
   if(!row){let request,result,projectId,revision,kind,notes;let tempo;
    if(j.family==='mechanical'||j.family==='circuits'){const name=j.family==='mechanical'?'ocv_workshop.order_items':'ocv_signals.dispatch_notes';const n=(await c.query(`SELECT n.request,n.engine_result,n.project_id,h.revision FROM ${name} n LEFT JOIN ocv_signals.price_history h ON h.id=n.snapshot_id WHERE n.id=$1`,[id])).rows[0];if(!n)throw new HttpException('Engineering input unavailable',409);request=n.request;result=n.engine_result;projectId=n.project_id;revision=n.revision;kind=j.family==='mechanical'?'mechanical':request.op==='communications'?'communication':request.op;}
    else if(j.family==='music-report'){const n=(await c.query('SELECT events,tempo,sha FROM ocv_q8.scores WHERE id=$1',[j.run_id])).rows[0];if(!n||n.sha!==j.digest)throw new HttpException('Submitted recording expired',404);notes=n.events;tempo=n.tempo;kind='music';}
    else throw new BadRequestException('Shared report not supported for this job');
    const source={runId:id,...(projectId?{projectId}:{}),...(revision?{revision}:{}),digest:j.digest},dataset=kind==='music'?{kind,notes,submitted:true}:{kind,request,result};
    if(!result&&kind!=='music'){await c.query('COMMIT');return{source,dataset};}
    await c.query('INSERT INTO ocv_shared4.receipts(job_id,source_digest,source,dataset) VALUES($1,$2,$3::jsonb,$4::jsonb)',[id,j.digest,JSON.stringify(source),JSON.stringify(dataset)]);row={source_digest:j.digest,source,dataset};
   }
   if(action==='object'){if(!row.artifact?.archive)throw new HttpException('Artifact missing',409);const object=await this.stockObject(c,id,row.artifact.archive);await c.query('UPDATE ocv_shared4.receipts SET object=$2::jsonb,updated_at=now() WHERE job_id=$1',[id,JSON.stringify(object)]);row.object=object;}
   else if(action!=='input'){
    const value=p[action];if(!value||typeof value!=='object'||Array.isArray(value))throw new BadRequestException('Result object required');const limit=action==='artifact'?6291456:action==='analysis'?2097152:131072;if(bytes(value)>limit)throw new BadRequestException('Shared result exceeds byte limit');
    if(action==='artifact'){const a=(value as any).archive;if(!a||typeof a.base64!=='string'||!hexTicket.test(a.sha256)||a.bytes<1||a.bytes>3145728)throw new BadRequestException('Invalid archive envelope');const b=Buffer.from(a.base64,'base64');if(b.length!==a.bytes||hashBytes(b)!==a.sha256)throw new BadRequestException('Archive checksum mismatch');await c.query('INSERT INTO ocv_shared4.object_log(key,job_id,digest,bytes) VALUES($1,$2,$3,$4) ON CONFLICT(key) DO NOTHING',['shared/'+id+'/'+a.sha256+'.zip',id,a.sha256,a.bytes]);}
    if(row[action]&&hashInvoice(canonicalInvoice(row[action]))!==hashInvoice(canonicalInvoice(value)))throw new HttpException('Immutable step result conflict',409);
    await c.query(`UPDATE ocv_shared4.receipts SET ${action}=$2::jsonb,updated_at=now() WHERE job_id=$1`,[id,JSON.stringify(value)]);row[action]=value;
   }
   await c.query('COMMIT');const view=String(p.view||'dataset');if(action!=='input')return{ok:true,source:row.source,stored:action,object:action==='object'?row.object:undefined};
   if(view==='analysis')return{source:row.source,version:row.version,analysis:row.analysis};
   if(view==='artifact'||view==='publication'){const archive=row.artifact?.archive;return{source:row.source,artifact:row.artifact?{...row.artifact,compatibility:row.attestation||row.artifact.compatibility,archive:archive?{...archive,base64:view==='artifact'?archive.base64:undefined}:undefined}:undefined,object:row.object,publication:row.publication,attestation:row.attestation,dataset:{kind:row.dataset.kind},analysis:{statistics:row.analysis?.statistics}};}
   return{source:row.source,dataset:row.dataset,version:row.version,...(view==='bundle'?{analysis:row.analysis}:{} )};
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 private async stockObject(c:PoolClient,id:string,archive:any){
  const data=Buffer.from(archive.base64,'base64');if(data.length!==archive.bytes||hashBytes(data)!==archive.sha256)throw new BadRequestException('Invalid object checksum');const bucket='ocv-sh4',key='shared/'+id+'/'+archive.sha256+'.zip';
  const deadline=Date.now()+16000;await s3('PUT','/'+bucket,Buffer.alloc(0),[200,204,409],deadline);await s3('PUT','/'+bucket+'/'+key,data,[200,204],deadline);const read=await s3('GET','/'+bucket+'/'+key,Buffer.alloc(0),[200],deadline);if(read.length!==data.length||hashBytes(read)!==archive.sha256)throw new ServiceUnavailableException('Object readback checksum mismatch');
  await c.query('INSERT INTO ocv_shared4.object_log(key,job_id,digest,bytes) VALUES($1,$2,$3,$4) ON CONFLICT(key) DO NOTHING',[key,id,archive.sha256,data.length]);
  const stale=await c.query("SELECT key FROM ocv_shared4.object_log WHERE job_id IS NULL OR created_at<now()-interval '7 days' AND NOT EXISTS(SELECT 1 FROM ocv_after.jobs j WHERE j.id=job_id AND j.state IN('queued','starting','running')) ORDER BY created_at LIMIT 8");for(const r of stale.rows){await s3('DELETE','/'+bucket+'/'+r.key,Buffer.alloc(0),[200,204,404],deadline);await c.query('DELETE FROM ocv_shared4.object_log WHERE key=$1',[r.key]);}
  return{bucket,key,bytes:data.length,sha256:archive.sha256,verified:true,storage:'MinIO',readback:true};
 }
 async onModuleDestroy(){await this.pool?.end();}
}
const hashBytes=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
async function s3(method:string,pathname:string,body:Buffer,allowed:number[],deadline=Date.now()+6000){
 const host='minio:9000',access=process.env.MINIO_ACCESS_KEY,secret=process.env.MINIO_SECRET_KEY;if(!access||!secret)throw new ServiceUnavailableException('Object store is not configured');
 const date=new Date().toISOString().replace(/[:-]|\.\d{3}/g,''),day=date.slice(0,8),payload=hashBytes(body),headers=`host:${host}\nx-amz-content-sha256:${payload}\nx-amz-date:${date}\n`,signed='host;x-amz-content-sha256;x-amz-date',scope=day+'/us-east-1/s3/aws4_request';
 const canonical=[method,pathname,'',headers,signed,payload].join('\n'),hmac=(k:Buffer|string,t:string)=>createHmac('sha256',k).update(t).digest();const key=hmac(hmac(hmac(hmac('AWS4'+secret,day),'us-east-1'),'s3'),'aws4_request');
 const signature=createHmac('sha256',key).update('AWS4-HMAC-SHA256\n'+date+'\n'+scope+'\n'+hashInvoice(canonical)).digest('hex');
 let response:Awaited<ReturnType<typeof fetch>>;try{if(Date.now()>=deadline)throw Error('deadline');response=await fetch('http://'+host+pathname,{method,headers:{'x-amz-date':date,'x-amz-content-sha256':payload,authorization:`AWS4-HMAC-SHA256 Credential=${access}/${scope}, SignedHeaders=${signed}, Signature=${signature}`},body:method==='PUT'?new Uint8Array(body):undefined,signal:AbortSignal.timeout(Math.max(1,Math.min(6000,deadline-Date.now())))});}catch{throw new ServiceUnavailableException('Object transport unavailable');}
 if(!allowed.includes(response.status))throw new ServiceUnavailableException('Object operation failed');const length=Number(response.headers.get('content-length')||0);if(length>3145728)throw new ServiceUnavailableException('Object exceeds read limit');const reader=response.body?.getReader(),chunks:Uint8Array[]=[];let n=0;while(reader){const r=await reader.read();if(r.done)break;n+=r.value.length;if(n>3145728){await reader.cancel();throw new ServiceUnavailableException('Object exceeds read limit');}chunks.push(r.value);}return Buffer.concat(chunks);
}

@Controller('api/shared')
export class OldInvoiceController {
 constructor(@Inject(OldInvoices)private readonly invoices:OldInvoices){}
 @Post('operations') operation(@Body()p:unknown){return this.invoices.operation(p);}
 @Post('jobs/:id/read') read(@Param('id')id:string,@Body()p:unknown){return this.invoices.read(id,p);}
 @Post('jobs/:id/cancel') cancel(@Param('id')id:string,@Body()p:unknown){return this.invoices.cancel(id,p);}
 @Post('jobs/:id/download') async download(@Param('id')id:string,@Body()p:unknown,@Res()r:Response){const result=await this.invoices.download(id,p);r.setHeader('Content-Disposition','attachment; filename="report.zip"');r.setHeader('X-Content-SHA256',result.sha256);r.setHeader('Cache-Control','no-store');r.status(200).type('application/zip').send(result.buffer);}
 @Post('internal') internal(@Headers('x-ocv-runner')key:string|undefined,@Body()p:unknown){return this.invoices.internal(key,p);}
}
