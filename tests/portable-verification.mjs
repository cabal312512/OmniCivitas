import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,writeFile,mkdir,realpath,symlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {verificationConfig} from '../scripts/verification-config.mjs';

const fixture=await mkdtemp(path.join(os.tmpdir(),'ocv-portable-verification-'));
const dockerHelper=new URL('../scripts/docker-child.mjs',import.meta.url).href;

test('A fresh checkout needs no owner-specific environment or disk',()=>{
  const config=verificationConfig({},fixture);
  assert.equal(config.depsRoot,path.join(fixture,'.ocv-runtime'));
  assert.equal(config.reportRoot,path.join(config.depsRoot,'runtime','reports'));
  assert.equal(config.runnerRoot,path.join(config.depsRoot,'runtime','after-runner'));
  assert.equal(config.baseUrl,'http://127.0.0.1:8080');
});

test('Published verification follows custom web and monitoring ports',()=>{
  const config=verificationConfig({OCV_WEB_PORT:'18043',OCV_GRAFANA_PORT:'13043'},fixture);
  assert.equal(config.baseUrl,'http://127.0.0.1:18043');
  assert.equal(config.grafanaUrl,'http://127.0.0.1:13043');
  assert.equal(verificationConfig({OCV_BASE_URL:'https://example.invalid',OCV_GRAFANA_BASE_URL:'https://example.invalid/metrics'},fixture).grafanaUrl,'https://example.invalid/metrics');
  assert.throws(()=>verificationConfig({OCV_WEB_PORT:'70000'},fixture),/Invalid OCV_WEB_PORT/);
});

test('Ignored preferences and environment overrides use the same report and runner directories',async()=>{
  await mkdir(path.join(fixture,'config'));
  await writeFile(path.join(fixture,'config','runtime.local.json'),JSON.stringify({depsRoot:'chosen-cache',ports:{web:18081,grafana:13081}}));
  const preference=verificationConfig({},fixture);
  assert.equal(preference.depsRoot,path.join(fixture,'chosen-cache'));
  assert.equal(preference.baseUrl,'http://127.0.0.1:18081');
  assert.equal(preference.grafanaUrl,'http://127.0.0.1:13081');
  const override=verificationConfig({OCV_DEPS_ROOT:path.join(fixture,'override-cache'),OCV_WEB_PORT:'19081',OCV_GRAFANA_PORT:'14081'},fixture);
  assert.equal(override.runnerRoot,path.join(fixture,'override-cache','runtime','after-runner'));
  assert.equal(override.baseUrl,'http://127.0.0.1:19081');
  assert.equal(override.grafanaUrl,'http://127.0.0.1:14081');
  assert.equal(verificationConfig({OCV_BASE_URL:'https://example.invalid',OCV_GRAFANA_BASE_URL:'https://example.invalid/metrics'},fixture).baseUrl,'https://example.invalid');
});

test('Docker process helper carries bounded stdin and configured Compose files without starting a daemon',async()=>{
  const configFile=path.join(fixture,'fake-runtime.json');
  await writeFile(configFile,'{}');
  const physicalDirectory=path.join(fixture,'physical-cwd'),directoryAlias=path.join(fixture,'cwd-alias');
  await mkdir(physicalDirectory);
  await symlink(physicalDirectory,directoryAlias,process.platform==='win32'?'junction':'dir');
  const code=`import {dockerCall,composeArguments} from ${JSON.stringify(dockerHelper)};
  const inner="let input='';process.stdin.on('data',data=>input+=data);process.stdin.on('end',()=>console.log(JSON.stringify({input,cwd:process.cwd()})))";
  const result=dockerCall(['-e',inner],{input:'portable bounded input',timeout:5000,maxBuffer:1024,cwd:${JSON.stringify(directoryAlias)}});
  console.log(JSON.stringify({result:JSON.parse(result.stdout),args:composeArguments(['ps'])}));`;
  const environment={...process.env,OCV_LOCAL_STORAGE_GUARD:'0',OCV_RUNTIME_CONFIG:configFile,OCV_DOCKER_CLI:process.execPath,OCV_COMPOSE_FILES:['compose.yaml','compose.custom.yaml'].join(path.delimiter),COMPOSE_PROJECT_NAME:'portable-fixture'};
  const child=spawnSync(process.execPath,['--max-old-space-size=128','--input-type=module','-e',code],{env:environment,encoding:'utf8',timeout:10000,maxBuffer:8192,windowsHide:true});
  assert.equal(child.status,0,child.stderr);
  const output=JSON.parse(child.stdout);
  assert.equal(output.result.input,'portable bounded input');
  assert.equal(await realpath(output.result.cwd),await realpath(directoryAlias));
  assert.equal(await realpath(output.result.cwd),await realpath(physicalDirectory));
  assert.deepEqual(output.args,['compose','-p','portable-fixture','-f','compose.yaml','-f','compose.custom.yaml','--profile','*','ps']);
});
