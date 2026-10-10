const cabal312512Forms = Object.freeze({
  shard: { frequency: 1046, notes: [1], duration: .16, gap: 0, end: .86, type: 'triangle', partial: 1.006 },
  ring: { frequency: 784, notes: [1, 1.5, 1], duration: .14, gap: .05, end: .96, type: 'sine', partial: 1.012 },
  lattice: { frequency: 523, notes: [1, .75, 1.333], duration: .13, gap: .06, end: .86, type: 'triangle', partial: 1.5 },
  rift: { frequency: 392, notes: [1, 1.187], duration: .24, gap: .11, end: 1.13, type: 'sine', partial: 1.023 },
  orbit: { frequency: 659, notes: [1, 1.25, 1.5], duration: .17, gap: .07, end: 1.06, type: 'sine', partial: 1.014 },
  prism: { frequency: 1175, notes: [1, .8], duration: .16, gap: .07, end: .9, type: 'triangle', partial: 1.008 },
  assembly: { frequency: 520, notes: [1, 1.5], duration: .19, gap: .08, end: .96, type: 'sine', partial: 1.021 },
});
const effects = Object.freeze({
  pulse: { notes: [1], duration: .16, gap: 0, end: .78, type: 'sine', partial: 1.014 },
  shear: { notes: [1], duration: .18, gap: 0, end: .67, type: 'triangle', partial: 1.5 },
  phase: { notes: [1, 1.25, 1.5], duration: .15, gap: .09, end: 1.12, type: 'sine', partial: 1.018 },
  resonate: { notes: [1, 1.5], duration: .19, gap: .08, end: .98, type: 'sine', partial: 1.009 },
  talk: { notes: [1], duration: .19, gap: 0, end: 1.18, type: 'triangle', partial: 1.012 },
  glass: { frequency: 880, notes: [1], duration: .15, gap: 0, end: 1.38, type: 'sine' },
  'eye-pulse': { frequency: 660, notes: [1], duration: .17, gap: 0, end: .76, type: 'sine', partial: 1.018 },
  'eye-shear': { frequency: 930, notes: [1, .72], duration: .14, gap: .08, end: .82, type: 'triangle', partial: 1.009 },
  'eye-phase': { frequency: 420, notes: [1, 1.4, 1.82], duration: .18, gap: .1, end: 1.12, type: 'sine', partial: 1.025 },
  'eye-resonate': { frequency: 520, notes: [1, 1.5, 1.13], duration: .2, gap: .11, end: .97, type: 'triangle', partial: 1.016 },
});
const levels = Object.freeze({ master: .72, voice: .24, floor: .0001, attack: .009, release: .012, lead: .008, voices: 4 });
const frequency = value => Math.min(1400, Math.max(300, value));

