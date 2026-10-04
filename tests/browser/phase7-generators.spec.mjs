import {test, expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {tools, BUTTON_NAMES, LOADING_REASONS, ERROR_EXPLANATION} from '../../config/apps/portal/src/gen/gen.mjs';
import {reports} from './report-location.mjs';

const field = (page, key) => page.locator(`#tool-form [name="${key}"]`);
const diagnosticKeys = ['id', 'runs', 'successes', 'busy', 'cancelled', 'lastTool', 'resultLength'].sort();
const errorsFor = page => { const errors = []; page.on('pageerror', error => errors.push(error.message)); return errors; };
async function activate(page, selector) { await page.locator(selector).focus(); await page.keyboard.press('Enter'); }
async function enter(page, id) {
  await page.emulateMedia({reducedMotion: 'reduce'});
  expect((await page.goto(`/functions/${id}/`)).status()).toBe(200);
  await expect.poll(() => page.evaluate(() => window.__ocvTools?.id)).toBe(id);
  await activate(page, '[data-tool-front]');
}
async function submit(page, error = false) {
  const before = await page.evaluate(() => window.__ocvTools.runs);
  await activate(page, '#tool-run');
  await expect.poll(() => page.evaluate(() => window.__ocvTools.runs)).toBeGreaterThan(before);
  await expect.poll(() => page.evaluate(() => window.__ocvTools.busy)).toBe(false);
  await expect(page.locator('#tool-status')).toHaveAttribute('data-error', String(error));
  return page.locator('#tool-output').inputValue();
}
async function download(info, page, name, canonical) {
  const pending = page.waitForEvent('download'); await activate(page, '#tool-export');
  const downloaded = await pending;
  const target = path.join(reports, `phase7-${info.project.name}-${name}.txt`);
  await downloaded.saveAs(target);
  const bytes = fs.readFileSync(target);
  expect(bytes).toEqual(Buffer.from(canonical, 'utf8'));
  return {filename: downloaded.suggestedFilename(), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), canonicalMatches: true};
}
async function copy(page, canonical) {
  await activate(page, '#tool-copy');
  await expect(page.locator('#tool-transfer')).toHaveText('已复制');
  await expect.poll(() => page.evaluate(async () => (await navigator.clipboard.readText()).replace(/\r\n/g, '\n'))).toBe(canonical.replace(/\r\n/g, '\n'));
}
async function save(info, page, name, errors, data) {
  const diagnostic = await page.evaluate(() => window.__ocvTools);
  expect(Object.keys(diagnostic).sort()).toEqual(diagnosticKeys);
  expect(errors).toEqual([]);
  fs.writeFileSync(path.join(reports, `phase7-${info.project.name}-${name}.json`), JSON.stringify({...data, diagnostic, errors}, null, 2));
}

for (const entry of tools) {
  test(`Phase 7 ${entry.requirements[0]} ${entry.id} computes its actual default and transfers exact text`, async ({page, context, baseURL}, info) => {
    const errors = errorsFor(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {origin: new URL(baseURL).origin});
    await enter(page, entry.id);
    for (const descriptor of entry.fields) {
      if (descriptor.type === 'select') await field(page, descriptor.key).selectOption(String(descriptor.default));
      else await field(page, descriptor.key).fill(String(descriptor.default));
    }
    const output = await submit(page);
    expect(output).not.toBe('');
    if (entry.id === 'formalize') { expect(output.split('\n')).toHaveLength(40); expect(output.split('「我不想去」')).toHaveLength(41); }
    if (entry.id === 'inflate-text') { expect(Array.from(output).length).toBeGreaterThanOrEqual(10 * Array.from('今天吃什么').length); expect(output.split('「今天吃什么」')).toHaveLength(11); }
    if (entry.id === 'compress-text') expect(output).toBe('知道了');
    if (entry.id === 'useless-file') expect(output).toBe('该文件存在');
    if (entry.id === 'error-code') { expect(output).toMatch(/^E-CIVILIZATION-\d{6}-[A-Z]\n/); expect(output.split('\n')[1]).toBe(ERROR_EXPLANATION); }
    if (entry.id === 'explain-error') expect(output).toBe('该错误代码表示系统产生了错误代码');
    if (entry.id === 'authoritative-number') { expect(output).toMatch(/^5\.000000 ± 0\.000000\n\n/); await expect(page.locator('#tool-table tr')).toHaveCount(6); }
    if (entry.id === 'committee-name') expect(output).toMatch(/委员会$/);
    if (entry.id === 'meeting-agenda') { expect(output).toContain('终稿是否还能再终稿'); await expect(page.locator('#tool-table tr')).toHaveCount(9); }
    if (entry.id === 'project-code') expect(output).toMatch(/^OCV-[A-Z]+-\d{4}-[A-Z]+$/);
    if (entry.id === 'version-upgrade') expect(output).toBe('final_v2_final_REAL_final.docx');
    if (entry.id === 'button-name') expect(BUTTON_NAMES).toContain(output);
    if (entry.id === 'loading-reason') expect(LOADING_REASONS).toContain(output);
    if (entry.id === 'disclaimer') expect(output.split('\n')).toHaveLength(3);
    if (entry.id === 'product-demand') expect(output).toMatch(/^需求：.+\n验收：.+\n优先级：都要。$/);
    if (entry.id === 'feature-existence') expect(output).toMatch(/结论：暂时无法确定。$/);
    const downloaded = await download(info, page, `default-${entry.id}`, output);
    expect(downloaded.filename).toBe(`ocv-${entry.id}.txt`);
    await copy(page, output);
    await save(info, page, `default-${entry.id}`, errors, {id: entry.id, requirements: entry.requirements, output, outputLength: output.length, download: downloaded, clipboardMatches: true});
  });
}

