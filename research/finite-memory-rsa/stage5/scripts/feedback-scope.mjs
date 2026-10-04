import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { stageRoot } from './preservation.mjs';
import { physicalMachine,universalOperational } from '../../stage4/src/operational.mjs';
const output=path.join(stageRoot,'results/feedback-scope.json');if(fs.existsSync(output))throw new Error('Refuse overwrite');
const catalogue=JSON.parse(fs.readFileSync(path.join(stageRoot,'../stage3/data/classification/feedback-4.json'))).classes.filter(x=>x.minimalStateCount<=2);
const results=[];
for(const boundary of ['periodic','open']){
  const rows=catalogue.map(controller=>{
    const machine=JSON.parse(physicalMachine(controller,{L:3,k:2,boundary}).encoding),canJam=new Set(machine.flatMap(([label],i)=>label.endsWith(':J')?[i]:[]));
    let changed=true;while(changed){changed=false;machine.forEach(([,targets],i)=>{if(!canJam.has(i)&&targets.some(j=>canJam.has(j))){canJam.add(i);changed=true;}});}
    const labels=machine.map(x=>x[0]),both=labels.some(x=>x.endsWith(':0'))&&labels.some(x=>x.endsWith(':1'));
    return {controller:controller.classId,universalLive:controller.universalLiveness,
      fixedGeometryProper:canJam.size===machine.length,randomizedOperationalMinimum:both?2:1,
      reachableTraceStates:machine.length,universalOperationalKey:universalOperational(controller).key};
  });
  const groups=new Map();for(const controller of catalogue){const row=rows.find(x=>x.controller===controller.classId);if(row.fixedGeometryProper){const encoding=physicalMachine(controller,{L:3,k:2,boundary}).encoding;groups.set(encoding,[...(groups.get(encoding)??[]),controller.classId]);}}
  results.push({boundary,rows,properPhysicalClasses:[...groups.values()]});
  console.log(JSON.stringify({boundary,properPhysicalClasses:[...groups.values()]}));
}
fs.writeFileSync(output,JSON.stringify({schemaVersion:1,structuralClasses:13,results,
  meaning:'Proper iff every reachable finite product state has a path to geometric jam. Two deterministic action labels on positive histories prove randomized minimum two. This uses no terminal mean to establish equivalence.'},null,2)+'\n');
