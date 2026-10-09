import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {isAuthorOnlyDocument} from './publication-policy.mjs';

// A working-tree preview deliberately uses no Git process or index mutations.
// The actual release check still validates the tracked index separately.
export async function publicationFiles(repository=process.cwd()) {
  const policy=JSON.parse(await readFile(path.join(repository,'config/source-publication.json'),'utf8'));
  const lines=(await readFile(path.join(repository,'.gitignore'),'utf8')).split(/\r?\n/);
  const rules=lines.filter(line=>line&& !line.startsWith('#')).map(line=>{
    const include=line.startsWith('!'),pattern=(include?line.slice(1):line).replace(/^\//,'').replace(/\/$/,'');
    const rootOnly=pattern.includes('/');let expression='';
    for(let i=0;i<pattern.length;i++){
      if(pattern[i]==='*'&&pattern[i+1]==='*'){i++;if(pattern[i+1]==='/'){i++;expression+='(?:.*/)?'}else expression+='.*'}
      else if(pattern[i]==='*')expression+='[^/]*';
      else if(pattern[i]==='?')expression+='[^/]';
      else expression+=pattern[i].replace(/[\^$+?.()|{}\[\]\\]/g,'\\$&');
    }
    return {include,regex:new RegExp((rootOnly?'^':'(?:^|/)')+expression+'$')};
  });
  const ignored=file=>{const parts=file.split('/'),prefixes=parts.map((_,i)=>parts.slice(0,i+1).join('/'));let skip=false;for(const rule of rules)if(prefixes.some(prefix=>rule.regex.test(prefix)))skip=!rule.include;return skip;};
  const files=[];
  async function walk(directory=''){
    for(const entry of await readdir(path.join(repository,directory),{withFileTypes:true})){
      const file=[directory,entry.name].filter(Boolean).join('/');
      if(entry.name==='.git')continue;
      if(entry.isSymbolicLink())continue;
      if(entry.isDirectory()){
        if(['.git','node_modules','dist','dist-signals','.next','.astro','.angular','.nx','.ocv-runtime','bin','obj','target','__pycache__','.cache'].includes(entry.name))continue;
        if((policy.localOnlyPatterns||[]).some(pattern=>new RegExp(pattern).test(file+'/')))continue;
        await walk(file);
      }else if(!ignored(file)&&!isAuthorOnlyDocument(file,policy))files.push(file);
    }
  }
  await walk();return files.sort();
}
