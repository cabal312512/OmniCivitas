// Standard installation is independent of the optional machine storage contract.
if(process.env.OCV_LOCAL_STORAGE_GUARD==='1')await import('./guard-local-paths.mjs');
