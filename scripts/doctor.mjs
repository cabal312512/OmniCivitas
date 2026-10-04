import './guard-paths.mjs';
if(process.env.OCV_LOCAL_STORAGE_GUARD==='1')await import('./doctor-local.mjs');
else{
  const {dockerCall}=await import('./docker-child.mjs');
  const os=await import('node:os');
  let config={status:1},state={status:1};
  try{config=dockerCall(['compose','-f','compose.yaml','config','--services'],{allowFailure:true});state=dockerCall(['compose','-f','compose.yaml','ps','--format','json'],{allowFailure:true});}catch{}
  console.log(JSON.stringify({node:process.version,platform:process.platform,memoryGiB:os.totalmem()/1024**3,defaultServices:config.status===0?config.stdout.trim().split(/\s+/):[],dockerAvailable:state.status===0,running:state.status===0?state.stdout.trim():null,note:'Docker is optional for pnpm dev. No machine-specific cache or disk layout is required.'},null,2));
}
