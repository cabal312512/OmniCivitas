import {defineConfig} from '@playwright/test';
import base from './playwright.3d.config.mjs';
export default defineConfig({...base,testMatch:[...base.testMatch,'media-frames.spec.mjs','3d-music.spec.mjs','3d-encounters.spec.mjs']});
