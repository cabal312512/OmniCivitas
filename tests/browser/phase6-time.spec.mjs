import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { tools } from '../../config/apps/portal/src/time/model.mjs';
import { TODO_KEY } from '../../config/apps/portal/src/time/time.mjs';
import { reports } from './report-location.mjs';

const proof = (info, name, value) => fs.writeFileSync(path.join(reports, `phase6-${info.project.name}-${name}.json`), JSON.stringify(value, null, 2));
const field = (page, key) => page.locator(`#tool-form [name="${key}"]`);
async function activate(page, selector) { await page.locator(selector).focus(); await page.keyboard.press('Enter'); }
async function enterTool(page, id) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const response = await page.goto(`/functions/${id}/`);
  expect(response.status()).toBe(200);
  await expect.poll(() => page.evaluate(() => window.__ocvTools?.id)).toBe(id);
  await activate(page, '[data-tool-front]');
}
async function run(page) {
  const prior = await page.evaluate(() => window.__ocvTools.runs);
  await activate(page, '#tool-run');
  await expect.poll(() => page.evaluate(() => window.__ocvTools.runs)).toBeGreaterThan(prior);
  await expect.poll(() => page.evaluate(() => window.__ocvTools.busy)).toBe(false);
  await expect(page.locator('#tool-status')).toHaveAttribute('data-error', 'false');
}
async function elapsed(page) {
  const text = await page.locator('#tool-output').inputValue();
  const parts = /已用：(\d+):(\d+):(\d+)\.(\d+)/.exec(text);
  if (!parts) return NaN;
  return Number(parts[1]) * 3600000 + Number(parts[2]) * 60000 + Number(parts[3]) * 1000 + Number(parts[4]);
}
async function pauseFor(page, milliseconds) { await page.evaluate(duration => new Promise(resolve => setTimeout(resolve, duration)), milliseconds); }
async function todoItems(page) { return JSON.parse(await page.locator('#tool-output').inputValue()).items; }

for (const tool of tools) {
  test(`Phase 6 ${tool.requirements[0]} ${tool.id} actual default form starts its local workbench`, async ({ page }, info) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await enterTool(page, tool.id);
    if (tool.id === 'todo') await page.evaluate(key => localStorage.removeItem(key), TODO_KEY);
    for (const descriptor of tool.fields) await field(page, descriptor.key).fill(String(descriptor.default));
    await run(page);
    const output = await page.locator('#tool-output').inputValue();
    expect(output.length).toBeGreaterThan(0);
    if (tool.id === 'todo') { expect(JSON.parse(output)).toEqual({ version: 1, items: [] }); await expect(page.locator('[data-todo-workbench]')).toHaveAttribute('data-todo-persistent', 'true'); }
    else { await expect(page.locator('[data-time-workbench]')).toHaveAttribute('data-clock-state', 'running'); expect(output).toContain('状态：正在计时'); }
    if (tool.id === 'pomodoro') expect(output).toContain('轮次：1/4');
    const diagnostic = await page.evaluate(() => window.__ocvTools);
    expect(diagnostic.successes).toBeGreaterThanOrEqual(1); expect(errors).toEqual([]);
    proof(info, `default-${tool.id}`, { id: tool.id, BID: tool.requirements[0], requirements: tool.requirements, diagnostic, output, outputLength: output.length, errors });
  });
}

test('Phase 6 countdown really pauses, resumes, resets, cancels and starts a clean second run', async ({ page }, info) => {
  await enterTool(page, 'countdown'); await field(page, 'seconds').fill('2'); await run(page);
  await expect.poll(() => elapsed(page)).toBeGreaterThan(150);
  await activate(page, '[data-time-action="pause"]');
  const paused = await elapsed(page); await pauseFor(page, 240);
  expect(await elapsed(page)).toBe(paused);
  await expect(page.locator('[data-time-workbench]')).toHaveAttribute('data-clock-state', 'paused');
  await activate(page, '[data-time-action="resume"]'); await expect.poll(() => elapsed(page)).toBeGreaterThan(paused + 100);
  await activate(page, '[data-time-action="reset"]');
  await expect(page.locator('[data-time-value]')).toHaveText('00:00:02.0');
  await expect(page.locator('[data-time-workbench]')).toHaveAttribute('data-clock-state', 'paused');
  await activate(page, '[data-time-action="resume"]');
  await expect.poll(() => elapsed(page)).toBeGreaterThan(100);
  await activate(page, '#tool-cancel');
  const afterCancel = await page.locator('#tool-output').inputValue();
  await pauseFor(page, 240); expect(await page.locator('#tool-output').inputValue()).toBe(afterCancel);
  await field(page, 'seconds').fill('0.2'); await run(page);
  await expect(page.locator('[data-time-workbench]')).toHaveCount(1);
  await expect(page.locator('[data-time-workbench]')).toHaveAttribute('data-clock-state', 'finished');
  await expect(page.locator('#tool-output')).toHaveValue(/状态：到时间了[\s\S]*剩余：00:00:00.000/);
  proof(info, 'time-countdown-controls', { pausedElapsed: paused, pausedStable: true, resumed: true, resetTo2000: true, cancelledStable: true, cleanRerun: true, output: await page.locator('#tool-output').inputValue() });
});

