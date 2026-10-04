import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {composeCall,dockerCall} from './docker-child.mjs';
import './guard-paths.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const save=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');
const root=process.env.OCV_DEPS_ROOT+'/runtime/reports/';
const phase=read('docs/phase-state.json');assert.equal(phase.phase,2);assert.equal(phase.status,'active');
const workspace=read(root+'phase2-build-unit.json');assert.equal(workspace.status,'passed');assert.equal(workspace.unitTests,5);assert.ok(workspace.runs.every(x=>x.exitCode===0));
const portability=read('docs/public-release-requirements.json');assert.equal(portability.requirements.length,12);assert.equal(portability.auditPhase,9);
const reports={};
for(const key of ['core','legacy','databases','messaging','monitoring','everything','faults-core','faults-legacy']){
 const p=root+'phase2-'+key+'.json';reports[key]=read(p);assert.equal(reports[key].status,'passed',p);
}
const snapshot=read(root+'phase2-runtime-snapshot.json');assert.equal(snapshot.status,'passed');assert.equal(snapshot.containers.length,23);
const browser=read(root+'playwright.json');assert.equal(browser.stats.unexpected,0);assert.equal(browser.stats.expected,4);
const physical=read(root+'physical-paths.json');for(const [name,x] of Object.entries(physical.paths))if(!['wslMaintenanceCache','wslConfig','dockerInstallSettings'].includes(name))assert.ok(x.physical.startsWith('\\\\?\\F:\\OCVdeps\\'),name);
const currentIds=composeCall(['ps','-q']).stdout.trim().split(/\s+/).filter(Boolean);
const current=JSON.parse(dockerCall(['inspect',...currentIds]).stdout);
assert.deepEqual(current.map(c=>c.Config.Labels['com.docker.compose.service']).sort(),['edge','gateway','portal','postgres','redis']);
assert.ok(current.every(c=>c.State.Health.Status==='healthy'&&!c.State.OOMKilled));
const builder=JSON.parse(dockerCall(['inspect','buildx_buildkit_ocv-budget-builder0']).stdout)[0];assert.equal(builder.State.Running,false);assert.ok(builder.HostConfig.Memory<=3072*1048576&&builder.HostConfig.Memory>0);
const proof=(group,fragment)=>{const actual=reports[group].checks.find(x=>x.includes(fragment));assert.ok(actual,'Missing actual runtime evidence: '+group+' '+fragment);return root+'phase2-'+group+'.json :: '+actual;};
const gateway='services/gateway/src/备份_别删/a_final.ts';
const archive='services/archive/src/api/main.mjs';
const java='services/spring/src/main/java/ocv/tmp/backup/Municipal.java';
const python='services/fastapi/main.py',php='services/laravel/routes.php',main='services/gateway/src/main.ts';
const mappings=new Map();
const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
function assign(numbers,implementation,proofs,notes){for(const n of numbers){const id='A'+String(n).padStart(3,'0');assert.ok(!mappings.has(id),'Duplicate mapping '+id);for(const f of implementation)assert.ok(fs.existsSync(f),f);mappings.set(id,{implementation,verification:proofs.map(([g,p])=>proof(g,p)),notes});}}
assign([42],[gateway,java,python],[['everything','Hibernate Validator'],['everything','Zod refuses'],['everything','no field NOT NULL']],'后端 Zod → Hibernate Validator → 无字段约束 SQLite 已实际验证；Yup 浏览器部分明确保留到阶段 3，本条仍 partial。');
assign([43],[gateway,java,python,php],[['everything','Original unvalidated ornament']],'ornament 不做语义校验；仍受大小/身份字段保护。实际附加字段到达 Mongo。');
assign([48],[gateway,archive],[['everything','Six HTTP hops']],'两套 Node 之间实际 got 转发，request 上限与零无限重试。');
assign(range(51,55),[gateway,java,python,php],[['everything','adapt to one instant'],['everything','different timestamp formats'],['everything','Unix milliseconds in MySQL']],'逐跳实际 ISO / Unix 秒 / Unix 毫秒 / 上海斜线字符串，适配器从各实际字段计算同一时间；后续前端消费该结果。');
assign(range(56,63),[gateway,'services/gateway/prisma/schema.prisma'],[['everything','Prisma identity'],['everything','Exact PostgreSQL join'],['everything','another ID']],'实际 crypto UUID、uuid 包、两个不同 Nano ID、自增整数；PG 映射与 Redis 不同 key ID 逐字段核对。');
assign([64],[main,'infra/nginx/edge.conf'],[['everything','Core Nest ping'],['everything','Six HTTP hops']],'统一公开 /api 网关实际承接所有语言入口；保留阶段 1 原始保存路径。');
assign(range(66,70),[main,gateway,archive,java,python,php],[['everything','Six HTTP hops'],['everything','Direct Nest to Spring'],['faults-legacy','spring absent'],['faults-legacy','fastapi absent'],['faults-legacy','laravel absent']],'真实六跳；PHP 只回 Nest 独立终止路由。三处中断均有限失败、主页可用、恢复后真实链可继续。');
assign([71,92],[archive,main],[['everything','PHP-named public route']],'公开 /api/foo.php 确实通过 Nest 转到 Hono，与 PHP 无关。');
assign([72],['services/fiber/main.go'],[['everything','Active go']],'真正 Go Fiber 的微型空气税接口。');
assign([73],['services/dotnet/Program.cs'],[['everything','ASP.NET returns']],'真实 ASP.NET Minimal API，只输出荒谬空气税 XML。');
assign([74,97],['services/sinatra/main.rb'],[['everything','Active ruby'],['everything','JSON inside JSON']],'真实 Sinatra 旧接口，JSON 中另塞一个 JSON 字符串。');
assign([75,76],[gateway,java],[['everything','Direct Nest to Spring'],['everything','Six HTTP hops']],'真实 REST 为主要转发协议。');
assign([77],[java,python,'infra/protocols/rice.proto'],[['everything','real gRPC']],'Java/Python 从同一 .proto 生成 wire 协议实现；Python gRPC 真写 SQLite 后返回秒数。DTO 仍独立定义。');
assign([78],[archive],[['everything','Active graphql']],'graphql 库实际执行固定石头查询。');
assign([79,80,96],['services/dotnet/Program.cs',main],[['everything','ASP.NET returns']],'SOAP 外形 XML 是真正 HTTP 响应，空气税 0。');
assign([81],[main,'infra/nginx/edge.conf'],[['everything','real WebSocket']],'Nginx 真实 Upgrade；公告后客户端关闭，服务有帧/连接/寿命上限。');
assign([82,148],[main],[['everything','SSE sends three']],'真实 SSE 三句状态后结束，不遗留无限订阅。');
assign([83,84,86,89,90,107,149,328,332,333,334],[gateway,archive,'compose.yaml'],[['everything','RabbitMQ confirm'],['everything','Rabbit body to Kafka payload'],['everything','temporary state really in Redis']],'实际 Rabbit body → 单一 Kafka topic/payload → 第二个 Nest context/Mongoose Mongo；内部 ID 一致，显示 ID 不同，Redis 临时状态真读到。Redis Pub/Sub 另用 data。');
assign([85,87,88],[java,archive],[['everything','Spring Redis Pub/Sub reaches']],'真实 Spring 发布 data/_internalId，独立 Nest 消费者接收并保存 Mongo warehouse_logs，精确对象 ID 查询。');
assign([91,93],[main,archive,php],[['everything','PHP-named public route'],['everything','Six HTTP hops']],'实际 .php/.cgi/.do/.asmx 后缀混用；PHP 真入口是 /api/nodeService。');
assign([94,98],[gateway,main],[['everything','Prisma identity']],'实际成功响应为 JSON，observations.initialRecord 中有成功的 errorMessage 与可靠 canContinue。');
assign([95],[archive,main],[['everything','real HTML fragment']],'Hono 实际返回 HTML 碎片，由网关保留 HTML Content-Type。');
assign([99,100],[gateway,archive,python,php],[['core','explicit finite fallback'],['faults-legacy','no recursive success']],'缺可选窗口时 successReason 解释失败；逻辑判断始终以 canContinue 为准。');
assign([101,102],[gateway,archive,java,python,php],[['everything','Six HTTP hops'],['core','explicit finite fallback']],'实际 hop 的 true / 1 / Y / yes / 正常进入同一布尔适配器；否定值不误判为成功。');
assign([103],[gateway,archive,java,python,php],[['everything','Six HTTP hops'],['everything','Hibernate Validator']],'DTO 在五个源入口重复定义并各自实际处理数据，不共享同一个应用模型。');
assign([104],[archive,'pcakage/comon/index.mjs'],[['everything','Active graphql'],['everything','PHP-named public route']],'仅 Hono 模式实际动态引用 shared-types 的无意义石头；其他 DTO 全重复。');
assign([105,323,324],[gateway,'services/gateway/prisma/schema.prisma'],[['everything','Exact PostgreSQL join'],['everything','migrations applied']],'同一 PG 里的 Prisma / TypeORM 真实读写，业务表分别在 ocv_prisma / ocv_typeorm。');
assign([106,327],[php,'services/laravel/SchoolStudent.php'],[['everything','Unix milliseconds in MySQL'],['everything','MySQL LIKE']],'精确直接查真实 MySQL 表，不能用 Laravel 默认 SQLite 冒充。Eloquent 模型映射旧表名。');
assign([108],[gateway],[['everything','another ID'],['everything','sole-source counter']],'Redis 同时真缓存映射/副本，并独占无关土豆计数，不从 PG 假装读取。');
assign([109,116,326],[python],[['everything','Three actual SQLAlchemy SQLite files']],'三个真文件 postgres.sqlite/mysql.sqlite/redis.sqlite，逐文件 SQL 查询实际不同日期值。');
assign([110,113,114,115],[python,'services/fastapi/data/official.csv','services/fastapi/data/official.json','services/fastapi/data/official.yaml'],[['everything','DuckDB consumes formal']],'CSV 3 条真实进 DuckDB 表 SUM=6；JSON 提供展示名，YAML 决定最低饭量及科室。实际响应验证派生字段。');
assign([111],[main,archive,php],[['everything','Real Elasticsearch full text'],['everything','MySQL LIKE']],'实际 ES 全文检索，另一条查询绑定参数执行 MySQL LIKE。');
assign([112],[archive,'services/minio/Dockerfile'],[['databases','MinIO tiny object'],['everything','MinIO tiny object']],'官方固定版本源码编译真实 MinIO；小 UTF-8 文本实际 put/get，字节结果一致，保留 192 MiB 限制。');
assign(range(117,120),[gateway,java,php,python,'infra/postgres/001-core.sql'],[['everything','Exact PostgreSQL join'],['everything','Hibernate JPA really stores'],['everything','MySQL LIKE']],'mall_goods / school_student / warehouse_stock 等旧项目名真存在；product_name 是玩具文明/收据名，supplier_id=43 是分类，delivery_count=1 是一次盖章。');
assign(range(121,123),['services/gateway/prisma/migrations/202610020001_pebble/migration.sql',main,gateway],[['everything','account tables remain empty'],['everything','Account absent'],['everything','Zod refuses']],'完整空账户表仅设计遗迹；网站账号路由不挂载，密钥/身份形状字段拒绝，不收真实账户。');
assign(range(124,130),[gateway,archive,python,php],[['everything','Five storage fragments really reassemble'],['everything','Same PostgreSQL UUID'],['everything','Original unvalidated ornament']],'observations.splitObject 实际重组 UUID / MySQL 名称 / Mongo 附加字段 / Redis 临时状态 / SQLite 时间；统一对象 ID，没有虚构可用性。');
assign([150,151,152],[gateway],[['everything','Prisma identity']],'真实 create 路径调用 RedisClusterManager.put 的 JS Map 与超长类名的 Service→Manager→Provider→Adapter 单行传递；Map 有 16 条上限。');
assign([279],[gateway,'infra/monitoring/prometheus.yaml'],[['monitoring','Prometheus scrapes']],'Prometheus 真抓石头重量 1 与无聊盖章计数。');
assign([280],['infra/monitoring/dashboards/rice.json','infra/monitoring/provisioning/dashboards/wall.yaml'],[['monitoring','Grafana provisions 48']],'实际 Grafana API 验证 48 个面板，重复展示两个微小指标，匿名只读。');
assign([281],[gateway,'infra/monitoring/otel.yaml'],[['monitoring','Collector receives real OpenTelemetry']],'实际请求创建 1 父 + 14 子 span，OTLP 到真实 Collector，日志中看到最后窗口与 Trace ID。');
assign([282,283],[gateway,archive,java,python,php],[['everything','Every hop preserves root trace']],'每跳真实显示 UUID 不同，六跳同一个内部 rootTraceId；OTel 另有 trace ID 并保留内部 UUID attribute。');
assign([284,285,286,287],[gateway,archive,java,python,php],[['everything','log is mirrored verbatim'],['everything','stdout and actual bounded file'],['everything','Real Elasticsearch full text']],'同一 JSON 行精确存在 stdout/有界文件/Mongo/ES；另有纯文本和不同日期格式，error 内容为成功。');
assign([325],[java,'services/spring/src/main/resources/schema.sql'],[['everything','Hibernate JPA really stores']],'真实 JPA/Hibernate 只拥有 ocv_jpa 表，精确读到饭与操作次数。');
assign([329],[gateway,archive,'services/gateway/src/runtime-store.ts'],[['everything','Four actual copies'],['everything','Reconciliation repairs']],'手写 SQL 真写 PG outbox/旧核心表，后台用 SQL canonical data 对账。');
assign([330,331],[gateway,'services/gateway/prisma/migrations',java],[['everything','migrations applied'],['everything','Hibernate JPA really stores']],'真实 Prisma 两次 migration、TypeORM 独立 migration 与 JPA 表同库并存；业务表范围不踩。Prisma 自己的元数据在 public._prisma_migrations，TypeORM 在 ocv_typeorm.warehouse_migrations。');
assign([335,336],[archive,gateway],[['everything','Four actual copies']],'observations.fourCopies 精确核对同 UUID 的 PG/Mongo/Redis/ES 四份值一致。');
assign([337,338,339],[archive],[['everything','Reconciliation repairs deliberately corrupted Mongo'],['everything','Reconciliation repairs deliberately corrupted Redis'],['everything','Reconciliation repairs deliberately corrupted Elasticsearch'],['everything','Scheduled job repairs Mongo']],'无分布式事务。超长名字的任务每 15 秒运行，16 条分页/256 条上界，仅比较少量字段；手动破坏三副本后实际修复，再破坏 Mongo 不手动触发也恢复。原始 ornament 与日志保留。');
const ledger=read('docs/requirements.json');const targets=ledger.requirements.filter(x=>x.phase===2);assert.equal(targets.length,113);assert.equal(mappings.size,113);
assert.ok(reports.everything.observations.initialRecord.errorMessage);assert.ok(reports.core.observations.optionalFallback.successReason);
for(const item of targets){assert.ok(mappings.has(item.id),item.id);Object.assign(item,mappings.get(item.id),{status:item.id==='A042'?'partial':'verified'});}
// Keep broader constraints partial: the remaining frontend and tool phases are
// not licensed by this backend acceptance.
for(const id of ['A342','A364','A366','A374','A375','A376']){const item=ledger.requirements.find(x=>x.id===id);item.status='partial';item.implementation=[...new Set([...item.implementation,'compose.yaml',gateway,archive])];item.verification=[...new Set([...item.verification,root+'phase2-everything.json',root+'phase2-faults-core.json'])];item.notes+=' 阶段 2 实际分批运行、限量数据与故障恢复通过；未来模块继续验收。';}
const tech=read('docs/technologies.json');
const languageFiles={'Hono':archive,'Spring Boot':java,'FastAPI':python,'Laravel':php,'Fiber':'services/fiber/main.go','ASP.NET Core Minimal API':'services/dotnet/Program.cs','Sinatra':'services/sinatra/main.rb'};
const languageProofs={'Hono':'Active hono','Spring Boot':'Direct Nest to Spring','FastAPI':'real gRPC','Laravel':'Unix milliseconds in MySQL','Fiber':'Active go','ASP.NET Core Minimal API':'ASP.NET returns','Sinatra':'Active ruby'};
const bindings={REST:[gateway,'Direct Nest to Spring'],GraphQL:[archive,'Active graphql'],gRPC:[java,'real gRPC'],'XML/SOAP 风格接口':['services/dotnet/Program.cs','ASP.NET returns'],WebSocket:[main,'real WebSocket'],SSE:[main,'SSE sends three'],RabbitMQ:[gateway,'RabbitMQ confirm'],Kafka:[archive,'Rabbit body to Kafka payload'],'Redis Pub/Sub':[java,'Spring Redis Pub/Sub'],'PostgreSQL':[gateway,'Exact PostgreSQL join'],MySQL:[php,'Unix milliseconds in MySQL'],SQLite:[python,'Three actual SQLAlchemy'],DuckDB:[python,'DuckDB consumes'],MongoDB:[archive,'Rabbit body to Kafka payload'],Redis:[gateway,'sole-source counter'],Elasticsearch:[archive,'Real Elasticsearch full text'],MinIO:['services/minio/Dockerfile','MinIO tiny object'],JSON:[python,'DuckDB consumes'],CSV:[python,'DuckDB consumes'],YAML:[python,'DuckDB consumes'],Prisma:[gateway,'Exact PostgreSQL join'],TypeORM:[gateway,'Exact PostgreSQL join'],'Hibernate/JPA':[java,'Hibernate JPA really stores'],SQLAlchemy:[python,'Three actual SQLAlchemy'],Eloquent:[php,'Unix milliseconds in MySQL'],Mongoose:[archive,'Rabbit body to Kafka payload'],'裸 SQL':[archive,'Four actual copies'],OpenTelemetry:[gateway,'Collector receives real OpenTelemetry'],Prometheus:['infra/monitoring/prometheus.yaml','Prometheus scrapes'],Grafana:['infra/monitoring/provisioning/dashboards/wall.yaml','Grafana provisions 48']};
const nodeVersions={};for(const dir of ['gateway','archive']){const manifest=read('services/'+dir+'/package.json');for(const name of Object.keys(manifest.dependencies||{})){try{nodeVersions[name]=read('services/'+dir+'/node_modules/'+name+'/package.json').version;}catch{}}}
const versions={'Hono':nodeVersions.hono,'Spring Boot':'3.5.8','FastAPI':'0.115.12','Fiber':'2.52.6','Sinatra':'4.1.1','DuckDB':'1.3.2','SQLAlchemy':'2.0.40','MinIO':'RELEASE.2025-10-15T17-29-55Z (official source commit 9e49d5e7a648)','OpenTelemetry':nodeVersions['@opentelemetry/sdk-trace-base'],'Prisma':nodeVersions['@prisma/client'],'TypeORM':nodeVersions.typeorm,'Mongoose':nodeVersions.mongoose,'Elasticsearch':'8.19.0','Kafka':'3.9.1','RabbitMQ':snapshot.versions.rabbitmq,'Laravel':snapshot.versions.laravel,'PostgreSQL':snapshot.versions.postgres.match(/PostgreSQL [\d.]+/)?.[0],'MySQL':snapshot.versions.mysql,'MongoDB':snapshot.versions.mongo.match(/db version v[\d.]+/)?.[0],'Redis':snapshot.versions.redis.match(/v=[\d.]+/)?.[0],'ASP.NET Core Minimal API':snapshot.versions.dotnet.match(/Microsoft.AspNetCore.App\s+([\d.]+)/)?.[1],'Prometheus':'3.3.0','Grafana':'12.0.0'};
for(const item of tech.technologies.filter(x=>x.phase===2)){
 const mapping=bindings[item.name]||[languageFiles[item.name],languageProofs[item.name]];assert.ok(mapping[0],item.name);item.status='verified-current-role';item.implementation=[mapping[0],'compose.yaml'];item.verification=[proof('everything',mapping[1]),root+'phase2-runtime-snapshot.json'];item.version=versions[item.name]??null;
 if(item.name==='FastAPI')item.verification.push('Current gRPC/SQLAlchemy/DuckDB role verified; scientific UI remains phase 6.');
}
for(const item of tech.technologies.filter(x=>x.phase===3&&['Zod','got','Nano ID','uuid','原生 Date'].includes(x.name))){item.status='partial';item.implementation=[gateway];item.verification=[proof('everything',item.name==='Zod'?'Zod refuses':item.name==='got'?'Six HTTP hops':item.name==='原生 Date'?'adapt to one instant':'Prisma identity'),'Backend role verified; frontend role awaits phase 3.'];item.version=nodeVersions[{'Nano ID':'nanoid','原生 Date':'','uuid':'uuid',got:'got',Zod:'zod'}[item.name]]??null;}
const memory=read(root+'phase2-memory.json');
const acceptance={phase:2,status:'complete',nextPhaseAuthorized:false,updatedAt:new Date().toISOString(),scope:'Backend acceptance only. Stop here; frontend phase 3 is not authorized.',counts:{phaseRequirements:113,verifiedRequirements:112,crossPhasePartial:1,phaseTechnologies:37,allNumberedPreserved:732},deferred:[{id:'A042',phase:3,remaining:'Yup in browser; backend Zod/Java/SQLite portions verified'}],batchChecks:Object.fromEntries(Object.entries(reports).map(([k,v])=>[k,v.checks.length])),reports:Object.fromEntries(Object.keys(reports).map(k=>[k,root+'phase2-'+k+'.json'])),runtimeSnapshot:root+'phase2-runtime-snapshot.json',physicalPaths:root+'physical-paths.json',browserTests:4,unitTests:5,finalServices:current.map(c=>c.Config.Labels['com.docker.compose.service']).sort(),builderStopped:true,memoryLimitsMiB:{core:1216,maximum:7328,builder:3072,wslDailyCeiling:9216},memorySamples:memory,note:'Working sets include file cache/shared pages; a development observation, not a long-term capacity guarantee. All 23 real services were healthy together. Default restored to five core services.',remainingAuthorizedWork:[]};
acceptance.buildUnitReport=root+'phase2-build-unit.json';
acceptance.publicRelease={status:'pending',auditPhase:9,requirements:'docs/public-release-requirements.json',knownBlockers:'docs/PUBLIC-RELEASE.md',standardEntrypointsVerified:false,cleanCloneVerified:false};
save('docs/requirements.json',ledger);save('docs/technologies.json',tech);
save('docs/phase-2-acceptance.json',acceptance);save('docs/phase-state.json',acceptance);
console.log('Phase 2 accepted: 112 verified + A042 cross-phase partial; 37 real technologies; STOP before phase 3.');
