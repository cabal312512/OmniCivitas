import moment from 'moment';
import {formatISO,parseISO} from 'date-fns';
import {DateTime} from 'luxon';
const life=new AbortController(),root=document.querySelector('.q9-root,.echo-root'),frame=document.querySelector('#echo-angular');
export function clocks(iso){const utc=DateTime.fromISO(iso,{zone:'utc'});return {utc:utc.toFormat('HH:mm:ss'),tokyo:utc.setZone('Asia/Tokyo').toFormat('HH:mm:ss'),local:moment(formatISO(parseISO(iso))).format('HH:mm:ss')};}
function tick(){const c=clocks(new Date().toISOString());for(const [id,value] of Object.entries(c)){const node=root.querySelector('[data-zone="'+id+'"]');if(node)node.textContent=id+' '+value;}}
let timer;function start(){clearInterval(timer);tick();timer=setInterval(()=>{if(!document.hidden)tick();},1000);}start();
function transmit(){frame?.contentWindow?.postMessage({v:1,type:'OCV_TWO_BOOLEANS',token:'two-spoons',seen:true,ready:window.__ocvHunt?.snapshot()?.count===30},location.origin);}
document.querySelector('#echo-annex-open')?.addEventListener('click',()=>{if(!frame.src){frame.src='/office-1999/';frame.hidden=false;}else{frame.hidden=!frame.hidden;if(!frame.hidden)transmit();}},{signal:life.signal});
frame?.addEventListener('load',transmit,{signal:life.signal});
window.addEventListener('message',event=>{const d=event.data;if(event.origin!==location.origin||event.source!==frame?.contentWindow||!d||d.v!==1||d.type!=='OCV_BOOLEAN_RECEIPT'||d.token!=='two-spoons'||typeof d.seen!=='boolean'||typeof d.ready!=='boolean'||Object.keys(d).length!==5)return;document.querySelector('#echo-annex-result').textContent=String(d.seen)+' / '+String(d.ready);},{signal:life.signal});
document.addEventListener('q8:progress',transmit,{signal:life.signal});
window.addEventListener('pageshow',event=>{if(event.persisted)start();},{signal:life.signal});window.addEventListener('pagehide',event=>{clearInterval(timer);if(!event.persisted)life.abort();},{signal:life.signal});
