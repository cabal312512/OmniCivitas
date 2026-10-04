import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { phase5Tools as tools } from '../../config/apps/portal/src/tool/data.mjs';
import { reports } from './report-location.mjs';

const ABC_SHA = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const UNICODE_SHA = '25feb68e8651a1e87d13b2a93c080d75e40174800e19388820c27be17009cd66';
const proof = (info, name, value) => fs.writeFileSync(path.join(reports, `phase5-${info.project.name}-${name}.json`), JSON.stringify(value, null, 2));
const field = (page, key) => page.locator(`#tool-form [name="${key}"]`);

async function enterTool(page, id) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const response = await page.goto(`/functions/${id}/`);
  expect(response.status()).toBe(200);
  await expect.poll(() => page.evaluate(() => window.__ocvTools?.id)).toBe(id);
  await page.locator('[data-tool-front]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#tool-output')).toHaveAttribute('readonly', '');
}

async function activate(page, selector) {
  await page.locator(selector).focus();
  await page.keyboard.press('Enter');
}

async function submit(page, { error = false } = {}) {
  const previous = await page.evaluate(() => window.__ocvTools.runs);
  await activate(page, '#tool-run');
  await expect.poll(() => page.evaluate(() => window.__ocvTools.runs)).toBeGreaterThan(previous);
  await expect.poll(() => page.evaluate(() => window.__ocvTools.busy)).toBe(false);
  await expect(page.locator('#tool-status')).toHaveAttribute('data-error', String(error));
  return page.locator('#tool-output').inputValue();
}

async function defaultFields(page, tool) {
  for (const descriptor of tool.fields) {
    if (descriptor.type === 'file') {
      if (tool.id === 'file-checksum') await field(page, descriptor.key).setInputFiles({ name: 'abc.txt', mimeType: 'text/plain', buffer: Buffer.from('abc') });
      continue;
    }
    const value = String(descriptor.default ?? '');
    if (descriptor.type === 'select') await field(page, descriptor.key).selectOption(value);
    else await field(page, descriptor.key).fill(value);
  }
}

