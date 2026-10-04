import base from './playwright.phase8.config.mjs';
import path from 'node:path';import {reports} from './tests/browser/report-location.mjs';
export default {...base,testMatch:[...base.testMatch,'expand.spec.mjs'],outputDir:path.join(reports,'expand-artifacts'),reporter:[['list'],['json',{outputFile:path.join(reports,'expand-playwright.json')}]]};
