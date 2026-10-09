import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {composeCall,dockerCall} from './docker-child.mjs';
import {verificationConfig} from './verification-config.mjs';
const config=verificationConfig(),catalogBytes=await readFile(path.join(config.projectRoot,'config/9/registry.json'));
const digest=createHash('sha256').update(catalogBytes).digest('hex'),report={schema:'ocv.phase13.index/1',passed:false,checks:[]};
const source="const a=JSON.parse(process.argv[1]);fetch('http://site-index:8093/api/foo.aspx',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(a),signal:AbortSignal.timeout(8000)}).then(async r=>console.log(JSON.stringify({status:r.status,data:await r.json()}))).catch(e=>{console.error(e.message);process.exitCode=1});";
function post(body){return JSON.parse(composeCall(['exec','-T','gateway','node','-e',source,JSON.stringify(body)],{timeout:12000}).stdout);}
function fileHashes(){const id=composeCall(['ps','-q','site-index']).stdout.trim();assert.ok(id,'Start only site-index in the existing bounded deployment before this batch');return dockerCall(['exec',id,'sha256sum','/data/stock.sqlite','/data/stock.sqlite-wal'],{timeout:10000}).stdout;}
try{
 const before=fileHashes(),body={schema:'ocv.site-index/1',query:'琴',from:'/',to:'/functions/music-studio/',limit:12};
 const first=post(body);assert.equal(first.status,200);assert.ok(first.data.hits.some(hit=>hit.id==='music-studio'));assert.equal(first.data.path.found,true);assert.equal(first.data.path.edgesVerified,true);assert.equal(first.data.readback.catalogDigest,digest);
 report.checks.push({name:'actual alias rank and SQLite navigation path',passed:true,records:first.data.readback.records,pathEdges:first.data.path.nodes.length-1});
 const second=post(body);assert.equal(second.status,200);assert.equal(second.data.cache,'memory+SQLite-revision');assert.deepEqual(second.data.hits,first.data.hits);assert.equal(second.data.readback.storage,'SQLite/FTS5');
 report.checks.push({name:'real cache hit still reads SQLite catalogue revision',passed:true});
 for(const invalid of [{...body,limit:1.5},{...body,query:[]},{...body,email:'synthetic@example.invalid'},{...body,query:'x'.repeat(5000)}])assert.equal(post(invalid).status,400);
 report.checks.push({name:'fractional limits, malformed query, personal keys and oversized bodies rejected',passed:true,cases:4});
 const unique=post({...body,query:'not_a_catalogue_term_'+randomUUID(),to:undefined});assert.equal(unique.status,200);assert.deepEqual(unique.data.hits,[]);assert.equal(unique.data.queryPersisted,false);
 const after=fileHashes();assert.equal(after,before);
 report.checks.push({name:'SQLite database and WAL bytes unchanged by ranked and unmatched queries',passed:true,fileHashes:after.trim().split('\n')});report.passed=true;
}catch(error){report.failure=error.message.slice(0,300);process.exitCode=1;}
finally{await mkdir(config.reportRoot,{recursive:true});await writeFile(path.join(config.reportRoot,'phase13-index-runtime.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
