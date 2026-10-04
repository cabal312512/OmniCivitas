import {abort,canvas,dimensions,encodeCanvas,loadImage,pixelAt} from './size.mjs';
const image={key:'file',label:'单张图片（留空用示例）',type:'file',accept:'image/png,image/jpeg,image/webp'};
const formats={key:'format',label:'格式',type:'select',default:'png',options:[{value:'png',label:'PNG'},{value:'jpeg',label:'JPEG'},{value:'webp',label:'WebP'}]};
const number=(key,label,value)=>({key,label,type:'number',default:value});
const select=(key,label,value,options)=>({key,label,type:'select',default:value,options:options.map(([value,label])=>({value,label}))});
function check(context){abort(context);if(context?.lab)context.lab.replaceChildren();}
function lifetime(context,cleanup){let disposed=false;const dispose=()=>{if(disposed)return;disposed=true;context?.signal?.removeEventListener('abort',dispose);cleanup();};context?.signal?.addEventListener('abort',dispose,{once:true});return dispose;}
function labStyle(node){node.style.maxWidth='100%';node.style.height='auto';node.style.display='block';}
function reportError(context,error){if(error?.name!=='AbortError')context?.onStatus?.(error?.message||'未完成',true);}
async function crop(input,context={}){
 check(context);const source=await loadImage(input.file,context),first=await encodeCanvas(source,'png',1,context);
 if(!context.lab)return encodeCanvas(source,input.format||'png',.9,context);
 const {default:Cropper}=await import('cropperjs');abort(context);
 const url=URL.createObjectURL(first.previewBlob),image=document.createElement('img'),holder=document.createElement('div'),button=document.createElement('button');
 image.src=url;image.alt='拖动矩形裁剪区域';labStyle(image);holder.style.height='300px';holder.style.maxWidth='100%';button.type='button';button.textContent='导出裁剪';button.disabled=true;holder.append(image);context.lab.append(holder,button);
 let instance;const dispose=lifetime(context,()=>{instance?.destroy();URL.revokeObjectURL(url);context.lab.replaceChildren();});
 try{await new Promise((resolve,reject)=>{const stop=()=>reject(new DOMException('操作已取消','AbortError'));context.signal?.addEventListener('abort',stop,{once:true});instance=new Cropper(image,{viewMode:1,autoCropArea:.8,zoomable:false,rotatable:false,scalable:false,dragMode:'crop',background:true,checkCrossOrigin:false,checkOrientation:false,ready(){context.signal?.removeEventListener('abort',stop);button.disabled=false;resolve();}});});}catch(error){dispose();throw error;}
 const exported=async()=>{abort(context);const cut=instance.getCroppedCanvas({imageSmoothingEnabled:true});if(!cut)throw Error('裁剪区域尚未生成');return {...await encodeCanvas(cut,input.format||'png',.9,context),dispose};};
 button.addEventListener('click',async()=>{button.disabled=true;try{context.onResult?.(await exported());context.onStatus?.('完成');}catch(error){reportError(context,error);}finally{if(!context.signal?.aborted)button.disabled=false;}},{signal:context.signal});
 try{return await exported();}catch(error){dispose();throw error;}
}
async function color(input,context={}){
 check(context);const node=await loadImage(input.file,context);labStyle(node);node.style.cursor='crosshair';node.setAttribute('aria-label','点击图片取色');node.tabIndex=0;context.lab?.append(node);
 const dispose=lifetime(context,()=>{context.lab?.replaceChildren();node.width=node.height=1;});
 node.addEventListener('click',event=>{try{context.onResult?.({...pixelAt(node,event.clientX,event.clientY,node.getBoundingClientRect()),dispose});}catch(error){reportError(context,error);}},{signal:context.signal});
 const rgba=node.getContext('2d').getImageData(0,0,1,1).data;
 return {...pixelAt(node,0,0,{left:0,top:0,width:node.width,height:node.height}),dispose,text:`${'#'+[...rgba].slice(0,3).map(n=>n.toString(16).padStart(2,'0')).join('')}\nRGBA(${[...rgba].join(', ')})\nx=0, y=0`};
}
export function textSettings(input){
 const text=String(input.source??'OmniCivitas'),size=Number(input.size??32),background=input.background??'white';
 if(text.length>2000||text.split('\n').length>64)throw Error('文字限 2000 字符、64 行');
 if(!Number.isInteger(size)||size<8||size>96)throw Error('字号限 8–96');
 if(!['white','transparent','dark'].includes(background))throw Error('请选择背景');
 return {text,size,background};
}
async function textImage(input,context={}){
 check(context);const {text,size,background}=textSettings(input),lines=text.split('\n'),measure=canvas(1,1).getContext('2d');measure.font=`${size}px sans-serif`;
 const width=Math.max(64,Math.ceil(Math.max(...lines.map(line=>measure.measureText(line).width)))+48),height=Math.max(64,Math.ceil(lines.length*size*1.5)+48);dimensions(width,height);
 const node=canvas(width,height),ctx=node.getContext('2d');if(background!=='transparent'){ctx.fillStyle=background==='dark'?'#102033':'#fff';ctx.fillRect(0,0,width,height);}ctx.fillStyle=background==='dark'?'#dff9ff':'#0060ff';ctx.font=`${size}px sans-serif`;ctx.textBaseline='top';lines.forEach((line,i)=>ctx.fillText(line,24,24+i*size*1.5));
 return encodeCanvas(node,'png',1,context);
}
export function qrSettings(input){
 const source=String(input.source??'OmniCivitas'),size=Number(input.size??384);
 if(!source||new TextEncoder().encode(source).length>1024)throw Error('二维码文字限 1–1024 UTF-8 字节');
 if(!Number.isInteger(size)||size<128||size>1024)throw Error('二维码尺寸限 128–1024');
 return {source,size};
}
async function qrCanvas(input,context){
 const {source,size}=qrSettings(input),{default:QRCode}=await import('qrcode');abort(context);
 const node=canvas(size,size);if(QRCode.create(source,{errorCorrectionLevel:'M'}).modules.size+8>size)throw Error('二维码尺寸太小，请增加边长');await QRCode.toCanvas(node,source,{width:size,margin:4,errorCorrectionLevel:'M',color:{dark:'#001b49',light:'#ffffffff'}});abort(context);return node;
}
async function qrRead(input,context={}){
 check(context);const node=input.file?await loadImage(input.file,context):await qrCanvas({source:'OmniCivitas\nhttps://example.org/',size:384},context),{default:jsQR}=await import('jsqr');abort(context);
 const pixels=node.getContext('2d').getImageData(0,0,node.width,node.height),found=jsQR(pixels.data,node.width,node.height,{inversionAttempts:'attemptBoth'});abort(context);
 if(!found)throw Error('未识别到二维码');
 return {text:found.data,extension:'txt',mime:'text/plain;charset=utf-8',table:[['识别方式','本地 jsQR'],['版本',String(found.version)]]};
}
export const tools=[
 {id:'image-crop',title:'图片裁剪',requirements:['B018'],group:'图片',fields:[image,formats],run:crop},
 {id:'image-compress',title:'图片压缩',requirements:['B019'],group:'图片',fields:[image,select('format','格式','jpeg',[['jpeg','JPEG'],['webp','WebP']]),select('quality','质量','medium',[['low','低'],['medium','中'],['high','高']])],async run(input,context){check(context);const quality={low:.35,medium:.65,high:.9}[input.quality??'medium'];if(!quality)throw Error('请选择质量');const result=await encodeCanvas(await loadImage(input.file,context),input.format??'jpeg',quality,context);return {...result,text:result.text+'\n质量 '+quality+'；不保证每张图片都变小'};}},
 {id:'image-convert',title:'图片格式',requirements:['B020'],group:'图片',fields:[image,formats],async run(input,context){check(context);return encodeCanvas(await loadImage(input.file,context),input.format??'png',.9,context);}},
 {id:'image-resize',title:'图片尺寸',requirements:['B021'],group:'图片',fields:[image,number('width','宽',160),number('height','高',100),formats],async run(input,context){check(context);const source=await loadImage(input.file,context),{width,height}=dimensions(input.width??160,input.height??100),node=canvas(width,height);node.getContext('2d').drawImage(source,0,0,width,height);return encodeCanvas(node,input.format??'png',.9,context);}},
 {id:'image-color',title:'图片取色',requirements:['B022'],group:'图片',fields:[image],run:color},
 {id:'text-image',title:'文字转图片',requirements:['B023'],group:'图片',fields:[{key:'source',label:'文字',type:'textarea',default:'OmniCivitas\n没有下一行'},number('size','字号',32),select('background','背景','white',[['white','白'],['transparent','透明'],['dark','深色']])],run:textImage},
 {id:'qr-generate',title:'二维码',requirements:['B024'],group:'图片',fields:[{key:'source',label:'文字',type:'textarea',default:'OmniCivitas\nhttps://example.org/'},number('size','边长',384)],async run(input,context){check(context);return encodeCanvas(await qrCanvas(input,context),'png',1,context);}},
 {id:'qr-read',title:'二维码读取',requirements:['B025'],group:'图片',note:'实验性识别服务',fields:[image],run:qrRead},
];

function cabal312512(){return 43;}