async function knownDefault(page, tool, output) {
  expect(output.trim().length).toBeGreaterThan(0);
  const exact = {
    'text-dedupe': 'alpha\nbeta', 'text-sort': 'a\nbeta\ngamma', 'text-case': 'HELLO OMNICIVITAS',
    timestamp: '1970-01-01T00:00:00.000Z', convert: '100', calculator: '4', scientific: '1',
    matrix: '5\t5\n5\t5', radix: '20000000000001', roman: 'MCMXCIV', permissions: 'rwxr-xr-x',
    hash: ABC_SHA, 'file-checksum': ABC_SHA,
    morse: '... --- ... / -.-. .. ...- .. .-.. .. --.. .- - .. --- -. / .....',
  };
  if (Object.hasOwn(exact, tool.id)) expect(output).toBe(exact[tool.id]);
  if (tool.id === 'base64') expect(await page.evaluate(value => new TextDecoder().decode(Uint8Array.from(atob(value), char => char.charCodeAt(0))), output)).toBe('OmniCivitas OCV 🧪');
  if (tool.id === 'json') { expect(JSON.parse(output)).toEqual({ OCV: true, 版本: 5 }); expect(output).toContain('\n  '); }
  if (tool.id === 'xml') expect(await page.evaluate(value => {
    const doc = new DOMParser().parseFromString(value, 'application/xml');
    return Array.from(doc.querySelectorAll('root > item'), node => node.textContent);
  }, output)).toEqual(['OCV', ' x < y ']);
  if (tool.id === 'text') { expect(output).toContain('行\t2'); expect(output).toContain('UTF-8 字节'); }
  if (tool.id === 'markdown') { await expect(page.locator('#tool-preview h1')).toHaveText('OmniCivitas'); await expect(page.locator('#tool-preview strong')).toHaveText('OCV'); }
  if (tool.id === 'csv') { await expect(page.locator('#tool-table tr')).toHaveCount(2); await expect(page.locator('#tool-table tr').nth(1)).toContainText('逗号,在这里'); }
  if (tool.id === 'ascii') { expect(output.split('\n')).toHaveLength(5); expect(output.split('\n').every(row => row.length === 23)).toBe(true); expect(output).toMatch(/#/); }
  if (tool.id === 'time-zone') expect(output).toBe('2024-03-10 15:00:00.000 GMT+08:00 [Asia/Shanghai]');
  if (tool.id === 'color') { expect(output).toContain('#0060FF'); expect(output).toContain('rgb(0, 96, 255)'); }
  if (tool.id === 'regex') expect(JSON.parse(output).matches).toEqual([
    { index: 0, value: 'one', groups: ['one'], namedGroups: { word: 'one' } },
    { index: 4, value: 'two', groups: ['two'], namedGroups: { word: 'two' } },
    { index: 8, value: '42', groups: ['42'], namedGroups: { word: '42' } },
  ]);
  if (tool.id === 'uuid') expect(output).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  if (tool.id === 'random') { const values = output.split('\n').map(Number); expect(values).toHaveLength(10); expect(values.every(value => Number.isInteger(value) && value >= 1 && value <= 100)).toBe(true); }
  if (tool.id === 'password') { expect(output).toHaveLength(24); expect(output).toMatch(/[a-z]/); expect(output).toMatch(/[A-Z]/); expect(output).toMatch(/[0-9]/); expect(output).toMatch(/[^a-zA-Z0-9]/); }
  if (tool.id === 'http-status') expect(output).toContain('404\tNot Found');
  if (tool.id === 'mime') expect(output).toContain('avif\timage/avif');
  if (tool.id === 'screen') { const viewport = await page.evaluate(() => `${innerWidth} × ${innerHeight} CSS px`); expect(output).toContain(viewport); }
  if (tool.id === 'user-agent') expect(output).toBe(await page.evaluate(() => navigator.userAgent));
  if (tool.id === 'capabilities') expect(output).toContain('您的设备支持按钮');
  if (tool.id === 'ping') { expect(output).toMatch(/响应耗时\t\d+\.\d{2} ms/); expect(output).toContain('不能当作网络速度'); }
}

for (const tool of tools) {
  test(`Phase 5 ${tool.requirements.join('/')} ${tool.id} actual form computes its known default`, async ({ page }, info) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await enterTool(page, tool.id);
    await expect(page.locator('h1')).toContainText(tool.title);
    await defaultFields(page, tool);
    const output = await submit(page);
    await knownDefault(page, tool, output);
    const diagnostic = await page.evaluate(() => window.__ocvTools);
    expect(Object.keys(diagnostic).sort()).toEqual(['id', 'runs', 'successes', 'busy', 'cancelled', 'lastTool', 'resultLength'].sort());
    expect(diagnostic.successes).toBeGreaterThanOrEqual(1);
    expect(errors).toEqual([]);
    proof(info, `default-${tool.id}`, { id: tool.id, requirements: tool.requirements, diagnostic, outputLength: output.length, ...(tool.id === 'password' ? {} : { output }), errors });
  });
}

test('Phase 5 all 35 routes and directory exist; portal search opens active JSON instead of a placeholder', async ({ page, request }, info) => {
  expect(tools).toHaveLength(35);
  expect(new Set(tools.map(tool => tool.id)).size).toBe(35);
  const routes = [];
  for (const tool of tools) {
    const response = await request.get(`/functions/${tool.id}/`);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain('tool-form');
    routes.push({ id: tool.id, status: response.status() });
  }
  await page.goto('/functions/');
  for (const tool of tools) await expect(page.locator(`a[href="/functions/${tool.id}/"]`).first()).toBeAttached();
  await page.goto('/portals/unified/');
  await page.locator('#portal-search').fill('JSON');
  await page.locator('#portal-search').press('Enter');
  const target = page.locator('.search-result a[href="/functions/json/"]');
  await expect(target).toHaveCount(1);
  await target.focus(); await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/functions\/json\/$/);
  await expect(page.locator('#tool-form')).toBeVisible();
  await expect(page.getByText('尚未开放', { exact: true })).toHaveCount(0);
  proof(info, 'routes', { routes, directory: true, searchJson: true });
});

