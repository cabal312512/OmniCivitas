import {readFile,writeFile,mkdir,copyFile,readdir,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const repository=resolve(dirname(fileURLToPath(import.meta.url)),'..'),target=join(repository,'config/apps/portal/public/workshop'),args=process.argv.slice(2),at=args.indexOf('--from');
const digest=b=>createHash('sha256').update(b).digest('hex');
const sourceRoots=['config/apps/aa1','config/parts','pcakage/slot7','pinia/folder2','config/apps/portal/src/workshop'];
const excluded=new Set(['bin','obj','target']);
async function files(dir){let result=[];for(const e of await readdir(dir,{withFileTypes:true})){if(excluded.has(e.name))continue;const p=join(dir,e.name);if(e.isDirectory())result.push(...await files(p));else if(e.isFile())result.push(p)}return result.sort()}
const sourceFiles=(await Promise.all(sourceRoots.map(r=>files(join(repository,r))))).flat().concat([join(repository,'scripts/workshop-artifacts.mjs'),join(repository,'scripts/build-workshop-engines.mjs'),join(repository,'scripts/collect-workshop-licenses.mjs')]);
if(args.includes('--source-digest')){const rows=await Promise.all(sourceFiles.map(async p=>[relative(repository,p).replaceAll('\\','/'),digest(await readFile(p))]));console.log(digest(JSON.stringify(rows)));process.exit(0)}
const licenseRoot=join(repository,'docs/licenses/workshop-runtime');
if(args.includes('--check')){
 const m=JSON.parse(await readFile(join(target,'manifest.json'),'utf8'));
 for(const row of m.artifacts){const b=await readFile(join(target,row.file));if(b.length!==row.bytes||digest(b)!==row.sha256)throw Error(`Workshop artifact mismatch: ${row.file}`)}
 for(const row of [...m.sources,...m.runtimeLicenses])if(digest(await readFile(join(repository,row.file)))!==row.sha256)throw Error(`Workshop artifact source changed: ${row.file}; run pnpm workshop:engines.`);
 const declared=new Set(m.sources.map(r=>r.file));for(const p of sourceFiles)if(!declared.has(relative(repository,p).replaceAll('\\','/')))throw Error(`Workshop source absent from manifest: ${p}`);
 console.log(`Workshop artifacts verified: ${m.artifacts.length} distributed files / ${m.sources.length} source files.`);
}else{
 if(at<0||!args[at+1])throw Error('Provide --from with the external build output containing ui/ and engines/mechanics.wasm.');
 const input=resolve(args[at+1]);const wasm=await readFile(join(input,'engines/mechanics.wasm'));if(!wasm.subarray(0,4).equals(Buffer.from([0,97,115,109])))throw Error('Invalid workshop WebAssembly.');
 await mkdir(join(target,'engines'),{recursive:true});await cp(join(input,'ui'),join(target,'ui'),{recursive:true});await copyFile(join(input,'engines/mechanics.wasm'),join(target,'engines/mechanics.wasm'));
 for(const name of ['bridge.mjs','engine-worker.mjs'])await copyFile(join(repository,'config/apps/portal/src/workshop',name),join(target,name));
 await cp(join(repository,'config/parts/examples'),join(target,'examples'),{recursive:true});
 const require=createRequire(join(repository,'package.json')),webpack=require('webpack'),portalRequire=createRequire(join(repository,'config/apps/portal/package.json'));
 await new Promise((accept,reject)=>{const compiler=webpack({mode:'production',target:'web',entry:join(repository,'config/apps/portal/src/workshop/scene.mjs'),experiments:{outputModule:true},output:{path:target,filename:'scene.mjs',library:{type:'module'}},resolve:{alias:{three:portalRequire.resolve('three')}},optimization:{minimize:true}});compiler.run((error,stats)=>{compiler.close(()=>{});if(error||stats?.hasErrors())reject(error||Error(stats.toString({all:false,errors:true})));else accept()})});
 const noticeFiles=await files(licenseRoot),notice=['OmniCivitas workshop / redistributed runtime notices','Original workshop domain, editor, controllers, exports and simulation adapters: MIT, cabal312512.','Rapier and its dependencies, the .NET browser runtime and Three.js retain their upstream licenses. 3D appearance is separate from two-dimensional simulation.'];
 for(const p of noticeFiles)notice.push(`\n===== ${relative(licenseRoot,p)} =====\n`,await readFile(p,'utf8'));
 await writeFile(join(target,'engines/NOTICE.txt'),notice.join('\n'));
 const artifacts=await Promise.all((await files(target)).filter(p=>!p.endsWith('manifest.json')).map(async p=>{const b=await readFile(p);return{file:relative(target,p).replaceAll('\\','/'),bytes:b.length,sha256:digest(b)}}));
 const sources=await Promise.all(sourceFiles.map(async p=>({file:relative(repository,p).replaceAll('\\','/'),sha256:digest(await readFile(p))})));
 const runtimeLicenses=await Promise.all(noticeFiles.map(async p=>({file:relative(repository,p).replaceAll('\\','/'),sha256:digest(await readFile(p))})));
 await writeFile(join(target,'manifest.json'),JSON.stringify({schema:'ocv.workshop.artifacts/1',generatedAt:new Date().toISOString(),runtime:{mechanics:'ocv-mechanics-1.1.1+rapier-0.22.0.rod-radial-1.control-dag-1.initial-speed-1',domain:'ME2/1.1.0',blazor:'8.0.31',rust:'1.90.0',rapier:'0.22.0',model:'2D SI; ideal gear/belt constraints'},artifacts,sources,runtimeLicenses},null,2)+'\n');
 console.log(`Published ${artifacts.length} verified workshop files with linked runtime notices.`);
}
