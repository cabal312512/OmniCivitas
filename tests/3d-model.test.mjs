import {test,expect} from 'vitest';
import {BODY_RADIUS,createPlayer,stepPlayer,raySphere,createCycle} from '../config/apps/portal/src/3d/model.mjs';
import {WORLD_SIZE,WATER_LEVEL,SPAWN,LANDMARKS,heightAt,riverAt,riverCenter,randomFor} from '../pinia/j7.mjs';
import {SAVE_KEY,createCheckpointStore} from '../pcakage/build2/v8.mjs';

const flat=()=>0,open=()=>false;
const advance=(player,input,dt=.1,ground=flat,blocked=open)=>stepPlayer(player,input,dt,ground,blocked);
const travelled=player=>Math.hypot(player.x,player.z);
const wall=(x,z,radius)=>x+radius>=1&&x-radius<=1.02&&Math.abs(z)<100;

test('3D movement keeps diagonal and larger input vectors at the same walking speed',()=>{
 const straight=createPlayer(0,0,flat),diagonal=createPlayer(0,0,flat),large=createPlayer(0,0,flat);
 advance(straight,{forward:1});advance(diagonal,{forward:1,strafe:1});advance(large,{forward:3,strafe:4});
 expect(travelled(straight)).toBeCloseTo(.9,10);expect(travelled(diagonal)).toBeCloseTo(travelled(straight),10);expect(travelled(large)).toBeCloseTo(travelled(straight),10);
 expect(straight.z).toBeLessThan(0);expect(diagonal.x).toBeGreaterThan(0);
});

test('3D walking follows camera yaw while remaining on the ground plane',()=>{
 const left=createPlayer(0,0,flat),right=createPlayer(0,0,flat);
 advance(left,{forward:1,yaw:Math.PI/2});advance(right,{strafe:1,yaw:Math.PI/2});
 expect(left.x).toBeCloseTo(-.9,10);expect(left.z).toBeCloseTo(0,10);expect(right.z).toBeCloseTo(-.9,10);expect(right.x).toBeCloseTo(0,10);expect(left.y).toBe(0);
});

test('3D delayed frames are capped and sprint substeps cannot tunnel through a thin wall',()=>{
 const delayed=createPlayer(0,0,flat),bounded=createPlayer(0,0,flat),colliding=createPlayer(-.3,0,flat);
 advance(delayed,{strafe:1,sprint:true},30);advance(bounded,{strafe:1,sprint:true},.1);
 expect(delayed.x).toBeCloseTo(5.8,10);expect(delayed).toEqual(bounded);
 advance(colliding,{strafe:1,sprint:true},30,flat,wall);
 expect(colliding.x).toBeGreaterThan(0);expect(colliding.x+BODY_RADIUS).toBeLessThan(1);
 for(let i=0;i<20;i++)advance(colliding,{strafe:1,sprint:true},.1,flat,wall);
 expect(colliding.x+BODY_RADIUS).toBeLessThan(1);
});

test('3D blocked movement slides along a wall instead of losing the free axis',()=>{
 const player=createPlayer(0,0,flat);advance(player,{strafe:1,forward:1,sprint:true},.1,flat,wall);
 expect(player.x+BODY_RADIUS).toBeLessThan(1);expect(player.x).toBeGreaterThan(0);expect(player.z).toBeLessThan(-1.5);
});

test('3D jumping rises and lands on sampled terrain without a second airborne jump',()=>{
 const raised=()=>12,player=createPlayer(0,0,raised);advance(player,{jump:true},.02,raised);
 expect(player.y).toBeGreaterThan(12);expect(player.vy).toBeGreaterThan(0);expect(player.grounded).toBe(false);
 const velocity=player.vy;advance(player,{jump:true},.02,raised);expect(player.vy).toBeLessThan(velocity);
 for(let i=0;i<60;i++)advance(player,{},.02,raised);
 expect(player.y).toBe(12);expect(player.vy).toBe(0);expect(player.grounded).toBe(true);
});

test('3D slopes follow sampled floors but a sudden high ledge blocks walking',()=>{
 const slope=(x)=>x*.1,player=createPlayer(0,0,slope);advance(player,{strafe:1},.1,slope);
 expect(player.x).toBeGreaterThan(.8);expect(player.y).toBeCloseTo(slope(player.x),10);
 const ledge=x=>x>.15?3:0,stopped=createPlayer(0,0,ledge);advance(stopped,{strafe:1,sprint:true},.1,ledge);
 expect(stopped.x).toBeLessThanOrEqual(.15);expect(stopped.y).toBe(0);
});

