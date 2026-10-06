import {CITIES} from '../pcakage/build2/c0.mjs';
export const GUARDIAN_KEY='ocv.aero.guardians.v1';
const kinds=['relay','array','bell','carousel','spear','ram','tide','crawler'];
const patterns=['volley','mines','wave','beam','lances','charge','wells','burst'];
export const GUARDIANS=Object.freeze(CITIES.filter(c=>c.id!=='capital').map((c,i)=>Object.freeze({id:c.id,x:c.x,z:c.z,y:c.ground+.32,kind:kinds[i],attack:patterns[i],hp:[24,30,30,27,33,36,30,33][i],radius:210,color:['#75cde8','#a2b9e1','#9bdbc9','#ddbdd8','#85b6e6','#afcfc5','#83d8db','#bdd39b'][i]})));
export function cleanGuardians(raw){try{if(typeof raw==='string'){if(raw.length>2048)return null;raw=JSON.parse(raw);}if(raw?.version!==1||!Array.isArray(raw.defeated)||raw.defeated.length>8)return null;return {version:1,defeated:[...new Set(raw.defeated.filter(id=>GUARDIANS.some(g=>g.id===id)))]};}catch{return null;}}
export function createGuardianStore(storage){let record={version:1,defeated:[]},persistent=false;const target=()=>typeof storage==='function'?storage():storage;try{record=cleanGuardians(target()?.getItem(GUARDIAN_KEY))||record;}catch{}
 const ids=new Set(record.defeated);return{has:id=>ids.has(id),mark(id){if(ids.has(id)||!GUARDIANS.some(g=>g.id===id))return false;ids.add(id);record.defeated.push(id);persistent=false;try{target()?.setItem(GUARDIAN_KEY,JSON.stringify(record));persistent=!!target();}catch{}return true;},get complete(){return ids.size===8;},snapshot:()=>({...record,defeated:[...record.defeated],persistent})};}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const segmentDistance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,l=dx*dx+dy*dy+dz*dz,t=l?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/l,0,1):0;return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t,p.z-a.z-dz*t);};

