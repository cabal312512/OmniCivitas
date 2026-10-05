import {BadRequestException,HttpException,Inject,Injectable,OnModuleDestroy,ServiceUnavailableException} from '@nestjs/common';
import {Pool,PoolClient} from 'pg';
import Redis from 'ioredis';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,readdir,readFile,unlink,writeFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {parseAfter,sha,programs,executeProgram,splitPackage,decodePiece,uuid,AfterInput} from './core';
import {JobsService} from './jobs';

const cap=(name:string,fallback:number,min:number,max:number)=>{const value=Number(process.env[name]);return Number.isInteger(value)&&value>=min&&value<=max?value:fallback;};
const guard=`local g=redis.call('INCR',KEYS[1]);redis.call('EXPIRE',KEYS[1],70);local s=redis.call('INCR',KEYS[2]);redis.call('EXPIRE',KEYS[2],70);if g>120 or s>24 then return 0 end;return 1`;
const globalStamp=`local n=redis.call('INCR',KEYS[1]);redis.call('EXPIRE',KEYS[1],86400);if n>1000000 then redis.call('SET',KEYS[1],1,'EX',86400);n=1 end;return n`;

@Injectable()
export class AfterService implements OnModuleDestroy {
  constructor(@Inject(JobsService)private readonly jobs?:JobsService){}
  private db?:Pool;private redis?:Redis;private initialized?:Promise<void>;private active=0;
  readonly limits={runs:cap('OCV_AFTER_RUN_LIMIT',128,4,256),tables:cap('OCV_AFTER_TABLE_LIMIT',6,2,8),every:cap('OCV_AFTER_TABLE_EVERY',5,2,50),features:128};
  readonly folder=path.resolve(process.env.OCV_AFTER_DIR||path.join(process.env.OCV_LOG_DIR||process.env.OCV_DEPS_ROOT||os.tmpdir(),'a1'));

