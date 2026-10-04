import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const reports=path.join(process.env.OCV_DEPS_ROOT||os.tmpdir(),'runtime/reports');
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const ledger=json('docs/requirements.json'),tech=json('docs/technologies.json'),review=json('docs/phase9-review-map.json');
const baseline=json(path.join(reports,'phase9-source-baseline.json'));
for(const row of baseline)assert.equal(hash(row.path),row.sha256,'Protected original: '+row.path);

// Independently find the two sequential numbered blocks. Do not import the old generator.
const lines=fs.readFileSync('PROJECT_SPEC.txt','utf8').replace(/^\uFEFF/,'').split(/\r?\n/);
const groups=[[],[]];let block=0;
for(let index=0;index<lines.length;index++){
 const dot=lines[index].indexOf('.');if(dot<1||!/^\d+$/.test(lines[index].slice(0,dot)))continue;
 const n=Number(lines[index].slice(0,dot));if(n===1&&groups[block].length){block++;assert.equal(block,1)}
 assert.equal(n,groups[block].length+1,'Numbered source sequence');
 groups[block].push({id:(block?'B':'A')+String(n).padStart(3,'0'),sourceLine:index+1,text:lines[index].slice(dot+1).replace(/^\s+/,'')});
}
assert.deepEqual(groups.map(g=>g.length),[381,351]);
const independent=groups.flat();assert.equal(ledger.requirements.length,732);
for(const original of independent){const stored=ledger.requirements.find(r=>r.id===original.id);assert.ok(stored);assert.equal(stored.text,original.text,original.id);assert.equal(stored.sourceLine,original.sourceLine)}
const categories=lines.filter(line=>line.includes('\t')).map(line=>line.split('\t'));
assert.equal(categories.length,34);for(let i=0;i<34;i++){assert.equal(categories[i][0],ledger.stackCategories[i].category);assert.equal(categories[i].slice(1).join('\t'),ledger.stackCategories[i].specification)}
const paragraphs=fs.readFileSync('AI写的提示词.txt','utf8').split(/\r?\n\s*\r?\n/).map(t=>t.trim()).filter(Boolean);
assert.equal(paragraphs.length,51);paragraphs.forEach((text,i)=>assert.equal(text,ledger.promptParagraphs[i].text));
for(const row of ledger.unnumbered)assert.equal(lines[row.sourceLine-1],row.text);
assert.equal(ledger.unnumbered.length,3);assert.equal(tech.technologies.length,146);