test('Phase 5 local file checksum hashes exact bytes, refuses large files before reading and never uploads data', async ({ page }, info) => {
  const requests = [];
  page.on('request', request => requests.push({ url: request.url(), method: request.method(), body: request.postData() }));
  await enterTool(page, 'file-checksum');
  await field(page, 'file').setInputFiles({ name: 'unicode-never-upload.txt', mimeType: 'text/plain', buffer: Buffer.from('你好🌍') });
  expect(await submit(page)).toBe(UNICODE_SHA);
  await field(page, 'file').setInputFiles({ name: 'oversized-never-upload.bin', mimeType: 'application/octet-stream', buffer: Buffer.alloc(8 * 1024 * 1024 + 1) });
  await submit(page, { error: true });
  await expect(page.locator('#tool-status')).toContainText('大文件暂不支持');
  expect(requests.every(request => request.method === 'GET' && !request.body && !/unicode-never-upload|oversized-never-upload|%E4%BD%A0/.test(request.url))).toBe(true);
  proof(info, 'checksum', { unicodeHash: UNICODE_SHA, largeFileRejected: true, requests });
});

test('Phase 5 CSV uploaded quotes/newlines remain exact cells and real export parses back losslessly', async ({ page }, info) => {
  await enterTool(page, 'csv');
  const input = 'name,note\r\n文明,"一行,逗号\n第二行"\r\n"a""b",=1+1';
  await field(page, 'file').setInputFiles({ name: 'quoted.csv', mimeType: 'text/csv', buffer: Buffer.from(input) });
  await submit(page);
  const cells = await page.locator('#tool-table tr').evaluateAll(rows => rows.map(row => Array.from(row.querySelectorAll('th,td'), cell => cell.textContent)));
  expect(cells).toEqual([['name', 'note'], ['文明', '一行,逗号\n第二行'], ['a"b', '=1+1']]);
  const canonical = await page.locator('#tool-output').inputValue();
  // HTML textarea.value normalizes record CRLF to LF. Test Blob bytes independently; never infer them from the control.
  // https://html.spec.whatwg.org/multipage/form-elements.html#the-textarea-element
  expect(canonical).toBe(input.replace(/\r\n/g, '\n'));
  const downloading = page.waitForEvent('download');
  await activate(page, '#tool-export');
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('ocv-csv.csv');
  const saved = path.join(reports, `phase5-${info.project.name}-quoted.csv`);
  await download.saveAs(saved);
  expect(fs.readFileSync(saved, 'utf8')).toBe(input);
  await field(page, 'file').setInputFiles([]);
  await field(page, 'source').fill(fs.readFileSync(saved, 'utf8'));
  await submit(page);
  expect(await page.locator('#tool-table tr').evaluateAll(rows => rows.map(row => Array.from(row.querySelectorAll('th,td'), cell => cell.textContent)))).toEqual(cells);
  proof(info, 'csv', { cells, canonical: input, displayedCanonical: canonical, filename: download.suggestedFilename(), roundTrip: true });
});

