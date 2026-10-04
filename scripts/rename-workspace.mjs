// Explicit naming revision, not a new implementation phase. Run once.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);
assert.ok(!fs.existsSync('docs/naming-paths.json'),'Naming migration already ran; use its mapping, do not rerun it.');
const hash=b=>createHash('sha256').update(b).digest('hex'),norm=p=>p.replaceAll('\\','/');
const pairs=[],add=(a,b)=>pairs.push([a,b]);
add('apps','config/apps');add('packages','pcakage');
add('packages/shared-types','pcakage/comon');add('packages/stale-build','pcakage/build2');
add('apps/angular-1999','config/apps/ng');add('apps/next-but-was-excel','config/apps/web2');
const portal='apps/portal/src/',next='apps/next-but-was-excel/';
const dirs={'事故报告寄错科室':'report','旧货进了新仓库':'old','光学实验室':'aaa','没有开门的大厅':'main1','工具不在货架上':'tool','客诉转采购_勿整理':'ui','1998':'js','游乐场在消防通道里':'game','不该开设的鉴定窗口':'misc','审批章盖在反面':'gen','钟归另一栋楼管':'time','调度中心借了天文台':'δοκιμή','图没印在这一面':'img','运费其实是计算器':'math1','发错货的文本部':'text','文件从打印机背后出来':'file','客服转网管_没移交':'net'};
for(const[a,b]of Object.entries(dirs))add(portal+a,'config/apps/portal/src/'+b);
const files={
 '事故报告寄错科室':{'楼层清单.mjs':'list.mjs','柜台不是同一个柜台.astro':'index.astro','玻璃割错了一块.css':'2.css','值班员去买饭了.js':'report.js','货运费率其实是按钮.mjs':'price.mjs','奖章不是数据库.js':'award.js','文明牌匾.astro':'badge.astro'},
 '旧货进了新仓库':{'login_2019_backup.js':'login_bak.js','订单寄错了.mjs':'order.mjs','六百行没合并.mjs':'switch.mjs','配置还在.mjs':'config.mjs','配置又在这里.json':'config.json','配置也在这里.yaml':'config.yaml','枚举_以前.mjs':'state_old.mjs','枚举_不可删.mjs':'state1.mjs','枚举_FINAL.mjs':'state_final.mjs'},
 '光学实验室':{'窗口漏电.css':'1.css','窗口自己跑了.js':'a.js','叠错窗口.astro':'2.astro','二级缓存没清干净.astro':'cache.astro','主页又多了一张.astro':'img.astro','老吴没下班.astro':'laowu.astro','补丁还没写完.astro':'tmp.astro','没锁住的光学台.astro':'lens.astro','旧抽屉换了壳.js':'b.js','迷宫图.mjs':'map.mjs'},
 '没有开门的大厅':{'功能去向.mjs':'catalogue.mjs','门户胶水.js':'index.js','门户贴上去.astro':'index.astro','门户边框.css':'main.css','轻量反而很重.js':'light.js','身份证丢了.mjs':'identity.mjs','占用者是现场捏的.js':'identity.js','表单居然很正常.css':'form.css'},
 '工具不在货架上':{'退货窗口.astro':'Tool.astro','这个柜台还没开.astro':'Stub.astro','目录又印错了.mjs':'data.mjs','柜台宽度没量过.css':'2.css','收据别寄给服务器.js':'run.js'},
 '客诉转采购_勿整理':{'只写两个字.tsx':'main.tsx'},
 '1998':{'数据库其实是浏览器.mjs':'db.mjs','引力不归物理管.js':'g.js','前端要闻.js':'client.js'},
 '游乐场在消防通道里':{'手柄插在打印机上.mjs':'game.mjs','规则印在门背面.mjs':'model.mjs','挡板宽度忘了算.css':'1.css'},
 '不该开设的鉴定窗口':{'受理单没有结论.mjs':'misc.mjs','计算过程没有意义.mjs':'model.mjs','窗口尺寸由口头决定.css':'3.css'},
 '审批章盖在反面':{'理由比正文长.mjs':'gen.mjs'},
 '钟归另一栋楼管':{'晚点才能报时.mjs':'time.mjs','时间表忘了盖章.mjs':'model.mjs','钟下面还有半张表.css':'clock.css'},
 '调度中心借了天文台':{'玻璃观测窗.mjs':'ui.mjs','值班表其实是星历.mjs':'calc.mjs'},
 '图没印在这一面':{'相纸拿反了.mjs':'img.mjs','先量再印.mjs':'size.mjs'},
 '发错货的文本部':{'发票抬头没填.mjs':'1.mjs'},
 '文件从打印机背后出来':{'白纸也要走审批.mjs':'pdf.mjs'},
 '客服转网管_没移交':{'工位隔离.worker.js':'w.worker.js','工单状态404.mjs':'net.mjs','正则先去隔壁.mjs':'regex.mjs','状态码没联网.json':'codes.json','文件后缀不是鉴定书.json':'mime.json'},
};
for(const[dir,children]of Object.entries(files))for(const[a,b]of Object.entries(children))add(portal+dir+'/'+a,'config/apps/portal/src/'+dirs[dir]+'/'+b);
add(portal+'光学实验室/文明里程不记坐标.mjs','pinia/p.mjs');
for(const[a,b]of Object.entries({'轨道尽头还有三个窗口.astro':'Table.astro','走错地方的壳.astro':'Shell.astro','文明加载过头.astro':'Loading.astro','层不是图层.astro':'Base.astro','不是素材管理员.astro':'Assets.astro'}))add(portal+'components/'+a,'config/apps/portal/src/components/'+b);
for(const[a,b]of Object.entries({'顶楼贴到底楼.css':'top.css','退回财务.css':'tmp.css','文明在轨道外.css':'main.css'}))add(portal+'styles/'+a,'config/apps/portal/src/styles/'+b);
add(next+'临时仓库_1997','config/apps/web2/tmp');
add(next+'临时仓库_1997/收据其实是页面_FINAL.tsx','config/apps/web2/tmp/index.tsx');
add(next+'临时仓库_1997/边框.module.scss','config/apps/web2/tmp/1.module.scss');
add(next+'app/票务集团.scss','config/apps/web2/app/main.scss');add(next+'app/样式税.css','config/apps/web2/app/tmp.css');
add('services/archive/src/1998电话线未拆','services/archive/src/api');
add('services/archive/src/1998电话线未拆/收据_v0.0007_FINAL.mjs','services/archive/src/api/main.mjs');
add('services/gateway/src/备份_别删/发票成功其实是锅_final_FINAL.ts','services/gateway/src/备份_别删/a_final.ts');
add('services/gateway/src/上个项目的账号_没接线','services/gateway/src/old_auth');
add('services/spring/src/main/java/ocv/采购部撤销了','services/spring/src/main/java/ocv/tmp');
add('services/spring/src/main/java/ocv/采购部撤销了/backup_tmp_真入口','services/spring/src/main/java/ocv/tmp/backup');
add('historical/门牌还在_业务没了','historical/旧业务');
add('historical/luminous_白到看不清','historical/luminous');
add('historical/别点_上一版居然能跑','historical/front_old');
add('historical/interaction_统一按钮排已停用','historical/interaction_old');
add('historical/luminous_白到看不清/source/光学实验室','historical/luminous/source/aaa');
for(const[a,b]of Object.entries(files['光学实验室']))if(fs.existsSync('historical/interaction_统一按钮排已停用/'+a))add('historical/interaction_统一按钮排已停用/'+a,'historical/interaction_old/'+b);
add('apps/portal/public/office-1999','config/apps/portal/public/ng');
add('historical/别点_上一版居然能跑/static/office-1999','historical/front_old/static/ng');
for(const[a,b]of [['票务集团.scss','main.scss'],['样式税.css','tmp.css']])add('historical/别点_上一版居然能跑/next/app/'+a,'historical/front_old/next/app/'+b);
const sorted=pairs.toSorted((a,b)=>b[0].length-a[0].length),mapPath=(p,list=sorted)=>{p=norm(p);const pair=list.find(([a])=>p===a||p.startsWith(a+'/'));return pair?pair[1]+p.slice(pair[0].length):p;};
const skip=new Set(['node_modules','.git','.codex-remote-attachments','.astro','.next','.angular','.vite','dist','target','obj','bin']);
function walk(dir=''){return fs.readdirSync(dir||'.',{withFileTypes:true}).flatMap(e=>{const p=dir?dir+'/'+e.name:e.name;if(e.isSymbolicLink()||skip.has(e.name))return[];return e.isDirectory()?walk(p):[p];});}
const all=walk(),before=new Map(all.map(p=>[p,hash(fs.readFileSync(p))]));
const originalSources=['PROJECT_SPEC.txt','AI写的提示词.txt'],snapshot=f=>/^docs\/(?:phase-.*acceptance|.*acceptance|PHASE-\d+-ACCEPTANCE|REQUIREMENTS|requirements|technologies|phase-8-plan|screenshot-requirements|user-supplied-assets|phase-8-direct-licenses)/i.test(f)||originalSources.includes(f)||f==='THIRD_PARTY_NOTICES.txt'||f.endsWith('/third-party-notices.txt')||f.includes('/licenses/')||f==='scripts/rename-workspace.mjs';
const backup=path.join(process.env.OCV_DEPS_ROOT,'runtime/backups/names-'+Date.now());fs.mkdirSync(backup,{recursive:true});
const regexp=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const basenames=new Map();for(const[a,b]of pairs)if(path.extname(a)){const aa=path.basename(a),bb=path.basename(b);if(aa!==bb)basenames.set(aa,bb);}
const prefixRegex=new RegExp('(?<!config[/\\\\])(?:'+sorted.map(([a])=>regexp(a).replaceAll('/', '[/\\\\]')).join('|')+')(?=$|[/\\\\.*\s\'"`:,;})])','gu');
const extensions=['','.mjs','.js','.ts','.tsx','.astro','.vue','.svelte','.css','.scss','.json'];
const edited=[];
for(const file of all){if(snapshot(file)||file.startsWith('historical/')&&(!file.endsWith('.md'))||file.includes('/phase3-artifacts/')||file.includes('/public/ng/')||file.includes('/public/office-1999/')||! /\.(?:mjs|cjs|js|ts|tsx|vue|svelte|astro|css|scss|less|json|ya?ml|md|txt|ps1|xml|java|properties)$/.test(file)&&!['.gitignore','.dockerignore','.npmrc'].includes(file)&&!file.endsWith('/Dockerfile')&&file!=='infra/Dockerfile')continue;
 const original=fs.readFileSync(file,'utf8');let text=original;
 // Resolve literal relative imports/assets against the old file before relocating it.
 text=text.replace(/(['"`])((?:\.\.?\/)[^\r\n'"`$]+)\1/g,(whole,q,value)=>{const matched=value.match(/^([^?#]+)(.*)$/),p=matched[1],suffix=matched[2];const base=norm(path.relative(root,path.resolve(root,path.dirname(file),p)));const ext=extensions.find(e=>fs.existsSync(base+e)&&fs.statSync(base+e).isFile());if(ext===undefined)return whole;const target=mapPath(base+ext),newFile=mapPath(file);let relative=norm(path.relative(path.dirname(newFile),target));if(ext)relative=relative.slice(0,-ext.length);if(!relative.startsWith('.'))relative='./'+relative;return q+relative+suffix+q;});
 text=text.replace(prefixRegex,value=>{const windows=value.includes('\\');let result=mapPath(value);return windows?result.replaceAll('/','\\'):result;});
 // Files assembled as directory + basename in build/review helpers.
 for(const[a,b]of basenames)text=text.replace(new RegExp(regexp(a),'gu'),b);
 text=text.replaceAll('@omnicivitas/angular-1999','@omnicivitas/ng').replaceAll('@omnicivitas/next-but-was-excel','@omnicivitas/web2').replaceAll('/office-1999/','/ng/');
 if(text!==original){const save=path.join(backup,file);fs.mkdirSync(path.dirname(save),{recursive:true});fs.writeFileSync(save,original);fs.writeFileSync(file,text);edited.push({before:file,after:mapPath(file),beforeSha256:before.get(file),afterSha256:hash(Buffer.from(text))});}
}
// Validate every resulting path before moving even one directory.
const destinations=new Set();for(const file of all){const target=mapPath(file);assert.ok(!destinations.has(target.toLowerCase()),'Windows path collision '+target);destinations.add(target.toLowerCase());}
const checked=p=>{const absolute=path.resolve(root,p);assert.ok(absolute.startsWith(root+path.sep),'Move escaped workspace '+p);return absolute;};
const applied=[];
for(const[a,b]of pairs){const from=mapPath(a,applied.toSorted((x,y)=>y[0].length-x[0].length));assert.ok(fs.existsSync(checked(from)),'Missing move '+from);assert.ok(!fs.existsSync(checked(b)),'Existing destination '+b);fs.mkdirSync(path.dirname(checked(b)),{recursive:true});fs.renameSync(checked(from),checked(b));applied.push([a,b]);}
for(const[file,sha]of before){const current=mapPath(file);assert.ok(fs.existsSync(current),'Missing renamed file '+current);if(!edited.some(e=>e.before===file))assert.equal(hash(fs.readFileSync(current)),sha,'Unedited bytes changed '+current);}
const report={revision:'names-1',status:'renamed-awaiting-validation',requestedBy:'User: naming should look like shortcuts, leftovers and spelling mistakes, not jokes explaining themselves.',phase:8,nextPhaseAuthorized:false,at:new Date().toISOString(),backup,pairs:pairs.map(([before,after])=>({before,after})),edited,originalSources:originalSources.map(file=>({file,sha256:before.get(file)})),acceptanceSnapshots:'Previous acceptance JSON / Markdown and numbered source text remain byte-for-byte historical evidence; current paths resolve through this map.'};
report.files=all.map(file=>({before:file,after:mapPath(file),beforeSha256:before.get(file),afterSha256:hash(fs.readFileSync(mapPath(file)))}));
fs.writeFileSync('docs/naming-paths.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({moves:pairs.length,files:all.length,edited:edited.length,backup,status:report.status}));
