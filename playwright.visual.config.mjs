import {defineConfig} from '@playwright/test';
import base from './playwright.phase3.config.mjs';
import path from 'node:path';
const reports=process.env.OCV_DEPS_ROOT?path.join(process.env.OCV_DEPS_ROOT,'runtime/reports'):path.resolve('.test-results');
process.env.OCV_SCREENSHOT_PREFIX='phase3-visual';
export default defineConfig({...base,testMatch:/phase3(?:-visual)?\.spec\.mjs$/,outputDir:path.join(reports,'phase3-visual-artifacts'),reporter:[['list'],['json',{outputFile:path.join(reports,'phase3-visual-playwright.json')}]]});
