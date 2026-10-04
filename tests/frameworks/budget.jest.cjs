const {test,expect}=require('@jest/globals');
test('maximum still includes a profiled database and its unprofiled dependency',async()=>{
 const {selectServices}=await import('../../scripts/runtime-policy.mjs');
 const services={postgres:{},gateway:{depends_on:{postgres:{}}},mongo:{profiles:['databases','maximum','everything']}};
 expect(selectServices(services,'core').sort()).toEqual(['gateway','postgres']);
 expect(selectServices(services,'maximum').sort()).toEqual(['gateway','mongo','postgres']);
});
test('a bad CPU override cannot pass the resource guard',async()=>{
 const {validateBudget}=await import('../../scripts/runtime-policy.mjs');
 const service={mem_limit:'64m',cpus:'invalid',pids_limit:16,healthcheck:{test:['CMD','true']},logging:{options:{'max-size':'1m','max-file':'2'}}};
 expect(()=>validateBudget({x:service},['x'],128)).toThrow(/CPU\/PID/);
});
test('environment overrides actually affect heap-independent memory budgeting',async()=>{
 const {memoryMiB}=await import('../../scripts/runtime-policy.mjs');
 process.env.OCV_TEST_MEM='384m';try{expect(memoryMiB('${OCV_TEST_MEM:-64m}')).toBe(384);}finally{delete process.env.OCV_TEST_MEM;}
});
