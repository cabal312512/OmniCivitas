import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Offline evidence checker. The caller chooses runtime files outside the source tree.
// It neither launches executables nor opens network connections.
const [renderPath, receiptPath, fixturePath] = process.argv.slice(2);
assert(renderPath && receiptPath && fixturePath, 'usage: node check.mjs render.json receipt.json fixture.json');
const render = JSON.parse(readFileSync(renderPath, 'utf8'));
const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
assert.equal(render.ok, true);
assert.equal(receipt.ok, true);
const bytes = Buffer.from(render.audio, 'base64');
assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
assert.equal(bytes.subarray(8, 12).toString(), 'WAVE');
assert.equal(bytes.readUInt32LE(4) + 8, bytes.length);
assert.equal(bytes.readUInt32LE(40) + 44, bytes.length);
assert.equal(render.wavBytes, bytes.length);
assert.equal(receipt.wav.fileBytes, bytes.length);
assert.equal(receipt.wav.frames, render.analysis.samples);
assert.equal(receipt.wav.sampleRate, fixture.sampleRate ?? 16000);
assert.equal(receipt.wav.durationMs, render.analysis.durationMs);
assert(Math.abs(receipt.wav.rms - render.analysis.rms) < 1e-12, 'independent PCM RMS differs');
assert(Math.abs(receipt.wav.peak - render.analysis.peak) < 1e-12, 'independent PCM peak differs');
assert.equal(receipt.wav.zeroCrossings, render.analysis.zeroCrossings);
if (fixture.normalize && receipt.wav.peak > 0) assert(Math.abs(receipt.wav.peak - 0.95) < 0.0001);
if (fixture.events.every(event => event.v === 0)) assert.equal(receipt.wav.rms, 0);
if (render.midi !== null) {
  const midi = Buffer.from(render.midi, 'base64');
  assert.equal(midi.subarray(0, 4).toString(), 'MThd');
  assert.equal(midi.readUInt32BE(18) + 22, midi.length);
  assert.equal(receipt.midi.fileBytes, midi.length);
  assert.equal(receipt.midi.noteOns, fixture.events.filter(event => (event.v ?? 0.7) > 0).length);
  assert(Math.abs(receipt.midi.durationMs - render.analysis.durationMs) <= 5, 'MIDI millisecond timing exceeds rounding allowance');
}
assert(render.analysis.waveform.length <= 256);
assert(render.analysis.spectrum.length <= 128);
assert(bytes.length <= 2 * 1024 * 1024);
console.log(JSON.stringify({ok: true, fixture: fixturePath, independentPcmMetrics: true,
  frames: receipt.wav.frames, durationMs: receipt.wav.durationMs, rms: receipt.wav.rms,
  peak: receipt.wav.peak, midiNotes: receipt.midi?.noteOns ?? null}));
