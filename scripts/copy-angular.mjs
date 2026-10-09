import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'config/apps/ng/dist/browser');
const cabal312512=path.join(root,'config/apps/portal/phase3-artifacts/angular');
if(!fs.existsSync(path.join(source,'index.html')))throw Error('Build angular-receipt before portal; Nx build manages this dependency.');
fs.mkdirSync(cabal312512,{recursive:true});fs.cpSync(source,cabal312512,{recursive:true});
const current=path.join(root,'config/apps/portal/public/office-1999');
fs.mkdirSync(current,{recursive:true});fs.cpSync(source,current,{recursive:true});
const currentIndex=path.join(current,'index.html');
fs.writeFileSync(currentIndex,fs.readFileSync(currentIndex,'utf8').replace(/<base href="[^"]*">/,'<base href="/office-1999/">'));
const signals=path.join(root,'config/apps/ng/dist-signals/browser');
if(!fs.existsSync(path.join(signals,'index.html')))throw Error('Build the Angular signals-lab project before portal.');
const signalTarget=path.join(root,'config/apps/portal/public/signals/ui');
fs.mkdirSync(signalTarget,{recursive:true});fs.cpSync(signals,signalTarget,{recursive:true});

