import {BadRequestException,Body,Controller,Headers,HttpException,Inject,Injectable,OnModuleDestroy,Param,Post,ServiceUnavailableException} from '@nestjs/common';
import {Pool} from 'pg';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {sha,uuid} from './core';
import {queueLimit,executionLimit,queueTtlSeconds,expireTasksSql,terminalLimit,trimTerminalSql} from './capacity';
export const catalog=JSON.parse(readFileSync(path.join(__dirname,'../../src/a1/catalog.json'),'utf8')) as {families:{id:string;title:string;steps:string[][]}[];features:Record<string,string>};
export function familyFor(feature:string){let n=0;for(const c of feature)n=(n*31+c.charCodeAt(0))>>>0;const available=catalog.families.filter(f=>!['circuits','mechanical','shared','music-report'].includes(f.id)&&!f.id.startsWith('site-'));return catalog.features[feature]||available[n%available.length].id;}

@Injectable()
export class JobsService implements OnModuleDestroy {
  private db?:Pool;private readers=0;
  private connection(){if(!process.env.DATABASE_URL)throw new ServiceUnavailableException('Job database is not configured');if(!this.db){this.db=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:1200,statement_timeout:2500});this.db.on('error',()=>{});}return this.db;}
  async enqueue(run:string,ticket:string,feature:string,digest:string,family=familyFor(feature)){
    if(!process.env.OCV_RUNNER_KEY||!catalog.families.some(f=>f.id===family))return null;
    const db=this.connection(),c=await db.connect();
    try{
      await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(312512,52)');
      await c.query(expireTasksSql,[queueTtlSeconds()]);
      const queued=await c.query("SELECT count(*) FROM ocv_after.jobs WHERE state='queued'");
      let job=null;
      if(queueLimit()===0||Number(queued.rows[0].count)<queueLimit()){
        const row=await c.query("INSERT INTO ocv_after.jobs(id,run_id,ticket_sha,family,feature,digest) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id,state,family",[randomUUID(),run,sha(ticket),family,feature,digest]);job=row.rows[0]||null;
      }
      await c.query(trimTerminalSql,[terminalLimit()]);
      await c.query('COMMIT');return job;
    }catch(error){await c.query('ROLLBACK').catch(()=>{});throw error;}finally{c.release();}
  }
  async status(id:string,input:unknown){
    if(!uuid.test(id)||!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Invalid job request');
    const p=input as Record<string,unknown>;if(Object.keys(p).length!==1||typeof p.ticket!=='string'||!/^[a-f0-9]{64}$/.test(p.ticket))throw new BadRequestException('Invalid job ticket');
    if(this.readers>=8)throw new HttpException('Job status capacity reached',429);this.readers++;
    try{const r=await this.connection().query('SELECT id,state,family,phase,result,created_at,updated_at FROM ocv_after.jobs WHERE id=$1 AND ticket_sha=$2',[id,sha(p.ticket)]);if(!r.rows.length)throw new HttpException('Job expired or unavailable',404);return {...r.rows[0],title:catalog.families.find(f=>f.id===r.rows[0].family)?.title};}finally{this.readers--;}
  }
  async control(key:string|undefined,input:unknown){
    const expected=process.env.OCV_RUNNER_KEY;
    if(!expected||!key||!/^[a-f0-9]{64}$/.test(key)||!timingSafeEqual(Buffer.from(sha(key)),Buffer.from(sha(expected))))throw new HttpException('Worker endpoint is not available',404);
    if(!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Invalid worker command');
    const p=input as Record<string,unknown>;
    if(!uuid.test(String(p.worker))||!['claim','heartbeat','progress','complete','release','seed','retry'].includes(String(p.action))||Object.keys(p).some(k=>!['worker','action','job','jobs','state','phase','result','family','code','delaySeconds'].includes(k)))throw new BadRequestException('Invalid worker command');
    if(p.job!==undefined&&!uuid.test(String(p.job)))throw new BadRequestException('Invalid worker job');
    if(p.jobs!==undefined&&(p.action!=='heartbeat'||p.job!==undefined||!Array.isArray(p.jobs)||p.jobs.length>128||p.jobs.some(id=>typeof id!=='string'||!uuid.test(id))||new Set(p.jobs).size!==p.jobs.length))throw new BadRequestException('Invalid worker heartbeat batch');
    if(p.action==='seed'){
      if(['circuits','mechanical','shared','music-report'].includes(String(p.family))||String(p.family).startsWith('site-'))throw new BadRequestException('Engineering jobs require an explicit experiment');
      if(!catalog.families.some(f=>f.id===p.family))throw new BadRequestException('Unknown worker family');
      const ticket=randomBytes(32).toString('hex'),id=randomUUID();
      return {job:await this.enqueue(id,ticket,'runner-proof',sha('runner-proof'),String(p.family))};
    }
    const c=await this.connection().connect();
    try{
      await c.query('BEGIN');const row=await c.query('SELECT owner,lease_until>now() AS leased FROM ocv_after.worker WHERE id=1 FOR UPDATE');
      if(row.rows[0].leased&&row.rows[0].owner!==p.worker)throw new HttpException('Another worker owns this lease',409);
      if(row.rows[0].owner!==p.worker){
        await c.query("UPDATE ocv_after.jobs j SET state=CASE WHEN b.attempts<b.max_attempts THEN 'queued' ELSE 'failed' END,result=CASE WHEN b.attempts<b.max_attempts THEN j.result ELSE '{\"reason\":\"retry budget exhausted after lease expiry\"}'::jsonb END,updated_at=now() FROM ocv_shared1.task_books b WHERE b.job_id=j.id AND j.state IN('starting','running')");
        await c.query("UPDATE ocv_shared1.task_books b SET available_at=now()+interval '2 seconds',updated_at=now() FROM ocv_after.jobs j WHERE j.id=b.job_id AND j.state='queued' AND b.attempts>0");
      }
      await c.query("UPDATE ocv_after.worker SET owner=$1,lease_until=now()+interval '60 seconds' WHERE id=1",[p.worker]);
      let result:unknown={canContinue:true,executionLimit:executionLimit(),queueLimit:queueLimit()};
      if(p.action==='claim'){
        await c.query(expireTasksSql,[queueTtlSeconds()]);
        const busy=await c.query("SELECT count(*) FROM ocv_after.jobs WHERE state IN('starting','running')");
        if(Number(busy.rows[0].count)>=executionLimit())result={job:null,executionLimit:executionLimit(),queueLimit:queueLimit()};
        else{const r=await c.query("UPDATE ocv_after.jobs SET state='starting',updated_at=now() WHERE id=(SELECT j.id FROM ocv_after.jobs j JOIN ocv_shared1.task_books b ON b.job_id=j.id LEFT JOIN ocv_shared1.client_cash cash ON cash.owner_bucket=b.owner_bucket WHERE j.state='queued' AND b.available_at<=now() AND b.attempts<b.max_attempts ORDER BY (SELECT count(*) FROM ocv_after.jobs busy JOIN ocv_shared1.task_books bb ON bb.job_id=busy.id WHERE busy.state IN('starting','running') AND bb.owner_bucket=b.owner_bucket),coalesce(cash.last_claim,'epoch'::timestamptz),b.priority DESC,j.seq LIMIT 1 FOR UPDATE OF j SKIP LOCKED) RETURNING id,run_id,family,feature,digest");if(r.rows[0]){await c.query('UPDATE ocv_shared1.task_books SET attempts=attempts+1,updated_at=now() WHERE job_id=$1',[r.rows[0].id]);await c.query('INSERT INTO ocv_shared1.client_cash(owner_bucket,last_claim) SELECT owner_bucket,now() FROM ocv_shared1.task_books WHERE job_id=$1 ON CONFLICT(owner_bucket) DO UPDATE SET last_claim=excluded.last_claim',[r.rows[0].id]);await c.query('DELETE FROM ocv_shared1.client_cash WHERE owner_bucket NOT IN(SELECT owner_bucket FROM ocv_shared1.task_books)');}result={job:r.rows[0]||null,executionLimit:executionLimit(),queueLimit:queueLimit()};}
      }else if(p.action==='retry'){
        if(!p.job||!['service_unavailable','transport_timeout','transient_storage','resource_wait'].includes(String(p.code))||!Number.isInteger(p.phase)||Number(p.phase)<0||Number(p.phase)>12||!Number.isInteger(p.delaySeconds)||Number(p.delaySeconds)<1||Number(p.delaySeconds)>30||Buffer.byteLength(JSON.stringify(p.result??{}))>6000)throw new BadRequestException('Invalid bounded retry');
        const found=await c.query("SELECT b.attempts,b.max_attempts FROM ocv_after.jobs j JOIN ocv_shared1.task_books b ON b.job_id=j.id WHERE j.id=$1 AND j.state IN('starting','running') FOR UPDATE OF j,b",[p.job]);if(!found.rows.length)throw new HttpException('Task is no longer active',409);const b=found.rows[0],retried=b.attempts<b.max_attempts;
        await c.query("UPDATE ocv_after.jobs SET state=$2,phase=$3,result=$4::jsonb,updated_at=now() WHERE id=$1",[p.job,retried?'queued':'failed',p.phase,JSON.stringify({...p.result as object,retryCode:p.code,reason:retried?'bounded retry scheduled':'retry budget exhausted'})]);
        await c.query("UPDATE ocv_shared1.task_books SET available_at=now()+($2::integer*interval '1 second'),updated_at=now() WHERE job_id=$1",[p.job,p.delaySeconds]);result={retried,attempts:b.attempts,canContinue:true};
      }else if(p.action==='progress'||p.action==='complete'){
        const states=p.action==='progress'?['starting','running']:['done','failed'];
        if(!p.job||!states.includes(String(p.state))||!Number.isInteger(p.phase)||Number(p.phase)<0||Number(p.phase)>12||Buffer.byteLength(JSON.stringify(p.result??{}))>6000)throw new BadRequestException('Invalid worker progress');
        const updated=await c.query("UPDATE ocv_after.jobs SET state=$2,phase=$3,result=$4::jsonb,updated_at=now() WHERE id=$1 AND state IN('starting','running')",[p.job,p.state,p.phase,JSON.stringify(p.result??{})]);
        if(!updated.rowCount)throw new HttpException('Task is no longer active',409);
        if(p.action==='complete')await c.query(trimTerminalSql,[terminalLimit()]);
      }else if(p.action==='heartbeat'&&p.job)await c.query("UPDATE ocv_after.jobs SET updated_at=now() WHERE id=$1 AND state IN('starting','running')",[p.job]);
      else if(p.action==='heartbeat'&&p.jobs!==undefined)await c.query("UPDATE ocv_after.jobs SET updated_at=now() WHERE id=ANY($1::uuid[]) AND state IN('starting','running')",[p.jobs]);
      else if(p.action==='release')await c.query('UPDATE ocv_after.worker SET lease_until=now() WHERE id=1');
      await c.query(trimTerminalSql,[terminalLimit()]);
      if(p.action==='claim'){const q=await c.query("SELECT count(*) AS pending,min(b.available_at) AS next_available FROM ocv_after.jobs j JOIN ocv_shared1.task_books b ON b.job_id=j.id WHERE j.state='queued' AND b.attempts<b.max_attempts");result={...result as object,queuedPending:Number(q.rows[0].pending),nextAvailableAt:q.rows[0].next_available};}
      await c.query('COMMIT');return result;
    }catch(error){await c.query('ROLLBACK').catch(()=>{});throw error;}finally{c.release();}
  }
  async onModuleDestroy(){await this.db?.end();}
}

@Controller()
export class JobsController {
  constructor(@Inject(JobsService)private readonly jobs:JobsService){}
  @Post('api/a2/job.cgi/:id') status(@Param('id') id:string,@Body() p:unknown){return this.jobs.status(id,p);}
  @Post('api/a2/worker.cgi') worker(@Headers('x-ocv-runner') key:string|undefined,@Body() p:unknown){return this.jobs.control(key,p);}
}
