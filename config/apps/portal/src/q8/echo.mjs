import $ from 'jquery';
import Alpine from 'alpinejs';
import htmx from 'htmx.org';
import i18next from 'i18next';
import Joi from 'joi';
import validator from 'validator';
import {huntState,say,syncHunt} from './hunt.mjs';
import {snapshot} from '../q9/state.mjs';
import {withNickname} from '../q9/voice.mjs';
const life=new AbortController(),pending=new Set();let disposed=false;
window.Alpine=Alpine;Alpine.start();htmx.config.allowEval=false;htmx.config.allowScriptTags=false;htmx.config.timeout=4000;htmx.process(document.querySelector('.echo-root'));
await i18next.init({lng:'zh',fallbackLng:'zh',initAsync:false,resources:{zh:{translation:{talk:'说点什么',map:'地图',title:'捉迷藏'}},en:{translation:{talk:'Say something',map:'Map',title:'Hide & seek'}}}});
function paint(){const s=huntState();document.querySelector('[data-q8-resident]')?.toggleAttribute('hidden',s.count!==30);$('[data-echo-count]').text(String(s.count).padStart(2,'0'));$('[data-echo-progress]').val(s.count);if(s.count===30)$('.echo-resident').removeAttr('hidden');else $('.echo-resident').attr('hidden','');$('[data-echo-locked]').prop('hidden',s.count===30);$('#echo-input,#echo-form button').prop('disabled',s.count!==30);for(const id of s.found)$(`[data-slot="${id}"]`).addClass('echo-found').find('small').text('✓');if(s.count===30)$('[data-echo-talk]').text(withNickname('回来了。'));}
function ajax(url,data){return new Promise((resolve,reject)=>{const r=$.ajax({url,method:'POST',contentType:'application/json',dataType:'json',data:JSON.stringify(data),timeout:5500});pending.add(r);r.done(resolve).fail(reject).always(()=>pending.delete(r));});}
async function talk(word){if(disposed)return;const validation=Joi.string().trim().min(1).max(80).pattern(/^[^\x00-\x1f]+$/).validate(word);if(validation.error){$('[data-echo-error]').text('写 1—80 个字');return;}if(huntState().count!==30){$('[data-echo-error]').text('先找到三十个');return;}
 $('#echo-form button').prop('disabled',true);$('[data-echo-error]').text('');
 try{const answer=await ajax('/api/q8/talk',{session:huntState().session,text:validation.value,profileSession:snapshot().session});if(disposed)return;$('[data-echo-talk]').text(answer.reply);$('[data-echo-store]').text('已存档');$('.echo-resident').addClass('echo-answer');setTimeout(()=>$('.echo-resident').removeClass('echo-answer'),900);say(answer.reply,answer.pitch);$('[data-echo-clock]').text(new Date().toLocaleTimeString());}
 catch{if(disposed)return;const text='我在这。';$('[data-echo-talk]').text(text);$('[data-echo-store]').text('本地');say(text);}
 finally{if(!disposed)$('#echo-form button').prop('disabled',false);}
}
$('#echo-form').on('submit',e=>{e.preventDefault();void talk($('#echo-input').val());});$('.echo-quick [data-echo-word]').on('click',function(){void talk(this.dataset.echoWord);});
$('#echo-refresh').on('click',()=>void syncHunt());$('#echo-language').on('click',async()=>{await i18next.changeLanguage(i18next.language==='zh'?'en':'zh');$('[data-i18n]').each(function(){$(this).text(i18next.t(this.dataset.i18n));});$('[data-echo-title]').text(i18next.t('title'));});
$('#echo-color').on('input',function(){const color='#'+this.value;if(validator.isHexColor(color))document.querySelector('.echo-root').style.setProperty('--echo-accent',color);});
document.addEventListener('q8:progress',e=>{paint();$('[data-echo-store]').text(e.detail.storage==='postgresql'?'已存档':'本地');},{signal:life.signal});
paint();window.addEventListener('pagehide',event=>{if(!event.persisted){disposed=true;life.abort();for(const request of pending)request.abort();$('.echo-root button,#echo-form,#echo-color').off();}},{signal:life.signal});
