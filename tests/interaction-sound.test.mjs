import { describe, it, expect } from 'vitest';
import { createInteractionSound } from '../config/apps/portal/src/q7/interaction-sound.mjs';

function fixture({ supported = true, initialState = 'running', deferredResume = false } = {}) {
  const win = new EventTarget(), doc = new EventTarget(), contexts = [];
  doc.hidden = false;
  class Parameter {
    value = 1; calls = [];
    setValueAtTime(value, time) { this.calls.push({ kind: 'set', value, time }); }
    exponentialRampToValueAtTime(value, time) { this.calls.push({ kind: 'exponential', value, time }); }
    linearRampToValueAtTime(value, time) { this.calls.push({ kind: 'linear', value, time }); }
  }
  function node(fields = {}) {
    return { ...fields, connections: [], connect(target) { this.connections.push(target); }, disconnect() { this.disconnected = true; } };
  }
  class Audio extends EventTarget {
    state = initialState; currentTime = 2; destination = {}; oscillators = []; gains = []; resumeQueue = []; resumes = 0; suspends = 0; trace = [.125, -.25];
    constructor() { super(); contexts.push(this); }
    createGain() { const result = node({ gain: new Parameter() }); this.gains.push(result); return result; }
    createOscillator() {
      const result = node({ frequency: new Parameter(), start(time) { this.started = time; }, stop(time) { if (time !== undefined) this.stopped = time; } });
      this.oscillators.push(result); return result;
    }
    createDynamicsCompressor() {
      this.compressor = node(Object.fromEntries(['threshold', 'knee', 'ratio', 'attack', 'release'].map(key => [key, new Parameter()]))); return this.compressor;
    }
    createAnalyser() {
      this.analyser = node({ getFloatTimeDomainData: buffer => { for (let at = 0; at < buffer.length; at++) buffer[at] = this.trace[at % this.trace.length]; } }); return this.analyser;
    }
    change(state) { this.state = state; this.dispatchEvent(new Event('statechange')); }
    resume() {
      this.resumes++;
      if (deferredResume) return new Promise((resolve, reject) => this.resumeQueue.push({ resolve, reject }));
      this.change('running'); return Promise.resolve();
    }
    resolveResume({ reject = false, state = 'running' } = {}) {
      const next = this.resumeQueue.shift(); if (reject) next.reject(Error('Blocked')); else { if (this.state !== 'closed') this.change(state); next.resolve(); }
    }
    suspend() { this.suspends++; this.change('suspended'); return Promise.resolve(); }
    close() { this.change('closed'); return Promise.resolve(); }
  }
  if (supported) win.AudioContext = Audio;
  return { win, doc, contexts, sound: createInteractionSound({ win, doc }) };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function page(target, type, persisted = false) { const event = new Event(type); event.persisted = persisted; target.dispatchEvent(event); }

describe('audible bounded interaction audio', () => {
  it('creates no audio device until interaction, then routes one shared context to the destination', () => {
    const f = fixture(); expect(f.contexts).toHaveLength(0);
    expect(f.sound.play('collect', { form: 'shard' })).toBe(true);
    expect(f.sound.play('collect', { form: 'ring' })).toBe(true);
    expect(f.contexts).toHaveLength(1);
    const context = f.contexts[0];
    expect(context.gains[0].connections).toEqual([context.compressor]);
    expect(context.compressor.connections).toEqual([context.analyser]);
    expect(context.analyser.connections).toEqual([context.destination]);
    expect(f.sound.snapshot()).toMatchObject({ destination: true, played: 2 }); f.sound.dispose();
  });
  it('gives six forms and four eye interactions distinct midrange notes with short and longer profiles', () => {
    const f = fixture(), profiles = [];
    for (const form of ['shard', 'ring', 'lattice', 'rift', 'orbit', 'prism']) { f.sound.play('collect', { form }); profiles.push(f.sound.snapshot().lastProfile); }
    for (const kind of ['eye-pulse', 'eye-shear', 'eye-phase', 'eye-resonate']) { f.sound.play(kind); profiles.push(f.sound.snapshot().lastProfile); }
    expect(new Set(profiles.map(profile => JSON.stringify([profile.tones, profile.duration, profile.type]))).size).toBe(10);
    expect(profiles.some(profile => profile.duration <= .2)).toBe(true);
    expect(profiles.some(profile => profile.duration >= .7)).toBe(true);
    expect(profiles.some(profile => profile.notes === 3)).toBe(true);
    for (const profile of profiles) {
      expect(profile.duration).toBeGreaterThanOrEqual(.14); expect(profile.duration).toBeLessThanOrEqual(.9);
      expect(profile.notes).toBeGreaterThanOrEqual(1); expect(profile.notes).toBeLessThanOrEqual(3);
    }
    for (const oscillator of f.contexts[0].oscillators) for (const call of oscillator.frequency.calls) {
      expect(call.value).toBeGreaterThanOrEqual(300); expect(call.value).toBeLessThanOrEqual(1400);
    }
    f.sound.dispose();
  });
  it('holds an audible envelope briefly and bounds a four-voice sum below clipping', () => {
    const f = fixture(); f.sound.play('eye-pulse'); const context = f.contexts[0], envelope = context.gains[1].gain.calls;
    const peak = Math.max(...envelope.map(call => call.value)), output = peak * context.oscillators.length * context.gains[0].gain.value;
    expect(output).toBeGreaterThanOrEqual(.14); expect(output).toBeLessThanOrEqual(.2); expect(output * 4).toBeLessThan(.8);
    expect(envelope[2].value).toBe(peak); expect(envelope[2].time - envelope[1].time).toBeGreaterThan(.02);
    expect(envelope.at(-1)).toMatchObject({ kind: 'linear', value: 0 });
    expect(envelope.at(-1).time - context.currentTime).toBeLessThan(.2); f.sound.dispose();
  });
  it('separates sequence notes and keeps later notes alive until every oscillator finishes', () => {
    const f = fixture(); f.sound.play('eye-phase'); const context = f.contexts[0], oscillators = context.oscillators;
    expect(oscillators).toHaveLength(6);
    expect(oscillators[2].started - oscillators[0].stopped).toBeGreaterThan(.07);
    expect(oscillators[4].started - oscillators[2].stopped).toBeGreaterThan(.07);
    oscillators[0].onended(); expect(f.sound.snapshot().voices).toBe(1);
    for (const oscillator of oscillators.slice(1)) oscillator.onended();
    expect(f.sound.snapshot().voices).toBe(0); expect(oscillators.every(oscillator => oscillator.disconnected)).toBe(true); f.sound.dispose();
  });
  it('limits overlapping sequences to four voices and twenty-four oscillators', () => {
    const f = fixture(); for (let at = 0; at < 16; at++) f.sound.play('eye-resonate');
    expect(f.sound.snapshot()).toMatchObject({ voices: 4, oscillators: 24, contexts: 1, played: 16 });
    expect(f.contexts[0].oscillators.slice(0, 72).every(oscillator => oscillator.disconnected)).toBe(true); f.sound.dispose();
  });
  it('waits for first-gesture resume to succeed before scheduling its first sound', async () => {
    const f = fixture({ initialState: 'suspended', deferredResume: true }); expect(f.sound.play('collect', { form: 'ring' })).toBe(true);
    const context = f.contexts[0]; expect(context.oscillators).toHaveLength(0);
    expect(f.sound.snapshot()).toMatchObject({ pending: true, resuming: true, resumes: 1, played: 0 });
    context.resolveResume(); await flush();
    expect(context.oscillators.length).toBeGreaterThan(0); expect(f.sound.snapshot()).toMatchObject({ pending: false, resuming: false, played: 1, lastReason: 'scheduled' }); f.sound.dispose();
  });
  it('retains only the newest cue while one resume is unresolved', async () => {
    const f = fixture({ initialState: 'suspended', deferredResume: true });
    for (let at = 0; at < 30; at++) f.sound.play(at === 29 ? 'eye-shear' : 'eye-phase');
    const context = f.contexts[0]; expect(context.resumes).toBe(1); expect(context.oscillators).toHaveLength(0);
    context.resolveResume(); await flush();
    expect(f.sound.snapshot()).toMatchObject({ played: 1, voices: 1, pending: false, lastProfile: { kind: 'eye-shear' } }); f.sound.dispose();
  });
  it('can retry a rejected resume on the next gesture without playing the failed cue', async () => {
    const f = fixture({ initialState: 'suspended', deferredResume: true }); f.sound.play('eye-phase'); const context = f.contexts[0];
    context.resolveResume({ reject: true }); await flush();
    expect(f.sound.snapshot()).toMatchObject({ pending: false, resuming: false, played: 0, lastReason: 'resume-failed' });
    f.sound.play('eye-pulse'); context.resolveResume(); await flush();
    expect(f.sound.snapshot()).toMatchObject({ resumes: 2, played: 1, lastProfile: { kind: 'eye-pulse' } }); f.sound.dispose();
  });
  it('does not schedule when resume resolves without a running context', async () => {
    const f = fixture({ initialState: 'interrupted', deferredResume: true }); f.sound.play('eye-pulse');
    f.contexts[0].resolveResume({ state: 'interrupted' }); await flush();
    expect(f.sound.snapshot()).toMatchObject({ played: 0, pending: false, resuming: false, lastReason: 'resume-not-running' }); f.sound.dispose();
  });
  it('invalidates hidden pending requests and does not replay them after returning', async () => {
    const f = fixture({ initialState: 'suspended', deferredResume: true }); f.sound.play('eye-phase'); const context = f.contexts[0];
    f.doc.hidden = true; f.doc.dispatchEvent(new Event('visibilitychange')); expect(f.sound.play('collect')).toBe(false);
    context.resolveResume(); await flush(); expect(context.oscillators).toHaveLength(0); expect(context.state).toBe('suspended');
    f.doc.hidden = false; f.doc.dispatchEvent(new Event('visibilitychange')); expect(f.sound.snapshot().played).toBe(0);
    f.sound.play('eye-pulse'); context.resolveResume(); await flush();
    expect(f.sound.snapshot()).toMatchObject({ played: 1, lastProfile: { kind: 'eye-pulse' } }); f.sound.dispose();
  });
  it('pauses BFCache pages and resumes only from a new interaction after pageshow', async () => {
    const f = fixture({ initialState: 'suspended', deferredResume: true }); f.sound.play('glass'); const context = f.contexts[0];
    page(f.win, 'pagehide', true); expect(f.sound.play('pulse')).toBe(false);
    context.resolveResume(); await flush(); expect(context.oscillators).toHaveLength(0);
    expect(f.sound.snapshot()).toMatchObject({ disposed: false, pending: false, voices: 0 });
    page(f.win, 'pageshow', true); expect(context.resumes).toBe(1);
    f.sound.play('eye-resonate'); context.resolveResume(); await flush(); expect(f.sound.snapshot().played).toBe(1); f.sound.dispose();
  });
  it('recovers an interrupted device on the next gesture and disconnects interrupted voices', async () => {
    const f = fixture({ initialState: 'interrupted', deferredResume: true }); f.sound.play('collect', { form: 'prism' }); const context = f.contexts[0];
    context.resolveResume(); await flush(); context.change('interrupted');
    expect(f.sound.snapshot()).toMatchObject({ voices: 0, lastReason: 'interrupted' });
    f.sound.play('eye-shear'); expect(f.sound.snapshot().resumes).toBe(2);
    context.resolveResume(); await flush(); expect(f.sound.snapshot()).toMatchObject({ played: 2, state: 'running' }); f.sound.dispose();
  });
  it('samples the output analyser on demand and releases its output chain on disposal', () => {
    const f = fixture(); f.sound.play('glass'); const context = f.contexts[0], measured = f.sound.snapshot();
    expect(measured.peak).toBe(.25); expect(measured.rms).toBeCloseTo(Math.sqrt((.125 ** 2 + .25 ** 2) / 2)); expect(measured.analysisSamples).toBe(512);
    f.sound.dispose(); expect(f.sound.snapshot()).toMatchObject({ peak: 0, rms: 0, analysisSamples: 0, destination: false });
    expect([context.gains[0], context.compressor, context.analyser].every(output => output.disconnected)).toBe(true);
  });
  it('closes on disposal and ignores a late resume, while unsupported audio remains safe', async () => {
    const f = fixture({ initialState: 'suspended', deferredResume: true }); f.sound.play('talk'); const context = f.contexts[0];
    page(f.win, 'pagehide'); context.resolveResume(); await flush();
    expect(f.sound.snapshot()).toMatchObject({ state: 'closed', disposed: true, voices: 0, played: 0, pending: false, resuming: false, destination: false });
    expect(context.oscillators).toHaveLength(0); expect(f.sound.play('talk')).toBe(false);
    const unsupported = fixture({ supported: false }); expect(unsupported.sound.play('phase')).toBe(false);
    expect(unsupported.sound.snapshot()).toMatchObject({ contexts: 0, lastReason: 'unsupported' }); unsupported.sound.dispose();
  });
});
