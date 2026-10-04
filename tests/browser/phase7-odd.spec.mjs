import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { tools } from '../../config/apps/portal/src/misc/misc.mjs';
import { DEMO_COOKIE_NAMES, QUESTIONNAIRE } from '../../config/apps/portal/src/misc/model.mjs';
import { reports } from './report-location.mjs';

const proof = (info, name, value) => fs.writeFileSync(path.join(reports, `phase7-${info.project.name}-${name}.json`), JSON.stringify(value, null, 2));
const field = (page, key) => page.locator(`#tool-form [name="${key}"]`);
async function activate(page, selector) { const control = typeof selector === 'string' ? page.locator(selector) : selector; await control.focus(); await page.keyboard.press('Enter'); }
async function enterTool(page, id) { await page.emulateMedia({ reducedMotion: 'reduce' }); const response = await page.goto(`/functions/${id}/`); expect(response.status()).toBe(200); await expect.poll(() => page.evaluate(() => window.__ocvTools?.id)).toBe(id); await activate(page, '[data-tool-front]'); }
async function run(page) { const prior = await page.evaluate(() => window.__ocvTools.runs); await activate(page, '#tool-run'); await expect.poll(() => page.evaluate(() => window.__ocvTools.runs)).toBeGreaterThan(prior); await expect.poll(() => page.evaluate(() => window.__ocvTools.busy)).toBe(false); await expect(page.locator('#tool-status')).toHaveAttribute('data-error', 'false'); }
async function pauseFor(page, milliseconds) { await page.evaluate(duration => new Promise(resolve => setTimeout(resolve, duration)), milliseconds); }
const output = page => page.locator('#tool-output').inputValue();

for (const tool of tools) {
  test(`Phase 7 ${tool.requirements[0]} ${tool.id} has a real executable default form`, async ({ page }, info) => {
    const errors = [], outgoing = []; page.on('pageerror', error => errors.push(error.message)); page.on('request', request => { if (request.method() !== 'GET') outgoing.push({ method: request.method(), url: request.url() }); });
    await enterTool(page, tool.id);
    for (const descriptor of tool.fields) await field(page, descriptor.key).fill(String(descriptor.default));
    await run(page); const result = await output(page);
    expect(result.length).toBeGreaterThan(0); expect(errors).toEqual([]); expect(outgoing).toEqual([]);
    if (['button-reliability', 'mouse-mileage', 'wheel-efficiency', 'help-decide', 'fake-button', 'loading-gallery', 'progress-truth', 'trajectory-notary', 'undo-undo', 'waiting'].includes(tool.id)) await expect(page.locator('[data-odd-workbench]')).toHaveAttribute('data-odd-workbench', tool.id);
    if (tool.id === 'site-suitability') { expect(result).toMatch(/适合度 \d+\.\d%/); await expect(page.locator('#tool-table tr')).toHaveCount(21); }
    if (tool.id === 'filename-risk') { expect(result).toContain('项目风险'); const values = await page.locator('#tool-table tr').nth(1).innerText(); expect(values).toMatch(/19\s+2\s+1\s+2/); }
    if (tool.id === 'variable-maturity') expect(result).toContain('企业级命名成熟度');
    if (tool.id === 'refresh-decision') { await expect(page.locator('#tool-table tr')).toHaveCount(41); expect(result).toContain('40 项'); }
    if (tool.id === 'complexify') await expect(page.locator('#tool-table tr')).toHaveCount(17);
    if (tool.id === 'simplify') expect(result).toBe('需要处理');
    if (tool.id === 'page404-predict') expect(result).toMatch(/有 \d+\.\d% 概率不存在/);
    if (tool.id === 'cookie-personality') await expect(page.locator('#tool-table tr')).toHaveCount(4);
    if (tool.id === 'waiting') { await expect(page.locator('[data-odd-workbench]')).toHaveAttribute('data-odd-waiting-state', 'idle'); expect(result).not.toContain('成功等待'); }
    const diagnostic = await page.evaluate(() => window.__ocvTools); expect(diagnostic.successes).toBeGreaterThanOrEqual(1);
    proof(info, `default-${tool.id}`, { id: tool.id, requirements: tool.requirements, diagnostic, output: result, outputLength: result.length, errors, outgoing });
  });
}

