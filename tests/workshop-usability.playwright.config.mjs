import {testDeps,testBase} from './runtime-location.mjs';
import {defineConfig} from '@playwright/test';
import path from 'node:path';

const deps=testDeps;
const baseURL=process.env.OCV_WORKSHOP_BASE_URL||testBase;
const entrance=new URL(baseURL);
if(entrance.protocol!=='http:'||entrance.username||entrance.password||!['localhost','127.0.0.1','[::1]'].includes(entrance.hostname))throw Error('Use an existing private loopback deployment.');

export default defineConfig({
  testDir:'browser',testMatch:'workshop-usability.spec.mjs',workers:1,fullyParallel:false,retries:0,timeout:180000,
  outputDir:path.join(deps,'runtime/test-results/workshop-usability'),
  reporter:[['list'],['json',{outputFile:path.join(deps,'runtime/reports/workshop-usability-playwright.json')}]],
  use:{baseURL,headless:true,viewport:{width:1440,height:1000},actionTimeout:10000,navigationTimeout:30000,
    trace:'off',video:'off',screenshot:'off',launchOptions:{args:['--disable-gpu','--js-flags=--max-old-space-size=192','--renderer-process-limit=2']}},
  projects:[{name:'workshop-usability',use:{browserName:'chromium'}}],
});
