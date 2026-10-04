import fs from 'node:fs';
import path from 'node:path';
const root=process.env.OCV_DEPS_ROOT?path.join(process.env.OCV_DEPS_ROOT,'runtime/reports'):path.resolve('.test-results');
const scope=process.env.OCV_E2E_SCOPE||'';
if(scope&&!/^[a-z0-9-]+$/.test(scope))throw Error('Use a report directory basename.');
export const reports=scope?path.join(root,scope):root;
fs.mkdirSync(reports,{recursive:true});
