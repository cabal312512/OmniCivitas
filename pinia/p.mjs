// The site owns this meter. Tool windows receive totals, never the pointer history.
export const measurementKey='ocv.mileage.v1';
const ceiling=1e15, lifespan=86400000;
const empty=now=>({version:1,enteredAt:now,pixels:0,pointerEvents:0,wheelPixels:0,wheelEvents:0});
export function restoreMeasurement(text,now=Date.now()){
 try{const v=JSON.parse(text);if(!v||Object.keys(v).length!==6||v.version!==1||!Number.isFinite(v.enteredAt)||v.enteredAt>now||now-v.enteredAt>lifespan) return empty(now);
 for(const key of ['pixels','pointerEvents','wheelPixels','wheelEvents'])if(!Number.isFinite(v[key])||v[key]<0||v[key]>ceiling||key.endsWith('Events')&&!Number.isInteger(v[key]))return empty(now);
 return {...v};}catch{return empty(now);}
}
export function meterStep(state,last,event){
 if(event.type==='pointermove'){
  if(event.pointerType!=='mouse'||!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return {state,last};
  const point={x:event.clientX,y:event.clientY};
  return {last:point,state:{...state,pointerEvents:Math.min(ceiling,state.pointerEvents+1),pixels:Math.min(ceiling,state.pixels+(last?Math.hypot(point.x-last.x,point.y-last.y):0))}};
 }
 if(event.type==='wheel'){
  const scale=event.deltaMode===1?16:event.deltaMode===2?Math.max(1,event.pageHeight||1):1;
  const travel=Math.hypot(Number(event.deltaX)||0,Number(event.deltaY)||0)*scale;
  if(!Number.isFinite(travel))return {state,last};
  return {last,state:{...state,wheelEvents:Math.min(ceiling,state.wheelEvents+1),wheelPixels:Math.min(ceiling,state.wheelPixels+travel)}};
 }
 return {state,last};
}
let active;
export function ensureCivilizationMeasurement(){
 if(active||typeof window==='undefined')return active;
 let state=empty(Date.now()),last=null,persistence='session',savedAt=0,enabled=!document.hidden;
 try{state=restoreMeasurement(sessionStorage.getItem(measurementKey));}catch{persistence='memory';}
 const save=()=>{try{sessionStorage.setItem(measurementKey,JSON.stringify(state));savedAt=Date.now();}catch{persistence='memory';}};
 const onMove=event=>{if(!enabled)return;({state,last}=meterStep(state,last,event));if(Date.now()-savedAt>5000)save();};
 const onWheel=event=>{if(!enabled)return;({state,last}=meterStep(state,last,{type:'wheel',deltaX:event.deltaX,deltaY:event.deltaY,deltaMode:event.deltaMode,pageHeight:window.innerHeight}));if(Date.now()-savedAt>5000)save();};
 const onHidden=()=>{enabled=!document.hidden;last=null;if(!enabled)save();};
 const off=()=>{enabled=false;last=null;save();};
 const onShow=()=>{enabled=!document.hidden;last=null;};
 window.addEventListener('pointermove',onMove,{passive:true});window.addEventListener('wheel',onWheel,{passive:true});
 document.addEventListener('visibilitychange',onHidden);window.addEventListener('pagehide',off);window.addEventListener('pageshow',onShow);
 active={snapshot:()=>Object.freeze({...state,persistence}),dispose:()=>{off();window.removeEventListener('pointermove',onMove);window.removeEventListener('wheel',onWheel);document.removeEventListener('visibilitychange',onHidden);window.removeEventListener('pagehide',off);window.removeEventListener('pageshow',onShow);active=null;}};
 save();return active;
}
export function measurementSnapshot(){return ensureCivilizationMeasurement()?.snapshot()||Object.freeze({...empty(Date.now()),persistence:'memory'});}
