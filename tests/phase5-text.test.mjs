import { describe, expect, test } from 'vitest';
import { tools, encodeBase64, decodeBase64, textStatistics, encodeMorse, decodeMorse, asciiLetters, MAX_INPUT_BYTES, MAX_FILE_BYTES } from '../config/apps/portal/src/text/1.mjs';

const tool = id => tools.find(item => item.id === id);
const run = (id, input, context) => tool(id).run(input, context);

describe('phase 5 text/data tools: real conversions and bounded errors', () => {
  test('catalogue has all eleven original requirement mappings and unique IDs', () => {
    expect(tools.map(item => item.requirements[0])).toEqual(['B026', 'B027', 'B028', 'B040', 'B041', 'B042', 'B043', 'B044', 'B045', 'B059', 'B060']);
    expect(new Set(tools.map(item => item.id)).size).toBe(11);
    expect(tools.every(item => item.fields.some(field => field.key === 'source'))).toBe(true);
  });

  test('native Base64 handles Unicode, BOM, newlines and input above apply limits', async () => {
    expect(encodeBase64('文明🧪')).toBe('5paH5piO8J+nqg==');
    for (const source of ['', '\uFEFFHello\r\n文明 👨‍👩‍👧‍👦', '界'.repeat(100000)]) {
      expect(decodeBase64(encodeBase64(source))).toBe(source);
    }
    expect((await run('base64', { source: ' YQ\n', operation: 'decode' })).text).toBe('a');
  });

  test('Base64 rejects malformed alphabet/padding, noncanonical bits, bad UTF-8 and lone surrogates', async () => {
    for (const value of ['a', 'Y===', '=YQ=', 'YQ=', 'YQ==x', 'YR==', 'YQ-_', 'YQ==\u00a0']) expect(() => decodeBase64(value)).toThrow(/Base64/);
    expect(() => decodeBase64('/w==')).toThrow(/UTF-8/);
    expect(() => encodeBase64('\ud800')).toThrow(/Unicode/);
    await expect(run('base64', { source: 'a', operation: 'invalid' })).rejects.toThrow(/操作/);
  });

  test('JSON parser validates actual syntax and exports parse-equivalent JSON', async () => {
    const source = '{"nested":[0,false,null,{"文字":"<script>"}],"__proto__":"plain key"}';
    const formatted = await run('json', { source });
    expect(formatted.extension).toBe('json');
    expect(JSON.parse(formatted.text)).toEqual(JSON.parse(source));
    expect(formatted.text).toContain('\n  "nested"');
    expect((await run('json', { source, operation: 'compact' })).text).not.toContain('\n');
    expect((await run('json', { source: 'null' })).text).toBe('null');
    await expect(run('json', { source: '{"x":1,}' })).rejects.toThrow(/JSON 无效/);
  });

  test('JSON rejects nonfinite and unsafe integer values instead of exporting null or altered digits', async () => {
    for (const source of ['1e309', '{"nested":[0,{"x":-1e309}]}']) {
      await expect(run('json', { source })).rejects.toThrow(/有限数/);
    }
    for (const source of ['9007199254740993', '{"nested":[9007199254740993]}']) {
      await expect(run('json', { source })).rejects.toThrow(/安全精度.*字符串/);
    }
    expect((await run('json', { source: '{"n":9007199254740991,"big":"9007199254740993"}' })).text)
      .toContain('9007199254740991');
  });

  test('Unicode counts distinguish graphemes, code points, bytes and CRLF line boundaries', async () => {
    const stats = textStatistics('A\r\n猫 e\u0301👨‍👩‍👧‍👦');
    expect(stats.codePoints).toBe(13);
    expect(stats.graphemes).toBe(6);
    expect(stats.nonWhitespace).toBe(11);
    expect(stats.lines).toBe(2);
    expect(stats.utf8Bytes).toBe(35);
    expect(stats.words).toBe(3);
    expect(textStatistics('').lines).toBe(0);
    expect(textStatistics('one\rtwo\n').lines).toBe(3);
    const output = await run('text', { source: '文明' });
    expect(output.table.find(row => row[0] === 'Unicode 码点')[1]).toBe('2');
  });

  test('line dedupe preserves the first exact value, whitespace, casing and final blank row', async () => {
    expect((await run('text-dedupe', { source: 'a\r\na\r b\nb\nb\nA\n' })).text).toBe('a\n b\nb\nA\n');
  });

  test('line sorts are deterministic and code-point length counts emoji once', async () => {
    expect((await run('text-sort', { source: 'b\nA\na' })).text).toBe('A\na\nb');
    expect((await run('text-sort', { source: 'b\nA\na', direction: 'desc' })).text).toBe('b\na\nA');
    expect((await run('text-sort', { source: 'xx\n😀\na', operation: 'length' })).text).toBe('a\n😀\nxx');
    await expect(run('text-sort', { source: 'x', direction: 'wrong' })).rejects.toThrow(/方向/);
  });

  test('case conversion uses Unicode casing without rewriting punctuation', async () => {
    expect((await run('text-case', { source: 'Straße 猫', operation: 'upper' })).text).toBe('STRASSE 猫');
    expect((await run('text-case', { source: 'HELLO World', operation: 'lower' })).text).toBe('hello world');
    expect((await run('text-case', { source: 'hELLo-world ÉCLAIR', operation: 'title' })).text).toBe('Hello-World Éclair');
  });

  test('PapaParse preserves BOM, quoted comma/newline/quote, empty cell and formula as data', async () => {
    const source = '\uFEFFname,note,value\r\n文明,"a,b\nsecond ""line""",\r\n=x+1, tail ,0';
    const output = await run('csv', { source });
    expect(output.table).toEqual([['name', 'note', 'value'], ['文明', 'a,b\nsecond "line"', ''], ['=x+1', ' tail ', '0']]);
    expect(output.extension).toBe('csv');
    const reloaded = await run('csv', { source: output.text });
    expect(reloaded.table).toEqual(output.table);
  });

  test('CSV optional file takes precedence, honors cancellation and refuses malformed/oversized input', async () => {
    const file = new File(['a,b\n1,2'], 'sample.csv', { type: 'text/csv' });
    expect((await run('csv', { source: 'ignored', file })).table).toEqual([['a', 'b'], ['1', '2']]);
    await expect(run('csv', { source: 'a,b\n"unterminated,2' })).rejects.toThrow(/CSV 无效/);
    await expect(run('csv', { file: { size: MAX_FILE_BYTES + 1, arrayBuffer() { throw new Error('must not read'); } } })).rejects.toThrow(/2 MiB/);
    const controller = new AbortController(); controller.abort();
    await expect(run('csv', { file }, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    const duringRead = new AbortController();
    await expect(run('csv', { file: { size: 3, async arrayBuffer() { duringRead.abort(); return new TextEncoder().encode('a,b').buffer; } } }, { signal: duringRead.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });

  test('CSV files reject broken UTF-8 instead of silently replacing bytes, while preserving valid BOM/Unicode', async () => {
    for (const bytes of [[97, 44, 255], [97, 44, 0xed, 0xa0, 0x80], [97, 44, 0xe4, 0xb8]]) {
      await expect(run('csv', { file: new File([new Uint8Array(bytes)], 'bad.csv') })).rejects.toThrow(/UTF-8/);
    }
    const good = new File(['\uFEFFname,note\r\n文明,"\uFFFD,原字符"'], 'good.csv');
    const output = await run('csv', { file: good });
    expect(output.table).toEqual([['name', 'note'], ['文明', '\uFFFD,原字符']]);
    expect((await run('csv', { source: output.text })).table).toEqual(output.table);
  });

  test('CSV rejects row/column overflows instead of silently exporting a preview', async () => {
    await expect(run('csv', { source: Array.from({ length: 5001 }, () => 'a,b').join('\n') })).rejects.toThrow(/5000 行/);
    await expect(run('csv', { source: Array.from({ length: 257 }, () => 'a').join(',') })).rejects.toThrow(/256 列/);
  });

  test('Morse implements known international code, punctuation, word breaks and honest errors', async () => {
    expect(encodeMorse('SOS 5?')).toBe('... --- ... / ..... ..--..');
    expect(decodeMorse('... --- ... / ..... ..--..')).toBe('SOS 5?');
    const text = 'A/B@C.COM (OK)! $5+1=6';
    expect(decodeMorse(encodeMorse(text))).toBe(text);
    await expect(run('morse', { source: '文明' })).rejects.toThrow(/不支持.*文.*明/);
    await expect(run('morse', { source: '....x', operation: 'decode' })).rejects.toThrow(/摩斯/);
  });

  test('ASCII lettering draws actual small glyphs with configurable ASCII ink', async () => {
    expect(asciiLetters('A')).toBe(' ### \n#   #\n#####\n#   #\n#   #');
    const output = (await run('ascii', { source: 'a0', ink: '*' })).text;
    expect(output.split('\n')).toHaveLength(5);
    expect(output).not.toContain('#');
    expect(output).toContain('*****');
    expect(asciiLetters('A\r\nB').split('\n')).toHaveLength(11);
    await expect(run('ascii', { source: '猫' })).rejects.toThrow(/不支持/);
    await expect(run('ascii', { source: 'A', ink: '██' })).rejects.toThrow(/ASCII/);
    await expect(run('ascii', { source: 'A'.repeat(161) })).rejects.toThrow(/160/);
  });

  test('all input paths bound UTF-8 bytes rather than only UTF-16 length', async () => {
    await expect(run('base64', { source: 'a'.repeat(MAX_INPUT_BYTES + 1) })).rejects.toThrow(/2 MiB/);
    await expect(run('text', { source: '界'.repeat(Math.floor(MAX_INPUT_BYTES / 3) + 1) })).rejects.toThrow(/2 MiB/);
  });
});
