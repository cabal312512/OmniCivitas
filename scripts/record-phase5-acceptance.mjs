// Phase 5 acceptance only. This does not start services, install dependencies, or enter phase 6.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tools } from '../config/apps/portal/src/tool/data.mjs';
import { catalogue } from '../config/apps/portal/src/main1/catalogue.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const scope = process.env.OCV_E2E_SCOPE || 'phase5-final';
assert.match(scope, /^[a-z0-9-]+$/, 'Invalid report scope');
const runtime = process.env.OCV_DEPS_ROOT ? path.join(process.env.OCV_DEPS_ROOT, 'runtime/reports') : path.join(root, '.test-results');
const reports = path.join(runtime, scope);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const ref = name => 'runtime/reports/' + scope + '/' + name;
const browserRef = ref('phase5-playwright.json');
const unitRef = 'runtime/reports/phase5-unit.json';
const previousState = read('docs/phase-state.json');
assert.equal(previousState.phase, 5, 'Only the currently authorized phase 5 may be accepted');
assert.ok(['in_progress', 'complete'].includes(previousState.status));
assert.equal(previousState.nextPhaseAuthorized, false);

function ledgerCheck() {
  const result = spawnSync(process.execPath, ['scripts/check-ledgers.mjs'], { encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'Ledger check failed');
  return result.stdout.trim();
}
const originalLedgerCheck = ledgerCheck();
const ledger = read('docs/requirements.json');
const immutable = JSON.stringify({
  sourceHash: ledger.sourceHash, promptSourceHash: ledger.promptSourceHash,
  numbered: ledger.requirements.map(({ id, text, sourceLine, source, phase }) => ({ id, text, sourceLine, source, phase })),
  unnumbered: ledger.unnumbered, stackCategories: ledger.stackCategories, promptParagraphs: ledger.promptParagraphs,
});
const untouchedRequirements = ledger.requirements.filter(row => row.phase !== 5).map(row => [row.id, JSON.stringify(row)]);
const phaseItems = ledger.requirements.filter(row => row.phase === 5);
assert.equal(phaseItems.length, 35);
assert.equal(tools.length, 35);
assert.equal(new Set(tools.map(tool => tool.id)).size, 35);
const ids = tools.flatMap(tool => tool.requirements);
assert.equal(ids.length, 35);
assert.equal(new Set(ids).size, 35);
assert.deepEqual(ids.toSorted(), phaseItems.map(row => row.id).toSorted());

const suite = read(path.join(reports, 'phase5-playwright.json'));
const browserChecks = [];
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
assert.equal(browserChecks.length, 134);
assert.equal(suite.stats.expected, 134);
for (const key of ['unexpected', 'flaky', 'skipped']) assert.equal(suite.stats[key], 0, 'Incomplete browser report: ' + key);
const browserStart = Date.parse(suite.stats.startTime);
assert.ok(Number.isFinite(browserStart));
const browserEnd = browserStart + suite.stats.duration;
assert.ok(Number.isFinite(browserEnd) && suite.stats.duration > 0);
for (const project of ['desktop', 'mobile']) assert.equal(browserChecks.filter(check => check.project === project).length, 67);
assert.equal(browserChecks.filter(check => check.title.startsWith('Phase 5 ')).length, 84);
assert.equal(browserChecks.filter(check => !check.title.startsWith('Phase 5 ')).length, 50);

const unit = read(path.join(runtime, 'phase5-unit.json'));
assert.equal(unit.success, true);
assert.equal(unit.numTotalTests, 43);
assert.equal(unit.numPassedTests, 43);
for (const key of ['numFailedTests', 'numPendingTests', 'numTodoTests']) assert.equal(unit[key], 0);
const unitChecks = unit.testResults.flatMap(file => {
  assert.equal(file.status, 'passed', file.name);
  assert.match(file.name.replaceAll('\\', '/'), /\/tests\/phase5-(?:calculation|development|text)\.test\.mjs$/);
  return file.assertionResults.map(check => {
    assert.equal(check.status, 'passed', check.fullName);
    assert.deepEqual(check.failureMessages, []);
    return { file: 'tests/' + path.basename(file.name), title: check.fullName, status: check.status };
  });
});
assert.equal(unitChecks.length, 43);
assert.ok(unit.startTime >= Date.parse(previousState.activeWork?.authorizedAt || previousState.updatedAt) - 1000, 'Unit proof predates current phase authorization');

const moduleByGroup = {
  text: 'config/apps/portal/src/text/1.mjs',
  calculation: 'config/apps/portal/src/math1/报价单_final2.mjs',
  development: 'config/apps/portal/src/net/net.mjs',
};
const textIds = new Set(['base64', 'json', 'xml', 'text', 'text-dedupe', 'text-sort', 'text-case', 'markdown', 'csv', 'ascii', 'morse']);
const calculationIds = new Set(['timestamp', 'time-zone', 'convert', 'calculator', 'scientific', 'matrix', 'radix', 'color', 'roman', 'permissions']);
const moduleFor = id => moduleByGroup[textIds.has(id) ? 'text' : calculationIds.has(id) ? 'calculation' : 'development'];
function collectFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = directory + '/' + entry.name;
    return entry.isDirectory() ? collectFiles(file) : [file];
  });
}
const sources = [...new Set([
  ...Object.values(moduleByGroup).flatMap(file => collectFiles(path.posix.dirname(file))),
  ...collectFiles('config/apps/portal/src/tool'),
  'config/apps/portal/src/pages/functions/[slug].astro',
  'config/apps/portal/src/pages/functions/index.astro',
  'config/apps/portal/src/main1/catalogue.mjs',
  'config/apps/portal/src/main1/index.astro',
  'config/apps/portal/src/pages/index.astro',
  'config/apps/portal/public/tool-ping.json',
])].toSorted();
const sourceHashes = {};
for (const file of sources) {
  const bytes = fs.readFileSync(file), text = bytes.toString('utf8');
  assert.ok(!/\b[A-Za-z]:[\\/]|(?:\bLenovo\b)|\/Users\/[^/]+\/|\/home\/[^/]+\//.test(text), 'Machine path or current username in application source: ' + file);
  assert.ok(fs.statSync(file).mtimeMs <= browserStart + 1000, 'Application source changed after the complete browser run started: ' + file);
  sourceHashes[file] = sha256(bytes);
}
for (const file of [...Object.values(moduleByGroup), ...collectFiles('config/apps/portal/src/net')]) {
  assert.ok(fs.statSync(file).mtimeMs <= unit.startTime + 1000, 'Algorithm source changed after unit tests started: ' + file);
}
for (const file of ['tests/phase5-calculation.test.mjs', 'tests/phase5-development.test.mjs', 'tests/phase5-text.test.mjs']) {
  assert.ok(fs.statSync(file).mtimeMs <= unit.startTime + 1000, 'Unit test source changed after its report was produced: ' + file);
}

const edgeNames = ['routes', 'checksum', 'csv', 'xml-markdown', 'regex-isolation', 'live-and-ping', 'copy-export-privacy'];
const proofs = {};
function currentProof(project, name) {
  const file = path.join(reports, 'phase5-' + project + '-' + name + '.json');
  assert.ok(fs.statSync(file).mtimeMs >= browserStart - 1000, 'Stale supplementary browser proof: ' + name);
  return read(file);
}
const abcHash = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const unicodeHash = '25feb68e8651a1e87d13b2a93c080d75e40174800e19388820c27be17009cd66';
for (const project of ['desktop', 'mobile']) {
  const defaults = {};
  for (const tool of tools) {
    const title = 'Phase 5 ' + tool.requirements.join('/') + ' ' + tool.id + ' actual form computes its known default';
    assert.equal(browserChecks.filter(check => check.title === title && check.project === project).length, 1, 'Missing actual default check: ' + tool.id);
    const p = currentProof(project, 'default-' + tool.id);
    assert.equal(p.id, tool.id);
    assert.deepEqual(p.requirements, tool.requirements);
    assert.deepEqual(p.errors, []);
    assert.ok(p.outputLength > 0 && p.outputLength <= 4 * 1024 * 1024);
    assert.equal(p.diagnostic.id, tool.id);
    assert.equal(p.diagnostic.lastTool, tool.id);
    assert.equal(p.diagnostic.busy, false);
    assert.ok(p.diagnostic.runs >= 1 && p.diagnostic.successes >= 1);
    if (tool.id === 'csv') {
      // This independent known fixture uses CSV CRLF records. HTML textarea.value
      // exposes LF; state.resultLength counts the canonical result before display.
      // Accept exactly this normalization, not arbitrary output-length differences.
      const canonical = 'name,note\r\n文明,"逗号,在这里"';
      const displayed = 'name,note\n文明,"逗号,在这里"';
      assert.equal(p.output, displayed, 'Default CSV display must match its exact two known records');
      assert.equal(p.outputLength, displayed.length);
      assert.equal(p.diagnostic.resultLength, canonical.length);
      p.displayNormalization = {
        canonicalFixture: canonical, displayedFixture: displayed,
        canonicalLength: canonical.length, displayedLength: displayed.length,
        rows: [['name', 'note'], ['文明', '逗号,在这里']],
        scope: 'Independent default fixture; this is not a default-download capture. Actual CSV download bytes are checked separately in the csv edge proof.',
      };
    } else if (['keyboard', 'pointer', 'screen'].includes(tool.id)) assert.ok(p.diagnostic.resultLength > 0);
    else assert.equal(p.diagnostic.resultLength, p.outputLength);
    if (tool.id === 'password') assert.ok(!Object.hasOwn(p, 'output'), 'Generated password-like string must not be recorded');
    else { assert.equal(typeof p.output, 'string'); assert.equal(p.output.length, p.outputLength); }
    defaults[tool.id] = p;
  }
  const p = Object.fromEntries(edgeNames.map(name => [name, currentProof(project, name)]));
  assert.equal(p.routes.routes.length, 35);
  assert.deepEqual(p.routes.routes.map(row => row.id).toSorted(), tools.map(tool => tool.id).toSorted());
  assert.ok(p.routes.routes.every(row => row.status === 200));
  assert.ok(p.routes.directory && p.routes.searchJson);
  assert.equal(p.checksum.unicodeHash, unicodeHash);
  assert.equal(p.checksum.largeFileRejected, true);
  assert.ok(p.checksum.requests.every(request => request.method === 'GET' && !request.body && !/unicode-never-upload|oversized-never-upload|%E4%BD%A0/.test(request.url)));
  assert.deepEqual(p.csv.cells, [['name', 'note'], ['文明', '一行,逗号\n第二行'], ['a"b', '=1+1']]);
  assert.equal(p.csv.roundTrip, true);
  assert.equal(p.csv.filename, 'ocv-csv.csv');
  assert.equal(fs.readFileSync(path.join(reports, 'phase5-' + project + '-quoted.csv'), 'utf8'), p.csv.canonical);
  assert.ok(p['xml-markdown'].xmlEquivalent && p['xml-markdown'].cdata && p['xml-markdown'].dtdRejected);
  assert.equal(p['xml-markdown'].executableTags, 0);
  assert.deepEqual(p['xml-markdown'].externalRequests, []);
  assert.ok(p['regex-isolation'].responsiveDuringWorker && p['regex-isolation'].cancelled);
  assert.ok(p['regex-isolation'].timeoutMs > 0 && p['regex-isolation'].timeoutMs < 12000);
  assert.deepEqual(p['regex-isolation'].valid.matches.map(row => [row.index, row.value, row.namedGroups.word]), [[0, 'one', 'one'], [7, 'two', 'two']]);
  assert.match(p['live-and-ping'].key, /key\tq[\s\S]*code\tKeyQ/);
  assert.match(p['live-and-ping'].pointer, /clientX \/ clientY\t123 \/ 234/);
  assert.ok(p['live-and-ping'].viewport.includes('CSS px'));
  assert.equal(p['live-and-ping'].pingRequests.length, 1);
  assert.equal(p['live-and-ping'].pingRequests[0].method, 'GET');
  assert.equal(new URL(p['live-and-ping'].pingRequests[0].url).pathname, '/tool-ping.json');
  assert.match(p['live-and-ping'].ping, /不能当作网络速度/);
  const privacy = p['copy-export-privacy'];
  assert.ok(privacy.copied && privacy.downloaded && privacy.noInputStorage && privacy.noRandomStringStorage);
  assert.equal(privacy.filename, 'ocv-text-dedupe.txt');
  assert.equal(fs.readFileSync(path.join(reports, 'phase5-' + project + '-canonical.txt'), 'utf8'), privacy.canonical);
  assert.equal(defaults.hash.output, abcHash);
  assert.equal(defaults['file-checksum'].output, abcHash);
  assert.equal(defaults.scientific.output, '1');
  assert.equal(defaults.matrix.output, '5\t5\n5\t5');
  assert.equal(defaults.radix.output, '20000000000001');
  proofs[project] = { defaults, edges: p };
}

// All Docker commands below inspect the running deployment. They never pull, build, start, stop, or delete.
const depsRoot = process.env.OCV_DEPS_ROOT;
const localWindows = process.platform === 'win32' && Boolean(depsRoot);
const dockerBinary = process.env.OCV_DOCKER_BIN || (localWindows ? path.join(depsRoot, 'docker-app/resources/bin/docker.exe') : 'docker');
const dockerEnvironment = localWindows ? {
  ...process.env,
  USERPROFILE: path.join(depsRoot, 'docker-desktop'),
  APPDATA: path.join(depsRoot, 'docker-desktop/appdata/Roaming'),
  LOCALAPPDATA: path.join(depsRoot, 'docker-desktop/appdata/Local'),
  COMPOSE_PARALLEL_LIMIT: '1',
} : process.env;
function docker(args) {
  const result = spawnSync(dockerBinary, args, { encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024, env: dockerEnvironment });
  assert.equal(result.status, 0, result.error?.message || result.stderr || 'Docker command failed');
  return result.stdout;
}
const compose = args => docker(['compose', '-p', 'omnicivitas', '-f', 'compose.yaml', '--profile', '*', ...args]);
let storage;
if (localWindows) {
  const started = Date.now();
  const result = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/Confirm-DockerStorage.ps1'], {
    encoding: 'utf8', timeout: 60000, env: process.env,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'Physical Docker storage guard failed');
  storage = read(path.join(runtime, 'docker-storage.json'));
  assert.ok(Date.parse(storage.verifiedAt) >= started - 1000);
  assert.equal(storage.pullPermitted, true);
  assert.ok(storage.disks.length >= 2);
  assert.ok(storage.actualVmMemoryBytes <= 9 * 1024 ** 3 + 64 * 1024 ** 2, 'Phase 5 uses the bounded daily VM mode');
} else storage = { localWindowsPhysicalGuardApplicable: false, note: 'No Windows F-drive claim on this platform; the current daemon is inspected below.' };

