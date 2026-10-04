import {test,expect,vi,afterEach} from 'vitest';
import {dimensions,imageFormat,imageHeader,pixelAt,loadImage,IMAGE_FILE_LIMIT} from '../config/apps/portal/src/img/size.mjs';
import {tools,textSettings,qrSettings} from '../config/apps/portal/src/img/img.mjs';
afterEach(()=>vi.unstubAllGlobals());
const u32=(n,little=false)=>{const data=new Uint8Array(4);new DataView(data.buffer).setUint32(0,n,little);return [...data];};
const ascii=text=>[...text].map(c=>c.charCodeAt(0));
const png=(w,h)=>new Uint8Array([137,80,78,71,13,10,26,10,...u32(13),...ascii('IHDR'),...u32(w),...u32(h)]);
const webp=(tag,data)=>new Uint8Array([...ascii('RIFF'),...u32(data.length+12+(data.length%2),true),...ascii('WEBP'),...ascii(tag),...u32(data.length,true),...data,...(data.length%2?[0]:[])]);
test('all eight image descriptors map distinct requirements and do not need a DOM at import',()=>{
 expect(tools.map(t=>t.id)).toEqual(['image-crop','image-compress','image-convert','image-resize','image-color','text-image','qr-generate','qr-read']);
 expect(tools.flatMap(t=>t.requirements)).toEqual(['B018','B019','B020','B021','B022','B023','B024','B025']);
 for(const tool of tools){expect(typeof tool.run).toBe('function');expect(tool.group).toBe('图片');}
});
test('canvas dimensions accept thin images and bound each edge and total decoded pixels',()=>{
 expect(dimensions('2048','2048')).toEqual({width:2048,height:2048});expect(dimensions(4096,1).width).toBe(4096);
 for(const pair of [[0,1],[-1,1],[1.5,2],[4097,1],[4096,4096],[Infinity,2],['',2],[NaN,2]])expect(()=>dimensions(...pair)).toThrow(/尺寸/);
});
test('format selection is a strict PNG/JPEG/WebP allowlist',()=>{
 expect(imageFormat('jpeg')).toEqual({mime:'image/jpeg',extension:'jpg'});expect(imageFormat('png').mime).toBe('image/png');expect(imageFormat('webp').extension).toBe('webp');
 for(const format of ['avif','svg','bmp','jpg','__proto__',''])expect(()=>imageFormat(format)).toThrow('此格式暂不支持');
});
test('PNG dimensions are checked before browser decoding, including Uint8Array offsets',()=>{
 expect(imageHeader(png(320,200))).toEqual({mime:'image/png',width:320,height:200});
 const bytes=new Uint8Array(28);bytes.set(png(1,1),4);expect(imageHeader(bytes.subarray(4))).toEqual({mime:'image/png',width:1,height:1});
 expect(()=>imageHeader(png(65535,65535))).toThrow(/尺寸/);expect(()=>imageHeader(png(10,0))).toThrow(/尺寸/);
});
test('JPEG SOF dimensions skip APP metadata, support progressive frames and reject malformed lengths',()=>{
 const data=new Uint8Array([255,216,255,224,0,4,1,2,255,194,0,8,8,0,200,1,64,1]);
 expect(imageHeader(data)).toEqual({mime:'image/jpeg',width:320,height:200});
 expect(()=>imageHeader(new Uint8Array([255,216,255,224,255,255,1]))).toThrow('此格式暂不支持');
 expect(()=>imageHeader(new Uint8Array([255,216,255,218,0,2]))).toThrow('此格式暂不支持');
});
test('WebP VP8, VP8L and VP8X headers yield actual bounded dimensions',()=>{
 expect(imageHeader(webp('VP8 ',[0,0,0,157,1,42,64,1,200,0]))).toEqual({mime:'image/webp',width:320,height:200});
 const packed=(319|(199<<14));expect(imageHeader(webp('VP8L',[47,...u32(packed,true)]))).toEqual({mime:'image/webp',width:320,height:200});
 expect(imageHeader(webp('VP8X',[0,0,0,0,63,1,0,199,0,0]))).toEqual({mime:'image/webp',width:320,height:200});
});
test('animated, version-invalid and truncated WebP are rejected before decode',()=>{
 expect(()=>imageHeader(webp('VP8X',[2,0,0,0,63,1,0,199,0,0]))).toThrow('此格式暂不支持');
 expect(()=>imageHeader(webp('VP8L',[47,...u32(1<<29,true)]))).toThrow('此格式暂不支持');
 expect(()=>imageHeader(webp('VP8 ',[0,0,0,157,1,42,64,1,200,0]).slice(0,-1))).toThrow('此格式暂不支持');
});
test('SVG, external resource text, GIF, BMP and corrupted signatures never reach a browser decoder',()=>{
 for(const content of ['<svg><image href="https://example.org/"/></svg>','GIF89a','BM0012','RIFFxx',''])expect(()=>imageHeader(new TextEncoder().encode(content))).toThrow('此格式暂不支持');
});
test('file byte limits and abort are checked before any read or decode',async()=>{
 const read=vi.fn();await expect(loadImage({size:IMAGE_FILE_LIMIT+1,arrayBuffer:read},{})).rejects.toThrow(/4 MiB/);expect(read).not.toHaveBeenCalled();
 const controller=new AbortController();controller.abort();await expect(loadImage({size:1,arrayBuffer:read},{signal:controller.signal})).rejects.toHaveProperty('name','AbortError');expect(read).not.toHaveBeenCalled();
});
test('pixel picking uses displayed-to-source scaling, edge clamping and exact alpha',()=>{
 const getImageData=vi.fn(()=>({data:new Uint8ClampedArray([0,96,255,128])})),node={width:320,height:200,getContext:()=>({getImageData})},rect={left:10,top:20,width:160,height:100};
 const result=pixelAt(node,90,70,rect);expect(getImageData).toHaveBeenCalledWith(160,100,1,1);expect(result.text).toBe('#0060ff\nRGBA(0, 96, 255, 128)\nx=160, y=100');
 pixelAt(node,999,-999,rect);expect(getImageData).toHaveBeenLastCalledWith(319,0,1,1);expect(()=>pixelAt(node,0,0,{...rect,width:0})).toThrow(/尚未显示/);
});
test('text image bounds retain Unicode and reject excessive lines, invalid fonts and backgrounds',()=>{
 expect(textSettings({source:'中文 🌐\nA',size:32,background:'transparent'})).toEqual({text:'中文 🌐\nA',size:32,background:'transparent'});
 for(const input of [{source:'x'.repeat(2001)},{source:'\n'.repeat(64)},{size:0},{size:97},{size:8.5},{background:'url(http://x)'}])expect(()=>textSettings(input)).toThrow();
});
test('QR inputs are bounded by UTF-8 bytes and actual output dimensions',()=>{
 expect(qrSettings({source:'中文🌐',size:384})).toEqual({source:'中文🌐',size:384});
 for(const input of [{source:''},{source:'🌐'.repeat(257)},{size:127},{size:1025},{size:200.5}])expect(()=>qrSettings(input)).toThrow();
});
test('installed QR encoder and decoder roundtrip independent ASCII and Unicode payloads',async()=>{
 const {default:QRCode}=await import('../config/apps/portal/node_modules/qrcode/lib/index.js'),{default:jsQR}=await import('../config/apps/portal/node_modules/jsqr/dist/jsQR.js');
 for(const source of ['https://example.org/a?b=1','中文 🌐\nOmniCivitas']){
  const qr=QRCode.create(source,{errorCorrectionLevel:'M'}),scale=6,edge=(qr.modules.size+8)*scale,pixels=new Uint8ClampedArray(edge*edge*4);pixels.fill(255);
  for(let y=0;y<qr.modules.size;y++)for(let x=0;x<qr.modules.size;x++)if(qr.modules.get(y,x))for(let iy=0;iy<scale;iy++)for(let ix=0;ix<scale;ix++){const at=(((y+4)*scale+iy)*edge+(x+4)*scale+ix)*4;pixels[at]=pixels[at+1]=pixels[at+2]=0;}
  expect(jsQR(pixels,edge,edge).data).toBe(source);
 }
});
