import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { hash, stageRoot, researchRoot, verifyPreservation } from './preservation.mjs';

const manifestFile = path.join(stageRoot, 'results/research-manifest.json');
const acceptanceFile = path.join(stageRoot, 'results/acceptance.json');
if (fs.existsSync(manifestFile) || fs.existsSync(acceptanceFile)) {
  throw new Error('Stage III is already sealed. This command does not replace existing seals.');
}
const read = relative => JSON.parse(fs.readFileSync(path.join(stageRoot, relative), 'utf8'));
const checkHash = (root, relative, expected) => {
  assert.equal(hash(fs.readFileSync(path.resolve(root, relative))), expected, relative);
};
const preservation = verifyPreservation();
assert.deepEqual(preservation.groups.map(group => [group.name, group.files]),
  [['Stage I', 165], ['Stage II', 368], ['Website frozen9', 52]]);

const classification = read('data/classification/summary.json');
checkHash(stageRoot, 'src/controllers.mjs', classification.controllerSourceSha256);
for (const item of classification.artifacts) {
  checkHash(stageRoot, `data/classification/${item.file}`, item.sha256);
}
const budgets = [1, 2, 3, 4].map(states => {
  const feedback = classification.catalogues.find(item => item.stateCount === states && !item.temporal);
  const temporal = classification.catalogues.find(item => item.stateCount === states && item.temporal);
  return { states, feedback: { labelled: feedback.labelledCount, classes: feedback.classCount,
    universallyLive: feedback.universalLiveClassCount },
  temporal: { labelled: temporal.labelledCount, classes: temporal.classCount,
    universallyLive: temporal.universalLiveClassCount } };
});
assert.equal(budgets[3].feedback.classes, 28534);
assert.equal(budgets[3].feedback.universallyLive, 8730);
assert.equal(budgets[3].temporal.classes, 24);
assert.equal(budgets[3].temporal.universallyLive, 16);

const lock = read('experiments/confirmation.lock.json');
for (const [file, sha256] of Object.entries(lock.sourceSeal)) checkHash(researchRoot, file, sha256);
for (const [file, sha256] of Object.entries(lock.analysisSeal)) checkHash(stageRoot, file, sha256);
checkHash(stageRoot, 'experiments/search-protocol.json', lock.protocolSha256);
checkHash(stageRoot, 'results/middle-groups.json', lock.selectionSourceSha256);
const rawAudit = read('results/raw-audit.json');
for (const item of rawAudit.records) {
  const plan = item.name === 'confirmation' ? 'confirmation.lock.json' : `${item.name}.plan.json`;
  checkHash(stageRoot, `experiments/${plan}`, item.planSha256);
  checkHash(stageRoot, `data/raw/${item.name}.csv`, item.rawSha256);
}
assert.equal(rawAudit.mainTerminalRuns, 284040);
assert.deepEqual(rawAudit.records.map(item => item.runs), [209928, 38784, 35328]);
const confirmation = read('results/confirmation-analysis.json');
checkHash(stageRoot, 'experiments/confirmation.lock.json', confirmation.lockedFileSha256);
checkHash(stageRoot, 'data/raw/confirmation.csv', confirmation.rawSha256);
const independent = read('results/evidence/statistical-audit.json');
assert.equal(independent.status, 'passed');
assert.equal(independent.tests, confirmation.tests.length);
assert.equal(independent.rejections, confirmation.rejections);
assert.equal(independent.marginQualifiedJointPairs, confirmation.jointPairs.length);
assert.equal(confirmation.tests.length, lock.testFamilySize);
assert.equal(confirmation.twoBitBenefitEstablished, false);
assert.equal(confirmation.oneBitBenefitEstablished, false);
checkHash(stageRoot, 'results/evidence/read-only-statistical-audit.mjs', independent.auditSourceSha256);

const exact = read('results/exact-survey.json');
for (const [file, sha256] of Object.entries(exact.sourceSeal)) checkHash(stageRoot, file, sha256);
for (const item of exact.cases) checkHash(stageRoot, item.file, item.sha256);
assert.equal(exact.exactCaseCount, exact.cases.length);
assert.equal(exact.distinctControllerCount, new Set(exact.cases.map(item => item.controller)).size);
const theory = read('data/theory/phase-type.json');
checkHash(stageRoot, 'src/phase-type.mjs', theory.sourceSha256);
const rare = read('data/rare-event/manifest.json');
const rareSummary = read('data/rare-event/summary.json');
for (const item of rare.files) checkHash(stageRoot, `data/rare-event/${item.name}`, item.sha256);
for (const item of rare.sources) {
  // Recorded absolute paths are provenance; resolving the source uses the current checkout.
  const marker = '/research/finite-memory-rsa/';
  const recorded = item.path.replaceAll('\\', '/');
  const position = recorded.indexOf(marker);
  assert.notEqual(position, -1, item.path);
  checkHash(researchRoot, recorded.slice(position + marker.length), item.sha256);
}
assert.equal(rare.sourceHashesUnchanged, true);
assert.equal(rare.draws, rareSummary.draws);
assert.equal(rare.batchReplicates, rareSummary.batchReplicates);

