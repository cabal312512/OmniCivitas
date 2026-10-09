'use client';
import React,{useEffect,useRef,useState} from 'react';
import {configureStore,createSlice} from '@reduxjs/toolkit';
import {Provider,useDispatch,useSelector} from 'react-redux';
import {create} from 'zustand';
import {atom,useAtom,Provider as AtomProvider} from 'jotai';
import {makeAutoObservable,runInAction} from 'mobx';
import {observer} from 'mobx-react-lite';
import {createMachine,createActor} from 'xstate';
import {Slider,ConfigProvider} from 'antd';
import Switch from '@mui/material/Switch';
import styled from 'styled-components';
import emotion from '@emotion/styled';
import {useForm} from 'react-hook-form';
import {Formik,Form,Field} from 'formik';
import * as Yup from 'yup';
import Joi from 'joi';
import axios from 'axios';
import dayjs from 'dayjs';
import {QueryClient,QueryClientProvider,useMutation,useQuery} from '@tanstack/react-query';
import {Piano,midi,localWav} from './audio.mjs';
import {melodyDemos,notationScore} from './melodies.mjs';
import {processTake,processedFile,type Receipt} from './return';
import styles from './stage.module.scss';
import './studio.css';
type Note={n:number;t:number;d:number;v:number};
const take=createSlice({name:'take',initialState:{notes:[] as Note[]},reducers:{replace:(s,a)=>{s.notes=a.payload.slice(0,256)},append:(s,a)=>{if(s.notes.length<256)s.notes.push(a.payload)},clear:s=>{s.notes=[]}}});
const transport=create<{volume:number;tempo:number;echo:boolean;set:(p:object)=>void}>(set=>({volume:.65,tempo:108,echo:true,set:p=>set(p)}));
const litKeys=atom<number[]>([]),bandsAtom=atom<number[]>(Array(12).fill(0));
const Deck=styled.div`display:flex;position:relative;min-width:620px;width:100%;height:158px;gap:2px;border:1px solid #9dbce7;`;
const Readout=emotion.div<{phase:string}>(({phase})=>({color:phase==='ready'?'#164dff':'#527295',borderLeft:'2px solid currentColor',paddingLeft:12,textShadow:'0 0 16px currentColor'}));
const schema=Yup.object({octave:Yup.number().min(-1).max(1).required(),color:Yup.string().matches(/^#[a-f0-9]{6}$/i).required()});
const keyboard=['a','w','s','e','d','f','t','g','y','h','u','j','k','o','l','p',';'];
const machine=createMachine({id:'console',initial:'idle',states:{idle:{on:{RECORD:'recording',SAVE:'saving',PLAY:'playing'}},recording:{on:{STOP:'idle'}},playing:{on:{STOP:'idle',SAVE:'saving',PLAY:'playing'}},saving:{on:{DONE:'idle',FAIL:'idle'}}}});
function download(bytes:BlobPart,type:string,name:string){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
const Ledger=observer(({model}:{model:any})=><Readout phase={model.phase}><b>{model.phase==='ready'?'已存档':model.phase==='local'?'本地':model.phase}</b><small>{model.received} / {model.channel}</small><span>{model.time}</span></Readout>);
function Console(){
 const dispatch=useDispatch(),notes=useSelector((s:any)=>s.take.notes) as Note[],t=transport(),[lit,setLit]=useAtom(litKeys),[bands,setBands]=useAtom(bandsAtom);
 const [session,setSession]=useState(''),[mode,setMode]=useState('idle'),[message,setMessage]=useState(''),[octave,setOctave]=useState(0),[recording,setRecording]=useState(false),[socketState,setSocketState]=useState(false),[wire,setWire]=useState(0),[jobUntil,setJobUntil]=useState(0),[melody,setMelody]=useState<string>(melodyDemos[0].id);
 const piano=useRef<any>(null),actor=useRef<any>(null),started=useRef(0),wanted=useRef(new Set<number>()),held=useRef(new Map<number,number>()),recordRef=useRef(false),playEnd=useRef<any>(null),controller=useRef<AbortController|null>(null);
 const [ledger]=useState(()=>makeAutoObservable({phase:'local',received:0,channel:'—',time:'',update(p:any,channel:string){this.phase=p.phase;this.channel=channel;this.received++;this.time=dayjs().format('HH:mm:ss.SSS')}}));
 const [rendering,setRendering]=useState(false),[renderState,setRenderState]=useState(''),[rendered,setRendered]=useState<Receipt|null>(null),[tone,setTone]=useState('bell'),[effect,setEffect]=useState(false),[filter,setFilter]=useState(false),[part,setPart]=useState('all');
 const renderLife=useRef<AbortController|null>(null),renderIdentity=useRef('');
 const played=useRef<{key:string;data:any}|null>(null);
 useEffect(()=>()=>{renderLife.current?.abort()},[]);
 const form=useForm({defaultValues:{notation:'1 2 3 1 | 1 2 3 1 | 3 4 5 - | 3 4 5 -'}});
 const catalog=useQuery({queryKey:['rooms'],queryFn:()=>axios.get('/api/q8/slots',{timeout:4500}).then(r=>r.data),retry:false,staleTime:60000});
 const save=useMutation({mutationFn:async(events:Note[])=>axios.post('/api/q8/music',{session,tempo:t.tempo,events},{timeout:7500,signal:controller.current?.signal}).then(r=>r.data),onSuccess:data=>{setJobUntil(Date.now()+180000);runInAction(()=>ledger.update({phase:'ready'},'REST'));setBands(data.bands);actor.current.send({type:'DONE'});setMessage('已存档');},onError:()=>{actor.current.send({type:'FAIL'});runInAction(()=>ledger.update({phase:'local'},'—'));setMessage('后台未连接；录音仍在本地');}});
 const optional=useQuery({queryKey:['music-job',save.data?.job?.id],enabled:!!save.data?.job?.id,queryFn:()=>axios.post('/api/a2/job.cgi/'+save.data.job.id,{ticket:save.data.ticket},{timeout:4500,signal:controller.current?.signal}).then(r=>r.data),retry:false,refetchInterval:q=>Date.now()<jobUntil&&!['done','failed'].includes((q.state.data as any)?.state)&&q.state.status!=='error'?2500:false});
 useEffect(()=>{if(window.parent!==window)window.parent.postMessage({v:1,type:'ocv-music-panel',notes:notes.length,phase:ledger.phase},location.origin);},[notes.length,ledger.phase]);
 useEffect(()=>{if(!save.data?.job?.id||!save.data.ticket)return;const publish=()=>window.parent.postMessage({type:'OCV_SHARED_CONTEXT',domain:'music',job:{id:save.data.job.id,ticket:save.data.ticket}},location.origin);publish();const receive=(e:MessageEvent)=>{if(e.origin===location.origin&&e.source===parent&&e.data?.type==='OCV_SHARED_MEASURE')publish()};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive)},[save.data]);
 useEffect(()=>{if(optional.data){events({phase:optional.data.state},'WORKER');}},[optional.data]);
 const events=(p:any,channel:string)=>{runInAction(()=>ledger.update(p,channel));if(Array.isArray(p.bands))setBands(p.bands);};
 useEffect(()=>{
  piano.current=new Piano();controller.current=new AbortController();actor.current=createActor(machine);const sub=actor.current.subscribe((s:any)=>setMode(String(s.value)));actor.current.start();
  let id=crypto.randomUUID();try{const old=localStorage.getItem('ocv.studio.session');if(old&&/^[a-f0-9-]{36}$/.test(old))id=old;else localStorage.setItem('ocv.studio.session',id);const previous=JSON.parse(localStorage.getItem('ocv.studio.take')||'null');if(Array.isArray(previous)&&previous.length<=256&&previous.every((n:any)=>Number.isInteger(n.n)&&n.n>=48&&n.n<=96&&Number.isInteger(n.t)&&n.t>=0&&n.t<=600000&&Number.isInteger(n.d)&&n.d>=40&&n.d<=4000&&n.v>=.05&&n.v<=1))dispatch(take.actions.replace(previous));}catch{}
  setSession(id);
  const quiet=()=>{if(document.hidden){for(const n of held.current.keys())release(n);wanted.current.clear();piano.current?.stop();held.current.clear();recordRef.current=false;setRecording(false);actor.current.send({type:'STOP'});setLit([]);}};document.addEventListener('visibilitychange',quiet);
  return()=>{controller.current?.abort();document.removeEventListener('visibilitychange',quiet);clearTimeout(playEnd.current);sub.unsubscribe();actor.current.stop();piano.current.close();};
 },[]);
 useEffect(()=>{if(!session)return;const id=session;  const source=new EventSource('/api/q8/events/'+id);source.onmessage=e=>{try{events(JSON.parse(e.data),'SSE');}catch{}};source.onerror=()=>source.close();
  const ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/api/enterprise-ws.cgi');ws.onopen=()=>{setSocketState(true);ws.send(JSON.stringify({topic:'q8',session:id}));};ws.onmessage=e=>{try{events(JSON.parse(e.data),'WS');}catch{}};ws.onclose=()=>setSocketState(false);
return()=>{source.close();ws.close();};},[session,wire]);
 useEffect(()=>{piano.current?.level(t.volume);},[t.volume]);
 useEffect(()=>{try{localStorage.setItem('ocv.studio.take',JSON.stringify(notes));}catch{}if(notes.length>=256){recordRef.current=false;setRecording(false);actor.current?.send({type:'STOP'});setMessage('256 个音符；本段已结束');}},[notes]);
 async function press(n:number){if(mode==='saving')return;wanted.current.add(n);if(recordRef.current&&!held.current.has(n))held.current.set(n,performance.now());try{await piano.current.open();if(!wanted.current.has(n))return;piano.current.press(n);setLit(keys=>keys.includes(n)?keys:keys.concat(n));}catch{wanted.current.delete(n);setMessage('浏览器未允许音频');}}
 function release(n:number){wanted.current.delete(n);piano.current.release(n);setLit(keys=>keys.filter(k=>k!==n));const start=held.current.get(n);if(start!==undefined){held.current.delete(n);if(recordRef.current)dispatch(take.actions.append({n,t:Math.max(0,Math.min(600000,Math.round(start-started.current))),d:Math.max(40,Math.min(4000,Math.round(performance.now()-start))),v:.68}));}}
 useEffect(()=>{const down=(e:KeyboardEvent)=>{if(e.repeat||e.target instanceof HTMLElement&&e.target.closest('input,textarea,select,[contenteditable]'))return;const index=keyboard.indexOf(e.key.toLowerCase());if(index>=0){e.preventDefault();void press(60+index+octave*12);}};const up=(e:KeyboardEvent)=>{const index=keyboard.indexOf(e.key.toLowerCase());if(index>=0)release(60+index+octave*12);};window.addEventListener('keydown',down);window.addEventListener('keyup',up);return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);};},[mode,octave]);
 async function toggleRecord(){await piano.current.open();if(recordRef.current){for(const n of held.current.keys())release(n);recordRef.current=false;setRecording(false);actor.current.send({type:'STOP'});}else{wanted.current.clear();held.current.clear();piano.current.stop();dispatch(take.actions.clear());started.current=performance.now();recordRef.current=true;setRecording(true);actor.current.send({type:'RECORD'});}}
 async function play(score=notes){if(!score.length)return;recordRef.current=false;setRecording(false);held.current.clear();await piano.current.open();actor.current.send({type:'PLAY'});piano.current.sequence(score,(n:number,on:boolean)=>setLit(keys=>on?[...new Set(keys.concat(n))]:keys.filter(k=>k!==n)));void playbackReceipt(score);clearTimeout(playEnd.current);playEnd.current=setTimeout(()=>{actor.current.send({type:'STOP'});setLit([]);},Math.max(...score.map(e=>e.t+e.d))+400);}
 async function playbackReceipt(score:Note[]){
  if(!session||controller.current?.signal.aborted)return;const tempo=transport.getState().tempo,events=score.map(n=>({...n})),key=JSON.stringify({events,tempo});
  try{const data=await axios.post('/api/q8/music',{session,tempo,events},{timeout:7500,signal:controller.current?.signal}).then(r=>r.data);played.current={key,data};runInAction(()=>ledger.update({phase:'ready'},'REST'));if(Array.isArray(data.bands))setBands(data.bands);}
  catch{runInAction(()=>ledger.update({phase:'local'},'—'));}
 }
 function stop(){for(const n of held.current.keys())release(n);recordRef.current=false;setRecording(false);wanted.current.clear();piano.current.stop();setLit([]);clearTimeout(playEnd.current);actor.current.send({type:'STOP'});}
 const submit=form.handleSubmit(async values=>{try{const validation=Joi.string().max(1200).pattern(/^[0-7#b_',.\s|\-]+$/).validate(values.notation);if(validation.error)throw Error('检查简谱字符');const score=notationScore(values.notation,t.tempo);if(!score.length)throw Error('没有音符');stop();dispatch(take.actions.replace(score));await play(score);setMessage('');}catch(error:any){setMessage(error.message);}});
 async function loadMelody(perform=false){if(mode==='saving'||save.isPending)return;try{const demo=melodyDemos.find(value=>value.id===melody);if(!demo)return;const score:Note[]=notationScore(demo.notation,demo.tempo);if(!score.length||score.length>64||score.some((note,index)=>note.n<48||note.n>84||note.d<40||note.d>4000||index>0&&note.t<score[index-1].t+score[index-1].d))throw Error('示范曲无法载入');stop();form.setValue('notation',demo.notation,{shouldDirty:true,shouldTouch:true});t.set({tempo:demo.tempo});dispatch(take.actions.replace(score));setMessage('');if(perform)await play(score);}catch(error:any){setMessage(error.message);}}
 async function archive(){stop();if(!notes.length){setMessage('先弹一点');return null;}actor.current.send({type:'SAVE'});return save.mutateAsync(notes).catch(()=>null);}
 async function wav(){stop();if(!notes.length)return;let data=save.data;if(!data||JSON.stringify(data.events)!==JSON.stringify([...notes].sort((a,b)=>a.t-b.t||a.n-b.n)))data=await archive();try{if(!data)throw Error();const r=await axios.post('/api/q8/export',{session,id:data.id},{responseType:'blob',timeout:10000,signal:controller.current?.signal});download(r.data,'audio/wav','session.wav');setMessage('WAV 已导出');}catch{download(await localWav(notes),'audio/wav','session-local.wav');setMessage('本地 WAV 已导出');}}
 const identity=JSON.stringify({notes,tone,effect,filter,part,tempo:t.tempo});
 async function renderTake(){
  if(rendering||!notes.length||!session)return;stop();renderLife.current?.abort();const life=new AbortController();renderLife.current=life;renderIdentity.current=identity;setRendering(true);setRendered(null);setRenderState('等待');
  try{
   const snapshot=notes.filter(n=>part==='all'||(part==='high'?n.n>=72:n.n<72)).map(n=>({...n}));
   if(!snapshot.length)throw Error('当前声部没有音符');if(snapshot.some(n=>n.t+n.d>18000))throw Error('处理片段限18秒；本地演奏保留');
   const key=JSON.stringify({events:snapshot,tempo:t.tempo}),score=played.current?.key===key?played.current.data:await axios.post('/api/q8/music',{session,tempo:t.tempo,events:snapshot},{timeout:7500,signal:life.signal}).then(r=>r.data);
   const receipt=await processTake({kind:'music',session,score:score.id,preset:tone,sampleRate:22050,gain:.8,normalize:true,lowpassHz:filter?2200:0,echo:{delayMs:180,feedback:.25,mix:effect?.3:0,repeats:3}},life.signal,state=>setRenderState(state==='queued'?'等待':state==='done'?'完成':'处理中'));
   if(!life.signal.aborted){setRendered(receipt);setRenderState('完成');}
  }catch(error:any){if(!life.signal.aborted)setRenderState(error.message||'未完成');}finally{if(renderLife.current===life)setRendering(false)}
 }
 const validRender=rendered&&identity===renderIdentity.current;
 const whites=Array.from({length:15},(_,i)=>60+Math.floor(i/7)*12+[0,2,4,5,7,9,11][i%7]),blacks=Array.from({length:25},(_,i)=>60+i).filter(n=>[1,3,6,8,10].includes(n%12));
 return <main className={styles.stage} data-studio-mode={mode}>
  <div className={styles.grid}/><div className={styles.noise}/><div className={styles.beam} style={{opacity:.25+(ledger.received%5)*.1}}/>
  <header className={styles.nav}><span>演奏</span><span>音量 / 速度</span></header>
  <section className={styles.top}><div><p className="text-blue-700 tracking-widest">A W S E D F T G Y H U J</p></div><div className={styles.signal} data-server-phase={ledger.phase}><svg viewBox="0 0 580 240" aria-hidden="true"><defs><linearGradient id="wave"><stop stopColor="#a8ff49"/><stop offset="1" stopColor="#6183ff"/></linearGradient></defs>{Array.from({length:16},(_,j)=><path key={j} d={'M-40 '+(60+j*7)+' '+Array.from({length:30},(_,i)=>`L${i*24} ${70+j*7+Math.sin(i*.58+j*.36)*(28+(bands[i%12]||0)*.65)}`).join(' ')} fill="none" stroke="url(#wave)" strokeWidth={j===8?2:1} opacity={.12+j*.035}/>)}</svg><Ledger model={ledger}/><div className={styles.radio}><i className={socketState?styles.live:''}/><span>{notes.length.toString().padStart(3,'0')}</span><small>{catalog.data?.slots?.length??'—'}</small><button onClick={()=>setWire(n=>n+1)} aria-label="重新连接">↻</button></div></div></section>
  <section className={styles.mixer}><button className={'btn '+(recording?'btn-danger':'btn-outline-primary')} data-record onClick={toggleRecord}>{recording?'■':'●'} REC</button><button className="btn btn-outline-primary" data-play onClick={()=>play()}>▶</button><button className="btn btn-outline-primary" onClick={stop}>■</button><span className={styles.volume}><Slider min={0} max={100} value={Math.round(t.volume*100)} onChange={v=>t.set({volume:v/100})} tooltip={{open:false}} aria-label="音量"/></span><label className={styles.tempo}>{t.tempo}<input type="range" min="40" max="240" value={t.tempo} onChange={e=>t.set({tempo:+e.target.value})} aria-label="速度"/></label><Switch checked={t.echo} onChange={(_,echo)=>t.set({echo})} slotProps={{input:{'aria-label':'光场'}}}/><button className={styles.archive} data-save onClick={archive} disabled={save.isPending}>↥ 存档</button></section>
  <section className={styles.instrument} data-motion={t.echo}><div className={styles.orbit}/><Deck>{whites.map((n,i)=><button key={n} className={`${styles.white} ${lit.includes(n+octave*12)?styles.pressed:''}`} data-note={n} aria-label={'琴键 '+n} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);void press(n+octave*12);}} onPointerUp={()=>release(n+octave*12)} onPointerCancel={()=>release(n+octave*12)}><span>{['1','2','3','4','5','6','7'][i%7]}{i>6?'·':''}</span><small>{keyboard[n-60]||''}</small></button>)}{blacks.map(n=>{const below=whites.filter(w=>w<n).length;return <button key={n} className={`${styles.black} ${lit.includes(n+octave*12)?styles.pressed:''}`} style={{left:`calc(${below}/15 * 100% - 2.2%)`}} data-note={n} aria-label={'黑键 '+n} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);void press(n+octave*12);}} onPointerUp={()=>release(n+octave*12)} onPointerCancel={()=>release(n+octave*12)}/>;})}</Deck><span className={styles.keyboardMark}>C / {octave+4}</span></section>
  <section className={styles.bottom}><form onSubmit={submit} className={styles.notation}><label htmlFor="notation">简谱 <span>0 休止 · _ 半拍 · ' 高八度 · , 低八度</span></label><textarea id="notation" {...form.register('notation')} spellCheck={false} maxLength={1200}/><div style={{display:'flex',gap:5,alignItems:'center',flexWrap:'wrap',marginTop:5}}><select data-melody-select value={melody} onChange={e=>setMelody(e.target.value)} aria-label="示范曲" style={{height:26,maxWidth:150,border:'1px solid #8caedf',background:'#f5f9ff',color:'#164dff',font:'11px Arial'}}>{melodyDemos.map(demo=><option key={demo.id} value={demo.id}>{demo.name}</option>)}</select><button type="button" data-melody-load disabled={mode==='saving'||save.isPending} onClick={()=>loadMelody()} style={{marginTop:0,padding:'4px 7px'}}>载入</button><button type="button" data-melody-play disabled={mode==='saving'||save.isPending} onClick={()=>loadMelody(true)} style={{marginTop:0,padding:'4px 7px'}}>▶ 示范</button><button type="submit" data-notation-play style={{marginTop:0,padding:'4px 7px',marginLeft:'auto'}}>▶ 演奏</button></div></form><div className={styles.roll}><div className={styles.rollGrid}/>{notes.slice(-128).map((e,i)=><i key={i} style={{left:`${e.t/Math.max(1,...notes.map(n=>n.t+n.d))*100}%`,top:`${(84-e.n)/36*90}%`,width:`${Math.max(.6,e.d/Math.max(1,...notes.map(n=>n.t+n.d))*100)}%`,background:lit.includes(e.n)?'#164dff':'#83a4ef'}}/>)}<div className={styles.export}><button data-wav onClick={wav}>WAV ↓</button><button data-midi onClick={()=>notes.length&&download(midi(notes,t.tempo),'audio/midi','session.mid')}>MIDI ↓</button><button onClick={()=>download(JSON.stringify({tempo:t.tempo,events:notes},null,2),'application/json','session.json')}>JSON ↓</button><button onClick={()=>{stop();dispatch(take.actions.clear());}}>⌫</button></div></div><Formik initialValues={{octave:0,color:'#164dff'}} validationSchema={schema} onSubmit={v=>{stop();setOctave(Number(v.octave));document.documentElement.style.setProperty('--studio-accent',v.color);}}><Form className={styles.patch}><Field as="select" name="octave" aria-label="八度"><option value="-1">C3</option><option value="0">C4</option><option value="1">C5</option></Field><Field name="color" type="color" aria-label="灯光颜色"/><button type="submit">↵</button></Form></Formik></section>
  <section className="take-return" data-processed>
   <select value={tone} onChange={e=>setTone(e.target.value)} aria-label="处理音色"><option value="bell">钟声</option><option value="sine">正弦</option><option value="triangle">三角</option></select>
   <select value={part} onChange={e=>setPart(e.target.value)} aria-label="声部"><option value="all">混音</option><option value="high">高声部</option><option value="low">低声部</option></select>
   <label><input type="checkbox" checked={effect} onChange={e=>setEffect(e.target.checked)}/>回声</label><label><input type="checkbox" checked={filter} onChange={e=>setFilter(e.target.checked)}/>低通</label>
   <button data-render onClick={renderTake} disabled={rendering||!notes.length||save.isPending}>处理</button><output role="status" data-render-state>{renderState}</output>
   <button data-processed-wav disabled={!validRender} onClick={()=>validRender&&processedFile(rendered!,'wav',renderLife.current!.signal).catch(e=>setRenderState(e.message))}>WAV ↓</button>
   <button data-processed-midi disabled={!validRender} onClick={()=>validRender&&processedFile(rendered!,'mid',renderLife.current!.signal).catch(e=>setRenderState(e.message))}>MIDI ↓</button>
   {validRender&&<svg viewBox="0 0 600 70" aria-label="处理后的波形和频谱" data-processed-analysis>{rendered!.result.analysis.waveform.map((p:any,i:number,a:any[])=><line key={i} x1={i/Math.max(1,a.length-1)*300} x2={i/Math.max(1,a.length-1)*300} y1={35-p.max*28} y2={35-p.min*28} stroke="#164dff"/>)}{rendered!.result.analysis.spectrum.slice(0,48).map((p:any,i:number)=><rect key={i} x={318+i*5.5} y={64-Math.min(56,p.amplitude*100)} width="3" height={Math.min(56,p.amplitude*100)} fill="#488de7"/>)}</svg>}
  </section>
  <output className={styles.message} role="status">{message}</output><div className={styles.dangling} aria-hidden="true"><span>◦</span><i/><b>00</b></div>
 </main>;
}
export default function Studio(){const [store]=useState(()=>configureStore({reducer:{take:take.reducer}})),[query]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:false,gcTime:60000}}}));return <Provider store={store}><AtomProvider><QueryClientProvider client={query}><ConfigProvider theme={{token:{colorPrimary:'#164dff',borderRadius:0}}}><Console/></ConfigProvider></QueryClientProvider></AtomProvider></Provider>;}
