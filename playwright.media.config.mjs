import {defineConfig,devices} from '@playwright/test';
import path from 'node:path';
import {reports} from './tests/browser/report-location.mjs';
export default defineConfig({testDir:'tests/browser',testMatch:['media-additions.spec.mjs'],workers:1,retries:0,timeout:60000,outputDir:path.join(reports,'media-additions-artifacts'),reporter:[['list'],['json',{outputFile:path.join(reports,'media-additions-playwright.json')}]],use:{baseURL:process.env.OCV_BASE_URL||'http://127.0.0.1:8080',trace:'retain-on-failure'},projects:[{name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}}]});
