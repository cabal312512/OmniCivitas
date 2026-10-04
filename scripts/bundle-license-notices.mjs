import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

// Collect licenses from modules actually emitted to the browser, not installed tools.
export function bundleLicenseNotices(priorNotices,scope='bundled'){
  return {name:'ocv-bundle-license-notices',apply:'build',enforce:'post',generateBundle(_options,bundle){
    const owners=new Map(),chunks=[],missing=[];
    function owner(id){
      const matches=[...id.matchAll(/[\\/]node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)/g)];
      const match=matches.at(-1);
      if(!match||match[1]==='.pnpm')return null;
      let root=id.slice(0,match.index+match[0].length);
      if(!fs.existsSync(path.join(root,'package.json')))return null;
      const outer=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
      // Next includes vendored packages with their own licenses under dist/compiled.
      if(outer.name==='next'){
        let directory=path.dirname(id.split('?')[0]);
        while(directory.startsWith(root+path.sep)&&directory!==root){
          const manifest=path.join(directory,'package.json');
          if(fs.existsSync(manifest)&&JSON.parse(fs.readFileSync(manifest,'utf8')).name){root=directory;break;}
          directory=path.dirname(directory);
        }
      }
      const metadata=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
      metadata.version||=(outer.name==='next'?'bundled-with-next-'+outer.version:outer.version);
      const key=metadata.name+'@'+metadata.version;
      if(owners.has(key))return owners.get(key);
      const names=fs.readdirSync(root).filter(name=>/^(licen[sc]e|copying|notice)(\.|$)/i.test(name)&&fs.statSync(path.join(root,name)).isFile());
      const texts=names.map(name=>({name,text:fs.readFileSync(path.join(root,name),'utf8')}));
      if(!texts.length&&metadata.name==='alpinejs'&&metadata.version==='3.17.4')texts.push({name:'LICENSE.md (official v3.17.4 tag)',text:fs.readFileSync(new URL('../docs/licenses/alpinejs-3.17.4-LICENSE.md',import.meta.url),'utf8')});
      if(!texts.length&&metadata.name==='piccolore'&&metadata.version==='0.1.3')texts.push({name:'Upstream picocolors ISC notice; piccolore package declares ISC and identifies itself as a fork',text:'piccolore 0.1.3: https://github.com/delucis/piccolore\nThe npm archive and fork repository omit a separate LICENSE file. The installed package declares ISC, and its README identifies picocolors as its upstream. Preserve the upstream notice below; this is not represented as a license file retrieved from the fork.\n\n'+fs.readFileSync(new URL('../docs/licenses/piccolore-upstream-picocolors-ISC.txt',import.meta.url),'utf8')});
      if(!texts.length&&metadata.name==='gsap'){
        const original=fs.readFileSync(path.join(root,'gsap-core.js'),'utf8').match(/\/\*![\s\S]*?\*\//)?.[0];
        if(original)texts.push({name:'Original GSAP copyright and Standard License reference',text:original});
      }
      if(!texts.length&&metadata.name==='seedrandom'){
        const original=fs.readFileSync(path.join(root,'seedrandom.js'),'utf8').match(/^\/\*[\s\S]*?\*\//)?.[0];
        if(original)texts.push({name:'Complete original MIT notice embedded in seedrandom.js',text:original});
      }
      if(!texts.length&&metadata.name==='javascript-natural-sort'&&metadata.version==='0.7.1'){
        const original=fs.readFileSync(path.join(root,'naturalSort.js'),'utf8').match(/^\/\*[\s\S]*?\*\//)?.[0];
        const terms=fs.readFileSync(new URL('../LICENSE',import.meta.url),'utf8').split('Permission is hereby granted')[1];
        if(original&&terms)texts.push({name:'Original author/MIT declaration plus standard MIT permission terms (package omits a separate license file)',text:original+'\n\nPermission is hereby granted'+terms});
      }
      if(!texts.length&&metadata.name==='@edge-runtime/cookies')texts.push({name:'Official Vercel edge-runtime repository MIT license (vendored package omits it)',text:fs.readFileSync(new URL('../docs/licenses/edge-runtime-MIT.md',import.meta.url),'utf8')});
      if(!texts.length&&metadata.name==='server-only'&&metadata.version==='0.0.1'){
        const original=fs.readFileSync(path.join(root,'package.json'),'utf8');
        const terms=fs.readFileSync(new URL('../LICENSE',import.meta.url),'utf8').split('Permission is hereby granted')[1];
        texts.push({name:'Original marker-package MIT declaration and standard permission terms; package supplies no copyright notice',text:'server-only 0.0.1 retains its original metadata below. No copyright holder is invented; the package identifies the React homepage and issue tracker, declares MIT, and omits a separate license or copyright notice.\n'+original+'\nPermission is hereby granted'+terms});
      }
      if(!texts.length&&metadata.license==='CC0-1.0')texts.push({name:'CC0-1.0 declaration from original package metadata (no attribution condition)',text:metadata.name+' '+metadata.version+'\nLicense: CC0-1.0\nhttps://creativecommons.org/publicdomain/zero/1.0/'});
      if(!texts.length)missing.push({name:metadata.name,version:metadata.version,license:metadata.license,repository:metadata.repository});
      const record={name:metadata.name,version:metadata.version,license:metadata.license,repository:metadata.repository,files:texts.map(file=>({name:file.name,sha256:createHash('sha256').update(file.text).digest('hex')})),text:texts.map(file=>file.name+'\n'+file.text).join('\n\n')};
      owners.set(key,record);return record;
    }
    for(const item of Object.values(bundle)){
      if(item.type!=='chunk')continue;
      const packages=new Map();
      for(const id of Object.keys(item.modules||{})){const record=owner.call(this,id);if(record)packages.set(record.name+'@'+record.version,record);}
      // A complete permission/copyright notice travels with each emitted chunk.
      const notices=[priorNotices,...[...packages.values()].map(record=>record.name+' '+record.version+'\n'+record.text)].join('\n\n');
      item.code='/*!\n'+notices.replaceAll('*/','* /')+'\n*/\n'+item.code;
      chunks.push({file:item.fileName,packages:[...packages.keys()]});
    }
    if(missing.length)this.error('Bundled dependencies missing license files: '+JSON.stringify(missing));
    this.emitFile({type:'asset',fileName:'licenses/'+scope+'-notices.txt',source:[...owners.values()].map(record=>record.name+' '+record.version+'\n'+record.text).join('\n\n')});
    this.emitFile({type:'asset',fileName:'licenses/'+scope+'-inventory.json',source:JSON.stringify({scope:'Modules actually bundled into emitted chunks; not a list of globally installed tools',packages:[...owners.values()].map(({text,...record})=>record),chunks},null,2)});
  }};
}

export class WebpackLicenseNotices {
  apply(compiler){
    compiler.hooks.thisCompilation.tap('OcvLicenseNotices',compilation=>{
      compilation.hooks.processAssets.tap({name:'OcvLicenseNotices',stage:compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE},()=>{
        const chunks={};
        function visit(module,ids){if(module.resource)ids[module.resource]={};for(const child of module.modules||[])visit(child,ids);}
        for(const chunk of compilation.chunks){
          const modules={};for(const module of compilation.chunkGraph.getChunkModulesIterable(chunk))visit(module,modules);
          for(const file of chunk.files)if(file.endsWith('.js')){const asset=compilation.getAsset(file);if(asset)chunks[file]={type:'chunk',fileName:file,modules,code:String(asset.source.source())};}
        }
        const plugin=bundleLicenseNotices('','next');
        plugin.generateBundle.call({error(message){throw Error(message)},emitFile(asset){compilation.emitAsset(asset.fileName,new compiler.webpack.sources.RawSource(asset.source))}},{},chunks);
        for(const [file,chunk] of Object.entries(chunks)){
          const asset=compilation.getAsset(file),prefix=chunk.code.slice(0,chunk.code.length-String(asset.source.source()).length);
          compilation.updateAsset(file,new compiler.webpack.sources.ConcatSource(prefix,asset.source));
        }
      });
    });
  }
}
