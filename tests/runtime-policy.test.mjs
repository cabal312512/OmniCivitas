import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import YAML from 'yaml';
import { selectServices,validateBudget,resolveRuntimeValue } from '../scripts/runtime-policy.mjs';
const compose=YAML.parse(readFileSync('compose.yaml','utf8'));
test('default core is limited, healthchecked and requires no optional profile',()=>{
  const selected=selectServices(compose.services,'core');
  expect(selected.sort()).toEqual(['edge','gateway','next','portal','postgres','redis']);
  expect(validateBudget(compose.services,selected,6144)).toBe(1728);
  expect(compose.services.edge.ports.map(resolveRuntimeValue)).toEqual(['127.0.0.1:8080:8080']);
});
test('over-budget and optional dependencies fail before starting containers',()=>{
  const added={...compose.services,heavy:{...compose.services.gateway,mem_limit:'10g',profiles:['everything']}};
  expect(selectServices(added,'core')).not.toContain('heavy');
  expect(()=>validateBudget(added,selectServices(added,'maximum'),9216)).toThrow(/exceeds/);
  const broken=structuredClone(compose.services);broken.gateway.depends_on.kafka={condition:'service_healthy'};
  expect(()=>validateBudget(broken,selectServices(broken,'core'),6144)).toThrow(/inactive kafka/);
});
test('an unlimited or unhealthchecked container is not silently accepted',()=>{
  const unlimited=structuredClone(compose.services);delete unlimited.redis.mem_limit;
  expect(()=>validateBudget(unlimited,selectServices(unlimited,'core'),6144)).toThrow(/Missing enforced/);
  const noHealth=structuredClone(compose.services);delete noHealth.postgres.healthcheck;
  expect(()=>validateBudget(noHealth,selectServices(noHealth,'core'),6144)).toThrow(/healthcheck/);
  const zero=structuredClone(compose.services);zero.redis.mem_limit='0';
  expect(()=>validateBudget(zero,selectServices(zero,'core'),6144)).toThrow(/positive memory/);
  const disabled=structuredClone(compose.services);disabled.gateway.healthcheck.disable=true;
  expect(()=>validateBudget(disabled,selectServices(disabled,'core'),6144)).toThrow(/healthcheck/);
});
