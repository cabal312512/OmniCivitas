import {defineConfig,devices} from '@playwright/test';
import path from 'node:path';
const reports=process.env.OCV_DEPS_ROOT?path.join(process.env.OCV_DEPS_ROOT,'runtime/reports'):path.resolve('.test-results');
const reportName=process.env.OCV_E2E_REPORT_NAME||'reactor-playwright.json';if(!/^[a-z0-9-]+\.json$/.test(reportName))throw Error('Use a report basename.');
export default defineConfig({testDir:'tests/browser',testMatch:['reactor.spec.mjs','maze.spec.mjs'],workers:1,timeout:90000,outputDir:path.join(reports,reportName.replace('.json','-artifacts')),reporter:[['list'],['json',{outputFile:path.join(reports,reportName)}]],use:{baseURL:process.env.OCV_BASE_URL||'http://127.0.0.1:8080',trace:'retain-on-failure'},projects:[{name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},{name:'mobile',use:{...devices['Pixel 7']}}]});