const containerIds = compose(['ps', '-q']).trim().split(/\s+/).filter(Boolean);
assert.equal(containerIds.length, 6);
const containers = JSON.parse(docker(['inspect', ...containerIds]));
const core = containers.map(container => ({
  service: container.Config.Labels['com.docker.compose.service'], health: container.State.Health?.Status,
  running: container.State.Running, limitMiB: container.HostConfig.Memory / 1048576,
  swapLimitMiB: container.HostConfig.MemorySwap / 1048576, cpus: container.HostConfig.NanoCpus / 1000000000,
  pidsLimit: container.HostConfig.PidsLimit, logConfig: container.HostConfig.LogConfig, image: container.Image,
}));
assert.deepEqual(core.map(service => service.service).toSorted(), ['edge', 'gateway', 'next', 'portal', 'postgres', 'redis']);
assert.ok(core.every(service => service.running && service.health === 'healthy' && service.limitMiB > 0 && service.cpus > 0 && service.pidsLimit > 0));
assert.ok(core.every(service => service.swapLimitMiB === service.limitMiB && service.logConfig.Config['max-size'] && service.logConfig.Config['max-file']));
const totalCapsMiB = core.reduce((sum, service) => sum + service.limitMiB, 0);
assert.equal(totalCapsMiB, 1728);
const builder = JSON.parse(docker(['inspect', 'buildx_buildkit_ocv-budget-builder0']))[0];
assert.equal(builder.State.Running, false);
assert.equal(builder.HostConfig.Memory / 1048576, 3072);

