// Recalculate references from the untouched pre-rename text, using the inventory.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const report=JSON.parse(fs.readFileSync('docs/naming-paths.json'));
assert.ok(!report.referenceRewriteCompleted,'Reference rewrite already completed; do not rerun it.');
const rows=report.pairs.toSorted((a,b)=>b.before.length-a.before.length),norm=p=>p.replaceAll('\\','/');
const map=p=>{p=norm(p);const row=rows.find(r=>p===r.before||p.startsWith(r.before+'/'));return row?row.after+p.slice(row.before.length):p;};
const oldFiles=new Set(report.files.map(x=>x.before));
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const alternatives=rows.map(r=>escape(r.before).replaceAll('/','[/\\\\]')+(['apps','packages'].includes(r.before)?'(?=[/\\\\])':''));
// A folder name is not a package-manager key or a suffix of a dependency name.
const boundary='(?=$|[/\\\\.*'+String.fromCharCode(32,9,10,13)+'\'"`:,;})])';
const matcher=new RegExp('(?<![A-Za-z0-9_-])(?<!config[/\\\\])(?:'+alternatives.join('|')+')'+boundary,'gu');
const names=new Map(rows.filter(r=>path.extname(r.before)).map(r=>[path.basename(r.before),path.basename(r.after)]).filter(([a,b])=>a!==b));
const ext=['','.mjs','.js','.ts','.tsx','.astro','.vue','.svelte','.css','.scss','.json'];
for(const changed of report.edited){
 const original=fs.readFileSync(path.join(report.backup,changed.before),'utf8');let text=original;
 text=text.replace(/(['"`])((?:\.\.?\/)[^\r\n'"`$]+)\1/g,(whole,q,value)=>{const[,p,suffix]=value.match(/^([^?#]+)(.*)$/);const old=norm(path.relative(process.cwd(),path.resolve(path.dirname(changed.before),p)));const extension=ext.find(e=>oldFiles.has(old+e));if(extension===undefined)return whole;let relative=norm(path.relative(path.dirname(changed.after),map(old+extension)));if(extension)relative=relative.slice(0,-extension.length);if(!relative.startsWith('.'))relative='./'+relative;return q+relative+suffix+q;});
 text=text.replace(matcher,value=>{const windows=value.includes('\\'),mapped=map(value);return windows?mapped.replaceAll('/','\\'):mapped;});
 for(const[a,b]of names)text=text.replaceAll(a,b);
 text=text.replaceAll('@omnicivitas/angular-1999','@omnicivitas/ng').replaceAll('@omnicivitas/next-but-was-excel','@omnicivitas/web2').replaceAll('/office-1999/','/ng/');
 fs.writeFileSync(changed.after,text);
}
const portal='config/apps/portal/package.json',p=JSON.parse(fs.readFileSync(portal));p.scripts.build='node ../../../scripts/phase8-build.mjs && node ../../../scripts/copy-angular.mjs && astro build';p.nx.targets.build.inputs.push('{workspaceRoot}/pinia/**/*','{workspaceRoot}/pcakage/build2/**/*','{workspaceRoot}/scripts/phase8-build.mjs','{workspaceRoot}/scripts/copy-angular.mjs');fs.writeFileSync(portal,JSON.stringify(p,null,2)+'\n');
const astro='config/apps/portal/astro.config.mjs';let a=fs.readFileSync(astro,'utf8');a=a.replace('const deps = process.env.OCV_DEPS_ROOT;',"const deps = process.env.OCV_DEPS_ROOT;\nconst workspaceRoot=path.resolve(process.cwd(),'../../..');").replace('allow: [process.cwd(),','allow: [workspaceRoot,');fs.writeFileSync(astro,a);
const docker='infra/Dockerfile';let d=fs.readFileSync(docker,'utf8');d=d.replace('COPY config/apps/portal ./config/apps/portal','COPY config/apps/portal ./config/apps/portal\nCOPY pinia ./pinia');fs.writeFileSync(docker,d);
for(const file of ['pnpm-workspace.yaml','pnpm-lock.yaml'])assert.ok(fs.readFileSync(file,'utf8').includes('\npackages:')||fs.readFileSync(file,'utf8').startsWith('packages:'));
assert.ok(fs.readFileSync('pnpm-lock.yaml','utf8').includes('node-gyp-build-optional-packages'));
console.log('References recalculated from original bytes; reserved pnpm keys and dependency names preserved.');
report.referenceRewriteCompleted=true;fs.writeFileSync('docs/naming-paths.json',JSON.stringify(report,null,2)+'\n');
