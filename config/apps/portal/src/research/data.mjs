import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createGzip} from 'node:zlib';
import {marked,Renderer} from 'marked';
import {publicationEntries} from '../../../../../scripts/research-publication.mjs';

function findWorkspace(){let dir=path.dirname(fileURLToPath(import.meta.url));for(;;){if(fs.existsSync(path.join(dir,'research/finite-memory-rsa/stage5/results/research-manifest.json')))return dir;const parent=path.dirname(dir);if(parent===dir)throw Error('The frozen research snapshot is missing from this build context');dir=parent;}}
const workspaceRoot=findWorkspace();
export const researchRoot=path.join(workspaceRoot,'research/finite-memory-rsa');
const publicRoot=path.join(workspaceRoot,'config/apps/portal/public/research');
export const load=file=>JSON.parse(fs.readFileSync(path.join(researchRoot,file),'utf8'));
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export const support=load('stage5/results/certificate-verification.json');
export const dominance=load('stage5/results/periodic-negative.json');
export const scope=load('stage5/results/feedback-scope.json');
export const law=load('stage4/results/proper-boundary-null.json');
export const feasible=load('stage4/results/capability-search.json').outcomes;
export const newLaws=[1,2,4,5,6,7].map(id=>load(`stage5/data/lower-${id}.json`));
const tree=load('stage5/data/word-certificate-2.json');
export const prefixPreview=tree.records.filter(row=>row.depth<=8).map(row=>({...row,upper:Number(row.upper)/2**48}));
export const researchData={support:support.supports,dominance:dominance.rows,law:law.law,newLaws:newLaws.map(({law,parameters,realization,metrics})=>({law,parameters,realization,metrics})),scope:scope.results,prefix:prefixPreview,
  feasible:feasible.map(({parameters,feedback,temporal})=>({parameters,feedback:feedback.map(({policy,metrics,universalOperationalStates,states})=>({policy,metrics,memory:universalOperationalStates??states})),temporal:(temporal??[]).map(({policy,metrics,states})=>({policy,metrics,memory:states}))}))};

