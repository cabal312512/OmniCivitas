export const SAVE_KEY='ocv.aero.checkpoint.v1';
// The save contains only game progress. Positions come from the current world's
// known station list, so old or altered saves cannot put a player inside a wall.
export function createCheckpointStore(storage,stationIds,maxEntityId=95){
 const allowed=new Set(stationIds);let memory=null,status='empty',writes=0;
 function valid(value){
  if(!value||value.version!==1||!allowed.has(value.checkpoint)||!Array.isArray(value.found)||value.found.length>maxEntityId+1)return null;
  if(!value.found.every(id=>Number.isInteger(id)&&id>=0&&id<=maxEntityId)||new Set(value.found).size!==value.found.length)return null;
  if(!Number.isFinite(value.health)||value.health<=0||value.health>1||!Number.isFinite(value.energy)||value.energy<0||value.energy>1)return null;
  return {version:1,checkpoint:value.checkpoint,found:[...value.found],health:value.health,energy:value.energy};
 }
 function read(){
  try{const text=storage?.getItem(SAVE_KEY);if(!text){status=storage?'empty':'memory';return memory;}if(text.length>4096){status='invalid';return null;}const value=valid(JSON.parse(text));status=value?'loaded':'invalid';memory=value;return value;}
  catch{status='memory';return memory;}
 }
 function write(progress){
  const value=valid(progress);if(!value)return false;memory=value;writes++;
  try{if(!storage)throw new Error('Storage unavailable');storage.setItem(SAVE_KEY,JSON.stringify(value));status='saved';}catch{status='memory';}
  return true;
 }
 return{read,write,snapshot:()=>({status,writes,persistent:status==='loaded'||status==='saved',checkpoint:memory?.checkpoint??null})};
}