const base = new URL(process.env.OCV_BASE_URL || 'http://127.0.0.1:8080');
const HTTP = [];
for (const url of new Set(['/', '/functions/', ...catalogue.map(row => row.url), ...tools.map(tool => '/functions/' + tool.id + '/'), '/identity/login/', '/identity/register/'])) {
  assert.ok(url.startsWith('/') && !url.startsWith('//'));
  const response = await fetch(new URL(url, base), { signal: AbortSignal.timeout(10000) });
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, 200, url);
  if (/^\/functions\/[^/]+\/$/.test(url) && tools.some(tool => url === '/functions/' + tool.id + '/')) assert.ok(bytes.toString('utf8').includes('id="tool-form"'), 'Tool route is still a placeholder: ' + url);
  HTTP.push({ url, status: response.status, sha256: sha256(bytes) });
}
const backendRoutes = [];
for (const route of ['/api/auth/login', '/api/auth/register', '/api/login', '/api/register']) for (const method of ['GET', 'POST']) {
  const response = await fetch(new URL(route, base), { method, signal: AbortSignal.timeout(10000) });
  await response.arrayBuffer();
  assert.equal(response.status, 404, method + ' ' + route);
  backendRoutes.push({ route, method, status: response.status });
}
const query = 'SELECT (SELECT count(*) FROM ocv_unused.users),(SELECT count(*) FROM ocv_unused.user_passwords),(SELECT count(*) FROM ocv_unused.login_sessions);';
const emptyAccountCounts = compose(['exec', '-T', 'postgres', 'sh', '-c', 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c \'' + query + '\'']).trim();
assert.equal(emptyAccountCounts, '0|0|0', 'The real PostgreSQL dormant account tables must stay empty');

