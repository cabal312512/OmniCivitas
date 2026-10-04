import fs from 'node:fs';
import assert from 'node:assert/strict';
import {accidents} from '../config/apps/portal/src/report/list.mjs';
const ledger=JSON.parse(fs.readFileSync('docs/requirements.json','utf8')),rows=ledger.requirements.filter(r=>r.phase===8);
const plan=[];
for(const row of rows){let route=accidents.find(x=>x.requirements.includes(row.id))?.id,kind='interactive';
 if(!route){const n=Number(row.id.slice(1));if(row.id[0]==='A'&&(n>=174&&n<=278||n===381)){route='archive';kind=n>=243&&n<=261||n>=267&&n<=278?'source-role':'active-source';}
 else if(['A288','A289','A290','A291','A292','A293','B164'].includes(row.id)){route='existing-windows';kind='existing-interaction';}
 else if(row.id==='A321'){route='archive';kind='postgresql';}
 else if(['B190','B191','B192','B193','B308','B309','B351'].includes(row.id)){route='global';}
 else if(['B305','B306'].includes(row.id)){route='404';}else throw Error('Unmapped '+row.id);}
 if(['A213','A238'].includes(row.id))kind='source-role';
 const overridden=['A289','A290','A292','B164','B206','B207'].includes(row.id);
 plan.push({id:row.id,text:row.text,route,kind,overridden,override:overridden?'Latest user: teleport 5–30; mobile offscreen accepted; no stop-motion button. Original text preserved.':null});
}
assert.equal(plan.length,318);assert.equal(new Set(plan.map(x=>x.id)).size,318);fs.writeFileSync('docs/phase-8-plan.json',JSON.stringify({phase:8,status:'in_progress',requirements:plan},null,2)+'\n');console.log('318 original phase-8 rows mapped; no verification statuses changed.');
