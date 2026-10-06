import {GAME_AWARDS} from '../../../../../pinia/h3.mjs';
const titles=new Map(GAME_AWARDS.map(a=>[a.id,a.title]));
export function createAwardNotifications(root,{schedule=setTimeout,cancel=clearTimeout}={}){
 const pending=[],active=new Map();let disposed=false;
 function drain(){while(!disposed&&root&&active.size<3&&pending.length){const id=pending.shift(),node=root.ownerDocument.createElement('div');node.className='aero-award-toast';node.dataset.awardId=id;const label=root.ownerDocument.createElement('small'),title=root.ownerDocument.createElement('strong');label.textContent='成就已获得';title.textContent=titles.get(id);node.append(label,title);root.append(node);const timer=schedule(()=>{node.remove();active.delete(id);drain();},1900);active.set(id,{node,timer});}}
 return{notify(ids){if(disposed)return;for(const id of ids)if(titles.has(id)&&!active.has(id)&&!pending.includes(id)&&pending.length<GAME_AWARDS.length)pending.push(id);drain();},dispose(){disposed=true;pending.length=0;for(const {node,timer}of active.values()){cancel(timer);node.remove();}active.clear();}};
}
