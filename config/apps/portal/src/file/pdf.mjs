export const blankPhrase='本页有意接近空白';
export async function makeBlankPdf(pngBytes,signal){
 const {PDFDocument,PageSizes}=await import('pdf-lib');
 signal?.throwIfAborted();
 const doc=await PDFDocument.create();doc.setTitle(blankPhrase);doc.setCreator('OmniCivitas');
 const page=doc.addPage(PageSizes.A4),image=await doc.embedPng(pngBytes);
 const width=104,height=104*image.height/image.width;
 page.drawImage(image,{x:(page.getWidth()-width)/2,y:(page.getHeight()-height)/2,width,height});
 const bytes=await doc.save();signal?.throwIfAborted();return bytes;
}
export const tools=[{id:'blank-pdf',title:'空白 PDF',requirements:['B123'],group:'文件',fields:[],async run(_input,{signal}={}){
 const canvas=document.createElement('canvas');canvas.width=520;canvas.height=70;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('此格式暂不支持');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,520,70);ctx.fillStyle='#24334a';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='24px Arial, sans-serif';ctx.fillText(blankPhrase,260,35);
 const png=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('无法生成图像')),'image/png'));
 const bytes=await makeBlankPdf(new Uint8Array(await png.arrayBuffer()),signal),blob=new Blob([bytes],{type:'application/pdf'});
 return{text:`1 页 · A4\n${blob.size} 字节`,blob,previewBlob:png,extension:'pdf',mime:'application/pdf'};
}}];
