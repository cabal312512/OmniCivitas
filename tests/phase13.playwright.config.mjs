import {testDeps,testBase} from './runtime-location.mjs';
import {defineConfig} from '@playwright/test';
import path from 'node:path';
const entrance=new URL(testBase);
if(entrance.protocol!=='http:'||entrance.username||entrance.password||!['localhost','127.0.0.1','[::1]'].includes(entrance.hostname))throw Error('Website worker proofs require a private loopback deployment.');
export default defineConfig({
 testDir:'browser',testMatch:'phase13.spec.mjs',workers:1,fullyParallel:false,retries:0,timeout:600000,
 outputDir:path.join(testDeps,'runtime/test-results/phase13-ui'),
 reporter:[['list'],['json',{outputFile:path.join(testDeps,'runtime/reports/phase13-ui-playwright.json')}]],
 use:{baseURL:testBase,headless:true,acceptDownloads:true,viewport:{width:1440,height:1000},reducedMotion:'reduce',actionTimeout:15000,navigationTimeout:30000,
  trace:'off',video:'off',screenshot:'only-on-failure',launchOptions:{args:['--disable-gpu','--js-flags=--max-old-space-size=192','--renderer-process-limit=2']}},
 projects:[{name:'phase13-desktop',use:{browserName:'chromium'}}],
});
