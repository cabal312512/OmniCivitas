import { test } from 'vitest';
import assert from 'node:assert/strict';
import { tools, harmlessCookiePersonality } from '../config/apps/portal/src/misc/misc.mjs';
import { suitability, filenameRisk, variableMaturity, windowDiscipline, refreshAssessment, complicated, predict404, oddText, oddNumber, hashText, cryptographicChoice, QUESTIONNAIRE, DEMO_COOKIE_NAMES, LOADER_KINDS, progressValues, createProgressSequence, createWaitClock, createUndoChoice, trajectoryCertificate } from '../config/apps/portal/src/misc/model.mjs';

test('nineteen odd workbenches map all thirty-six original B rows exactly once', () => {
  assert.equal(tools.length, 19);
  assert.equal(new Set(tools.map(tool => tool.id)).size, 19);
  const expected = [...Array.from({ length: 20 }, (_, index) => `B${String(index + 81).padStart(3, '0')}`), ...Array.from({ length: 16 }, (_, index) => `B${index + 105}`)];
  assert.deepEqual(tools.flatMap(tool => tool.requirements), expected);
  assert.ok(tools.every(tool => tool.group === '日常' && typeof tool.run === 'function'));
  assert.equal(QUESTIONNAIRE.length, 14); assert.equal(new Set(QUESTIONNAIRE).size, 14);
  assert.equal(LOADER_KINDS.length * 4, 32);
});