test('Phase 5 XML preserves mixed content and CDATA; Markdown strips executable and remote content', async ({ page }, info) => {
  await enterTool(page, 'xml');
  const xml = '<root>Hello <b>世界</b><![CDATA[ x < y & z ]]><item a="&quot;">A &amp; B</item> end</root>';
  await field(page, 'source').fill(xml);
  const formatted = await submit(page);
  expect(await page.evaluate(({ before, after }) => {
    const parser = new DOMParser();
    const original = parser.parseFromString(before, 'application/xml');
    const result = parser.parseFromString(after, 'application/xml');
    return { text: result.documentElement.textContent, same: original.documentElement.isEqualNode(result.documentElement), cdata: Array.from(result.documentElement.childNodes).some(node => node.nodeType === 4) };
  }, { before: xml, after: formatted })).toEqual({ text: 'Hello 世界 x < y & z A & B end', same: true, cdata: true });
  await field(page, 'source').fill('<!DOCTYPE root [<!ENTITY secret SYSTEM "https://example.invalid/private">]><root>&secret;</root>');
  await submit(page, { error: true });
  await expect(page.locator('#tool-status')).toContainText('DTD');
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await enterTool(page, 'markdown');
  // A raw HTML block ends on a blank line; separate it from the links so they actually exercise Markdown link sanitization.
  // https://spec.commonmark.org/0.31.2/#html-blocks
  const malicious = '# 安全标题\n\n<script>window.__markdownPwned=1</script>\n\n<img src="https://example.invalid/leak" onerror="window.__markdownPwned=2">\n\n[x](javascript:alert(1))\n\n[remote](https://example.invalid/go)\n\n[local](#inside)\n\n<iframe src="https://example.invalid/frame"></iframe>';
  await field(page, 'source').fill(malicious);
  expect(await submit(page)).toBe(malicious);
  await expect(page.locator('#tool-preview h1')).toHaveText('安全标题');
  await expect(page.locator('#tool-preview img,#tool-preview script,#tool-preview iframe,#tool-preview [onerror]')).toHaveCount(0);
  expect(await page.locator('#tool-preview a[href]').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))).toEqual(['#inside']);
  expect(await page.evaluate(() => window.__markdownPwned)).toBeUndefined();
  expect(requests.every(url => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
  proof(info, 'xml-markdown', { xmlEquivalent: true, cdata: true, dtdRejected: true, executableTags: 0, externalRequests: requests.filter(url => new URL(url).origin !== new URL(page.url()).origin) });
});

test('Phase 5 catastrophic RegExp times out in a Worker, UI responds, cancel stops work and a valid run recovers', async ({ page }, info) => {
  await enterTool(page, 'regex');
  await field(page, 'pattern').fill('(a+)+$'); await field(page, 'flags').fill(''); await field(page, 'text').fill('a'.repeat(45) + '!');
  const started = Date.now();
  await activate(page, '#tool-run');
  await expect.poll(() => page.evaluate(() => window.__ocvTools.busy)).toBe(true);
  // A timer on the main thread must run while the backtracking worker remains occupied.
  const responsive = await page.evaluate(() => new Promise(resolve => setTimeout(() => resolve({ time: performance.now(), busy: window.__ocvTools.busy }), 30)));
  expect(responsive.busy).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__ocvTools.busy), { timeout: 12000 }).toBe(false);
  await expect(page.locator('#tool-status')).toHaveAttribute('data-error', 'true');
  await expect(page.locator('#tool-status')).toContainText('1.5 秒');
  const timeoutMs = Date.now() - started;
  expect(timeoutMs).toBeLessThan(12000);
  await activate(page, '#tool-run');
  await expect.poll(() => page.evaluate(() => window.__ocvTools.busy)).toBe(true);
  const previous = await page.evaluate(() => window.__ocvTools.cancelled);
  await activate(page, '#tool-cancel');
  await expect.poll(() => page.evaluate(() => window.__ocvTools.busy)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__ocvTools.cancelled)).toBeGreaterThan(previous);
  await field(page, 'pattern').fill('(?<word>[a-z]+)'); await field(page, 'flags').fill('g'); await field(page, 'text').fill('one 42 two');
  const valid = JSON.parse(await submit(page));
  expect(valid.matches.map(row => [row.index, row.value, row.namedGroups.word])).toEqual([[0, 'one', 'one'], [7, 'two', 'two']]);
  proof(info, 'regex-isolation', { timeoutMs, responsiveDuringWorker: responsive.busy, cancelled: true, valid });
});