test('Phase 7 formal levels preserve the negative original in one, twelve or forty lines', async ({page}, info) => {
  const errors = errorsFor(page); await enter(page, 'formalize'); await field(page, 'source').fill('我不想去');
  const results = [];
  for (const [level, lines] of [['0', 1], ['1', 12], ['2', 40]]) {
    await field(page, 'level').selectOption(level); const output = await submit(page);
    expect(output.split('\n')).toHaveLength(lines);
    expect(output.split('我不想去')).toHaveLength(lines + 1);
    results.push({level, lines, originalCopies: lines});
  }
  await save(info, page, 'generator-formality', errors, {results, meaningRetainedByExactQuotation: true, modelCalled: false});
});

test('Phase 7 inflation keeps ten full Unicode originals and compression produces only the promised answer', async ({page}, info) => {
  const errors = errorsFor(page), original = '🚀今天不想吃饭。';
  await enter(page, 'inflate-text'); await field(page, 'source').fill(original);
  const expanded = await submit(page); expect(expanded.split(`「${original}」`)).toHaveLength(11);
  expect(Array.from(expanded).length).toBeGreaterThanOrEqual(Array.from(original).length * 10);
  const inflatedDownload = await download(info, page, 'inflated-unicode', expanded);
  await enter(page, 'compress-text'); await field(page, 'source').fill(expanded.repeat(3));
  const compressed = await submit(page); expect(compressed).toBe('知道了');
  const compressedDownload = await download(info, page, 'compressed-unicode', compressed);
  await save(info, page, 'generator-inflate-compress', errors, {original, originalCopies: 10, expandedLength: Array.from(expanded).length, compressed, inflatedDownload, compressedDownload});
});

test('Phase 7 generated error receipt can be really copied into explanation, with invalid codes rejected and recoverable', async ({page, context, baseURL}, info) => {
  const errors = errorsFor(page); await context.grantPermissions(['clipboard-read', 'clipboard-write'], {origin: new URL(baseURL).origin});
  await enter(page, 'error-code'); const generated = await submit(page); await copy(page, generated);
  const copied = await page.evaluate(async () => (await navigator.clipboard.readText()).replace(/\r\n/g, '\n'));
  await enter(page, 'explain-error'); await field(page, 'source').fill(copied);
  expect(await submit(page)).toBe('该错误代码表示系统产生了错误代码');
  await field(page, 'source').fill('E-CIVILIZATION-wrong'); await submit(page, true);
  await expect(page.locator('#tool-output')).toHaveValue(''); await expect(page.locator('#tool-export')).toBeDisabled();
  await field(page, 'source').fill('E-CIVILIZATION-004731-B'); const recovered = await submit(page);
  expect(recovered).toBe('该错误代码表示系统产生了错误代码');
  await save(info, page, 'generator-error-chain', errors, {generated, clipboardUsed: true, explanation: recovered, invalidRejected: true, recovered: true});
});

