import {roofLevel} from '../pcakage/build2/q1.mjs';
import {test,expect} from 'vitest';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {TOWNS,townContains,townHouseSites} from '../pinia/tt9.mjs';
import {npcLine} from '../pinia/r0.mjs';
import {createPlayer,stepPlayer} from '../pcakage/build2/4.mjs';
import {heightAt,riverShapeAt} from '../pinia/j7.mjs';
import {createResidents} from '../config/apps/portal/src/p2/4.mjs';
import {createSiteAwards,cleanSiteAwards,SITE_AWARDS,SITE_AWARDS_KEY} from '../config/apps/portal/src/q9/s0.mjs';
const req=createRequire(new URL('../config/apps/portal/package.json',import.meta.url)),THREE=await import(pathToFileURL(path.join(path.dirname(req.resolve('three')),'three.module.js')).href);
test('High jumps can land on the actual house roof slope without raising ground-level navigation',()=>{const roof={x:0,z:0,width:18.9,depth:22,baseY:12.5,rise:4};expect(roofLevel(roof,0,0)).toBe(16.5);expect(roofLevel(roof,0,5.5)).toBe(14.5);expect(roofLevel(roof,0,12)).toBe(null);const ground=(x,z,y)=>{const h=roofLevel(roof,x,z);return h!==null&&Number.isFinite(y)&&y>=h-1.5?h:0;},p=createPlayer(0,0,()=>25);for(let i=0;i<100;i++)stepPlayer(p,{},.02,ground,()=>false);expect(p.y).toBe(16.5);expect(p.grounded).toBe(true);expect(ground(0,0)).toBe(0);});
test('Surveyed colourful towns have strictly aligned house rows, dry flat plots and six distinct locations',()=>{
 expect(TOWNS).toHaveLength(6);let homes=0;for(const t of TOWNS){const sites=townHouseSites(t);homes+=sites.length;expect(sites.length).toBe(t.rows*t.lanes*2);expect(new Set(sites.map(h=>h.x)).size).toBe(t.lanes*2);expect(new Set(sites.map(h=>h.z)).size).toBe(t.rows);expect(new Set(sites.map(h=>h.palette)).size).toBe(7);for(const h of sites){expect(townContains(t,h.x,h.z)).toBe(true);expect(riverShapeAt(h.x,h.z).mask).toBe(0);expect(heightAt(h.x,h.z)).toBeCloseTo(t.ground,8);}}
 expect(homes).toBe(390);
});
test('Sprinting high jump clears twenty metres, preserves horizontal speed, lands and cannot repeat in mid-air',()=>{
 const ground=()=>0,p=createPlayer(0,0,ground),walk=createPlayer(0,0,ground);stepPlayer(p,{forward:1,sprint:true,jump:true},.02,ground,()=>false);stepPlayer(walk,{forward:1,jump:true},.02,ground,()=>false);expect(p.vy).toBeGreaterThan(walk.vy*3);const velocity=p.vy;stepPlayer(p,{forward:1,sprint:true,jump:true},.02,ground,()=>false);expect(p.vy).toBeLessThan(velocity);let peak=p.y;for(let i=0;i<180;i++){stepPlayer(p,{forward:1,sprint:true},.02,ground,()=>false);peak=Math.max(peak,p.y);}expect(peak).toBeGreaterThan(22);expect(p.grounded).toBe(true);expect(p.health).toBe(1);expect(Math.abs(p.z)).toBeGreaterThan(150);
});
test('Residents include all towns and cities, approach and attack dialogue, harmless defeat and bounded rendering',()=>{
 const scene=new THREE.Scene(),lines=[],world={groundAt:()=>10,isBlocked:()=>false},residents=createResidents(scene,world,s=>lines.push(s));try{expect(residents.snapshot().total).toBe(564);expect(residents.snapshot().districts).toHaveLength(18);const t=TOWNS[0],player={x:t.x,y:10,z:t.z,health:1};residents.update(player,0,0);let target=residents.targets()[0];expect(target).toBeTruthy();const a=target.userData.resident;player.x=a.x;player.z=a.z;residents.update(player,1,.02);expect(lines.length).toBeGreaterThan(0);expect(lines.every(s=>s.text.length<30)).toBe(true);expect(residents.hit(target,1)).toBe(true);expect(lines.at(-1).text).toMatch(/损伤|操作|异常|警告|继续|模块|回执|权限/);for(let i=0;i<8&&a.alive;i++)residents.hit(target,2+i*.25);expect(a.alive).toBe(false);expect(lines.at(-1).text).toBe('单元离线。');expect(residents.hit(target,10)).toBe(false);expect(residents.snapshot().defeated).toBe(1);residents.update(player,65,.02);expect(a.alive).toBe(true);expect(a.hp).toBe(a.maxHp);expect(player.health).toBe(1);expect(residents.snapshot().renderBatches).toBeLessThan(40);}finally{residents.dispose();residents.dispose();}expect(scene.children).toEqual([]);
});
test('Mechanical dialogue supports a small shared story and occasional bounded garbling',()=>{
 const story={};expect(npcLine(1,2003,0,'near',story)).toBe('三号信件未送达。');npcLine(1,2003,1,'near',story);npcLine(1,2003,2,'near',story);expect(story.mail).toBe(3);expect(npcLine(2,2004,0,'near',story)).toBe('空白回执。已入库。');expect(npcLine(0,2015,0,'near',{})).toMatch(/▒|0x/);
});
test('Website awards persist real route/tool actions once without recording query strings or private inputs',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)},events=[],a=createSiteAwards(storage,ids=>events.push(...ids));for(const p of ['/maze/cache/','/maze/cache/l1/','/maze/cache/l1/l2/','/favorites/','/profile/']){a.visit(p);a.visit(p);}a.visit('/profile/?email=test@example.com');a.visit('/identity/register/');a.visit('/research/');for(let i=0;i<15;i++)a.tool('tool-'+i);a.set('favorites',8);a.set('nickname',1);const b=createSiteAwards(storage).snapshot();expect(b.earned).toEqual(expect.arrayContaining(['pages-3','maze-3','depth-3','tools-15','runs-10','favorites-8','nickname']));expect(new Set(events).size).toBe(events.length);expect(b.paths).toHaveLength(5);expect(map.get(SITE_AWARDS_KEY)).not.toContain('email');expect(SITE_AWARDS.length).toBeGreaterThan(30);expect(cleanSiteAwards('a'.repeat(33000)).earned).toEqual([]);expect(cleanSiteAwards({version:1,earned:['unknown'],values:{token:9,runs:-1}}).values).toEqual({});
});
