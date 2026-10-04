<script>
import {writable} from 'svelte/store';
const stoppage=writable(0);
</script>
<section class="svelte-meter" data-framework="svelte"><strong>停机次数</strong><output data-testid="svelte-count">{$stoppage}</output><button onclick={()=>stoppage.update(n=>Math.min(n+1,99))}>再停一次</button><button onclick={()=>stoppage.set(0)}>归零</button><span>累计，不计利息。</span></section>
<style>.svelte-meter{width:255px;max-width:100%;background:#151922;color:#63fbb3;border:2px solid #556575;padding:16.999px;font:13px monospace;box-shadow:-5px 5px #826790;transform:translateY(13px)}output{display:block;font:57px monospace;color:#dafa61}button{background:#384442;color:#fff;border:1px outset #c1cdd8;padding:9px;margin:0 5px 18px 0}span{display:block;color:#a5a2c2}</style>