export function createInteractionSound({ win = window, doc = document } = {}) {
  let context = null, master = null, compressor = null, analyser = null, samples = null, destination = false;
  let count = 0, scheduled = 0, resumes = 0, disposed = false, present = true, generation = 0, resumeEpoch = 0, resuming = false, pending = null;
  let lastReason = 'uninitialized', lastProfile = null;
  const voices = new Set(), life = new AbortController();
  const awake = () => !disposed && present && !doc.hidden;
  function finish(voice) {
    if (!voices.delete(voice)) return;
    for (const oscillator of voice.oscillators) {
      oscillator.onended = null;
      try { oscillator.stop(); } catch {}
      try { oscillator.disconnect(); } catch {}
    }
    for (const gain of voice.gains) try { gain.disconnect(); } catch {}
  }
  function silence() { for (const voice of [...voices]) finish(voice); }
  function invalidate(reason) {
    generation++; resumeEpoch++; resuming = false; pending = null; lastReason = reason;
    silence();
  }
  function suspend(reason = 'hidden') {
    invalidate(reason);
    if (context && context.state !== 'closed') try { void Promise.resolve(context.suspend()).catch(() => {}); } catch {}
  }
  function dispose() {
    if (disposed) return;
    disposed = true; present = false; invalidate('disposed'); life.abort();
    for (const node of [master, compressor, analyser]) try { node?.disconnect(); } catch {}
    destination = false; samples = null;
    if (context && context.state !== 'closed') try { void Promise.resolve(context.close()).catch(() => {}); } catch {}
  }
  function initialize() {
    if (context) return context.state !== 'closed';
    const Audio = win.AudioContext || win.webkitAudioContext;
    if (!Audio) { lastReason = 'unsupported'; return false; }
    context = new Audio();
    master = context.createGain(); master.gain.value = levels.master;
    let output = master;
    if (context.createDynamicsCompressor) {
      compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -12; compressor.knee.value = 12; compressor.ratio.value = 3;
      compressor.attack.value = .003; compressor.release.value = .08;
      output.connect(compressor); output = compressor;
    }
    if (context.createAnalyser) {
      analyser = context.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = 0;
      samples = new Float32Array(analyser.fftSize); output.connect(analyser); output = analyser;
    }
    output.connect(context.destination); destination = true;
    context.addEventListener?.('statechange', () => {
      if (disposed) return;
      if (context.state === 'closed') { destination = false; invalidate('context-closed'); }
      else if (context.state === 'running' && !awake()) suspend(present ? 'hidden' : 'page-hidden');
      else if (context.state === 'interrupted' || context.state === 'suspended') {
        silence(); if (!resuming && awake()) lastReason = context.state;
      }
    }, { signal: life.signal });
    return true;
  }
  function render(request) {
    if (!awake() || request.token !== generation || context?.state !== 'running') return false;
    let voice;
    try {
      while (voices.size >= levels.voices) finish(voices.values().next().value);
      const form = cabal312512Forms[request.form] || cabal312512Forms.assembly;
      const effect = request.kind === 'collect' ? form : effects[request.kind] || effects.pulse;
      const base = effect.frequency || form.frequency, partials = effect.partial ? [1, effect.partial] : [1];
      const start = context.currentTime + levels.lead, duration = effect.notes.length * effect.duration + (effect.notes.length - 1) * effect.gap;
      voice = { gains: [], oscillators: [], remaining: effect.notes.length * partials.length }; voices.add(voice);
      const tones = [];
      for (let index = 0; index < effect.notes.length; index++) {
        const at = start + index * (effect.duration + effect.gap), end = at + effect.duration, pitch = frequency(base * effect.notes[index]);
        tones.push(pitch);
        const gain = context.createGain(); voice.gains.push(gain); gain.connect(master);
        const peak = levels.voice / partials.length, hold = at + Math.min(.04, effect.duration * .23);
        gain.gain.setValueAtTime(levels.floor, at);
        gain.gain.exponentialRampToValueAtTime(peak, at + levels.attack);
        gain.gain.setValueAtTime(peak, hold);
        gain.gain.exponentialRampToValueAtTime(.001, end - levels.release);
        gain.gain.linearRampToValueAtTime(0, end);
        for (const interval of partials) {
          const oscillator = context.createOscillator(); voice.oscillators.push(oscillator);
          oscillator.type = effect.type;
          oscillator.frequency.setValueAtTime(frequency(pitch * interval), at);
          oscillator.frequency.exponentialRampToValueAtTime(frequency(pitch * interval * effect.end), end);
          oscillator.connect(gain);
          oscillator.onended = () => { if (voices.has(voice) && --voice.remaining === 0) finish(voice); };
          oscillator.start(at); oscillator.stop(end);
        }
      }
      count++; scheduled += effect.notes.length; lastReason = 'scheduled';
      lastProfile = { kind: request.kind, form: request.form, duration, notes: effect.notes.length, tones, type: effect.type };
      return true;
    } catch {
      if (voice) finish(voice); lastReason = 'render-failed'; return false;
    }
  }
  function resume() {
    if (resuming) return true;
    const epoch = ++resumeEpoch; resuming = true; resumes++; lastReason = 'resume-pending';
    const settle = error => {
      if (epoch !== resumeEpoch || disposed) return;
      resuming = false; const request = pending; pending = null;
      if (!awake()) { suspend(present ? 'hidden' : 'page-hidden'); return; }
      if (error) { lastReason = 'resume-failed'; return; }
      if (context.state !== 'running') { lastReason = 'resume-not-running'; return; }
      if (request?.token === generation) render(request);
    };
    try { Promise.resolve(context.resume()).then(() => settle(), error => settle(error)); return true; }
    catch (error) { settle(error); return false; }
  }
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) suspend(); }, { signal: life.signal });
  win.addEventListener('pagehide', event => { present = false; if (event.persisted) suspend('page-hidden'); else dispose(); }, { signal: life.signal });
  win.addEventListener('pageshow', () => { if (!disposed) present = true; }, { signal: life.signal });
  const api = {
    play(kind = 'pulse', { form = 'assembly' } = {}) {
      if (!awake()) { lastReason = disposed ? 'disposed' : present ? 'hidden' : 'page-hidden'; return false; }
      try {
        if (!initialize()) { if (context?.state === 'closed') lastReason = 'context-closed'; return false; }
        const request = { kind, form, token: ++generation };
        if (context.state === 'running' && !resuming) { pending = null; return render(request); }
        pending = request; return resume();
      } catch { lastReason = 'audio-unavailable'; return false; }
    },
    snapshot() {
      let peak = 0, rms = 0, analysisSamples = 0;
      if (!disposed && analyser && samples && context?.state === 'running') try {
        analyser.getFloatTimeDomainData(samples); analysisSamples = samples.length;
        for (const sample of samples) { peak = Math.max(peak, Math.abs(sample)); rms += sample * sample; }
        rms = Math.sqrt(rms / samples.length);
      } catch {}
      return { contexts: context ? 1 : 0, state: context?.state || 'uninitialized', voices: voices.size, oscillators: [...voices].reduce((total, voice) => total + voice.oscillators.length, 0), played: count, scheduled, disposed, pending: !!pending, resuming, resumes, destination, lastReason, lastProfile: lastProfile ? { ...lastProfile, tones: [...lastProfile.tones] } : null, peak, rms, analysisSamples };
    },
    dispose,
  };
  Object.defineProperty(win, '__ocvInteractionSound', { value: api, configurable: true });
  return api;
}

let shared;
export function playInteractionSound(kind, options) {
  shared ||= createInteractionSound();
  return shared.play(kind, options);
}
export function interactionSoundSnapshot() {
  return shared?.snapshot() || { contexts: 0, state: 'uninitialized', voices: 0, oscillators: 0, played: 0, scheduled: 0, disposed: false, pending: false, resuming: false, resumes: 0, destination: false, lastReason: 'uninitialized', lastProfile: null, peak: 0, rms: 0, analysisSamples: 0 };
}
