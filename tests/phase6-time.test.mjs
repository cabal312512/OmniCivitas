import { test, expect } from 'vitest';
import { createClock, formatDuration, durationSeconds, createTodoStore, decodeTodos, encodeTodos, TODO_KEY, TODO_FILE_LIMIT } from '../config/apps/portal/src/time/time.mjs';
import { tools } from '../config/apps/portal/src/time/model.mjs';

function clock(kind, settings = {}) {
  let now = 1000;
  const model = createClock({ kind, now: () => now, ...settings });
  return { model, advance: amount => { now += amount; }, set: value => { now = value; } };
}
function storage() { const values = new Map(); return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; }
function ids() { let next = 0; return () => `item_${++next}`; }

test('countdown uses monotonic elapsed time and finishes exactly once without ticking a counter', () => {
  const { model, advance } = clock('countdown', { duration: 250 });
  expect(model.snapshot()).toMatchObject({ state: 'running', remaining: 250 });
  advance(63); expect(model.snapshot()).toMatchObject({ elapsed: 63, remaining: 187 });
  advance(60000); expect(model.snapshot()).toMatchObject({ state: 'finished', elapsed: 250, remaining: 0 });
  expect(model.resume().state).toBe('finished');
  expect(model.pause().state).toBe('finished');
});

test('pause excludes paused duration, resume retains earlier time, reset permits a new run', () => {
  const { model, advance } = clock('countdown', { duration: 1000 });
  advance(120); model.pause(); advance(6000);
  expect(model.snapshot()).toMatchObject({ state: 'paused', elapsed: 120, remaining: 880 });
  model.resume(); advance(200);
  expect(model.snapshot()).toMatchObject({ state: 'running', elapsed: 320, remaining: 680 });
  model.reset(); advance(500);
  expect(model.snapshot()).toMatchObject({ state: 'paused', elapsed: 0, remaining: 1000 });
  model.resume(); advance(1000); expect(model.snapshot().state).toBe('finished');
});

test('an unrendered countdown catches up when observed later', () => {
  const { model, advance } = clock('countdown', { duration: 8000 });
  advance(3999); expect(model.snapshot().remaining).toBe(4001);
  advance(5000); expect(model.snapshot()).toMatchObject({ state: 'finished', remaining: 0 });
});

test('stopwatch laps preserve exact totals and deltas across pauses', () => {
  const { model, advance } = clock('stopwatch');
  advance(120); model.lap(); advance(80); model.pause(); advance(9999);
  expect(() => model.lap()).toThrow(/先继续/);
  model.resume(); advance(200); model.lap();
  expect(model.snapshot().laps).toEqual([{ number: 1, elapsed: 120, duration: 120 }, { number: 2, elapsed: 400, duration: 280 }]);
  const snapshot = model.snapshot(); snapshot.laps[0].elapsed = 0;
  expect(model.snapshot().laps[0].elapsed).toBe(120);
  model.reset(); expect(model.snapshot()).toMatchObject({ state: 'paused', elapsed: 0, laps: [] });
});

test('stopwatch bounds its lap history without silently deleting recorded laps', () => {
  const { model, advance } = clock('stopwatch');
  for (let index = 0; index < 200; index++) { advance(1); model.lap(); }
  expect(() => model.lap()).toThrow(/200/);
  expect(model.snapshot().laps).toHaveLength(200);
});

test('fractional monotonic readings quantize lap endpoints before deriving exported millisecond deltas', () => {
  const { model, advance } = clock('stopwatch');
  advance(120.9); model.lap(); advance(279.2); model.lap();
  expect(model.snapshot().laps).toEqual([{ number: 1, elapsed: 120, duration: 120 }, { number: 2, elapsed: 400, duration: 280 }]);
});

test('pomodoro changes phase at exact boundaries and reaches its finite final break', () => {
  const { model, advance } = clock('pomodoro', { work: 200, rest: 100, cycles: 2 });
  expect(model.snapshot()).toMatchObject({ phase: 'work', cycle: 1, phaseRemaining: 200 });
  advance(200); expect(model.snapshot()).toMatchObject({ phase: 'rest', cycle: 1, phaseRemaining: 100 });
  advance(100); expect(model.snapshot()).toMatchObject({ phase: 'work', cycle: 2, phaseRemaining: 200 });
  advance(299); expect(model.snapshot()).toMatchObject({ phase: 'rest', cycle: 2, phaseRemaining: 1 });
  advance(1); expect(model.snapshot()).toMatchObject({ state: 'finished', phase: 'finished', cycle: 2, remaining: 0, phaseRemaining: 0 });
});

test('pomodoro catches up over many unseen phases and preserves pause semantics', () => {
  const { model, advance } = clock('pomodoro', { work: 1000, rest: 500, cycles: 4 });
  advance(3300); expect(model.snapshot()).toMatchObject({ phase: 'work', cycle: 3, phaseRemaining: 700 });
  model.pause(); advance(100000); expect(model.snapshot().elapsed).toBe(3300);
  model.resume(); advance(2700); expect(model.snapshot()).toMatchObject({ state: 'finished', elapsed: 6000 });
});

test('time fields and display reject invalid ranges and retain millisecond precision', () => {
  expect(durationSeconds('0.125')).toBe(125);
  expect(formatDuration(3661125, 3)).toBe('01:01:01.125');
  expect(formatDuration(-1)).toBe('00:00:00.0');
  for (const value of ['', ' ', 'NaN', '-1', '0', '604801']) expect(() => durationSeconds(value)).toThrow();
  expect(() => createClock({ kind: 'pomodoro', cycles: 0 })).toThrow();
  expect(() => createClock({ kind: 'pomodoro', cycles: 25 })).toThrow();
  expect(() => createClock({ kind: 'countdown', duration: 99 })).toThrow();
});

