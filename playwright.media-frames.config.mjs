import {defineConfig} from '@playwright/test';
import path from 'node:path';
import base from './playwright.3d.config.mjs';
import {reports} from './tests/browser/report-location.mjs';
export default defineConfig({...base,testMatch:['media-frames.spec.mjs'],outputDir:path.join(reports,'media-frames-artifacts'),reporter:[['list'],['json',{outputFile:path.join(reports,'media-frames-playwright.json')}]]});
