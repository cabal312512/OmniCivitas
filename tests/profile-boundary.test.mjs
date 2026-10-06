import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {deflateSync} from 'node:zlib';
const require=createRequire(import.meta.url),{publicText,avatarPng}=require('../services/gateway/dist/q8/profile.js');
test('Profile contact redaction and avatar metadata boundary',()=>{
 assert.equal(publicText('a@example.com +86 138 0013 8000'),'… …');
 assert.equal(publicText('小蓝 / hello'),'小蓝 / hello');
 assert.equal(avatarPng(''),null);
 assert.throws(()=>avatarPng(Buffer.from('email@example.com').toString('base64')));
 assert.throws(()=>avatarPng('a'.repeat(90000)));
});
test('Actual PNG thumbnail accepted; contact metadata, corrupt CRC and other sizes rejected',()=>{
 const crc=b=>{let n=0xffffffff;for(const byte of b){n^=byte;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;};
 const chunk=(type,data)=>{const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);data.copy(b,8);b.writeUInt32BE(crc(b.subarray(4,b.length-4)),b.length-4);return b;};
 const header=Buffer.alloc(13);header.writeUInt32BE(128);header.writeUInt32BE(128,4);header[8]=8;header[9]=6;
 const signature=Buffer.from('89504e470d0a1a0a','hex'),image=chunk('IDAT',deflateSync(Buffer.alloc(128*513))),end=chunk('IEND',Buffer.alloc(0));
 const png=Buffer.concat([signature,chunk('IHDR',header),image,end]);assert.deepEqual(avatarPng(png.toString('base64')),png);
 const tagged=Buffer.concat([signature,chunk('IHDR',header),chunk('tEXt',Buffer.from('Contact\0test@example.invalid')),image,end]);assert.throws(()=>avatarPng(tagged.toString('base64')));
 const corrupt=Buffer.from(png);corrupt[30]^=1;assert.throws(()=>avatarPng(corrupt.toString('base64')));
 header.writeUInt32BE(1024);assert.throws(()=>avatarPng(Buffer.concat([signature,chunk('IHDR',header),image,end]).toString('base64')));
});
