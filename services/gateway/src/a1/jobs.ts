import {BadRequestException,Body,Controller,Headers,HttpException,Inject,Injectable,OnModuleDestroy,Param,Post,ServiceUnavailableException} from '@nestjs/common';
import {Pool} from 'pg';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {sha,uuid} from './core';
export const catalog=JSON.parse(readFileSync(path.join(__dirname,'../../src/a1/catalog.json'),'utf8')) as {families:{id:string;title:string;steps:string[][]}[];features:Record<string,string>};
export function familyFor(feature:string){let n=0;for(const c of feature)n=(n*31+c.charCodeAt(0))>>>0;return catalog.features[feature]||catalog.families[n%catalog.families.length].id;}

@Injectable()
export class JobsService implements OnModuleDestroy {
  private db?:Pool;private readers=0;
  private connection(){if(!process.env.DATABASE_URL)throw new ServiceUnavailableException('Job database is not configured');if(!this.db){this.db=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:1200,statement_timeout:2500});this.db.on('error',()=>{});}return this.db;}
  async enqueue(run:string,ticket:string,feature:string,digest:string,family=familyFor(feature)){
    if(!process.env.OCV_RUNNER_KEY||!catalog.families.some(f=>f.id===family))return null;
    const db=this.connection(),c=await db.connect();
    try{
      await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(312512,52)');
      await c.query("UPDATE ocv_after.jobs SET state='failed',result='{\"reason\":\"expired\"}',updated_at=now() WHERE state IN('queued','starting','running') AND updated_at<now()-interval '25 minutes'");
      const active=await c.query("SELECT count(*) FROM ocv_after.jobs WHERE state IN('queued','starting','running')");
      let job=null;
      if(Number(active.rows[0].count)<4){
        const row=await c.query("INSERT INTO ocv_after.jobs(id,run_id,ticket_sha,family,feature,digest) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id,state,family",[randomUUID(),run,sha(ticket),family,feature,digest]);job=row.rows[0]||null;
      }
      await c.query("DELETE FROM ocv_after.jobs WHERE id IN(SELECT id FROM ocv_after.jobs WHERE state IN('done','failed') ORDER BY seq DESC OFFSET 32)");
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
    if(!uuid.test(String(p.worker))||!['claim','heartbeat','progress','complete','release','seed'].includes(String(p.action))||Object.keys(p).some(k=>!['worker','action','job','state','phase','result','family'].includes(k)))throw new BadRequestException('Invalid worker command');
    if(p.job!==undefined&&!uuid.test(String(p.job)))throw new BadRequestException('Invalid worker job');
    if(p.action==='seed'){
      if(!catalog.families.some(f=>f.id===p.family))throw new BadRequestException('Unknown worker family');
      const ticket=randomBytes(32).toString('hex'),id=randomUUID();
      return {job:await this.enqueue(id,ticket,'runner-proof',sha('runner-proof'),String(p.family))};
    }
    const c=await this.connection().connect();
    try{
      await c.query('BEGIN');const row=await c.query('SELECT owner,lease_until>now() AS leased FROM ocv_after.worker WHERE id=1 FOR UPDATE');
      if(row.rows[0].leased&&row.rows[0].owner!==p.worker)throw new HttpException('Another worker owns this lease',409);
      if(row.rows[0].owner!==p.worker)await c.query("UPDATE ocv_after.jobs SET state='failed',result='{\"reason\":\"worker lease expired\"}',updated_at=now() WHERE state IN('starting','running')");
      await c.query("UPDATE ocv_after.worker SET owner=$1,lease_until=now()+interval '60 seconds' WHERE id=1",[p.worker]);
      let result:unknown={canContinue:true};
      if(p.action==='claim'){
        await c.query("UPDATE ocv_after.jobs SET state='failed',result='{\"reason\":\"expired\"}',updated_at=now() WHERE state='queued' AND updated_at<now()-interval '25 minutes'");
        const busy=await c.query("SELECT id FROM ocv_after.jobs WHERE state IN('starting','running') LIMIT 1");
        if(busy.rows.length)result={job:null};
        else{const r=await c.query("UPDATE ocv_after.jobs SET state='starting',updated_at=now() WHERE id=(SELECT id FROM ocv_after.jobs WHERE state='queued' ORDER BY seq LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING id,run_id,family,feature,digest");result={job:r.rows[0]||null};}
      }else if(p.action==='progress'||p.action==='complete'){
        const states=p.action==='progress'?['starting','running']:['done','failed'];
        if(!p.job||!states.includes(String(p.state))||!Number.isInteger(p.phase)||Number(p.phase)<0||Number(p.phase)>12||Buffer.byteLength(JSON.stringify(p.result??{}))>6000)throw new BadRequestException('Invalid worker progress');
        await c.query("UPDATE ocv_after.jobs SET state=$2,phase=$3,result=$4::jsonb,updated_at=now() WHERE id=$1 AND state IN('starting','running')",[p.job,p.state,p.phase,JSON.stringify(p.result??{})]);
        if(p.action==='complete')await c.query("DELETE FROM ocv_after.jobs WHERE id IN(SELECT id FROM ocv_after.jobs WHERE state IN('done','failed') ORDER BY seq DESC OFFSET 32)");
      }else if(p.action==='heartbeat'&&p.job)await c.query("UPDATE ocv_after.jobs SET updated_at=now() WHERE id=$1 AND state IN('starting','running')",[p.job]);
      else if(p.action==='release')await c.query('UPDATE ocv_after.worker SET lease_until=now() WHERE id=1');
      await c.query("DELETE FROM ocv_after.jobs WHERE id IN(SELECT id FROM ocv_after.jobs WHERE state IN('done','failed') ORDER BY seq DESC OFFSET 32)");
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