export const documents=[
  {slug:'manuscript',title:'Outcome-only control of lattice adsorption',category:'Main paper',file:'stage5/paper/FINAL_MANUSCRIPT.md',summary:'Operational memory, exact temporal comparisons and the remaining capability question.'},
  {slug:'theorems',title:'Capability theorems & proofs',category:'Exact theory',file:'stage5/docs/FINAL_CAPABILITY_THEOREMS.md',summary:'Properness, the periodic dominance theorem, density limits and word-law approximation.'},
  {slug:'certification',title:'Global support certification',category:'Certification',file:'stage5/docs/GLOBAL_CERTIFICATION.md',summary:'Full probability simplexes, rational suffix bounds, directed arithmetic and residual intervals.'},
  {slug:'model',title:'The adsorption model',category:'Methods',file:'docs/MODEL.md',summary:'Geometry, proposal sampling, controller observations and the stopping rule.'},
  {slug:'classification',title:'Controller classification',category:'Methods',file:'docs/THEORY.md',summary:'Behavioral classes and admissibility under outcome-only control.'},
  {slug:'protocol',title:'Statistical protocol',category:'Methods',file:'docs/STATISTICAL_PROTOCOL.md',summary:'Locked comparisons, uncertainty and independent random streams.'},
  {slug:'simulation-review',title:'Simulator verification',category:'Methods',file:'docs/SIMULATOR_REVIEW.md',summary:'Independent checks and the distinction between jam and controller deadlock.'},
  {slug:'feedback',title:'Stochastic feedback experiments',category:'Empirical record',file:'stage2/paper/paper.md',summary:'Archived finite-size comparisons, orientation persistence and singular exploration.'},
  {slug:'finite-state',title:'Finite-state control & singular kinetics',category:'Empirical record',file:'stage3/paper/paper.md',summary:'Larger deterministic catalogues and finite-size evidence; not a thermodynamic theorem.'},
  {slug:'physical-memory',title:'Physical operational memory',category:'Exact theory',file:'stage4/docs/OPERATIONAL_THEORY.md',summary:'Forced first success, observable trace laws and genuine randomized memory lower bounds.'},
  {slug:'temporal-null',title:'The stochastic temporal family',category:'Exact theory',file:'stage4/docs/STOCHASTIC_NULL.md',summary:'Edge-emitting hidden Markov controllers and equivalence of word laws.'},
  {slug:'prefix-bounds',title:'Temporal prefix envelopes',category:'Certification',file:'stage4/docs/ENVELOPE_CERTIFICATION.md',summary:'Exact anchor propagation and full-information suffix supersolutions.'},
  {slug:'rare-events',title:'Rare-event kinetics & estimation',category:'Supplement',file:'stage5/paper/RARE_EVENT_SUPPLEMENT.md',summary:'Archived singular tails, positive forests, higher moments and splitting.'},
  {slug:'higher-moments',title:'Positive forests & higher moments',category:'Supplement',file:'stage4/docs/HIGHER_MOMENTS.md',summary:'Classical forest representations and model-specific pole valuations.'},
  {slug:'splitting',title:'Unknown-entry splitting',category:'Supplement',file:'stage4/docs/UNKNOWN_ENTRY.md',summary:'Ideal oracle unbiasedness, variance, cost and the limits of the archived benchmark.'},
  {slug:'review',title:'Adversarial final review',category:'Research integrity',file:'stage5/FINAL_REVIEW.md',summary:'Objections, evidence, resolutions and retained limitations.'},
  {slug:'literature',title:'Literature & attribution',category:'Research integrity',file:'stage5/docs/FINAL_LITERATURE.md',summary:'Primary references, close prior art and access limitations.'},
  {slug:'reproduction',title:'Reconstruction & verification',category:'Research integrity',file:'stage5/docs/REPRODUCTION.md',summary:'What actually ran, what was copied, and what was not independently replicated.'},
  {slug:'foundations-paper',title:'Deterministic outcome-only control',category:'Empirical record',file:'paper/paper.md',summary:'The archived controller atlas, finite-size results and negative findings.'},
  {slug:'operational-paper',title:'Stochastic nulls & physical realization',category:'Exact theory',file:'stage4/paper/paper.md',summary:'The complete temporal representation, exact physical laws and certified outer bounds.'},
];
export const codes=[
  {slug:'temporal',title:'Joint action / state kernels',file:'stage4/src/temporal.mjs',description:'The full edge-emitting HMM, with the same outcome-blind matrices on success and failure.'},
  {slug:'exact',title:'Rational adsorption solver',file:'src/exact.mjs',description:'Uniform-anchor multiplicities, exact finite fractions and complete terminal laws.'},
  {slug:'word',title:'Adaptive word bound',file:'stage5/src/word-bound.mjs',description:'Integer prefix propagation, actual stopping-time rewards and certified suffix values.'},
  {slug:'simplex',title:'Continuous simplex bound',file:'stage5/src/parameter-bound.mjs',description:'A box relaxation over every joint probability row, including singular faces.'},
  {slug:'verify',title:'Independent certificate checks',file:'stage5/src/verify-certificates.mjs',description:'Raw-anchor reconstruction and rational inequalities; independence differs by certificate type.'},
  {slug:'forests',title:'Phase-type kinetics',file:'stage3/src/phase-type.mjs',description:'Finite killed-chain calculations behind the separate rare-event supplement.'},
];
export const gallery=[
  ['stage2/figures/final/landscape-landscape-L64-k4-periodic.png','Orientation response landscape','Archived finite-size empirical','Success/failure flip probability landscape. Colour is an empirical objective, not an exact capability theorem.'],
  ['stage2/figures/final/landscape-landscape-L64-k8-periodic.png','Long-rod response landscape','Archived finite-size empirical','The corresponding k=8 landscape and its orientation/cost trade-offs.'],
  ['figures/snapshots-k4.png','Adsorption microstructure','Archived realization','Spatial snapshots from the retained adsorption study. A snapshot is not an ensemble mean.'],
  ['stage3/figures/singular-graphs.png','Singular excursion networks','Methodological','Finite-kernel topology and rare excursions; distinct from an RSA performance claim.'],
  ['stage3/figures/coarse-landscape.png','Finite-state landscape','Archived finite-size empirical','Frozen deterministic controller comparisons and their uncertainty.'],
  ['stage4/figures/01-operational-memory.png','Physical memory activation','Structural / exact','Source-state count, observable memory and the geometry-dependent lower bound.'],
  ['stage4/figures/02-feasible-capabilities.png','Feasible objective cloud','Exact finite system','Feasible points from exact rational laws. This cloud is not the complete stochastic frontier.'],
  ['stage4/figures/04-higher-moment-orders.png','Higher-moment structure','Methodological','Pole orders and leading terms in the archived finite-kernel calculation.'],
  ['stage2/figures/final/accepted-run-lengths-landscape-L64-k4-periodic.png','Accepted-run fingerprints','Archived finite-size empirical','Distributions of accepted orientation runs from the retained trajectories.'],
  ['figures/atlas-deadlock.png','Deadlock atlas','Archived finite-size empirical','Geometric jam and controller-induced deadlock are different stopping events.'],
  ['stage5/figures/01-periodic-support-negative.png','The exact dominance witness','Exact finite system','A dominated convex-hull witness closes every nonnegative support direction for deterministic one-bit feedback.'],
  ['stage5/figures/02-certified-remaining-intervals.png','Remaining certified uncertainty','Exact finite system','Open joint intervals cross zero. Their width is a limitation, not evidence of equality.'],
  ['stage5/figures/03-density-supremum.png','Density limit: 8/9','Exact finite system','Analytic coupling bounds and the parity ceiling. Open finite attainment is not asserted.'],
  ['stage3/figures/memory-frontiers.png','Memory & finite-size trade-offs','Archived finite-size empirical','Measured comparisons across the archived finite-state study.'],
  ['stage4/figures/05-unknown-entry-splitting.png','Unknown-entry estimation','Methodological','Archived oracle splitting benchmark; no real-RSA excursion demonstration was added.'],
  ['figures/outcome-conditioned-switching.png','Outcome-conditioned dynamics','Archived finite-size empirical','Observed switching differs from unconditional proposal matching.'],
].map(([file,title,kind,caption],index)=>({file,title,kind,caption,index,src:'/research/files/'+file}));