const unit = read('results/unit-summary.json');
assert.equal(unit.exitCode, 0);
assert.equal(unit.tests, 32);
assert.equal(unit.passed, 32);
assert.equal(unit.failed, 0);
const clean = read('results/clean-reconstruction.json');
assert.equal(clean.status, 'passed');
assert.equal(clean.profile, 'quick');
assert.equal(clean.fullStudyIndependentlyRerun, false);
assert.equal(clean.copiedSourceHashesUnchanged, true);
for (const item of clean.copiedFiles) checkHash(researchRoot, item.file, item.sha256);
const synthesis = read('results/synthesis.json');
const constrainedCells = synthesis.results.reduce((sum, item) => sum + item.solutions.length, 0);

function listFiles(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))
    .flatMap(entry => {
      assert.equal(entry.isSymbolicLink(), false, `Unexpected symlink: ${entry.name}`);
      const relative = prefix + entry.name;
      return entry.isDirectory() ? listFiles(path.join(directory, entry.name), `${relative}/`) : [relative];
    });
}
const existingFiles = listFiles(stageRoot);
assert.equal(existingFiles.filter(file => /\.pdf$/i.test(file)).length, 0);
const pngFigures = existingFiles.filter(file => file.startsWith('figures/') && file.endsWith('.png'));
const svgFigures = existingFiles.filter(file => file.startsWith('figures/') && file.endsWith('.svg'));
assert.equal(pngFigures.length, 6);
assert.deepEqual(svgFigures.map(file => file.slice(0, -4)), pngFigures.map(file => file.slice(0, -4)));
const linkExceptions = new Set(['results/research-manifest.json', 'results/acceptance.json']);
let localMarkdownLinks = 0;
for (const file of existingFiles.filter(item => item.endsWith('.md'))) {
  const text = fs.readFileSync(path.join(stageRoot, file), 'utf8');
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split(/\s+"/)[0].replace(/^<|>$/g, '');
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) continue;
    const destination = path.resolve(stageRoot, path.dirname(file), decodeURIComponent(target.split('#')[0]));
    const relative = path.relative(stageRoot, destination).replaceAll('\\', '/');
    assert(fs.existsSync(destination) || linkExceptions.has(relative), `${file}: ${target}`);
    localMarkdownLinks++;
  }
}
const paperBytes = fs.readFileSync(path.join(stageRoot, 'paper/paper.md'));
const paperWords = paperBytes.toString('utf8').trim().split(/\s+/).length;
const acceptance = {
  schemaVersion: 1, acceptedAtUTC: new Date().toISOString(), status: 'completed-with-stated-limits',
  scope: 'Stage III serious research only; no website integration or website phase nine',
  structuralEnumerationComplete: true, mainTerminalRuns: rawAudit.mainTerminalRuns,
  exactCases: exact.exactCaseCount, rareEventDraws: rare.draws,
  fullMatchedMemoryJointBenefitEstablished: confirmation.twoBitBenefitEstablished,
  integratedTests: { passed: unit.passed, total: unit.tests },
  cleanSourceReconstruction: { profile: clean.profile, status: clean.status,
    fullStudyIndependentlyRerun: clean.fullStudyIndependentlyRerun },
  originalStagesAndWebsitePreserved: true, localMarkdownLinksChecked: localMarkdownLinks,
  pdfGenerated: false, nextPhaseAuthorized: false,
  evidence: ['results/raw-audit.json', 'results/evidence/statistical-audit.json',
    'results/clean-reconstruction.json', 'results/unit-summary.json', 'docs/REQUIREMENTS_COVERAGE.md']
};
fs.writeFileSync(acceptanceFile, JSON.stringify(acceptance, null, 2) + '\n');
const sourceAndArtifactFiles = Object.fromEntries(listFiles(stageRoot)
  .filter(file => file !== 'results/research-manifest.json')
  .map(file => { const bytes = fs.readFileSync(path.join(stageRoot, file));
    return [file, { bytes: bytes.length, sha256: hash(bytes) }]; }));
