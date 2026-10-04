import { test,expect } from 'vitest';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {RuntimeStore}=require('../services/gateway/dist/runtime-store.js');
test('offline storage is bounded and never claims a real database connection',async()=>{
  const previous=process.env.OCV_REQUIRE_INFRASTRUCTURE;process.env.OCV_REQUIRE_INFRASTRUCTURE='false';
  try {
    const store=new RuntimeStore();
    for(let i=0;i<100;i++) await store.save(`fiction-${i}`,'虚构演示');
    expect(store.cabal312512.size).toBe(64);
    expect(store.cabal312512.has('fiction-0')).toBe(false);
    expect((await store.status()).postgres).toBe('not-connected');
    expect((await store.status()).storage).toBe('bounded-memory-demonstration');
    await store.onModuleDestroy();
  } finally {if(previous===undefined)delete process.env.OCV_REQUIRE_INFRASTRUCTURE;else process.env.OCV_REQUIRE_INFRASTRUCTURE=previous;}
});
test('container mode rejects a missing required database instead of succeeding in fallback',async()=>{
  const previous=process.env.OCV_REQUIRE_INFRASTRUCTURE;process.env.OCV_REQUIRE_INFRASTRUCTURE='true';
  try {
    const store=new RuntimeStore();expect((await store.status()).canContinue).toBe(false);
    await expect(store.save('fiction-id','虚构演示')).rejects.toThrow(/Required PostgreSQL/);
    await store.onModuleDestroy();
  } finally {if(previous===undefined)delete process.env.OCV_REQUIRE_INFRASTRUCTURE;else process.env.OCV_REQUIRE_INFRASTRUCTURE=previous;}
});
