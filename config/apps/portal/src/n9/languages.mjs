const chooser=document.querySelector('[data-legal-languages]'),article=document.querySelector('[data-legal-statement]');
if(chooser&&article){
 const buttons=[...chooser.querySelectorAll('[data-legal-language]')],cache=new Map();
 const original=[...article.children].map(node=>({tag:node.tagName.toLowerCase(),text:node.textContent}));cache.set('zh',{code:'zh',dir:'ltr',blocks:original});
 let job=0,request;
 const error=document.querySelector('[data-language-error]');
 async function select(button){
  const code=button.dataset.legalLanguage,current=++job;request?.abort();request=new AbortController();error.textContent='';chooser.setAttribute('aria-busy','true');
  try{
   let data=cache.get(code);
   if(!data){const response=await fetch(`/legal-languages/${code}.json`,{signal:AbortSignal.any([request.signal,AbortSignal.timeout(5000)])});if(!response.ok)throw Error('translation unavailable');data=await response.json();if(data.code!==code||data.sourceSha256!==chooser.dataset.sourceHash||data.blocks.length!==original.length||!data.blocks.every((block,i)=>block.tag===original[i].tag&&typeof block.text==='string'&&block.text.trim()))throw Error('invalid translation');cache.set(code,data);}
   if(current!==job)return;
   const fragment=document.createDocumentFragment();for(const block of data.blocks){const node=document.createElement(block.tag);node.textContent=block.text;fragment.append(node,document.createTextNode('\n'));}
   article.replaceChildren(fragment);article.lang=code;article.dir=data.dir;
   for(const item of buttons)item.setAttribute('aria-pressed',String(item===button));
  }catch(failure){if(current===job&&failure.name!=='AbortError')error.textContent='译文加载失败';}
  finally{if(current===job)chooser.setAttribute('aria-busy','false');}
 }
 for(const button of buttons)button.addEventListener('click',()=>select(button));
 window.addEventListener('pagehide',()=>{job++;request?.abort();chooser.setAttribute('aria-busy','false');});
}
