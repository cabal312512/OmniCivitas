import {SAVE_KEY} from './v8.mjs';
import {MEDAL_KEY} from '../../pinia/p9.mjs';
import {GAME_AWARDS_KEY} from '../../pinia/h3.mjs';
import {GUARDIAN_KEY} from '../../pinia/8g.mjs';
export const GAME_PROGRESS_KEYS=Object.freeze([SAVE_KEY,MEDAL_KEY,GAME_AWARDS_KEY,GUARDIAN_KEY]);
export function resetGameProgress(storage){
 const failures=[];
 if(!storage)return{ok:true,sessionOnly:true,failures};
 for(const key of GAME_PROGRESS_KEYS)try{storage.removeItem(key);if(storage.getItem(key)!==null)failures.push(key);}catch{failures.push(key);}
 return{ok:failures.length===0,sessionOnly:false,failures};
}
