import { test, expect, vi, afterEach } from 'vitest';
import {
  tools, secureInteger, randomIntegers, randomString, sha256, fileChecksum,
  FILE_LIMIT, LARGE_FILE_MESSAGE, runRegex, queryHttpStatus, queryMime,
  keyboardReport, pointerReport, measureScreen, measurePing,
} from '../config/apps/portal/src/net/net.mjs';
import { evaluateRegex } from '../config/apps/portal/src/net/regex.mjs';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

test('JavaScript RegExp returns exact matches, offsets, groups and indices', () => {
  const result = evaluateRegex({ pattern: '(?<word>[a-z]+)(\\d+)?', flags: 'dg', text: 'ab12 -- cd' });
  expect(result.matches).toEqual([
    { index: 0, value: 'ab12', groups: ['ab', '12'], namedGroups: { word: 'ab' }, indices: [[0, 4], [0, 2], [2, 4]] },
    { index: 8, value: 'cd', groups: ['cd', null], namedGroups: { word: 'cd' }, indices: [[8, 10], [8, 10], null] },
  ]);
  expect(result.truncated).toBe(false);
  expect(evaluateRegex({ pattern: 'a', flags: '', text: 'aa' }).matches).toHaveLength(1);
  expect(evaluateRegex({ pattern: 'a', flags: 'y', text: 'ba' }).matches).toEqual([]);
});

test('empty Unicode matches progress by code point and oversized work is rejected', () => {
  expect(evaluateRegex({ pattern: '(?:)', flags: 'gu', text: '🌍x' }).matches.map(row => row.index)).toEqual([0, 2, 3]);
  const capped = evaluateRegex({ pattern: 'a', flags: 'g', text: 'a'.repeat(1100) });
  expect(capped.matches).toHaveLength(1000);
  expect(capped.truncated).toBe(true);
  expect(() => evaluateRegex({ pattern: '[', flags: '', text: '' })).toThrow();
  expect(() => evaluateRegex({ pattern: 'a', flags: 'gg', text: '' })).toThrow();
  expect(() => evaluateRegex({ pattern: 'a', flags: 'g', text: 'a'.repeat(100001) })).toThrow(/100000/);
});

test('regex caller cancels and terminates its Worker instead of executing on the UI thread', async () => {
  const constructed = [];
  class FakeWorker {
    constructor(url, options) { this.url = url; this.options = options; this.terminated = false; constructed.push(this); }
    postMessage(value) { this.input = value; }
    terminate() { this.terminated = true; }
  }
  vi.stubGlobal('Worker', FakeWorker);
  const controller = new AbortController();
  const pending = runRegex({ pattern: '(a+)+$', text: 'aaaa!', flags: '' }, { signal: controller.signal });
  const rejection = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort();
  await rejection;
  expect(constructed[0].terminated).toBe(true);
  expect(constructed[0].options).toEqual({ type: 'module' });
  vi.useFakeTimers();
  const timeout = runRegex({ pattern: 'a', text: 'a', flags: '' });
  const exceeded = expect(timeout).rejects.toThrow(/1.5 秒/);
  await vi.advanceTimersByTimeAsync(1500);
  await exceeded;
  expect(constructed[1].terminated).toBe(true);
});

test('uniform integer sampling rejects modulo bias and supports the entire safe-integer range', () => {
  let call = 0;
  const source = { getRandomValues(words) { words[0] = 0; words[1] = call++ ? 2 : 3; return words; } };
  expect(secureInteger(10, 12, source)).toBe(12);
  expect(call).toBe(2);
  const zero = { getRandomValues(words) { words.fill(0); return words; } };
  expect(secureInteger(Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, zero)).toBe(Number.MIN_SAFE_INTEGER);
  expect(secureInteger(-7, -7)).toBe(-7);
  expect(() => secureInteger(3, 2)).toThrow(/不能大于/);
  expect(() => secureInteger(0, Number.MAX_SAFE_INTEGER + 1)).toThrow(/安全整数/);
  expect(() => randomIntegers({ min: 1, max: 2, count: 501 })).toThrow();
  expect(() => randomIntegers({ min: '', max: 2, count: 1 })).toThrow(/不能为空/);
  const generated = randomIntegers({ min: -3, max: 3, count: 500 });
  expect(generated).toHaveLength(500);
  expect(generated.every(value => Number.isSafeInteger(value) && value >= -3 && value <= 3)).toBe(true);
});

