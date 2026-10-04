/** Extract a documented subset of completed raw data, without resimulation. */
import fs from 'node:fs';
import path from 'node:path';
import {ROOT,COLUMNS} from './run-experiment.mjs';
const source=path.join(ROOT,'data/raw/atlas.csv');
const lines=fs.readFileSync(source,'utf8').trim().split(/\r?\n/);
if(lines[0]!==COLUMNS.join(','))throw new Error('Unexpected atlas schema');
const rows=lines.slice(1).filter(line=>{
  const values=line.split(',');
  return values[COLUMNS.indexOf('L')]==='16' && values[COLUMNS.indexOf('k')]==='2'
    && Number(values[COLUMNS.indexOf('seed')])<=100008;
});
if(rows.length!==520)throw new Error('Expected65policies ×8seeds =520 archived rows');
const target=path.join(ROOT,'tests/fixtures/atlas-regression.csv');
if(fs.existsSync(target))throw new Error('Refusing to overwrite archived fixture');
fs.mkdirSync(path.dirname(target),{recursive:true});
fs.writeFileSync(target,lines[0]+'\n'+rows.join('\n')+'\n');
console.log(JSON.stringify({source:'data/raw/atlas.csv',output:'tests/fixtures/atlas-regression.csv',rows:rows.length,generatedBySimulation:false}));