test('Phase 6 stopwatch records genuine lap deltas and the short pomodoro completes its final break', async ({ page }, info) => {
  await enterTool(page, 'stopwatch'); await run(page);
  await expect.poll(() => elapsed(page)).toBeGreaterThan(100);
  await activate(page, '[data-time-action="lap"]');
  await expect(page.locator('#tool-table tr')).toHaveCount(2);
  await pauseFor(page, 160); await activate(page, '[data-time-action="lap"]');
  await activate(page, '[data-time-action="pause"]');
  await expect(page.locator('#tool-table tr')).toHaveCount(3);
  const rows = await page.locator('#tool-table tr').evaluateAll(nodes => nodes.map(node => Array.from(node.querySelectorAll('td'), cell => cell.textContent)));
  const milliseconds = value => { const [h, m, s] = value.split(':'); return Number(h) * 3600000 + Number(m) * 60000 + Math.round(Number(s) * 1000); };
  expect(milliseconds(rows[1][2])).toBeGreaterThan(0);
  expect(milliseconds(rows[2][1])).toBeGreaterThan(0);
  expect(milliseconds(rows[2][2])).toBe(milliseconds(rows[1][2]) + milliseconds(rows[2][1]));
  await activate(page, '[data-time-action="reset"]'); await expect(page.locator('#tool-table tr')).toHaveCount(0);
  await enterTool(page, 'pomodoro');
  await field(page, 'workSeconds').fill('0.2'); await field(page, 'restSeconds').fill('0.1'); await field(page, 'cycles').fill('2'); await run(page);
  await expect(page.locator('[data-time-workbench]')).toHaveAttribute('data-clock-state', 'finished');
  const output = await page.locator('#tool-output').inputValue();
  expect(output).toContain('已用：00:00:00.600'); expect(output).toContain('轮次：2/2'); expect(output).toContain('阶段：完成');
  proof(info, 'time-stopwatch-pomodoro', { lapRows: rows, correctLapSum: true, resetClearsLaps: true, pomodoroOutput: output });
});

test('Phase 6 persisted page lifecycle and hidden paint suspension catch up without pausing elapsed time', async ({ page }, info) => {
  await enterTool(page, 'stopwatch'); await run(page); await expect.poll(() => elapsed(page)).toBeGreaterThan(100);
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
  });
  const suspended = await elapsed(page); await pauseFor(page, 250); expect(await elapsed(page)).toBe(suspended);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect.poll(() => elapsed(page)).toBeGreaterThan(suspended + 200);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hidden = await elapsed(page); await pauseFor(page, 250); expect(await elapsed(page)).toBe(hidden);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => elapsed(page)).toBeGreaterThan(hidden + 200);
  proof(info, 'time-lifecycle', { syntheticPersistedEvents: true, simulatedHiddenGetter: true, genuineMonotonicElapsed: true, suspendedOutputStable: true, hiddenOutputStable: true, finalElapsed: await elapsed(page), claim: 'Exercises lifecycle hooks; does not claim a real browser BFCache hit.' });
});

