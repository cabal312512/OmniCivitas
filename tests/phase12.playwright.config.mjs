import {testDeps,testBase} from './runtime-location.mjs';
import {defineConfig} from '@playwright/test';
import path from 'node:path';

const deps=testDeps;
const baseURL=process.env.OCV_PHASE12_BASE_URL||testBase;
const entrance=new URL(baseURL);
if(entrance.protocol!=='http:'||entrance.username||entrance.password||!['localhost','127.0.0.1','[::1]'].includes(entrance.hostname))throw Error('This native-save browser proof requires a private loopback deployment.');

export default defineConfig({
  testDir:'browser',testMatch:'phase12.spec.mjs',workers:1,fullyParallel:false,retries:0,timeout:300000,
  outputDir:path.join(deps,'runtime/test-results/phase12-ui'),
  reporter:[['list'],['json',{outputFile:path.join(deps,'runtime/reports/phase12-ui-playwright.json')}]],
  use:{baseURL,headless:true,acceptDownloads:true,viewport:{width:1440,height:1000},reducedMotion:'reduce',actionTimeout:15000,navigationTimeout:30000,
    trace:'off',video:'off',screenshot:'off',launchOptions:{args:['--disable-gpu','--js-flags=--max-old-space-size=192','--renderer-process-limit=2']}},
  projects:[{name:'phase12-desktop',use:{browserName:'chromium'}}],
});
