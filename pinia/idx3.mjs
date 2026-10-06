export function createSpatialIndex(size=64){
 const grid=new Map(),members=new Map();
 function range(x1,z1,x2,z2,visit){for(let x=Math.floor(x1/size);x<=Math.floor(x2/size);x++)for(let z=Math.floor(z1/size);z<=Math.floor(z2/size);z++)visit(`${x}:${z}`);}
 return{add(item){if(members.has(item))return;const keys=[];range(item.x-item.radius,item.z-item.radius,item.x+item.radius,item.z+item.radius,key=>{let bucket=grid.get(key);if(!bucket){bucket=new Set();grid.set(key,bucket);}bucket.add(item);keys.push(key);});members.set(item,keys);},
  remove(item){for(const key of members.get(item)||[]){const bucket=grid.get(key);bucket.delete(item);if(!bucket.size)grid.delete(key);}members.delete(item);},
  query(x1,z1,x2,z2){const cells=(Math.floor(x2/size)-Math.floor(x1/size)+1)*(Math.floor(z2/size)-Math.floor(z1/size)+1);if(!Number.isFinite(cells)||cells>4096)return members.keys();const result=new Set();range(x1,z1,x2,z2,key=>{for(const item of grid.get(key)||[])result.add(item);});return result;},
  clear(){grid.clear();members.clear();},get size(){return members.size;}};
}
