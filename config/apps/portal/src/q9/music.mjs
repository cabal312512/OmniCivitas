const frame=document.querySelector('#music-frame'),result=document.querySelector('#music-receipt');
window.addEventListener('message',e=>{const d=e.data;if(e.origin!==location.origin||e.source!==frame?.contentWindow||d?.type!=='ocv-music-panel'||d.v!==1)return;if(Number.isInteger(d.notes)&&d.notes>=0&&d.notes<=256&&typeof d.phase==='string'&&d.phase.length<24){result.textContent=d.notes+' 音符\n'+(d.phase==='ready'?'已存档':d.phase==='local'?'本地':d.phase);}});
document.querySelector('[data-tool-front]')?.addEventListener('click',()=>document.querySelector('.tool-feature').style.zIndex='280');