test('todo CRUD persists exactly under its designated browser key and survives reopening', () => {
  const disk = storage(), store = createTodoStore(disk, ids());
  store.add('  开灯 🌍  '); store.add('检查文件');
  store.edit('item_1', '关灯'); store.toggle('item_2', true);
  expect(disk.values.size).toBe(1); expect(disk.values.has(TODO_KEY)).toBe(true);
  const reopened = createTodoStore(disk).snapshot();
  expect(reopened).toMatchObject({ persistent: true, items: [{ id: 'item_1', text: '关灯', completed: false }, { id: 'item_2', text: '检查文件', completed: true }] });
  store.clearCompleted(); expect(store.snapshot().items).toHaveLength(1);
  store.remove('item_1'); expect(decodeTodos(disk.getItem(TODO_KEY))).toEqual([]);
});

test('todo import/export preserve Unicode and completed state; unsafe object shapes are rejected', () => {
  const source = [{ id: 'x_1', text: '中文 🌍 <script>alert(1)</script>', completed: true }];
  expect(decodeTodos(encodeTodos(source))).toEqual(source);
  for (const invalid of ['{"version":1,"items":[],"__proto__":{"polluted":true}}', '{"version":1,"items":[{"id":"x","text":"a","completed":false,"__proto__":{}}]}', '{"version":2,"items":[]}', '{"version":1,"items":{}}', 'bad']) expect(() => decodeTodos(invalid)).toThrow();
  expect({}.polluted).toBeUndefined();
  expect(() => encodeTodos([{ id: 'same', text: 'A', completed: false }, { id: 'same', text: 'B', completed: false }])).toThrow(/重复/);
});

test('todo storage failures use an honest memory fallback without blocking CRUD', () => {
  const unreadable = createTodoStore({ getItem() { throw new Error('denied'); } }, ids());
  unreadable.add('仍然能写'); expect(unreadable.snapshot()).toMatchObject({ persistent: false, warning: expect.stringMatching(/内存/), items: [{ text: '仍然能写' }] });
  const writeFailure = createTodoStore({ getItem: () => null, setItem() { throw new Error('quota'); } }, ids());
  writeFailure.add('本页'); expect(writeFailure.snapshot()).toMatchObject({ persistent: false, warning: expect.stringMatching(/写入失败/), items: [{ text: '本页' }] });
  const absent = createTodoStore(null, ids()); absent.add('内存'); expect(absent.snapshot().persistent).toBe(false);
});

test('malformed stored data is never silently overwritten or trusted', () => {
  const disk = storage(); disk.setItem(TODO_KEY, '{"version":1,"items":[{"id":"x","text":7,"completed":false}]}');
  const store = createTodoStore(disk, ids()); store.add('安全列表');
  expect(store.snapshot()).toMatchObject({ persistent: false, warning: expect.stringMatching(/损坏/), items: [{ text: '安全列表' }] });
  expect(disk.getItem(TODO_KEY)).toContain('"text":7');
});

test('todo rejects oversized, empty, missing and invalid edits atomically', () => {
  const store = createTodoStore(storage(), ids()); store.add('保留');
  expect(() => store.add(' ')).toThrow(); expect(() => store.edit('item_1', 'x'.repeat(301))).toThrow();
  expect(() => store.edit('missing', 'A')).toThrow(); expect(() => store.toggle('item_1', 'yes')).toThrow();
  expect(() => store.replace('{"version":1,"items":[{"id":"x","text":"A","completed":false},{"id":"x","text":"B","completed":false}]}')).toThrow();
  expect(store.snapshot().items).toEqual([{ id: 'item_1', text: '保留', completed: false }]);
  expect(() => decodeTodos(' '.repeat(TODO_FILE_LIMIT + 1))).toThrow(/64 KiB/);
  const snapshot = store.snapshot(); snapshot.items[0].text = 'tampered'; expect(store.snapshot().items[0].text).toBe('保留');
});

test('todo caps count and UTF-8 export bytes before committing changes', () => {
  const countStore = createTodoStore(storage(), ids());
  for (let index = 0; index < 100; index++) countStore.add(String(index));
  expect(() => countStore.add('101')).toThrow(/100/); expect(countStore.snapshot().items).toHaveLength(100);
  const sizeStore = createTodoStore(storage(), ids());
  while (true) { try { sizeStore.add('🌍'.repeat(300)); } catch (error) { expect(error.message).toMatch(/64 KiB/); break; } }
  const prior = sizeStore.snapshot(); expect(new TextEncoder().encode(encodeTodos(prior.items)).byteLength).toBeLessThanOrEqual(TODO_FILE_LIMIT);
  expect(prior.items.length).toBeGreaterThan(1); expect(prior.items.length).toBeLessThan(100);
});

test('todo replacement and disposal keep explicit lifecycle boundaries', () => {
  const store = createTodoStore(storage(), ids()); store.add('旧');
  const replacement = [{ id: 'import_1', text: '新', completed: true }];
  expect(store.replace(encodeTodos(replacement)).items).toEqual(replacement);
  store.dispose(); expect(() => store.add('关闭后')).toThrow(/关闭/);
  expect(store.snapshot().items).toEqual(replacement);
});

test('all four source requirements have distinct active descriptors', () => {
  expect(tools.map(tool => [tool.id, tool.requirements])).toEqual([['countdown', ['B049']], ['stopwatch', ['B050']], ['pomodoro', ['B051']], ['todo', ['B052']]]);
  expect(tools.find(tool => tool.id === 'pomodoro').fields.map(field => field.key)).toEqual(['workSeconds', 'restSeconds', 'cycles']);
});
