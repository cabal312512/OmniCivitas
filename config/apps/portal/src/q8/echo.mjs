import { huntState, creatures } from './hunt.mjs';
import { snapshot } from '../q9/state.mjs';
import { withNickname } from '../q9/voice.mjs';
import { projectEvents, dialogueMessage } from '../site1/projection.mjs';
import { playInteractionSound } from '../q7/interaction-sound.mjs';
import { createResidentBubbles } from './resident-bubbles.mjs';

const host=document.querySelector('[data-q8-resident]'),actor=host?.querySelector('[data-echo-greet]');
if(host&&actor){
 const life=new AbortController(),bubbles=createResidentBubbles(host),actions=['pulse','shear','phase','resonate'];
 const cabal312512Questions=[
  '谁在观察这个观察者？','Can an echo remember its first sound?','見えないものも、存在する？',
  'ERR: observer has no origin.','░▒▓ ACK: null receiver ▓▒░','Vek-narum; thol; ara-keth.',
  'Le vide peut-il garder un souvenir ?','Πού τελειώνει η σκέψη;','裂缝里面，又裂开了一层。',
  '¿A quién pertenece el límite?','Does a cut create one boundary or two?','被分开的记忆，还属于同一个存在吗？',
  'Thren-olum / vek / nil-kai.','Τι μένει όταν χαθεί το όνομα;','時間が止まっても、問いは続く？',
  '기억이 사라지면, 같은 존재인가?','Может ли тишина быть ответом?','░▒ time[-1] = ∅ ▒░',
  '若答案先于问题，谁在等待？','Zhur-an; vel ekhra; tor-em.','If a moment returns, is it the same moment?',
 ];
 let disposed=false,turn=0,hoverTurn=0,generation=0,lastClick=-Infinity,lastHover=-Infinity,pending=null,queued=null;
 const unlocked=()=>{const state=huntState();return state.count===30||state.residentPreview;};
 const awake=()=>!disposed&&!host.hidden&&document.visibilityState==='visible';
 function line(text){if(!awake())return;const message=withNickname(String(text).slice(0,220));bubbles.show(message);document.dispatchEvent(new CustomEvent('q8:speech',{detail:{text:message,actor}}));}
 function paint(){const available=unlocked();host.hidden=!available;actor.hidden=!available;actor.disabled=!available;if(!available)bubbles.hide();creatures.refresh();}
 async function backend(token){
  if(!awake()||huntState().count!==30)return;
  if(pending){queued=token;return;}
  const abort=new AbortController();pending=abort;
  actor.setAttribute('aria-busy','true');
  try{
   const state=huntState(),profileSession=snapshot().session;
   const response=await fetch('/api/q8/talk',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',body:JSON.stringify({session:state.session,text:'你好',profileSession}),signal:AbortSignal.any([abort.signal,life.signal,AbortSignal.timeout(5500)])});
   if(!response.ok)throw Error('Remote silence');
   const answer=await response.json();
   if(typeof answer.reply!=='string'||answer.reply.length>320)throw Error('Invalid echo');
   if(token===generation&&awake())line(answer.reply);
   if(answer.storage==='postgresql'&&!abort.signal.aborted){
    void projectEvents([{kind:'talk',data:{message:dialogueMessage('你好')}}],{session:state.session,profileSession,signal:life.signal}).then(result=>{
     if(token===generation&&awake()&&typeof result?.dialogue?.reply==='string'&&result.dialogue.reply.length<=320)line(result.dialogue.reply);
    });
   }
  }catch{if(token===generation&&awake()&&!abort.signal.aborted)line('ERR: remote silence / 沉默也算回答吗？');}
  finally{
   pending=null;actor.removeAttribute('aria-busy');
   const next=queued;queued=null;if(next!==null&&awake())void backend(next);
  }
 }
 actor.addEventListener('click',()=>{
  const now=performance.now();
  if(!awake()||!unlocked()||host.dataset.residentDragging==='true'||now-lastClick<100)return;
  lastClick=now;const action=actions[turn%actions.length];
  creatures.perform(actor,action,{force:true,duration:1800});
  playInteractionSound('eye-'+action,{form:'assembly'});
  line(cabal312512Questions[turn++%cabal312512Questions.length]);
  actor.dataset.residentBurst=String(++generation);
  if(huntState().count===30)void backend(generation);
 },{signal:life.signal});
 actor.addEventListener('pointerenter',()=>{
  const now=performance.now();if(!awake()||host.dataset.residentDragging==='true'||now-lastHover<1600)return;lastHover=now;
  creatures.perform(actor,'resonate',{force:true,duration:1500});
  line(cabal312512Questions[(hoverTurn++*5+3)%cabal312512Questions.length]);
 },{signal:life.signal});
 document.addEventListener('q8:progress',paint,{signal:life.signal});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){bubbles.hide();queued=null;generation++;pending?.abort();}},{signal:life.signal});
 window.addEventListener('pagehide',event=>{
  generation++;queued=null;pending?.abort();bubbles.hide();
  if(!event.persisted){disposed=true;life.abort();bubbles.dispose();}
 },{signal:life.signal});
 window.addEventListener('pageshow',paint,{signal:life.signal});
 window.__ocvResidentEcho={snapshot:()=>({disposed,pending:!!pending,queued:queued!==null,turn,generation,unlocked:unlocked(),bubble:bubbles.snapshot()})};
 paint();
}

