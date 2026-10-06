import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {notation,midi} from '../config/apps/web2/app/studio/audio.mjs';
const require=createRequire(import.meta.url);
const {slotsFromRust,luaNotes,notesFromLua}=require('../services/gateway/dist/q8/core.js');
test('Canonical Rust room records: exactly thirty, bounded, unique and valid',()=>{
 const rust=fs.readFileSync(new URL('../historical/station/src/rooms.rs',import.meta.url),'utf8'),slots=slotsFromRust(rust);
 assert.equal(slots.length,30);assert.deepEqual(slots.map(s=>s.id),Array.from({length:30},(_,i)=>i));
 assert.throws(()=>slotsFromRust(rust.replace('slot!(29,','slot!(28,')));assert.throws(()=>slotsFromRust(' '.repeat(65537)));
});
test('Numbered notation: rests, dotted notes, octave and length boundaries',()=>{
 assert.deepEqual(notation('1 0 - 2',120).map(n=>n.t),[0,1500]);
 assert.equal(notation("1'_ 2,.",120)[0].n,72);assert.equal(notation('1.',120)[0].d,675);
 assert.throws(()=>notation('8'));assert.throws(()=>notation("1''''"));assert.throws(()=>notation('1 '.repeat(257)));
});
test('Postgres-to-Lua score roundtrip and actual MIDI event structure',()=>{
 const events=notation('1 3 5 0 5 -',120);assert.deepEqual(notesFromLua(luaNotes(events)),events);
 const midiBytes=Buffer.from(midi(events,120));assert.equal(midiBytes.toString('ascii',0,4),'MThd');assert.equal(midiBytes.readUInt16BE(12),480);assert.equal(midiBytes.toString('ascii',14,18),'MTrk');assert.equal(midiBytes.readUInt32BE(18),midiBytes.length-22);assert.deepEqual([...midiBytes.subarray(-3)],[255,47,0]);
});
