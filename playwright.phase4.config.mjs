import {defineConfig,devices} from '@playwright/test';
import path from 'node:path';
const reports=process.env.OCV_DEPS_ROOT?path.join(process.env.OCV_DEPS_ROOT,'runtime/reports'):path.resolve('.test-results');
export default defineConfig({testDir:'tests/browser',testMatch:['phase4.spec.mjs','reactor.spec.mjs','maze.spec.mjs'],workers:1,timeout:90000,outputDir:path.join(reports,'phase4-artifacts'),reporter:[['list'],['json',{outputFile:path.join(reports,'phase4-playwright.json')}]],use:{baseURL:process.env.OCV_BASE_URL||'http://127.0.0.1:8080',trace:'retain-on-failure'},projects:[{name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},{name:'mobile',use:{...devices['Pixel 7']}}]});
