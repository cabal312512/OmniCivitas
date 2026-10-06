import {createHash} from 'node:crypto';
export type Note={n:number;t:number;d:number;v:number};
export type Slot={id:number;route:string;say:string;pitch:number;x:number;y:number};
export const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
export function slotsFromRust(source:string):Slot[]{
 if(Buffer.byteLength(source)>65536)throw Error('Room source too large');
 const slots=[...source.matchAll(/^\s*slot!\((\d+),"([^"\n]+)","([^"\n]{1,80})",(\d+),(\d+),(\d+)\),?\s*$/gm)].map(m=>({id:+m[1],route:m[2],say:m[3],pitch:+m[4],x:+m[5],y:+m[6]}));
 if(slots.length!==30||new Set(slots.map(s=>s.id)).size!==30||new Set(slots.map(s=>s.route)).size!==30||slots.some((s,i)=>s.id!==i||!/^\/(?:[a-z0-9/-]*)$/.test(s.route)||s.pitch<48||s.pitch>84||s.x<8||s.x>90||s.y<15||s.y>88))throw Error('Room source malformed');
 return slots;
}
export function luaNotes(events:Note[]){return 'local archive = {}\narchive.__old = false\n-- shelf\narchive.notes = {\n'+events.map(e=>` {${e.n},${e.t},${e.d},${e.v}},`).join('\n')+'\n}\nreturn archive\n';}
export function notesFromLua(text:string):Note[]{return [...text.matchAll(/^ \{(\d+),(\d+),(\d+),([\d.]+)\},$/gm)].map(m=>({n:+m[1],t:+m[2],d:+m[3],v:+m[4]}));}
