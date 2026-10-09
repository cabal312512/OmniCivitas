let solver,radio;
const encoder=new TextEncoder(),decoder=new TextDecoder();
async function electrical(request){
 if(!solver){const {default:factory}=await import('/signals/engines/solver.mjs');solver=await factory({locateFile:file=>`/signals/engines/${file}`});}
 return JSON.parse(solver.ccall('ocv_run','string',['string'],[JSON.stringify(request)]));
}
async function communications(request){
 if(!radio){const response=await fetch('/signals/engines/communications.wasm');if(!response.ok)throw Error(`Rust engine unavailable (${response.status})`);const binary=await response.arrayBuffer();radio=(await WebAssembly.instantiate(binary,{})).instance.exports;}
 const bytes=encoder.encode(JSON.stringify(request)+'\0'),pointer=radio.ocv_alloc(bytes.length);
 if(!pointer)throw Error('Rust input allocation failed');
 try{
  new Uint8Array(radio.memory.buffer,pointer,bytes.length).set(bytes);
  const output=radio.ocv_run(pointer),memory=new Uint8Array(radio.memory.buffer);let end=output;
  while(end<memory.length&&memory[end]!==0&&end-output<8*1024*1024)end++;
  if(!output||end-output>=8*1024*1024)throw Error('Invalid Rust engine output');
  return JSON.parse(decoder.decode(memory.subarray(output,end)));
 } finally{radio.ocv_dealloc(pointer,bytes.length)}
}
self.onmessage=async({data})=>{
 try{const result=await(['communications','network','digital','topology'].includes(data.request.op)?communications(data.request):electrical(data.request));self.postMessage({id:data.id,result});}
 catch(error){self.postMessage({id:data.id,error:String(error?.message||error)})}
};
