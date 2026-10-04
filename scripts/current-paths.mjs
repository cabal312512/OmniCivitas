// Resolve paths recorded before names-1 without rewriting historical evidence.
import fs from 'node:fs';
const file=new URL('../docs/naming-paths.json',import.meta.url);
const pairs=JSON.parse(fs.readFileSync(file,'utf8')).pairs.toSorted((a,b)=>b.before.length-a.before.length);
export function currentPath(value){
 const normalized=value.replaceAll('\\','/');
 const match=pairs.find(r=>normalized===r.before||normalized.startsWith(r.before+'/'));
 return match?match.after+normalized.slice(match.before.length):normalized;
}
