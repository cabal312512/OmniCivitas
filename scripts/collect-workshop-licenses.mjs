import { readFile, readdir, mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// The caller exports the license-artifacts Docker target into an external temporary directory.
const exported = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Pass the exported license-artifacts directory.');
const destination = path.resolve('docs/licenses/workshop-runtime');
const lock = await readFile(path.join(exported,'Cargo.lock'),'utf8');
const resolved = new Map();
for (const block of lock.split('[[package]]').slice(1)) {
  const name = block.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
  const version = block.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  if (name && version && /^source\s*=\s*"registry\+/m.test(block)) resolved.set(`${name}-${version}`,{name,version});
}
await mkdir(destination,{recursive:true});
const manifest=[];
for (const folder of (await readdir(path.join(exported,'licenses'))).sort()) {
  if (!resolved.has(folder)) continue;
  const packageDirectory=path.join(exported,'licenses',folder);
  const toml=await readFile(path.join(packageDirectory,'Cargo.toml'),'utf8');
  const packageSection=toml.split('[package]')[1]?.split(/\n\[/)[0]||'';
  const spdx=packageSection.match(/^license\s*=\s*"([^"]+)"/m)?.[1]||'SEE RETAINED FILES';
  const repository=packageSection.match(/^repository\s*=\s*"([^"]+)"/m)?.[1]||'';
  const retained=[];
  async function walk(directory,relative='') {
    for (const entry of await readdir(directory,{withFileTypes:true})) {
      const rel=path.join(relative,entry.name);
      if(entry.isDirectory()) await walk(path.join(directory,entry.name),rel);
      else if (/(license|copying|copyright|notice)/i.test(entry.name)) {
        const registryMarker=rel.replaceAll('\\','/').split(`/${folder}/`).at(-1);
        const safe=registryMarker.split('/').filter(part=>part && part!=='.' && part!=='..').join('/');
        const target=path.join(destination,folder,safe);
        await mkdir(path.dirname(target),{recursive:true});await copyFile(path.join(directory,entry.name),target);
        retained.push(`${folder}/${safe}`);
      }
    }
  }
  await walk(packageDirectory);
  if (!retained.length) throw new Error(`No retained license found for ${folder}; inspect its license-file before release.`);
  manifest.push({...resolved.get(folder),spdx,repository,files:[...new Set(retained)].sort()});
}
if (!manifest.some(item=>item.name==='rapier2d'&&item.version==='0.22.0')) throw new Error('Pinned Rapier license missing.');
await writeFile(path.join(destination,'manifest.json'),JSON.stringify({schema:'ocv.workshop-licenses/1',scope:'Cargo-resolved dependencies whose licenses were exported by the compiled image; no external implementation source is vendored',packages:manifest},null,2)+'\n');
let notice='OmniCivitas workshop execution runtime\n\nOriginal adapter/model/control/protocol code: MIT, cabal312512.\nRapier 2D 0.22.0: Dimforge, EURL / Sébastien Crozet; Apache-2.0.\nDependencies keep their respective licenses. Rapier is Apache-2.0, not MIT.\n\n';
for(const item of manifest) {
  notice+=`${item.name} ${item.version}\nSPDX: ${item.spdx}\n${item.repository}\n`;
  for(const file of item.files) notice+=`\n--- ${file} ---\n${await readFile(path.join(destination,file),'utf8')}\n`;
  notice+='\n';
}
const publicDirectory=path.resolve('config/apps/portal/public/workshop/engines');
await mkdir(publicDirectory,{recursive:true});await writeFile(path.join(publicDirectory,'NOTICE.txt'),notice);
console.log(JSON.stringify({packages:manifest.length,licenseFiles:manifest.reduce((sum,item)=>sum+item.files.length,0),noticeBytes:Buffer.byteLength(notice)}));