const packageVersions = { marked: '18.0.14', dompurify: '3.4.16', papaparse: '5.7.0' };
const portalPackage = read('config/apps/portal/package.json');
const notices = fs.readFileSync('THIRD_PARTY_NOTICES.txt', 'utf8');
const licenseSource = 'docs/PHASE-5-SOURCES.md';
const licenseDocument = fs.readFileSync(licenseSource, 'utf8');
const documentedLicenses = [...licenseDocument.matchAll(/^\| \[([^\]]+\.txt)\]\(\.\.\/config/apps\/portal\/public\/licenses\/([^)]+)\) \| (\d+) \| \x60([a-f0-9]{64})\x60 \|$/gm)].map(match => {
  assert.equal(match[1], match[2], 'License filename and source link disagree');
  assert.match(match[1], /^[a-z0-9A-Z._-]+\.txt$/);
  return { name: match[1], bytes: Number(match[3]), sha256: match[4] };
});
assert.equal(documentedLicenses.length, 6, 'The source document must record six original license files');
assert.equal(new Set(documentedLicenses.map(item => item.name)).size, 6);
assert.deepEqual(fs.readdirSync('config/apps/portal/public/licenses').toSorted(), documentedLicenses.map(item => item.name).toSorted());
const publicNotice = fs.readFileSync('config/apps/portal/public/third-party-notices.txt');
assert.deepEqual(publicNotice, fs.readFileSync('THIRD_PARTY_NOTICES.txt'), 'Root and publicly served attribution declarations differ');
const licenseHTTP = [];
for (const item of [
  { file: 'config/apps/portal/public/third-party-notices.txt', url: '/third-party-notices.txt', bytes: publicNotice.length, sha256: sha256(publicNotice) },
  ...documentedLicenses.map(item => ({ ...item, file: 'config/apps/portal/public/licenses/' + item.name, url: '/licenses/' + item.name })),
]) {
  const local = fs.readFileSync(item.file);
  assert.equal(local.length, item.bytes, 'Original license byte count changed: ' + item.file);
  assert.equal(sha256(local), item.sha256, 'Original license hash changed: ' + item.file);
  const response = await fetch(new URL(item.url, base), { signal: AbortSignal.timeout(10000) });
  const published = Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, 200, 'License was not published: ' + item.url);
  assert.deepEqual(published, local, 'Published license bytes differ: ' + item.url);
  assert.equal(sha256(published), item.sha256);
  licenseHTTP.push({ file: item.file, url: item.url, status: response.status, bytes: published.length, sha256: sha256(published), source: item.url === '/third-party-notices.txt' ? 'THIRD_PARTY_NOTICES.txt' : licenseSource });
}
const dependencies = Object.entries(packageVersions).map(([name, version]) => {
  assert.equal(portalPackage.dependencies[name], version);
  assert.ok(new RegExp(name, 'i').test(notices), 'Missing third-party notice: ' + name);
  const location = fs.realpathSync('config/apps/portal/node_modules/' + name);
  const manifest = read(path.join(location, 'package.json'));
  assert.equal(manifest.version, version);
  if (depsRoot) assert.ok(location.toLowerCase().startsWith(fs.realpathSync(depsRoot).toLowerCase() + path.sep), 'Dependency payload outside configured local dependency root: ' + name);
  return { name, version, license: manifest.license, actualLocalLocation: depsRoot ? location : undefined, verifiedUsage: name === 'papaparse' ? ['B045', 'quoted CSV browser round trip'] : ['B044', 'safe browser Markdown preview'], notice: 'THIRD_PARTY_NOTICES.txt' };
});
assert.equal(portalPackage.dependencies.mathjs, '15.2.0');
const memorySamples = read(path.join(runtime, 'phase5-memory.json'));
assert.ok(Array.isArray(memorySamples) && memorySamples.length > 0);
const memory = memorySamples.at(-1);
assert.ok(Number.isFinite(memory.totalWorkingSetMiB) && memory.totalWorkingSetMiB > 0);
assert.ok(Date.parse(memory.sampledAt) >= browserEnd - 1000, 'Memory sample must follow the completed browser run');
assert.ok(Array.isArray(memory.processes) && memory.processes.length > 0);