test('Phase 5 live keyboard, pointer and viewport use genuine browser events; ping is one fixed same-origin request', async ({ page }, info) => {
  await enterTool(page, 'keyboard'); await submit(page); await page.keyboard.press('q');
  await expect(page.locator('#tool-output')).toHaveValue(/key\tq[\s\S]*code\tKeyQ/);
  const key = await page.locator('#tool-output').inputValue();
  await enterTool(page, 'pointer'); await submit(page); await page.mouse.move(123, 234);
  await expect(page.locator('#tool-output')).toHaveValue(/clientX \/ clientY\t123 \/ 234/);
  const pointer = await page.locator('#tool-output').inputValue();
  await enterTool(page, 'screen'); await submit(page);
  const before = await page.locator('#tool-output').inputValue();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect.poll(() => page.locator('#tool-output').inputValue()).not.toBe(before);
  const viewport = await page.evaluate(() => `${innerWidth} × ${innerHeight} CSS px`);
  await expect(page.locator('#tool-output')).toHaveValue(new RegExp(viewport.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const pingRequests = [];
  page.on('request', request => { if (new URL(request.url()).pathname === '/tool-ping.json') pingRequests.push({ url: request.url(), method: request.method() }); });
  await enterTool(page, 'ping');
  expect(pingRequests).toHaveLength(0);
  const ping = await submit(page);
  expect(pingRequests).toHaveLength(1); expect(pingRequests[0].method).toBe('GET'); expect(new URL(pingRequests[0].url).origin).toBe(new URL(page.url()).origin);
  expect(ping).toContain('不能当作网络速度'); expect(ping).toMatch(/响应耗时\t\d+\.\d{2} ms/);
  proof(info, 'live-and-ping', { key, pointer, viewport, pingRequests, ping });
});

test('Phase 5 copy and download use canonical Unicode text; inputs and generated strings stay out of storage and requests', async ({ page, context, baseURL }, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseURL).origin });
  const requests = [];
  page.on('request', request => requests.push({ url: request.url(), method: request.method(), body: request.postData() }));
  await enterTool(page, 'text-dedupe');
  const canary = 'NeverPersistCanary_本地🧪';
  await field(page, 'source').fill(`${canary}\nalpha\n${canary}`);
  const canonical = await submit(page);
  expect(canonical).toBe(`${canary}\nalpha`);
  await activate(page, '#tool-copy');
  // The Windows system clipboard returns CRLF line separators. Check exact text after this sole platform conversion.
  await expect.poll(() => page.evaluate(async () => (await navigator.clipboard.readText()).replace(/\r\n/g, '\n'))).toBe(canonical);
  const downloading = page.waitForEvent('download'); await activate(page, '#tool-export'); const download = await downloading;
  const saved = path.join(reports, `phase5-${info.project.name}-canonical.txt`); await download.saveAs(saved);
  expect(download.suggestedFilename()).toBe('ocv-text-dedupe.txt'); expect(fs.readFileSync(saved, 'utf8')).toBe(canonical);
  expect(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))).not.toContain(canary);
  expect(JSON.stringify(requests)).not.toContain('NeverPersistCanary'); expect(requests.every(request => request.method === 'GET' && !request.body)).toBe(true);
  await enterTool(page, 'password');
  const generated = await submit(page);
  expect(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, diagnostics: window.__ocvTools }))).not.toContain(generated);
  await enterTool(page, 'calculator'); await submit(page);
  await page.screenshot({ path: path.join(reports, `phase5-${info.project.name}-workbench.png`) });
  proof(info, 'copy-export-privacy', { canonical, copied: true, downloaded: true, filename: download.suggestedFilename(), noInputStorage: true, noRandomStringStorage: true, requestCount: requests.length });
});
