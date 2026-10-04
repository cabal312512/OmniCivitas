import {prepareResearch} from '../config/apps/portal/src/research/data.mjs';
const snapshot=await prepareResearch();
console.log(`Research publication assets ready: ${snapshot.totalFiles} frozen artifacts, ${snapshot.archives.length} complete collections.`);
