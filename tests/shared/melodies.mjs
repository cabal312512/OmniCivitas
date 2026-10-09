import assert from 'node:assert/strict';
import {melodyDemos,notationScore} from '../../config/apps/web2/app/studio/melodies.mjs';
import {midi} from '../../config/apps/web2/app/studio/audio.mjs';

const openings={joy:[64,64,65,67],bells:[64,64,64],star:[60,60,67,67],tigers:[60,62,64,60],lamb:[64,62,60,62],bridge:[67,69,67,65]};
assert.equal(melodyDemos.length,6);
assert.equal(new Set(melodyDemos.map(demo=>demo.id)).size,6);
for(const demo of melodyDemos){
 const score=notationScore(demo.notation,demo.tempo),opening=openings[demo.id];
 assert.ok(opening,`Unexpected demonstration ${demo.id}`);
 assert.deepEqual(score.slice(0,opening.length).map(note=>note.n),opening,`${demo.id}: melody opening`);
 if(demo.id==='bells'){assert.deepEqual(score.slice(6,11).map(note=>note.n),[64,67,72,74,76]);assert.deepEqual(score.slice(31,36).map(note=>note.n),[64,67,72,74,76]);}
 assert.ok(score.length>0&&score.length<=64,`${demo.id}: bounded note count`);
 assert.ok(demo.tempo>=40&&demo.tempo<=240,`${demo.id}: editable tempo range`);
 for(const[index,note]of score.entries()){
  assert.ok(Number.isInteger(note.n)&&note.n>=48&&note.n<=84,`${demo.id}: pitch ${index}`);
  assert.ok(Number.isInteger(note.t)&&note.t>=0&&Number.isInteger(note.d)&&note.d>=40&&note.d<=4000,`${demo.id}: export timing ${index}`);
  assert.ok(index===0||note.t>=score[index-1].t+score[index-1].d,`${demo.id}: monophonic timing ${index}`);
  assert.ok(note.v>=.05&&note.v<=1,`${demo.id}: volume ${index}`);
 }
 assert.ok(score.at(-1).t+score.at(-1).d<60000,`${demo.id}: short demonstration`);
 const file=midi(score,demo.tempo);
 assert.equal(new TextDecoder().decode(file.subarray(0,4)),'MThd',`${demo.id}: MIDI header`);
 const view=new DataView(file.buffer,file.byteOffset,file.byteLength);
 assert.equal(view.getUint16(10),1,`${demo.id}: single MIDI track`);
 assert.equal(view.getUint32(18),file.length-22,`${demo.id}: correct MIDI track length`);
}
assert.deepEqual(notationScore('1_ 2_',120).map(note=>note.t),[0,250]);
assert.deepEqual(notationScore('1. 2_',120).map(note=>note.t),[0,750]);
assert.equal(notationScore('1. 2_',120)[0].d,675);
assert.equal(notationScore("5, 1'",120)[0].n,55);
assert.equal(notationScore("5, 1'",120)[1].n,72);
assert.equal(notationScore('1 - 2',112)[0].d,1018);
console.log('Six melody demonstrations validated; notation timing and MIDI structure verified.');
