import {defineConfig,devices} from '@playwright/test';
import path from 'node:path';
import {reports} from './tests/browser/report-location.mjs';
export default defineConfig({
 testDir:'tests/browser',testMatch:['phase7-games.spec.mjs','phase7-odd.spec.mjs','phase7-generators.spec.mjs','phase7-meter.spec.mjs','phase6-images.spec.mjs','phase6-time.spec.mjs','phase6-science.spec.mjs','phase5.spec.mjs','phase4.spec.mjs','reactor.spec.mjs','maze.spec.mjs','interaction.spec.mjs'],
 workers:1,timeout:90000,outputDir:path.join(reports,'phase7-artifacts'),
 reporter:[['list'],['json',{outputFile:path.join(reports,'phase7-playwright.json')}]],
 use:{baseURL:process.env.OCV_BASE_URL||'http://127.0.0.1:8080',trace:'retain-on-failure'},
 projects:[{name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},{name:'mobile',use:{...devices['Pixel 7']}}],
});