test('random strings enforce selected categories and bounded sizes without account state', () => {
  const value = randomString({ length: 40, alphabet: 'all' });
  expect(value).toHaveLength(40);
  expect(value).toMatch(/[a-z]/);
  expect(value).toMatch(/[A-Z]/);
  expect(value).toMatch(/[0-9]/);
  expect(value).toMatch(/[^a-zA-Z0-9]/);
  expect(randomString({ length: 1, alphabet: 'digits' })).toMatch(/^\d$/);
  expect(randomString({ length: 32, alphabet: 'hex' })).toMatch(/^[0-9a-f]{32}$/);
  expect(() => randomString({ length: 3, alphabet: 'all' })).toThrow(/至少/);
  expect(() => randomString({ length: 257, alphabet: 'digits' })).toThrow();
  expect(() => randomString({ length: 12, alphabet: 'none' })).toThrow(/未知/);
});

test('SHA-256 hashes exact UTF-8 bytes, empty text, Unicode and local small files', async () => {
  expect(await sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  expect(await sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  expect(await sha256('你好🌍')).toBe('25feb68e8651a1e87d13b2a93c080d75e40174800e19388820c27be17009cd66');
  expect(await fileChecksum(new Blob(['abc']))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  let read = false;
  await expect(fileChecksum({ size: FILE_LIMIT + 1, arrayBuffer() { read = true; } })).rejects.toThrow(LARGE_FILE_MESSAGE);
  expect(read).toBe(false);
  const controller = new AbortController(); controller.abort();
  await expect(sha256('abc', crypto, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
});

test('common HTTP/MIME tables return registered labels and common extension mappings', () => {
  expect(queryHttpStatus('404')).toEqual([['404', 'Not Found']]);
  expect(queryHttpStatus('unprocessable')).toEqual([['422', 'Unprocessable Content']]);
  expect(queryHttpStatus('418')).toEqual([['418', '(Unused)']]);
  expect(queryHttpStatus('599')).toEqual([]);
  expect(queryMime('photo.AVIF')).toEqual([['avif', 'image/avif']]);
  expect(queryMime('text/javascript; charset=utf-8')).toEqual([['js', 'text/javascript'], ['mjs', 'text/javascript']]);
  expect(queryMime('notes.md')).toEqual([['md', 'text/markdown']]);
  expect(queryMime('')).toHaveLength(47);
});

test('live detector helpers report actual event and viewport fields', () => {
  const key = keyboardReport({ key: 'A', code: 'KeyA', type: 'keydown', location: 0, repeat: false, shiftKey: true });
  expect(key.live).toBe('keyboard');
  expect(key.table).toContainEqual(['key', 'A']);
  expect(key.table).toContainEqual(['Ctrl / Alt / Shift / Meta', 'false / false / true / false']);
  const pointer = pointerReport({ clientX: 123, clientY: 456, pageX: 123, pageY: 1000, screenX: 7, screenY: 8, buttons: 1, pointerType: 'pen' });
  expect(pointer.live).toBe('pointer');
  expect(pointer.table).toContainEqual(['clientX / clientY', '123 / 456']);
  expect(pointer.table).toContainEqual(['pointerType', 'pen']);
  const screen = measureScreen({ screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24 }, innerWidth: 1200, innerHeight: 800, devicePixelRatio: 1.25, visualViewport: { width: 960, height: 640, scale: 1.25 } });
  expect(screen.table).toContainEqual(['screen', '1920 × 1080 CSS px']);
  expect(screen.table).toContainEqual(['layout viewport', '1200 × 800 CSS px']);
  expect(screen.table).toContainEqual(['visual viewport', '960 × 640; scale 1.25']);
});

test('ping only requests the fixed same-origin static resource and propagates cancellation', async () => {
  const requests = [];
  vi.stubGlobal('fetch', async (url, options) => { requests.push([url, options]); return { ok: true, status: 200, text: async () => '{"pong":true}' }; });
  const result = await measurePing();
  expect(requests[0][0]).toBe('/tool-ping.json');
  expect(requests[0][1]).toMatchObject({ cache: 'no-store', credentials: 'omit', redirect: 'error' });
  expect(result.table).toContainEqual(['HTTP', '200']);
  expect(result.text).toMatch(/不能当作网络速度/);
  const controller = new AbortController();
  vi.stubGlobal('fetch', async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })));
  const pending = measurePing({ signal: controller.signal });
  const rejection = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort();
  await rejection;
});

test('descriptor UUID calls native randomUUID and validates output quantity', async () => {
  const uuid = tools.find(tool => tool.id === 'uuid');
  const result = await uuid.run({ count: 4 });
  expect(result.text.split('\n')).toHaveLength(4);
  for (const value of result.text.split('\n')) expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  await expect(uuid.run({ count: 101 })).rejects.toThrow();
  expect(tools).toHaveLength(14);
  expect(tools.flatMap(tool => tool.requirements)).toEqual(['B029', 'B030', 'B031', 'B032', 'B047', 'B048', 'B063', 'B064', 'B065', 'B066', 'B067', 'B068', 'B069', 'B070']);
});