const unitPatterns = {
  base64: /Base64/i, json: /JSON/, xml: null, text: /Unicode counts/, 'text-dedupe': /line dedupe/,
  'text-sort': /line sorts/, 'text-case': /case conversion/, markdown: null, csv: /CSV|PapaParse/,
  ascii: /ASCII/, morse: /Morse/, timestamp: /timestamp|ISO parsing/, 'time-zone': /fixed IANA zones/,
  convert: /bounded unit/, calculator: /Math\.js basic|expression surface/, scientific: /Math\.js scientific|expression surface/,
  matrix: /matrix/i, radix: /BigInt|base validators/, color: /color|RGB/i, roman: /Roman/, permissions: /Unix permission/,
  regex: /RegExp|empty Unicode|regex caller/, uuid: /descriptor UUID/, random: /uniform integer/,
  password: /random strings/, hash: /SHA-256/, 'file-checksum': /SHA-256/,
  'http-status': /HTTP\/MIME/, mime: /HTTP\/MIME/, keyboard: /live detector/, pointer: /live detector/,
  screen: /live detector/, 'user-agent': null, capabilities: null, ping: /ping only/,
};
const edgeMapping = {
  xml: ['xml-markdown'], markdown: ['xml-markdown'], csv: ['csv'], regex: ['regex-isolation'],
  'file-checksum': ['checksum'], keyboard: ['live-and-ping'], pointer: ['live-and-ping'],
  screen: ['live-and-ping'], ping: ['live-and-ping'], password: ['copy-export-privacy'],
  'text-dedupe': ['copy-export-privacy'], json: ['routes'],
};
for (const tool of tools) {
  const item = phaseItems.find(row => row.id === tool.requirements[0]);
  item.status = 'verified';
  const extra = tool.id === 'regex' ? ['config/apps/portal/src/net/regex.mjs', 'config/apps/portal/src/net/w.worker.js']
    : tool.id === 'http-status' ? ['config/apps/portal/src/net/codes.json']
      : tool.id === 'mime' ? ['config/apps/portal/src/net/mime.json'] : tool.id === 'ping' ? ['config/apps/portal/public/tool-ping.json'] : [];
  item.implementation = [...new Set([...(item.implementation || []), moduleFor(tool.id), 'config/apps/portal/src/tool/Tool.astro', 'config/apps/portal/src/tool/run.js', ...extra])];
  const browserEvidence = ['desktop', 'mobile'].flatMap(project => [
    ref('phase5-' + project + '-default-' + tool.id + '.json'),
    ...(edgeMapping[tool.id] || []).map(name => ref('phase5-' + project + '-' + name + '.json')),
  ]);
  const pattern = unitPatterns[tool.id];
  const matchedUnits = pattern ? unitChecks.filter(check => pattern.test(check.title)) : [];
  item.verification = [...new Set([...(item.verification || []), ...browserEvidence, ...matchedUnits.map(check => unitRef + ' :: ' + check.file + ' :: ' + check.title)])];
  item.currentPhase5 = {
    tool: tool.id, url: '/functions/' + tool.id + '/', unitChecks: matchedUnits,
    browserChecks: browserChecks.filter(check => check.title === 'Phase 5 ' + tool.requirements.join('/') + ' ' + tool.id + ' actual form computes its known default'),
    edgeProofs: edgeMapping[tool.id] || [],
    note: !pattern ? 'This browser-native operation is verified in real desktop/mobile browsers, not falsely attributed to DOM-less unit tests.' : 'Algorithm unit tests and real desktop/mobile form operation both passed.',
  };
}
assert.ok(phaseItems.every(row => row.status === 'verified' && row.implementation.length && row.verification.length));
for (const [id, original] of untouchedRequirements) assert.equal(JSON.stringify(ledger.requirements.find(row => row.id === id)), original, 'Unrelated requirement mutated: ' + id);
assert.equal(JSON.stringify({
  sourceHash: ledger.sourceHash, promptSourceHash: ledger.promptSourceHash,
  numbered: ledger.requirements.map(({ id, text, sourceLine, source, phase }) => ({ id, text, sourceLine, source, phase })),
  unnumbered: ledger.unnumbered, stackCategories: ledger.stackCategories, promptParagraphs: ledger.promptParagraphs,
}), immutable, 'Original requirement content or phase mapping changed');
const technologies = read('docs/technologies.json');
assert.equal(technologies.technologies.length, 146);
assert.equal(technologies.originalCategories, 34);
const acceptedAt = new Date().toISOString();
const limitations = [
  'Only phase 5 is accepted. Phase 6 is not authorized; its remaining placeholder routes are still explicitly unopened.',
  'These are browser-local tools. XML and Markdown previews require JavaScript and browser DOM APIs; no SSR tool execution is claimed.',
  'Only six core services run. Optional language/database/messaging/monitoring services and complete-stack end-to-end testing were not rerun.',
  'The old phase 4 21-check dormant backend probe is historical. This run freshly verifies account API 404 and real empty PostgreSQL tables only.',
  'Intentional overlap and mobile clipping remain. Actual keyboard/focus/raise controls complete tools; passing browser tests is not a promise of tidy mobile layout.',
  'Math.js uses finite JavaScript numbers for scalar calculations; the BigInt radix tool preserves arbitrary integer precision within its digit limit.',
  'The working-set measurement is one sample after tests, includes shared/file-cache pages, and is not a long-term peak or FPS guarantee.',
  'The public release portability audit, clean clone, cross-platform installation, and supplied-image redistribution licenses remain phase 9 work.',
];
const report = {
  phase: 5, status: 'complete', revision: 'phase-5-tools', acceptedAt, nextPhaseAuthorized: false,
  previousAcceptance: 'docs/interaction-acceptance.json',
  requirementCount: 35, requirements: phaseItems,
  browser: { report: browserRef, stats: suite.stats, count: 134, phase5Count: 84, baselineRegressionCount: 50, checks: browserChecks, proofs },
  unit: { report: unitRef, count: 43, checks: unitChecks, startTime: unit.startTime },
  HTTP, backendRoutes, emptyAccountCounts, core, totalCapsMiB, builderStopped: true, builderCapMiB: 3072,
  storage, memory, sourceHashes, dependencies, licenseHTTP,
  licenseSources: { file: licenseSource, sha256: sha256(Buffer.from(licenseDocument)), documentedLicenses },
  sourceIntegrity: { check: originalLedgerCheck, numbered: 732, originalTechnologies: 146, originalCategories: 34, sourceHash: ledger.sourceHash, promptSourceHash: ledger.promptSourceHash },
  guarantees: {
    algorithms: '35 actual forms and known outputs in both desktop/mobile browsers; meaningful algorithms also have 43 fresh unit checks.',
    localInput: 'Browser proofs observe input/random-string absence from storage/diagnostics and GET-only traffic; there is no form upload.',
    export: 'Actual clipboard Unicode text agrees after platform newline normalization (Windows may return LF as CRLF). Downloaded Blob UTF-8 bytes remain exactly canonical; CSV CRLF bytes match the known fixture and parse back without altered cells or formula strings.',
    worker: 'Pathological JavaScript RegExp runs in a disposable Worker, times out after its 1.5-second deadline, cancels and recovers while the main UI remains responsive.',
    libraries: 'Real Math.js scientific/matrix computations, marked + DOMPurify browser preview, and PapaParse quoted CSV parsing; installing a package alone is not evidence.',
    licenses: 'The deployed attribution declaration and all six documented original license files return HTTP 200 with byte-for-byte and SHA-256 equality to local sources; package installation is not used as proof of publication.',
    bounds: 'Text/CSV input 2 MiB, output 4 MiB, CSV 5,000 rows/256 columns, local checksum files 8 MiB; XML DTD/external entities rejected; scalar AST and matrix sizes bounded.',
  },
  limitations,
};
ledger.currentPhase5 = { name: report.revision, status: 'complete', acceptedAt, evidence: 'docs/phase-5-acceptance.json', requirementCount: 35, browserReport: browserRef, unitReport: unitRef, originalNumberedTextsPreserved: true, nextPhaseAuthorized: false };
technologies.currentPhase5 = {
  evidence: 'docs/phase-5-acceptance.json', newDependencies: dependencies, originalTechnologiesPreserved: 146, originalCategoriesPreserved: 34,
  actualUses: [
    { name: 'Math.js', version: '15.2.0', implementation: moduleByGroup.calculation, verification: ['desktop', 'mobile'].map(project => ref('phase5-' + project + '-default-scientific.json')) },
    { name: 'Web Worker', implementation: ['config/apps/portal/src/net/w.worker.js'], verification: ['desktop', 'mobile'].map(project => ref('phase5-' + project + '-regex-isolation.json')) },
    { name: 'marked / DOMPurify', implementation: moduleByGroup.text, verification: ['desktop', 'mobile'].map(project => ref('phase5-' + project + '-xml-markdown.json')) },
    { name: 'PapaParse', implementation: moduleByGroup.text, verification: ['desktop', 'mobile'].map(project => ref('phase5-' + project + '-csv.json')) },
  ],
};

