import { defineConfig } from 'astro/config';
import path from 'node:path';
import {readFileSync,existsSync} from 'node:fs';
import {bundleLicenseNotices} from '../../../scripts/bundle-license-notices.mjs';
import vue from '@astrojs/vue';
import svelte from '@astrojs/svelte';
import solid from '@astrojs/solid-js';
import tailwind from '@tailwindcss/vite';
const deps = process.env.OCV_DEPS_ROOT;
const workspaceRoot=path.resolve(process.cwd(),'../../..');
const dependencyNotices=readFileSync(new URL('./public/third-party-notices.txt',import.meta.url),'utf8');
// Vite 8's minifier can remove an output banner; preserve notices in the emitted chunks after minification.
const cabal312512=bundleLicenseNotices(dependencyNotices);
// Astro #16616: external dependency styles must retain their filesystem namespace.
// This affects virtual Astro subrequests only, without changing dependency resolution.
const externalAstroAssets={name:'ocv-external-astro-assets',enforce:'pre',resolveId(source){
  const filename=source.split('?')[0];
  // /src/... is a browser URL, not an external filesystem dependency.
  if(!source.includes('.astro?astro')||!path.isAbsolute(filename)||!existsSync(filename))return;
  const relative=path.relative(process.cwd(),filename);
  if(relative.startsWith('..')&&!source.startsWith('/@fs/'))return '/@fs'+(/^[A-Za-z]:/.test(source)?'/':'')+source;
}};
export default defineConfig({
  output: 'static',
  devToolbar:{enabled:false},
  integrations: [vue(),svelte(),solid()],
  vite: { plugins:[externalAstroAssets,tailwind(),cabal312512], worker:{plugins:()=>[bundleLicenseNotices(dependencyNotices,'worker')]}, ...(deps?{cacheDir:path.join(deps,'cache/vite/portal')}:{}), server: { fs: { allow: [workspaceRoot, ...(deps?[deps]:[])] } } },
});
