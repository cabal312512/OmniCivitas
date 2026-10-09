let exports;
self.onmessage=async({data})=>{const {id,input}=data;let address=0,resultAddress=0;try{
 if(typeof input!=='string')throw Error('需要有效的工程输入');const bytes=new TextEncoder().encode(input);if(bytes.length>262144)throw Error('输入超过大小限制');
 if(!exports){const response=await fetch(new URL('./engines/mechanics.wasm',import.meta.url));if(!response.ok)throw Error('机械计算引擎暂不可用');const module=await WebAssembly.instantiate(await response.arrayBuffer(),{});exports=module.instance.exports;}
 address=exports.ws_alloc(bytes.length);if(!address)throw Error('引擎无法分配输入空间');new Uint8Array(exports.memory.buffer,address,bytes.length).set(bytes);resultAddress=exports.ws_run(address,bytes.length);const length=exports.ws_result_len();if(!resultAddress||!Number.isInteger(length)||length<2||length>4194304)throw Error('引擎结果超过输出限制');const json=new TextDecoder().decode(new Uint8Array(exports.memory.buffer,resultAddress,length)),result=JSON.parse(json);self.postMessage({id,result});
 }catch(error){self.postMessage({id,error:String(error.message||error).slice(0,400)})}finally{if(address)exports?.ws_dealloc(address,new TextEncoder().encode(input).length);if(resultAddress)exports?.ws_free_result()}
};
