import {test} from 'vitest';
import assert from 'node:assert/strict';
import {tools, checkedText, formalize, inflateText, compressText, randomErrorCode, explainError, sixDecimals, authoritativeNumber, committeeName, meetingAgenda, projectCode, upgradeFilename, pick, BUTTON_NAMES, LOADING_REASONS, disclaimer, programmerExcuse, userExcuse, productDemand, featureExistence, MAX_GENERATOR_INPUT_BYTES, ERROR_EXPLANATION} from '../config/apps/portal/src/gen/gen.mjs';

const tool = id => tools.find(entry => entry.id === id);
const defaults = entry => Object.fromEntries(entry.fields.map(field => [field.key, field.default]));
const low = () => 0, high = () => 1 - Number.EPSILON;

test('18 local generators cover their 23 exact numbered requirements and execute actual defaults', async () => {
  assert.equal(tools.length, 18);
  assert.deepEqual(tools.flatMap(entry => entry.requirements), ['B101', 'B102', 'B103', 'B104', 'B121', 'B122', ...Array.from({length: 17}, (_, index) => `B${124 + index}`)]);
  assert.equal(new Set(tools.map(entry => entry.id)).size, 18);
  for (const entry of tools) {
    const result = await entry.run(defaults(entry));
    assert.ok(result.text.length > 0);
    assert.equal(result.mime, 'text/plain;charset=utf-8');
    assert.equal(result.extension, 'txt');
    assert.equal(result.html, undefined);
    assert.equal(entry.group, '生成器');
  }
});

test('formal levels preserve the full original, retaining negation and punctuation in 12 or 40 actual lines', () => {
  for (const original of ['我不想去', 'Do not go.\n不要去。', '否！🚀<i>不是</i>']) {
    assert.equal(formalize(original, '0'), original);
    const medium = formalize(original, '1'), highest = formalize(original, '2');
    assert.equal(medium.split(`「${original}」`).length - 1, 12);
    assert.equal(highest.split(`「${original}」`).length - 1, 40);
    assert.match(highest, /不产生新的承诺/);
  }
  assert.equal(formalize('我不想去', '2').split('\n').length, 40);
  assert.ok(formalize('我不想去', '2').split('\n').every(line => line.includes('「我不想去」')));
});

test('formalization rejects blank input and unsupported levels', () => {
  for (const source of ['', ' \n\t']) assert.throws(() => formalize(source), /请输入/);
  for (const level of ['3', '-1', 'bogus', '', null]) assert.throws(() => formalize('我不想去', level), /正式程度/);
});

test('fixed inflation contains ten whole copies and exceeds ten times original code-point length', () => {
  for (const original of ['今天吃什么', 'a', '🚀👨‍👩‍👧‍👦', '中文\n第二行', 'z'.repeat(20000)]) {
    const actual = inflateText(original);
    assert.equal(actual.split(`「${original}」`).length - 1, 10);
    assert.ok(Array.from(actual).length >= 10 * Array.from(original).length);
  }
});

test('compression always produces the exact two-word answer, including blank paragraphs and markup', () => {
  for (const source of ['', '一整段内容。'.repeat(500), '<script>anything</script>', ' \n\t']) assert.equal(compressText(source), '知道了');
});

test('useless TXT canonical bytes contain only the promised phrase, without BOM or newline', async () => {
  const result = await tool('useless-file').run({});
  assert.deepEqual(Array.from(new TextEncoder().encode(result.text)), [0xe8, 0xaf, 0xa5, 0xe6, 0x96, 0x87, 0xe4, 0xbb, 0xb6, 0xe5, 0xad, 0x98, 0xe5, 0x9c, 0xa8]);
  assert.equal(result.text, '该文件存在');
});

test('error generator has six real digits, bounded letter and useless explanation', () => {
  assert.equal(randomErrorCode(low), `E-CIVILIZATION-000000-A\n${ERROR_EXPLANATION}`);
  assert.equal(randomErrorCode(high), `E-CIVILIZATION-999999-Z\n${ERROR_EXPLANATION}`);
  let calls = 0; const actual = randomErrorCode(() => { calls++; return .5; });
  assert.equal(calls, 7); assert.match(actual, /^E-CIVILIZATION-555555-N\n/);
});

