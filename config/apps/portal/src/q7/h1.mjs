import {MEDAL_KEY,createMedalStore,downloadMedal} from '../../../../../pinia/p9.mjs';

const home=document.querySelector('[data-aero-medal-home]');
const dialog=document.querySelector('[data-aero-medal-dialog]');
if(home&&dialog){
 const store=createMedalStore(()=>window.localStorage),lifetime=new AbortController();
 const on=(target,type,handler)=>target?.addEventListener(type,handler,{signal:lifetime.signal});
 const open=home.querySelector('[data-aero-medal-open]'),download=dialog.querySelector('[data-aero-medal-download]');
 let disposed=false;
 function paint(){
  const earned=Boolean(store.read());open.dataset.earned=String(earned);
  dialog.querySelector('[data-aero-medal-empty]').hidden=earned;
  dialog.querySelector('[data-aero-medal-art]').hidden=!earned;download.hidden=!earned;
 }
 function close(){if(dialog.open)dialog.close();}
 function cover(){const covered=document.body.dataset.cover==='true';home.inert=covered;if(covered)close();}
 on(open,'click',()=>{paint();if(home.inert||disposed)return;dialog.showModal();dialog.querySelector('[data-aero-medal-close]').focus();});
 on(dialog.querySelector('[data-aero-medal-close]'),'click',close);
 on(dialog,'click',event=>{if(event.target!==dialog)return;const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)close();});
 on(download,'click',()=>{if(store.read())downloadMedal();else paint();});
 on(window,'storage',event=>{if(event.key===MEDAL_KEY||event.key===null)paint();});
 const observer=new MutationObserver(cover);observer.observe(document.body,{attributes:true,attributeFilter:['data-cover']});
 on(window,'pagehide',event=>{close();if(!event.persisted){disposed=true;observer.disconnect();lifetime.abort();}});
 on(window,'pageshow',()=>{paint();cover();});
 Object.defineProperty(window,'__ocvAeroMedal',{configurable:true,value:Object.freeze({snapshot:()=>({...store.snapshot(),open:dialog.open,covered:home.inert,disposed})})});
 paint();cover();
}
