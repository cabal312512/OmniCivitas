import {testDeps,testBase} from '../runtime-location.mjs';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const base = process.env.OCV_WORKSHOP_BASE_URL||testBase;
const folder = join(testDeps, 'runtime/reports/labs-refresh');
await mkdir(folder, { recursive: true });
const report = { startedAt: new Date().toISOString(), passed: false, newBackendJobs: 0, errors: [], checks: [] };
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/signals/jobs') report.newBackendJobs++;
  });
  await page.goto(base + '/signals/');
  const frame = page.frameLocator('#signals-ui');
  for (const name of ['server-network', 'server-circuit', 'server-communications']) {
    const button = frame.getByTestId(name);
    await expect(button).toHaveText('View verified result');
    await expect(button).toBeDisabled();
    await expect(button).toHaveCSS('background-color', 'rgb(229, 231, 235)');
    report.checks.push({ name, englishLabel: true, grayUntilReady: true, passed: true });
  }
  assert.equal(report.newBackendJobs, 0);
  assert.equal(report.errors.length, 0);
  report.passed = true;
} catch (error) {
  report.failure = error.message;
  throw error;
} finally {
  await browser.close();
  report.finishedAt = new Date().toISOString();
  const output = join(folder, 'signals-buttons.json');
  await writeFile(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, newBackendJobs: report.newBackendJobs, report: output }));
}
