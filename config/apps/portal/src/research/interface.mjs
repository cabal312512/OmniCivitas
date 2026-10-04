import {AdsorptionDemo,normalizedKernel,wordProbability,reward,terminalAtoms,probabilityTiles,seededRandom} from './demo-model.mjs';
const tracks=[{src:'/research/audio/mutant-club.mp3',title:'Mutant Club'},{src:'/research/audio/machines-with-feelings.ogg',title:'Machines With Feelings'},{src:'/research/audio/dear-mr-super-computer.ogg',title:'Dear Mr Super Computer'}];
let cleanup=[],generation=0,mountedRoot=null;
const $=selector=>document.querySelector(selector),all=selector=>[...document.querySelectorAll(selector)];
const on=(element,event,handler)=>{if(!element)return;element.addEventListener(event,handler);cleanup.push(()=>element.removeEventListener(event,handler));};
function mountAudio(){
 const audio=$('[data-research-audio]'),button=$('[data-research-sound]'),volume=$('[data-research-volume]');if(!audio||!button)return;
 if(!audio.dataset.initialized){
  const random=crypto.getRandomValues(new Uint32Array(1))[0],track=tracks[random%tracks.length];audio.src=track.src;audio.volume=.24;audio.loop=true;audio.dataset.track=track.title;audio.dataset.initialized='true';audio.dataset.enabled='true';
  const label=()=>{const enabled=audio.dataset.enabled==='true',blocked=audio.dataset.blocked==='true';button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',blocked&&enabled?'Enable background music':enabled?'Turn background music off':'Turn background music on');button.querySelector('[data-sound-label]').textContent=blocked&&enabled?'Enable sound':enabled?'Sound':'Muted';};
  const removeUnlock=()=>{document.removeEventListener('pointerdown',unlock);document.removeEventListener('keydown',unlock);};
  const play=()=>{if(audio.dataset.enabled!=='true')return;audio.play().then(()=>{audio.dataset.blocked='false';removeUnlock();label();}).catch(()=>{audio.dataset.blocked='true';label();document.addEventListener('pointerdown',unlock);document.addEventListener('keydown',unlock);});};
  const unlock=event=>{if(event.target.closest?.('[data-research-sound]'))return;play();};
  button.addEventListener('click',()=>{if(audio.dataset.enabled==='true'&&audio.dataset.blocked!=='true'){audio.dataset.enabled='false';audio.pause();removeUnlock();}else{audio.dataset.enabled='true';play();}label();});
  volume.addEventListener('input',()=>{audio.volume=Number(volume.value)/100;});
  audio.addEventListener('error',()=>{button.querySelector('[data-sound-label]').textContent='Audio unavailable';removeUnlock();});
  label();play();
 }
 const credit=$('[data-research-track]');if(credit)credit.textContent='Selected track / '+audio.dataset.track;
}
function canvasSize(canvas){const box=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,2),width=box.width,height=box.height;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return {ctx,width,height};}
function mountSimulation(){
 const canvas=$('[data-adsorption-canvas]');if(!canvas)return;let demo,running=false,frame=0;const run=$('[data-demo-run]');
 const draw=()=>{const {ctx,width,height}=canvasSize(canvas),state=demo.snapshot(),size=Math.min(width-60,height-55),cell=size/demo.L,ox=(width-size)/2,oy=(height-size)/2;ctx.clearRect(0,0,width,height);
  const glow=ctx.createRadialGradient(width/2,height/2,0,width/2,height/2,size*.7);glow.addColorStop(0,'#122a31');glow.addColorStop(1,'#0a141e');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
  for(let y=0;y<demo.L;y++)for(let x=0;x<demo.L;x++){const value=demo.cells[y*demo.L+x];ctx.fillStyle=value===1?'#8bdcc8':value===2?'#a392dc':'#182936';ctx.fillRect(ox+x*cell+.9,oy+y*cell+.9,cell-1.8,cell-1.8);if(value){ctx.fillStyle=value===1?'#c1f5e244':'#d7bdff44';ctx.fillRect(ox+x*cell+1,oy+y*cell+1,cell-2,1);}}
  for(const [key,value] of Object.entries({coverage:state.coverage.toFixed(4),order:state.order.toFixed(4),cost:state.cost.toFixed(2),attempts:state.attempts.toLocaleString('en-US')}))$(`[data-demo-${key}]`).textContent=value;
  $('[data-demo-status]').textContent=state.jammed?'Geometric jam':state.budgetStopped?'Budget stopped / not jammed':running?'Running':state.attempts?'Paused':'Ready';
  const tape=$('[data-demo-tape]');tape.replaceChildren(...demo.last.map(({a,success})=>{const el=document.createElement('span');el.className=success?'':'failure';el.dataset.direction=String(a);el.title=(a?'V':'H')+' / '+(success?'success':'failure');return el;}));canvas.dataset.attempts=String(state.attempts);canvas.dataset.jammed=String(state.jammed);
 };
 const stop=()=>{running=false;cancelAnimationFrame(frame);run.textContent='Run ↗';};
 const reset=()=>{stop();const policy=$('[data-demo-policy]').value;demo=new AdsorptionDemo({L:Number($('[data-demo-size]').value),boundary:$('[data-demo-boundary]').value,policy,alpha:Number($('[data-demo-alpha]').value)/100,beta:Number($('[data-demo-beta]').value)/100,seed:Number($('[data-demo-seed]').value)||0});
  $('[data-alpha-label]').textContent=policy==='temporal'?'H → V probability':'Flip after success';$('[data-beta-label]').textContent=policy==='temporal'?'V → H probability':'Flip after failure';
  for(const which of ['alpha','beta']){$(`[data-demo-${which}]`).disabled=policy==='iid';$(`[data-${which}-value]`).textContent=demo[which].toFixed(2);}draw();};
 const tick=()=>{if(!running)return;demo.step(80);draw();if(demo.jammed||demo.budgetStopped)stop();else frame=requestAnimationFrame(tick);};
 on(run,'click',()=>{if(running){stop();draw();}else if(!demo.jammed&&!demo.budgetStopped){running=true;run.textContent='Pause';frame=requestAnimationFrame(tick);}});
 on($('[data-demo-step]'),'click',()=>{stop();demo.step(100);draw();});on($('[data-demo-reset]'),'click',reset);
 for(const selector of ['policy','size','boundary','seed'])on($(`[data-demo-${selector}]`),'change',reset);
 for(const which of ['alpha','beta'])on($(`[data-demo-${which}]`),'input',reset);
 on(window,'resize',draw);on(document,'visibilitychange',()=>{if(document.hidden){stop();draw();}});cleanup.push(stop);reset();
}
function mountKernel(){
 const inputs=all('[data-kernel-weight]');if(!inputs.length)return;let kernel;const rng=seededRandom(124731);
 const probability=()=>{const input=$('[data-kernel-query]'),word=input.value.toUpperCase();if(!/^[HV]{0,18}$/.test(word)){$('[data-kernel-probability]').textContent='Use H and V only.';return;}$('[data-kernel-probability]').textContent=kernel?'P = '+wordProbability(kernel,word).toPrecision(7):'No valid row distribution';};
 const sample=()=>{if(!kernel)return;let q=0,word='';for(let i=0;i<18;i++){let r=rng(),chosen=3;const row=[kernel.H[q][0],kernel.H[q][1],kernel.V[q][0],kernel.V[q][1]];for(let j=0;j<4;j++){r-=row[j];if(r<0){chosen=j;break;}}word+=chosen<2?'H':'V';q=chosen%2;}$('[data-kernel-word]').textContent=word;$('[data-kernel-indicator]').setAttribute('cx',q?'470':'230');};
 const update=()=>{try{kernel=normalizedKernel(inputs.map(input=>Number(input.value)));$('[data-kernel-error]').textContent='';$('[data-kernel-sample]').disabled=false;for(const action of ['H','V'])$(`[data-kernel-matrix-${action.toLowerCase()}]`).textContent=`K_${action} =\n[ ${kernel[action][0].map(x=>x.toFixed(3)).join('  ')} ]\n[ ${kernel[action][1].map(x=>x.toFixed(3)).join('  ')} ]`;
  inputs.forEach((input,i)=>$(`[data-kernel-value="${i}"]`).textContent=(i%4<2?kernel.H:kernel.V)[Math.floor(i/4)][i%2].toFixed(3));sample();probability();
 }catch(error){kernel=null;$('[data-kernel-error]').textContent=error.message;$('[data-kernel-sample]').disabled=true;probability();}};
 for(const input of inputs)on(input,'input',update);on($('[data-kernel-query]'),'input',probability);on($('[data-kernel-sample]'),'click',sample);update();
}
function mountTerminal(data){
 const canvas=$('[data-terminal-canvas]');if(!canvas)return;let atoms,tiles,selected;
 const show=atom=>{selected=atom;$('[data-terminal-p]').textContent=atom.probability.numerator+'/'+atom.probability.denominator;$('[data-terminal-mask]').textContent=String(atom.mask);$('[data-terminal-n]').textContent=String(atom.N);$('[data-terminal-h]').textContent=atom.key.split(':')[1];$('[data-terminal-preview]').replaceChildren(...Array.from({length:9},(_,j)=>{const cell=document.createElement('i');cell.className=(atom.mask>>j)&1?'':'empty';return cell;}));};
 const draw=()=>{const {ctx,width,height}=canvasSize(canvas);ctx.clearRect(0,0,width,height);tiles=probabilityTiles(atoms,width-30,height-30).map(tile=>({...tile,x:tile.x+15,y:tile.y+15}));
  for(const tile of tiles){const hue=tile.N===4?160:270;ctx.fillStyle=`hsl(${hue+Number(tile.key.split(':')[1])*7} 36% ${14+tile.p*38}%)`;ctx.fillRect(tile.x+2,tile.y+2,tile.w-4,tile.h-4);ctx.strokeStyle=tile===selected?'#cee8be':'#385654';ctx.strokeRect(tile.x+2,tile.y+2,tile.w-4,tile.h-4);
   if(tile.w>47&&tile.h>52){const cell=Math.min((tile.w-18)/3,(tile.h-28)/3,30),x=tile.x+(tile.w-cell*3)/2,y=tile.y+(tile.h-cell*3)/2-6;for(let i=0;i<9;i++){ctx.fillStyle=(tile.mask>>i)&1?'#a4dfbd':'#122c36';ctx.fillRect(x+(i%3)*cell+1,y+Math.floor(i/3)*cell+1,cell-3,cell-3);}if(tile.w>65&&tile.h>93){ctx.font='9px monospace';ctx.fillStyle='#7aa99e';ctx.textAlign='center';ctx.fillText((tile.p*100).toFixed(2)+'%',tile.x+tile.w/2,tile.y+tile.h-10);}}
  }
 };
 const update=()=>{const index=Number($('[data-terminal-policy]').value);atoms=terminalAtoms(index<0?data.law:data.newLaws[index].law);show(atoms[0]);draw();canvas.dataset.atomCount=String(atoms.length);};
 const select=event=>{const box=canvas.getBoundingClientRect(),x=event.clientX-box.left,y=event.clientY-box.top,tile=tiles.find(tile=>x>=tile.x&&x<=tile.x+tile.w&&y>=tile.y&&y<=tile.y+tile.h);if(tile)show(tile);};
 on($('[data-terminal-policy]'),'change',update);on(canvas,'pointermove',select);on(canvas,'click',select);on(window,'resize',draw);update();
}
function mountSupport(data){
 const mu=$('[data-support-mu]');if(!mu)return;const row=data.dominance.find(row=>row.feedback==='feedback-4-00010'),nu=$('[data-support-nu]');
 const update=()=>{const m=Number(mu.value)/100,n=Number(nu.value)/100,f=reward(row.feedbackMetrics,m,n),components=row.components.map(item=>reward(item.metrics,m,n)),mix=.9*components[0]+.1*components[1],best=Math.max(...components);
  $('[data-support-mu-value]').textContent=m.toFixed(2);$('[data-support-nu-value]').textContent=n.toFixed(2);$('[data-reward-f]').textContent=f.toFixed(6);$('[data-reward-mix]').textContent=mix.toFixed(6);$('[data-reward-best]').textContent=best.toFixed(6);$('[data-support-dominance]').textContent=`Best single temporal witness − feedback = +${(best-f).toFixed(8)}`;
 };on(mu,'input',update);on(nu,'input',update);update();
}
function mountPrefix(data){
 const canvas=$('[data-prefix-canvas]');if(!canvas)return;const map=new Map(data.prefix.map(row=>[row.id,row]));let points=[];const word=row=>row.parent<0?'H':word(map.get(row.parent))+row.action;
 const show=row=>{$('[data-prefix-word]').textContent=word(row).replaceAll('0','H').replaceAll('1','V');$('[data-prefix-upper]').textContent=row.upper.toFixed(10);$('[data-prefix-status]').textContent=row.status;};
 const draw=()=>{const {ctx,width,height}=canvasSize(canvas),depth=Number($('[data-prefix-depth]').value);ctx.clearRect(0,0,width,height);$('[data-prefix-depth-value]').textContent=String(depth);points=data.prefix.filter(row=>row.depth<=depth).map(row=>{const binary=word(row).slice(1),n=parseInt(binary||'0',2);return {...row,x:24+(n+.5)/2**binary.length*(width-48),y:35+(row.depth-1)/(depth-1)*(height-80)};});const positions=new Map(points.map(row=>[row.id,row]));
  for(const row of points){if(row.parent>=0){const parent=positions.get(row.parent);ctx.beginPath();ctx.moveTo(parent.x,parent.y);ctx.bezierCurveTo(parent.x,parent.y+25,row.x,row.y-25,row.x,row.y);ctx.strokeStyle=row.status==='pruned'?'#ae598b99':'#67d0b04d';ctx.lineWidth=row.depth<5?1.1:.6;ctx.stroke();}ctx.beginPath();ctx.arc(row.x,row.y,row.depth<5?4:1.8,0,Math.PI*2);ctx.fillStyle=row.status==='pruned'?'#c67fa9':'#a1dcca';ctx.fill();}
  canvas.dataset.visibleNodes=String(points.length);
 };
 const pick=event=>{const box=canvas.getBoundingClientRect(),x=event.clientX-box.left,y=event.clientY-box.top;let closest=null,distance=144;for(const row of points){const d=(row.x-x)**2+(row.y-y)**2;if(d<distance){distance=d;closest=row;}}if(closest)show(closest);};
 on(canvas,'pointermove',pick);on(canvas,'click',pick);on($('[data-prefix-depth]'),'input',draw);on(window,'resize',draw);show(data.prefix[0]);draw();
}
function start(){
 const root=$('.research-main');
 // DOM readiness and Astro's initial page-load can both arrive for this page.
 // Disposing and remounting that same canvas would permanently lose its context.
 if(root&&root===mountedRoot)return;
 mountedRoot=root;
 cleanup.forEach(fn=>fn());cleanup=[];const token=++generation;if(!document.body.classList.contains('research-body'))return;delete document.body.dataset.navigating;mountAudio();
 for(const [kind,attribute,card] of [['library','documentCategory','[data-document-category]'],['atlas','figureCategory','[data-figure-category]']])for(const button of all(`[data-${kind}-filter]`))on(button,'click',()=>{const value=button.dataset[kind+'Filter'];all(`[data-${kind}-filter]`).forEach(item=>item.setAttribute('aria-pressed',String(item===button)));let count=0;all(card).forEach(item=>{item.hidden=value!=='all'&&item.dataset[attribute]!==value;if(!item.hidden)count++;});const output=$('[data-library-count]');if(kind==='library'&&output)output.textContent=count+' documents';});
 for(const button of all('[data-copy-target]'))on(button,'click',async()=>{const text=document.getElementById(button.dataset.copyTarget)?.textContent;if(!text)return;try{await navigator.clipboard.writeText(text);button.textContent='Copied';}catch{button.textContent='Select source to copy';}});
 const dialog=$('[data-research-lightbox]');if(dialog){for(const button of all('[data-lightbox-src]'))on(button,'click',()=>{$('[data-lightbox-name]').textContent=button.dataset.lightboxTitle;$('[data-lightbox-image]').src=button.dataset.lightboxSrc;$('[data-lightbox-image]').alt=button.dataset.lightboxTitle;$('[data-lightbox-description]').textContent=button.dataset.lightboxCaption;$('[data-lightbox-download]').href=button.dataset.lightboxSrc;dialog.showModal();});on($('[data-lightbox-close]'),'click',()=>dialog.close());on(dialog,'click',event=>{if(event.target===dialog)dialog.close();});}
 const input=$('#research-demo-data');if(input){const data=JSON.parse(input.textContent);mountSimulation();mountKernel();mountTerminal(data);mountSupport(data);mountPrefix(data);}
 const background=$('[data-research-background]'),hero=$('[data-research-hero]');import('./visual.mjs').then(({mountVisuals})=>{if(token===generation&&document.body.classList.contains('research-body'))cleanup.push(mountVisuals(background,hero));}).catch(()=>hero?.setAttribute('data-render-mode','fallback'));
}
document.addEventListener('astro:page-load',start);
document.addEventListener('astro:before-preparation',()=>{document.body.dataset.navigating='true';});
document.addEventListener('astro:before-swap',()=>{mountedRoot=null;generation++;cleanup.forEach(fn=>fn());cleanup=[];});
if(!document.documentElement.dataset.researchScript){document.documentElement.dataset.researchScript='true';if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();}
