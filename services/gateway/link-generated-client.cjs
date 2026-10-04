// Windows junctions remove the physical "node_modules" ancestor from the custom
// generated client's lookup path. Restore its one runtime dependency beside it.
const fs=require('node:fs'),path=require('node:path');
if(process.platform==='win32'){
 const generated=fs.realpathSync(path.join(__dirname,'node_modules/.ocv-prisma'));
 const parent=path.join(generated,'node_modules/@prisma');fs.mkdirSync(parent,{recursive:true});
 const target=path.dirname(path.dirname(require.resolve('@prisma/client-runtime-utils')));
 const link=path.join(parent,'client-runtime-utils');
 if(fs.existsSync(link)){if(fs.realpathSync(link)!==fs.realpathSync(target))throw Error('Unexpected Prisma runtime dependency junction');}
 else fs.symlinkSync(target,link,'junction');
}
