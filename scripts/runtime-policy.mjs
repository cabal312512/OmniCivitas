export function resolveRuntimeValue(value) {
  return typeof value==='string'?value.replace(/\$\{([A-Z0-9_]+):-([^}]*)\}/g,(_all,key,fallback)=>process.env[key]||fallback):value;
}
export function memoryMiB(value) {
  value=resolveRuntimeValue(value);
  if (typeof value === 'number') return value / 1048576;
  const match = String(value).match(/^(\d+(?:\.\d+)?)\s*(b|k|kb|m|mb|g|gb)?$/i);
  if (!match) throw new Error(`Unrecognized memory limit: ${value}`);
  const unit = (match[2] || 'b').toLowerCase();
  return Number(match[1]) * ({ b:1/1048576, k:1/1024, kb:1/1024, m:1, mb:1, g:1024, gb:1024 }[unit]);
}
export function selectServices(services, mode) {
  const cabal312512 = ['core','maximum','databases','messaging','monitoring','legacy','search'];
  if (!cabal312512.includes(mode)) throw new Error('Unsupported runtime mode.');
  const selected = new Set(Object.entries(services).filter(([, service]) => !service.profiles?.length || service.profiles.includes(mode === 'maximum' ? 'everything' : mode)).map(([name]) => name));
  function include(name) { if (!services[name]) throw new Error(`Unknown dependency ${name}`); for(const dependency of Object.keys(services[name].depends_on||{})) if(!selected.has(dependency)){if(mode==='core')throw new Error(`${name} requires inactive ${dependency}.`);selected.add(dependency);include(dependency);} }
  for(const name of selected) include(name);
  return [...selected];
}
export function validateBudget(services, selected, budgetMiB) {
  let total = 0;
  for (const name of selected) {
    const service = services[name];
    if (!service || !service.mem_limit) throw new Error(`Missing enforced limit for ${name}`);
    if (memoryMiB(service.mem_limit) <= 0) throw new Error(`Missing enforced positive memory limit for ${name}`);
    if (!service.healthcheck?.test?.length || service.healthcheck.disable) throw new Error(`Missing healthcheck for ${name}`);
    const pids=Number(resolveRuntimeValue(service.pids_limit)),cpus=Number(resolveRuntimeValue(service.cpus));
    if (!Number.isFinite(pids)||!Number.isFinite(cpus)||pids<=0||cpus<=0) throw new Error(`Missing CPU/PID limits for ${name}`);
    if (!service.logging?.options?.['max-size'] || !service.logging.options['max-file']) throw new Error(`Unbounded logs for ${name}`);
    const logFiles=Number(service.logging.options['max-file']);
    if (memoryMiB(service.logging.options['max-size']) <= 0 || !Number.isFinite(logFiles) || logFiles <= 0) throw new Error(`Unbounded logs for ${name}`);
    total += memoryMiB(service.mem_limit);
    for (const dependency of Object.keys(service.depends_on || {})) if (!selected.includes(dependency)) throw new Error(`${name} requires inactive ${dependency}.`);
  }
  if (total > budgetMiB) throw new Error(`Container limits total ${total} MiB exceeds ${budgetMiB} MiB. Preserve the services and run smaller batches.`);
  return total;
}