test('3D both world edges retain a margin without wrapping or walking out of bounds',()=>{
 const positive=createPlayer(5997,5997,flat),negative=createPlayer(-5997,-5997,flat);
 advance(positive,{strafe:1,forward:-1,sprint:true});advance(negative,{strafe:-1,forward:1,sprint:true});
 expect(positive.x).toBe(5998);expect(positive.z).toBe(5998);expect(negative.x).toBe(-5998);expect(negative.z).toBe(-5998);
});

test('3D sprint remains at fifty-eight metres per second and ignores energy in earlier saves',()=>{
 const walker=createPlayer(0,0,flat),runner=createPlayer(0,0,flat),legacy=createPlayer(0,0,flat);legacy.energy=0;
 advance(walker,{forward:1});advance(runner,{forward:1,sprint:true});advance(legacy,{forward:1,sprint:true});
 expect(travelled(walker)).toBeCloseTo(.9,10);expect(travelled(runner)).toBeCloseTo(5.8,10);expect(travelled(legacy)).toBeCloseTo(travelled(runner),10);expect(legacy.energy).toBe(1);
 for(let i=0;i<150;i++){advance(runner,{forward:1,sprint:true});expect(runner.energy).toBe(1);}
 expect(travelled(runner)).toBeCloseTo(151*5.8,8);advance(runner,{});expect(runner.energy).toBe(1);
});

test('3D negative and nonfinite frame deltas do not move a resting player',()=>{
 for(const dt of [-1,NaN,Infinity,-Infinity]){const player=createPlayer(0,0,flat),before={...player};advance(player,{forward:1,sprint:true},dt);expect(player).toEqual(before);}
});

test('3D shooting rays hit the nearest surface, reject a miss and a sphere behind the camera',()=>{
 const origin={x:0,y:0,z:0},direction={x:0,y:0,z:-1};
 expect(raySphere(origin,direction,{x:0,y:0,z:-10},2)).toBe(8);
 expect(raySphere(origin,direction,{x:3,y:0,z:-10},2)).toBeNull();expect(raySphere(origin,direction,{x:0,y:0,z:10},2)).toBeNull();
 expect(raySphere(origin,direction,{x:2,y:0,z:-10},2)).toBe(10);
});

test('3D shooting from inside or exactly on a sphere registers immediate contact',()=>{
 const origin={x:0,y:0,z:0},direction={x:0,y:0,z:-1};
 expect(raySphere(origin,direction,{x:0,y:0,z:0},2)).toBe(0);expect(raySphere(origin,direction,{x:0,y:0,z:-2},2)).toBe(0);
 const diagonal={x:Math.SQRT1_2,y:0,z:-Math.SQRT1_2};expect(raySphere(origin,diagonal,{x:10,y:0,z:-10},2)).toBeCloseTo(Math.sqrt(200)-2,10);
});

test('3D discovery counts unique objects, completes only after enough distinct objects and resets',()=>{
 const cycle=createCycle(3);expect(cycle.count).toBe(0);expect(cycle.complete).toBe(false);
 expect(cycle.add('a')).toBe(true);expect(cycle.add('a')).toBe(false);expect(cycle.count).toBe(1);
 cycle.add('b');expect(cycle.complete).toBe(false);cycle.add('c');expect(cycle.complete).toBe(true);
 cycle.reset();expect(cycle.count).toBe(0);expect(cycle.complete).toBe(false);expect(cycle.add('a')).toBe(true);
});

test('3D terrain has a twelve-kilometre width, a level spawn, high hills and finite landmark samples',()=>{
 expect(WORLD_SIZE).toBe(12000);expect(heightAt(SPAWN.x,SPAWN.z)).toBeCloseTo(10,10);
 expect(LANDMARKS.length).toBeGreaterThanOrEqual(10);expect(new Set(LANDMARKS.map(p=>p.id)).size).toBe(LANDMARKS.length);
 for(const point of LANDMARKS){expect(Math.abs(point.x)).toBeLessThan(WORLD_SIZE/2);expect(Math.abs(point.z)).toBeLessThan(WORLD_SIZE/2);expect(Number.isFinite(heightAt(point.x,point.z))).toBe(true);}
 const hills=LANDMARKS.find(p=>p.id==='hills');expect(heightAt(hills.x,hills.z)).toBeGreaterThan(100);
 for(const x of [-6000,-512,0,512,6000])for(const z of [-6000,-512,0,512,6000])expect(Number.isFinite(heightAt(x,z))).toBe(true);
});

test('3D river samples describe a submerged continuous bed and dry distant land',()=>{
 for(const z of [-5800,-1730,-512,0,512,1730,5800]){
  const center=riverCenter(z),wet=riverAt(center,z),dry=riverAt(center+1000,z);
  expect(wet.mask).toBe(1);expect(wet.surface).toBe(WATER_LEVEL);expect(wet.depth).toBeGreaterThanOrEqual(2.49);expect(heightAt(center,z)).toBeLessThan(WATER_LEVEL);
  expect(dry.mask).toBe(0);expect(wet.width).toBeGreaterThan(15);expect(wet.width).toBeLessThan(59);
  expect(Math.abs(heightAt(center-.001,z)-heightAt(center+.001,z))).toBeLessThan(.001);
 }
});

