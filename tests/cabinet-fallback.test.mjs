import {it,expect,vi,afterEach} from 'vitest';
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});
it('a blocked IndexedDB keeps bounded values in session memory and supports clear',async()=>{
  vi.stubGlobal('indexedDB',{open(){throw new DOMException('Blocked','SecurityError');}});
  const {cabinet,cabinetStorageMode}=await import('../config/apps/portal/src/js/db.mjs');
  await cabinet('put','<script>inert text</script>');
  expect(await cabinet('get')).toBe('<script>inert text</script>');
  expect(cabinetStorageMode()).toBe('session memory fallback');
  await cabinet('clear');expect(await cabinet('get')).toBeUndefined();
});
it('denied storage cannot bypass the original data size bound',async()=>{
  vi.stubGlobal('indexedDB',undefined);
  const {cabinet}=await import('../config/apps/portal/src/js/db.mjs');
  await expect(cabinet('put','a'.repeat(201))).rejects.toThrow('200');
  await cabinet('put','x');expect(await cabinet('get')).toBe('x');
  await expect(cabinet('unknown')).rejects.toThrow('Unknown');
});
