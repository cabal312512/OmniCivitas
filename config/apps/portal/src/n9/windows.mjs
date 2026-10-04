const life=new AbortController();
const on=(node,type,callback)=>node.addEventListener(type,callback,{signal:life.signal});
const panes=[...document.querySelectorAll('[data-n9-window]')];
const records=new Map(panes.map(node=>[node,{x:0,y:0,initiallyHidden:node.hidden}]));
const state=window.__ocvN9Windows={windows:panes.length,drags:0,closed:0};
let drag=null,layer=400;
function move(node,x,y){const record=records.get(node);record.x=x;record.y=y;node.style.translate=`${x}px ${y}px`;}
function raise(node){node.style.zIndex=String(Math.min(11000,++layer));}
for(const node of panes){
 const handle=node.querySelector('[data-n9-handle]');
 if(handle){
  on(handle,'pointerdown',event=>{if(event.button!==0||event.target.closest('button,a,input,select'))return;const record=records.get(node);drag={node,handle,pointer:event.pointerId,sx:event.clientX,sy:event.clientY,x:record.x,y:record.y};handle.setPointerCapture(event.pointerId);raise(node);event.preventDefault();});
  on(handle,'keydown',event=>{const shifts={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]};if(!shifts[event.key]||event.target!==handle)return;event.preventDefault();const record=records.get(node),[x,y]=shifts[event.key];move(node,record.x+x,record.y+y);raise(node);state.drags++;});
 }
 for(const button of node.querySelectorAll('[data-n9-close]'))on(button,'click',()=>{node.hidden=true;node.querySelectorAll('video').forEach(video=>video.pause());state.closed++;});
 on(node,'pointerdown',()=>raise(node));
}
on(document,'pointermove',event=>{if(!drag||event.pointerId!==drag.pointer)return;move(drag.node,drag.x+event.clientX-drag.sx,drag.y+event.clientY-drag.sy);});
function end(event){if(!drag||event.pointerId!==drag.pointer)return;const previous=drag;drag=null;if(previous.handle.hasPointerCapture(previous.pointer))previous.handle.releasePointerCapture(previous.pointer);state.drags++;}
on(document,'pointerup',end);on(document,'pointercancel',end);
for(const button of document.querySelectorAll('[data-n9-reset]'))on(button,'click',()=>{for(const [node,record] of records){if(!record.initiallyHidden)node.hidden=false;move(node,0,0);}drag=null;});
on(window,'pagehide',event=>{drag=null;if(!event.persisted)life.abort();});