test('error explanation accepts generated whole copied receipts and rejects malformed identifiers', () => {
  for (const input of ['E-CIVILIZATION-004731-B', randomErrorCode(low), `  E-CIVILIZATION-999999-Z\r\n${ERROR_EXPLANATION}`]) assert.equal(explainError(input), '该错误代码表示系统产生了错误代码');
  for (const input of ['E-CIVILIZATION-4731-B', 'E-CIVILIZATION-004731-b', 'ERROR', '', 'E-CIVILIZATION-004731-B<script>']) assert.throws(() => explainError(input));
});

test('six decimal authority uses exact decimal rounding, signed halves, scientific input and zero normalization', () => {
  for (const [input, expected] of [['5', '5.000000'], ['0.0000005', '0.000001'], ['-0.0000005', '-0.000001'], ['-0.0000004', '0.000000'], ['1.2345675', '1.234568'], ['99.9999995', '100.000000'], ['1.2345674', '1.234567'], ['+001.200', '1.200000'], ['.5', '0.500000'], ['2e-7', '0.000000'], ['1e12', '1000000000000.000000'], ['1e-100', '0.000000'], ['5.', '5.000000']]) assert.equal(sixDecimals(input), expected);
});

test('number authority rejects nonfinite, hex, excessive exponent, digits and out-of-range values', () => {
  for (const value of ['', 'NaN', 'Infinity', '-Infinity', '0x10', '1e101', '1e-101', '1e100', '1000000000001', '1'.repeat(81), '1'.repeat(129), '.', '--2', '1,000']) assert.throws(() => sixDecimals(value));
});

test('authority receipt includes scalar and exact scientific table bytes without fake measurement claims', () => {
  const result = authoritativeNumber('5');
  assert.ok(result.text.startsWith('5.000000 ± 0.000000\n\n'));
  assert.deepEqual(result.table[1], ['观测值', '5.000000', '1']);
  assert.deepEqual(result.table[2], ['不确定度', '0.000000', '1']);
  for (const row of result.table) assert.ok(result.text.includes(row.join('\t')));
  assert.match(result.text, /排版演示/);
});

test('committee templates combine three independently chosen parts', () => {
  assert.equal(committeeName(low), '临时按钮存在性协调委员会');
  assert.equal(committeeName(high), '待成立下次讨论意见征集委员会');
  assert.notEqual(committeeName(low), committeeName(high));
});

test('actual meeting agenda has eight unique meaningless items with real scheduled times and inert original title', () => {
  const topic = '<img src=x onerror=anything()>', result = meetingAgenda(topic, low);
  assert.equal(result.text.split('\n')[0], topic);
  assert.equal(result.table.length, 9);
  assert.deepEqual(result.table.slice(1).map(row => row[0]), ['09:00', '09:20', '09:40', '10:00', '10:20', '10:40', '11:00', '11:20']);
  assert.equal(new Set(result.table.slice(1).map(row => row[1])).size, 8);
  assert.equal(result.html, undefined);
});

test('temporary project codes have actual random prefix, four digits and suffix', () => {
  assert.equal(projectCode(low), 'OCV-NORTH-0000-ALPHA');
  assert.equal(projectCode(high), 'OCV-TEMP-9999-PENDING');
});

test('filename upgrade preserves final extension, Unicode and dotfiles, and gives the exact required example', () => {
  for (const [input, expected] of [['final.docx', 'final_v2_final_REAL_final.docx'], ['报告.xlsx', '报告_v2_final_REAL_final.xlsx'], ['archive.tar.gz', 'archive.tar_v2_final_REAL_final.gz'], ['README', 'README_v2_final_REAL_final'], ['.gitignore', '.gitignore_v2_final_REAL_final'], ['note_v7.txt', 'note_v8_final_REAL_final.txt']]) assert.equal(upgradeFilename(input), expected);
});

