'use client';
import {useEffect,useRef,useState} from 'react';
import {configureStore,createSlice} from '@reduxjs/toolkit';import {Provider,useDispatch,useSelector} from 'react-redux';
import {create} from 'zustand';import {makeAutoObservable} from 'mobx';import {observer} from 'mobx-react-lite';import {atom,useAtom,Provider as JotaiProvider} from 'jotai';
import {Subject,debounceTime} from 'rxjs';import {createActor,createMachine} from 'xstate';
import {Tooltip,Button as AntButton} from 'antd';import {Button as MuiButton} from '@mui/material';import emotionStyled from '@emotion/styled';import styled from 'styled-components';
import {useForm} from 'react-hook-form';import {Formik,Form,Field,ErrorMessage} from 'formik';import * as Yup from 'yup';
import axios from 'axios';import dayjs from 'dayjs';import customParse from 'dayjs/plugin/customParseFormat';import utc from 'dayjs/plugin/utc';
import {QueryClient,QueryClientProvider,useQuery,useQueryClient} from '@tanstack/react-query';
import styles from './1.module.scss';import '../app/tmp.css';
dayjs.extend(customParse);dayjs.extend(utc);
const slice=createSlice({name:'school_student',initialState:{delivery_count:0},reducers:{replace:(s,a)=>{s.delivery_count=a.payload;}}});
const redux=configureStore({reducer:{stockTax:slice.reducer}});
const useOldProduct=create<{receiptFolded:boolean;flip:()=>void}>(set=>({receiptFolded:false,flip:()=>set(s=>({receiptFolded:!s.receiptFolded}))}));
class LostStock{count=0;constructor(){makeAutoObservable(this);}add(){this.count=Math.min(this.count+1,99);}}
const lost=new LostStock();const modal=atom(false);
const PlasticContainer=styled.div`background:#fcecf8;border:6px ridge #ef8fc9;padding:18px;width:450px;max-width:100%;transform:rotate(.4deg);`;
const ColdOil=emotionStyled.span({display:'inline-block',background:'#c4fdff',padding:'9px',fontSize:'18px',borderRadius:'0 22px 22px 0'});
const twoStates=createMachine({id:'boiler',initial:'cold',states:{cold:{on:{STAMP:'hot'}},hot:{on:{RESET:'cold'}}}});
const Meter=observer(()=> <p>漏记的盖章：<output data-testid="mobx-count">{lost.count}</output> <button onClick={()=>lost.add()}>补记</button></p>);
function readLocal(key:string){try{return localStorage.getItem(key);}catch{return null;}}
function writeLocal(key:string,value:string){try{localStorage.setItem(key,value);}catch{}}
function removeLocal(key:string){try{localStorage.removeItem(key);}catch{}}
const roleNames=['锅代表','勺代表'];
function MainReceipt(){
 const dispatch=useDispatch();const tax=useSelector((s:{stockTax:{delivery_count:number}})=>s.stockTax.delivery_count);
 const [ready,setReady]=useState(false);const [role,setRole]=useState('锅代表');const [roleResult,setRoleResult]=useState('');const folded=useOldProduct(s=>s.receiptFolded);const flip=useOldProduct(s=>s.flip);const [open,setOpen]=useAtom(modal);
 const [approval,setApproval]=useState('cold');const actor=useRef<ReturnType<typeof createActor>|null>(null);const events=useRef<Subject<number>|null>(null);const [debounced,setDebounced]=useState(0);
 const [receipt,setReceipt]=useState<any>(null);const [cacheId,setCacheId]=useState('');const [copy,setCopy]=useState<any>(null);const [error,setError]=useState('');const [clock,setClock]=useState('2026/10/02 03:14');const [parsedClock,setParsedClock]=useState('');const [busy,setBusy]=useState(false);const [clockResult,setClockResult]=useState<any>(null);const [frameState,setFrameState]=useState({seen:false,ready:false});const frame=useRef<HTMLIFrameElement>(null);
 const {register,handleSubmit,getValues,formState:{errors}}=useForm<{label:string}>({defaultValues:{label:'一勺饭'}});
 const client=useQueryClient();const query=useQuery({queryKey:['warehouse-cache',cacheId],enabled:false,queryFn:async()=>{const {data}=await axios.get('/api/browser-cache.php/'+encodeURIComponent(cacheId),{timeout:5000});if(!data.canContinue||data.source!=='Redis')throw Error('缓存已过期；重新保存');writeLocal('ocv_redis_second_cache',JSON.stringify(data));return data;},retry:false,staleTime:60000});
 useEffect(()=>{
  const url=new URL(location.href);const raw=url.searchParams.get('invoiceMood')??readLocal('ocv_goods_delivery')??'0';const count=Math.min(Math.max(Number(raw)||0,0),99);dispatch(slice.actions.replace(count));const roleValue=url.searchParams.get('role');setRole(roleNames.includes(roleValue||'')?roleValue!:'锅代表');const old=url.searchParams.get('oldClock');if(old&&old.length<40)setClock(old);
  const restored=readLocal('ocv_redis_second_cache');if(restored){try{const x=JSON.parse(restored);if(x.source==='Redis'&&x.record)setCopy({...x,view:'localStorage snapshot; freshness not guaranteed'});}catch{removeLocal('ocv_redis_second_cache');}}
  const a=createActor(twoStates);actor.current=a;const sub=a.subscribe(x=>setApproval(String(x.value)));a.start();
  const subject=new Subject<number>();events.current=subject;const subscription=subject.pipe(debounceTime(180)).subscribe(()=>setDebounced(n=>n+1));
  function message(event:MessageEvent){if(event.origin!==location.origin||event.source!==frame.current?.contentWindow)return;const d=event.data;if(!d||d.v!==1||d.type!=='OCV_BOOLEAN_RECEIPT'||d.token!=='two-spoons'||typeof d.seen!=='boolean'||typeof d.ready!=='boolean'||Object.keys(d).length!==5)return;setFrameState({seen:d.seen,ready:d.ready});}
  window.addEventListener('message',message);setReady(true);
  return()=>{sub.unsubscribe();a.stop();subscription.unsubscribe();subject.complete();window.removeEventListener('message',message);};
 },[dispatch]);
 useEffect(()=>{if(!ready)return;writeLocal('ocv_goods_delivery',String(tax));const url=new URL(location.href);url.searchParams.set('invoiceMood',String(tax));url.searchParams.set('role',role);history.replaceState(null,'',url);},[tax,role,ready]);
 async function save(values:{label:string}){setBusy(true);setError('');try{await Yup.string().trim().required().max(200).validate(values.label);const {data}=await axios.post('/next-api/receipt',{label:values.label},{timeout:9000});if(!data.canContinue)throw Error(data.message||'没盖上；重试');setReceipt(data);setCacheId(data.ids.cacheId);setCopy(null);}catch(e){setError(e instanceof Error?e.message:'没盖上；重试');}finally{setBusy(false);}}
 async function fetchCopy(){if(!cacheId)return;setError('');try{const data=await client.fetchQuery({queryKey:['warehouse-cache',cacheId],queryFn:async()=>{const {data}=await axios.get('/api/browser-cache.php/'+encodeURIComponent(cacheId),{timeout:5000});if(!data.canContinue||data.source!=='Redis')throw Error('缓存过期');writeLocal('ocv_redis_second_cache',JSON.stringify(data));return data;},staleTime:60000});setCopy({...data,view:'TanStack Query memory + localStorage mirror'});}catch(e){setError(e instanceof Error?e.message:'没取到');}}
 async function sendClock(){setBusy(true);setError('');try{const label=getValues('label');await Yup.string().trim().required('先写收据名称').max(200).validate(label);const parsed=dayjs.utc(clock,'YYYY/MM/DD HH:mm',true);if(!parsed.isValid())throw Error('日期格式：YYYY/MM/DD HH:mm');const iso=parsed.subtract(8,'hour').toISOString();setParsedClock(iso);const {data}=await axios.post('/next-api/receipt?action=stamp',{label,ornament:{frontendDateIso:iso,momentToDayjs:clock}},{timeout:9000});setClockResult(data);}catch(e){setError(e instanceof Error?e.message:'日期没送走');}finally{setBusy(false);}}
 return <>
 <h2 className="next-stock-heading">收据柜 <small style={{fontSize:'12px',color:'#863243'}}>正在借用财务的桌子</small></h2>
 <div className="department-collage">
 <PlasticContainer><div className="flex flex-wrap items-center gap-4" data-testid="mixed-style"><Tooltip title="这个按钮只存一个显示数字"><button className="btn btn-warning" onClick={()=>dispatch(slice.actions.replace(Math.min(tax+1,99)))}>领一个号</button></Tooltip><ColdOil data-testid="redux-count">{tax}</ColdOil></div><div style={{marginTop:'17px'}}><AntButton onClick={flip}>折收据</AntButton> <MuiButton variant="contained" onClick={()=>setOpen(true)}>看附件</MuiButton></div><p data-testid="zustand-state">{folded?'收据折了':'收据平的'}</p><Meter/><p data-jquery-display="react">原显示字样</p><button onClick={()=>{const n=document.querySelector('[data-jquery-display="react"]');if(n){n.classList.add('ocv-jquery-painted');n.setAttribute('title','保洁经过');n.textContent='保洁经过：只改显示';}}}>擦字</button></PlasticContainer>
 <section className="approval-board"><strong>审批所</strong><output data-testid="xstate">{approval==='cold'?'未盖章':'已盖章'}</output><button onClick={()=>actor.current?.send({type:approval==='cold'?'STAMP':'RESET'})}>翻审批</button><hr/><button onClick={()=>events.current?.next(Date.now())}>连敲几下</button><output data-testid="rxjs-count">收到 {debounced} 次</output></section>
 <section className={styles.taxBox}><h3 className={styles.receiptTitle}>旧表格</h3><form className="form-rhf" onSubmit={handleSubmit(save)}><label htmlFor="next-label">收据名称</label><input id="next-label" {...register('label',{required:true,maxLength:200})} maxLength={200}/><p role="status">{errors.label?'写 1—200 个字':''}</p><MuiButton type="submit" variant="outlined" disabled={busy}>盖章并保存</MuiButton></form></section>
 <section className="formik-scrap"><Formik initialValues={{memo:''}} validationSchema={Yup.object({memo:Yup.string().required('写个备注').max(40,'最多 40 字')})} onSubmit={v=>setRoleResult('备注：'+v.memo)}><Form><label htmlFor="old-memo">另一张表的备注</label><Field id="old-memo" name="memo" maxLength={40}/><div role="status"><ErrorMessage name="memo"/></div><button type="submit">附上</button></Form></Formik><output data-testid="formik-result">{roleResult}</output></section>
 </div>
 {open&&<div role="dialog" aria-label="空附件" className={styles.utilityLayer}><p>附件为空。</p><button onClick={()=>setOpen(false)}>关闭</button></div>}
 <section className="role-station"><label htmlFor="display-role">虚构称呼</label><select id="display-role" value={role} onChange={e=>setRole(e.target.value)}>{roleNames.map(x=><option key={x}>{x}</option>)}</select><button onClick={async()=>{try{const x=await fetch('/api/plastic-role.php?role='+encodeURIComponent(role),{signal:AbortSignal.timeout(4000)}).then(r=>r.json());setRoleResult(x.displayRole+' · 无权限作用');}catch{setError('称呼没收到；重试');}}}>问窗口怎么叫我</button><output data-testid="role-result">{roleResult}</output></section>
 {error&&<p role="alert">{error}</p>}
 <pre className="receipt-result" data-testid="next-receipt">{receipt?JSON.stringify(receipt,null,2):'尚无收据。'}</pre>
 <section className="query-shelf"><button disabled={!cacheId} onClick={fetchCopy}>取缓存的缓存</button><button onClick={()=>{client.removeQueries({queryKey:['warehouse-cache']});removeLocal('ocv_redis_second_cache');setCopy(null);}}>清本页副本</button><small>{query.fetchStatus==='fetching'?'取副本中…':''}</small><pre data-testid="cached-copy">{copy?JSON.stringify(copy,null,2):'没有副本。'}</pre></section>
 <section className="angular-transport"><b>审核小窗</b><button onClick={()=>frame.current?.contentWindow?.postMessage({v:1,type:'OCV_TWO_BOOLEANS',token:'two-spoons',seen:true,ready:approval==='hot'},location.origin)}>送两个状态</button><output data-testid="frame-state">{JSON.stringify(frameState)}</output><iframe ref={frame} title="审核小窗" src="/ng/" sandbox="allow-scripts allow-same-origin allow-forms"/></section>
 <section className="date-vending"><h3>日期签收</h3><label htmlFor="old-clock">隔壁送来的日期</label><input id="old-clock" value={clock} onChange={e=>setClock(e.target.value)} maxLength={40}/><button disabled={busy} onClick={sendClock}>送去盖日期章</button><output data-testid="dayjs-iso">{parsedClock}</output><pre data-testid="date-chain">{clockResult?JSON.stringify(clockResult,null,2):'尚未签收。'}</pre></section>
 </>;
}
export default function ReceiptCabinet(){const [queryClient]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:false,gcTime:60000,staleTime:60000}}}));return <Provider store={redux}><JotaiProvider><QueryClientProvider client={queryClient}><MainReceipt/></QueryClientProvider></JotaiProvider></Provider>}
