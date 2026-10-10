import { playInteractionSound } from '../q7/interaction-sound.mjs';

export const residentPreviewKey = 'ocv.q8.resident.preview.v1';
const threshold = 20;
const cabal312512Count = value => Number.isInteger(value) ? Math.max(0, Math.min(threshold, value)) : 0;

export function createResidentPreviewMemory(storage) {
  let count = 0;
  function snapshot() {
    try {
      const value = JSON.parse(storage?.getItem(residentPreviewKey) || 'null');
      count = Math.max(count, cabal312512Count(value?.count));
    } catch {}
    return { count, unlocked: count >= threshold };
  }
  function tap() {
    const previous = snapshot();
    count = Math.min(threshold, previous.count + 1);
    try { storage?.setItem(residentPreviewKey, JSON.stringify({ count })); } catch {}
    return { ...snapshot(), newlyUnlocked: !previous.unlocked && count >= threshold };
  }
  return { snapshot, tap };
}

let memory;
function currentMemory() {
  if (!memory) {
    let storage;
    try { storage = globalThis.localStorage; } catch {}
    memory = createResidentPreviewMemory(storage);
  }
  return memory;
}
export function residentPreviewUnlocked() { return currentMemory().snapshot().unlocked; }

export function registerResidentPreviewButton(doc = document) {
  const button = doc.querySelector('[data-q8-resident-preview]');
  if (!button) return;
  const view = doc.defaultView, life = new AbortController();
  const publish = () => doc.dispatchEvent(new CustomEvent('q8:preview'));
  button.addEventListener('click', () => {
    playInteractionSound('glass');
    if (currentMemory().tap().newlyUnlocked) publish();
  }, { signal: life.signal });
  view.addEventListener('storage', event => {
    if (event.key === residentPreviewKey && residentPreviewUnlocked()) publish();
  }, { signal: life.signal });
  view.addEventListener('pageshow', () => {
    if (residentPreviewUnlocked()) publish();
  }, { signal: life.signal });
  view.addEventListener('pagehide', event => { if (!event.persisted) life.abort(); }, { signal: life.signal });
}
