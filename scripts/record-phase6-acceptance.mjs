// Acceptance only: this script inspects evidence and the current deployment. It never starts phase 7.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tools, phase5Tools, phase6Tools } from '../config/apps/portal/src/tool/data.mjs';
import { catalogue } from '../config/apps/portal/src/main1/catalogue.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const scope = process.env.OCV_E2E_SCOPE || 'phase6-delivery';
assert.match(scope, /^[a-z0-9-]+$/, 'Invalid report scope');
const runtime = process.env.OCV_DEPS_ROOT ? path.join(process.env.OCV_DEPS_ROOT, 'runtime/reports') : path.join(root, '.test-results');
const reports = path.join(runtime, scope);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const ref = name => `runtime/reports/${scope}/${name}`;
const browserRef = ref('phase6-playwright.json'), unitRef = 'runtime/reports/phase6-unit.json';
const previousState = read('docs/phase-state.json');
assert.equal(previousState.phase, 6, 'Only the currently authorized phase 6 may be accepted');
assert.ok(['in_progress', 'complete'].includes(previousState.status));
assert.equal(previousState.nextPhaseAuthorized, false);
assert.equal(previousState.previousAcceptance, 'docs/phase-5-acceptance.json');

function ledgerCheck() {
  const result = spawnSync(process.execPath, ['scripts/check-ledgers.mjs'], { encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'Ledger check failed');
  return result.stdout.trim();
}
const originalLedgerCheck = ledgerCheck(), ledger = read('docs/requirements.json');
const originalContent = value => JSON.stringify({
  sourceHash: value.sourceHash, promptSourceHash: value.promptSourceHash,
  numbered: value.requirements.map(({ id, text, sourceLine, source, phase }) => ({ id, text, sourceLine, source, phase })),
  unnumbered: value.unnumbered, stackCategories: value.stackCategories, promptParagraphs: value.promptParagraphs,
});
const immutable = originalContent(ledger);
const untouchedRequirements = ledger.requirements.filter(row => row.phase !== 6).map(row => [row.id, JSON.stringify(row)]);
const phaseItems = ledger.requirements.filter(row => row.phase === 6);
const previousPhase5Metadata = JSON.stringify(ledger.currentPhase5);
assert.equal(phaseItems.length, 19); assert.equal(phase6Tools.length, 19); assert.equal(phase5Tools.length, 35); assert.equal(tools.length, 54);
assert.equal(new Set(tools.map(tool => tool.id)).size, 54);
const ids = phase6Tools.flatMap(tool => tool.requirements);
assert.equal(ids.length, 19); assert.equal(new Set(ids).size, 19);
assert.deepEqual(ids.toSorted(), phaseItems.map(row => row.id).toSorted());
assert.ok(phase6Tools.every(tool => tool.phase === 6));

const suite = read(path.join(reports, 'phase6-playwright.json')), browserChecks = [];
assert.deepEqual(suite.errors || [], [], 'Global browser-run errors are not an accepted suite');
function visit(suites) {
  for (const item of suites || []) {
    for (const spec of item.specs || []) for (const check of spec.tests || []) {
      assert.equal(check.results.length, 1, 'Acceptance cannot combine retries: ' + spec.title);
      assert.equal(check.results[0].status, 'passed', spec.title + ' / ' + check.projectName);
      browserChecks.push({ title: spec.title, file: spec.file, project: check.projectName, status: check.results[0].status });
    }
    visit(item.suites);
  }
}
visit(suite.suites);
assert.equal(browserChecks.length, 212); assert.equal(suite.stats.expected, 212);
for (const key of ['unexpected', 'flaky', 'skipped']) assert.equal(suite.stats[key], 0, 'Incomplete browser report: ' + key);
const browserStart = Date.parse(suite.stats.startTime), browserEnd = browserStart + suite.stats.duration;
assert.ok(Number.isFinite(browserStart) && Number.isFinite(browserEnd) && suite.stats.duration > 0);
const authorization = Date.parse(previousState.activeWork?.authorizedAt || previousState.updatedAt);
assert.ok(Number.isFinite(authorization) && browserStart >= authorization - 1000, 'Browser proof predates phase authorization');
for (const project of ['desktop', 'mobile']) {
  assert.equal(browserChecks.filter(check => check.project === project).length, 106);
  for (const [file, count] of [['phase6-images.spec.mjs', 17], ['phase6-time.spec.mjs', 10], ['phase6-science.spec.mjs', 12]]) {
    assert.equal(browserChecks.filter(check => check.project === project && path.basename(check.file) === file).length, count, 'Incomplete phase 6 group: ' + file);
  }
}
assert.equal(browserChecks.filter(check => check.title.startsWith('Phase 6 ')).length, 78);
assert.equal(browserChecks.filter(check => check.title.startsWith('Phase 5 ')).length, 84);
assert.equal(browserChecks.filter(check => !/^Phase [56] /.test(check.title)).length, 50);

const unit = read(path.join(runtime, 'phase6-unit.json'));
assert.equal(unit.success, true); assert.equal(unit.numTotalTests, 90); assert.equal(unit.numPassedTests, 90);
assert.ok(Number.isFinite(unit.startTime));
for (const key of ['numFailedTests', 'numPendingTests', 'numTodoTests']) assert.equal(unit[key], 0);
assert.ok(unit.startTime >= authorization - 1000, 'Unit proof predates phase authorization');
const unitChecks = unit.testResults.flatMap(file => {
  assert.equal(file.status, 'passed', file.name);
  assert.match(file.name.replaceAll('\\', '/'), /\/tests\/phase(?:5-(?:calculation|development|text)|6-(?:images|science|time))\.test\.mjs$/);
  return file.assertionResults.map(check => {
    assert.equal(check.status, 'passed', check.fullName); assert.deepEqual(check.failureMessages, []);
    return { file: 'tests/' + path.basename(file.name), title: check.fullName, status: check.status };
  });
});
assert.equal(unit.testResults.length, 6); assert.equal(unitChecks.length, 90);
assert.equal(unitChecks.filter(check => check.file.startsWith('tests/phase5-')).length, 43);
assert.equal(unitChecks.filter(check => check.file.startsWith('tests/phase6-')).length, 47);

const modules = {
  images: 'config/apps/portal/src/img/img.mjs',
  time: 'config/apps/portal/src/time/model.mjs',
  science: 'config/apps/portal/src/δοκιμή/calc.mjs',
  files: 'config/apps/portal/src/file/pdf.mjs',
};
const imageIds = new Set(['image-crop', 'image-compress', 'image-convert', 'image-resize', 'image-color', 'text-image', 'qr-generate', 'qr-read']);
const timeIds = new Set(['countdown', 'stopwatch', 'pomodoro', 'todo']);
const groupFor = id => imageIds.has(id) ? 'images' : timeIds.has(id) ? 'time' : id === 'blank-pdf' ? 'files' : 'science';
const moduleFor = id => modules[groupFor(id)];
function collectFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = directory + '/' + entry.name;
    return entry.isDirectory() ? collectFiles(file) : [file];
  });
}
const phase5Directories = ['config/apps/portal/src/text', 'config/apps/portal/src/math1', 'config/apps/portal/src/net'];
const sources = [...new Set([
  ...Object.values(modules).flatMap(file => collectFiles(path.posix.dirname(file))),
  ...phase5Directories.flatMap(collectFiles), ...collectFiles('config/apps/portal/src/tool'),
  'config/apps/portal/src/pages/functions/[slug].astro', 'config/apps/portal/src/pages/functions/index.astro', 'config/apps/portal/src/pages/functions/clock.astro',
  'config/apps/portal/src/main1/catalogue.mjs', 'config/apps/portal/src/main1/index.astro',
  'config/apps/portal/src/pages/index.astro', 'config/apps/portal/public/tool-ping.json', 'config/apps/portal/package.json', 'pnpm-lock.yaml',
])].toSorted();
const sourceHashes = {}, sourceTimes = {};
for (const file of sources) {
  const bytes = fs.readFileSync(file), text = bytes.toString('utf8'), stat = fs.statSync(file);
  assert.ok(!/\b[A-Za-z]:[\\/]|(?:\bLenovo\b)|\/Users\/[^/]+\/|\/home\/[^/]+\//.test(text), 'Machine path or current username in application source: ' + file);
  assert.ok(stat.mtimeMs <= browserStart + 1000, 'Application source changed after the complete browser run started: ' + file);
  sourceHashes[file] = sha256(bytes); sourceTimes[file] = new Date(stat.mtimeMs).toISOString();
}
const algorithmSources = [...Object.values(modules).flatMap(file => collectFiles(path.posix.dirname(file))), ...phase5Directories.flatMap(collectFiles)];
for (const file of algorithmSources) if (!file.endsWith('.css')) assert.ok(fs.statSync(file).mtimeMs <= unit.startTime + 1000, 'Algorithm source changed after unit tests started: ' + file);
const testSourceHashes = {};
for (const file of [
  ...unit.testResults.map(entry => 'tests/' + path.basename(entry.name)),
  'tests/browser/phase6-images.spec.mjs', 'tests/browser/phase6-time.spec.mjs', 'tests/browser/phase6-science.spec.mjs',
  'tests/browser/phase5.spec.mjs', 'tests/browser/phase4.spec.mjs', 'tests/browser/reactor.spec.mjs', 'tests/browser/maze.spec.mjs', 'tests/browser/interaction.spec.mjs',
  'playwright.phase6.config.mjs',
]) {
  const bound = file.includes('.test.mjs') ? unit.startTime : browserStart;
  assert.ok(fs.statSync(file).mtimeMs <= bound + 1000, 'Test/config changed after its report was produced: ' + file);
  testSourceHashes[file] = sha256(fs.readFileSync(file));
}

function currentProof(project, name) {
  const file = path.join(reports, `phase6-${project}-${name}.json`), mtime = fs.statSync(file).mtimeMs;
  assert.ok(mtime >= browserStart - 1000 && mtime <= browserEnd + 1500, 'Stale supplementary browser proof: ' + name);
  return read(file);
}
function currentDownload(name) {
  const file = path.join(reports, name), mtime = fs.statSync(file).mtimeMs;
  assert.ok(mtime >= browserStart - 1000 && mtime <= browserEnd + 1500, 'Stale downloaded file: ' + name);
  return fs.readFileSync(file);
}
const edgeNames = [
  'image-formats', 'image-resize-compression', 'image-crop', 'image-pixels', 'image-text', 'image-qr', 'image-limits', 'image-cancel-pdf',
  'time-countdown-controls', 'time-stopwatch-pomodoro', 'time-lifecycle', 'time-todo-crud-download', 'time-todo-rejections', 'time-todo-fallback',
  'science-timetable', 'science-study-plan', 'science-scheduling', 'science-orbit', 'science-solar-system', 'science-distance',
];
const binaryNames = [
  'default-image-crop-ocv-image-crop.png', 'default-image-compress-ocv-image-compress.jpg',
  'default-image-convert-ocv-image-convert.png', 'default-image-resize-ocv-image-resize.png',
  'default-text-image-ocv-text-image.png', 'default-qr-generate-ocv-qr-generate.png', 'default-blank-pdf-ocv-blank-pdf.pdf',
  'image-format-png-ocv-image-convert.png', 'image-format-jpeg-ocv-image-convert.jpg', 'image-format-webp-ocv-image-convert.webp',
  'image-resized-ocv-image-resize.png', 'image-compressed-low-ocv-image-compress.jpg', 'image-compressed-high-ocv-image-compress.jpg',
  'image-drag-crop-ocv-image-crop.png', 'image-crop-jpeg-ocv-image-crop.jpg',
  'image-text-transparent-ocv-text-image.png', 'image-text-dark-ocv-text-image.png',
  'image-qr-unicode-ocv-qr-generate.png', 'image-pdf-centered-ocv-blank-pdf.pdf',
];
const proofs = {}, downloadFiles = [];
for (const project of ['desktop', 'mobile']) {
  const defaults = {};
  for (const tool of phase6Tools) {
    const prefix = `Phase 6 ${tool.requirements[0]} ${tool.id} `;
    assert.equal(browserChecks.filter(check => check.project === project && check.title.startsWith(prefix)).length, 1, 'Missing default test: ' + tool.id);
    const p = currentProof(project, 'default-' + tool.id);
    assert.equal(p.id, tool.id); assert.deepEqual(p.requirements, tool.requirements); assert.deepEqual(p.errors, []);
    assert.ok(Number.isInteger(p.outputLength) && p.outputLength > 0 && p.outputLength <= 4 * 1024 * 1024);
    assert.deepEqual(Object.keys(p.diagnostic).toSorted(), ['id', 'runs', 'successes', 'busy', 'cancelled', 'lastTool', 'resultLength'].toSorted());
    assert.equal(p.diagnostic.id, tool.id); assert.equal(p.diagnostic.lastTool, tool.id); assert.equal(p.diagnostic.busy, false);
    assert.ok(p.diagnostic.runs >= 1 && p.diagnostic.successes >= 1 && p.diagnostic.resultLength > 0);
    if (!imageIds.has(tool.id) && tool.id !== 'blank-pdf') { assert.equal(typeof p.output, 'string'); assert.equal(p.output.length, p.outputLength); }
    if (tool.id === 'todo') assert.deepEqual(JSON.parse(p.output), { version: 1, items: [] });
    if (tool.id === 'orbit') assert.equal(JSON.parse(p.output).scope, '娱乐/演示计算，不用于真实航天任务');
    if (tool.id === 'solar-system') assert.equal(JSON.parse(p.output).planets.length, 8);
    if (tool.id === 'blank-pdf') { assert.equal(p.decoded.pages, 1); assert.deepEqual(p.decoded.forbidden, []); }
    if (imageIds.has(tool.id) && !['image-color', 'qr-read'].includes(tool.id)) assert.ok(p.decoded.width > 0 && p.decoded.height > 0);
    defaults[tool.id] = p;
  }
  const p = Object.fromEntries(edgeNames.map(name => [name, currentProof(project, name)]));
  assert.deepEqual(p['image-formats'].outputs.map(row => row.format), ['png', 'jpeg', 'webp']);
  for (const image of p['image-formats'].outputs) {
    assert.deepEqual([image.decoded.width, image.decoded.height], [64, 48]); assert.ok(image.bytes > 0);
    if (image.format === 'jpeg') { assert.equal(image.decoded.transparent[3], 255); assert.ok(image.decoded.transparent.slice(0, 3).every(value => value > 245)); }
    else assert.equal(image.decoded.transparent[3], 0);
  }
  assert.deepEqual([p['image-resize-compression'].resized.width, p['image-resize-compression'].resized.height], [17, 11]);
  assert.equal(p['image-resize-compression'].differentBytes, true);
  assert.deepEqual(p['image-resize-compression'].qualities.map(row => row.quality), ['low', 'high']);
  const crop = p['image-crop']; assert.equal(crop.realPointerDrag, true);
  assert.ok(crop.after.width < crop.before.width && crop.after.height < crop.before.height);
  assert.deepEqual([crop.decoded.width, crop.decoded.height], [crop.expected.width, crop.expected.height]); assert.ok(crop.decoded.ink > 0);
  assert.equal(crop.jpeg.corner[3], 255); assert.ok(crop.jpeg.corner.slice(0, 3).every(value => value > 245));
  assert.equal(p['image-pixels'].realPointerClicks, true); assert.match(p['image-pixels'].green, /#00ff00\nRGBA\(0, 255, 0, 255\)/);
  assert.match(p['image-pixels'].transparent, /RGBA\(0, 0, 0, 0\)/);
  assert.ok(p['image-text'].transparent.ink > 100); assert.equal(p['image-text'].transparent.corner[3], 0);
  assert.deepEqual(p['image-text'].dark.corner, [16, 32, 51, 255]);
  const qr = p['image-qr']; assert.ok(qr.unicodeExact && qr.hostileTextInert && qr.unrecognizedRejected && qr.downloadBytes > 0);
  assert.deepEqual(qr.externalRequests, []); assert.deepEqual(qr.posts, []);
  const limits = p['image-limits']; assert.ok(limits.unsupportedSvg && limits.file4MiB && limits.headerPixelLimit);
  assert.ok(limits.requests.every(request => request.method === 'GET' && !request.body));
  const pdfProof = p['image-cancel-pdf'], pdf = pdfProof.pdf;
  assert.ok(pdfProof.cropDestroyed && pdfProof.recovered && pdfProof.bytes > 0 && pdfProof.preview.ink > 20);
  assert.equal(pdf.pages, 1); assert.equal(pdf.title, '本页有意接近空白'); assert.deepEqual(pdf.forbidden, []); assert.equal(pdf.imageDraw, true);
  assert.ok(Math.abs(pdf.size.width - 595.28) < 0.01 && Math.abs(pdf.size.height - 841.89) < 0.01);
  assert.ok(pdf.images.some(image => image.subtype === '/Image' && image.width === 520 && image.height === 70 && image.bytes > 0));
  assert.ok(Math.abs(pdf.matrix[0][4] - (pdf.size.width - 104) / 2) < 0.00001);
  assert.ok(Math.abs(pdf.matrix[0][5] - (pdf.size.height - 14) / 2) < 0.00001);
  const countdown = p['time-countdown-controls'];
  assert.ok(countdown.pausedStable && countdown.resumed && countdown.resetTo2000 && countdown.cancelledStable && countdown.cleanRerun);
  assert.match(countdown.output, /状态：到时间了[\s\S]*剩余：00:00:00.000/);
  const stopwatch = p['time-stopwatch-pomodoro']; assert.equal(stopwatch.correctLapSum, true); assert.equal(stopwatch.resetClearsLaps, true);
  assert.equal(stopwatch.lapRows.length, 3); assert.match(stopwatch.pomodoroOutput, /已用：00:00:00.600[\s\S]*阶段：完成[\s\S]*轮次：2\/2/);
  const lifecycle = p['time-lifecycle'];
  assert.ok(lifecycle.syntheticPersistedEvents && lifecycle.simulatedHiddenGetter && lifecycle.genuineMonotonicElapsed && lifecycle.suspendedOutputStable && lifecycle.hiddenOutputStable);
  assert.match(lifecycle.claim, /does not claim a real browser BFCache hit/);
  const todo = p['time-todo-crud-download']; assert.ok(todo.persistedAfterReload && todo.deleted && todo.reimported);
  assert.equal(todo.actualDownload, 'ocv-todo.json'); assert.deepEqual(JSON.parse(todo.canonical), { version: 1, items: todo.items });
  assert.deepEqual(todo.items.map(item => [item.text, item.completed]), [['检查完成 🧪', false], ['关灯', true]]);
  assert.equal(currentDownload(`phase6-${project}-todo.json`).toString('utf8'), todo.canonical);
  const rejection = p['time-todo-rejections']; assert.equal(rejection.rejectedCases, 6); assert.ok(rejection.listPreserved && rejection.noPrototypePollution && rejection.validRecovery);
  const fallback = p['time-todo-fallback']; assert.ok(fallback.realStorageWriteRejected && fallback.honestMemoryNotice && fallback.inMemoryCrud && fallback.storageKeyAbsent);
  for (const name of edgeNames.filter(name => name.startsWith('science-'))) assert.deepEqual(p[name].errors, []);
  const timetable = p['science-timetable']; assert.ok(timetable.invalidTimeRejected && !timetable.scriptExecuted);
  assert.equal(timetable.manualCourses.length, 3); assert.deepEqual(timetable.exported.value.courses, timetable.manualCourses);
  assert.match(timetable.cells[1][1], /<img src=x onerror=window\.__sciencePwned=1>/);
  const study = p['science-study-plan']; assert.deepEqual(study.dates, ['2024-03-09', '2024-03-10']); assert.equal(study.invalidCalendarRejected, true);
  assert.equal(Object.keys(study.totals).length, 5); assert.ok(Object.values(study.totals).every(total => Math.abs(total - 0.4) < 1e-12));
  const schedule = p['science-scheduling']; assert.equal(schedule.nationalLabel, '正在调用国家级调度引擎'); assert.equal(schedule.cancelled, true);
  assert.equal(schedule.entries.length, 3); assert.equal(schedule.conflicts.length, 2); assert.ok(schedule.conflicts.every(conflict => conflict.kind === '教师'));
  const orbit = p['science-orbit']; assert.ok(orbit.undergroundOrbitRejected && orbit.explicitScope);
  assert.equal(orbit.basicCircular.perigeeAltitudeKm, 629); assert.equal(orbit.basicCircular.apogeeAltitudeKm, 629);
  assert.ok(Math.abs(orbit.basicCircular.periodSeconds - 5828.516637686015) < 1e-7);
  const solar = p['science-solar-system']; assert.ok(solar.realCssMovement && solar.reducedMotionStatic);
  assert.deepEqual(solar.durations, ['5s', '8s', '12s', '17s', '23s', '31s', '41s', '53s']); assert.equal(solar.planets.length, 8);
  const distance = p['science-distance']; assert.equal(distance.invalidLatitudeRejected, true);
  assert.deepEqual(distance.known.map(row => row.actual), ['10007.543398 km', '0.000000 km', '222.389853 km', '20015.086796 km']);
  for (const [name, expected] of [['timetable', timetable.exported], ['study-plan', study.exported], ['scheduling', schedule.exported], ['orbit', orbit.exported], ['solar-system', solar.exported]]) {
    assert.equal(expected.filename, `ocv-${name}.json`);
    const actual = currentDownload(`phase6-${project}-${name}-download.json`);
    assert.equal(actual.length, expected.bytes); assert.deepEqual(JSON.parse(actual.toString('utf8')), expected.value);
  }
  for (const suffix of binaryNames) {
    const name = `phase6-${project}-${suffix}`;
    const file = path.join(reports, name), bytes = fs.readFileSync(file), mtime = fs.statSync(file).mtimeMs;
    assert.ok(bytes.length > 0 && mtime >= browserStart - 1000 && mtime <= browserEnd + 1500, 'Stale exported binary: ' + name);
    if (name.endsWith('.pdf')) assert.equal(bytes.toString('ascii', 0, 5), '%PDF-');
    else if (name.endsWith('.png')) assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    else if (name.endsWith('.jpg')) assert.deepEqual([...bytes.subarray(0, 3)], [255, 216, 255]);
    else { assert.equal(bytes.toString('ascii', 0, 4), 'RIFF'); assert.equal(bytes.toString('ascii', 8, 12), 'WEBP'); }
    downloadFiles.push({ project, file: ref(name), bytes: bytes.length, sha256: sha256(bytes) });
  }
  assert.ok(downloadFiles.filter(file => file.project === project && file.file.endsWith('.pdf')).length >= 2);
  proofs[project] = { defaults, edges: p };
}

// Every Docker call below is read-only. No image pull, build, mutation or optional service launch.
const depsRoot = process.env.OCV_DEPS_ROOT, localWindows = process.platform === 'win32' && Boolean(depsRoot);
const dockerBinary = process.env.OCV_DOCKER_BIN || (localWindows ? path.join(depsRoot, 'docker-app/resources/bin/docker.exe') : 'docker');
const dockerEnvironment = localWindows ? { ...process.env, USERPROFILE: path.join(depsRoot, 'docker-desktop'), APPDATA: path.join(depsRoot, 'docker-desktop/appdata/Roaming'), LOCALAPPDATA: path.join(depsRoot, 'docker-desktop/appdata/Local'), COMPOSE_PARALLEL_LIMIT: '1' } : process.env;
function docker(args) {
  const result = spawnSync(dockerBinary, args, { encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024, env: dockerEnvironment });
  assert.equal(result.status, 0, result.error?.message || result.stderr || 'Docker command failed'); return result.stdout;
}
const compose = args => docker(['compose', '-p', 'omnicivitas', '-f', 'compose.yaml', '--profile', '*', ...args]);
let storage;
if (localWindows) {
  const started = Date.now();
  const result = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/Confirm-DockerStorage.ps1'], { encoding: 'utf8', timeout: 60000, env: process.env });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'Physical Docker storage guard failed');
  storage = read(path.join(runtime, 'docker-storage.json'));
  assert.ok(Date.parse(storage.verifiedAt) >= started - 1000); assert.equal(storage.pullPermitted, true); assert.ok(storage.disks.length >= 2);
  assert.ok(storage.actualVmMemoryBytes <= 9 * 1024 ** 3 + 64 * 1024 ** 2, 'Phase 6 uses the bounded daily VM mode');
} else storage = { localWindowsPhysicalGuardApplicable: false, note: 'No Windows F-drive claim on this platform; the current daemon is inspected below.' };
const containerIds = compose(['ps', '-q']).trim().split(/\s+/).filter(Boolean); assert.equal(containerIds.length, 6);
const core = JSON.parse(docker(['inspect', ...containerIds])).map(container => ({
  service: container.Config.Labels['com.docker.compose.service'], health: container.State.Health?.Status, running: container.State.Running,
  limitMiB: container.HostConfig.Memory / 1048576, swapLimitMiB: container.HostConfig.MemorySwap / 1048576,
  cpus: container.HostConfig.NanoCpus / 1000000000, pidsLimit: container.HostConfig.PidsLimit, logConfig: container.HostConfig.LogConfig, image: container.Image,
}));
assert.deepEqual(core.map(service => service.service).toSorted(), ['edge', 'gateway', 'next', 'portal', 'postgres', 'redis']);
assert.ok(core.every(service => service.running && service.health === 'healthy' && service.limitMiB > 0 && service.cpus > 0 && service.pidsLimit > 0));
assert.ok(core.every(service => service.swapLimitMiB === service.limitMiB && service.logConfig.Config['max-size'] && service.logConfig.Config['max-file']));
const totalCapsMiB = core.reduce((sum, service) => sum + service.limitMiB, 0); assert.equal(totalCapsMiB, 1728);
const builder = JSON.parse(docker(['inspect', 'buildx_buildkit_ocv-budget-builder0']))[0]; assert.equal(builder.State.Running, false); assert.equal(builder.HostConfig.Memory / 1048576, 3072);
const base = new URL(process.env.OCV_BASE_URL || 'http://127.0.0.1:8080'), HTTP = [];
for (const url of new Set(['/', '/functions/', ...catalogue.map(row => row.url), ...tools.map(tool => `/functions/${tool.id}/`), '/identity/login/', '/identity/register/'])) {
  assert.ok(url.startsWith('/') && !url.startsWith('//'));
  const response = await fetch(new URL(url, base), { signal: AbortSignal.timeout(10000) }), bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, 200, url);
  if (tools.some(tool => url === `/functions/${tool.id}/`)) assert.ok(bytes.toString('utf8').includes('id="tool-form"'), 'Tool remains a placeholder: ' + url);
  HTTP.push({ url, status: response.status, sha256: sha256(bytes) });
}
const backendRoutes = [];
for (const route of ['/api/auth/login', '/api/auth/register', '/api/login', '/api/register']) for (const method of ['GET', 'POST']) {
  const response = await fetch(new URL(route, base), { method, signal: AbortSignal.timeout(10000) }); await response.arrayBuffer();
  assert.equal(response.status, 404, method + ' ' + route); backendRoutes.push({ route, method, status: response.status });
}
const query = 'SELECT (SELECT count(*) FROM ocv_unused.users),(SELECT count(*) FROM ocv_unused.user_passwords),(SELECT count(*) FROM ocv_unused.login_sessions);';
const emptyAccountCounts = compose(['exec', '-T', 'postgres', 'sh', '-c', 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c \'' + query + '\'']).trim();
assert.equal(emptyAccountCounts, '0|0|0', 'Real PostgreSQL dormant account tables must remain empty');

const packageVersions = { cropperjs: '1.6.2', qrcode: '1.5.4', jsqr: '1.4.0', 'pdf-lib': '1.17.1' };
const portalPackage = read('config/apps/portal/package.json'), notices = fs.readFileSync('THIRD_PARTY_NOTICES.txt');
const licenseDocuments = ['docs/PHASE-5-SOURCES.md', 'docs/PHASE-6-SOURCES.md'].map(file => ({ file, text: fs.readFileSync(file, 'utf8') }));
const documentedLicenses = licenseDocuments.flatMap(doc => [...doc.text.matchAll(/^\| \[([^\]]+\.txt)\]\(\.\.\/config/apps\/portal\/public\/licenses\/([^)]+)\) \| (\d+) \| \x60([a-f0-9]{64})\x60 \|$/gm)].map(match => {
  assert.equal(match[1], match[2]); assert.match(match[1], /^[a-z0-9A-Z._-]+\.txt$/);
  return { name: match[1], bytes: Number(match[3]), sha256: match[4], source: doc.file };
}));
assert.equal(documentedLicenses.length, 10); assert.equal(new Set(documentedLicenses.map(item => item.name)).size, 10);
assert.deepEqual(fs.readdirSync('config/apps/portal/public/licenses').toSorted(), documentedLicenses.map(item => item.name).toSorted());
assert.deepEqual(fs.readFileSync('config/apps/portal/public/third-party-notices.txt'), notices, 'Root and public declarations differ');
const licenseHTTP = [];
for (const item of [
  { file: 'config/apps/portal/public/third-party-notices.txt', url: '/third-party-notices.txt', bytes: notices.length, sha256: sha256(notices), source: 'THIRD_PARTY_NOTICES.txt' },
  ...documentedLicenses.map(item => ({ ...item, file: 'config/apps/portal/public/licenses/' + item.name, url: '/licenses/' + item.name })),
]) {
  const local = fs.readFileSync(item.file); assert.equal(local.length, item.bytes); assert.equal(sha256(local), item.sha256);
  assert.ok(fs.statSync(item.file).mtimeMs <= browserStart + 1000, 'Published license changed after tests began: ' + item.file);
  const response = await fetch(new URL(item.url, base), { signal: AbortSignal.timeout(10000) }), published = Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, 200, item.url); assert.deepEqual(published, local, 'Deployed original license differs: ' + item.url);
  licenseHTTP.push({ ...item, status: 200 });
}
const packageLicenses = { cropperjs: 'LICENSE', qrcode: 'license', jsqr: 'LICENSE', 'pdf-lib': 'LICENSE.md' };
const dependencies = Object.entries(packageVersions).map(([name, version]) => {
  assert.equal(portalPackage.dependencies[name], version); assert.ok(notices.toString('utf8').includes(name), 'Missing package attribution: ' + name);
  const location = fs.realpathSync('config/apps/portal/node_modules/' + name), manifest = read(path.join(location, 'package.json')); assert.equal(manifest.version, version);
  if (depsRoot) assert.ok(location.toLowerCase().startsWith(fs.realpathSync(depsRoot).toLowerCase() + path.sep), 'Dependency payload outside configured local root: ' + name);
  const servedName = `${name}-${version}-LICENSE.txt`;
  assert.deepEqual(fs.readFileSync(`config/apps/portal/public/licenses/${servedName}`), fs.readFileSync(path.join(location, packageLicenses[name])), 'License was rewritten instead of copied: ' + name);
  const usages = name === 'cropperjs' ? ['B018', 'real pointer drag and changed rectangle export'] : name === 'qrcode' ? ['B024', 'actual QR PNG exported and reuploaded'] : name === 'jsqr' ? ['B025', 'exact Unicode QR decoding from reuploaded pixels'] : ['B123', 'real one-page PDF structure and centered image'];
  return { name, version, license: manifest.license, actualLocalLocation: depsRoot ? location : undefined, verifiedUsage: usages, notice: 'THIRD_PARTY_NOTICES.txt' };
});
const memorySamples = read(path.join(runtime, 'phase6-memory.json')); assert.ok(Array.isArray(memorySamples) && memorySamples.length > 0);
const memory = memorySamples.at(-1); assert.ok(Number.isFinite(memory.totalWorkingSetMiB) && memory.totalWorkingSetMiB > 0);
assert.ok(Date.parse(memory.sampledAt) >= browserEnd - 1000, 'Memory sample must follow the complete browser run'); assert.ok(Array.isArray(memory.processes) && memory.processes.length > 0);

