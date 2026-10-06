import {features,snapshot,loadDesk,mutate} from './state.mjs';
const page=[...features.values()].find(r=>r.url.replace(/\/$/,'')===location.pathname.replace(/\/$/,''));
const stars=document.querySelectorAll('[data-desk-star]');
function paint(){stars.forEach(b=>{b.hidden=!page;b.textContent=snapshot().favorites.some(r=>r.id===page?.id)?'★':'☆';});}
for(const b of stars)b.addEventListener('click',async()=>{if(!page)return;b.disabled=true;try{await loadDesk();mutate(s=>{if(s.favorites.some(r=>r.id===page.id))s.favorites=s.favorites.filter(r=>r.id!==page.id);else if(s.favorites.length<60)s.favorites.push({id:page.id,folder:page.url.startsWith('/functions/')?'tools':'pages'});});paint();}finally{b.disabled=false;}});
document.addEventListener('q9:desk',paint);paint();
