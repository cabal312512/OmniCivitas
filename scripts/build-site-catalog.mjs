import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {catalogue,aliases} from '../config/apps/portal/src/main1/catalogue.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hiddenRoutes=new Set(catalogue.filter(row=>row.universalOnly).map(row=>row.url.split(/[?#]/)[0]));
const records=catalogue.filter(row=>!row.universalOnly).map(row=>({...row,aliases:[row.keywords||'',aliases[row.id]||''].join(' ')}));
const routes=new Set(['/']),edges=new Map();
async function walk(folder){for(const entry of await readdir(folder,{withFileTypes:true})){if(entry.isDirectory())await walk(path.join(folder,entry.name));else if(entry.name==='index.html'){const rel=path.relative(path.join(root,'config/apps/portal/dist'),path.join(folder,entry.name)).replaceAll('\\','/'),route='/'+rel.replace(/index\.html$/,'');if(hiddenRoutes.has(route))continue;routes.add(route);edges.set(route,[]);}}}
await walk(path.join(root,'config/apps/portal/dist'));
routes.add('/studio/');routes.add('/borrowed/');edges.set('/studio/',[]);edges.set('/borrowed/',[]);
for(const route of [...edges.keys()]){
 if(route==='/studio/'||route==='/borrowed/')continue;
 const text=await readFile(path.join(root,'config/apps/portal/dist',route.slice(1),'index.html'),'utf8');
 const links=new Set();for(const match of text.matchAll(/href\s*=\s*["'](\/[^"']*)["']/g)){const url=match[1].split(/[?#]/)[0];if(routes.has(url))links.add(url);else if(routes.has(url+'/'))links.add(url+'/');}
 edges.set(route,[...links].sort().slice(0,96));
}
const output={schema:'ocv.site-catalog/1',records,routes:[...routes].sort(),edges:[...edges].sort(([a],[b])=>a.localeCompare(b))};
await mkdir(path.join(root,'config/9'),{recursive:true});await writeFile(path.join(root,'config/9/registry.json'),JSON.stringify(output));
console.log(JSON.stringify({records:records.length,routes:routes.size,edges:[...edges.values()].reduce((n,e)=>n+e.length,0)}));
