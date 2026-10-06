// Original procedural sound. The game owns the update clock and user gestures.
const MAX_VOICES = 24;
const TYPES = ['shot', 'hit', 'collect', 'portal', 'damage', 'step', 'bird', 'chime'];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createSound() {
  let context = null;
  let master = null;
  let windGain = null;
  let windFilter = null;
  let noiseBuffer = null;
  let muted = false;
  let unlocked = false;
  let paused = false;
  let disposed = false;
  let unavailable = false;
  let voiceId = 0;
  let ended = 0;
  let dropped = 0;
  let elapsed = 0;
  let stepDistance = 0;
  let lastStep = -1;
  let nextBird = 5 + Math.random() * 7;
  let nextChime = 16 + Math.random() * 13;
  let ambienceSources = [];
  let ambienceNodes = [];
  const voices = new Map();
  const played = Object.fromEntries(TYPES.map((type) => [type, 0]));

  const disconnect = (node) => {
    try { node?.disconnect(); } catch { /* Already detached or closed. */ }
  };

  function finishVoice(voice, stop = false) {
    if (!voices.has(voice.id)) return;
    voices.delete(voice.id);
    for (const source of voice.sources) {
      source.onended = null;
      if (stop) {
        try { source.stop(); } catch { /* A stopped source cannot be restarted. */ }
      }
    }
    for (const node of voice.nodes) disconnect(node);
    ended += 1;
  }

  function initialize() {
    if (context || disposed || unavailable) return Boolean(context);
    const NativeContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!NativeContext) {
      unavailable = true;
      return false;
    }
    try {
      context = new NativeContext({ latencyHint: 'interactive' });
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.36;
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 16;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.2;
      master.connect(compressor);
      compressor.connect(context.destination);
      ambienceNodes.push(master, compressor);

      // One shared, looped two-second noise buffer; no audio files or network I/O.
      noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      let brown = 0;
      for (let i = 0; i < samples.length; i += 1) {
        brown = (brown + (Math.random() * 2 - 1) * 0.02) / 1.02;
        samples[i] = brown * 2.2;
      }
      const wind = context.createBufferSource();
      wind.buffer = noiseBuffer;
      wind.loop = true;
      windFilter = context.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 520;
      windFilter.Q.value = 0.25;
      windGain = context.createGain();
      windGain.gain.value = 0.016;
      wind.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      ambienceSources.push(wind);
      ambienceNodes.push(wind, windFilter, windGain);

      // Two almost inaudible pure tones below the birds and transient chimes.
      for (const frequency of [92, 138]) {
        const tone = context.createOscillator();
        const gain = context.createGain();
        tone.type = 'sine';
        tone.frequency.value = frequency;
        gain.gain.value = 0.0024;
        tone.connect(gain);
        gain.connect(master);
        ambienceSources.push(tone);
        ambienceNodes.push(tone, gain);
      }
      for (const source of ambienceSources) source.start();
      return true;
    } catch {
      unavailable = true;
      for (const source of ambienceSources) {
        try { source.stop(); } catch { /* Failed initialization. */ }
      }
      for (const node of ambienceNodes) disconnect(node);
      const partial = context;
      context = null;
      master = null;
      noiseBuffer = null;
      ambienceSources = [];
      ambienceNodes = [];
      try { Promise.resolve(partial?.close()).catch(() => {}); } catch { /* Unsupported backend. */ }
      return false;
    }
  }

  async function unlock() {
    if (disposed || !initialize()) return false;
    paused = false;
    try {
      if (context.state === 'suspended' || context.state === 'interrupted') await context.resume();
      if (disposed) return false;
      unlocked = context.state === 'running';
      return unlocked;
    } catch {
      return false;
    }
  }

  function play(kind, { gain = 0.06, tones = [], noise = null, pan = 0 } = {}) {
    if (!context || !unlocked || disposed || paused || muted || context.state !== 'running') return false;
    if (voices.size >= MAX_VOICES) {
      finishVoice(voices.values().next().value, true);
      dropped += 1;
    }
    const voice = { id: ++voiceId, sources: [], nodes: [], remaining: 0 };
    voices.set(voice.id, voice);
    try {
      const now = context.currentTime;
      const envelope = context.createGain();
      const panner = context.createStereoPanner?.();
      const duration = Math.max(0.03, ...tones.map((tone) => (tone.delay || 0) + tone.duration), noise?.duration || 0);
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.linearRampToValueAtTime(gain, now + Math.min(0.012, duration / 4));
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.025);
      if (panner) {
        panner.pan.value = clamp(pan, -1, 1);
        envelope.connect(panner);
        panner.connect(master);
        voice.nodes.push(panner);
      } else envelope.connect(master);
      voice.nodes.push(envelope);

      for (const tone of tones) {
        const source = context.createOscillator();
        const level = context.createGain();
        const start = now + (tone.delay || 0);
        source.type = tone.type || 'sine';
        source.frequency.setValueAtTime(Math.max(18, tone.from), start);
        source.frequency.exponentialRampToValueAtTime(Math.max(18, tone.to ?? tone.from), start + tone.duration);
        level.gain.value = tone.volume ?? 1;
        source.connect(level);
        level.connect(envelope);
        voice.sources.push(source);
        voice.nodes.push(source, level);
        source.start(start);
        source.stop(start + tone.duration + 0.03);
      }
      if (noise) {
        const source = context.createBufferSource();
        const filter = context.createBiquadFilter();
        const level = context.createGain();
        source.buffer = noiseBuffer;
        filter.type = noise.filter || 'lowpass';
        filter.frequency.value = noise.frequency || 900;
        filter.Q.value = 0.3;
        level.gain.value = noise.volume ?? 0.6;
        source.connect(filter);
        filter.connect(level);
        level.connect(envelope);
        voice.sources.push(source);
        voice.nodes.push(source, filter, level);
        source.start(now, Math.random() * 0.9);
        source.stop(now + noise.duration + 0.03);
      }
      voice.remaining = voice.sources.length;
      for (const source of voice.sources) {
        source.onended = () => {
          voice.remaining -= 1;
          if (voice.remaining === 0) finishVoice(voice);
        };
      }
      if (!voice.remaining) {
        finishVoice(voice);
        return false;
      }
      played[kind] += 1;
      return true;
    } catch {
      finishVoice(voice, true);
      return false;
    }
  }

  function shot() {
    return play('shot', { gain: 0.067, tones: [
      { type: 'triangle', from: 780, to: 150, duration: 0.12, volume: 0.7 },
      { from: 1560, to: 450, duration: 0.09, volume: 0.3 },
    ] });
  }

  function hit() {
    return play('hit', { gain: 0.06, tones: [
      { from: 650, to: 1980, duration: 0.12, volume: 0.7 },
      { from: 1320, to: 330, duration: 0.15, volume: 0.25 },
    ] });
  }

  function collect() {
    return play('collect', { gain: 0.055, tones: [
      { from: 523.25, duration: 0.65, volume: 0.4 },
      { from: 659.25, delay: 0.055, duration: 0.65, volume: 0.3 },
      { from: 783.99, delay: 0.11, duration: 0.7, volume: 0.3 },
    ] });
  }

  function portal() {
    return play('portal', { gain: 0.075, tones: [
      { from: 104, to: 520, duration: 0.85, volume: 0.7 },
      { from: 208, to: 780, duration: 0.9, volume: 0.3 },
    ], noise: { duration: 0.85, frequency: 1300, volume: 0.15 } });
  }

  function damage() {
    return play('damage', { gain: 0.08, tones: [{ from: 120, to: 42, duration: 0.22 }],
      noise: { duration: 0.11, frequency: 420, volume: 0.25 } });
  }

  function setMuted(value) {
    muted = Boolean(value);
    if (!context || !master || disposed) return;
    try {
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setValueAtTime(master.gain.value, context.currentTime);
      master.gain.linearRampToValueAtTime(muted ? 0 : 0.36, context.currentTime + 0.035);
    } catch { /* A closed backend is silent already. */ }
  }

  function update({ speed = 0, grounded = false, water = false } = {}, dt = 0) {
    if (!context || !unlocked || disposed || paused || context.state !== 'running') return;
    const delta = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.25);
    const movement = clamp(Number.isFinite(speed) ? Math.abs(speed) : 0, 0, 90);
    elapsed += delta;
    try {
      windGain.gain.setTargetAtTime(0.015 + Math.min(0.014, movement * 0.0004), context.currentTime, 0.5);
      windFilter.frequency.setTargetAtTime(water ? 380 : 520 + Math.sin(elapsed * 0.15) * 130, context.currentTime, 0.5);
    } catch { /* Interruption must not stop gameplay. */ }
    if (grounded && movement > 0.35) {
      stepDistance += movement * delta;
      if (stepDistance >= (water ? 4.2 : 3.3) && elapsed - lastStep >= 0.28) {
        lastStep = elapsed;
        stepDistance %= water ? 4.2 : 3.3;
        play('step', water
          ? { gain: 0.055, noise: { duration: 0.18, frequency: 850 },
            tones: [{ from: 150, to: 90, duration: 0.1, volume: 0.2 }] }
          : { gain: 0.035, tones: [{ from: 135, to: 65, duration: 0.085 }],
            noise: { duration: 0.08, frequency: 320, volume: 0.22 } });
      }
    } else stepDistance = 0;
    if (elapsed >= nextBird) {
      nextBird = elapsed + 10 + Math.random() * 16;
      play('bird', { gain: 0.015, pan: Math.random() * 1.4 - 0.7, tones: [
        { from: 2200, to: 3180, duration: 0.1, volume: 0.6 },
        { from: 2950, to: 2420, delay: 0.13, duration: 0.12, volume: 0.4 },
      ] });
    }
    if (elapsed >= nextChime) {
      nextChime = elapsed + 28 + Math.random() * 20;
      const note = [392, 440, 523.25, 587.33, 659.25][Math.floor(Math.random() * 5)];
      play('chime', { gain: 0.009, pan: Math.random() - 0.5, tones: [
        { from: note, duration: 1.9, volume: 0.75 },
        { from: note * 2.01, duration: 0.8, volume: 0.25 },
      ] });
    }
  }

  function suspend() {
    paused = true;
    if (!context || disposed) return Promise.resolve(false);
    try {
      return Promise.resolve(context.suspend()).then(() => true, () => false);
    } catch { return Promise.resolve(false); }
  }

  function resume() {
    paused = false;
    if (!context || !unlocked || disposed) return Promise.resolve(false);
    try {
      return Promise.resolve(context.resume()).then(() => context?.state === 'running', () => false);
    } catch { return Promise.resolve(false); }
  }

  function dispose() {
    if (disposed) return Promise.resolve(false);
    disposed = true;
    unlocked = false;
    paused = true;
    for (const voice of [...voices.values()]) finishVoice(voice, true);
    for (const source of ambienceSources) {
      try { source.stop(); } catch { /* Closed or interrupted. */ }
    }
    for (const node of ambienceNodes) disconnect(node);
    ambienceSources = [];
    ambienceNodes = [];
    noiseBuffer = null;
    windFilter = null;
    windGain = null;
    master = null;
    if (!context || context.state === 'closed') return Promise.resolve(true);
    try { return Promise.resolve(context.close()).then(() => true, () => false); }
    catch { return Promise.resolve(false); }
  }

  function snapshot() {
    return Object.freeze({
      state: disposed ? 'disposed' : unavailable ? 'unavailable' : context?.state || 'locked',
      unlocked, muted, paused, voices: voices.size, maxVoices: MAX_VOICES,
      ambienceSources: ambienceSources.length, played: Object.freeze({ ...played }),
      ended, dropped,
    });
  }

  return Object.freeze({ unlock, setMuted, shot, hit, collect, portal, damage, update, suspend, resume, dispose, snapshot });
}
