const ACTIONS=['pulse','shear','phase','resonate'];
const LENGTHS={pulse:1100,shear:1250,phase:1600,resonate:1400};
const COHERENCE={pulse:.9,shear:.24,phase:.46,resonate:1};
const clamp=(value,limit)=>Math.max(-limit,Math.min(limit,value));
const dormantField=()=>({x:0,y:0,proximity:0});

export function creatureFieldDeflection(point,rect){
 if(!rect||rect.width<=0||rect.height<=0||![point?.x,point?.y,rect.left,rect.top,rect.width,rect.height].every(Number.isFinite))return dormantField();
 const x=point.x-(rect.left+rect.width/2),y=point.y-(rect.top+rect.height/2),distance=Math.hypot(x,y);
 const radius=Math.max(180,Math.min(320,Math.max(rect.width,rect.height)*1.8));
 return distance<radius?{x:clamp(x/18,8),y:clamp(y/24,6),proximity:1-distance/radius}:dormantField();
}
export function creatureSpeechDuration(text){return Math.min(6500,Math.max(1400,String(text||'').length*160));}

export function residentFieldDeflection(point,rect){
 if(!rect||rect.width<=0||rect.height<=0||![point?.x,point?.y,rect.left,rect.top,rect.width,rect.height].every(Number.isFinite))return dormantField();
 const local=creatureFieldDeflection(point,rect),dx=point.x-rect.left-rect.width/2,dy=point.y-rect.top-rect.height/2;
 return{x:Math.tanh(dx/Math.max(120,rect.width*.75))*8,y:Math.tanh(dy/Math.max(120,rect.height*.75))*6,proximity:local.proximity};
}

