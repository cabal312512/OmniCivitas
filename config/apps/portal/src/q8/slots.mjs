import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
let root=process.cwd();while(!existsSync(path.join(root,'pnpm-workspace.yaml'))){const up=path.dirname(root);if(up===root)throw Error('Workspace not found');root=up;}
const source=readFileSync(path.join(root,'historical/station/src/rooms.rs'),'utf8');
export const slots=[...source.matchAll(/^\s*slot!\((\d+),"([^"\n]+)","([^"\n]{1,80})",(\d+),(\d+),(\d+)\),?\s*$/gm)].map(m=>({id:+m[1],route:m[2],say:m[3],pitch:+m[4],x:+m[5],y:+m[6]}));
if(slots.length!==30||slots.some((s,i)=>s.id!==i)||new Set(slots.map(s=>s.route)).size!==30)throw Error('Rust room catalogue must contain exactly thirty unique rooms');
