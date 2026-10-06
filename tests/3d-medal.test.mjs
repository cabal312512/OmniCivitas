import {test,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {MEDAL_KEY,TROPHY_ID,MEDAL_FILENAME,MEDAL_SVG,createMedalStore,createMedalBlob,downloadMedal} from '../pinia/p9.mjs';

const earnedAt=1791014400000;
const progress=()=>({version:1,trophyId:TROPHY_ID,earnedAt});
function fakeStorage(initial=null){
 const values=new Map(initial===null?[]:[[MEDAL_KEY,initial]]),writes=[];
 return {values,writes,getItem:key=>values.get(key)??null,setItem(key,value){writes.push({key,value});values.set(key,value);}};
}

test('summit medal stays locked in a new store and only unlock records the fixed reward',()=>{
 const storage=fakeStorage(),store=createMedalStore(storage);
 expect(store.read()).toBeNull();expect(store.snapshot()).toMatchObject({status:'empty',earned:false,writes:0,persistent:false});
 expect(store.unlock(earnedAt)).toEqual(progress());expect(storage.writes).toEqual([{key:MEDAL_KEY,value:JSON.stringify(progress())}]);
 expect(store.snapshot()).toMatchObject({status:'saved',earned:true,writes:1,persistent:true});
 expect(store.unlock(earnedAt+1000)).toEqual(progress());expect(storage.writes).toHaveLength(1);
 expect(createMedalStore(storage).read()).toEqual(progress());
});

test('medal persistence strips unrelated keys and returned values cannot mutate the store',()=>{
 const storage=fakeStorage(JSON.stringify({...progress(),password:'unused',position:{x:900},user:'unused',found:[0]}));
 const store=createMedalStore(storage),first=store.read();expect(first).toEqual(progress());
 first.trophyId='other';first.earnedAt=3;expect(store.read()).toEqual(progress());
 const snapshot=store.snapshot();snapshot.earnedAt=5;expect(store.snapshot().earnedAt).toBe(earnedAt);
});

test('broken, oversized, future-version and malformed medal records remain locked',()=>{
 const invalid=['{','x'.repeat(1025),JSON.stringify([]),JSON.stringify(null),JSON.stringify({...progress(),version:2}),JSON.stringify({...progress(),trophyId:'other'}),JSON.stringify({...progress(),earnedAt:'123'}),JSON.stringify({...progress(),earnedAt:-1}),JSON.stringify({...progress(),earnedAt:1.5}),JSON.stringify({...progress(),earnedAt:8640000000000001})];
 for(const raw of invalid){const storage=fakeStorage(raw),store=createMedalStore(storage);expect(store.read()).toBeNull();expect(store.snapshot()).toMatchObject({status:'invalid',earned:false,persistent:false});expect(storage.writes).toEqual([]);}
});

test('invalid award times cannot unlock or write a medal',()=>{
 for(const timestamp of [NaN,Infinity,-Infinity,-1,0,1.4,'123',null,8640000000000001]){
  const storage=fakeStorage(),store=createMedalStore(storage);expect(store.unlock(timestamp)).toBeNull();expect(store.snapshot().earned).toBe(false);expect(storage.writes).toEqual([]);
 }
});

test('storage write refusal preserves the earned medal only in the current store',()=>{
 const storage={getItem:()=>null,setItem:()=>{throw new Error('QuotaExceededError');}};
 const store=createMedalStore(storage);expect(store.unlock(earnedAt)).toEqual(progress());expect(store.read()).toEqual(progress());
 expect(store.snapshot()).toMatchObject({status:'memory',earned:true,writes:1,persistent:false});
 expect(store.unlock(earnedAt+1000)).toEqual(progress());expect(store.snapshot().writes).toBe(1);
 expect(createMedalStore(storage).read()).toBeNull();
});

test('storage getter and read refusal keep normal reward flow and do not expose exceptions',()=>{
 for(const storage of [null,()=>{throw new Error('SecurityError');},{getItem:()=>{throw new Error('SecurityError');}}]){
  const store=createMedalStore(storage);expect(store.read()).toBeNull();expect(store.unlock(earnedAt)).toEqual(progress());expect(store.read()).toEqual(progress());expect(store.snapshot()).toMatchObject({earned:true,persistent:false,status:'memory'});
 }
});

test('persistent medal changes and removals are read from storage instead of cached forever',()=>{
 const storage=fakeStorage(JSON.stringify(progress())),store=createMedalStore(storage);expect(store.read()).toEqual(progress());
 storage.values.set(MEDAL_KEY,JSON.stringify({...progress(),earnedAt:earnedAt+2000}));expect(store.read().earnedAt).toBe(earnedAt+2000);
 storage.values.delete(MEDAL_KEY);expect(store.read()).toBeNull();expect(store.snapshot()).toMatchObject({earned:false,status:'empty'});
});

test('download is an exact standalone SVG using the website real identity paths',async()=>{
 const blob=createMedalBlob();expect(blob.type).toBe('image/svg+xml;charset=utf-8');expect(await blob.text()).toBe(MEDAL_SVG);
 expect(MEDAL_SVG).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);expect(MEDAL_SVG).toMatch(/viewBox="0 0 512 576"/);expect(MEDAL_SVG).toMatch(/<\/svg>$/);
 expect(MEDAL_SVG).not.toMatch(/<script|<image|<foreignObject|@import|url\(["']?https?:|href=["']https?:|C:\\|F:\\/i);
 const ids=[...MEDAL_SVG.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);expect(new Set(ids).size).toBe(ids.length);
 for(const match of MEDAL_SVG.matchAll(/url\(#([^)]*)\)/g))expect(ids).toContain(match[1]);
 const identity=readFileSync(new URL('../config/apps/portal/src/aaa/Identity.astro',import.meta.url),'utf8');
 for(const path of ['M326 95a88 88 0 1 0 0 118','M182 82l69 149 70-149']){expect(identity).toContain(path);expect(MEDAL_SVG).toContain(path);}
 expect(MEDAL_SVG).toContain('<circle cx="155" cy="154" r="88"/>');
});

test('medal download uses the fixed filename and revokes its temporary URL after the native click',()=>{
 vi.useFakeTimers();
 try{
  const click=vi.fn(),remove=vi.fn(),append=vi.fn(),link={click,remove},revokeObjectURL=vi.fn(),createObjectURL=vi.fn(()=> 'blob:local-medal');
  const documentRef={body:{append},createElement:vi.fn(()=>link)},urlApi={createObjectURL,revokeObjectURL};
  const result=downloadMedal(documentRef,urlApi);
  expect(documentRef.createElement).toHaveBeenCalledWith('a');expect(append).toHaveBeenCalledWith(link);expect(link).toMatchObject({href:'blob:local-medal',download:MEDAL_FILENAME,hidden:true});
  expect(link.download).toBe('OmniCivitas-Summit-Medal.svg');expect(click).toHaveBeenCalledTimes(1);expect(remove).toHaveBeenCalledTimes(1);expect(result).toMatchObject({filename:MEDAL_FILENAME,type:'image/svg+xml;charset=utf-8'});
  expect(result.bytes).toBe(new TextEncoder().encode(MEDAL_SVG).length);expect(revokeObjectURL).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1500);expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-medal');
 }finally{vi.useRealTimers();}
});