const escape=text=>String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function renderDocument(doc){
  const renderer=new Renderer();
  renderer.html=({text})=>escape(text);
  renderer.link=function({href,text,tokens}){
    let url=href;
    if(/^(https?:|#)/.test(href))return `<a href="${escape(href)}" ${href.startsWith('http')?'target="_blank" rel="noopener noreferrer"':''}>${this.parser.parseInline(tokens)}</a>`;
    const relative=path.relative(researchRoot,path.resolve(path.dirname(path.join(researchRoot,doc.file)),href.split('#')[0])).replaceAll('\\','/');
    const destination=documents.find(d=>d.file===relative),code=codes.find(d=>d.file===relative);
    if(destination)url='/research/read/'+destination.slug+'/';
    else if(code)url='/research/code/'+code.slug+'/';
    else if(!relative.startsWith('..')&&fs.existsSync(path.join(publicRoot,'files',relative)))url='/research/files/'+relative;
    else url='/research/library/#downloads';
    return `<a href="${escape(url)}">${this.parser.parseInline(tokens)}</a>`;
  };
  renderer.image=({href,text})=>{
    const relative=path.relative(researchRoot,path.resolve(path.dirname(path.join(researchRoot,doc.file)),href)).replaceAll('\\','/');
    if(relative.startsWith('..'))return '';
    return `<figure class="paper-figure"><img loading="lazy" src="/research/files/${escape(relative)}" alt="${escape(text)}"/><figcaption>${escape(text)}</figcaption></figure>`;
  };
  renderer.heading=function({tokens,depth}){return `<h${depth} id="${tokens.map(t=>t.text??'').join('').toLowerCase().replace(/[^a-z0-9]+/g,'-')}">${this.parser.parseInline(tokens)}</h${depth}>`;};
  return marked.parse(fs.readFileSync(path.join(researchRoot,doc.file),'utf8'),{renderer});
}
export const readCode=code=>fs.readFileSync(path.join(researchRoot,code.file),'utf8');

function tarHeader(name,size){
  const buffer=Buffer.alloc(512);if(Buffer.byteLength(name)>100){const slash=name.lastIndexOf('/'),prefix=name.slice(0,slash);name=name.slice(slash+1);if(Buffer.byteLength(prefix)>155||Buffer.byteLength(name)>100)throw Error('Archive path exceeds USTAR limit');buffer.write(prefix,345,155);}
  buffer.write(name,0,100);buffer.write('0000644\0',100,8);buffer.write('0000000\0',108,8);buffer.write('0000000\0',116,8);
  buffer.write(size.toString(8).padStart(11,'0')+'\0',124,12);buffer.write('00000000000\0',136,12);
  buffer.fill(32,148,156);buffer.write('0',156);buffer.write('ustar\0',257);buffer.write('00',263);
  const checksum=buffer.reduce((sum,b)=>sum+b,0);buffer.write(checksum.toString(8).padStart(6,'0')+'\0 ',148,8);return buffer;
}
async function* tarFiles(files){for(const file of files){const source=path.join(researchRoot,file),size=fs.statSync(source).size;
  yield tarHeader(file,size);for await(const chunk of fs.createReadStream(source,{highWaterMark:64*1024}))yield chunk;
  if(size%512)yield Buffer.alloc(512-size%512);
}yield Buffer.alloc(1024);}

export const archives=[
  {id:'source',title:'Source, protocols & notebooks',description:'All retained source modules, tests, protocols, reviews and papers.'},
  {id:'raw',title:'Raw empirical records',description:'Archived main-run records, trajectories and finite-kernel samples. No old main experiment was rerun.'},
  {id:'evidence',title:'Exact laws & processed evidence',description:'Full certificates, rational laws, analysis outputs, manifests and historical processed records.'},
  {id:'figures',title:'Original figure collection',description:'All retained scientific figures. Historical PDF artifacts are preserved; no new PDF was generated.'},
];
let preparing;
export function prepareResearch(){return preparing??=prepare();}
async function prepare(){
  fs.mkdirSync(path.join(publicRoot,'files'),{recursive:true});fs.mkdirSync(path.join(publicRoot,'downloads'),{recursive:true});
  let entries=[];const seals=[];
  for(const prefix of ['','stage2','stage3','stage4','stage5']){
    const file=[prefix,'results/research-manifest.json'].filter(Boolean).join('/'),bytes=fs.readFileSync(path.join(researchRoot,file));
    const seal=JSON.parse(bytes);seals.push({file,sha256:digest(bytes)});
    for(const [relative,info] of Object.entries(seal.sourceAndArtifactFiles))entries.push({file:[prefix,relative].filter(Boolean).join('/'),...info});
    entries.push({file,bytes:bytes.length,sha256:digest(bytes)});
  }
  const publication=JSON.parse(fs.readFileSync(path.join(workspaceRoot,'config/research-publication.json'),'utf8'));
  entries=publicationEntries(researchRoot,entries,publication);
  const fingerprint=digest(JSON.stringify({seals,publication}));
  const cacheFile=path.join(publicRoot,'asset-manifest.json');
  if(fs.existsSync(cacheFile)){
    const cached=JSON.parse(fs.readFileSync(cacheFile));
    if(cached.fingerprint===fingerprint&&cached.archives.every(row=>fs.existsSync(path.join(publicRoot,row.url.replace('/research/','')))))return cached;
  }
  const copy=new Set([...documents.map(d=>d.file),...codes.map(d=>d.file),...gallery.map(g=>g.file),...seals.map(s=>s.file),
    'stage5/results/certificate-verification.json','stage5/results/periodic-negative.json','stage5/results/FINAL_EVIDENCE_MANIFEST.json',
    'stage5/results/acceptance-audit.json','stage5/results/clean-reconstruction.json','stage5/results/density-limit.json']);
  // Preserve original figure bytes and linked supplementary text. Large evidence
  // remains in downloadable archives rather than in the initial page payload.
  for(const entry of entries)if(/\.(png|svg)$/.test(entry.file)&&entry.file.includes('figures/'))copy.add(entry.file);
  for(const file of copy){const destination=path.join(publicRoot,'files',file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.join(researchRoot,file),destination);}
  const groups={source:[],raw:[],evidence:[],figures:[]};
  for(const entry of entries){let group=entry.file.includes('figures/')?'figures':
    /(?:^|\/)data\/(raw|trajectories|rare-event)\//.test(entry.file)||/\.(csv|csv.gz)$/.test(entry.file)?'raw':
    /(?:^|\/)(data|results)\//.test(entry.file)?'evidence':'source';groups[group].push(entry.file);}
  const packages=[];
  for(const item of archives){const target=path.join(publicRoot,`downloads/${item.id}.tar.gz`);
    await pipeline(Readable.from(tarFiles(groups[item.id])),createGzip({level:6}),fs.createWriteStream(target));
    const bytes=fs.readFileSync(target);packages.push({...item,url:`/research/downloads/${item.id}.tar.gz`,files:groups[item.id].length,bytes:bytes.length,sha256:digest(bytes)});
  }
  const artifactIndex={schemaVersion:1,fingerprint,seals,totalFiles:entries.length,totalBytes:entries.reduce((sum,row)=>sum+row.bytes,0),
    source:'Frozen research artifacts, copied for publication without modifying scientific sources.',
    publication,archives:packages,files:entries,scope:'Presentation only. Browser simulations are demonstrations, not new research or proof. Original seals include the explicitly omitted paper PDF; this publication is a declared subset.'};
  fs.writeFileSync(cacheFile,JSON.stringify(artifactIndex,null,2)+'\n');
  return artifactIndex;
}