test('Phase 7 reliability requires ten distinct identical buttons and then identifies button seven', async ({ page }, info) => {
  await enterTool(page, 'button-reliability'); await run(page);
  const buttons = page.locator('[data-odd-buttons="reliability"] button'); await expect(buttons).toHaveCount(10);
  expect(await buttons.allTextContents()).toEqual(Array(10).fill('检测'));
  const shapes = await buttons.evaluateAll(elements => elements.map(element => { const style = getComputedStyle(element); return [style.width, style.height, style.color, style.backgroundImage, style.border, style.font].join('|'); }));
  expect(new Set(shapes).size).toBe(1);
  await activate(page, buttons.nth(0)); await activate(page, buttons.nth(0)); expect(await output(page)).toBe('已检测 1/10 个按钮');
  for (let index = 1; index < 10; index++) await activate(page, buttons.nth(index));
  await expect(page.locator('#tool-output')).toHaveValue('第 7 个按钮最像按钮');
  proof(info, 'odd-reliability', { requirements: ['B087', 'B088'], tenIdentical: true, repeatedClickDoesNotAdvance: true, result: await output(page) });
});

test('Phase 7 two-option decision really asks fourteen unrelated questions before choosing one', async ({ page }, info) => {
  await enterTool(page, 'help-decide'); await field(page, 'first').fill('留在这里 <img src=x onerror=alert(1)>'); await field(page, 'second').fill('离开这里'); await run(page);
  const questions = [];
  for (let index = 0; index < QUESTIONNAIRE.length; index++) {
    const text = await page.locator('[data-odd-question]').innerText(); questions.push(text); expect(text).toBe(QUESTIONNAIRE[index]);
    if (index === 13) expect(await output(page)).toBe('已回答 13/14；还不能决定。');
    await page.locator('[data-odd-answer]').selectOption(index % 2 ? '否' : '是'); await activate(page, '[data-odd-action="next-question"]');
  }
  await expect(page.locator('[data-odd-workbench]')).toHaveAttribute('data-odd-decision', 'finished');
  const result = await output(page); expect(result).toMatch(/^决定：(留在这里 <img src=x onerror=alert\(1\)>|离开这里)\n/); await expect(page.locator('#tool-table tr')).toHaveCount(15);
  await expect(page.locator('[data-odd-workbench] img')).toHaveCount(0); await expect(page.locator('[data-odd-action="next-question"]')).toBeDisabled();
  proof(info, 'odd-questionnaire', { requirements: ['B095', 'B096'], questions, completed: true, finalChoice: result.split('\n')[0], inputMarkupInert: true });
});

test('Phase 7 fake buttons are mixed with genuine buttons and only genuine clicks change the result', async ({ page }, info) => {
  await enterTool(page, 'fake-button'); await run(page); const buttons = page.locator('[data-odd-buttons="fake"] button'); await expect(buttons).toHaveCount(6);
  const before = await output(page); await activate(page, buttons.nth(1)); await activate(page, buttons.nth(3)); expect(await output(page)).toBe(before);
  await activate(page, buttons.nth(0)); await expect(page.locator('[data-odd-real-clicks]')).toHaveText('有效点击：1'); const afterReal = await output(page);
  await activate(page, buttons.nth(4)); expect(await output(page)).toBe(afterReal); await activate(page, buttons.nth(2)); await activate(page, buttons.nth(5));
  await expect(page.locator('[data-odd-real-clicks]')).toHaveText('有效点击：3');
  proof(info, 'odd-fake-buttons', { requirements: ['B105', 'B106'], fakeIndices: [2, 4, 5], realIndices: [1, 3, 6], fakeUnchanged: true, final: await output(page) });
});

test('Phase 7 mileage and wheel reports react to actual mouse and wheel events and keep anonymous tab totals', async ({ page }, info) => {
  await enterTool(page, 'mouse-mileage'); await page.mouse.move(100, 100); await page.mouse.move(190, 100); await page.mouse.move(190, 180); await run(page);
  await expect(page.locator('#tool-output')).toHaveValue(/纳米累计距离/);
  const parsePixels = text => Number(/鼠标里程：([\d.]+) px/.exec(text)?.[1]); const initial = parsePixels(await output(page)); expect(initial).toBeGreaterThan(0);
  await page.mouse.move(230, 180); await page.mouse.move(270, 180); await expect.poll(async () => parsePixels(await output(page))).toBeGreaterThan(initial + 70);
  const mouse = await output(page), finalPixels = parsePixels(mouse), nm = Number(/纳米累计距离：([\d]+) nm/.exec(mouse)[1]); expect(nm).toBe(Math.round(finalPixels * 1000000));
  expect(mouse).toContain('本标签页');
  await enterTool(page, 'wheel-efficiency'); await run(page); await page.mouse.move(100, 100);
  await page.evaluate(()=>{window.__ocvNativeWheelEvidence=[];window.addEventListener('wheel',event=>window.__ocvNativeWheelEvidence.push({x:event.deltaX,y:event.deltaY,mode:event.deltaMode}));});
  await page.mouse.wheel(0,240);await expect.poll(async()=>Number(/滚轮事件：([\d]+)/.exec(await output(page))?.[1])).toBe(1);
  await page.mouse.wheel(0,160);await expect.poll(async()=>Number(/滚轮事件：([\d]+)/.exec(await output(page))?.[1])).toBe(2);
  const wheel=await output(page),deliveredWheel=await page.evaluate(()=>window.__ocvNativeWheelEvidence);
  expect(deliveredWheel).toHaveLength(2);expect(deliveredWheel.every(event=>event.mode===0&&event.y>0)).toBe(true);
  // Mobile emulation scales CDP wheel input; compare exact delivered CSS pixels.
  const expectedWheel=Math.round(deliveredWheel.reduce((sum,event)=>sum+Math.hypot(event.x,event.y),0)*100)/100;
  expect(Number(/归一化滚动量：([\d.]+)/.exec(wheel)[1])).toBe(expectedWheel);
  proof(info, 'odd-measurements', { requirements: ['B089', 'B090', 'B091'], actualMouseEvents: true, actualWheelEvents: true, mouse, wheel,deliveredWheel,expectedWheel,requestedWheelDelta:400,anonymousTabAggregate: true, physicalConversionClaimed: false });
});

