import base from './playwright.phase7.config.mjs';
import path from 'node:path';import {reports} from './tests/browser/report-location.mjs';
export default {...base,testMatch:[...base.testMatch,'phase8.spec.mjs','phase8-errors.spec.mjs'],outputDir:path.join(reports,'phase8-artifacts'),reporter:[['list'],['json',{outputFile:path.join(reports,'phase8-playwright.json')}]]};