  private async open(){
    if(!process.env.DATABASE_URL||!process.env.REDIS_URL)throw Error('Real PostgreSQL and Redis are required');
    this.db=new Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:1200,statement_timeout:2500,idleTimeoutMillis:10000});
    this.db.on('error',()=>{});
    this.redis=new Redis(process.env.REDIS_URL,{lazyConnect:true,connectTimeout:1200,commandTimeout:1200,maxRetriesPerRequest:0,retryStrategy:()=>null,enableOfflineQueue:false});
    this.redis.on('error',()=>{});await this.redis.connect();
    for(const [name,source]of Object.entries(programs))await this.db.query('INSERT INTO ocv_after.code_bank(name,source,sha256) VALUES ($1,$2,$3) ON CONFLICT(name) DO NOTHING',[name,source,sha(source)]);
    await mkdir(this.folder,{recursive:true,mode:0o700});
    await this.pruneFiles();
  }
  private async storage(){
    if(!this.initialized)this.initialized=this.open().catch(async error=>{this.redis?.disconnect();await this.db?.end().catch(()=>{});this.db=undefined;this.redis=undefined;this.initialized=undefined;throw error;});
    await this.initialized;
    if(this.redis?.status==='end')await this.redis.connect();
  }
  private async pruneFiles(client?:PoolClient){
    const c=client||await this.db!.connect();let acquired=Boolean(client);
    try{
      if(!client)acquired=(await c.query('SELECT pg_try_advisory_lock(312512,51) AS acquired')).rows[0].acquired;
      if(acquired){
        const rows=await c.query('SELECT id FROM ocv_after.runs ORDER BY seq DESC LIMIT $1',[this.limits.runs]);
        const retained=new Set(rows.rows.map(row=>`${row.id}.part`));
        for(const name of await readdir(this.folder))if(/^[a-f0-9-]{36}\.(part|mjs)$/.test(name)&&!retained.has(name))await unlink(path.join(this.folder,name));
      }
    }finally{if(!client){let broken=false;if(acquired)await c.query('SELECT pg_advisory_unlock(312512,51)').catch(()=>{broken=true;});c.release(broken);}}
  }
  private async admission(session:string){
    const minute=Math.floor(Date.now()/60000),bucket=parseInt(sha(session).slice(0,4),16)%64;
    if(Number(await this.redis!.eval(guard,2,`a1:rate:${minute}`,`a1:rate:${minute}:${bucket}`))!==1)throw new HttpException('Background receipt capacity reached',429);
  }
  private checkTicket(value:unknown){if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))throw new BadRequestException('Invalid receipt ticket');return value;}
  private async pockets(c:PoolClient,run:string,serial:string,clicks:number,digest:string){
    if(clicks%this.limits.every!==0)return [];
    const created:string[]=[];
    for(let index=0;index<2;index++){
      const name=`p${serial}_${index}`;
      if(!/^p[1-9][0-9]{0,18}_[01]$/.test(name))throw Error('Invalid pocket identifier');
      await c.query(`CREATE TABLE ocv_after_pockets.${name}(seat integer PRIMARY KEY CHECK(seat BETWEEN 0 AND 2),fold char(64) NOT NULL)`);
      await c.query(`INSERT INTO ocv_after_pockets.${name}(seat,fold) VALUES(0,$1),(1,$2),(2,$3)`,[sha(digest+':0'),sha(digest+':1'),sha(digest+':2')]);
      await c.query('INSERT INTO ocv_after.pockets(name,run_id,serial) VALUES($1,$2,$3)',[name,run,serial]);created.push(name);
    }
    const stale=await c.query('SELECT name FROM ocv_after.pockets ORDER BY serial DESC,name DESC OFFSET $1',[this.limits.tables]);
    for(const row of stale.rows){if(!/^p[1-9][0-9]{0,18}_[01]$/.test(row.name))throw Error('Invalid stale pocket identifier');await c.query(`DROP TABLE ocv_after_pockets.${row.name}`);await c.query('DELETE FROM ocv_after.pockets WHERE name=$1',[row.name]);}
    return created;
  }
  async accept(input:unknown){
    let p:AfterInput;try{p=parseAfter(input);}catch(error){throw new BadRequestException((error as Error).message);}
    if(this.active>=2)throw new HttpException('Background workers are occupied',429);
    this.active++;let c:PoolClient|undefined,partFile:string|undefined,committed=false,locked=false;
    try {
      await this.storage();await this.admission(p.session);c=await this.db!.connect();await c.query('BEGIN');
      await c.query("SET LOCAL idle_in_transaction_session_timeout='6s'");
      const lock=await c.query('SELECT pg_try_advisory_lock(312512,51) AS acquired');
      if(!lock.rows[0].acquired)throw new HttpException('Another receipt is in transit',429);
      locked=true;await this.pruneFiles(c);
      const owned=(await readdir(this.folder)).filter(name=>/^[a-f0-9-]{36}\.(part|mjs)$/.test(name));
      if(owned.length>=this.limits.runs+2)throw new HttpException('Background file cabinet is full',429);
      const duplicate=await c.query('SELECT id,request_sha FROM ocv_after.runs WHERE event_id=$1',[p.eventId]);
      if(duplicate.rows.length){if(duplicate.rows[0].request_sha!==sha(JSON.stringify(p)))throw new BadRequestException('Event id already belongs to a different receipt');await c.query('ROLLBACK');return {canContinue:true,storage:'postgresql',duplicate:true,id:duplicate.rows[0].id};}
      const id=randomUUID(),ticket=randomBytes(32).toString('hex');
      const clock=await c.query('UPDATE ocv_after.clock SET clicks=(clicks+1)%1000000,updated_at=now() WHERE id=1 RETURNING clicks');
      const clicks=Number(clock.rows[0].clicks),name=['a','b','c'][clicks%3];
      const bank=await c.query('SELECT x.source,x.sha256 FROM ocv_after.code_bank x JOIN ocv_after.code_bank y ON x.name=y.name WHERE x.name=$1',[name]);
      if(!bank.rows.length)throw Error('Stored function missing');
      const source=bank.rows[0].source;
      const result=await executeProgram(this.folder,id,name,source,bank.rows[0].sha256,p);
      const redisOrdinal=Number(await this.redis!.eval(globalStamp,1,'a1:shared-clicks'));
      const offices=['queue','registry','code-bank','file','process','redis','fold','database','browser','cabinet','mirror','receipt','index','return'];
      const packed=splitPackage(source,{id,event:p.kind,feature:p.feature,digest:p.digest,clicks,redisOrdinal,offices},result);
      const [front,back,database]=packed.pieces;
      partFile=path.join(this.folder,`${id}.part`);await writeFile(partFile,back,{flag:'wx',mode:0o600});
      const row=await c.query('INSERT INTO ocv_after.runs(id,event_id,request_sha,ticket_sha,kind,feature,program,input_sha,frontend_sha,backend_sha,database_piece,package_sha,result,clicks) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14) RETURNING seq',
        [id,p.eventId,sha(JSON.stringify(p)),sha(ticket),p.kind,p.feature,name,p.digest,sha(front),sha(back),database.toString('base64'),packed.hash,JSON.stringify(result),clicks]);
      await c.query('INSERT INTO ocv_after.steps(run_id,ordinal,office,stamp) SELECT $1::uuid,n,($2::text[])[n+1],md5($1::uuid::text||n::text) FROM generate_series(0,13) n',[id,offices]);
      await c.query('INSERT INTO ocv_after.features(name,total,residue) VALUES($1,1,$2) ON CONFLICT(name) DO UPDATE SET total=(ocv_after.features.total+1)%1000000,residue=EXCLUDED.residue,updated_at=now()',[p.feature,clicks%97]);
      await c.query('DELETE FROM ocv_after.features WHERE name IN(SELECT name FROM ocv_after.features ORDER BY updated_at DESC,name DESC OFFSET $1)',[this.limits.features]);
      const tables=await this.pockets(c,id,String(row.rows[0].seq),clicks,p.digest);
      await c.query('DELETE FROM ocv_after.runs WHERE id IN(SELECT id FROM ocv_after.runs ORDER BY seq DESC OFFSET $1)',[this.limits.runs]);
      await c.query('COMMIT');committed=true;
      // Keep the session lock through filesystem cleanup, including the commit boundary.
      await this.pruneFiles(c);
      const job=['tool','export'].includes(p.kind)?await this.jobs?.enqueue(id,ticket,p.feature,p.digest).catch(()=>null):null;
      return {canContinue:true,storage:'postgresql',redis:true,id,ticket,frontendPiece:front.toString('base64'),frontendSha:sha(front),packageSha:packed.hash,result,clicks,redisOrdinal,createdTables:tables,stamps:14,limits:this.limits,job:job||null};
    } catch(error){
      if(c&&!committed)await c.query('ROLLBACK').catch(()=>{});
      if(partFile&&!committed)await unlink(partFile).catch(()=>{});
      if(error instanceof HttpException)throw error;
      throw new ServiceUnavailableException('Background storage is unavailable; local tools remain usable');
    } finally {let broken=false;if(locked&&c)await c.query('SELECT pg_advisory_unlock(312512,51)').catch(()=>{broken=true;});c?.release(broken);this.active--;}
  }
  async recover(id:string,input:unknown){
    if(!uuid.test(id)||!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Invalid reconstruction request');
    const p=input as Record<string,unknown>;
    if(Object.keys(p).length!==2||!Object.hasOwn(p,'ticket')||!Object.hasOwn(p,'frontendPiece'))throw new BadRequestException('Only ticket and frontendPiece are accepted');
    const ticket=this.checkTicket(p.ticket);let front:Buffer;try{front=decodePiece(p.frontendPiece);}catch{throw new BadRequestException('Invalid frontend fragment');}
    if(this.active>=2)throw new HttpException('Background workers are occupied',429);
    this.active++;
    try {
      await this.storage();await this.admission(ticket);
      const row=await this.db!.query('SELECT r.*,v.stamps FROM ocv_after.runs r JOIN ocv_after.receipts v ON v.id=r.id WHERE r.id=$1 AND r.ticket_sha=$2',[id,sha(ticket)]);
      if(!row.rows.length)throw new HttpException('Receipt expired or ticket is invalid',404);
      const saved=row.rows[0];if(sha(front)!==saved.frontend_sha)throw new BadRequestException('Frontend fragment checksum mismatch');
      const file=path.join(this.folder,`${id}.part`),info=await lstat(file);
      if(!info.isFile()||info.isSymbolicLink()||info.size>4096)throw Error('Backend fragment is invalid');
      const back=await readFile(file);if(sha(back)!==saved.backend_sha)throw Error('Backend fragment checksum mismatch');
      const bytes=Buffer.concat([front,back,decodePiece(saved.database_piece)]);
      if(sha(bytes)!==saved.package_sha)throw Error('Reconstructed package checksum mismatch');
      const reconstructed=JSON.parse(bytes.toString('utf8'));
      return {canContinue:true,reassembled:true,sites:['browser','backend-file','postgresql'],packageSha:saved.package_sha,result:reconstructed.result,stamps:saved.stamps,clicks:Number(saved.clicks)};
    }catch(error){if(error instanceof HttpException)throw error;throw new ServiceUnavailableException('Receipt fragments cannot currently be reconstructed');}
    finally{this.active--;}
  }
  async onModuleDestroy(){this.redis?.disconnect();await this.db?.end();}
}