const escape = value => String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>');
let requirementTable = fs.readFileSync('docs/REQUIREMENTS.md', 'utf8');
for (const row of phaseItems) {
  const line = '| ' + [row.id, row.sourceLine, row.phase, row.status, escape(row.text), escape([...row.implementation, ...row.verification].join('; '))].join(' | ') + ' |';
  assert.match(requirementTable, new RegExp('^\\| ' + row.id + ' \\|.*$', 'm'));
  requirementTable = requirementTable.replace(new RegExp('^\\| ' + row.id + ' \\|.*$', 'm'), () => line);
}
const memoryMiB = Math.round(memory.totalWorkingSetMiB * 10) / 10;
const rows = phaseItems.map(row => '| ' + [row.id, escape(row.text), escape(row.currentPhase5.url), 'verified', escape(row.implementation[0]), '桌面/手机默认值' + (row.currentPhase5.unitChecks.length ? '；算法单测 ' + row.currentPhase5.unitChecks.length + ' 项' : '；浏览器 DOM 实测') + (row.currentPhase5.edgeProofs.length ? '；' + row.currentPhase5.edgeProofs.join(', ') : '')].join(' | ') + ' |');
const markdown = [
  '# 第五阶段验收',
  '',
  acceptedAt + '。本阶段 35 条要求逐条 verified；35 个真实工具页与工具目录已接入现有门户和搜索。第四阶段的扉页、两层光场、失修窗口和互动继续保留。第六阶段未授权，本阶段完成后停止。',
  '',
  '新完整浏览器报告：134/134（桌面/手机各 67；84 项本阶段 + 50 项原界面回归；无失败、跳过、重试拼接或 flaky）。算法与边界单测 43/43。报告索引：[phase-5-acceptance.json](phase-5-acceptance.json)，原始运行文件 ' + escape(browserRef) + '、' + escape(unitRef) + '。',
  '',
  '## 逐条核对',
  '',
  '| 编号 | 原文 | 页面 | 状态 | 主要源码 | 证据 |',
  '| --- | --- | --- | --- | --- | --- |',
  ...rows,
  '',
  '## 实测结果',
  '',
  '- 真正使用 Math.js 解析常见科学函数及计算 2×2/3×3 矩阵；标量白名单拒绝赋值、属性、范围、数组与无限值。安全整数原样呈现；进制使用 BigInt。',
  '- 时间戳明确秒/毫秒，ISO 日期须带时区并验证历法；Intl 时区转换覆盖夏令时跳跃/重复小时与历史年份。',
  '- 正则的灾难性回溯只在可终止 Worker 中执行，1.5 秒期限、取消、恢复与主线程计时均在真实浏览器完成。',
  '- Markdown 用 marked 和 DOMPurify，脚本/事件/iframe/外部请求不进入预览；XML 混合内容、CDATA 和有效文本保留，DTD/外部实体拒绝。',
  '- CSV 使用 PapaParse 处理引号、逗号、换行和 UTF-8；实际下载的 CRLF 字节与独立已知样本相同，重新解析的单元格无损，公式字符串仍为原数据。剪贴板 Unicode 文本按平台换行规范化后内容一致（Windows 可能读回 CRLF）；Blob 下载的 UTF-8 原字节与规范结果相同。',
  '- 小文件 SHA-256 为 Web Crypto 实算，超过 8 MiB 在读取前拒绝，不上传文件；输入和随机字符串不写存储或诊断，账户 API 未挂载。',
  '- 键盘、指针、视口使用实际浏览器事件；请求耗时只对本站固定静态 ping 发起一次 GET，不能当作网络测速。',
  '',
  '## 运行与边界',
  '',
  HTTP.length + ' 个页面 HTTP 200；8 次账户 GET/POST 均为 404；真实 PostgreSQL 三张停用账户表计数为 0|0|0。只运行六个健康 core，内存上限合计 ' + totalCapsMiB + ' MiB，CPU/PID/swap/日志边界实际存在；3 GiB builder 已停止。最后 Docker/WSL 工作集采样 ' + memoryMiB + ' MiB，采样时间 ' + memory.sampledAt + '，不代表长期峰值。',
  '',
  '新增 marked 18.0.14、DOMPurify 3.4.16、PapaParse 5.7.0；精确版本、真实本地目录和许可证登记见 JSON 与 THIRD_PARTY_NOTICES.txt，真实用途见上述浏览器证明。现有 Math.js 15.2.0 被实际调用。732 条原文/行号/hash、146 原技术和 34 来源类别完整；第八阶段仍为原状态，未顺手完成。',
  '',
  '公开 /third-party-notices.txt 与 /licenses/ 下六份原许可均实际 HTTP 200，逐字节与本地文件相同；六份许可字节数和 SHA-256 另对照 PHASE-5-SOURCES.md。部署证据见 JSON 的 licenseHTTP，不借包已安装推定许可已发布。',
  '',
  '## 未宣称完成的事项',
  '',
  ...limitations.map(limit => '- ' + limit),
  '',
  '阶段停点：[phase-state.json](phase-state.json)。第六阶段等待用户授权。',
  '',
].join('\n');

// Commit evidence only after every proof, source, live-service, and immutability check above succeeds.
write('docs/phase-5-acceptance.json', report);
fs.writeFileSync('docs/PHASE-5-ACCEPTANCE.md', markdown);
write('docs/requirements.json', ledger);
fs.writeFileSync('docs/REQUIREMENTS.md', requirementTable);
write('docs/technologies.json', technologies);
const state = {
  ...previousState, phase: 5, status: 'complete', nextPhaseAuthorized: false, updatedAt: acceptedAt,
  previousAcceptance: 'docs/interaction-acceptance.json', acceptance: 'docs/phase-5-acceptance.json', outstanding: [],
  activeWork: { ...previousState.activeWork, name: 'phase-5-tools', status: 'complete', scope: 'Phase 5 only; phase 6 not authorized.', acceptance: 'docs/phase-5-acceptance.json' },
};
delete state.activeRevision;
write('docs/phase-state.json', state);
console.log(ledgerCheck());
console.log('PASS: 35 requirements, 43 new unit checks, 134 fresh complete browser checks, ' + HTTP.length + ' HTTP pages, 6 healthy capped core services, real empty account tables, and stopped builder. Phase 6 is not authorized.');