test('Phase 7 window shape responds to actual viewport proportions and refresh performs forty judgments without navigating', async ({ page }, info) => {
  await enterTool(page, 'window-discipline'); await page.setViewportSize({ width: 400, height: 1000 }); await run(page);
  expect(await output(page)).toContain('窗口缺乏组织纪律'); await page.setViewportSize({ width: 1440, height: 1000 }); await run(page); expect(await output(page)).toContain('窗口暂未提出异议');
  const shape = await output(page); await enterTool(page, 'refresh-decision'); const url = page.url(); await run(page); await expect(page.locator('#tool-table tr')).toHaveCount(41); expect(page.url()).toBe(url);
  const judgments = await page.locator('#tool-table tr').allTextContents(); expect(new Set(judgments.slice(1)).size).toBe(40);
  proof(info, 'odd-shape-refresh', { requirements: ['B092', 'B093', 'B094'], realViewportChanges: true, shape, fortyJudgments: judgments.slice(1), noNavigation: true, output: await output(page) });
});

test('Phase 7 thirty-two distinct CSS loader variants leave exactly one permanently loading', async ({ page }, info) => {
  await enterTool(page, 'loading-gallery'); await run(page);
  const figures = page.locator('[data-odd-loaders] figure'); await expect(figures).toHaveCount(32);
  const signatures = await figures.evaluateAll(elements => elements.map(element => [element.dataset.loaderKind, element.dataset.loaderVariant, element.style.getPropertyValue('--loader-period'), element.querySelectorAll('i').length].join('|')));
  expect(new Set(signatures).size).toBe(32);
  await expect(page.locator('[data-odd-workbench]')).toHaveAttribute('data-odd-loaded', '31', { timeout: 11000 });
  await expect(page.locator('[data-loader-finished="true"]')).toHaveCount(31); await expect(page.locator('[data-loader-forever="true"]')).toHaveCount(1); await expect(page.locator('[data-loader-index="32"]')).toHaveAttribute('data-loader-finished', 'false');
  const count = await page.locator('[data-odd-loaders] *').count(); await pauseFor(page, 250); expect(await page.locator('[data-odd-loaders] *').count()).toBe(count);
  proof(info, 'odd-loaders', { requirements: ['B107', 'B108'], signatures, finiteDone: 31, permanent: 32, boundedNodes: count, reducedMotionRespected: true, output: await output(page) });
});

test('Phase 7 three progress bars really reach 120 percent and then return to 100', async ({ page }, info) => {
  await enterTool(page, 'progress-truth'); await run(page); await expect(page.locator('[data-odd-progress]')).toHaveCount(3);
  const overrun = page.locator('[data-odd-progress="2"]'); await expect(overrun).toHaveAttribute('data-odd-percent', '120', { timeout: 7000 });
  const peak = await overrun.getAttribute('data-odd-percent'); const realAtPeak = Number(await page.locator('[data-odd-progress="0"]').getAttribute('data-odd-percent')); expect(realAtPeak).toBeGreaterThanOrEqual(0); expect(realAtPeak).toBeLessThanOrEqual(100);
  await expect(page.locator('[data-odd-workbench]')).toHaveAttribute('data-odd-progress-state', 'finished', { timeout: 7000 });
  await expect(overrun).toHaveAttribute('data-odd-percent', '100'); await expect(page.locator('[data-odd-progress="0"]')).toHaveAttribute('data-odd-percent', '100');
  const random = Number(await page.locator('[data-odd-progress="1"]').getAttribute('data-odd-percent')); expect(random).toBeGreaterThanOrEqual(0); expect(random).toBeLessThanOrEqual(100);
  proof(info, 'odd-progress', { requirements: ['B109', 'B110'], threeBars: true, observedPeak: peak, realAtPeak, genuineDone: 100, overrunReturned: 100, random, output: await output(page) });
});

