import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { stageRoot,projectRoot,hash,verifyPreservation } from './preservation.mjs';
import { rational,Fraction,ZERO,ONE,sum } from '../src/rational.mjs';
const read=file=>JSON.parse(fs.readFileSync(path.join(stageRoot,file)));
const output=path.join(stageRoot,'results/acceptance-audit.json');
if(fs.existsSync(output))throw new Error('Refuse acceptance audit overwrite');
const before=read('results/preservation-before.json'),preservation=verifyPreservation();
assert.equal(preservation.groups.length,4,'Website baseline is required for current acceptance');
assert.deepEqual(preservation.groups,before.groups);
const ledgers=Object.fromEntries(Object.entries(before.ledgers).map(([file,expected])=>{
  const actual=hash(fs.readFileSync(path.join(projectRoot,file)));assert.equal(actual,expected,file);return [file,actual];}));
const requirements=JSON.parse(fs.readFileSync(path.join(projectRoot,'docs/requirements.json')));
assert.deepEqual(requirements.counts,{A:381,B:351,numbered:732});assert.equal(requirements.requirements.length,732);
const cap=read('results/capability-search.json'),memory=read('results/memory-matching-audit.json');
const files=[],cached=[];
for(const outcome of cap.outcomes){assert.equal(outcome.feedback.length,192);
  for(const point of [...outcome.feedback,...outcome.temporal]){
    assert.equal(hash(fs.readFileSync(path.join(stageRoot,point.evidenceFile))),point.evidenceSha256,point.evidenceFile);
    (point.reusedFrozenStageIII?cached:files).push(point.evidenceFile);
  }
}
assert.equal(cached.length,34);assert.equal(files.filter(x=>x.includes('/feedback-')).length,350);
assert.equal(files.filter(x=>x.includes('/temporal-')).length,24);
files.push('data/refined-temporal-periodic.json','data/refined-temporal-open.json','results/proper-boundary-null.json');
assert.equal(files.length,377);assert.equal(new Set(files).size,377);
const Q=x=>rational(`${x.numerator}/${x.denominator}`),exact=[];
const popcount=n=>{let count=0;while(n){count+=n&1;n>>>=1;}return count;};
for(const file of files){
  const result=read(file);assert(result.states<=4);assert(Array.isArray(result.law)&&result.law.length>0);
  const totals=[ZERO,ZERO,ZERO,ZERO];
  for(const row of result.law){
    const [mask,h]=row.key.split(':').map(Number),n=popcount(mask)/result.parameters.k,p=Q(row.probability);
    assert(Number.isInteger(n)&&n>0);assert(p.n>0n);assert(h>=0&&h<=n);
    totals[0]=totals[0].add(p);
    totals[1]=totals[1].add(p.mul(new Fraction(BigInt(result.parameters.k*n),BigInt(result.parameters.L**2))));
    totals[2]=totals[2].add(p.mul(new Fraction(BigInt(Math.abs(2*h-n)),BigInt(n))));
    totals[3]=totals[3].add(Q(row.attemptFirstMomentMass).div(new Fraction(BigInt(n))));
  }
  assert(totals[0].eq(ONE),`${file}: normalization`);
  ['coverage','absOrder','attemptsPerParticle'].forEach((name,i)=>assert(totals[i+1].eq(Q(result.metrics[name])),`${file}: ${name}`));
  exact.push({file,sha256:hash(fs.readFileSync(path.join(stageRoot,file))),terminalAtoms:result.law.length});
}
const envelopes=[];
for(const name of ['temporal-envelope.json','temporal-envelope-informed.json']){
  const study=read(`results/${name}`);
  for(const cert of study.certificates){
    assert.equal(hash(fs.readFileSync(path.join(stageRoot,cert.file))),cert.sha256);
    const raw=read(cert.file);assert.equal(raw.bounds.length,15);assert.equal(cert.independentBigIntMaximizingPrefixReplays,15);
    for(const T of [4,8,12]){
      assert.equal(raw.leaves[T].length,2**(T-1));assert.equal(new Set(raw.leaves[T].map(x=>x.word)).size,2**(T-1));
      for(const leaf of raw.leaves[T])assert(leaf.word.length===T&&leaf.word[0]==='0');
      raw.bounds.filter(x=>x.horizon===T).forEach((bound,j)=>{
        const maximum=raw.leaves[T].reduce((a,row)=>BigInt(row.numerators[j])>a?BigInt(row.numerators[j]):a,BigInt(raw.leaves[T][0].numerators[j]));
        assert.equal(maximum.toString(),bound.rawMaxNumerator);
        assert(new Fraction(maximum,BigInt(bound.integerDenominator)).eq(Q(bound.supportUpper)));
      });
    }
    envelopes.push({file:cert.file,sha256:cert.sha256,bounds:15,rawPrefixMaximaChecked:15});
  }
}
assert.deepEqual(memory.outcomes.map(x=>x.universallyLivePoolDominated),[127,86]);
assert.deepEqual(memory.outcomes.map(x=>x.fixedProperPoolDominated),[128,86]);
for(const outcome of memory.outcomes)for(const row of outcome.rows){
  assert(row.randomizedFeedbackStateLowerBound<=row.randomizedFeedbackStateUpperBound);
  if(row.randomizedFeedbackMinimumKnown)assert.equal(row.randomizedFeedbackStateLowerBound,row.randomizedFeedbackStateUpperBound);
}
assert.equal(read('results/operational-survey.json').universalOperationalClasses,22077);
assert.deepEqual(read('results/activation-randomized-lower-bound.json').minimalOperationalStates,{L2:2,L3:3,randomizedFeedbackAllowed:true});
assert.equal(read('results/bellman-audit.json').scalarEquations,3384);
for(const checked of read('results/bellman-audit.json').checked)assert.equal(hash(fs.readFileSync(path.join(stageRoot,checked.file))),checked.sha256);
const moment=read('results/higher-moments.json');assert.equal(moment.checkedLeadingTerms,36);assert.equal(moment.newGraphMethodDeterminantCalls,0);
const splitting=read('results/unknown-entry-splitting.json');assert.equal(splitting.batches,128);assert.equal(splitting.retainedConditionalDwells,64019);
for(const item of splitting.evidence)assert.equal(hash(fs.readFileSync(path.join(stageRoot,item.file))),item.sha256);
assert.equal(read('results/temporal-refinement.json').results.reduce((n,x)=>n+x.evaluations,0),5176);
assert.deepEqual(read('results/hmm-structure.json').examples.map(x=>x.hankelRank),[2,3,4,1]);
const quick=read('results/clean-reconstruction.json');assert.equal(quick.status,'passed');assert.equal(quick.changedInputs.length,0);
for(const [file,expected] of Object.entries(quick.copiedInputHashes))assert.equal(hash(fs.readFileSync(path.join(stageRoot,'..',file))),expected,`quick input ${file}`);
const tests=fs.readFileSync(path.join(stageRoot,'results/unit-tests-acceptance.txt'),'utf8');
assert(/tests\s+24/.test(tests)&&/pass\s+24/.test(tests)&&/fail\s+0/.test(tests));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);
const all=walk(stageRoot),brokenLinks=[],machinePaths=[];
assert(!all.some(file=>/\.pdf$/i.test(file)),'No PDF');
for(const file of all){
  if(/\.(mjs|py)$/.test(file)){
    const content=fs.readFileSync(file,'utf8');if(/[A-Za-z]:[\\/]/.test(content))machinePaths.push(path.relative(stageRoot,file));
  }
  if(file.endsWith('.md'))for(const match of fs.readFileSync(file,'utf8').matchAll(/\]\(([^)]+)\)/g)){
    const link=match[1];if(/^(https?:|#)/.test(link))continue;
    const target=path.resolve(path.dirname(file),link.split('#')[0]);
    if(!fs.existsSync(target)&&!['acceptance-audit.json','research-manifest.json'].includes(path.basename(target)))brokenLinks.push({file:path.relative(stageRoot,file),link});
  }
}
assert.deepEqual(machinePaths,[]);assert.deepEqual(brokenLinks,[]);
const report={schemaVersion:1,verifiedAtUTC:new Date().toISOString(),status:'passed',preservation,ledgers,
  originalRequirementsUnchanged:732,newExactCases:377,reusedOldExactCases:34,exactCaseAudits:exact,
  exactLawCheckScope:'All new terminal masses and density/order/cost weighted rewards; not an independent full dynamic-program rerun of every case.',
  envelopeCertificateAudits:envelopes,rawPrefixMaximaChecked:60,independentRecordedMaximizingPrefixReplays:60,
  randomizedMemoryAudit:'Conservative lower-bound matching, general randomized minimization unresolved',
  universalLiveFeasibleDominations:[127,86],fixedProperFeasibleDominations:[128,86],
  bellmanScalarEquations:3384,higherMomentLeadingTerms:36,unknownEntryBatches:128,retainedConditionalDwells:64019,
  currentTests:{tests:24,passed:24,failed:0,report:'results/unit-tests-acceptance.txt',format:'Node human-readable reporter'},
  cleanSourceQuick:'results/clean-reconstruction.json',figures:{groups:5,formats:['png','svg'],visuallyInspected:true},
  documentationAudit:{brokenLinks,machinePathsInScientificCode:machinePaths,pdfGenerated:false},
  unresolved:'Complete same-operational-memory joint stochastic temporal frontier; general positive randomized feedback minimum; real RSA splitting level design.',
  websiteIntegrated:false,oldStagesRerun:false,fullNewWorkflowRerunClaimed:false};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,frozenFiles:preservation.groups.map(x=>x.files),exactCases:377,checkedPrefixMaxima:60,currentTests:24}));
