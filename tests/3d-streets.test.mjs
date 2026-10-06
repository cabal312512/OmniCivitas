import {test,expect} from 'vitest';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {createRoadNetwork} from '../pinia/uv4.mjs';
import {roadUVs,roadEdge} from '../config/apps/portal/src/p2/g6.mjs';
import {heightAt} from '../pinia/j7.mjs';
import {CITIES} from '../pcakage/build2/c0.mjs';
import {createWorld} from '../config/apps/portal/src/p2/0.mjs';
const req=createRequire(new URL('../config/apps/portal/package.json',import.meta.url));
const THREE=await import(pathToFileURL(path.join(path.dirname(req.resolve('three')),'three.module.js')).href);

test('road markings retain metre spacing across bends and use all surveyed deck vertices',()=>{
  const network=createRoadNetwork(heightAt);
  for(const road of network.roads){
    const uv=roadUVs(road);expect(uv.length).toBe(road.positions.length/3*2);
    expect(uv[0]).toBe(0);expect(uv[2]).toBe(.5);expect(uv[4]).toBe(1);
    expect(uv.at(-1)).toBeCloseTo(road.record.length,1);
    for(let i=1;i<road.points.length;i++){
      const previous=road.points[i-1],next=road.points[i];
      expect(uv[i*6+1]-uv[(i-1)*6+1]).toBeCloseTo(Math.hypot(next.x-previous.x,next.z-previous.z),2);
      expect(uv[i*6+1]).toBe(uv[i*6+3]);expect(uv[i*6+3]).toBe(uv[i*6+5]);
    }
  }
});

test('guardrails follow the actual mitered deck edges and remain within the walkable surface',()=>{
  const network=createRoadNetwork(heightAt);
  for(const road of network.roads)for(let i=0;i<road.points.length;i+=9)for(const side of [-1,1]){
    const exact=roadEdge(road,i,side),edge=roadEdge(road,i,side,.22),offset=i*9+(side<0?0:6);
    expect(exact.x).toBe(road.positions[offset]);expect(exact.z).toBe(road.positions[offset+2]);
    expect(Math.hypot(edge.x-exact.x,edge.z-exact.z)).toBeCloseTo(.22,6);
    expect(network.groundAt(edge.x,edge.z)).toBeGreaterThanOrEqual(edge.y-.001);
    expect(Math.hypot(edge.nx,edge.nz)).toBeCloseTo(1,8);
  }
});

test('real world contains diverse details in every city without blocking all old NPC sites or the tower clearing',()=>{
  const original=globalThis.document;
  const gradient={addColorStop(){}};
  const context=new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(o,k)=>o[k]||(()=>{})});
  globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};
  const scene=new THREE.Scene();let world;
  try{
    world=createWorld(scene);
    const {cityDetails,roadDetails}=world.stats;
    expect(cityDetails.districts.length).toBe(9);
    for(const city of CITIES){
      const details=cityDetails.districts.find(d=>d.id===city.id);
      expect(Object.keys(details.counts).length).toBeGreaterThanOrEqual(12);
      expect(details.sites.length).toBeGreaterThan(10);
      for(const site of details.sites)if(city.clearing)expect(Math.hypot(site.x-city.x,site.z-city.z)).toBeGreaterThan(city.clearing+25);
      const record=world.stats.cityRecords.find(r=>r.id===city.id);
      expect(record.npcSites.length).toBe(8);
      for(const site of record.npcSites)expect(world.isBlocked(site.x,site.z,1,site.ground)).toBe(false);
    }
    expect(Object.keys(cityDetails.counts).length).toBeGreaterThanOrEqual(18);
    expect(roadDetails.paintedRoutes).toBe(15);expect(roadDetails.guardrailSpans).toBeGreaterThan(100);
    expect(roadDetails.reflectors).toBeGreaterThan(500);expect(roadDetails.signs).toBeGreaterThan(80);
    const highways=scene.getObjectByName('intercity-highways');
    expect(highways.children.length).toBe(15);
    for(const mesh of highways.children)expect(mesh.geometry.attributes.uv.count).toBe(mesh.geometry.attributes.position.count);
    const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
    let disposed=0;for(const geometry of geometries)geometry.addEventListener('dispose',()=>disposed++);
    world.dispose();expect(scene.children.length).toBe(0);expect(disposed).toBeGreaterThan(30);
    const after=disposed;world.dispose();expect(disposed).toBe(after);
  }finally{world?.dispose();globalThis.document=original;}
});
