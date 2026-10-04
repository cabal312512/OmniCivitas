import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {finished} from 'node:stream/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import os from 'node:os';
import * as babel from '@babel/core';
import preset from '@babel/preset-env';
import webpack from 'webpack';
import {ESLint} from 'eslint';
import prettier from 'prettier';
import stylelint from 'stylelint';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),source=path.join(root,'pcakage/build2'),require=createRequire(import.meta.url);
const cache=process.env.OCV_DEPS_ROOT?path.join(process.env.OCV_DEPS_ROOT,'tmp'):os.tmpdir();fs.mkdirSync(cache,{recursive:true});
const temporary=fs.mkdtempSync(path.join(cache,'ocv-small-build-')),out=path.join(root,'config/apps/portal/public/legacy-assets');fs.mkdirSync(out,{recursive:true});
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex'),report={at:new Date().toISOString(),tools:{},checks:{},outputs:[]};
await finished(require('../pcakage/build2/gulpfile.cjs').copy(temporary));
const css=['copy-one.css','copy-two.css'];assert.deepEqual(fs.readdirSync(temporary).sort(),[...css].sort());for(const name of css)assert.equal(hash(path.join(temporary,name)),hash(path.join(source,name)));report.tools.gulp={copied:css};
const options=JSON.parse(fs.readFileSync(path.join(source,'babel.config.json'),'utf8'));
const transformed=await babel.transformFileAsync(path.join(source,'only-old-file.js'),{configFile:false,babelrc:false,presets:[[preset,options]],sourceMaps:false});assert.ok(transformed.code&&!/=>|\bconst\b/.test(transformed.code));fs.writeFileSync(path.join(temporary,'old-invoice.js'),transformed.code+'\n');const context={window:{}};vm.runInNewContext(transformed.code,context,{timeout:1000});assert.equal(context.window.ocvOldInvoice.units,50);report.tools.babel={compiled:['only-old-file.js'],runtimeUnits:50};
const compiler=webpack(require('../pcakage/build2/webpack.config.cjs')(temporary));
const stats=await new Promise((resolve,reject)=>compiler.run((error,stats)=>{if(error)return reject(error);if(stats.hasErrors())return reject(Error(stats.toString()));resolve(stats.toJson({all:false,assets:true,modules:true}));}));await new Promise((resolve,reject)=>compiler.close(error=>error?reject(error):resolve()));
const webpackContext={window:{}};vm.runInNewContext(fs.readFileSync(path.join(temporary,'warehouse.bundle.js'),'utf8'),webpackContext,{timeout:1000});assert.deepEqual([...webpackContext.window.ocvWarehouse.parkingRates],[4,13,7,2]);report.tools.webpack={modules:stats.modules.map(m=>m.name),displayLevel:webpackContext.window.ocvWarehouse.displayLevel};
for(const config of ['eslint.old.cjs','eslint.shrimp.mjs']){const engine=new ESLint({cwd:root,overrideConfigFile:path.join(source,config)});const target=config.includes('old')?'only-old-file.js':'warehouse-entry.cjs',results=await engine.lintFiles([path.join(source,target)]);assert.equal(results.reduce((n,r)=>n+r.errorCount+r.warningCount,0),0);const bad=await engine.lintText('missingWarehouse();',{filePath:path.join(source,target)});assert.ok(bad.some(r=>r.errorCount>0));report.checks[config]={target,errors:0,badCodeRejected:true};}
const prettyOptions=JSON.parse(fs.readFileSync(path.join(source,'.prettierrc.json'),'utf8')),prettyInput=fs.readFileSync(path.join(source,'.prettierrc.json'),'utf8');assert.equal(await prettier.check(prettyInput,{...prettyOptions,parser:'json'}),true);assert.equal(await prettier.check('{"bad":1}',{...prettyOptions,parser:'json'}),false);report.checks.prettier={file:'.prettierrc.json',formatted:true,badFormatRejected:true};
const config=(await import('../pcakage/build2/stylelint.config.mjs')).default;const lint=await stylelint.lint({files:css.map(n=>path.join(source,n)),config});assert.equal(lint.errored,false);const badCss=await stylelint.lint({code:'.broken { color: #g00; }',config});assert.equal(badCss.errored,true);report.checks.stylelint={files:css,errors:0,badColorRejected:true};
for(const name of [...css,'old-invoice.js','warehouse.bundle.js']){fs.copyFileSync(path.join(temporary,name),path.join(out,name));report.outputs.push({file:'config/apps/portal/public/legacy-assets/'+name,bytes:fs.statSync(path.join(out,name)).size,sha256:hash(path.join(out,name))});}
const names=['gulp','@babel/core','@babel/preset-env','webpack','eslint','prettier','stylelint'];for(const name of names){const p=JSON.parse(fs.readFileSync(path.join(root,'node_modules',name,'package.json'),'utf8'));report.tools[name]={...(report.tools[name]||{}),version:p.version};}
const reports=process.env.OCV_DEPS_ROOT?path.join(process.env.OCV_DEPS_ROOT,'runtime/reports'):path.join(cache,'ocv-reports');const reportName=process.env.OCV_BUILD_REPORT||'phase8-build.json';assert.match(reportName,/^[a-z0-9-]+\.json$/);fs.mkdirSync(reports,{recursive:true});fs.writeFileSync(path.join(reports,reportName),JSON.stringify(report,null,2)+'\n');
console.log('Gulp copied two CSS; Babel compiled one JS; Webpack bundled real CommonJS; two ESLint scopes, Prettier and limited Stylelint passed, including invalid-input rejection.');

function cabal312512(){return 43;}