const manifest = {
  schemaVersion: 1, sealedAtUTC: new Date().toISOString(),
  scope: 'Outcome-limited finite-memory RSA Stage III; exact structure and finite-system results, qualified holdout, singular-kernel theory and rare-event measurement',
  classification: { budgets, equivalence: 'Abstract rooted Moore behavior modulo global H/V, not equality of RSA process laws' },
  mainTerminalRuns: rawAudit.mainTerminalRuns, rawGroups: rawAudit.records,
  exactControllerSystemCases: exact.exactCaseCount, exactDistinctControllers: exact.distinctControllerCount,
  constrainedEmpiricalOptimizationCells: constrainedCells,
  singularModels: theory.models.length,
  rareEvent: { models: rareSummary.results.length, methods: ['naive', 'conditional Monte Carlo'],
    draws: rare.draws, batchReplicates: rare.batchReplicates,
    countedAsMainRSARuns: false, idealModelAndFinitePrecisionLimitsDisclosed: true },
  holdout: { tests: confirmation.tests.length, rejections: confirmation.rejections,
    marginQualifiedJointPairs: confirmation.jointPairs.length, absoluteImbalanceMargin: lock.absMargin,
    costMultiplier: lock.costMultiplier, oneBitEveryNullGate: confirmation.oneBitBenefitEstablished,
    twoBitEveryNullGate: confirmation.twoBitBenefitEstablished,
    strictParetoDominanceClaimedFromMarginTests: false, newL256PlusRuns: 0 },
  integratedUnitTests: unit, preservation,
  independentStatisticalAudit: { file: 'results/evidence/statistical-audit.json',
    sha256: hash(fs.readFileSync(path.join(stageRoot, 'results/evidence/statistical-audit.json'))),
    status: independent.status, zeroSeTests: independent.zeroSeTests },
  cleanReconstruction: { file: 'results/clean-reconstruction.json', profile: clean.profile,
    status: clean.status, runtime: clean.runtime, copiedFiles: clean.copiedFiles.length,
    replayedRows: clean.quick.replayedRows, exactCases: clean.quick.exactCases,
    singularModels: clean.quick.singularModels,
    independentRationalFormulaChecks: clean.quick.independentRationalFormulaChecks,
    fullStudyIndependentlyRerun: false, publicWebsiteCleanCloneAuditPerformed: false },
  figureSets: { count: pngFigures.length, formats: ['PNG', 'SVG'], pdfGenerated: false },
  paper: { file: 'paper/paper.md', bytes: paperBytes.length, whitespaceWords: paperWords,
    sha256: hash(paperBytes), format: 'Markdown', pdfGenerated: false },
  localMarkdownLinksChecked: localMarkdownLinks,
  sourceAndArtifactFileCount: Object.keys(sourceAndArtifactFiles).length, sourceAndArtifactFiles,
  limitations: [
    'L16 structural-class survey is complete, but noisy finite-system means do not establish a global large-L optimum.',
    'Middle-fidelity k8 selection excluded fifty survivors under the recorded cap; only twelve feedback arms enter the holdout.',
    'Every-null gate failure does not prove no frontier extension, no useful feedback, or a thermodynamic impossibility.',
    'Paired t inference and its simultaneous intervals use finite-variance approximations, not finite-sample tail guarantees.',
    'Frozen analysis has generic/hardcoded-input caveats; the independent validator guards the actually observed design. No locked-source repair was made.',
    'One-bit tiny-system tradeoff is exact, but is not a universal density improvement or strict dominance over every null.',
    'Fixed-geometry rational-polynomial singular theory and ideal rare-entry estimators have explicitly stated assumptions.',
    'Full reconstruction, stochastic two-bit optimization, three-bit brute force, thermodynamic bounds and optional multi-action extension were not performed.',
    'No website integration, public release portability audit, new PDF or next-phase work was performed.'
  ]
};
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ status: 'sealed', sourceAndArtifactFiles: manifest.sourceAndArtifactFileCount,
  mainTerminalRuns: manifest.mainTerminalRuns, exactCases: manifest.exactControllerSystemCases,
  rareDraws: manifest.rareEvent.draws, testsPassed: unit.passed, cleanProfile: clean.profile,
  paperWords, localMarkdownLinks, manifestSha256: hash(fs.readFileSync(manifestFile)) }));
