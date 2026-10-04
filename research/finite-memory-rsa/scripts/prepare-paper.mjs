import fs from 'node:fs';import path from 'node:path';import {ROOT} from './run-experiment.mjs';
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const groups=read('data/processed/summary.json').groups,find=(controller,k)=>groups.find(g=>g.experiment==='confirmation'&&g.controller===String(controller)&&g.k===k);
const fmt=(n,p=6)=>Number(n).toFixed(p);
const table=(headers,rows)=>[headers.join(' | '),headers.map(()=> '---').join(' | '),...rows.map(row=>row.join(' | '))].map(x=>'| '+x+' |').join('\n');
const holdout=table(['k','fair theta','35 theta','41 theta','41 mean abs(S)','38 theta','38 deadlock'],[2,3,4,8].map(k=>[k,...['random-0.5',35,41].map(c=>fmt(find(c,k).metrics.coverage.mean)),fmt(find(41,k).metrics.abs_order.mean),fmt(find(38,k).metrics.coverage.mean),fmt(find(38,k).deadlock.rate,4)]));
const exact=read('data/processed/exact_small_systems.json');
const {exactTerminal}=await import('../src/exact.mjs');
const exactRows=[['fair',{baseline:'fair'}],['35 alternating',{controller:35}],['0 fixed-H',{controller:0}],['46 size-specific',{controller:46}]].map(([name,params])=>{const r=exactTerminal({L:3,k:2,boundary:'periodic',...params}),m=r.metrics;return[name,m.coverage.numerator+'/'+m.coverage.denominator,fmt(m.coverage.value),m.deadlockProbability.numerator+'/'+m.deadlockProbability.denominator];});
const mainExperiments=['atlas','confirmation','finite_size','small_validation','open_boundary'].map(name=>{const m=read(`data/raw/${name}.manifest.json`),c=m.configuration;return[name,c.sizes.join('/'),c.lengths.join('/'),c.repetitions,m.runs];});mainExperiments.push(['rrsa','64','2/3/4/8','512','2048']);
const rescue=read('data/processed/rescue-summary.json').groups.map(g=>{const m=g.metrics;return[g.k,fmt(m.before_coverage.mean),fmt(m.after_coverage.mean),fmt(m.coverage_gain.mean),`[${fmt(m.coverage_gain.ciLow)},${fmt(m.coverage_gain.ciHigh)}]`];});
let paper=fs.readFileSync(path.join(ROOT,'paper/manuscript.template.md'),'utf8');
for(const [key,value]of Object.entries({exact_table:table(['Policy','exact theta','decimal theta','P(deadlock)'],exactRows),experiments_table:table(['Experiment','L','k','runs/stratum','total runs'],mainExperiments),holdout_table:holdout,rescue_table:table(['k','before theta','after theta','paired gain','95% gain interval'],rescue)}))paper=paper.replaceAll('{{'+key+'}}',value);
if(/\{\{/.test(paper))throw new Error('Unfilled paper placeholder');
// The first two digits are reference numbers; spacing is editorial, never a
// transformation of measurements, equations, archived controller IDs or data.
fs.writeFileSync(path.join(ROOT,'paper/paper.md'),paper);console.log(JSON.stringify({paper:'paper/paper.md',characters:paper.length,exactSystems:exact.systems.length}));
