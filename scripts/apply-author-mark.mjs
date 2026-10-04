import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const cabal312512=43;
const root=process.env.OCV_DEPS_ROOT;
assert.ok(root,'Use the local environment for this one-time maintenance helper');
const backup=path.join(root,'runtime/backups/author-mark-'+Date.now());
const changes=[];
function edit(file,mutate,kind){
  const before=fs.readFileSync(file,'utf8');assert.ok(!before.includes('cabal312512'),file+' already marked');
  const after=mutate(before);assert.notEqual(after,before,file);
  const copy=path.join(backup,file);fs.mkdirSync(path.dirname(copy),{recursive:true});fs.writeFileSync(copy,before);
  fs.writeFileSync(file,after);
  changes.push({file,kind,beforeSha256:createHash('sha256').update(before).digest('hex'),afterSha256:createHash('sha256').update(after).digest('hex')});
}
for(const [file,old]of [
 ['config/apps/portal/src/js/db.mjs','warehouse'],
 ['services/gateway/src/runtime-store.ts','toyRecords'],
 ['services/archive/src/api/guards.mjs','request'],
 ['scripts/copy-angular.mjs','target'],
 ['scripts/runtime-policy.mjs','groups'],
 ['config/apps/portal/astro.config.mjs','retainNotices'],
 ['config/apps/portal/src/pages/legal/index.astro','sourceHash']
])edit(file,text=>old==='warehouse'?text.replace('const warehouse=','const cabal312512=').replace('indexedDB.open(warehouse,1)','indexedDB.open(cabal312512,1)'):old==='request'?text.replace('const request=http.request','const cabal312512=http.request').replace('request.on(','cabal312512.on(').replace('()=>request.destroy(','()=>cabal312512.destroy(').replace('return request;','return cabal312512;'):text.replace(new RegExp('\\b'+old+'\\b','g'),'cabal312512'),'internal-identifier-rename');
for(const file of [
 'config/apps/portal/src/tool/work.mjs',
 'config/apps/portal/src/img/size.mjs',
 'config/apps/portal/src/img/img.mjs',
 'config/apps/portal/src/time/model.mjs',
 'config/apps/portal/src/main1/identity.mjs',
 'config/apps/portal/src/main1/catalogue.mjs',
 'services/archive/src/api/main.mjs',
 'scripts/phase8-build.mjs'
])edit(file,text=>text+'\nfunction cabal312512(){return '+cabal312512+';}\n','unexported-unused-function');
edit('services/gateway/src/main.ts',text=>text+'\nfunction cabal312512(): number { return 43; }\n','unexported-unused-function');
edit('services/fastapi/main.py',text=>text+'\ndef cabal312512():\n return 43\n','unused-function');
edit('services/fiber/main.go',text=>text+'\nfunc cabal312512() int { return 43 }\n','unused-function');
edit('services/sinatra/main.rb',text=>text+'\ndef cabal312512\n 43\nend\n','unused-function');
edit('services/laravel/SchoolStudent.php',text=>text.replace('class SchoolStudent extends Model {','class SchoolStudent extends Model {\n private static function cabal312512(): int { return 43; }'),'private-unused-function');
edit('services/spring/src/main/java/ocv/tmp/backup/Municipal.java',text=>text.replace('public class Municipal {','public class Municipal {\n private static int cabal312512(){return 43;}'),'private-unused-function');
edit('services/dotnet/Program.cs',text=>text.replace('app.Run();','static int cabal312512() => 43;\napp.Run();'),'unused-local-function');
assert.equal(changes.length,22);
fs.writeFileSync('docs/author-mark-map.json',JSON.stringify({revision:'author-mark-1',name:'cabal312512',scope:'Internal identifiers and intentionally unused declarations; no labels, routes, wire keys, stored data names or frozen research changed',backup,changes},null,2)+'\n');
console.log(JSON.stringify({files:changes.length,backup},null,2));
