import {notation} from './audio.mjs';

export const notationScore=(source,tempo)=>notation(source,tempo).map(note=>({...note,d:Math.round(note.d)}));

export const melodyDemos=Object.freeze([
 Object.freeze({id:'joy',name:'欢乐颂',tempo:112,notation:'3 3 4 5 | 5 4 3 2 | 1 1 2 3 | 3. 2_ 2 - | 3 3 4 5 | 5 4 3 2 | 1 1 2 3 | 2. 1_ 1 -'}),
 Object.freeze({id:'bells',name:'铃儿响叮当',tempo:132,notation:"3 3 3 - | 3 3 3 - | 3 5 1' 2' | 3' - - 0 | 4 4 4 4 | 4 3 3 3 | 3 2 2 3 | 2 - 5 - | 3 3 3 - | 3 3 3 - | 3 5 1' 2' | 3' - - 0 | 4 4 4 4 | 4 3 3 3 | 5 5 4 2 | 1 - - -"}),
 Object.freeze({id:'star',name:'小星星',tempo:104,notation:'1 1 5 5 | 6 6 5 - | 4 4 3 3 | 2 2 1 - | 5 5 4 4 | 3 3 2 - | 5 5 4 4 | 3 3 2 - | 1 1 5 5 | 6 6 5 - | 4 4 3 3 | 2 2 1 -'}),
 Object.freeze({id:'tigers',name:'两只老虎',tempo:116,notation:'1 2 3 1 | 1 2 3 1 | 3 4 5 - | 3 4 5 - | 5_ 6_ 5_ 4_ 3 1 | 5_ 6_ 5_ 4_ 3 1 | 1 5, 1 - | 1 5, 1 -'}),
 Object.freeze({id:'lamb',name:'玛丽有只小羊',tempo:112,notation:'3 2 1 2 | 3 3 3 - | 2 2 2 - | 3 5 5 - | 3 2 1 2 | 3 3 3 3 | 2 2 3 2 | 1 - - -'}),
 Object.freeze({id:'bridge',name:'伦敦桥',tempo:108,notation:'5. 6_ 5 4 | 3 4 5 - | 2 3 4 - | 3 4 5 - | 5. 6_ 5 4 | 3 4 5 - | 2 - 5 - | 3 1 - -'})
]);
