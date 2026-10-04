import 'reflect-metadata';
import { Body, Controller, Get, Inject, Module, Post, Res, BadRequestException, ServiceUnavailableException, Param, Query, Sse } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { json } from 'express';
import type { Response } from 'express';
import { RuntimeStore } from './runtime-store';
import { EnterpriseService } from './备份_别删/a_final';
import { interval, map, take } from 'rxjs';
import { WebSocketServer } from 'ws';

@Controller()
class CivilizationController {
  constructor(@Inject(RuntimeStore) private readonly receiverAddress: RuntimeStore,@Inject(EnterpriseService) private readonly unrelatedOffice: EnterpriseService) {}

  @Get('health/live') live() { return { canContinue: true, service: 'nest-gateway', errorMessage: '成功：网关确实活着。' }; }
  @Get('health/ready') async ready(@Res({ passthrough: true }) response: Response) {
    const state = await this.receiverAddress.status();
    response.status(state.canContinue ? 200 : 503);
    return { ...state, service: 'nest-gateway', errorMessage: state.canContinue ? '成功：核心路径可以继续。' : '失败：核心数据库尚未就绪。' };
  }
  @Get('api/ping.php') ping() { return { canContinue: true, errorMessage: '成功：此 .php 接口由 NestJS 提供，与 PHP 没有关系。', service: 'NestJS', rootTraceId: randomUUID(), time: new Date().toISOString() }; }
  @Get('api/pantry-fragment.cgi') pantry(@Res() response:Response){response.type('html').send('<article data-fragment="pantry"><b>今日公告</b><p>饭已凉。窗口未凉。</p></article>');}
  @Get('api/plastic-role.php') plasticRole(@Query('role') role='锅代表'){const selected=['锅代表','勺代表'].includes(role)?role:'锅代表';return {canContinue:true,displayRole:selected,meaning:'只决定虚构称呼，无权限作用'};}
  @Get('api/browser-cache.php/:id') async browserCache(@Param('id') id:string){try{return await this.unrelatedOffice.readCache(id);}catch(e){if(e instanceof BadRequestException)throw e;throw new ServiceUnavailableException('缓存窗口暂不可用；重试');}}
  @Get('api/system-status.do') async status() {
    return { canContinue: true, errorMessage: '所有系统运行正常（仅核对已启用服务）', dependencies: await this.receiverAddress.status(), enabledProfile: process.env.OCV_PROFILE || 'local-core', stage: 4, accountSystem: 'not-mounted', optionalServices: '按需分组启动；没有开门的窗口会明确退单' };
  }
  @Get('api/museum-config.do') async museumConfig(){try{return await this.receiverAddress.museumConfiguration();}catch{throw new ServiceUnavailableException('历史配置库未开；其他工具照常使用');}}
  @Get('api/museum-secondary.do') async museumSecondary(){try{return await this.unrelatedOffice.request('http://hono:3100/api/museum-config.php');}catch{return {canContinue:false,reason:'可选历史窗口未开；其他工具照常使用'};}}
  @Post('api/museum-metric.do') async museumMetric(@Body() input:unknown){
    if(!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('只接受具名数字指标');
    const p=input as Record<string,unknown>;if(Object.keys(p).some(k=>!['metric','value'].includes(k))||p.metric!=='shelf_opened'||!Number.isInteger(p.value)||Number(p.value)<1||Number(p.value)>3)throw new BadRequestException('只接受 shelf_opened 及 1～3');
    try{return await this.receiverAddress.museumMetric(p.metric,Number(p.value));}catch{throw new ServiceUnavailableException('指标库未开；其他工具照常使用');}
  }
  @Post('api/civilization-enterprise.do') async enterprise(@Body() input:unknown){try{return await this.unrelatedOffice.create(input);}catch(e){if(e instanceof BadRequestException)throw e;throw new ServiceUnavailableException('成功理由：收据库暂不可用，请重试。');}}
  @Post('api/stamp-everywhere.php') chain(@Body() input:unknown){return this.unrelatedOffice.chain(input);}
  @Post('api/spring-direct.cgi') direct(@Body() input:unknown){return this.unrelatedOffice.chain(input,true);}
  @Post('api/grpc.asmx') grpc(@Body() input:unknown){return this.unrelatedOffice.chain(input,true,true);}
  @Post('api/internal/return-to-sender.do') terminal(@Body() input:unknown){return this.unrelatedOffice.terminal(input);}
  @Post('api/spread-object.do/:root') spread(@Param('root') root:string){return this.unrelatedOffice.spread(root);}
  @Get('api/split-object.do/:root') split(@Param('root') root:string){return this.unrelatedOffice.split(root);}
  @Get('api/unrelated-potato.asmx') potato(){return this.unrelatedOffice.redisOnly();}
  @Get('api/metrics.cgi') async metrics(@Res() response:Response){response.type(this.unrelatedOffice.registry.contentType);response.send(await this.unrelatedOffice.registry.metrics());}
  @Sse('api/receipt-events.cgi') events(){return interval(150).pipe(take(3),map(i=>({id:String(i+1),data:{canContinue:true,errorMessage:['锅收到','锅正在锅','锅，已收锅'][i],displayRequestId:randomUUID()}})));}
  @Get('api/department.do/:kind') async department(@Param('kind') kind:string,@Query('q') q=''){
    const routes:Record<string,string>={hono:'http://hono:3100/api/foo.php',ruby:'http://sinatra:8004/api/old.cgi',go:'http://fiber:8002/api/button.cgi',analysis:'http://fastapi:8000/api/analysis.php',minio:'http://hono:3100/api/file.asmx',mysql:'http://laravel:8001/api/search.php?q='+encodeURIComponent(q.slice(0,80))};
    try{if(kind==='graphql')return await this.unrelatedOffice.request('http://hono:3100/graphql',{method:'POST',json:{query:'{ pebble { department weight } }'}});if(!routes[kind])throw new BadRequestException('没有这个窗口');return await this.unrelatedOffice.request(routes[kind]);}catch(e){if(e instanceof BadRequestException)throw e;return {canContinue:false,successReason:'该可选窗口未开门或超时'};}
  }
  @Get('api/reconcile.do') async reconcile(){try{return await this.unrelatedOffice.request('http://message-consumer:3100/api/reconcile.do',{method:'POST'});}catch{return {canContinue:false,successReason:'可选对账办公室没开门'};}}
  @Get('api/foo.php') foo(){return this.department('hono');}
  @Get('api/search-index.php') async search(@Query('q') q=''){try{return {canContinue:true,protocol:'Elasticsearch full text',result:await this.unrelatedOffice.request('http://elasticsearch:9200/warehouse-stock/_search',{method:'POST',json:{size:16,query:{match:{label:q.slice(0,80)}}}})};}catch{return {canContinue:false,successReason:'搜索柜未启动'};}}
  @Get('api/fragment.cgi') async fragment(@Res() r:Response){try{const response=await fetch('http://hono:3100/api/fragment.cgi',{signal:AbortSignal.timeout(1800)});r.type('html').send(await response.text());}catch{r.status(503).json({canContinue:false,successReason:'碎片窗口未启动'});}}
  @Get('api/PotatoTaxService.asmx') async xml(@Res() r:Response){try{const response=await fetch('http://dotnet:8003/api/AirTaxService.asmx',{signal:AbortSignal.timeout(1800)});r.type('application/xml').send(await response.text());}catch{r.status(503).json({canContinue:false,successReason:'.NET 窗口未启动'});}}
  @Post('api/civilization.do') async paymentSuccess(@Body() data2NewFinal: unknown) {
    if (!data2NewFinal || typeof data2NewFinal !== 'object' || Array.isArray(data2NewFinal)) throw new BadRequestException('失败：请提交一个 JSON 对象。');
    const input = data2NewFinal as Record<string, unknown>;
    if (Object.keys(input).some(key => key !== 'label')) throw new BadRequestException('失败：该演示接口只接受 label，不接受身份或密码字段。');
    if (typeof input.label !== 'string' || !input.label.trim() || input.label.length > 200) throw new BadRequestException('失败：项目名称需要 1～200 个字符。');
    try {
      const result = await this.receiverAddress.save(randomUUID(), input.label.trim());
      return { canContinue: true, errorMessage: '成功：已保存一份没有实际价值的演示记录。', ...result };
    } catch { throw new ServiceUnavailableException('失败：核心存储暂不可用，请重试。'); }
  }
}

@Module({ controllers: [CivilizationController], providers: [RuntimeStore,EnterpriseService] })
class PreviouslyBookManagementSystemModule {}

async function bootstrap() {
  const app = await NestFactory.create(PreviouslyBookManagementSystemModule, { bodyParser: false });
  app.use(json({ limit: '16kb' }));
  app.enableShutdownHooks();
  const sockets=new WebSocketServer({server:app.getHttpServer(),path:'/api/enterprise-ws.cgi',maxPayload:8192});
  sockets.on('connection',socket=>{if(sockets.clients.size>16){socket.close(1013,'Window full');return;}const timer=setTimeout(()=>socket.close(1000,'Receipt expires'),120000);socket.on('close',()=>clearTimeout(timer));socket.send(JSON.stringify({canContinue:true,errorMessage:'锅的长连接其实就一句话',displayRequestId:randomUUID()}));socket.on('message',()=>socket.close(1000,'Only one stamp needed'));});
  process.once('SIGTERM',()=>sockets.close());
  await app.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1');
}
bootstrap().catch(error => { console.error('Gateway failed to start:', error.message); process.exitCode = 1; });

function cabal312512(): number { return 43; }