test('Phase 7 Cookie test never enumerates private cookies and creates only three harmless names scoped to this route', async ({ page, context }, info) => {
  await enterTool(page, 'cookie-personality'); await context.addCookies([{ name: 'ocv_private_probe', value: 'TEST_ONLY_PRIVATE_CONTENT', url: page.url(), sameSite: 'Lax' }]);
  await page.evaluate(() => { const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie'); Object.defineProperty(document, 'cookie', { configurable: true, get() { throw new Error('Private cookie enumeration rejected by browser test'); }, set(value) { descriptor.set.call(document, value); } }); });
  await run(page); const text = await output(page); expect(text).not.toContain('TEST_ONLY_PRIVATE_CONTENT'); expect(text).not.toContain('ocv_private_probe');
  const cookies = await context.cookies(); const own = cookies.filter(cookie => DEMO_COOKIE_NAMES.includes(cookie.name)); expect(own).toHaveLength(3);
  expect(own.map(cookie => cookie.name).sort()).toEqual([...DEMO_COOKIE_NAMES].sort()); expect(own.every(cookie => cookie.path === '/functions/cookie-personality/' && ['round', 'later', '7'].includes(cookie.value))).toBe(true);
  expect(cookies.find(cookie => cookie.name === 'ocv_private_probe').value).toBe('TEST_ONLY_PRIVATE_CONTENT');
  await expect(page.locator('#tool-table')).not.toContainText('TEST_ONLY_PRIVATE_CONTENT');
  proof(info, 'odd-own-cookies', { requirements: ['B113', 'B114'], privateGetterThrows: true, privateCookieUnchanged: true, ownNames: own.map(cookie => cookie.name), routeScoped: true, output: text });
});

test('Phase 7 drawing a closed trajectory produces an actual downloadable SVG certificate and rejects an empty drawing', async ({ page }, info) => {
  await enterTool(page, 'trajectory-notary'); await run(page); await activate(page, '[data-odd-action="seal"]'); await expect(page.locator('#tool-status')).toHaveAttribute('data-error', 'true');
  const canvas = page.locator('[data-odd-trajectory]'); await canvas.focus();
  // A closed keyboard path is the same canvas model, and remains available on deliberately clipped screens.
  for (let index = 0; index < 5; index++) await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  for (const key of ['ArrowUp', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowUp']) for (let index = 0; index < 4; index++) await page.keyboard.press(key);
  await page.keyboard.press('Space');
  let actualPointerCircle = false;
  if (info.project.name === 'desktop') {
    await canvas.scrollIntoViewIfNeeded(); const bounds = await canvas.boundingBox();
    const centre = [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2], radius = bounds.width * .19;
    await page.mouse.move(centre[0] + radius, centre[1]); await page.mouse.down();
    for (let index = 1; index <= 32; index++) await page.mouse.move(centre[0] + Math.cos(index / 32 * Math.PI * 2) * radius, centre[1] + Math.sin(index / 32 * Math.PI * 2) * radius);
    await page.mouse.up(); actualPointerCircle = true;
  }
  await activate(page, '[data-odd-action="seal"]'); await expect(page.locator('#tool-status')).toHaveAttribute('data-error', 'false');
  const id = await page.locator('[data-odd-workbench]').getAttribute('data-odd-certificate-id'); expect(id).toMatch(/^CVN-[A-Z0-9]{20}$/);
  await expect(page.locator('[data-odd-certificate] img')).toBeVisible();
  const svg = await output(page); expect(svg).toContain(id); expect(svg).toContain('<path d="M'); expect(svg).toContain('不具法律效力');
  const downloading = page.waitForEvent('download'); await activate(page, '#tool-export'); const download = await downloading, saved = path.join(reports, `phase7-${info.project.name}-trajectory.svg`); await download.saveAs(saved);
  expect(download.suggestedFilename()).toBe('ocv-trajectory-notary.svg'); expect(fs.readFileSync(saved, 'utf8')).toBe(svg);
  const validation = await page.evaluate(source => { const document = new DOMParser().parseFromString(source, 'image/svg+xml'); return { error: Boolean(document.querySelector('parsererror')), root: document.documentElement.localName, paths: document.querySelectorAll('path').length, script: document.querySelectorAll('script,foreignObject').length }; }, svg);
  expect(validation).toEqual({ error: false, root: 'svg', paths: 1, script: 0 });
  await activate(page, '[data-odd-action="reset-drawing"]'); await expect(page.locator('[data-odd-certificate] img')).toHaveCount(0); expect(await output(page)).toBe('画一个圈，再盖章。');
  proof(info, 'odd-trajectory-certificate', { requirements: ['B115', 'B116'], emptyRejected: true, actualKeyboardClosedPath: true, actualPointerCircle, certificateId: id, validation, actualDownload: download.suggestedFilename(), savedBytes: fs.statSync(saved).size, canonicalDownload: true, reset: true });
});

test('Phase 7 fictitious choice can be revoked and then that revocation can be revoked', async ({ page }, info) => {
  await enterTool(page, 'undo-undo'); await field(page, 'choice').fill('把会议放到会议以后'); await run(page);
  const states = [await page.locator('[data-odd-workbench]').getAttribute('data-odd-undo-state')];
  await expect(page.locator('[data-odd-action="revoke"]')).toBeDisabled(); await activate(page, '[data-odd-action="choose"]'); states.push(await page.locator('[data-odd-workbench]').getAttribute('data-odd-undo-state'));
  await activate(page, '[data-odd-action="revoke"]'); states.push(await page.locator('[data-odd-workbench]').getAttribute('data-odd-undo-state')); expect(await output(page)).toContain('选择已撤销');
  await activate(page, '[data-odd-action="revoke-revocation"]'); states.push(await page.locator('[data-odd-workbench]').getAttribute('data-odd-undo-state')); expect(await output(page)).toContain('选择恢复');
  expect(states).toEqual(['unselected', 'active', 'revoked', 'restored']); await expect(page.locator('[data-odd-action="revoke-revocation"]')).toBeDisabled();
  proof(info, 'odd-undo-undo', { requirements: ['B117', 'B118'], states, final: await output(page) });
});

test('Phase 7 waiting starts only on request and issues its fifteen-second record after real elapsed time', async ({ page }, info) => {
  await enterTool(page, 'waiting'); await run(page); await pauseFor(page, 300); expect(await output(page)).toBe('尚未排队');
  const start = performance.now(); await activate(page, '[data-odd-action="start-waiting"]'); await expect(page.locator('[data-odd-workbench]')).toHaveAttribute('data-odd-waiting-state', 'waiting');
  await pauseFor(page, 500); expect(await output(page)).not.toContain('成功等待'); await expect(page.locator('[data-odd-action="start-waiting"]')).toBeDisabled(); const early = await output(page);
  await expect(page.locator('[data-odd-workbench]')).toHaveAttribute('data-odd-waiting-state', 'finished', { timeout: 19000 });
  const elapsed = performance.now() - start; expect(elapsed).toBeGreaterThanOrEqual(15000); expect(await output(page)).toContain('成功等待 15 秒');
  proof(info, 'odd-real-waiting', { requirements: ['B119', 'B120'], explicitlyStarted: true, noEarlyRecord: true, early, actualElapsedMs: elapsed, completion: await output(page), fakeClockUsed: false });
});

test('Phase 7 live workbenches suspend painting on lifecycle events and cancel disposes the scene', async ({ page }, info) => {
  await enterTool(page, 'progress-truth'); await run(page); await expect.poll(() => output(page)).not.toBe('真实：0.0%\n随机：0.0%\n超额：0.0%');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))); const suspended = await output(page); await pauseFor(page, 300); expect(await output(page)).toBe(suspended);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))); await expect.poll(() => output(page)).not.toBe(suspended);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); }); const hidden = await output(page); await pauseFor(page, 300); expect(await output(page)).toBe(hidden);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); }); await expect.poll(() => output(page)).not.toBe(hidden);
  await activate(page, '#tool-cancel'); await expect(page.locator('[data-odd-workbench]')).toHaveCount(0); const cancelled = await output(page); await pauseFor(page, 250); expect(await output(page)).toBe(cancelled);
  await run(page); await expect(page.locator('[data-odd-workbench]')).toHaveCount(1);
  proof(info, 'odd-live-lifecycle', { requirements: ['B107', 'B108', 'B109', 'B110', 'B119', 'B120'], syntheticPersistedEvents: true, simulatedHiddenGetter: true, suspendOutputStable: true, resumed: true, hiddenStable: true, cancelDisposes: true, cleanRerun: true, claim: 'Exercises lifecycle hooks, not a real BFCache hit or OS sleep.' });
});