export function createGuardianState(spec,{defeated=false,onDefeat=()=>{}}={}){
 const s={id:spec.id,kind:spec.kind,x:spec.x,y:spec.y,z:spec.z,hp:defeated?0:spec.hp,maxHp:spec.hp,defeated,active:false,phase:1,pending:null,shots:[],effects:[],lastHit:-Infinity,lastAttack:0,attacks:0,damageEvents:0,charge:null,completions:0};
 const clear=()=>{s.shots.length=0;s.effects.length=0;s.pending=null;s.charge=null;};
 function hit(weak,time){if(!s.active||s.defeated||!Number.isFinite(time)||time-s.lastHit<.15)return false;s.lastHit=time;s.hp=Math.max(0,s.hp-(weak?3:1));s.phase=s.hp<=s.maxHp*.45?2:1;if(!s.hp){s.defeated=true;s.active=false;s.completions++;clear();onDefeat(spec.id);}return true;}
 function update(p,time,dt,onDamage=()=>{},obstruct=(_a,_d,l)=>l,blocked=()=>false){
  dt=clamp(Number.isFinite(dt)?dt:0,0,.1);if(s.defeated){s.active=false;return;}
  const near=Math.hypot(p.x-spec.x,p.z-spec.z)<spec.radius&&p.health>0&&Math.abs(p.y-spec.y)<100;
  if(!near){if(s.active){s.hp=s.maxHp;s.phase=1;s.x=spec.x;s.z=spec.z;clear();}s.active=false;return;}
  if(!s.active){s.active=true;s.lastAttack=time;}
  if(!s.pending&&!s.charge&&time-s.lastAttack>(s.phase===2?2.2:3.1)){
   s.pending={at:time+.95,x:p.x,y:p.y+1.2,z:p.z,attack:spec.attack};s.lastAttack=time;
  }
  const hurt=v=>{s.damageEvents++;onDamage(v);};
  const shot=(angle,dy,speed,life=5)=>{if(s.shots.length>=24)return;const start={x:s.x,y:spec.y+10,z:s.z},len=Math.hypot(1,dy);s.shots.push({...start,vx:Math.cos(angle)/len*speed,vy:dy/len*speed,vz:Math.sin(angle)/len*speed,life});};
  if(s.pending&&time>=s.pending.at){const a=s.pending;s.pending=null;s.attacks++;const yaw=Math.atan2(a.z-s.z,a.x-s.x),range=Math.max(1,Math.hypot(a.x-s.x,a.z-s.z));
   if(a.attack==='volley'||a.attack==='lances'){for(let i=-s.phase*2;i<=s.phase*2;i++)shot(yaw+i*(a.attack==='lances'?.04:.13),(a.y-spec.y-10)/range,a.attack==='lances'?80:38);}
   else if(a.attack==='burst'){for(let i=0;i<12+s.phase*4;i++)shot(i*Math.PI*2/(12+s.phase*4),-.07,30);}
   else if(a.attack==='charge'){s.charge={vx:Math.cos(yaw)*46,vz:Math.sin(yaw)*46,life:2.1,hit:false};}
   else if(a.attack==='wave')s.effects.push({kind:'wave',x:s.x,z:s.z,y:spec.y,radius:0,life:6,hit:false});
   else if(a.attack==='beam')s.effects.push({kind:'beam',x:s.x,z:s.z,y:spec.y+1.2,angle:yaw-.65,radius:150,life:2.5,lastHit:-Infinity});
   else for(let i=0;i<5;i++){const angle=i*Math.PI*2/5;s.effects.push({kind:a.attack==='wells'?'well':'mine',x:a.x+Math.cos(angle)*9,z:a.z+Math.sin(angle)*9,y:spec.y,radius:a.attack==='wells'?14:7,life:a.attack==='wells'?3.5:2.2,armed:time+.7,hit:false});}
   if(s.effects.length>12)s.effects.splice(0,s.effects.length-12);
  }
  if(s.charge){const c=s.charge,nx=s.x+c.vx*dt,nz=s.z+c.vz*dt;c.life-=dt;
   if(!blocked(nx,nz,5,spec.y)&&Math.hypot(nx-spec.x,nz-spec.z)<120){s.x=nx;s.z=nz;}else c.life=0;
   if(!c.hit&&Math.hypot(p.x-s.x,p.z-s.z)<11&&Math.abs(p.y-spec.y)<15){c.hit=true;hurt(.18);}if(c.life<=0)s.charge=null;
  }else if(Math.hypot(s.x-spec.x,s.z-spec.z)>1){const t=Math.min(1,dt*.9),nx=s.x+(spec.x-s.x)*t,nz=s.z+(spec.z-s.z)*t;if(!blocked(nx,nz,5,spec.y)){s.x=nx;s.z=nz;}}
  for(let i=s.shots.length-1;i>=0;i--){const a=s.shots[i],end={x:a.x+a.vx*dt,y:a.y+a.vy*dt,z:a.z+a.vz*dt},l=Math.hypot(a.vx,a.vy,a.vz)*dt,d=l?{x:(end.x-a.x)/l,y:(end.y-a.y)/l,z:(end.z-a.z)/l}:{x:0,y:0,z:0};a.life-=dt;
   const wall=obstruct(a,d,l);if(a.life<=0||end.y<spec.y||wall===true||typeof wall==='number'&&wall<l-.01){s.shots.splice(i,1);continue;}
   if(segmentDistance({x:p.x,y:p.y+1.2,z:p.z},a,end)<1.4){hurt(.065);s.shots.splice(i,1);}else Object.assign(a,end);
  }
  for(let i=s.effects.length-1;i>=0;i--){const e=s.effects[i];e.life-=dt;const distance=Math.hypot(p.x-e.x,p.z-e.z);
   if(e.kind==='wave'){const before=e.radius;e.radius+=dt*35;if(!e.hit&&distance>=before-1.5&&distance<=e.radius+1.5&&p.y<e.y+1.8){e.hit=true;hurt(.12);}}
   else if(e.kind==='beam'){e.angle+=dt*.6;const start={x:e.x,y:e.y,z:e.z},dir={x:Math.cos(e.angle),y:0,z:Math.sin(e.angle)},wall=obstruct(start,dir,150);e.radius=typeof wall==='number'?clamp(wall,0,150):wall===true?0:150;const end={x:e.x+dir.x*e.radius,y:e.y,z:e.z+dir.z*e.radius};if(segmentDistance({x:p.x,y:p.y+1,z:p.z},start,end)<1.7&&time-e.lastHit>.55){e.lastHit=time;hurt(.1);}}
   else if(time>=e.armed&&distance<e.radius&&Math.abs(p.y-e.y)<3){if(e.kind==='mine'&&!e.hit){e.hit=true;hurt(.14);}else if(e.kind==='well'){hurt(dt*.055);const pull=Math.min(distance,dt*8),nx=p.x+(e.x-p.x)/(distance||1)*pull,nz=p.z+(e.z-p.z)/(distance||1)*pull;if(!blocked(nx,nz,.5,p.y)){p.x=nx;p.z=nz;}}}
   if(e.life<=0)s.effects.splice(i,1);
  }
 }
 return{state:s,hit,update};
}
