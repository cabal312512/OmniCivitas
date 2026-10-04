import {Component,signal,OnDestroy,provideZonelessChangeDetection} from '@angular/core';
import {bootstrapApplication} from '@angular/platform-browser';
import {FormControl,FormGroup,ReactiveFormsModule,Validators} from '@angular/forms';
@Component({selector:'rice-app',standalone:true,imports:[ReactiveFormsModule],template:`<div class="bar">审核小窗.exe <span style="float:right">— □ ×</span></div><form [formGroup]="form" (ngSubmit)="stamp()"><label for="angular-note">备注</label> <input id="angular-note" formControlName="memo" maxlength="40"/><button type="submit">签收</button><p role="status">{{error()}}</p><output id="angular-stamps">签收 {{count()}} 次 · {{memo()}}</output></form><output id="angular-booleans">看过：{{seen()}}；就绪：{{ready()}}</output><button (click)="returnReceipt()">回传两个状态</button>`})
class ReceiptApp implements OnDestroy{
 count=signal(0);memo=signal('未签收');seen=signal(false);ready=signal(false);error=signal('');
 form=new FormGroup({memo:new FormControl('空',{nonNullable:true,validators:[Validators.required,Validators.maxLength(40),Validators.pattern(/.*\S.*/)]})});
 private receive=(event:MessageEvent)=>{if(event.origin!==location.origin||event.source!==parent)return;const d=event.data;if(!d||d.v!==1||d.type!=='OCV_TWO_BOOLEANS'||d.token!=='two-spoons'||typeof d.seen!=='boolean'||typeof d.ready!=='boolean'||Object.keys(d).length!==5)return;this.seen.set(d.seen);this.ready.set(d.ready);};
 constructor(){window.addEventListener('message',this.receive);}
 stamp(){if(this.form.invalid){this.error.set('写 1—40 个字');return;}this.error.set('');this.count.update(n=>Math.min(n+1,99));this.memo.set(this.form.controls.memo.value);}
 returnReceipt(){parent.postMessage({v:1,type:'OCV_BOOLEAN_RECEIPT',token:'two-spoons',seen:this.seen(),ready:this.ready()},location.origin);}
 ngOnDestroy(){window.removeEventListener('message',this.receive);}
}
bootstrapApplication(ReceiptApp,{providers:[provideZonelessChangeDetection()]}).catch(()=>document.body.textContent='小窗没打开；刷新重试。');
