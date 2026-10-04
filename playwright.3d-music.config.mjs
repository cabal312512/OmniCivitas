import {defineConfig} from '@playwright/test';
import path from 'node:path';
import base from './playwright.3d.config.mjs';
import {reports} from './tests/browser/report-location.mjs';
export default defineConfig({...base,testMatch:['3d-music.spec.mjs'],outputDir:path.join(reports,'3d-music-artifacts'),reporter:[['list'],['json',{outputFile:path.join(reports,'3d-music-playwright.json')}]]});
