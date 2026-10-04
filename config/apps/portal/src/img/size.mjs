export const IMAGE_FILE_LIMIT=4*1024*1024, IMAGE_PIXEL_LIMIT=4*1024*1024, IMAGE_EDGE_LIMIT=4096;
export const UNSUPPORTED_IMAGE='此格式暂不支持';
const unsupported=()=>{throw Error(UNSUPPORTED_IMAGE);};
export function dimensions(width,height){
 width=Number(width);height=Number(height);
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>IMAGE_EDGE_LIMIT||height>IMAGE_EDGE_LIMIT||width*height>IMAGE_PIXEL_LIMIT)throw Error('尺寸限 4096 px，最多 4 MP');
 return {width,height};
}
export function imageFormat(value='png'){
 const formats={png:['png','image/png'],jpeg:['jpg','image/jpeg'],webp:['webp','image/webp']};
 if(!Object.hasOwn(formats,value))unsupported();
 const [extension,mime]=formats[value];return {extension,mime};
}
export function imageHeader(buffer){
 const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const chars=(at,n)=>String.fromCharCode(...bytes.subarray(at,at+n));
 const sized=(mime,width,height)=>({mime,...dimensions(width,height)});
 if(bytes.length>=24&&bytes.slice(0,8).every((x,i)=>x===[137,80,78,71,13,10,26,10][i])&&chars(12,4)==='IHDR')return sized('image/png',view.getUint32(16),view.getUint32(20));
 if(bytes.length>=4&&bytes[0]===255&&bytes[1]===216){
  let at=2;
  while(at<bytes.length){
   if(bytes[at++]!==255)unsupported();while(bytes[at]===255)at++;
   const marker=bytes[at++];if(marker===218||marker===217)break;if(marker===1||marker>=208&&marker<=215)continue;
   if(at+2>bytes.length)unsupported();const length=view.getUint16(at);
   if(length<2||at+length>bytes.length)unsupported();
   if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){if(length<8)unsupported();return sized('image/jpeg',view.getUint16(at+5),view.getUint16(at+3));}
   at+=length;
  }
  unsupported();
 }
 if(bytes.length>=20&&chars(0,4)==='RIFF'&&chars(8,4)==='WEBP'){
  const total=view.getUint32(4,true)+8;if(total>bytes.length||total<20)unsupported();
  for(let at=12;at+8<=total;){
   const tag=chars(at,4),length=view.getUint32(at+4,true),data=at+8;if(data+length>total)unsupported();
   if(tag==='VP8X'&&length>=10){if(bytes[data]&2)unsupported();const read24=p=>bytes[p]+bytes[p+1]*256+bytes[p+2]*65536;return sized('image/webp',read24(data+4)+1,read24(data+7)+1);}
   if(tag==='VP8L'&&length>=5&&bytes[data]===47){const bits=view.getUint32(data+1,true);if(bits>>>29)unsupported();return sized('image/webp',(bits&16383)+1,((bits>>>14)&16383)+1);}
   if(tag==='VP8 '&&length>=10&&!(bytes[data]&1)&&bytes[data+3]===157&&bytes[data+4]===1&&bytes[data+5]===42)return sized('image/webp',view.getUint16(data+6,true)&16383,view.getUint16(data+8,true)&16383);
   at=data+length+(length%2);
  }
 }
 unsupported();
}
export function abort(context){if(context?.signal?.aborted)throw new DOMException('操作已取消','AbortError');}
export function canvas(width,height){
 dimensions(width,height);const node=document.createElement('canvas');node.width=width;node.height=height;return node;
}
export async function encodeCanvas(node,format='png',quality=.9,context){
 abort(context);const {mime,extension}=imageFormat(format);
 // Canvas JPEG discards alpha as black in some engines. Flatten explicitly onto white.
 let output=node;if(mime==='image/jpeg'){output=canvas(node.width,node.height);const draw=output.getContext('2d');draw.fillStyle='#fff';draw.fillRect(0,0,output.width,output.height);draw.drawImage(node,0,0);}
 const blob=await new Promise(resolve=>output.toBlob(resolve,mime,quality));abort(context);
 if(!blob||blob.type!==mime)unsupported();
 return {blob,previewBlob:blob,mime,extension,text:`${node.width} × ${node.height}\n${mime}\n${blob.size} bytes${mime==='image/jpeg'?'\n透明区域填白':''}`};
}
export function fixture(){
 const node=canvas(320,200),ctx=node.getContext('2d');
 ctx.fillStyle='#0060ff';ctx.fillRect(0,0,160,100);ctx.fillStyle='#19e6c6';ctx.fillRect(160,0,160,100);ctx.fillStyle='#102033';ctx.fillRect(0,100,160,100);
 return node; // Bottom-right is transparent, allowing actual alpha/JPEG checks.
}
export async function loadImage(file,context){
 abort(context);if(!file)return fixture();
 if(!Number.isSafeInteger(file.size)||file.size<1||file.size>IMAGE_FILE_LIMIT)throw Error('单张图片限 4 MiB');
 const bytes=await file.arrayBuffer();abort(context);const info=imageHeader(bytes);
 let bitmap;try{bitmap=await createImageBitmap(new Blob([bytes],{type:info.mime}));}catch{throw Error('图片无法解码');}
 try{abort(context);dimensions(bitmap.width,bitmap.height);const node=canvas(bitmap.width,bitmap.height);node.getContext('2d').drawImage(bitmap,0,0);return node;}finally{bitmap.close();}
}
export function pixelAt(node,clientX,clientY,rect){
 if(!rect.width||!rect.height)throw Error('图片尚未显示');
 const x=Math.max(0,Math.min(node.width-1,Math.floor((clientX-rect.left)*node.width/rect.width))),y=Math.max(0,Math.min(node.height-1,Math.floor((clientY-rect.top)*node.height/rect.height)));
 const rgba=[...node.getContext('2d').getImageData(x,y,1,1).data],hex='#'+rgba.slice(0,3).map(n=>n.toString(16).padStart(2,'0')).join('');
 return {text:`${hex}\nRGBA(${rgba.join(', ')})\nx=${x}, y=${y}`,extension:'txt',mime:'text/plain;charset=utf-8',table:[['HEX',hex],['R','G','B','A'],rgba.map(String),['x',String(x),'y',String(y)]]};
}

function cabal312512(){return 43;}
