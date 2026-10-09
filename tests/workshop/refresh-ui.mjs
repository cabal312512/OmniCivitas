import {testDeps,testBase} from '../runtime-location.mjs';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';

const base = process.env.OCV_WORKSHOP_BASE_URL||testBase;
const folder = join(testDeps, 'runtime/reports/labs-refresh');
await mkdir(folder, { recursive: true });
const report = { startedAt: new Date().toISOString(), passed: false, automaticReadFailureInjected: false, actual120ReadTimeoutExercised: false, actualSevenDayWaitExercised: false, errors: [], checks: [] };
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(20000);
page.on('pageerror', error => report.errors.push(error.message));
let job;
let automaticReadRequests = 0;
try {
  await page.goto(base + '/workshop/');
  const app = page.frameLocator('#workshop-ui');
  await page.waitForFunction(() => window.__ocvWorkshopResults?.[0]?.result?.frames?.length > 0);
  await page.route('**/api/workshop/jobs/*/read', async route => {
    automaticReadRequests++;
    if (!report.automaticReadFailureInjected) {
      report.automaticReadFailureInjected = true;
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Test-owned interrupted polling"}' });
    } else await route.continue();
  });
  const creation = page.waitForResponse(response => new URL(response.url()).pathname === '/api/workshop/jobs' && response.request().method() === 'POST');
  await app.getByRole('button', { name: '▶ 运行', exact: true }).click();
  const response = await creation;
  assert.ok(response.ok(), `Creation HTTP ${response.status()}`);
  job = await response.json();
  const submitted = response.request().postDataJSON().request;
  await app.locator('.record-status').filter({ hasText: '正在重试' }).waitFor();
  await expect(app.locator('[data-native-result]')).toBeDisabled();
  const pendingColor = await app.locator('[data-native-result]').evaluate(button => getComputedStyle(button).backgroundColor);
  assert.equal(pendingColor, 'rgb(229, 231, 235)', 'The pending result button has a gray background');
  await app.locator('[data-native-result]').screenshot({ path: join(folder, 'pending-button.png') });
  await expect(app.locator('[data-native-cancel]')).toBeEnabled();
  await app.locator('.server-record[data-result-source="local"]').waitFor();
  const front = await page.evaluate(() => window.__ocvWorkshopResults[0]);
  report.checks.push({ name: 'Injected first-read HTTP 503 keeps native selection disabled, cancellation reachable, and browser results visible during retry', passed: true });

  const deadline = Date.now() + 190000;
  let completed;
  while (Date.now() < deadline) {
    const result = await page.request.post(`${base}/api/workshop/jobs/${job.id}/read`, { data: { ticket: job.ticket }, timeout: 12000 });
    assert.ok(result.ok(), `Actual read HTTP ${result.status()}`);
    const row = await result.json();
    if (row.state === 'done') { completed = row; break; }
    assert.ok(!['failed', 'cancelled', 'timed_out'].includes(row.state), `Actual job ${row.state}`);
    await pause(800);
  }
  assert.ok(completed, 'Actual native computation completes within the bounded test deadline');
  assert.equal(completed.result.analysis.ok, true, 'Actual native result passes backend review');
  assert.deepEqual(await page.evaluate(() => window.__ocvWorkshopResults[0]), front, 'Completion must not automatically select native results');
  await expect(app.locator('[data-native-result]')).toBeEnabled({ timeout: 35000 });
  const readyColor = await app.locator('[data-native-result]').evaluate(button => getComputedStyle(button).backgroundColor);
  assert.notEqual(readyColor, pendingColor, 'The ready result button regains its normal background');
  await app.locator('[data-native-result]').screenshot({ path: join(folder, 'ready-button.png') });
  await app.locator('.server-record[data-review="ready"][data-result-source="local"]').waitFor();
  assert.ok(automaticReadRequests >= 2, 'Automatic polling retries after the injected read failure');
  assert.deepEqual(await page.evaluate(() => window.__ocvWorkshopResults[0]), front, 'Caching a validated completed result must leave browser results selected');
  await expect(app.locator('[data-native-cancel]')).toBeDisabled();
  report.checks.push({ name: 'Automatic retry caches a validated result, enables selection, and keeps the frontend result visible until clicked', passed: true, automaticReadRequests });
  const readsBeforeSelection = automaticReadRequests;
  await app.locator('[data-native-result]').click();
  await app.locator('.server-record[data-result-source="review"]').waitFor();
  await page.waitForFunction(expected => {
    const selected = window.__ocvWorkshopResults?.[0];
    return selected?.request?.world?.stepS === expected.step && selected?.result?.frames?.length === expected.frames;
  }, { step: submitted.world.stepS, frames: completed.result.engine.frames.length });
  const selected = await page.evaluate(() => window.__ocvWorkshopResults[0]);
  assert.deepEqual(selected.request, submitted);
  assert.deepEqual(selected.result.frames, completed.result.engine.frames);
  assert.equal(automaticReadRequests, readsBeforeSelection, 'Selection uses the cached reviewed result without another job read');
  await expect(app.locator('[data-native-cancel]')).toBeDisabled();
  report.checks.push({ name: 'Explicit selection displays the cached real PostgreSQL native request and exact frames, with terminal cancellation disabled', passed: true, jobId: job.id });
  await page.goto(base + '/signals/');
  const signals = page.frameLocator('#signals-ui');
  for (const name of ['server-network', 'server-circuit', 'server-communications']) {
    const button = signals.getByTestId(name);
    await expect(button).toBeDisabled();
    await expect(button).toHaveText('View verified result');
    await expect(button).toHaveCSS('background-color', pendingColor);
  }
  report.checks.push({ name: 'The three Signals result buttons initially remain disabled with matching gray styling', passed: true, newSignalsJobSubmitted: false });
  assert.equal(report.errors.length, 0);
  report.passed = true;
} catch (error) {
  report.failure = error.message;
  throw error;
} finally {
  if (job) await page.request.post(`${base}/api/workshop/jobs/${job.id}/cancel`, { data: { ticket: job.ticket } }).catch(() => {});
  await browser.close();
  report.finishedAt = new Date().toISOString();
  await writeFile(join(folder, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, report: join(folder, 'report.json') }));
}
