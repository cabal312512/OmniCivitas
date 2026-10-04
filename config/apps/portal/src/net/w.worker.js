import { evaluateRegex } from './regex.mjs';

self.onmessage = event => {
  try {
    self.postMessage({ ok: true, result: evaluateRegex(event.data) });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
