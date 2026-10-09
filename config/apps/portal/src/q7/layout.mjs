import { desktopView } from './view.mjs';

function mount() {
  const layer = document.querySelector('[data-n3-layer]');
  if (!layer || layer.dataset.desktopMounted) return;
  layer.dataset.desktopMounted = 'true';
  const lifetime = new AbortController();
  const update = () => {
    const view = desktopView(innerWidth, innerHeight);
    document.body.style.setProperty('--ocv-window-scale', view.scale.toFixed(3));
    document.body.dataset.wide = String(view.wide);
    window.__ocvViewport = { width: innerWidth, height: innerHeight, ...view };
  };
  update();
  window.addEventListener('resize', update, { passive: true, signal: lifetime.signal });
  window.addEventListener('pageshow', update, { signal: lifetime.signal });
  const cleanup = () => lifetime.abort();
  document.addEventListener('astro:before-swap', cleanup, { once: true, signal: lifetime.signal });
  window.addEventListener('pagehide', event => { if (!event.persisted) cleanup(); }, { signal: lifetime.signal });
}

mount();
document.addEventListener('astro:page-load', mount);
