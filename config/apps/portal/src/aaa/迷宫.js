// Layout errors are intentional; window controls and escape routes are real.
const lifetime=new AbortController();
const on=(el,type,fn,options={})=>el?.addEventListener(type,fn,{...options,signal:lifetime.signal});
// Deliberately oversized rooms must not push the one reliable exit outside a phone's visual viewport.
function anchorExit(){const v=window.visualViewport;if(!v)return;for(const [selector,inset] of [['.maze-exit',59],['.maze-index',111]]){const el=document.querySelector(selector);if(!el)continue;el.style.left=(v.offsetLeft+v.width-inset)+'px';el.style.top=(v.offsetTop+v.height-63)+'px';el.style.right='auto';el.style.bottom='auto';}}
anchorExit();on(window,'resize',anchorExit,{passive:true});on(window.visualViewport,'resize',anchorExit,{passive:true});on(window.visualViewport,'scroll',anchorExit,{passive:true});
let serial=100;
document.querySelectorAll('[data-draggable]').forEach(panel=>{
 const drag=panel.querySelector('[data-drag]');let moving=false,startX=0,startY=0,baseX=0,baseY=0,x=0,y=0;
 const move=(dx,dy)=>{x=Math.max(-innerWidth*.75,Math.min(innerWidth*.75,dx));y=Math.max(-innerHeight*.75,Math.min(innerHeight*.75,dy));panel.style.setProperty('--drag-x',x+'px');panel.style.setProperty('--drag-y',y+'px');};
 on(drag,'pointerdown',event=>{moving=true;startX=event.clientX;startY=event.clientY;baseX=x;baseY=y;drag.setPointerCapture(event.pointerId);event.preventDefault();panel.style.zIndex=String(++serial);});
 on(drag,'pointermove',event=>{if(moving)move(baseX+event.clientX-startX,baseY+event.clientY-startY);});
 on(drag,'pointerup',()=>moving=false);on(drag,'pointercancel',()=>moving=false);
 on(drag,'keydown',event=>{const steps={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]};if(steps[event.key]){event.preventDefault();move(x+steps[event.key][0],y+steps[event.key][1]);panel.style.zIndex=String(++serial);}});
 on(panel.querySelector('[data-front]'),'click',()=>{panel.style.zIndex=String(++serial);panel.classList.add('brought-forward');});
 on(panel.querySelector('[data-fold]'),'click',event=>{const folded=panel.toggleAttribute('data-folded');event.currentTarget.textContent=folded?'+':'−';event.currentTarget.setAttribute('aria-expanded',String(!folded));});
});
document.querySelectorAll('[data-sort]').forEach(button=>on(button,'click',()=>{
 const table=button.closest('table'),body=table.tBodies[0],column=Number(button.dataset.sort),order=button.dataset.order==='up'?-1:1;button.dataset.order=order===1?'up':'down';
 [...body.rows].sort((a,b)=>a.cells[column].textContent.localeCompare(b.cells[column].textContent,'zh-CN',{numeric:true})*order).forEach(row=>body.append(row));
 table.closest('.route-table-wrap').querySelector('.table-note').textContent=order===1?'↑':'↓';
}));
on(document,'visibilitychange',()=>document.body.dataset.hidden=String(document.hidden));
on(window,'pagehide',event=>{if(!event.persisted)lifetime.abort();});
