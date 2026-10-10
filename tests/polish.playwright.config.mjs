import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { testDeps } from './runtime-location.mjs';
const reportFolder = process.env.OCV_POLISH_REPORT || 'site-polish';

export default defineConfig({
  testDir: 'browser',
  testMatch: ['site-polish.spec.mjs', 'planetarium-polish.spec.mjs'],
  workers: 1,
  fullyParallel: false,
  timeout: 90000,
  outputDir: path.join(testDeps, 'runtime/test-results', reportFolder),
  reporter: [['list'], ['json', { outputFile: path.join(testDeps, 'runtime/reports', reportFolder, 'browser.json') }]],
  use: {
    baseURL: process.env.OCV_PLANETARIUM_BASE_URL || 'http://127.0.0.1:8080',
    viewport: { width: 1440, height: 960 },
    headless: true,
    actionTimeout: 10000,
    launchOptions: process.platform === 'win32' ? { args: ['--use-angle=d3d11'] } : {},
    trace: 'retain-on-failure',
  },
});
