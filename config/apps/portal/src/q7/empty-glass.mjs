import { createGlassDragging } from './glass-drag.mjs';
import { playInteractionSound } from './interaction-sound.mjs';
const life = new AbortController();
const dragging = createGlassDragging(document, life.signal);
document.addEventListener('click', event => {
  const button = event.target instanceof Element && event.target.closest('[data-empty-glass-close]');
  if (!button) return;
  const frame = button.closest('[data-empty-glass-frame]');
  if (!frame) return;
  playInteractionSound('glass');
  const keyboard = event.detail === 0;
  const next = [...document.querySelectorAll('[data-empty-glass-close]')]
    .find(candidate => candidate !== button && candidate.getClientRects().length);
  dragging.remove(frame);
  frame.remove();
  if (keyboard && next) next.focus({ preventScroll: true });
  if (!document.querySelector('[data-empty-glass-frame]')) document.querySelector('[data-empty-glass-layer]')?.remove();
}, { signal: life.signal });
window.addEventListener('pagehide', event => { if (!event.persisted) life.abort(); }, { signal: life.signal });
