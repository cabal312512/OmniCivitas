import {catalogue} from '../main1/catalogue.mjs';
const key='ocv.desk.recent';
try{const current=catalogue.find(r=>r.url.replace(/\/$/,'')===location.pathname.replace(/\/$/,''));if(current){let old=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(old))old=[];old=old.filter(r=>r&&typeof r.id==='string'&&r.id!==current.id).slice(0,23);localStorage.setItem(key,JSON.stringify([{id:current.id,time:Date.now()},...old]));}}catch{}