const unitPatterns = {
  'image-crop': /dimensions|file byte limits|PNG dimensions|JPEG SOF|WebP/i,
  'image-compress': /format selection|dimensions/i, 'image-convert': /format selection|PNG|JPEG|WebP|SVG/i,
  'image-resize': /canvas dimensions/i, 'image-color': /pixel picking/i, 'text-image': /text image/i,
  'qr-generate': /QR inputs|QR encoder/i, 'qr-read': /QR encoder|file byte limits/i,
  countdown: /countdown|pause excludes|time fields/i, stopwatch: /stopwatch|fractional monotonic/i,
  pomodoro: /pomodoro|time fields/i, todo: /todo/i,
  timetable: /timetable|literal markup/i, 'study-plan': /calendar|review allocation|review plan/i,
  scheduling: /Fisher-Yates|scheduling/i, orbit: /orbit/i, 'solar-system': /solar outputs/i, distance: /Haversine/i,
  'blank-pdf': null,
};
const edgeMapping = {
  'image-crop': ['image-crop', 'image-cancel-pdf', 'image-limits'], 'image-compress': ['image-resize-compression', 'image-limits'],
  'image-convert': ['image-formats', 'image-limits'], 'image-resize': ['image-resize-compression'], 'image-color': ['image-pixels'],
  'text-image': ['image-text'], 'qr-generate': ['image-qr'], 'qr-read': ['image-qr', 'image-limits'],
  countdown: ['time-countdown-controls'], stopwatch: ['time-stopwatch-pomodoro', 'time-lifecycle'],
  pomodoro: ['time-stopwatch-pomodoro'], todo: ['time-todo-crud-download', 'time-todo-rejections', 'time-todo-fallback'],
  timetable: ['science-timetable'], 'study-plan': ['science-study-plan'], scheduling: ['science-scheduling'],
  orbit: ['science-orbit'], 'solar-system': ['science-solar-system'], distance: ['science-distance'], 'blank-pdf': ['image-cancel-pdf'],
};
for (const tool of phase6Tools) {
  const item = phaseItems.find(row => row.id === tool.requirements[0]), group = groupFor(tool.id), pattern = unitPatterns[tool.id];
  const matchedUnits = pattern ? unitChecks.filter(check => check.file === `tests/phase6-${group}.test.mjs` && pattern.test(check.title)) : [];
  if (pattern) assert.ok(matchedUnits.length > 0, 'No meaningful algorithm checks matched: ' + tool.id);
  item.status = 'verified';
  item.implementation = [...new Set([...(item.implementation || []), moduleFor(tool.id), 'config/apps/portal/src/tool/Tool.astro', 'config/apps/portal/src/tool/run.js',
    ...(group === 'images' ? ['config/apps/portal/src/img/size.mjs'] : group === 'time' ? ['config/apps/portal/src/time/time.mjs'] : group === 'science' ? ['config/apps/portal/src/δοκιμή/ui.mjs'] : []),
  ])];
  const evidence = ['desktop', 'mobile'].flatMap(project => [ref(`phase6-${project}-default-${tool.id}.json`), ...edgeMapping[tool.id].map(name => ref(`phase6-${project}-${name}.json`))]);
  item.verification = [...new Set([...(item.verification || []), ...evidence, ...matchedUnits.map(check => unitRef + ' :: ' + check.file + ' :: ' + check.title)])];
  item.currentPhase6 = {
    tool: tool.id, url: `/functions/${tool.id}/`, unitChecks: matchedUnits,
    browserChecks: browserChecks.filter(check => check.title.startsWith(`Phase 6 ${tool.requirements[0]} ${tool.id} `)), edgeProofs: edgeMapping[tool.id],
    note: tool.id === 'blank-pdf' ? 'Browser-native Chinese Canvas raster and real pdf-lib serialization/download verified in both browsers; no DOM-less PDF unit evidence is invented.' : 'Meaningful algorithm checks and actual desktop/mobile operations passed.',
  };
}
assert.ok(phaseItems.every(row => row.status === 'verified' && row.implementation.length && row.verification.length));
for (const [id, original] of untouchedRequirements) assert.equal(JSON.stringify(ledger.requirements.find(row => row.id === id)), original, 'Unrelated requirement mutated: ' + id);
assert.equal(originalContent(ledger), immutable); assert.equal(JSON.stringify(ledger.currentPhase5), previousPhase5Metadata);
const technologies = read('docs/technologies.json'); assert.equal(technologies.technologies.length, 146); assert.equal(technologies.originalCategories, 34);
const originalTechnologies = JSON.stringify(technologies.technologies), previousTechnologyMetadata = JSON.stringify(technologies.currentPhase5);
const acceptedAt = new Date().toISOString();
const earlierRuns = [];
for (const [file, kind, reason] of [
  [path.join(runtime, 'phase6-unit-initial.json'), 'unit-diagnostic', 'Initial 89/90 run exceeded the default five-second deadline while cold-loading Math.js. The next whole 90-check run used a fifteen-second test deadline without weakening assertions; initial failure is retained.'],
  [path.join(runtime, 'phase6-initial/phase6-playwright.json'), 'browser-diagnostic', 'Initial 78-check diagnostic had six Cropper failures: Astro extracted and removed dynamically imported CSS while leaving a preload URL. CSS was moved to the static Astro tool-window import, then rebuilt and checked afresh.'],
  [path.join(runtime, 'phase6-crop-fix/phase6-playwright.json'), 'browser-targeted-recheck', 'Four targeted Cropper checks after the static CSS import change: two passed and two drag checks exposed a test error. getData(true) rounds crop endpoints, while default export converts raw dimensions to native Canvas integers. The corrected test computes exact integer dimensions from the raw range and independently decodes the downloaded file; it does not allow a plus-or-minus-one tolerance.'],
  [path.join(runtime, 'phase6-crop-integer/phase6-playwright.json'), 'browser-targeted-recheck', 'Six targeted Cropper/default/PDF checks passed after correcting the test dimension expectation. This subset is retained separately and never combined with the fresh complete report.'],
  [path.join(runtime, 'phase6-final/phase6-playwright.json'), 'browser-complete-diagnostic', 'First complete 212-check run passed all 78 phase-6 operations but had four older-page regression failures (208/212). Search now has two legitimate links with the same title, so its test scopes the actual search-result link; the mobile geometry controls can be covered by intentional windows and use genuine keyboard activation; the home-image cover check now uses the native attribute assertion rather than repeated locator-evaluate protocol round trips. No checks or application layers were removed.'],
  [path.join(runtime, 'phase6-regression-fix/phase6-playwright.json'), 'browser-targeted-recheck', 'Targeted older-page checks following the search locator and legitimate native-input/assertion corrections. This subset is retained separately and never combined with the fresh complete report.'],
]) {
  if (!fs.existsSync(file)) continue;
  const result = read(file);
  earlierRuns.push({ report: 'runtime/reports/' + path.relative(runtime, file).replaceAll('\\', '/'), kind, sha256: sha256(fs.readFileSync(file)), reason,
    stats: result.stats || { total: result.numTotalTests, passed: result.numPassedTests, failed: result.numFailedTests, success: result.success }, usedForAcceptance: false });
}
const limitations = [
  'Only phase 6 is accepted. Phase 7 is not authorized. Existing phase 5 and earlier evidence is preserved; it is not silently relabeled.',
  'Only six core services run; optional databases/languages/messaging/monitoring and the full technology stack are not claimed rerun in this phase.',
  'PNG/JPEG/WebP input only, 4 MiB file limit, 4096 per edge and 4 MP total decoded pixels; SVG, GIF, AVIF, BMP and animated WebP are explicitly unsupported. Compression presets do not guarantee every file becomes smaller.',
  'QR decoding is experimental; tested fixtures and exact Unicode round trips do not guarantee arbitrary blurred, bent or multiple-code images. Recognized URLs stay inert text.',
  'The PDF is a real one-page A4 document containing a small centered Chinese raster image. Its sentence is not selectable PDF text, depends on device fonts, and is not a general document layout or accessibility engine.',
  'Countdown/stopwatch/pomodoro use actual performance.now elapsed time; synthetic persisted PageTransitionEvent and simulated hidden getter test the lifecycle handlers, not a genuine BFCache hit or a real OS suspension measurement.',
  'Todo alone intentionally persists under localStorage key ocv.todo.v1. Invalid/unavailable/full storage falls back honestly to memory; memory data is not promised to survive refresh. Other tool inputs/files are not persisted or uploaded.',
  'Manual timetable only lays out supplied cells. Review divides calendar-day shares equally. Random scheduling flags conflicts instead of solving constraints; orbit is basic two-body entertainment math and solar-system periods/sizes are CSS/SVG presets, not flight or physical simulation.',
  'Intentional overlap and mobile clipping remain, with actual keyboard/focus/window-raise completion paths. Passing tests does not promise tidy responsive layout or FPS.',
  'Docker/WSL working set is a sample after testing, includes shared/file-cache pages and is not a long-term peak memory guarantee.',
  'Phase 9 public release portability audit, clean clone, full cross-platform installation and complete dependency/supplied-asset license audit remain pending.',
];
const report = {
  phase: 6, status: 'complete', revision: 'phase-6-media-time-science', acceptedAt, nextPhaseAuthorized: false, previousAcceptance: 'docs/phase-5-acceptance.json',
  requirementCount: 19, requirements: phaseItems,
  browser: { report: browserRef, stats: suite.stats, count: 212, phase6Count: 78, phase5RegressionCount: 84, earlierRegressionCount: 50, checks: browserChecks, proofs },
  unit: { report: unitRef, count: 90, phase6Count: 47, phase5RegressionCount: 43, checks: unitChecks, startTime: unit.startTime },
  HTTP, backendRoutes, emptyAccountCounts, core, totalCapsMiB, builderStopped: true, builderCapMiB: 3072, storage, memory,
  sourceHashes, sourceTimes, testSourceHashes, acceptanceRecorder: { file: 'scripts/record-phase6-acceptance.mjs', sha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))) }, dependencies, licenseHTTP, downloadFiles, earlierRuns,
  licenseSources: licenseDocuments.map(doc => ({ file: doc.file, sha256: sha256(Buffer.from(doc.text)), documentedLicenses: documentedLicenses.filter(item => item.source === doc.file) })),
  sourceIntegrity: { check: originalLedgerCheck, numbered: 732, originalTechnologies: 146, originalCategories: 34, sourceHash: ledger.sourceHash, promptSourceHash: ledger.promptSourceHash },
  guarantees: {
    activeTools: '19 new tools with actual native-form/default and focused edge operations in desktop and mobile browsers; all 35 phase 5 tools rerun as regression.',
    export: 'Real PNG/JPEG/WebP files decode to independently checked dimensions/pixels; real QR PNG reuploads to the independent decoder; real PDF parses as one page with centered nonempty raster and no executable actions; todo/science canonical JSON bytes match downloads and re-import.',
    timer: 'Monotonic elapsed clock with pause/resume/reset/laps/finite completion; canceled/repeated work clears resources. Simulated lifecycle hooks suspend paint and catch up without resetting elapsed.',
    storage: 'Only todo key ocv.todo.v1 persists; bounded strict versioned JSON rejects unsafe structure, duplicate IDs and oversized changes before committing; storage write rejection leaves working honest memory state.',
    science: 'Explicit manual/random/preset/two-body/spherical scope is visible and included in output; calendar and Haversine numerical checks are independently known.',
    dependencies: 'Actual Cropper pointer rectangle change, qrcode encoding, jsQR decoding and pdf-lib PDF structure; package presence alone is not acceptance.',
    licenses: 'Root/public attribution and ten original license files agree byte-for-byte with HTTP 200; four new original files also agree with the exact installed packages.',
  }, limitations,
};
ledger.currentPhase6 = { name: report.revision, status: 'complete', acceptedAt, evidence: 'docs/phase-6-acceptance.json', requirementCount: 19, browserReport: browserRef, unitReport: unitRef, originalNumberedTextsPreserved: true, nextPhaseAuthorized: false };
technologies.currentPhase6 = { evidence: 'docs/phase-6-acceptance.json', newDependencies: dependencies, originalTechnologiesPreserved: 146, originalCategoriesPreserved: 34,
  actualUses: [{ name: 'CropperJS', implementation: modules.images, verification: ['desktop', 'mobile'].map(project => ref(`phase6-${project}-image-crop.json`)) },
    { name: 'qrcode / jsQR', implementation: modules.images, verification: ['desktop', 'mobile'].map(project => ref(`phase6-${project}-image-qr.json`)) },
    { name: 'pdf-lib', implementation: modules.files, verification: ['desktop', 'mobile'].map(project => ref(`phase6-${project}-image-cancel-pdf.json`)) }],
};
assert.equal(JSON.stringify(technologies.technologies), originalTechnologies); assert.equal(JSON.stringify(technologies.currentPhase5), previousTechnologyMetadata);
const escape = value => String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>');
let requirementTable = fs.readFileSync('docs/REQUIREMENTS.md', 'utf8');
for (const row of phaseItems) {
  const line = '| ' + [row.id, row.sourceLine, row.phase, row.status, escape(row.text), escape([...row.implementation, ...row.verification].join('; '))].join(' | ') + ' |';
  assert.match(requirementTable, new RegExp('^\\| ' + row.id + ' \\|.*$', 'm'));
  requirementTable = requirementTable.replace(new RegExp('^\\| ' + row.id + ' \\|.*$', 'm'), () => line);
}
const rows = phaseItems.map(row => '| ' + [row.id, escape(row.text), escape(row.currentPhase6.url), 'verified', escape(row.implementation[0]), `${row.currentPhase6.unitChecks.length} 项关联单测；桌面/手机真实默认值；${row.currentPhase6.edgeProofs.join(', ')}`].join(' | ') + ' |');
const memoryMiB = Math.round(memory.totalWorkingSetMiB * 10) / 10;
const markdown = [
  '# 第六阶段验收', '', `${acceptedAt}。本阶段 19 条要求逐条 verified，新工具累加到现有玻璃/失修门户，总计 54 个工具。第五阶段及原扉页、光场、迷宫与互动保留。已完成并停止，第七阶段未授权。`, '',
  '新完整浏览器 212/212（桌面/手机各 106；本阶段 78＋第五阶段回归 84＋原页面回归 50），无失败、跳过、flaky 或重试拼接。新合并单测 90/90（本阶段 47＋第五阶段 43）。详细证据见 [phase-6-acceptance.json](phase-6-acceptance.json)。', '',
  '初次 89/90 单测因 Math.js 冷加载超过默认 5 秒期限而保留为失败报告；改用 15 秒单测期限重新完整执行。初次 78 浏览器专项有六项 Cropper CSS 404，已将库 CSS 改成 Astro 静态导入并重建；旧诊断和专项复查都独立保留，不拼入当前 212 项。具体记录见 JSON 的 earlierRuns。', '',
  '第一次完整浏览器运行是 208/212：本阶段 78 项均通过，四项旧页面检查分别遇到新增同名入口、手机故意遮挡和 GPU 首绘期间的协议轮询。修正搜索结果定位、使用真实键盘完成被遮挡的移动端操作，并将轮询改为原生属性断言，原要求和验证条件保留。随后六项专项通过，再从头执行本报告对应的完整 212 项；全部旧结果分开保存。', '',
  '## 逐条核对', '', '| 编号 | 原文 | 页面 | 状态 | 主要源码 | 证据 |', '| --- | --- | --- | --- | --- | --- |', ...rows, '',
  '## 实测结果', '',
  '- 真正拖动 Cropper 选区后导出改变的矩形；三种图片格式有真实 magic bytes 和解码尺寸，透明 JPEG 明确铺白，PNG/WebP 保留透明。文字图有可见像素，取色使用实际 Canvas 坐标与 alpha。',
  '- 实际二维码 PNG 下载、重新上传、由独立 jsQR 识别出原 Unicode 文字；恶意标签/URL 仍为文字，没有导航、外部请求或上传。SVG/文件字节/解码像素超限在本地拒绝。',
  '- 真正的一页 A4 PDF 包含居中小图；解析页数、图像尺寸、绘制矩阵和无脚本，浏览器预览有文字像素。中文句子是 Canvas 栅格而非可选择 PDF 文本，字体按设备变化。',
  '- 倒计时真暂停/继续/归零/完成，秒表记录实际分段，番茄钟短参数在最后休息后有限完成。取消/重跑无重复工作台。生命周期钩子以合成事件和模拟隐藏属性检查，不冒充真实 BFCache 命中。',
  '- 待办真实增改勾选删除、刷新恢复、JSON 原字节下载及重新导入；坏结构/数量/文字/字节超限不破坏当前列表，实际 storage 写拒绝后仍能内存操作并明确显示。它是唯一新获准持久化的工具。',
  '- 手动课程保留重叠原数据；复习按真实公历日期均分；排课取消后能恢复、所有课程保留且冲突明确；轨道基本数值、八行星预设 CSS 动画及 Haversine 已知球面距离都实际检查，演示边界可见。', '',
  '## 运行与边界', '',
  `${HTTP.length} 个页面 HTTP 200，8 次账户 GET/POST 均 404，真实 PostgreSQL 停用账户表 0|0|0。仅六个健康 core，内存 caps 合计 ${totalCapsMiB} MiB，实际 CPU/PID/swap/日志边界存在；3 GiB builder 已停止。Docker/WSL 最后工作集采样 ${memoryMiB} MiB（${memory.sampledAt}），不是长期峰值。`, '',
  '新增 cropperjs 1.6.2、qrcode 1.5.4、jsqr 1.4.0、pdf-lib 1.17.1；真实调用证据、精确版本、本地目录和原许可见 JSON 与 [PHASE-6-SOURCES.md](PHASE-6-SOURCES.md)。公开归属声明及十份原许可均 HTTP 200，原字节/hash 一致；旧第五阶段来源记录保留。732 原文/行号/hash、146 原技术与 34 类别完整，其他阶段行不修改。', '',
  '## 证据的实际范围', '', ...limitations.map(limit => '- ' + limit), '',
  '阶段停点：[phase-state.json](phase-state.json)。第七阶段等待用户授权。', '',
].join('\n');

// Write only after all fresh reports, semantic proofs, current services, source timing and immutability checks succeed.
write('docs/phase-6-acceptance.json', report); fs.writeFileSync('docs/PHASE-6-ACCEPTANCE.md', markdown);
write('docs/requirements.json', ledger); fs.writeFileSync('docs/REQUIREMENTS.md', requirementTable); write('docs/technologies.json', technologies);
const state = { ...previousState, phase: 6, status: 'complete', nextPhaseAuthorized: false, updatedAt: acceptedAt,
  previousAcceptance: 'docs/phase-5-acceptance.json', acceptance: 'docs/phase-6-acceptance.json', outstanding: [],
  activeWork: { ...previousState.activeWork, name: report.revision, status: 'complete', scope: 'Phase 6 only; phase 7 not authorized.', acceptance: 'docs/phase-6-acceptance.json' },
};
delete state.activeRevision; write('docs/phase-state.json', state);
console.log(ledgerCheck());
console.log(`PASS: 19 phase 6 requirements, 90 fresh unit checks, 212 fresh complete browser checks, ${HTTP.length} HTTP pages, ten published original licenses, six healthy capped core services and real empty account tables. Phase 7 is not authorized.`);
