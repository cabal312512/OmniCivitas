import {testDeps,testBase} from './tests/runtime-location.mjs';
import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
const deps=testDeps;
export default defineConfig({
  testDir:'tests/browser',workers:1,fullyParallel:false,timeout:30000,
  outputDir:path.join(deps,'runtime/test-results'),
  reporter:[['list'],['json',{outputFile:path.join(deps,'runtime/reports/playwright.json')}]],
  use:{baseURL:testBase,trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[{name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},{name:'mobile',use:{...devices['Pixel 7']}}],
  // Infrastructure verification must fail when Docker is absent; it must never
  // silently substitute the local in-memory demonstration.
  // Start either pnpm dev or core Compose explicitly; tests never replace real infrastructure.
});