export function createCreatureStage({document:doc=globalThis.document,signal}={}){
 const win=doc.defaultView||globalThis,life=new AbortController(),roots=[...doc.querySelectorAll('[data-q8-actor]')];
 const reduced=win.matchMedia?.('(prefers-reduced-motion: reduce)'),records=new Map();
 let timer=null,paused=doc.visibilityState==='hidden',disposed=false,lastPointer=-Infinity,pointer=null;
 const now=()=>win.performance?.now?.()??Date.now();
 const later=(fn,delay)=>win.setTimeout(fn,delay),cancel=id=>win.clearTimeout(id);
 for(const root of roots){const number=Number(root.dataset.id),seed=Number.isFinite(number)?number:17;records.set(root,{root,seed,turn:0,idleAt:now()+4300+seed*83,actionUntil:0,speechUntil:0,speechEnergy:0,lastAction:-2000,field:dormantField(),proximity:0,coherence:.62,hover:false,focused:false,visible:true});}
 function on(target,event,handler,options={}){target?.addEventListener?.(event,handler,{...options,signal:life.signal});}
 function visible(record){
  const root=record.root;if(!record.visible||root.hidden||root.closest?.('[hidden]'))return false;
  if(doc.body?.dataset.cover==='true'&&root.dataset.q8Actor==='hidden')return false;
  const style=win.getComputedStyle?.(root);
  return (!style||style.visibility!=='hidden'&&style.display!=='none')&&root.getClientRects().length>0;
 }
 function field(record){
  record.proximity=record.root.dataset.q8Awake==='false'||reduced?.matches?0:Math.max(record.field.proximity,(record.hover||record.focused ? .55 : 0));
  record.coherence=record.actionUntil?COHERENCE[record.root.dataset.q8Action]:.62+record.proximity*.28;
  record.root.style.setProperty('--field-x',`${record.field.x.toFixed(2)}px`);
  record.root.style.setProperty('--field-y',`${record.field.y.toFixed(2)}px`);
  record.root.style.setProperty('--field-proximity',record.proximity.toFixed(3));
  record.root.style.setProperty('--field-coherence',record.coherence.toFixed(3));
 }
 function silence(record){record.speechUntil=0;record.speechEnergy=0;record.root.removeAttribute('data-q8-talking');record.root.style.setProperty('--speech-energy','0');}
 function clear(record){
  const root=record.root;root.dataset.q8Action='idle';root.dataset.q8Awake='false';root.removeAttribute('data-q8-hint');
  record.actionUntil=0;record.field=dormantField();field(record);silence(record);
 }
 function perform(root,action,{duration,force=false}={}){
  const record=records.get(root),at=now();
  if(disposed||paused||!record||!visible(record)||!ACTIONS.includes(action)||!force&&at-record.lastAction<350)return false;
  const span=Number.isFinite(duration)?Math.max(200,Math.min(duration,2200)):LENGTHS[action];
  record.lastAction=at;record.actionUntil=at+span;root.dataset.q8Action=action;field(record);
  if(action==='phase'&&root.dataset.q8Actor==='hidden')root.dataset.q8Hint='true';
  schedule();return true;
 }
 function tick(){
  timer=null;if(disposed||paused)return;
  const at=now();
  for(const record of records.values()){
   if(!visible(record)){clear(record);continue;}
   const root=record.root;root.dataset.q8Awake='true';
   if(record.actionUntil&&at>=record.actionUntil){record.actionUntil=0;root.dataset.q8Action='idle';if(!record.hover&&!record.focused)root.removeAttribute('data-q8-hint');field(record);}
   if(record.speechUntil&&at>=record.speechUntil)silence(record);
   if(at>=record.idleAt){
    if(!reduced?.matches&&!record.hover&&!record.focused&&!record.speechUntil&&!record.actionUntil){const action=ACTIONS[(record.seed+record.turn++)%ACTIONS.length];perform(root,action,{force:true});}
    record.idleAt=at+6500+(record.seed+record.turn*3)%11*260;
   }
  }
  schedule();
 }
 function schedule(){
  if(timer!==null){cancel(timer);timer=null;}if(disposed||paused)return;
  const active=[...records.values()].filter(visible);if(!active.length)return;
  const at=now(),deadlines=active.flatMap(r=>[r.actionUntil,r.speechUntil,...(reduced?.matches?[]:[r.idleAt])]).filter(value=>value>0);
  if(deadlines.length)timer=later(tick,Math.max(40,Math.min(...deadlines)-at));
 }
 function refresh(){
  if(disposed)return;const at=now();
  for(const record of records.values()){
   if(paused||!visible(record)){clear(record);continue;}
   record.root.dataset.q8Awake='true';record.idleAt=at+4300+record.seed*83;if(pointer&&record.root.dataset.q8Actor==='resident')record.field=residentFieldDeflection(pointer,record.root.getBoundingClientRect());field(record);
  }
  schedule();
 }
 function engage(record,kind,active){
  record[kind]=active;if(disposed||paused||!visible(record))return;
  if(active){record.root.dataset.q8Hint='true';perform(record.root,'pulse');}
  else if(!record.hover&&!record.focused){record.root.removeAttribute('data-q8-hint');if(record.root.dataset.q8Actor!=='resident')record.field=dormantField();}
  field(record);
 }
 for(const record of records.values()){
  on(record.root,'pointerenter',()=>engage(record,'hover',true));on(record.root,'pointerleave',()=>engage(record,'hover',false));
  on(record.root,'focus',()=>engage(record,'focused',true));on(record.root,'blur',()=>engage(record,'focused',false));
 }
 on(doc,'pointermove',event=>{
  if(disposed||paused||reduced?.matches||event.pointerType==='touch')return;const at=now();if(at-lastPointer<32)return;lastPointer=at;pointer={x:event.clientX,y:event.clientY};
  for(const record of records.values())if(visible(record)){
   record.field=(record.root.dataset.q8Actor==='resident'?residentFieldDeflection:creatureFieldDeflection)(pointer,record.root.getBoundingClientRect());field(record);
  }
 },{passive:true});
 on(doc,'q8:resident-move',()=>{if(!pointer||disposed||paused||reduced?.matches)return;for(const record of records.values())if(record.root.dataset.q8Actor==='resident'&&visible(record)){record.field=residentFieldDeflection(pointer,record.root.getBoundingClientRect());field(record);}});
 on(doc,'q8:speech',event=>{
  for(const record of records.values())silence(record);
  if(event.detail?.active!==false&&!paused){const root=event.detail?.actor||roots.find(root=>root.dataset.q8Actor==='resident'&&!root.hidden),record=records.get(root);if(record&&visible(record)){record.speechUntil=now()+creatureSpeechDuration(event.detail.text);record.speechEnergy=.78;root.dataset.q8Talking='true';root.style.setProperty('--speech-energy',String(record.speechEnergy));}}
  schedule();
 });
 on(doc,'visibilitychange',()=>{paused=doc.visibilityState==='hidden';refresh();});
 on(win,'pagehide',()=>{paused=true;refresh();});on(win,'pageshow',()=>{paused=doc.visibilityState==='hidden';refresh();});
 on(reduced,'change',()=>{for(const record of records.values())clear(record);refresh();});
 const Observer=win.MutationObserver,observer=Observer?new Observer(refresh):null;
 if(observer){
  if(doc.body)observer.observe(doc.body,{attributes:true,attributeFilter:['data-cover']});
  for(const root of doc.querySelectorAll('[data-q8-creature],[data-q8-resident]'))observer.observe(root,{attributes:true,attributeFilter:['hidden']});
  for(const root of doc.querySelectorAll('[data-echo-body]'))observer.observe(root,{attributes:true,attributeFilter:['hidden','style']});
 }
 const Intersector=win.IntersectionObserver,intersection=Intersector?new Intersector(entries=>{for(const entry of entries){const record=records.get(entry.target);if(record)record.visible=entry.isIntersecting;}refresh();}):null;
 for(const root of roots)intersection?.observe(root);
 function dispose(){if(disposed)return;disposed=true;if(timer!==null)cancel(timer);timer=null;observer?.disconnect();intersection?.disconnect();signal?.removeEventListener('abort',dispose);life.abort();for(const record of records.values())clear(record);}
 signal?.addEventListener('abort',dispose,{once:true});if(signal?.aborted)dispose();else refresh();
 return{perform,refresh,dispose,snapshot:()=>({actors:roots.length,active:disposed||paused?0:[...records.values()].filter(visible).length,paused,disposed,reduced:!!reduced?.matches,timers:timer===null?0:1,states:[...records.values()].map(record=>({kind:record.root.dataset.q8Actor,form:record.root.dataset.q8Form,action:record.root.dataset.q8Action,field:{...record.field,proximity:record.proximity},coherence:record.coherence,speechEnergy:record.speechEnergy,talking:record.root.hasAttribute('data-q8-talking')}))})};
}
