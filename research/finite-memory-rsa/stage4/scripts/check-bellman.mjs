import fs from 'node:fs';
import path from 'node:path';
import { checkBellmanCertificate } from '../src/bellman-check.mjs';
import { temporalController } from '../src/temporal.mjs';
import { Fraction, ONE } from '../src/rational.mjs';
import { stageRoot,hash } from './preservation.mjs';
const output=path.join(stageRoot,'results/bellman-audit.json');
if(fs.existsSync(output))throw new Error('Refuse to overwrite Bellman audit');
const files=['results/proper-boundary-null.json','data/refined-temporal-periodic.json','data/refined-temporal-open.json'];
const checked=[];
for(const file of files){
  const result=JSON.parse(fs.readFileSync(path.join(stageRoot,file)));
  let definition=result.realization;
  if(!definition){
    const coordinates=result.coordinates.map(x=>new Fraction(BigInt(x),1000n));
    const rows=[0,3].map(i=>{const [a,b,c]=coordinates.slice(i,i+3);return [a,ONE.sub(a).mul(b),ONE.sub(a).mul(ONE.sub(b)).mul(c),ONE.sub(a).mul(ONE.sub(b)).mul(ONE.sub(c))];});
    definition={initial:[coordinates[6],ONE.sub(coordinates[6])],H:rows.map(x=>x.slice(0,2)),V:rows.map(x=>x.slice(2))};
  }
  checked.push({file,sha256:hash(fs.readFileSync(path.join(stageRoot,file))),...checkBellmanCertificate(temporalController(definition),result)});
}
fs.writeFileSync(output,JSON.stringify({schemaVersion:1,verifiedAtUTC:new Date().toISOString(),checked,
  scalarEquations:checked.reduce((sum,x)=>sum+x.exactScalarEquations,0),status:'passed'},null,2)+'\n');
console.log(JSON.stringify({status:'passed',files:checked.length,scalarEquations:checked.reduce((sum,x)=>sum+x.exactScalarEquations,0)}));
