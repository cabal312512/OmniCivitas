import {testDeps} from '../runtime-location.mjs';
import fs from 'node:fs';
import path from 'node:path';
const root=path.join(testDeps,'runtime/reports');
const scope=process.env.OCV_E2E_SCOPE||'';
if(scope&&!/^[a-z0-9-]+$/.test(scope))throw Error('Use a report directory basename.');
export const reports=scope?path.join(root,scope):root;
fs.mkdirSync(reports,{recursive:true});