test('the suitability score evaluates twenty finite independent terms and preserves decimal percentage', () => {
  const value = suitability('2026-10-03', '143.0.7499.0', '37');
  assert.equal(value.terms.length, 20); assert.equal(new Set(value.terms.map(([name]) => name)).size, 20);
  assert.ok(value.terms.every(([, term]) => Number.isFinite(term)));
  assert.equal(value.terms[0][1], (2026 % 97) * .73);
  assert.equal(value.terms[3][1], 6 * 6.7);
  assert.ok(value.percent >= 0 && value.percent < 100);
  assert.equal(Math.round(value.percent * 10), value.percent * 10);
  assert.notEqual(value.percent, suitability('2026-10-04', '143.0.7499.0', '37').percent);
  assert.notEqual(value.percent, suitability('2026-10-03', '144.0.7499.0', '37').percent);
  assert.notEqual(value.percent, suitability('2026-10-03', '143.0.7499.0', '38').percent);
});
test('suitability handles Gregorian leap days and rejects impossible dates, arbitrary version strings and infinities', () => {
  assert.doesNotThrow(() => suitability('2000-02-29', '1', '-1000000'));
  assert.doesNotThrow(() => suitability('0099-12-31', '99999999.99999999', '1000000'));
  for (const date of ['2026-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '0000-01-01', '2026-1-01']) assert.throws(() => suitability(date, '143', '37'));
  for (const version of ['Chrome 143', '143.', '.143', '1..2', '999999999', '1.2.3.4.5.6.7.8.9', '<script>']) assert.throws(() => suitability('2026-10-03', version, '37'));
  for (const number of ['Infinity', 'NaN', '0x12', '1000001', '-1000001', '']) assert.throws(() => suitability('2026-10-03', '143', number));
});
test('filename risk counts actual Unicode length, underscores and digits and grows with repeated final markers', () => {
  const result = filenameRisk('final_final_v2.docx');
  assert.equal(result.length, 19); assert.equal(result.underscores, 2); assert.equal(result.digits, 1); assert.equal(result.repeatedFinal, 2);
  assert.ok(result.risk > filenameRisk('final.docx').risk);
  const unicode = filenameRisk('🌍_二3.txt'); assert.equal(unicode.length, 8); assert.equal(unicode.underscores, 1); assert.equal(unicode.digits, 1);
  assert.equal(filenameRisk(`${'x'.repeat(220)}_123456789`).risk, 100);
});
test('variable maturity checks identifier syntax separately from its intentionally arbitrary score', () => {
  const value = variableMaturity('data2NewFinal');
  assert.equal(value.length, 13); assert.equal(value.capitals, 2); assert.equal(value.digits, 1); assert.equal(value.temporary, 3); assert.equal(value.validIdentifier, true);
  assert.equal(variableMaturity('变量_2').validIdentifier, true); assert.equal(variableMaturity('$id').validIdentifier, true);
  assert.equal(variableMaturity('2data').validIdentifier, false); assert.equal(variableMaturity('bad name').validIdentifier, false);
  assert.ok(variableMaturity('x'.repeat(240)).maturity <= 100);
});
test('window ratios diagnose tall and very wide shapes without assuming a local hardware resolution', () => {
  assert.equal(windowDiscipline(1440, 1000).verdict, '窗口暂未提出异议');
  assert.equal(windowDiscipline(400, 1000).verdict, '窗口缺乏组织纪律');
  assert.equal(windowDiscipline(3000, 1000).verdict, '窗口缺乏组织纪律');
  assert.equal(windowDiscipline(750, 1000).ratio, .75);
  for (const dimensions of [[0, 1], [1, 0], [-1, 1], [Infinity, 10], [1, NaN], [100001, 1]]) assert.throws(() => windowDiscipline(...dimensions));
});
test('refreshing really executes forty unrelated judgments and never triggers a navigation', () => {
  const value = refreshAssessment({ width: 1440, height: 1000, pixels: 1234, wheelEvents: 3, second: 20 });
  assert.equal(value.checks.length, 40); assert.equal(new Set(value.checks.map(check => check.name)).size, 40);
  assert.deepEqual(value.checks.map(check => check.number), Array.from({ length: 40 }, (_, index) => index + 1));
  assert.equal(value.approved, value.checks.filter(check => check.pass).length);
  assert.ok(['建议保持现状', '可以刷新，也可以不刷新'].includes(value.verdict));
  assert.throws(() => refreshAssessment({ pixels: Infinity }));
  assert.notDeepEqual(value.checks, refreshAssessment({ width: 1441, height: 1000, pixels: 1234, wheelEvents: 3, second: 20 }).checks);
});
test('complexifying creates sixteen prerequisite, constraint and risk rows, while preserving literal question data', () => {
  const question = '<img src=x onerror=alert(1)>', value = complicated(question);
  assert.equal(value.question, question); assert.equal(value.items.length, 16);
  assert.deepEqual([...new Set(value.items.map(item => item.kind))], ['前置条件', '约束', '风险']);
  assert.ok(value.items[0].content.includes(question));
  assert.deepEqual(value.items.map(item => item.number), Array.from({ length: 16 }, (_, index) => index + 1));
});
test('the 404 predictor is a deterministic character calculation and accepts URL-like data without fetching it', async () => {
  const value = predict404('https://example.invalid/<script>');
  assert.ok(value.probability >= 0 && value.probability <= 100);
  assert.deepEqual(value, predict404('https://example.invalid/<script>'));
  assert.notEqual(value.probability, predict404('/elsewhere/').probability);
  const tool = tools.find(tool => tool.id === 'page404-predict'), output = await tool.run({ fragment: value.fragment });
  assert.match(output.text, /概率不存在/); assert.match(output.text, /不访问网址/); assert.equal(output.html, undefined);
});
test('bounded odd text and decimal helpers reject empty, overlong, nondecimal and unsafe values', () => {
  assert.equal(oddText(' 🌍 ', '问题', 1), '🌍'); assert.equal(oddNumber('-1.25'), -1.25); assert.equal(oddNumber('.5'), .5);
  for (const source of ['', ' ', 3, 'x'.repeat(4001)]) assert.throws(() => oddText(source));
  for (const source of ['', '0x20', '1e4', 'NaN', 'Infinity', '1000001']) assert.throws(() => oddNumber(source));
  assert.equal(hashText('abc'), 0x1a47e90b);
});
test('pure descriptors produce actual defaults and inert output without requiring the optional infrastructure', async () => {
  const ids = ['site-suitability', 'filename-risk', 'variable-maturity', 'complexify', 'simplify', 'page404-predict'];
  for (const id of ids) { const tool = tools.find(tool => tool.id === id), input = Object.fromEntries(tool.fields.map(field => [field.key, String(field.default)])), result = await tool.run(input); assert.equal(typeof result.text, 'string'); assert.ok(result.text.length); assert.equal(result.html, undefined); }
  const result = await tools.find(tool => tool.id === 'simplify').run({ question: 'x'.repeat(4000) }); assert.equal(result.text, '需要处理');
  await assert.rejects(tools.find(tool => tool.id === 'simplify').run({ question: '' }));
});
test('crypto choice rejects the biased remainder tail, handles bounds and has a finite failure path', () => {
  const sequence = [0xffffffff, 17], crypto = { getRandomValues(array) { array[0] = sequence.shift(); return array; } };
  assert.equal(cryptographicChoice(3, crypto), 2); assert.equal(sequence.length, 0);
  assert.equal(cryptographicChoice(2, { getRandomValues(array) { array[0] = 0xffffffff; } }), 1);
  assert.equal(cryptographicChoice(1), 0);
  let attempts = 0; assert.throws(() => cryptographicChoice(3, { getRandomValues(array) { attempts++; array[0] = 0xffffffff; } }), /随机源/); assert.equal(attempts, 32);
  for (const limit of [0, -1, 1.5, 65537]) assert.throws(() => cryptographicChoice(limit));
});
test('real progress is monotonic, random progress is independent, and the overrun visibly reaches 120 before 100', () => {
  const samples = [0, 600, 1200, 1800, 2400, 2700, 2900, 3100, 3300, 9000].map(time => progressValues(time, 17));
  assert.deepEqual(samples.map(sample => sample.values[0]), [0, 20, 40, 60, 80, 90, 96.7, 100, 100, 100]);
  assert.ok(samples.every(sample => sample.values[1] === 17));
  assert.deepEqual(samples.slice(4, 9).map(sample => sample.values[2]), [120, 120, 120, 110, 100]);
  assert.equal(samples[7].complete, false); assert.equal(samples[8].complete, true);
  assert.throws(() => progressValues(-1, 5)); assert.throws(() => progressValues(0, 101));
});
test('a delayed first progress sample still displays 120 for fifteen hundred milliseconds before its finite return', () => {
  let now = 0; const sequence = createProgressSequence(() => now);
  now = 10000; const late = sequence.sample(17);
  assert.deepEqual(late.values, [100, 17, 120]); assert.equal(late.phase, 'peak'); assert.equal(late.complete, false);
  now = 11499; assert.equal(sequence.sample(23).values[2], 120); assert.equal(sequence.sample(23).complete, false);
  now = 11500; const returning = sequence.sample(42); assert.equal(returning.values[2], 120); assert.equal(returning.phase, 'returning'); assert.equal(returning.complete, false);
  now = 11700; assert.deepEqual(sequence.sample(5).values, [100, 5, 110]);
  now = 11900; assert.deepEqual(sequence.sample(9).values, [100, 9, 100]); assert.equal(sequence.sample(9).complete, true);
  now = 1000000; assert.equal(sequence.sample(0).complete, true); assert.equal(sequence.sample(0).values[2], 100);
});
test('normal progress cannot complete before the observed peak hold and return, and time cannot move the genuine bar backwards', () => {
  let now = 0; const sequence = createProgressSequence(() => now), genuine = [];
  genuine.push(sequence.sample(0).values[0]); now = 1200; const middle = sequence.sample(99); genuine.push(middle.values[0]); assert.equal(middle.values[2], 60); assert.equal(middle.complete, false);
  now = 2400; const peak = sequence.sample(1); genuine.push(peak.values[0]); assert.deepEqual(peak.values, [80, 1, 120]);
  now = 100; const backwards = sequence.sample(2); genuine.push(backwards.values[0]); assert.deepEqual(backwards.values, [80, 2, 120]); assert.equal(backwards.complete, false);
  now = 3899; const held = sequence.sample(3); genuine.push(held.values[0]); assert.equal(held.values[2], 120); assert.equal(held.complete, false);
  now = 4299; assert.equal(sequence.sample(4).complete, false); now = 4300; assert.equal(sequence.sample(5).complete, true);
  assert.ok(genuine.every((value, index) => index === 0 || value >= genuine[index - 1]));
  assert.throws(() => sequence.sample(-1)); assert.throws(() => sequence.sample(Infinity));
});
test('waiting does not start until requested, cannot be restarted early, and only finishes at fifteen actual seconds', () => {
  let now = 0; const wait = createWaitClock(() => now);
  assert.deepEqual(wait.snapshot(), { state: 'idle', elapsed: 0, completed: false });
  now = 1200; wait.start(); now = 1300; assert.equal(wait.snapshot().elapsed, 100);
  wait.start(); now = 16199; assert.equal(wait.snapshot().state, 'waiting'); assert.equal(wait.snapshot().completed, false);
  now = 16200; assert.deepEqual(wait.snapshot(), { state: 'finished', elapsed: 15000, completed: true });
  now = 200000; assert.equal(wait.snapshot().elapsed, 15000);
});
test('undo-revocation is an explicit three-step fictitious choice with invalid transitions rejected', () => {
  const model = createUndoChoice(); assert.equal(model.snapshot().state, 'unselected');
  assert.throws(() => model.revoke()); assert.throws(() => model.revokeRevocation());
  model.choose('先开会'); assert.equal(model.snapshot().state, 'active'); assert.throws(() => model.choose('后开会'));
  model.revoke(); assert.deepEqual(model.snapshot(), { state: 'revoked', choice: '先开会' }); assert.throws(() => model.revoke());
  model.revokeRevocation(); assert.deepEqual(model.snapshot(), { state: 'restored', choice: '先开会' }); assert.throws(() => model.revokeRevocation());
});
const circle = Array.from({ length: 33 }, (_, index) => [160 + Math.cos(index / 32 * Math.PI * 2) * 60, 130 + Math.sin(index / 32 * Math.PI * 2) * 60]);
test('the certificate is actual standalone SVG with the drawn path, exact identifier and no external resources', () => {
  const source = trajectoryCertificate(circle, 'CVN-1234567890ABCDEF');
  assert.match(source, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/); assert.match(source, /轨迹公证编号/); assert.match(source, /CVN-1234567890ABCDEF/);
  assert.match(source, /M220,202 L/); assert.match(source, /33 个采样点/); assert.match(source, /不具法律效力/);
  assert.equal((source.match(/<path /g) || []).length, 1);
  assert.doesNotMatch(source, /<script|onerror|href=|foreignObject|url\(/i);
});
test('trajectory certificate rejects open, tiny, oversized, invalid-coordinate and injected-identifier drawings', () => {
  for (const points of [[], circle.slice(0, 7), Array(2049).fill([10, 10]), circle.slice(0, 16), Array(8).fill([1, 1]), [...circle.slice(0, -1), [Infinity, 1]], [...circle.slice(0, -1), [-1, 2]], [...circle.slice(0, -1), [400, 2]]]) assert.throws(() => trajectoryCertificate(points, 'CVN-1234567890ABCDEF'));
  for (const id of ['', 'x', 'CVN-<script>', 'CVN-" onload="x', 'x'.repeat(81)]) assert.throws(() => trajectoryCertificate(circle, id));
});
function cookieContext(store) {
  const writes = [], window = { cookieStore: store, location: { href: 'https://example.test/functions/cookie-personality/', protocol: 'https:' } }, document = { defaultView: window };
  Object.defineProperty(document, 'cookie', { get() { throw new Error('PRIVATE COOKIE MUST NEVER BE ENUMERATED'); }, set(value) { writes.push(value); } });
  return { context: { lab: { ownerDocument: document } }, writes };
}
test('cookie personality writes exactly its own harmless keys and queries only those explicit names', async () => {
  const sets = [], gets = [], store = { async set(value) { sets.push(value); }, async get(value) { gets.push(value); const own = sets.find(item => item.name === value.name); return { name: own.name, value: own.value }; } };
  const { context, writes } = cookieContext(store), output = await harmlessCookiePersonality(context);
  assert.deepEqual(sets.map(value => value.name), DEMO_COOKIE_NAMES); assert.deepEqual(gets.map(value => value.name), DEMO_COOKIE_NAMES);
  assert.ok(sets.every(value => value.path === '/functions/cookie-personality/' && value.sameSite === 'lax' && value.expires > Date.now() && value.expires <= Date.now() + 3600000));
  assert.deepEqual(writes, []); assert.deepEqual(output.table.slice(1), [['ocv_demo_geometry', 'round'], ['ocv_demo_queue', 'later'], ['ocv_demo_margin', '7']]);
  assert.match(output.text, /不枚举其他 Cookie/);
});
test('cookie fallback uses only just-written known values, never a document.cookie getter', async () => {
  const { context, writes } = cookieContext(undefined), output = await harmlessCookiePersonality(context);
  assert.equal(writes.length, 3); assert.ok(writes.every(value => /Max-Age=3600; SameSite=Lax; Secure$/.test(value)));
  assert.deepEqual(writes.map(value => value.split('=')[0]), DEMO_COOKIE_NAMES); assert.match(output.text, /新写入值/);
});
test('denied Cookie Store operations fall back safely and untrusted existing cookie values are never returned', async () => {
  const failing = cookieContext({ async set() { throw new Error('denied'); }, async get() { throw new Error('unexpected'); } });
  const fallback = await harmlessCookiePersonality(failing.context); assert.equal(failing.writes.length, 3); assert.match(fallback.text, /新写入值/);
  const malicious = cookieContext({ async set() {}, async get({ name }) { return { name, value: '<script>private</script>' }; } });
  const result = await harmlessCookiePersonality(malicious.context); assert.doesNotMatch(JSON.stringify(result), /<script>|private/);
});
test('pre-aborted cookie work never creates a cookie', async () => {
  const { context, writes } = cookieContext(undefined), controller = new AbortController(); controller.abort(); context.signal = controller.signal;
  await assert.rejects(harmlessCookiePersonality(context), { name: 'AbortError' }); assert.deepEqual(writes, []);
});
