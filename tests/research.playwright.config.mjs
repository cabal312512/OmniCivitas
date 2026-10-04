import {defineConfig} from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
const root=process.env.OCV_DEPS_ROOT||path.join(os.tmpdir(),'ocv-tests');
export default defineConfig({testDir:'browser',testMatch:'research.spec.mjs',workers:1,fullyParallel:false,timeout:45000,
 outputDir:path.join(root,'runtime/test-results/research-site'),
 reporter:[['list'],['json',{outputFile:path.join(root,'runtime/reports/research-site/browser.json')}]],
 use:{baseURL:process.env.OCV_RESEARCH_BASE_URL??'http://127.0.0.1:4473',viewport:{width:1440,height:1000},headless:true,trace:'retain-on-failure'},
 projects:[{name:'research-desktop'}]});
