import { readFile,writeFile,mkdir,copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve,join,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const target=join(repository,'config/apps/portal/public/signals/engines');
const args=process.argv.slice(2),copyAt=args.indexOf('--from');
const names=['solver.mjs','solver.wasm','communications.wasm'];
const sources=['pinia/receipt2/common.hh','pinia/receipt2/old.cc','pinia/receipt2/1.cpp','pinia/receipt2/aux1.rs','pinia/receipt2/Dockerfile','pcakage/desk4/Cargo.toml','pcakage/desk4/cache.rs','pcakage/desk4/old.rs','pcakage/desk4/1.rs','pcakage/desk4/wave2.rs','pcakage/desk4/layout.rs','pcakage/desk4/src/main.rs','scripts/build-signals-engines.mjs','scripts/signals-artifacts.mjs'];
const licenses=['emscripten-LICENSE.txt','musl-COPYRIGHT.txt','libcxx-LICENSE.txt','libcxxabi-LICENSE.txt','compiler-rt-LICENSE.txt','rust-LICENSE-MIT.txt','rust-LICENSE-APACHE.txt','rust-COPYRIGHT.txt'];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
if(args.includes('--check')){
  const manifest=JSON.parse(await readFile(join(target,'manifest.json'),'utf8'));
  for(const row of manifest.artifacts){const bytes=await readFile(join(target,row.file));if(bytes.length!==row.bytes||digest(bytes)!==row.sha256)throw new Error(`Artifact mismatch: ${row.file}`);}
  for(const row of manifest.sources){if(digest(await readFile(join(repository,row.file)))!==row.sha256)throw new Error(`Stale engine source: ${row.file}`);}
  for(const row of manifest.runtimeLicenses){if(digest(await readFile(join(repository,row.file)))!==row.sha256)throw new Error(`Stale runtime notice: ${row.file}`);}
  console.log(`Signals artifacts verified: ${manifest.artifacts.length} artifacts, ${manifest.sources.length} sources.`);
}else{
  if(copyAt<0||!args[copyAt+1])throw new Error('Provide --from with the external build-output directory; compiler downloads stay outside the repository.');
  const source=resolve(args[copyAt+1]);await mkdir(target,{recursive:true});
  for(const name of names){const bytes=await readFile(join(source,name));if(name.endsWith('.wasm')&&(bytes.length<8||!bytes.subarray(0,4).equals(Buffer.from([0,97,115,109]))))throw new Error(`Not WebAssembly: ${name}`);await copyFile(join(source,name),join(target,name));}
  const notice=['OmniCivitas signals engines — linked browser runtime notices','\nThe circuit and communication algorithms are original project code. The distributed WebAssembly and Emscripten adapter also contain standard-library/runtime portions under the following upstream licenses. These notices apply to those portions; they are not endorsements.\n'];
  for(const name of licenses)notice.push(`\n===== ${name} =====\n`,await readFile(join(repository,'docs/licenses/signals-runtime',name),'utf8'));
  await writeFile(join(target,'NOTICE.txt'),notice.join('\n'));
  const artifacts=await Promise.all([...names,'NOTICE.txt'].map(async file=>{const bytes=await readFile(join(target,file));return{file,bytes:bytes.length,sha256:digest(bytes)};}));
  const sourceHashes=await Promise.all(sources.map(async file=>({file,sha256:digest(await readFile(join(repository,file)))})));
  const licenseHashes=await Promise.all(licenses.map(async file=>({file:`docs/licenses/signals-runtime/${file}`,sha256:digest(await readFile(join(repository,'docs/licenses/signals-runtime',file)))})));
  await writeFile(join(target,'manifest.json'),JSON.stringify({schema:'ocv.signals.artifacts/1',generatedAt:new Date().toISOString(),engineVersion:'1.1.0',engineVersions:{circuit:'1.0.0',communications:'1.1.0'},compilers:{cpp:'Emscripten 4.0.17; -O2 -std=c++20 -fexceptions; modular ES6',rust:'rustc 1.90.0; wasm32-unknown-unknown; release opt-level=2/lto'},abi:{cpp:'Emscripten ccall ocv_run',rust:'memory/ocv_alloc/ocv_run/ocv_dealloc'},artifacts,sources:sourceHashes,runtimeLicenses:licenseHashes},null,2)+'\n');
  console.log(`Published ${artifacts.length} first-party engine artifacts with source and runtime-license digests.`);
}