test('Phase 6 todo supports actual CRUD, browser persistence, canonical download and re-import', async ({ page }, info) => {
  await enterTool(page, 'todo'); await page.evaluate(key => localStorage.removeItem(key), TODO_KEY); await run(page);
  for (const value of ['检查 🌍', '关灯']) { await page.locator('[data-todo-input]').fill(value); await activate(page, '[data-todo-add]'); }
  await expect(page.locator('[data-todo-list] li')).toHaveCount(2);
  await page.locator('[data-todo-edit]').first().fill('检查完成 🧪'); await page.locator('[data-todo-save]').first().focus(); await page.keyboard.press('Enter');
  await page.locator('[data-todo-toggle]').nth(1).focus(); await page.keyboard.press('Space');
  let items = await todoItems(page);
  expect(items.map(item => [item.text, item.completed])).toEqual([['检查完成 🧪', false], ['关灯', true]]);
  const canonical = await page.locator('#tool-output').inputValue();
  expect(await page.evaluate(key => localStorage.getItem(key), TODO_KEY)).toBe(canonical);
  const downloading = page.waitForEvent('download'); await activate(page, '#tool-export'); const download = await downloading;
  const saved = path.join(reports, `phase6-${info.project.name}-todo.json`); await download.saveAs(saved);
  expect(download.suggestedFilename()).toBe('ocv-todo.json'); expect(fs.readFileSync(saved, 'utf8')).toBe(canonical);
  await page.reload(); await expect.poll(() => page.evaluate(() => window.__ocvTools?.id)).toBe('todo'); await activate(page, '[data-tool-front]'); await run(page);
  expect(await todoItems(page)).toEqual(items);
  await page.locator('[data-todo-remove]').first().focus(); await page.keyboard.press('Enter'); await activate(page, '[data-todo-clear]');
  expect(await todoItems(page)).toEqual([]);
  await page.locator('[data-todo-import]').fill(fs.readFileSync(saved, 'utf8')); await activate(page, '[data-todo-import-button]');
  expect(await todoItems(page)).toEqual(items);
  proof(info, 'time-todo-crud-download', { items, canonical, persistedAfterReload: true, actualDownload: download.suggestedFilename(), deleted: true, reimported: true });
});

test('Phase 6 todo rejects malformed and oversized replacements without corrupting the current list', async ({ page }, info) => {
  await enterTool(page, 'todo'); await page.evaluate(key => localStorage.removeItem(key), TODO_KEY); await run(page);
  await page.locator('[data-todo-input]').fill('保留'); await activate(page, '[data-todo-add]'); const before = await todoItems(page);
  const invalid = [
    'not JSON',
    JSON.stringify({ version: 1, items: [{ id: 'bad', text: 7, completed: false }] }),
    '{"version":1,"items":[],"__proto__":{"polluted":true}}',
    JSON.stringify({ version: 1, items: Array.from({ length: 101 }, (_value, index) => ({ id: `limit_${index}`, text: 'X', completed: false })) }),
    JSON.stringify({ version: 1, items: [{ id: 'limit', text: 'X'.repeat(301), completed: false }] }),
    ' '.repeat(65537),
  ];
  for (const source of invalid) {
    await page.locator('[data-todo-import]').fill(source); await activate(page, '[data-todo-import-button]');
    await expect(page.locator('#tool-status')).toHaveAttribute('data-error', 'true'); expect(await todoItems(page)).toEqual(before);
  }
  expect(await page.evaluate(() => ({}).polluted)).toBeUndefined();
  await page.locator('[data-todo-import]').fill(JSON.stringify({ version: 1, items: [] })); await activate(page, '[data-todo-import-button]');
  await expect(page.locator('#tool-status')).toHaveAttribute('data-error', 'false'); expect(await todoItems(page)).toEqual([]);
  proof(info, 'time-todo-rejections', { rejectedCases: invalid.length, listPreserved: true, noPrototypePollution: true, validRecovery: true });
});

test('Phase 6 todo still works when browser storage rejects writing and clearly reports memory fallback', async ({ page }, info) => {
  await enterTool(page, 'todo'); await page.evaluate(key => localStorage.removeItem(key), TODO_KEY);
  await page.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('Quota denied for test', 'QuotaExceededError'); }; });
  await run(page); await page.locator('[data-todo-input]').fill('本页内存'); await activate(page, '[data-todo-add]');
  await expect(page.locator('[data-todo-workbench]')).toHaveAttribute('data-todo-persistent', 'false');
  await expect(page.locator('[data-todo-storage]')).toContainText('只保存在内存');
  expect((await todoItems(page)).map(item => item.text)).toEqual(['本页内存']);
  expect(await page.evaluate(key => localStorage.getItem(key), TODO_KEY)).toBeNull();
  proof(info, 'time-todo-fallback', { realStorageWriteRejected: true, honestMemoryNotice: true, inMemoryCrud: true, storageKeyAbsent: true });
});
