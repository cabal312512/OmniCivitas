import {Inject,Injectable,BadRequestException,HttpException,ServiceUnavailableException,OnModuleDestroy} from '@nestjs/common';
import {Pool} from 'pg';
import {z} from 'zod';
import {randomBytes,randomUUID,createHash,timingSafeEqual} from 'node:crypto';
import {mkdir,writeFile,readFile,readdir,unlink} from 'node:fs/promises';
import path from 'node:path';
import {JobsService} from '../a1/jobs';
const digest=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const uuid=z.string().uuid(),ticket=z.string().regex(/^[a-f0-9]{64}$/),word=z.enum(['hello','where','again','bye']);
const event=z.discriminatedUnion('kind',[
 z.object({id:uuid,kind:z.literal('collect'),data:z.object({slot:z.number().int().min(0).max(29)}).strict()}).strict(),
 z.object({id:uuid,kind:z.literal('favorite'),data:z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),folder:z.enum(['default','tools','pages']),action:z.enum(['add','remove','move'])}).strict()}).strict(),
 z.object({id:uuid,kind:z.literal('talk'),data:z.object({message:word}).strict()}).strict(),
 z.object({id:uuid,kind:z.literal('achievement'),data:z.object({code:z.enum(['hunt-30','favorite-first','visitor-return'])}).strict()}).strict()
]);
const kinds={music:'site-music',projection:'site-projection',certificate:'site-certificate',index:'site-index'};
const request=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('music'),session:uuid,score:uuid,preset:z.enum(['sine','triangle','bell']).default('bell'),sampleRate:z.union([z.literal(8000),z.literal(16000),z.literal(22050),z.literal(44100)]).default(16000),gain:z.number().min(0).max(2).default(.8),lowpassHz:z.number().min(0).max(18000).default(0),normalize:z.boolean().default(true),echo:z.object({delayMs:z.number().min(20).max(800),feedback:z.number().min(0).max(.7),mix:z.number().min(0).max(.8),repeats:z.number().int().min(1).max(4)}).strict().optional()}).strict(),
 z.object({kind:z.literal('projection'),session:uuid,profileSession:uuid.optional(),events:z.array(event).max(16).default([]),message:word.optional()}).strict(),
 z.object({kind:z.literal('certificate'),session:uuid,certificate:z.object({schema:z.literal('ocv.tool-certificate/1'),kind:z.enum(['matrix','base','json','csv']),input:z.record(z.string(),z.unknown()),expected:z.unknown().optional()}).strict()}).strict(),
 z.object({kind:z.literal('index'),session:uuid,query:z.string().max(80).regex(/^[^\x00-\x1f]*$/),from:z.string().max(240).default('/'),to:z.string().max(240).optional(),group:z.string().max(40).optional(),limit:z.number().int().min(1).max(20).default(12)}).strict()
]);
type SiteRequest=z.infer<typeof request>;
@Injectable()
export class OldWindow implements OnModuleDestroy {
 constructor(@Inject(JobsService)private readonly jobs:JobsService){}
 private db?:Pool;private active=0;
 private memory=new Map<string,{expires:number,input:unknown,result?:unknown}>();
 private rate=new Map<number,{n:number,until:number}>();
 readonly folder=path.resolve(process.env.OCV_LOG_DIR||process.env.OCV_DEPS_ROOT||'.ocv-runtime','site-stock');
 private database(){if(!process.env.DATABASE_URL)throw new ServiceUnavailableException('暂未连接');if(!this.db){this.db=new Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:1500,statement_timeout:4000});this.db.on('error',()=>{});}return this.db;}
 private read<T>(schema:z.ZodType<T>,value:unknown){const parsed=schema.safeParse(value);if(!parsed.success)throw new BadRequestException('Invalid site request');return parsed.data;}
 private boundedMemory(){const now=Date.now();for(const[id,v]of this.memory)if(v.expires<now)this.memory.delete(id);while(this.memory.size>64)this.memory.delete(this.memory.keys().next().value!);}
 private admit(session:string){this.boundedMemory();const n=parseInt(digest(session).slice(0,4),16)%64,now=Date.now();const old=this.rate.get(n);const value=old&&old.until>now?old:{n:0,until:now+60000};if(++value.n>24||this.active>=4)throw new HttpException('请稍后再试',429);this.rate.set(n,value);}
 async submit(value:unknown){
  const p=this.read(request,value);this.admit(p.session);this.active++;
  try {
   if(!process.env.OCV_RUNNER_KEY)throw new ServiceUnavailableException('暂未连接');
   const db=this.database();let input:unknown=p;
   if(p.kind==='music'){
    const row=(await db.query('SELECT events,tempo,sha FROM ocv_q8.scores WHERE id=$1 AND session=$2',[p.score,p.session])).rows[0];if(!row)throw new HttpException('记录已失效',404);
    if(row.events.some((e:{t:number,d:number})=>e.t+e.d>18000))throw new BadRequestException('处理片段限18秒');
    const end=Math.max(0,...row.events.map((e:{t:number,d:number})=>e.t+e.d));
    const tail=p.echo&&p.echo.mix>0?p.echo.delayMs*p.echo.repeats:0;
    const frames=Math.max(0,...row.events.map((e:{t:number,d:number})=>Math.round((e.t+e.d)*p.sampleRate/1000)))+(p.echo&&p.echo.mix>0?Math.round(p.echo.delayMs*p.sampleRate/1000)*p.echo.repeats:0);
    if(end+tail>20000||frames>p.sampleRate*20||Math.ceil(Math.max(end+tail,frames*1000/p.sampleRate)*p.sampleRate/1000)>p.sampleRate*20)throw new BadRequestException('尾音后总长度限20秒');
    if(row.events.some((e:{n:number})=>440*Math.pow(2,(e.n-69)/12)>=p.sampleRate*.45))throw new BadRequestException('音高超出当前采样范围');
    if(p.lowpassHz>0&&(p.lowpassHz<20||p.lowpassHz>p.sampleRate*.45))throw new BadRequestException('滤波频率超出当前采样范围');
    if(row.events.reduce((sum:number,e:{d:number})=>sum+Math.ceil(e.d*p.sampleRate/1000),0)>8000000)throw new BadRequestException('音符处理预算超出范围');
    input={schemaVersion:1,events:row.events,tempo:row.tempo,preset:p.preset,sampleRate:p.sampleRate,gain:p.gain,lowpassHz:p.lowpassHz,normalize:p.normalize,echo:p.echo||{delayMs:180,feedback:.25,mix:0,repeats:3},includeMidi:true};
   } else if(p.kind==='projection'){
    const c=await db.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[p.session]);for(const e of p.events){const conflict=(await c.query('SELECT session,kind,data=($2::jsonb) AS same FROM ocv_web3.event_lines WHERE id=$1',[e.id,JSON.stringify(e.data)])).rows[0];if(conflict&&(conflict.session!==p.session||conflict.kind!==e.kind||!conflict.same))throw new HttpException('事件冲突',409);
     if(!conflict){const clock=(await c.query('INSERT INTO ocv_web3.lost_clock(session,value) VALUES($1,1) ON CONFLICT(session) DO UPDATE SET value=lost_clock.value+1,updated_at=now() RETURNING value',[p.session])).rows[0];const inserted=(await c.query('INSERT INTO ocv_web3.event_lines(id,session,kind,data,session_seq) VALUES($1,$2,$3,$4::jsonb,$5) ON CONFLICT(id) DO UPDATE SET id=event_lines.id RETURNING session,kind,data=($4::jsonb) AS same',[e.id,p.session,e.kind,JSON.stringify(e.data),clock.value])).rows[0];if(inserted.session!==p.session||inserted.kind!==e.kind||!inserted.same)throw new HttpException('事件冲突',409);}}
     await c.query("DELETE FROM ocv_web3.event_lines WHERE seq IN(SELECT seq FROM ocv_web3.event_lines ORDER BY seq DESC OFFSET 2048)");await c.query('COMMIT');
    }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
    input={profileSession:p.profileSession||p.session,message:p.message||null};
   } else if(p.kind==='certificate'){
    if(Buffer.byteLength(JSON.stringify(p.certificate))>190000)throw new BadRequestException('核对内容过长');input=p.certificate;
   } else {
    const safe=(url:string)=>url.startsWith('/')&&!url.startsWith('//')&&!/[\\\x00-\x1f]/.test(url);
    if(!safe(p.from)||p.to&&!safe(p.to))throw new BadRequestException('Invalid site path');
    input={schema:'ocv.site-index/1',query:p.query,from:p.from,limit:p.limit,...(p.to?{to:p.to}:{}),...(p.group?{group:p.group}:{})};
   }
   const id=randomUUID(),cap=randomBytes(32).toString('hex'),hash=digest(JSON.stringify(input));
   await db.query('INSERT INTO ocv_web3.return_orders(id,session,kind,ticket_sha,wrong_column) VALUES($1,$2,$3,$4,$5::jsonb)',[id,p.session,p.kind,digest(cap),JSON.stringify(p.kind==='index'?{}:input)]);
   if(p.kind==='index')this.memory.set(id,{input,expires:Date.now()+180000});
   let job;try{job=await this.jobs.enqueue(id,cap,'site-'+p.kind,hash,kinds[p.kind]);}catch(error){await db.query('DELETE FROM ocv_web3.return_orders WHERE id=$1',[id]);this.memory.delete(id);throw error;}
   if(!job){await db.query('DELETE FROM ocv_web3.return_orders WHERE id=$1',[id]);this.memory.delete(id);throw new HttpException('任务暂满',503)}
   await db.query('UPDATE ocv_web3.return_orders SET job_id=$2 WHERE id=$1',[id,job.id]);
   await db.query('UPDATE ocv_shared1.task_books SET owner_bucket=$2 WHERE job_id=$1',[job.id,p.session]);
   await this.trim();return {id,job,ticket:cap};
  }finally{this.active--}
 }
 private async trim(){
  const db=this.database();await db.query("DELETE FROM ocv_web3.return_orders r WHERE NOT EXISTS(SELECT 1 FROM ocv_after.jobs j WHERE j.id=r.job_id AND j.state IN('queued','starting','running')) AND (r.updated_at<now()-interval '24 hours' OR r.id IN(SELECT id FROM ocv_web3.return_orders ORDER BY updated_at DESC OFFSET 64))");
  await db.query("DELETE FROM ocv_web3.warehouse_stock WHERE updated_at<now()-interval '7 days' OR session IN(SELECT session FROM ocv_web3.warehouse_stock ORDER BY updated_at DESC OFFSET 128)");
  await db.query("DELETE FROM ocv_web3.lost_clock c WHERE NOT EXISTS(SELECT 1 FROM ocv_web3.event_lines e WHERE e.session=c.session) AND NOT EXISTS(SELECT 1 FROM ocv_web3.warehouse_stock w WHERE w.session=c.session) AND NOT EXISTS(SELECT 1 FROM ocv_web3.return_orders r JOIN ocv_after.jobs j ON j.id=r.job_id WHERE r.session=c.session AND j.state IN('queued','starting','running')) AND (c.updated_at<now()-interval '7 days' OR c.session IN(SELECT session FROM ocv_web3.lost_clock ORDER BY updated_at DESC OFFSET 2048))");
  await mkdir(this.folder,{recursive:true,mode:0o700});const keep=new Set((await db.query("SELECT id FROM ocv_web3.return_orders WHERE kind='music'")).rows.map(r=>r.id));
  for(const name of await readdir(this.folder))if(/^[a-f0-9-]{36}\.(wav|mid)$/.test(name)&&!keep.has(name.split('.')[0]))await unlink(path.join(this.folder,name)).catch((error:NodeJS.ErrnoException)=>{if(error.code!=='ENOENT')throw error;});
 }
 private auth(key:string|undefined){const expected=process.env.OCV_RUNNER_KEY;if(!expected||!key||!timingSafeEqual(Buffer.from(digest(expected)),Buffer.from(digest(key))))throw new HttpException('Not available',404);}
 async worker(key:string|undefined,body:unknown){
  this.auth(key);const p=this.read(z.object({job:uuid,action:z.enum(['input','save']),result:z.unknown().optional()}).strict(),body),db=this.database();
  const r=(await db.query('SELECT r.*,j.state FROM ocv_web3.return_orders r JOIN ocv_after.jobs j ON j.id=r.job_id WHERE j.id=$1',[p.job])).rows[0];if(!r||!['starting','running'].includes(r.state))throw new HttpException('任务已失效',409);
  if(p.action==='input'){
   let input=r.wrong_column;
   if(r.kind==='index'){this.boundedMemory();input=this.memory.get(r.id)?.input;if(!input)throw new HttpException('查询已过期，请重试',410);}
   if(r.kind==='projection'){
    const profile=r.wrong_column.profileSession,rows=await Promise.all([
     db.query('SELECT mask FROM ocv_q8.hunt WHERE session=$1',[r.session]),db.query('SELECT favorites FROM ocv_q8.desk WHERE session=$1',[profile]),
     db.query('SELECT nickname FROM ocv_q8.profile WHERE session=$1',[profile]),db.query('SELECT checkpoint FROM ocv_web3.warehouse_stock WHERE session=$1',[r.session]),
     db.query('SELECT id,session_seq AS seq,kind,data FROM ocv_web3.event_lines WHERE session=$1 ORDER BY session_seq DESC LIMIT 64',[r.session])]);
    const nickname=String(rows[2].rows[0]?.nickname||'');
    const safeNickname=/^[\p{L}\p{N} _.-]*$/u.test(nickname)&&[...nickname].length<=40&&!/(?:\d[\s().-]*){7,}|password|passwd|email|phone/i.test(nickname)?nickname:'';
    input={schema:'ocv.site-projection/1',session:r.session,snapshot:{mask:Number(rows[0].rows[0]?.mask||0),favorites:rows[1].rows[0]?.favorites||[],nickname:safeNickname},events:rows[4].rows.reverse().map(e=>({...e,seq:Number(e.seq)})),...(rows[3].rows[0]?{prior:{checkpoint:rows[3].rows[0].checkpoint}}:{}),...(r.wrong_column.message?{message:r.wrong_column.message}:{})};
   }
   return {ok:true,id:r.id,kind:r.kind,input};
  }
  if(!p.result||typeof p.result!=='object'||Array.isArray(p.result))throw new BadRequestException('Missing site result');
  let result=p.result as Record<string,any>,summary:Record<string,unknown>={kind:r.kind,storage:'PostgreSQL'};
  if(r.kind==='music'){
   if(result.ok!==true||result.verification?.ok!==true||typeof result.audio!=='string')throw new BadRequestException('Unverified music artifact');
   const audio=Buffer.from(result.audio,'base64'),midi=result.midi?Buffer.from(result.midi,'base64'):null;
   if(audio.length>2000000||audio.length<44||audio.subarray(0,4).toString()!=='RIFF'||midi&&midi.length>65536)throw new BadRequestException('Artifact bounds');
   await mkdir(this.folder,{recursive:true,mode:0o700});await writeFile(path.join(this.folder,r.id+'.wav'),audio,{mode:0o600});if(midi)await writeFile(path.join(this.folder,r.id+'.mid'),midi,{mode:0o600});
   if(digest(await readFile(path.join(this.folder,r.id+'.wav')))!==digest(audio))throw Error('Artifact readback mismatch');
   result={ok:true,analysis:result.analysis,verification:result.verification,audio:{sha:digest(audio),bytes:audio.length},midi:midi?{sha:digest(midi),bytes:midi.length}:null};summary={...summary,formatVerified:true,audioSha:digest(audio),bytes:audio.length,files:midi?2:1};
  } else if(r.kind==='projection'){
   if(result.schema!=='ocv.site-projection/1'||!result.checkpoint||Buffer.byteLength(JSON.stringify(result.checkpoint))>65536)throw new BadRequestException('Projection checkpoint invalid');
   await db.query('INSERT INTO ocv_web3.warehouse_stock(session,checkpoint,content_sha) VALUES($1,$2::jsonb,$3) ON CONFLICT(session) DO UPDATE SET checkpoint=excluded.checkpoint,content_sha=excluded.content_sha,updated_at=now()',[r.session,JSON.stringify(result.checkpoint),digest(JSON.stringify(result.checkpoint))]);
   summary={...summary,count:result.count,deduplicated:result.deduplicated,dialogueRecovered:true};
  } else if(r.kind==='certificate'){
   if(result.schema!=='ocv.tool-certificate/1'||typeof result.valid!=='boolean')throw new BadRequestException('Invalid certificate');summary={...summary,valid:result.valid,certificateKind:result.kind};
  } else {
   if(result.schema!=='ocv.site-index/1'||result.ok!==true||!Array.isArray(result.hits)||result.hits.length>20)throw new BadRequestException('Invalid index reply');
   const ephemeral=this.memory.get(r.id);if(!ephemeral)throw new HttpException('查询已过期',410);ephemeral.result=result;ephemeral.input={};ephemeral.expires=Date.now()+60000;
   summary={...summary,storage:'SQLite/FTS5+PG digest',hits:result.hits.length,catalogDigest:result.readback?.catalogDigest,queryPersisted:false};
  }
  if(Buffer.byteLength(JSON.stringify(result))>1048576)throw new BadRequestException('Site result budget exceeded');
  const hash=digest(JSON.stringify(result));await db.query('UPDATE ocv_web3.return_orders SET result=$2::jsonb,content_sha=$3,updated_at=now() WHERE id=$1',[r.id,JSON.stringify(r.kind==='index'?summary:result),hash]);
  const check=(await db.query('SELECT content_sha FROM ocv_web3.return_orders WHERE id=$1',[r.id])).rows[0];if(check.content_sha!==hash)throw Error('Site receipt readback failed');
  await this.trim();return {ok:true,...summary,resultSha:hash};
 }
 private async receipt(id:string,body:unknown){const p=this.read(z.object({ticket}).strict(),body);this.read(uuid,id);const row=(await this.database().query('SELECT r.*,j.state FROM ocv_web3.return_orders r JOIN ocv_after.jobs j ON j.id=r.job_id WHERE r.id=$1 AND r.ticket_sha=$2',[id,digest(p.ticket)])).rows[0];if(!row)throw new HttpException('记录已失效',404);return row;}
 async result(id:string,body:unknown){const row=await this.receipt(id,body);if(row.state!=='done')return {id,state:row.state,result:null};let value=row.result;if(row.kind==='index'){this.boundedMemory();value=this.memory.get(id)?.result;if(!value)throw new HttpException('查询已过期',410);}return {id,state:row.state,kind:row.kind,result:value,sha:row.content_sha};}
 async download(id:string,name:string,body:unknown){const row=await this.receipt(id,body);if(row.state!=='done'||row.kind!=='music'||!['wav','mid'].includes(name))throw new HttpException('文件未就绪',404);const meta=row.result?.[name==='wav'?'audio':'midi'];if(!meta)throw new HttpException('文件不存在',404);const bytes=await readFile(path.join(this.folder,id+'.'+name));if(digest(bytes)!==meta.sha||bytes.length!==meta.bytes)throw new HttpException('文件校验失败',409);return bytes;}
 async onModuleDestroy(){this.memory.clear();await this.db?.end();}
}