const evidenceFiles=new Set(['phase9-everything.json','phase9-legacy.json','phase9-browser.json','phase9-language-tests.json','phase9-clean-compose.json','phase9-clean-linux-runtime.json','phase9-public-source-audit.json']);
for(const group of review.phase9)for(const file of group.evidence)if(!file.startsWith('docs/'))evidenceFiles.add(file);
const evidence=[];for(const file of evidenceFiles){const p=file.startsWith('docs/')?file:path.join(reports,file);assert.ok(fs.existsSync(p),'Missing evidence '+file);evidence.push({file,bytes:fs.statSync(p).size,sha256:hash(p)})}
const full=json(path.join(reports,'phase9-everything.json'));assert.equal(full.status,'passed');assert.equal(full.checks.length,80);
const browser=json(path.join(reports,'phase9-browser.json'));assert.equal(browser.stats.expected,4);assert.equal(browser.stats.unexpected,0);assert.equal(browser.stats.skipped,0);assert.equal(browser.stats.flaky,0);
assert.equal(json(path.join(reports,'phase9-clean-compose.json')).status,'passed');
assert.ok(json(path.join(reports,'phase9-language-tests.json')).results.every(r=>r.status==='passed'));
const publicSource=json(path.join(reports,'phase9-public-source-audit.json'));assert.equal(publicSource.status,'passed-source-checks');
const linuxLog=fs.readFileSync(path.join(reports,'phase9-clean-linux-build.log'),'utf8').replace(/\u001b\[[0-?]*[ -/]*[@-~]/g,'');assert.match(linuxLog,/299\s+passed\s+\(299\)/);assert.match(linuxLog,/pass\s+6/);assert.match(linuxLog,/3\s+passed,\s+3\s+total/);
const sourceRecord=file=>{assert.ok(fs.existsSync(file),'Implementation reference missing: '+file);const stat=fs.statSync(file);return stat.isDirectory()?{path:file,kind:'directory-reviewed-in-associated-acceptance'}:{path:file,bytes:stat.size,sha256:hash(file)}};
const decisions=new Map();for(const group of review.phase9)for(const id of group.ids){assert.ok(!decisions.has(id));decisions.set(id,group)}
const rows=independent.map(original=>{
 const old=ledger.requirements.find(r=>r.id===original.id),current=decisions.get(original.id),override=review.overrides[original.id],dormant=review.dormantRequirements.includes(original.id);
 let status,note,files,proof;
 if(override){status='superseded-by-later-user-instruction';note=override;files=old.implementation;proof=current?.evidence||old.verification}
 else if(dormant){status='retained-dormant-with-historical-acceptance';note=review.dormantFrontendAuthorization+' Historical acceptance is not a claim of current execution.';files=old.implementation;proof=old.verification}
 else if(current){status=current.status||'verified-in-scoped-acceptance';note=current.note;files=current.implementation;proof=current.evidence}
 else {assert.ok(old.status.startsWith('verified'),original.id+' lacks a disposition');assert.ok(old.verification?.length,original.id+' has no real prior acceptance');status='reviewed-with-prior-acceptance';note=old.currentRevisionNote||old.notes||'Existing implementation and its prior real acceptance reviewed; not rerun as a full browser suite.';files=old.implementation;proof=old.verification}
 assert.ok(proof?.length||override,'No implementation evidence '+original.id);
 return {...original,status,note,implementation:(files||[]).map(sourceRecord),evidence:proof||[],previousLedgerStatus:old.status};
});
for(const row of ledger.requirements.filter(r=>r.phase===9))assert.ok(decisions.has(row.id)||review.overrides[row.id],row.id+' phase-nine disposition missing');

const native={TECH110:['Jest','tests/frameworks/budget.jest.cjs','phase9-clean-linux-build.log'],TECH113:['Cypress','tests/frameworks/tools.cy.cjs','phase9-cypress.log'],TECH114:['JUnit','tests/frameworks/native/ServiceTest.java','phase9-java-test.log'],TECH115:['pytest','tests/frameworks/native/test_service.py','phase9-python-test.log'],TECH116:['PHPUnit','tests/frameworks/native/ServiceTest.php','phase9-php-test.log'],TECH117:['Go testing','tests/frameworks/native/service_test.go','phase9-go-test.log'],TECH118:['xUnit','tests/frameworks/native/dotnet','phase9-dotnet-test.log'],TECH119:['Ruby Minitest','tests/frameworks/native/service_test.rb','phase9-ruby-test.log']};
const currentSources={TECH005:['infra/nginx/edge.conf'],TECH007:['config/apps/web2/app/borrowed/page.tsx','config/apps/web2/app/next-api/receipt/route.ts'],TECH008:['config/apps/web2/app/layout.tsx'],TECH013:['config/apps/portal/src/aaa/b.js'],TECH022:['services/gateway/src/main.ts'],TECH030:['config/apps/portal/astro.config.mjs'],TECH042:['services/gateway/src/备份_别删/a_final.ts'],TECH059:['services/gateway/src/备份_别删/a_final.ts'],TECH060:['services/gateway/src/备份_别删/a_final.ts'],TECH061:['config/apps/portal/src/math1/报价单_final2.mjs'],TECH098:['config/apps/portal/src/time/model.mjs','config/apps/portal/src/3d/save.mjs'],TECH099:['config/apps/portal/src/main1/identity.mjs'],TECH101:['config/apps/portal/src/misc/misc.mjs'],TECH102:['config/apps/portal/src/pages/search.astro'],TECH133:['config/apps/portal/src/report/award.js'],TECH143:['services/gateway/src/main.ts']};
const technologyRows=tech.technologies.map(old=>{
 const n=Number(old.id.slice(4)),addition=native[old.id],dormant=review.dormantTechnologies.includes(old.id),historical=old.role==='historical-or-scoped-config';
 let role=historical?'dormant-original-role':dormant?'dormant-user-selected-version':'active';
 const files=addition?[addition[1]]:currentSources[old.id]||old.implementation;
 const proof=addition?[addition[2]]:historical?['Original explicitly dormant source reviewed; no toolchain installed for that role']:dormant?old.verification:n>=62&&n<=109?['phase9-everything.json','phase9-clean-compose.json']:['phase9-clean-linux-build.log',...(old.verification||[])];
 return {id:old.id,name:old.name,category:old.category,role,status:historical?'source-reviewed-as-dormant':dormant?'historical-execution-retained-not-active':'verified-in-associated-scope',purpose:old.purpose,implementation:(files||[]).map(sourceRecord),evidence:proof,notes:old.id==='TECH011'||old.id==='TECH024'||old.id==='TECH041'||old.id==='TECH135'?'Standalone Angular is built and served. Its former React-parent iframe is dormant; original two-boolean parent interaction is historical evidence.':dormant?review.dormantFrontendAuthorization:old.id==='TECH008'?'React renders current Next server layout; the former multi-store client widget remains dormant.':''};
});

const science=[];for(const prefix of ['','stage2','stage3','stage4','stage5']){
 const root='research/finite-memory-rsa'+(prefix?'/'+prefix:''),seal=root+'/results/research-manifest.json',document=json(seal),entries=Object.entries(document.sourceAndArtifactFiles);
 for(const [file,record]of entries){assert.equal(hash(root+'/'+file),record.sha256);assert.equal(fs.statSync(root+'/'+file).size,record.bytes)}
 science.push({prefix:prefix||'root',files:entries.length,sealSha256:hash(seal)});
}
assert.equal(science.reduce((s,row)=>s+row.files,0),1266);
const ui=json(path.join(reports,'window-research-before.json'));for(const row of ui)assert.equal(hash(row.path),row.hash);assert.equal(ui.length,23);

const publicRows=json('docs/public-release-requirements.json').requirements.map(row=>({...row,status:row.id==='P09'?'implemented-with-platform-validation-limits':'verified-in-associated-scope',evidence:row.id==='P09'?['Actual Windows host and Docker Linux userspace passed. Linux Engine host and macOS host not available; CI configured but not remotely run.']:['phase9-public-source-audit.json','phase9-clean-compose.json','phase9-clean-windows-install.log','phase9-clean-linux-build.log'],notes:row.id==='P10'?'Changes stay in public entry/configuration/fallback/license/acceptance boundaries; research interface frozen.':row.id==='P09'?'Do not turn Docker Linux execution into proof for all three host platforms.':''}));
const screenshotRows=json('docs/screenshot-requirements.json').requirements.map(row=>({...row,status:'reviewed-current-source-and-prior-acceptance',currentEvidence:['phase9-browser.json'],scope:'Fresh fictional-entry path plus unchanged normal card/field source reviewed; original desktop/mobile visual acceptance retained, not rerun in full.'}));
const supplemental={unnumbered:ledger.unnumbered.map(row=>({...row,status:'reviewed-in-scoped-acceptance',evidence:['phase9-everything.json','phase9-clean-compose.json','phase9-clean-linux-build.log']})),stackCategories:ledger.stackCategories,promptParagraphs:ledger.promptParagraphs.map(row=>({...row,status:'reference-reviewed-under-latest-user-priority',notes:'Reference document, not authority to restart, delete old versions, alter frozen research or override latest UI instructions.'}))};
const countBy=(data,key)=>data.reduce((out,row)=>(out[row[key]]=(out[row[key]]||0)+1,out),{});
const audit={schemaVersion:1,phase:9,status:'completed-scoped-audit',updatedAt:new Date().toISOString(),method:'Independent original numbering/text/category/paragraph comparison; manual source/role/override review; separately identified fresh runtime versus retained acceptance. Hash/file existence alone does not verify a requirement.',sourcePreservation:baseline,counts:{A:381,B:351,technologies:146,categories:34,unnumbered:3,promptParagraphs:51,screenshots:12,publicRelease:12},dispositions:countBy(rows,'status'),technologyRoles:countBy(technologyRows,'role'),requirements:rows,technologies:technologyRows,screenshots:screenshotRows,publicRelease:publicRows,...supplemental,freeze:{scientificFiles:1266,seals:science,researchUIAndMusic:23,unchanged:true,experimentsRerun:false,pdfGenerated:false},evidence,limitations:['Old frontend widgets are retained dormant under later user direction; historical execution is explicitly distinguished from current routes.','No macOS or separate Linux Engine host available; no remote CI execution or GitHub publication.','Full natural final tower ascent/Boss win remains unverified under the user-selected brief test scope.','Two old F: phase2 raw reports were accidentally overwritten by new phase9 runs. Original source/acceptance ledgers are unchanged; phase9-legacy/everything record the fresh runs. Old raw hashes are not represented as recovered.','The source scanner is pattern-based plus manual configuration review, not a universal proof that arbitrary secrets cannot exist.']};
fs.writeFileSync('docs/phase9-final-audit.json',JSON.stringify(audit,null,2)+'\n');
const escape=text=>String(text||'').replaceAll('|','\\|').replaceAll('\n','<br>');
const intro='# 第九阶段逐条审计\n\n原账本不改；本表从原始文档独立读取 381 A + 351 B，并逐条登记当前处理、源码和验收证据。`reviewed-with-prior-acceptance` 使用已保留的实际旧验收，不表示本轮重跑；`retained-dormant` 不表示当前网页仍启用它。后来的用户要求优先。详见 phase9-final-audit.json 与 PHASE-9-ACCEPTANCE.md。\n\n';
let md=intro+'| ID | 原文要求 | 当前处理 | 证据/判断 |\n| --- | --- | --- | --- |\n'+rows.map(row=>`| ${row.id} | ${escape(row.text)} | ${row.status} | ${escape(row.note)}<br>${escape(row.evidence.join('; '))} |`).join('\n')+'\n\n## 技术用途\n\n| ID | 技术 | 当前角色 | 实际证据 |\n| --- | --- | --- | --- |\n'+technologyRows.map(row=>`| ${row.id} | ${escape(row.name)} | ${row.role} | ${escape(row.notes)} ${escape(row.evidence.join('; '))} |`).join('\n');
md+='\n\n## 未编号、参考提示词与截图\n\n'+[...supplemental.unnumbered,...supplemental.promptParagraphs,...screenshotRows].map(row=>`- ${row.id}: ${escape(row.text)} — ${row.status}`).join('\n')+'\n\n## 公开版十二项\n\n'+publicRows.map(row=>`- ${row.id}: ${escape(row.text)} — ${row.status}`).join('\n')+'\n';
fs.writeFileSync('docs/PHASE-9-REQUIREMENTS.md',md);
console.log(JSON.stringify({status:audit.status,counts:audit.counts,dispositions:audit.dispositions,technologyRoles:audit.technologyRoles,freeze:audit.freeze},null,2));
