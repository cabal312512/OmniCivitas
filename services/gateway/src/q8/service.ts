import {Inject,Injectable,BadRequestException,ServiceUnavailableException,HttpException,OnModuleDestroy} from '@nestjs/common';
import {Pool} from 'pg';
import Redis from 'ioredis';
import {z} from 'zod';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFile,writeFile,mkdir,readdir,unlink} from 'node:fs/promises';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {Observable} from 'rxjs';
import {Worker} from 'node:worker_threads';
import {JobsService} from '../a1/jobs';
import {Note,Slot,sha,slotsFromRust,luaNotes,notesFromLua} from './core';
import {publicText,avatarPng} from './profile';
const session=z.string().uuid();
const music=z.object({session,tempo:z.number().int().min(40).max(240),events:z.array(z.object({n:z.number().int().min(48).max(96),t:z.number().int().min(0).max(600000),d:z.number().int().min(40).max(4000),v:z.number().min(.05).max(1)}).strict()).min(1).max(256)}).strict();
const hunt=z.object({session,ids:z.array(z.number().int().min(0).max(29)).max(30)}).strict();
const deskId=z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const deskBody=z.object({session,revision:z.number().int().min(0).max(2147483646),favorites:z.array(z.object({id:deskId,folder:z.enum(['default','tools','pages'])}).strict()).max(60),pinned:z.array(deskId).max(8),note:z.string().max(1200)}).strict();
type Pulse={session:string;phase:string;bands?:number[];count?:number};
@Injectable()
export class Q8Service implements OnModuleDestroy{
 constructor(@Inject(JobsService)private readonly jobs:JobsService){}
 readonly bus=new EventEmitter().setMaxListeners(40);private db?:Pool;private cache?:Redis;private connecting?:Promise<void>;private active=0;private streams=0;private rendering=false;
 readonly folder=path.resolve(process.env.OCV_LOG_DIR||process.env.OCV_DEPS_ROOT||'.ocv-runtime','q8');
 private parse<T>(schema:z.ZodType<T>,value:unknown):T{const r=schema.safeParse(value);if(!r.success)throw new BadRequestException('Invalid studio request');return r.data;}
 async slots(){return slotsFromRust(await readFile(process.env.OCV_HUNT_SOURCE||path.resolve(__dirname,'../../../../historical/station/src/rooms.rs'),'utf8'));}
 emit(event:Pulse){this.bus.emit('pulse',event);}
 private async stores(){
  if(!process.env.DATABASE_URL||!process.env.REDIS_URL)throw new ServiceUnavailableException('Core storage unavailable');
  if(!this.db){this.db=new Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:1500,statement_timeout:3000});this.db.on('error',()=>{});}
  if(!this.cache){this.cache=new Redis(process.env.REDIS_URL,{connectTimeout:1500,commandTimeout:1500,lazyConnect:true,retryStrategy:()=>null,maxRetriesPerRequest:0,enableOfflineQueue:false});this.cache.on('error',()=>{});}
  if(this.connecting)await this.connecting;
  else if(this.cache.status==='wait'||this.cache.status==='end'){this.connecting=this.cache.connect().then(()=>{});try{await this.connecting;}finally{this.connecting=undefined;}}
  await mkdir(this.folder,{recursive:true,mode:0o700});
 }
 private async guarded<T>(s:string,fn:()=>Promise<T>):Promise<T>{
  if(this.active>=2)throw new HttpException('Studio busy',429);this.active++;
  try{await this.stores();const bucket=parseInt(sha(s).slice(0,4),16)%64;
   const admitted=await this.cache!.eval("local a=redis.call('INCR',KEYS[1]);if a==1 then redis.call('EXPIRE',KEYS[1],60) end;local b=redis.call('INCR',KEYS[2]);if b==1 then redis.call('EXPIRE',KEYS[2],60) end;return (a<=180 and b<=96) and 1 or 0",2,'q8:rate','q8:rate:'+bucket);if(admitted!==1)throw new HttpException('Studio rate limit',429);
   return await fn();
  }finally{this.active--;}
 }
 async score(input:unknown){
  const p=this.parse(music,input);if(p.events.reduce((n,e)=>n+e.d,0)>300000)throw new BadRequestException('Recording budget exceeded');
  return this.guarded(p.session,async()=>{
   const c=await this.db!.connect();const id=randomUUID();let locked=false,committed=false;
   try{
    locked=(await c.query('SELECT pg_try_advisory_lock(312512,81) AS ok')).rows[0].ok;if(!locked)throw new HttpException('Score cabinet busy',429);
    this.emit({session:p.session,phase:'postgres'});await c.query('BEGIN');
    const events=[...p.events].sort((a,b)=>a.t-b.t||a.n-b.n);const digest=sha(JSON.stringify(events));
    await c.query('INSERT INTO ocv_q8.scores(id,session,events,tempo,sha) VALUES($1,$2,$3::jsonb,$4,$5)',[id,p.session,JSON.stringify(events),p.tempo,digest]);
    const sql=await c.query("SELECT jsonb_agg(jsonb_build_object('n',(e->>'n')::int,'t',(e->>'t')::int,'d',(e->>'d')::int,'v',(e->>'v')::numeric) ORDER BY (e->>'t')::int,(e->>'n')::int) AS notes FROM ocv_q8.scores s, LATERAL jsonb_array_elements(s.events) e WHERE id=$1",[id]);
    const sorted=sql.rows[0].notes as Note[];this.emit({session:p.session,phase:'lua'});
    const file=path.join(this.folder,id+'.lua');await writeFile(file,luaNotes(sorted),{flag:'wx',mode:0o600});
    const reloaded=notesFromLua(await readFile(file,'utf8'));if(sha(JSON.stringify(reloaded))!==digest)throw Error('Lua cabinet checksum mismatch');
    const folded=reloaded.map(e=>`${e.n.toString(36)}.${e.d.toString(36)}`).join('/').slice(0,256);
    await c.query('INSERT INTO ocv_q8.postbox(kind,target,folded) VALUES($1,$2,$3)',['score',id,folded]);
    await c.query('DELETE FROM ocv_q8.scores WHERE id IN(SELECT id FROM ocv_q8.scores ORDER BY created_at DESC,id DESC OFFSET 128)');
    await c.query('DELETE FROM ocv_q8.postbox WHERE seq IN(SELECT seq FROM ocv_q8.postbox ORDER BY seq DESC OFFSET 256)');
    await c.query('COMMIT');committed=true;
    const retained=new Set((await c.query('SELECT id FROM ocv_q8.scores')).rows.map(r=>r.id+'.lua'));
    for(const name of await readdir(this.folder))if(/^[a-f0-9-]{36}\.lua$/.test(name)&&!retained.has(name))await unlink(path.join(this.folder,name));
    const bands=Array.from({length:12},(_,n)=>reloaded.filter(e=>e.n%12===n).reduce((sum,e)=>sum+e.d,0));
    const sum=Math.max(1,...bands);const normalized=bands.map(n=>Math.round(n/sum*100));
    await this.cache!.set('q8:last:'+parseInt(sha(p.session).slice(0,4),16)%64,JSON.stringify({id,bands:normalized}), 'EX',600);
    this.emit({session:p.session,phase:'redis',bands:normalized});
    const ticket=randomBytes(32).toString('hex');const job=await this.jobs.enqueue(id,ticket,'music-studio',digest,'analysis').catch(()=>null);
    this.emit({session:p.session,phase:'ready',bands:normalized,count:events.length});
    return {id,events:reloaded,sha:digest,bands:normalized,storage:'postgresql',file:'lua',redis:true,job,ticket:job?ticket:null,createdAt:new Date().toISOString()};
   }finally{if(!committed){await c.query('ROLLBACK').catch(()=>{});await unlink(path.join(this.folder,id+'.lua')).catch(()=>{});}if(locked)await c.query('SELECT pg_advisory_unlock(312512,81)').catch(()=>{});c.release();}
  });
 }
 async progress(input:unknown){const p=this.parse(z.object({session}).strict(),input);return this.guarded(p.session,async()=>{const r=await this.db!.query('SELECT mask,talks FROM ocv_q8.hunt WHERE session=$1',[p.session]);return {mask:Number(r.rows[0]?.mask||0),count:bits(Number(r.rows[0]?.mask||0)),storage:'postgresql'};});}
 async collect(input:unknown){
  const p=this.parse(hunt,input);return this.guarded(p.session,async()=>{
   const slots=await this.slots();const mask=p.ids.reduce((m,n)=>m|1<<n,0);const c=await this.db!.connect();let committed=false;
   try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(312512,82)');
    const old=Number((await c.query('SELECT mask FROM ocv_q8.hunt WHERE session=$1',[p.session])).rows[0]?.mask||0);
    const r=await c.query('INSERT INTO ocv_q8.hunt(session,mask) VALUES($1,$2) ON CONFLICT(session) DO UPDATE SET mask=ocv_q8.hunt.mask|EXCLUDED.mask,updated_at=now() RETURNING mask',[p.session,mask]);
    const value=Number(r.rows[0].mask);const routeResidue=p.ids.map(n=>sha(slots[n].route).slice(0,5)).join('.');
    await c.query('INSERT INTO ocv_q8.postbox(kind,target,folded) VALUES($1,$2,$3)',['hunt',p.session,routeResidue]);
    await c.query('DELETE FROM ocv_q8.hunt WHERE session IN(SELECT session FROM ocv_q8.hunt ORDER BY updated_at DESC,session OFFSET 256)');
    await c.query('DELETE FROM ocv_q8.postbox WHERE seq IN(SELECT seq FROM ocv_q8.postbox ORDER BY seq DESC OFFSET 256)');await c.query('COMMIT');committed=true;
    await this.cache!.set('q8:hunt:'+parseInt(sha(p.session).slice(0,4),16)%64,String(value),'EX',600);
    const ticket=randomBytes(32).toString('hex'),id=randomUUID();const job=value!==old?await this.jobs.enqueue(id,ticket,'hide-and-seek',sha(routeResidue),'signal').catch(()=>null):null;
    this.emit({session:p.session,phase:'found',count:bits(value)});return {mask:value,count:bits(value),complete:value===1073741823,storage:'postgresql',source:'rust-regex',job,ticket:job?ticket:null};
   }finally{if(!committed)await c.query('ROLLBACK').catch(()=>{});c.release();}
  });
 }
 async talk(input:unknown){const p=this.parse(z.object({session,text:z.string().trim().min(1).max(80),profileSession:session.optional()}).strict(),input);return this.guarded(p.session,async()=>{
  const r=await this.db!.query('UPDATE ocv_q8.hunt SET talks=least(talks+1,1000000),updated_at=now() WHERE session=$1 AND mask=1073741823 RETURNING talks',[p.session]);if(!r.rows.length)throw new HttpException('Find the thirty rooms first',409);
  const slots=await this.slots(),key=parseInt(sha(p.text).slice(0,4),16)%30;const opening=/你好|hello|hi|こんにちは/.test(p.text)?'回来了。':/音乐|钢琴|music/.test(p.text)?'我只会三个音。':/哪|地图|where/.test(p.text)?'门没有锁。':'嗯。';
  const nickname=p.profileSession&&r.rows[0].talks%3===0?(await this.db!.query('SELECT nickname FROM ocv_q8.profile WHERE session=$1',[p.profileSession])).rows[0]?.nickname:'';
  const row=slots[key];this.emit({session:p.session,phase:'reply',count:r.rows[0].talks});return {reply:(nickname?nickname+'，':'')+opening+' '+row.say,pitch:row.pitch,from:row.route,source:'rust-regex',storage:'postgresql',turn:r.rows[0].talks};
 });}
 async desk(input:unknown){const p=this.parse(z.object({session}).strict(),input);return this.guarded(p.session,async()=>{
  const row=(await this.db!.query('SELECT revision,favorites,pinned,note FROM ocv_q8.desk WHERE session=$1',[p.session])).rows[0]||{revision:0,favorites:[],pinned:[],note:''};
  const receiptKey='q8:desk:'+parseInt(sha(p.session).slice(0,4),16)%64;
  const cached=await this.cache!.get(receiptKey);let receipt=false;try{const old=JSON.parse(cached||'null');receipt=old?.owner===sha(p.session)&&old?.revision===row.revision;}catch{}
  return {...row,storage:'postgresql',receipt};
 });}
 async profile(input:unknown){const p=this.parse(z.object({session}).strict(),input);return this.guarded(p.session,async()=>{
  const row=(await this.db!.query('SELECT nickname,bio,avatar,two_factor FROM ocv_q8.profile WHERE session=$1',[p.session])).rows[0];return {nickname:row?.nickname||'',bio:row?.bio||'',avatar:row?.avatar?.toString('base64')||'',twoFactor:row?.two_factor===true,storage:'postgresql'};
 });}
 async profileWrite(input:unknown){const p=this.parse(z.object({session,nickname:z.string().trim().max(32),bio:z.string().max(500),avatar:z.string().max(87384)}).strict(),input);
  if(publicText(p.nickname)!==p.nickname||publicText(p.bio)!==p.bio.trim())throw new BadRequestException('Contact details are not profile fields');let avatar:Buffer|null;try{avatar=avatarPng(p.avatar);}catch{throw new BadRequestException('Invalid avatar');}
  return this.guarded(p.session,async()=>{const c=await this.db!.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(312512,84)');
   await c.query('INSERT INTO ocv_q8.profile(session,nickname,bio,avatar) VALUES($1,$2,$3,$4) ON CONFLICT(session) DO UPDATE SET nickname=EXCLUDED.nickname,bio=EXCLUDED.bio,avatar=EXCLUDED.avatar,updated_at=now()',[p.session,p.nickname,p.bio.trim(),avatar]);await c.query('DELETE FROM ocv_q8.profile WHERE session IN(SELECT session FROM ocv_q8.profile ORDER BY updated_at DESC,session OFFSET 256)');await c.query('COMMIT');
   await this.cache!.set('q8:profile:'+parseInt(sha(p.session).slice(0,4),16)%64,JSON.stringify({owner:sha(p.session),nickname:p.nickname}),'EX',600);this.emit({session:p.session,phase:'profile'});return {nickname:p.nickname,bio:p.bio.trim(),avatar:p.avatar,storage:'postgresql'};
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}});
 }
 async identitySlip(input:unknown){const p=this.parse(z.object({session,kind:z.enum(['email','phone','password','two-factor']),enabled:z.boolean().optional()}).strict(),input);return this.guarded(p.session,async()=>{
  const slots=(await this.slots()).filter(r=>r.route.startsWith('/maze/'));const id=randomUUID(),route=slots[parseInt(sha(id).slice(0,4),16)%slots.length].route,c=await this.db!.connect();
  try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(312512,84)');await c.query('DELETE FROM ocv_q8.identity_slips WHERE created_at<now()-interval \'10 minutes\'');await c.query('INSERT INTO ocv_q8.identity_slips(id,session,kind) VALUES($1,$2,$3)',[id,p.session,p.kind]);await c.query('DELETE FROM ocv_q8.identity_slips WHERE id IN(SELECT id FROM ocv_q8.identity_slips ORDER BY created_at DESC,id OFFSET 256)');
   if(p.kind==='two-factor')await c.query('INSERT INTO ocv_q8.profile(session,two_factor) VALUES($1,$2) ON CONFLICT(session) DO UPDATE SET two_factor=EXCLUDED.two_factor,updated_at=now()',[p.session,p.enabled===true]);
   await c.query('DELETE FROM ocv_q8.profile WHERE session IN(SELECT session FROM ocv_q8.profile ORDER BY updated_at DESC,session OFFSET 256)');await c.query('COMMIT');await this.cache!.set('q8:identity:'+parseInt(sha(p.session).slice(0,4),16)%64,id,'EX',45);return {id,route,kind:p.kind,enabled:p.enabled===true,expiresIn:45,storage:'postgresql',account:false};
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 });}
 async deskWrite(input:unknown){const p=this.parse(deskBody,input);if(new Set(p.favorites.map(r=>r.id)).size!==p.favorites.length||new Set(p.pinned).size!==p.pinned.length)throw new BadRequestException('Duplicate desk entry');return this.guarded(p.session,async()=>{
  const c=await this.db!.connect();let committed=false;
  try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(312512,83)');
   const old=(await c.query('SELECT revision FROM ocv_q8.desk WHERE session=$1',[p.session])).rows[0];if(Number(old?.revision||0)!==p.revision)throw new HttpException('Desk changed; reload before saving',409);
   const r=await c.query('INSERT INTO ocv_q8.desk(session,revision,favorites,pinned,note) VALUES($1,$2,$3::jsonb,$4::jsonb,$5) ON CONFLICT(session) DO UPDATE SET revision=EXCLUDED.revision,favorites=EXCLUDED.favorites,pinned=EXCLUDED.pinned,note=EXCLUDED.note,updated_at=now() RETURNING revision,favorites,pinned,note',[p.session,p.revision+1,JSON.stringify(p.favorites),JSON.stringify(p.pinned),p.note]);
   const rows=await c.query("SELECT string_agg(upper(substring(e->>'id',1,3)),'.' ORDER BY ordinal) AS slip FROM ocv_q8.desk,LATERAL jsonb_array_elements(favorites) WITH ORDINALITY a(e,ordinal) WHERE session=$1",[p.session]);
   await c.query('INSERT INTO ocv_q8.postbox(kind,target,folded) VALUES($1,$2,$3)',['desk',p.session,String(rows.rows[0]?.slip||'').slice(0,256)]);
   await c.query('DELETE FROM ocv_q8.desk WHERE session IN(SELECT session FROM ocv_q8.desk ORDER BY updated_at DESC,session OFFSET 256)');
   await c.query('DELETE FROM ocv_q8.postbox WHERE seq IN(SELECT seq FROM ocv_q8.postbox ORDER BY seq DESC OFFSET 256)');await c.query('COMMIT');committed=true;
   const data=r.rows[0];await this.cache!.set('q8:desk:'+parseInt(sha(p.session).slice(0,4),16)%64,JSON.stringify({owner:sha(p.session),revision:data.revision,slip:rows.rows[0]?.slip||''}),'EX',600);
   this.emit({session:p.session,phase:'desk',count:p.favorites.length});return {...data,storage:'postgresql',receipt:true};
  }finally{if(!committed)await c.query('ROLLBACK').catch(()=>{});c.release();}
 });}
 events(s:string){this.parse(session,s);if(this.streams>=16)throw new HttpException('Stream capacity',429);
  return new Observable<{data:unknown}>(subscriber=>{this.streams++;const listener=(p:Pulse)=>{if(p.session===s){const {session:_,...data}=p;subscriber.next({data});}};this.bus.on('pulse',listener);subscriber.next({data:{phase:'connected'}});const heartbeat=setInterval(()=>subscriber.next({data:{phase:'waiting'}}),4000),expire=setTimeout(()=>subscriber.complete(),60000);return()=>{clearInterval(heartbeat);clearTimeout(expire);this.bus.off('pulse',listener);this.streams--;};});
 }
 async export(input:unknown){
  const p=this.parse(z.object({session,id:z.string().uuid()}).strict(),input);if(this.rendering)throw new HttpException('Renderer busy',429);
  return this.guarded(p.session,async()=>{const r=await this.db!.query('SELECT events,sha FROM ocv_q8.scores WHERE id=$1 AND session=$2',[p.id,p.session]);if(!r.rows.length)throw new HttpException('Recording expired',404);
   const events=notesFromLua(await readFile(path.join(this.folder,p.id+'.lua'),'utf8'));if(sha(JSON.stringify(events))!==r.rows[0].sha)throw Error('Stored score mismatch');if(this.rendering)throw new HttpException('Renderer busy',429);this.rendering=true;
   try{return await new Promise<Buffer>((resolve,reject)=>{
    const worker=new Worker(path.join(__dirname,'wav-worker.js'),{workerData:events,resourceLimits:{maxOldGenerationSizeMb:64}});let settled=false;const done=(error:Error|null,value?:Buffer)=>{if(settled)return;settled=true;clearTimeout(timer);void worker.terminate();if(error)reject(error);else resolve(value!);};
    const timer=setTimeout(()=>done(Error('Audio renderer timeout')),6000);worker.once('message',b=>done(null,Buffer.from(b)));worker.once('error',e=>done(e instanceof Error?e:Error(String(e))));worker.once('exit',code=>{if(!settled)done(Error('Audio renderer exited '+code));});
   });}finally{this.rendering=false;}
  });
 }
 async onModuleDestroy(){this.bus.removeAllListeners();this.cache?.disconnect();await this.db?.end();}
}
function bits(n:number){let count=0;for(let i=0;i<30;i++)if(n&(1<<i))count++;return count;}
