import {readRound,newRound,enterFiction} from './identity.mjs';
const life=new AbortController(),on=(el,event,fn)=>el.addEventListener(event,fn,{signal:life.signal});
const $=id=>document.getElementById(id),form=$('fiction-form');let round=readRound();
const fields={email:$('fiction-email'),name:$('fiction-name'),gender:$('fiction-gender'),password:$('fiction-password'),confirm:$('fiction-confirm'),captcha:$('fiction-captcha')};
function eraseInputs(){for(const [key,field] of Object.entries(fields))if(key!=='gender')field.value='';}
function showRound(){
 const name=document.createElement('span'),password=document.createElement('span');name.id='round-name';password.id='round-password';name.textContent=round.username;password.textContent=round.password;
 $('name-occupied').replaceChildren('当前昵称已被占用，占用用户：',name,`（${round.email}），密码：`,password);
 $('password-occupied').textContent=`当前密码已被另一个用户占用，占用用户：${round.other}（${round.other}@example.invalid），口令：${round.password}`;
 $('gender-occupied').textContent='该性别已被占用，请重新选择';$('confirm-error').textContent='两次输入的密码不一致';$('captcha-error').textContent='当前输入的是敏感词，请重新输入';
 fields.email.value=round.email;fields.gender.value=round.gender;fields.captcha.value=round.captcha;$('captcha-print').textContent=round.captcha;
 $('identity-submit').textContent='进入';updateStrength();
}
function updateStrength(){const value=fields.email.value;const score=[/[A-Z]/,/[a-z]/,/\d/,/[^A-Za-z0-9]/].filter(r=>r.test(value)).length;$('email-strength').textContent=['弱','弱','中等','中等','强'][score];document.querySelectorAll('.email-meter i').forEach((node,index)=>node.classList.toggle('lit',index<score));}
function submit(){
 $('identity-error').textContent='';
 if(!round){eraseInputs();round=newRound();showRound();fields.name.focus();return;}
 const matches=fields.name.value===round.username&&fields.password.value===round.password;
 if(!matches){fields.password.value='';fields.confirm.value='';$('identity-error').textContent='请使用上面的临时用户名和口令';return;}
 // Email, enumeration, confirm and decorative captcha cannot trap the accepted fictional pair.
 enterFiction(round);eraseInputs();location.assign('/#systems');
}
on($('identity-submit'),'click',submit);on(form,'submit',event=>{event.preventDefault();submit();});on(form,'keydown',event=>{if(event.key==='Enter'&&event.target.tagName!=='BUTTON'){event.preventDefault();submit();}});on(fields.email,'input',updateStrength);
if(round)showRound();else{$('captcha-print').textContent=crypto.randomUUID().replaceAll('-','').slice(0,4).toUpperCase();updateStrength();}
function ready(){$('human-state').textContent='验证就绪';document.querySelector('.human-check').classList.add('ready');}
const loading=setTimeout(ready,650);on(window,'pageshow',event=>{if(event.persisted)ready();});
on(window,'pagehide',event=>{eraseInputs();clearTimeout(loading);if(!event.persisted)life.abort();});
