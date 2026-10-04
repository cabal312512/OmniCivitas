import fs from 'node:fs';
import assert from 'node:assert/strict';
import {composeCall,dockerCall} from './docker-child.mjs';
const ids=composeCall(['ps','-q']).stdout.trim().split(/\s+/).filter(Boolean);
const containers=JSON.parse(dockerCall(['inspect',...ids]).stdout);
assert.equal(containers.length,23,'Snapshot all real phase-2 services together');
const versions={};
for(const [name,command] of [
 ['postgres',['psql','-U','ocv_demo','-d','civilization','-Atc','SELECT version()']],
 ['redis',['redis-server','--version']],['mysql',['mysql','--version']],['mongo',['mongod','--version']],
 ['spring',['java','-version']],['laravel',['php','artisan','--version']],['sinatra',['ruby','-v']],['dotnet',['dotnet','--info']],
 ['minio',['/minio','--version']],['rabbitmq',['rabbitmqctl','version']],
 ['fastapi',['python','-c',"import sys,fastapi,grpc,sqlalchemy,duckdb;print(sys.version,fastapi.__version__,grpc.__version__,sqlalchemy.__version__,duckdb.__version__)"]],
 ['kafka',['env','KAFKA_HEAP_OPTS=-Xms32m -Xmx64m','/opt/kafka/bin/kafka-topics.sh','--version']],['gateway',['node','--version']],['otel',['/otelcol-contrib','--version']],['prometheus',['/bin/prometheus','--version']],
 ['grafana',['grafana','-v']]
]){const r=composeCall(['exec','-T',name,...command]);versions[name]=(r.stdout+'\n'+r.stderr).trim();}
versions.elasticsearch=composeCall(['exec','-T','gateway','node','-e',"fetch('http://elasticsearch:9200').then(r=>r.json()).then(x=>console.log(JSON.stringify(x.version)))"]).stdout.trim();
const documents=containers.map(c=>{assert.equal(c.State.OOMKilled,false,c.Name+' OOM');assert.equal(c.State.Health.Status,'healthy');return {service:c.Config.Labels['com.docker.compose.service'],imageId:c.Image,health:c.State.Health.Status,oomKilled:c.State.OOMKilled,restarts:c.RestartCount,memoryBytes:c.HostConfig.Memory,ports:c.HostConfig.PortBindings};});
const result={status:'passed',observedAt:new Date().toISOString(),versions,containers:documents,stats:dockerCall(['stats','--no-stream','--format','{{.Name}}: {{.MemUsage}} CPU={{.CPUPerc}} PIDS={{.PIDs}}']).stdout,note:'Actual local development observation, not a production/long-term capacity guarantee. All disks previously checked by Confirm-DockerStorage.'};
fs.writeFileSync(process.env.OCV_DEPS_ROOT+'/runtime/reports/phase2-runtime-snapshot.json',JSON.stringify(result,null,2));
console.log('PASS: 23 real healthy services, no OOM, runtime versions and actual stats recorded.');
