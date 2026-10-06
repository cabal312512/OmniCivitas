export function publicText(value:string){return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'…').replace(/(?:\+?\d[\s().-]*){7,}/g,'…').replace(/[\x00-\x1f\x7f]/g,' ').trim();}
export function avatarPng(value:string){
 if(value==='')return null;
 if(!/^[A-Za-z0-9+/]+={0,2}$/.test(value)||value.length>87384)throw Error('Invalid avatar');const b=Buffer.from(value,'base64');
 if(b.length>65536||b.length<57||b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Invalid avatar');
 let pos=8,head=false,image=false,end=false;
 while(pos+12<=b.length){const size=b.readUInt32BE(pos),type=b.toString('ascii',pos+4,pos+8);if(size>b.length-pos-12||end)throw Error('Invalid PNG chunk');
  if(!head&&type!=='IHDR')throw Error('Missing PNG header');if(type==='IHDR'){if(head||size!==13||b.readUInt32BE(pos+8)!==128||b.readUInt32BE(pos+12)!==128||b[pos+16]!==8||![2,6].includes(b[pos+17])||b[pos+18]!==0||b[pos+19]!==0||b[pos+20]!==0)throw Error('Avatar must be 128px PNG');head=true;}
  else if(type==='IDAT'){if(size===0)throw Error('Empty PNG');image=true;}else if(type==='IEND'){if(size!==0||!image)throw Error('Invalid PNG end');end=true;}else if(!['sRGB','gAMA','cHRM'].includes(type))throw Error('Avatar metadata rejected');
  let crc=0xffffffff;for(const n of b.subarray(pos+4,pos+8+size)){crc^=n;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}if(((crc^0xffffffff)>>>0)!==b.readUInt32BE(pos+8+size))throw Error('Invalid PNG checksum');pos+=size+12;
 }if(!head||!end||pos!==b.length)throw Error('Invalid avatar');return b;
}
