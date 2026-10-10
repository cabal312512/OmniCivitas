const cabal312512Finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function constrainGlassFrame(position, size, viewport, padding = 8) {
  const width = Math.max(0, cabal312512Finite(size.width));
  const height = Math.max(0, cabal312512Finite(size.height));
  const viewWidth = Math.max(0, cabal312512Finite(viewport.width));
  const viewHeight = Math.max(0, cabal312512Finite(viewport.height));
  const gap = Math.max(0, cabal312512Finite(padding, 8));
  const minX = Math.min(gap, Math.max(0, (viewWidth - width) / 2));
  const minY = Math.min(gap, Math.max(0, (viewHeight - height) / 2));
  return {
    x: Math.max(minX, Math.min(Math.max(minX, viewWidth - width - minX), cabal312512Finite(position.x, minX))),
    y: Math.max(minY, Math.min(Math.max(minY, viewHeight - height - minY), cabal312512Finite(position.y, minY))),
  };
}

export function createGlassDragging(doc = document, signal) {
  const win = doc.defaultView, moved = new Map();
  let active = null, pending = null, raf = 0;
  const on = (target, type, fn) => target.addEventListener(type, fn, { signal });
  const place = (frame, position) => {
    const rect = frame.getBoundingClientRect();
    const bounded = constrainGlassFrame(position, rect, { width: win.innerWidth, height: win.innerHeight });
    frame.style.left = `${bounded.x}px`;
    frame.style.top = `${bounded.y}px`;
    frame.dataset.glassMoved = 'true';
    moved.set(frame, bounded);
  };
  function flush() {
    if (raf) win.cancelAnimationFrame(raf);
    raf = 0;
    if (active && pending && active.frame.isConnected) place(active.frame, pending);
    pending = null;
  }
  function stop() {
    flush();
    if (!active) return;
    const ended = active;
    active = null;
    ended.frame.removeAttribute('data-glass-dragging');
    try { if (ended.handle.hasPointerCapture(ended.id)) ended.handle.releasePointerCapture(ended.id); } catch {}
  }
  on(doc, 'pointerdown', event => {
    const handle = event.target instanceof win.Element && event.target.closest('[data-empty-glass-drag]');
    if (!handle || active || event.button !== 0 || event.target.closest('button')) return;
    const frame = handle.closest('[data-empty-glass-frame]');
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    active = { handle, frame, id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    frame.dataset.glassDragging = 'true';
    handle.focus({ preventScroll: true });
    try { handle.setPointerCapture(event.pointerId); } catch {}
    event.preventDefault();
  });
  on(doc, 'pointermove', event => {
    if (!active || event.pointerId !== active.id) return;
    if (event.pointerType === 'mouse' && !(event.buttons & 1)) { stop(); return; }
    pending = { x: active.left + event.clientX - active.x, y: active.top + event.clientY - active.y };
    if (!raf) raf = win.requestAnimationFrame(flush);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) on(doc, type, event => {
    if (active && event.pointerId === active.id) stop();
  });
  on(doc, 'keydown', event => {
    const handle = event.target instanceof win.Element && event.target.closest('[data-empty-glass-drag]');
    if (!handle || event.target !== handle || event.altKey || event.ctrlKey || event.metaKey) return;
    const frame = handle.closest('[data-empty-glass-frame]');
    if (!frame) return;
    const offset = event.shiftKey ? 24 : 8;
    const delta = { ArrowLeft: [-offset, 0], ArrowRight: [offset, 0], ArrowUp: [0, -offset], ArrowDown: [0, offset] }[event.key];
    if (event.key === 'Home') {
      stop(); moved.delete(frame); frame.style.removeProperty('left'); frame.style.removeProperty('top'); frame.removeAttribute('data-glass-moved');
    } else if (delta) {
      stop(); const rect = frame.getBoundingClientRect(); place(frame, { x: rect.left + delta[0], y: rect.top + delta[1] });
    } else return;
    event.preventDefault();
  });
  const fit = () => {
    stop();
    for (const [frame, position] of moved) {
      if (!frame.isConnected) moved.delete(frame);
      else if (frame.getClientRects().length) place(frame, position);
    }
  };
  on(win, 'resize', fit);
  on(win, 'pageshow', fit);
  on(win, 'pagehide', stop);
  on(win, 'blur', stop);
  signal?.addEventListener('abort', () => { stop(); moved.clear(); }, { once: true });
  return { remove(frame) { if (active?.frame === frame) stop(); moved.delete(frame); } };
}