test('Phase 7 number authority rounds exact decimal halves and renders the same report table as exported text', async ({page}, info) => {
  const errors = errorsFor(page); await enter(page, 'authoritative-number');
  const values = [];
  for (const [source, expected] of [['5', '5.000000'], ['1.2345675', '1.234568'], ['-0.0000005', '-0.000001'], ['1e12', '1000000000000.000000']]) {
    await field(page, 'number').fill(source); const output = await submit(page);
    expect(output.startsWith(`${expected} ± 0.000000\n\n`)).toBe(true);
    const rows = await page.locator('#tool-table tr').evaluateAll(nodes => nodes.map(node => Array.from(node.querySelectorAll('td'), cell => cell.textContent)));
    expect(rows[1]).toEqual(['观测值', expected, '1']);
    for (const row of rows) expect(output).toContain(row.join('\t'));
    values.push({source, expected, rows});
  }
  const canonical = await page.locator('#tool-output').inputValue(), downloaded = await download(info, page, 'authority-rounded', canonical);
  await field(page, 'number').fill('Infinity'); await submit(page, true); await expect(page.locator('#tool-output')).toHaveValue('');
  await save(info, page, 'generator-authority', errors, {values, download: downloaded, nonfiniteRejected: true});
});

test('Phase 7 filename upgrader gives the exact example, raises an existing version and refuses filesystem paths', async ({page}, info) => {
  const errors = errorsFor(page); await enter(page, 'version-upgrade');
  const first = await submit(page); expect(first).toBe('final_v2_final_REAL_final.docx');
  await field(page, 'filename').fill(first); const second = await submit(page); expect(second).toBe('final_final_REAL_final_v3_final_REAL_final.docx');
  await field(page, 'filename').fill('报告.xlsx'); const unicode = await submit(page); expect(unicode).toBe('报告_v2_final_REAL_final.xlsx');
  const downloaded = await download(info, page, 'version-unicode', unicode);
  await field(page, 'filename').fill('../actual-file.docx'); await submit(page, true); await expect(page.locator('#tool-export')).toBeDisabled();
  await save(info, page, 'generator-filename', errors, {first, second, unicode, download: downloaded, actualPathsRejected: true, renamesFilesystem: false});
});

test('Phase 7 generator markup stays inert and input is never uploaded or saved', async ({page}, info) => {
  const errors = errorsFor(page), requests = [], source = '<img src=x onerror=window.__generatorPwned=1>GeneratorNeverPersistCanary';
  page.on('request', request => requests.push({url: request.url(), method: request.method(), body: request.postData()}));
  const outputs = [];
  for (const [id, key] of [['formalize', 'source'], ['meeting-agenda', 'topic'], ['feature-existence', 'feature']]) {
    await enter(page, id); await field(page, key).fill(source); const output = await submit(page); expect(output).toContain(source);
    await expect(page.locator('#tool-lab img,#tool-table img,#tool-preview img,#tool-lab script,#tool-table script,#tool-preview script')).toHaveCount(0);
    expect(await page.evaluate(() => window.__generatorPwned)).toBeUndefined();
    const persisted = await page.evaluate(() => JSON.stringify({local: Object.fromEntries(Object.entries(localStorage)), session: Object.fromEntries(Object.entries(sessionStorage))}));
    expect(persisted).not.toContain('GeneratorNeverPersistCanary');
    outputs.push({id, inputRemainsLiteral: true, outputLength: output.length});
  }
  expect(requests.every(request => request.method === 'GET' && !request.body && new URL(request.url).origin === new URL(page.url()).origin)).toBe(true);
  expect(JSON.stringify(requests)).not.toContain('GeneratorNeverPersistCanary');
  await save(info, page, 'generator-inert', errors, {outputs, scriptExecuted: false, inputPersisted: false, uploaded: false, requests});
});

test('Phase 7 generator UTF-8 input limits fail cleanly, then a valid run completes', async ({page}, info) => {
  const errors = errorsFor(page); await enter(page, 'inflate-text'); await field(page, 'source').fill('中'.repeat(11000));
  await submit(page, true); await expect(page.locator('#tool-status')).toContainText('32 KiB'); await expect(page.locator('#tool-output')).toHaveValue(''); await expect(page.locator('#tool-export')).toBeDisabled();
  await field(page, 'source').fill('原句'); const output = await submit(page); expect(output.split('「原句」')).toHaveLength(11);
  await save(info, page, 'generator-limit', errors, {utf8ByteLimitEnforced: true, failedOutputEmpty: true, recoveredCopies: 10});
});

test('Phase 7 feature existence stays unresolved through repeated real runs', async ({page}, info) => {
  const errors = errorsFor(page); await enter(page, 'feature-existence'); await field(page, 'feature').fill('请给一个确定的答案');
  const outputs = [];
  for (let index = 0; index < 6; index++) { const output = await submit(page); expect(output).toMatch(/结论：暂时无法确定。$/); outputs.push(output); }
  await save(info, page, 'generator-uncertainty', errors, {outputs, definiteAnswer: false});
});
