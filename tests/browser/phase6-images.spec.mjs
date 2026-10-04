import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {inflateSync} from 'node:zlib';
import {tools as imageTools} from '../../config/apps/portal/src/img/img.mjs';
import {tools as pdfTools,blankPhrase} from '../../config/apps/portal/src/file/pdf.mjs';
import {reports} from './report-location.mjs';
const require=createRequire(new URL('../../config/apps/portal/package.json',import.meta.url));
const {PDFDocument,PDFName}=require('pdf-lib');
const tools=[...imageTools,...pdfTools];
const proof=(info,name,value)=>fs.writeFileSync(path.join(reports,`phase6-${info.project.name}-${name}.json`),JSON.stringify(value,null,2));
const field=(page,key)=>page.locator(`#tool-form [name="${key}"]`);
async function activate(page,selector){await page.locator(selector).focus();await page.keyboard.press('Enter');}
async function enter(page,id){
 await page.emulateMedia({reducedMotion:'reduce'});const response=await page.goto(`/functions/${id}/`);expect(response.status()).toBe(200);
 await expect.poll(()=>page.evaluate(()=>window.__ocvTools?.id)).toBe(id);await activate(page,'[data-tool-front]');
}
async function submit(page,{error=false}={}){
 const before=await page.evaluate(()=>window.__ocvTools.runs);await activate(page,'#tool-run');
 await expect.poll(()=>page.evaluate(()=>window.__ocvTools.runs)).toBeGreaterThan(before);
 await expect.poll(()=>page.evaluate(()=>window.__ocvTools.busy),{timeout:20000}).toBe(false);
 await expect(page.locator('#tool-status')).toHaveAttribute('data-error',String(error));return page.locator('#tool-output').inputValue();
}
async function fixture(page){
 return Buffer.from(await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=48;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#ff0000';ctx.fillRect(0,0,32,24);ctx.fillStyle='#00ff00';ctx.fillRect(32,0,32,24);ctx.fillStyle='#0000ff';ctx.fillRect(0,24,32,24);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));return [...new Uint8Array(await blob.arrayBuffer())];
 }));
}
async function upload(page,bytes,name='four-quadrants.png',mimeType='image/png'){await field(page,'file').setInputFiles({name,mimeType,buffer:bytes});}
async function download(page,info,name){
 const pending=page.waitForEvent('download');await activate(page,'#tool-export');const result=await pending;
 const target=path.join(reports,`phase6-${info.project.name}-${name}-${result.suggestedFilename()}`);await result.saveAs(target);
 return {bytes:fs.readFileSync(target),filename:result.suggestedFilename()};
}
async function decode(page,bytes,mime='image/png'){
 return page.evaluate(async({bytes,mime})=>{
  const bitmap=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:mime})),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
  const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const pick=(x,y)=>[...data.slice((y*canvas.width+x)*4,(y*canvas.width+x)*4+4)];let ink=0,opaque=0;
  for(let at=0;at<data.length;at+=4){if(data[at+3])opaque++;if(data[at+3]&&(data[at]<240||data[at+1]<240||data[at+2]<240))ink++;}
  const point=(x,y)=>pick(Math.floor(canvas.width*x),Math.floor(canvas.height*y));
  return{width:canvas.width,height:canvas.height,red:point(.25,.25),green:point(.75,.25),blue:point(.25,.75),transparent:point(.75,.75),corner:pick(canvas.width-1,canvas.height-1),ink,opaque};
 },{bytes:[...bytes],mime});
}
function magic(bytes,format){
 if(format==='png')expect([...bytes.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);
 if(format==='jpeg')expect([...bytes.subarray(0,3)]).toEqual([255,216,255]);
 if(format==='webp'){expect(bytes.toString('ascii',0,4)).toBe('RIFF');expect(bytes.toString('ascii',8,12)).toBe('WEBP');}
}
async function pdfDetails(bytes){
 const doc=await PDFDocument.load(bytes),page=doc.getPages()[0],resources=page.node.Resources(),xObjects=doc.context.lookup(resources.get(PDFName.of('XObject')));
 const images=xObjects.entries().map(([name,ref])=>{const image=doc.context.lookup(ref);return{name:name.toString(),subtype:image.dict.get(PDFName.of('Subtype')).toString(),width:image.dict.get(PDFName.of('Width')).asNumber(),height:image.dict.get(PDFName.of('Height')).asNumber(),bytes:image.contents.length};});
 const contents=page.node.Contents(),streams=contents.asArray().map(ref=>doc.context.lookup(ref)),drawing=streams.map(stream=>inflateSync(stream.contents).toString('utf8')).join('\n');
 const matrix=Array.from(drawing.matchAll(/([\d.+-]+) ([\d.+-]+) ([\d.+-]+) ([\d.+-]+) ([\d.+-]+) ([\d.+-]+) cm/g),match=>match.slice(1).map(Number));
 const forbidden=[];for(const [ref,object]of doc.context.enumerateIndirectObjects())if(object?.has)for(const key of ['JavaScript','JS','AA','OpenAction'])if(object.has(PDFName.of(key)))forbidden.push(`${ref}:${key}`);
 return{pages:doc.getPageCount(),size:page.getSize(),title:doc.getTitle(),images,matrix,forbidden,imageDraw:/\/Image-[\w-]+ Do/.test(drawing)};
}
for(const tool of tools)test(`Phase 6 ${tool.requirements.join('/')} ${tool.id} actual form exports its real default`,async({page},info)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await enter(page,tool.id);
 for(const descriptor of tool.fields)if(descriptor.type!=='file'){const value=String(descriptor.default??'');if(descriptor.type==='select')await field(page,descriptor.key).selectOption(value);else await field(page,descriptor.key).fill(value);}
 const output=await submit(page);expect(output.length).toBeGreaterThan(0);let decoded;
 if(tool.id==='image-color')expect(output).toBe('#0060ff\nRGBA(0, 96, 255, 255)\nx=0, y=0');
 else if(tool.id==='qr-read')expect(output).toBe('OmniCivitas\nhttps://example.org/');
 else if(tool.id==='blank-pdf'){const file=await download(page,info,`default-${tool.id}`);expect(file.bytes.toString('ascii',0,5)).toBe('%PDF-');decoded=await pdfDetails(file.bytes);expect(decoded.pages).toBe(1);expect(decoded.forbidden).toEqual([]);}
 else{const file=await download(page,info,`default-${tool.id}`),format=tool.id==='image-compress'?'jpeg':'png';magic(file.bytes,format);decoded=await decode(page,file.bytes,format==='jpeg'?'image/jpeg':'image/png');
  const size=output.match(/^(\d+) × (\d+)/);expect(size).not.toBeNull();expect([decoded.width,decoded.height]).toEqual([Number(size[1]),Number(size[2])]);
  if(['image-compress','image-convert'].includes(tool.id))expect([decoded.width,decoded.height]).toEqual([320,200]);
  if(tool.id==='image-resize')expect([decoded.width,decoded.height]).toEqual([160,100]);
  if(tool.id==='qr-generate')expect([decoded.width,decoded.height]).toEqual([384,384]);
  if(tool.id==='image-crop'){expect(decoded.width).toBeLessThan(320);expect(decoded.height).toBeLessThan(200);await expect(page.locator('#tool-lab .cropper-container')).toHaveCount(1);}
 }
 const diagnostic=await page.evaluate(()=>window.__ocvTools);expect(Object.keys(diagnostic).sort()).toEqual(['id','runs','successes','busy','cancelled','lastTool','resultLength'].sort());expect(diagnostic.successes).toBeGreaterThanOrEqual(1);expect(errors).toEqual([]);
 proof(info,`default-${tool.id}`,{id:tool.id,requirements:tool.requirements,diagnostic,outputLength:output.length,decoded,errors});
});
test('Phase 6 three actual image formats preserve dimensions and JPEG explicitly flattens transparent pixels onto white',async({page},info)=>{
 await enter(page,'image-convert');const source=await fixture(page);await upload(page,source);const outputs=[];
 for(const format of ['png','jpeg','webp']){await field(page,'format').selectOption(format);await submit(page);const file=await download(page,info,`image-format-${format}`);magic(file.bytes,format);expect(file.filename).toBe(`ocv-image-convert.${format==='jpeg'?'jpg':format}`);const decoded=await decode(page,file.bytes,`image/${format}`);expect([decoded.width,decoded.height]).toEqual([64,48]);expect(decoded.red[0]).toBeGreaterThan(240);expect(decoded.green[1]).toBeGreaterThan(240);expect(decoded.blue[2]).toBeGreaterThan(240);
  if(format==='jpeg'){expect(decoded.transparent[3]).toBe(255);expect(decoded.transparent.slice(0,3).every(x=>x>245)).toBe(true);}else expect(decoded.transparent[3]).toBe(0);
  outputs.push({format,filename:file.filename,bytes:file.bytes.length,decoded});
 }
 proof(info,'image-formats',{outputs});
});
test('Phase 6 resize dimensions and selected low/high Canvas compression produce actual decodable different files',async({page},info)=>{
 await enter(page,'image-resize');const source=await fixture(page);await upload(page,source);await field(page,'width').fill('17');await field(page,'height').fill('11');await submit(page);const resized=await download(page,info,'image-resized');magic(resized.bytes,'png');const decoded=await decode(page,resized.bytes);expect([decoded.width,decoded.height]).toEqual([17,11]);expect(decoded.transparent[3]).toBe(0);
 await enter(page,'image-compress');await upload(page,source);const files=[];
 for(const quality of ['low','high']){await field(page,'quality').selectOption(quality);await submit(page);const file=await download(page,info,`image-compressed-${quality}`);magic(file.bytes,'jpeg');const result=await decode(page,file.bytes,'image/jpeg');expect([result.width,result.height]).toEqual([64,48]);files.push({quality,bytes:file.bytes});}
 expect(files[0].bytes.equals(files[1].bytes)).toBe(false);proof(info,'image-resize-compression',{resized:decoded,qualities:files.map(file=>({quality:file.quality,bytes:file.bytes.length})),differentBytes:true});
});
test('Phase 6 Cropper receives real pointer drags and exports changed PNG rectangles plus JPEG white pixels',async({page},info)=>{
 await enter(page,'image-crop');await upload(page,await fixture(page));await submit(page);
 const before=await page.locator('#tool-lab img').first().evaluate(node=>node.cropper.getData(false));
 const handle=page.locator('#tool-lab .cropper-point.point-se');await handle.scrollIntoViewIfNeeded();const box=await handle.boundingBox();expect(box).not.toBeNull();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x-28,box.y-18,{steps:8});await page.mouse.up();
 const geometry=await page.locator('#tool-lab img').first().evaluate(node=>{
  const after=node.cropper.getData(false),natural=node.cropper.getCanvasData();
  // Cropper 1.6.2 getCroppedCanvas() uses raw getData(false), not its independently rounded endpoints.
  // Its default contain adjustment preserves the raw aspect; normalizeDecimalNumber removes only
  // trailing floating-point error. The native canvas setters then truncate positive dimensions.
  // https://github.com/fengyuanchen/cropperjs/blob/v1.6.2/src/js/methods.js#L639-L694
  const aspect=after.width/after.height,adjusted=after.height*aspect;
  const width=adjusted>after.width?after.width:adjusted,height=adjusted>after.width?after.width/aspect:after.height;
  const normalize=value=>/\.\d*(?:0|9){12}\d*$/.test(String(value))?Math.round(value*100000000000)/100000000000:value;
  const witness=document.createElement('canvas');witness.width=normalize(width);witness.height=normalize(height);
  return{after,natural,expected:{width:witness.width,height:witness.height}};
 });const {after,expected}=geometry;expect(geometry.natural.naturalWidth).toBe(64);expect(geometry.natural.naturalHeight).toBe(48);expect(after.width).toBeLessThan(before.width);expect(after.height).toBeLessThan(before.height);
 await page.getByRole('button',{name:'导出裁剪',exact:true}).focus();await page.keyboard.press('Enter');await expect.poll(()=>page.locator('#tool-output').inputValue()).toContain(`${expected.width} × ${expected.height}`);
 const png=await download(page,info,'image-drag-crop');magic(png.bytes,'png');const decoded=await decode(page,png.bytes);expect([decoded.width,decoded.height]).toEqual([expected.width,expected.height]);expect(decoded.ink).toBeGreaterThan(0);
 await field(page,'format').selectOption('jpeg');await submit(page);const jpeg=await download(page,info,'image-crop-jpeg');magic(jpeg.bytes,'jpeg');const white=await decode(page,jpeg.bytes,'image/jpeg');expect(white.corner.slice(0,3).every(x=>x>245)).toBe(true);expect(white.corner[3]).toBe(255);
 proof(info,'image-crop',{before,after,expected,decoded,jpeg:white,realPointerDrag:true});
});
test('Phase 6 displayed Canvas pixel clicks read actual coordinates and transparent alpha',async({page},info)=>{
 await enter(page,'image-color');await upload(page,await fixture(page));await submit(page);const canvas=page.locator('#tool-lab canvas');await canvas.scrollIntoViewIfNeeded();let rect=await canvas.boundingBox();
 await canvas.click({position:{x:rect.width*.75,y:rect.height*.25}});
 await expect.poll(()=>page.locator('#tool-output').inputValue()).toContain('#00ff00\nRGBA(0, 255, 0, 255)');const green=await page.locator('#tool-output').inputValue();
 rect=await canvas.boundingBox();await canvas.click({position:{x:rect.width*.75,y:rect.height*.75}});await expect.poll(()=>page.locator('#tool-output').inputValue()).toContain('RGBA(0, 0, 0, 0)');const transparent=await page.locator('#tool-output').inputValue();
 expect(green).toMatch(/x=4[78], y=1[12]/);expect(transparent).toMatch(/x=4[78], y=3[56]/);proof(info,'image-pixels',{green,transparent,realPointerClicks:true});
});
test('Phase 6 text image creates actual visible ink on transparent or dark backgrounds',async({page},info)=>{
 await enter(page,'text-image');await field(page,'source').fill('TT\n文明');await field(page,'size').fill('40');await field(page,'background').selectOption('transparent');await submit(page);const file=await download(page,info,'image-text-transparent');magic(file.bytes,'png');const transparent=await decode(page,file.bytes);expect(transparent.corner[3]).toBe(0);expect(transparent.ink).toBeGreaterThan(100);expect(transparent.opaque).toBeLessThan(transparent.width*transparent.height);
 await field(page,'background').selectOption('dark');await submit(page);const darkFile=await download(page,info,'image-text-dark'),dark=await decode(page,darkFile.bytes);expect(dark.opaque).toBe(dark.width*dark.height);expect(dark.corner).toEqual([16,32,51,255]);proof(info,'image-text',{transparent,dark});
});
test('Phase 6 real QR download reuploads to jsQR with exact Unicode and hostile text without navigation or upload',async({page},info)=>{
 const requests=[];page.on('request',request=>requests.push({url:request.url(),method:request.method(),body:request.postData()}));
 await enter(page,'qr-generate');const source='<img src="https://example.invalid/leak" onerror="window.__qrLeak=1">\n中文🌐 https://example.invalid/go';await field(page,'source').fill(source);await submit(page);const qr=await download(page,info,'image-qr-unicode');magic(qr.bytes,'png');
 await enter(page,'qr-read');await expect(page.getByText('实验性识别服务',{exact:true})).toBeVisible();await upload(page,qr.bytes,'unicode-qr.png');expect(await submit(page)).toBe(source);await expect(page).toHaveURL(/\/functions\/qr-read\/$/);expect(await page.evaluate(()=>window.__qrLeak)).toBeUndefined();expect(await page.locator('#tool-preview img[src^="http"],#tool-table img,#tool-table script').count()).toBe(0);
 expect(requests.every(request=>request.method==='GET'&&!request.body&&new URL(request.url).origin===new URL(page.url()).origin)).toBe(true);const recognizedLength=(await page.locator('#tool-output').inputValue()).length;
 await upload(page,await fixture(page));await submit(page,{error:true});await expect(page.locator('#tool-status')).toContainText('未识别到二维码');proof(info,'image-qr',{unicodeExact:true,hostileTextInert:true,recognizedLength,downloadBytes:qr.bytes.length,unrecognizedRejected:true,externalRequests:requests.filter(request=>new URL(request.url).origin!==new URL(page.url()).origin),posts:requests.filter(request=>request.method!=='GET')});
});
test('Phase 6 image input refuses unsupported SVG, oversized bytes and oversized decoded dimensions locally',async({page},info)=>{
 const requests=[];page.on('request',request=>requests.push({url:request.url(),method:request.method(),body:request.postData()}));await enter(page,'image-convert');
 await upload(page,Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.invalid/leak"/></svg>'),'unsupported.svg','image/svg+xml');await submit(page,{error:true});await expect(page.locator('#tool-status')).toContainText('此格式暂不支持');
 await upload(page,Buffer.alloc(4*1024*1024+1),'oversized.png');await submit(page,{error:true});await expect(page.locator('#tool-status')).toContainText('4 MiB');
 const bomb=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(bomb);bomb.writeUInt32BE(13,8);bomb.write('IHDR',12,'ascii');bomb.writeUInt32BE(4096,16);bomb.writeUInt32BE(4096,20);await upload(page,bomb,'oversized-pixels.png');await submit(page,{error:true});await expect(page.locator('#tool-status')).toContainText('4 MP');await expect(page.locator('#tool-export')).toBeDisabled();
 expect(requests.every(request=>request.method==='GET'&&!request.body&&new URL(request.url).origin===new URL(page.url()).origin)).toBe(true);proof(info,'image-limits',{unsupportedSvg:true,file4MiB:true,headerPixelLimit:true,requests});
});
test('Phase 6 Cropper cancellation destroys its actual widget and a fresh run recovers; PDF is one A4 page with centered nonempty image and no script',async({page},info)=>{
 await enter(page,'image-crop');await submit(page);await expect(page.locator('#tool-lab .cropper-container')).toHaveCount(1);await activate(page,'#tool-cancel');await expect(page.locator('#tool-lab')).toBeEmpty();await expect(page.locator('#tool-export')).toBeDisabled();expect((await page.evaluate(()=>window.__ocvTools)).cancelled).toBe(1);
 await submit(page);await expect(page.locator('#tool-lab .cropper-container')).toHaveCount(1);await expect(page.locator('#tool-export')).toBeEnabled();const recovered=true;
 await enter(page,'blank-pdf');await submit(page);const file=await download(page,info,'image-pdf-centered');expect(file.filename).toBe('ocv-blank-pdf.pdf');expect(file.bytes.toString('ascii',0,5)).toBe('%PDF-');const pdf=await pdfDetails(file.bytes);expect(pdf.pages).toBe(1);expect(pdf.size.width).toBeCloseTo(595.28,2);expect(pdf.size.height).toBeCloseTo(841.89,2);expect(pdf.title).toBe(blankPhrase);expect(pdf.forbidden).toEqual([]);expect(pdf.imageDraw).toBe(true);expect(pdf.images.some(image=>image.subtype==='/Image'&&image.width===520&&image.height===70&&image.bytes>0)).toBe(true);
 const center=pdf.matrix[0];expect(center[4]).toBeCloseTo((pdf.size.width-104)/2,5);expect(center[5]).toBeCloseTo((pdf.size.height-14)/2,5);
 const preview=await page.locator('#tool-preview img').evaluate(async image=>{await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;let ink=0;for(let i=0;i<data.length;i+=4)if(data[i]<230||data[i+1]<230||data[i+2]<230)ink++;return{width:canvas.width,height:canvas.height,ink};});expect(preview.ink).toBeGreaterThan(20);
 proof(info,'image-cancel-pdf',{cropDestroyed:true,recovered,pdf,preview,bytes:file.bytes.length});
});
