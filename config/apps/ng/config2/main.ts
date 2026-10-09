import {bootstrapApplication} from '@angular/platform-browser';
import {provideZonelessChangeDetection} from '@angular/core';
import {Inventory2} from './Inventory2';
bootstrapApplication(Inventory2,{providers:[provideZonelessChangeDetection()]}).catch(error=>{console.error(error);const root=document.querySelector('signals-app');if(root)root.textContent='实验工作台未加载，刷新重试。'});