test('3D terrain edges use deterministic global coordinates and seeded decoration is reproducible',()=>{
 for(const x of [-512,0,512])for(const z of [-512,0,512]){
  expect(Math.abs(heightAt(x-.001,z)-heightAt(x+.001,z))).toBeLessThan(.01);
  expect(Math.abs(heightAt(x,z-.001)-heightAt(x,z+.001))).toBeLessThan(.01);
 }
 expect(heightAt(8000,0)).toBe(heightAt(6000,0));expect(heightAt(-8000,0)).toBe(heightAt(-6000,0));
 const values=Array.from({length:40},(_,i)=>randomFor(i,-7,23));expect(values).toEqual(Array.from({length:40},(_,i)=>randomFor(i,-7,23)));expect(new Set(values).size).toBe(40);expect(values.every(x=>x>=0&&x<1)).toBe(true);
});

const savedProgress=()=>({version:1,checkpoint:'river',found:[0,79],health:.65,energy:.4});
const inMemoryStorage=()=>{const values=new Map();return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};

test('3D checkpoints persist only known progress fields and restore through a fresh store',()=>{
 const storage=inMemoryStorage(),store=createCheckpointStore(storage,['avenue','river'],79),progress={...savedProgress(),x:Infinity,password:'discarded'};
 expect(store.write(progress)).toBe(true);progress.found.push(3);expect(JSON.parse(storage.getItem(SAVE_KEY))).toEqual(savedProgress());expect(store.snapshot()).toMatchObject({status:'saved',writes:1,persistent:true,checkpoint:'river'});
 const reloaded=createCheckpointStore(storage,['avenue','river'],79);expect(reloaded.read()).toEqual(savedProgress());expect(reloaded.snapshot()).toMatchObject({status:'loaded',writes:0,persistent:true,checkpoint:'river'});
});

test('3D checkpoints reject corrupt, oversized, future and unsafe stored progress without throwing',()=>{
 const invalid=[null,{}, {...savedProgress(),version:2},{...savedProgress(),checkpoint:'unknown'}, {...savedProgress(),found:[-1]}, {...savedProgress(),found:[80]}, {...savedProgress(),found:[1.5]}, {...savedProgress(),found:[1,1]}, {...savedProgress(),found:Array.from({length:81},(_,i)=>i)}, {...savedProgress(),health:0}, {...savedProgress(),health:1.01}, {...savedProgress(),energy:-.1}, {...savedProgress(),energy:1.01}];
 for(const value of [...invalid.map(JSON.stringify),'{invalid',' '.repeat(4097)]){
  const storage=inMemoryStorage();storage.setItem(SAVE_KEY,value);const store=createCheckpointStore(storage,['avenue','river'],79);expect(store.read()).toBeNull();expect(store.snapshot().persistent).toBe(false);
 }
});

test('3D rejected checkpoint writes retain the previous valid progress and do not count as saved',()=>{
 const storage=inMemoryStorage(),store=createCheckpointStore(storage,['avenue','river'],79);store.write(savedProgress());
 for(const changes of [{checkpoint:'removed-station'},{found:[NaN]},{health:Infinity},{health:0},{energy:NaN}])expect(store.write({...savedProgress(),...changes})).toBe(false);
 expect(store.read()).toEqual(savedProgress());expect(store.snapshot().writes).toBe(1);expect(JSON.parse(storage.getItem(SAVE_KEY))).toEqual(savedProgress());
});

test('3D denied browser storage keeps session progress while reporting that it is not persistent',()=>{
 const unavailable={getItem(){throw new Error('Storage denied');},setItem(){throw new Error('Storage denied');}},store=createCheckpointStore(unavailable,['avenue','river'],79);
 expect(store.read()).toBeNull();expect(store.write(savedProgress())).toBe(true);expect(store.read()).toEqual(savedProgress());expect(store.snapshot()).toEqual({status:'memory',writes:1,persistent:false,checkpoint:'river'});
 expect(createCheckpointStore(unavailable,['avenue','river'],79).read()).toBeNull();
});

test('3D missing storage permits a current-session checkpoint without claiming a reload save',()=>{
 const store=createCheckpointStore(null,['avenue','river'],79);expect(store.write(savedProgress())).toBe(true);expect(store.read()).toEqual(savedProgress());expect(store.snapshot().persistent).toBe(false);
 expect(createCheckpointStore(null,['avenue','river'],79).read()).toBeNull();
});