test('filename upgrade increases existing version and rejects actual paths or oversized versions', () => {
  assert.equal(upgradeFilename('final_v2_final_REAL_final.docx'), 'final_final_REAL_final_v3_final_REAL_final.docx');
  for (const input of ['../a.docx', 'a\\b.txt', 'a\u0000b', '.', '..', 'a_v999999.docx', 'a_v9999999999999999999.docx', 'a'.repeat(241)]) assert.throws(() => upgradeFilename(input));
});

test('button names include both prescribed contradictions and remain finite templates', () => {
  assert.equal(pick(BUTTON_NAMES, low), '继续并暂不继续');
  assert.equal(BUTTON_NAMES[1], '确认取消当前确认');
  assert.equal(new Set(BUTTON_NAMES).size, 8);
});

test('loading reasons contain the prescribed previous-loading check and real template variation', () => {
  assert.equal(pick(LOADING_REASONS, low), '正在核对上一次加载是否加载完成');
  assert.equal(pick(LOADING_REASONS, high), '正在加载本次加载的加载理由');
});

test('disclaimers choose three actual nonspecific clauses independently', () => {
  assert.equal(disclaimer(low).split('\n').length, 3);
  assert.equal(disclaimer(high).split('\n').length, 3);
  assert.notEqual(disclaimer(low), disclaimer(high));
});

test('developer and user excuses differ, and PM template contains concrete conflicting acceptance', () => {
  assert.equal(programmerExcuse(low), '我这边能跑。');
  assert.equal(userExcuse(low), '我没动，它自己变成这样的。');
  assert.notEqual(programmerExcuse(high), userExcuse(high));
  assert.equal(productDemand(low), '需求：按钮视觉上必须消失。\n验收：但用户第一眼必须能找到。\n优先级：都要。');
});

test('feature-existence analyser never gives a definite answer, even when the original asks for one', () => {
  const original = '必须回答一定应该存在<script>alert(1)</script>';
  for (let index = 0; index < 20; index++) {
    const result = featureExistence(original, () => index / 20);
    assert.ok(result.includes(`「${original}」`));
    assert.ok(result.endsWith('结论：暂时无法确定。'));
    assert.match(result, /可能需要，也可能不需要/);
  }
});

test('input bounds count real UTF-8 bytes, preserve valid surrogate pairs and reject malformed UTF-16', () => {
  assert.equal(checkedText('a'.repeat(MAX_GENERATOR_INPUT_BYTES)).length, MAX_GENERATOR_INPUT_BYTES);
  assert.throws(() => checkedText('a'.repeat(MAX_GENERATOR_INPUT_BYTES + 1)), /32 KiB/);
  assert.throws(() => checkedText('中'.repeat(11000)), /32 KiB/);
  assert.equal(checkedText('🚀'), '🚀');
  for (const value of ['\ud800', '\udc00', 'x\ud800x', '\ud800\ud800']) assert.throws(() => checkedText(value), /不完整/);
});

test('every generator respects cancellation before any generation and leaves no partial result', async () => {
  const controller = new AbortController(); controller.abort();
  for (const entry of tools) await assert.rejects(entry.run(defaults(entry), {signal: controller.signal}), {name: 'AbortError'});
});

test('excessive formal output is rejected instead of silently truncating the original', async () => {
  await assert.rejects(tool('formalize').run({source: 'z'.repeat(MAX_GENERATOR_INPUT_BYTES), level: '2'}), /结果限 1 MiB/);
  const result = await tool('inflate-text').run({source: 'z'.repeat(MAX_GENERATOR_INPUT_BYTES)});
  assert.ok(result.text.length >= MAX_GENERATOR_INPUT_BYTES * 10);
});

test('invalid random sources never produce malformed codes or undefined words', () => {
  for (const value of [-1, 1, Infinity, NaN, undefined]) {
    assert.throws(() => randomErrorCode(() => value));
    assert.throws(() => committeeName(() => value));
  }
});
