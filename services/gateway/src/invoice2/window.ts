import {queueLimit,queueTtlSeconds,expireTasksSql,terminalLimit,trimTerminalSql} from '../a1/capacity';
import {BadRequestException,Body,Controller,Headers,HttpException,Inject,Injectable,OnModuleDestroy,Param,Post,ServiceUnavailableException} from '@nestjs/common';
import {Pool,PoolClient} from 'pg';
import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {hashInvoice,hexTicket,uuidInvoice,objectInvoice,keysInvoice,validateEngineRequest,validateProject} from './1';

@Injectable()
export class WindowReceipt implements OnModuleDestroy {
 private pool?:Pool;private readers=0;
 private db(){if(!process.env.DATABASE_URL)throw new ServiceUnavailableException('PostgreSQL is required for server projects');if(!this.pool){this.pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:1500,statement_timeout:3000});this.pool.on('error',()=>{});}return this.pool;}
 private wrap<T>(fn:()=>T){try{return fn();}catch(e){throw new BadRequestException((e as Error).message);}}
 private capability(id:string,input:unknown,allowed=['ticket']){return this.wrap(()=>{const p=objectInvoice(input);keysInvoice(p,allowed);if(!uuidInvoice.test(id)||typeof p.ticket!=='string'||!hexTicket.test(p.ticket))throw Error('Invalid capability');return p;});}
 private worker(key:string|undefined){const expected=process.env.OCV_RUNNER_KEY;if(!key||!expected||!hexTicket.test(key)||!timingSafeEqual(Buffer.from(hashInvoice(key)),Buffer.from(hashInvoice(expected))))throw new HttpException('Unavailable endpoint',404);}
 private async vacuum(c:PoolClient){
  await c.query('SELECT ocv_signals.trim_catalog()');
 }
 async save(input:unknown){
  const p=this.wrap(()=>{const o=objectInvoice(input);keysInvoice(o,['project','id','ticket','expectedRevision']);return o;}),parsed=this.wrap(()=>validateProject(p.project));
  const editing=p.id!==undefined;if(editing)this.capability(String(p.id),{ticket:p.ticket});
  const id=editing?String(p.id):randomUUID(),ticket=editing?String(p.ticket):randomBytes(32).toString('hex');
  const c=await this.db().connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(312512,81)');let revision=1;
   if(editing){const r=await c.query('SELECT revision FROM ocv_signals.catalog_stock WHERE id=$1 AND ticket_sha=$2 AND domain=\'signals\' FOR UPDATE',[id,hashInvoice(ticket)]);if(!r.rows.length)throw new HttpException('Project expired or inaccessible',404);if(p.expectedRevision!==r.rows[0].revision)throw new HttpException('Revision conflict; reload the saved project',409);revision=r.rows[0].revision+1;await c.query('UPDATE ocv_signals.catalog_stock SET name=$2,revision=$3,updated_at=now() WHERE id=$1',[id,parsed.name,revision]);}
   else await c.query('INSERT INTO ocv_signals.catalog_stock(id,ticket_sha,name) VALUES($1,$2,$3)',[id,hashInvoice(ticket),parsed.name]);
   const snapshot=randomUUID();await c.query('INSERT INTO ocv_signals.price_history(id,project_id,revision,digest,invoice_text) VALUES($1,$2,$3,$4,$5)',[snapshot,id,revision,parsed.digest,parsed.text]);await this.vacuum(c);await c.query('COMMIT');return {id,ticket,revision,digest:parsed.digest,snapshot,storage:'PostgreSQL',contract:'ocv.project/1'};
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 async readProject(id:string,input:unknown){const p=this.capability(id,input);const r=await this.db().query('SELECT p.id,p.name,p.revision,h.id AS snapshot,h.digest,h.invoice_text FROM ocv_signals.catalog_stock p JOIN ocv_signals.price_history h ON h.project_id=p.id AND h.revision=p.revision WHERE p.id=$1 AND p.ticket_sha=$2 AND p.domain=\'signals\'',[id,hashInvoice(String(p.ticket))]);if(!r.rows.length)throw new HttpException('Project expired or inaccessible',404);const row=r.rows[0];if(hashInvoice(row.invoice_text)!==row.digest)throw new ServiceUnavailableException('Snapshot checksum mismatch');return {...row,invoice_text:undefined,project:JSON.parse(row.invoice_text),storage:'PostgreSQL'};}
 async submit(input:unknown){
  const p=this.wrap(()=>{const o=objectInvoice(input);keysInvoice(o,['request','project','projectTicket']);return o;}),request=this.wrap(()=>validateEngineRequest(p.request));
  const id=randomUUID(),ticket=randomBytes(32).toString('hex'),digest=hashInvoice(JSON.stringify(request));const c=await this.db().connect();
  try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(312512,52)');await c.query('SELECT pg_advisory_xact_lock(312512,81)');await c.query(expireTasksSql,[queueTtlSeconds()]);
   const count=await c.query("SELECT count(*) FROM ocv_after.jobs WHERE state='queued'");if(queueLimit()>0&&Number(count.rows[0].count)>=queueLimit())throw new HttpException('Server laboratory queue is occupied; preview remains available',429);
   let snapshot=null;if(p.project!==undefined){const saved=this.capability(String(p.project),{ticket:p.projectTicket});const r=await c.query('SELECT h.id FROM ocv_signals.price_history h JOIN ocv_signals.catalog_stock p ON p.id=h.project_id AND p.revision=h.revision WHERE p.id=$1 AND p.ticket_sha=$2 AND p.domain=\'signals\'',[p.project,hashInvoice(String(saved.ticket))]);if(!r.rows.length)throw new HttpException('Project expired or inaccessible',404);snapshot=r.rows[0].id;}
   await c.query("INSERT INTO ocv_after.jobs(id,run_id,ticket_sha,family,feature,digest) VALUES($1,$1,$2,'circuits','signals',$3)",[id,hashInvoice(ticket),digest]);await c.query('INSERT INTO ocv_signals.dispatch_notes(id,project_id,snapshot_id,request) VALUES($1,$2,$3,$4::jsonb)',[id,p.project??null,snapshot,JSON.stringify(request)]);await c.query('UPDATE ocv_shared1.task_books SET owner_bucket=$2 WHERE job_id=$1',[id,p.project??'unsaved:'+'engineering']);
   await c.query(trimTerminalSql,[terminalLimit()]);await c.query('COMMIT');return {id,ticket,state:'queued',dispatcherConfigured:!!process.env.OCV_RUNNER_KEY,storage:'PostgreSQL'};
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 async readJob(id:string,input:unknown){const p=this.capability(id,input);if(this.readers>=8)throw new HttpException('Read capacity reached',429);this.readers++;try{const r=await this.db().query('SELECT j.id,j.state,j.phase,j.result,j.created_at,j.updated_at,n.engine_result,n.independent_result,n.cancelled FROM ocv_after.jobs j JOIN ocv_signals.dispatch_notes n ON n.id=j.id WHERE j.id=$1 AND j.ticket_sha=$2',[id,hashInvoice(String(p.ticket))]);if(!r.rows.length)throw new HttpException('Job expired or inaccessible',404);const row=r.rows[0];return {...row,engine_result:undefined,independent_result:undefined,result:{...row.result,engine:row.engine_result,analysis:row.independent_result},error:row.state==='failed'?row.result.reason:undefined,storage:'PostgreSQL'};}finally{this.readers--;}}
 async cancel(id:string,input:unknown){const p=this.capability(id,input);const c=await this.db().connect();try{await c.query('BEGIN');const r=await c.query("UPDATE ocv_after.jobs SET state='cancelled',result='{\"reason\":\"cancelled by owner\"}',updated_at=now() WHERE id=$1 AND ticket_sha=$2 AND family='circuits' AND state IN('queued','starting','running') RETURNING id",[id,hashInvoice(String(p.ticket))]);if(r.rows.length)await c.query('UPDATE ocv_signals.dispatch_notes SET cancelled=true WHERE id=$1',[id]);await c.query('COMMIT');return {id,cancelled:!!r.rows.length};}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}}
 async internal(key:string|undefined,input:unknown){
  this.worker(key);const p=this.wrap(()=>{const o=objectInvoice(input);keysInvoice(o,['action','id','worker','engine','analysis']);if(!uuidInvoice.test(String(o.id))||!uuidInvoice.test(String(o.worker))||!['input','engine','analysis','status'].includes(String(o.action)))throw Error('Invalid worker command');return o;});
  const c=await this.db().connect();try{await c.query('BEGIN');const r=await c.query("SELECT n.request,n.project_id,n.snapshot_id,n.cancelled,n.engine_result,j.state,h.invoice_text,h.digest,h.revision FROM ocv_signals.dispatch_notes n JOIN ocv_after.jobs j ON j.id=n.id LEFT JOIN ocv_signals.price_history h ON h.id=n.snapshot_id WHERE n.id=$1 AND EXISTS(SELECT 1 FROM ocv_after.worker WHERE id=1 AND owner=$2 AND lease_until>now()) FOR UPDATE OF n",[p.id,p.worker]);if(!r.rows.length)throw new HttpException('Worker lease or job unavailable',409);const row=r.rows[0];if(p.action==='status'){await c.query('COMMIT');return{id:p.id,state:row.state,cancelled:row.cancelled};}if(row.cancelled||!['starting','running'].includes(row.state))throw new HttpException('Task is no longer active',409);
   if(p.action!=='input'){const field=p.action==='engine'?'engine_result':'independent_result',result=p.action==='engine'?p.engine:p.analysis;this.wrap(()=>objectInvoice(result));const text=JSON.stringify(result);if(Buffer.byteLength(text)>(p.action==='engine'?4194304:1048576))throw new BadRequestException('Result exceeds byte limit');await c.query(`UPDATE ocv_signals.dispatch_notes SET ${field}=$2::jsonb WHERE id=$1`,[p.id,text]);}
   const result={...row,storage:'PostgreSQL'};await c.query('COMMIT');return result;
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 async onModuleDestroy(){await this.pool?.end();}
}
@Controller('api/signals')
export class WindowController {
 constructor(@Inject(WindowReceipt)private readonly window:WindowReceipt){}
 @Post('projects') save(@Body()p:unknown){return this.window.save(p);}
 @Post('projects/:id/read') project(@Param('id')id:string,@Body()p:unknown){return this.window.readProject(id,p);}
 @Post('jobs') submit(@Body()p:unknown){return this.window.submit(p);}
 @Post('jobs/:id/read') job(@Param('id')id:string,@Body()p:unknown){return this.window.readJob(id,p);}
 @Post('jobs/:id/cancel') cancel(@Param('id')id:string,@Body()p:unknown){return this.window.cancel(id,p);}
 @Post('internal') internal(@Headers('x-ocv-runner')key:string|undefined,@Body()p:unknown){return this.window.internal(key,p);}
}
