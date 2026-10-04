import * as THREE from 'three';

export function mountAccentControls(canvas,camera,accent,requestFrame){
 const state={yaw:0,pitch:0,zoom:1,x:0,y:0,energy:0,expanded:false,hovered:-1,selected:-1},ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
 const listeners=[],listen=(name,fn,options)=>{canvas.addEventListener(name,fn,options);listeners.push(()=>canvas.removeEventListener(name,fn,options));};
 let drag=null,travel=0,changes=0;
 const changed=()=>{canvas.dataset.interactions=String(++changes);requestFrame();};
 const locate=event=>{const r=canvas.getBoundingClientRect();state.x=Math.max(-1,Math.min(1,(event.clientX-r.left)/r.width*2-1));state.y=Math.max(-1,Math.min(1,1-(event.clientY-r.top)/r.height*2));pointer.set(state.x,state.y);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(accent.pickables,false)[0];state.hovered=hit?.object.userData.index??-1;};
 listen('pointerdown',event=>{if(event.button!==0)return;canvas.focus({preventScroll:true});drag={id:event.pointerId,x:event.clientX,y:event.clientY};travel=0;canvas.setPointerCapture(event.pointerId);canvas.classList.add('is-dragging');});
 listen('pointermove',event=>{locate(event);if(drag&&drag.id===event.pointerId){const dx=event.clientX-drag.x,dy=event.clientY-drag.y;travel+=Math.abs(dx)+Math.abs(dy);state.yaw+=dx*.009;state.pitch=Math.max(-.72,Math.min(.72,state.pitch+dy*.007));drag.x=event.clientX;drag.y=event.clientY;changed();}else requestFrame();});
 const release=event=>{if(!drag||drag.id!==event.pointerId)return;drag=null;canvas.classList.remove('is-dragging');if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);if(event.type==='pointerup'&&travel<7){locate(event);state.energy=1;state.expanded=!state.expanded;state.selected=state.hovered>=0?state.hovered:(state.selected+1)%Math.max(1,accent.pickables.length);accent.select?.(state.selected);changed();}};
 listen('pointerup',release);listen('pointercancel',release);listen('lostpointercapture',()=>{drag=null;canvas.classList.remove('is-dragging');});
 listen('pointerleave',()=>{if(!drag){state.x=state.y=0;state.hovered=-1;requestFrame();}});
 listen('wheel',event=>{event.preventDefault();state.zoom=Math.max(.7,Math.min(1.55,state.zoom*Math.exp(-Math.max(-300,Math.min(300,event.deltaY))*.0014)));changed();},{passive:false});
 const reset=()=>{Object.assign(state,{yaw:0,pitch:0,zoom:1,x:0,y:0,energy:0,expanded:false,hovered:-1,selected:-1});accent.select?.(-1);changed();};
 listen('dblclick',reset);listen('keydown',event=>{if(event.key==='Escape'){reset();event.preventDefault();}else if(event.key==='Enter'||event.key===' '){event.preventDefault();state.energy=1;state.expanded=!state.expanded;state.selected=(state.selected+1)%Math.max(1,accent.pickables.length);accent.select?.(state.selected);changed();}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(event.key)){event.preventDefault();if(event.key==='ArrowLeft')state.yaw-=.1;if(event.key==='ArrowRight')state.yaw+=.1;if(event.key==='ArrowUp')state.pitch=Math.max(-.72,state.pitch-.08);if(event.key==='ArrowDown')state.pitch=Math.min(.72,state.pitch+.08);if(event.key==='+'||event.key==='=')state.zoom=Math.min(1.55,state.zoom*1.08);if(event.key==='-')state.zoom=Math.max(.7,state.zoom/1.08);changed();}});
 return {state,dispose(){listeners.forEach(fn=>fn());}};
}
