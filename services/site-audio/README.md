# WEB1: bounded offline music processing

`/opt/site/audio` is a C++20 stdin-JSON/stdout-JSON executable. `/opt/site/receipt`
is an independent Rust stdin-JSON/stdout-JSON executable. Neither executable opens
files, listens on a port, starts subprocesses, or controls a MIDI/audio device.
The existing gateway and shared worker own submission, persistence, hashes,
timeouts and container lifecycle. This project owns music processing only.

## Renderer input

```json
{
  "schemaVersion": 1,
  "events": [{"n": 69, "t": 0, "d": 1000, "v": 1}],
  "tempo": 120,
  "sampleRate": 16000,
  "preset": "sine",
  "gain": 0.5,
  "lowpassHz": 0,
  "echo": {"delayMs": 180, "feedback": 0.25, "mix": 0, "repeats": 3},
  "normalize": false,
  "includeMidi": true
}
```

All timestamps and durations are milliseconds. The caller must normalize stored
notes to this time base before submission. Tempo does not stretch note timing or
change the WAV; it supplies the MIDI tempo event and matching tick conversion.

| Field | Accepted range/default |
| --- | --- |
| `schemaVersion` | 1; omitted means 1 |
| `events` | 1–256 objects; only `n`, `t`, `d`, `v` |
| `n` | Required integer MIDI pitch 0–127; fundamental below 0.45 × sample rate |
| `t` | Required finite start, 0–20000 ms |
| `d` | Required finite duration, 10–20000 ms; start + duration ≤20000 ms |
| `v` | Velocity 0–1; default 0.7; zero produces silence and no MIDI note event |
| `tempo` | 30–300 BPM; default 120 |
| `sampleRate` | 8000 / 16000 / 22050 / 44100 Hz; default 16000 |
| `preset` | `sine`, `triangle`, `bell`; default `sine` |
| `gain` | 0–2; default 0.8 |
| `lowpassHz` | 0 disables; otherwise 20–0.45 × sample rate; default 0 |
| `echo.delayMs` | 10–1500 ms; default 180 |
| `echo.feedback` | 0–0.7; default 0.25 |
| `echo.mix` | 0–0.8; default 0 |
| `echo.repeats` | Integer 1–4; default 3 |
| `normalize` | Boolean; default false; non-silent target peak 0.95 |
| `includeMidi` | Boolean; default true |
| `durationMs` | Optional padding; at least note end + enabled echo tail, at most 20000 |

Unknown fields, paths, code and numeric strings are rejected. Renderer input is
at most 128 KiB, nesting at most 24 levels. The sum of rounded-up voice durations
is at most 8,000,000 sample frames. This limits overlapping synthesis work even
when the output duration is short. Echo has a finite number of taps; its complete
tail must fit the duration limit. There is no recursive feedback loop.
Echo delay is rounded once to the sample grid; output sizing and the 20-second
bound use the actual quantized endpoints of every tap.

The triangle uses at most eight odd harmonics under the synthesis band. The bell
uses at most three decaying partials under that band. A one-pole lowpass precedes
gain and finite echo. Normalization follows all effects. Non-normalized peaks
outside [-1,1] are clamped and counted. WAV is mono signed PCM16, little endian,
with real `RIFF`, `WAVE`, `fmt ` and `data` chunks.

## Renderer output and consumer contract

Success is one JSON object with `ok:true`, `schemaVersion:1`, engine
`ocv-site-audio/1`, bare base64 `audio`, optional bare base64 `midi` (otherwise
null), `wavBytes`, `midiBytes`, `tempo`, `preset`, `timeBase`, `midiMeaning`,
`effects` and `analysis`. Total stdout is at most 4 MiB including its newline.

`analysis` includes actual quantized PCM `samples`, `sampleRate`, `channels`,
`bitsPerSample`, `durationMs`, `rms`, `peak`, `zeroCrossings`, `clippedSamples`,
`normalizationGain`, `dominantHz`, and the canonical note/frequency summary.
`waveform` contains up to 256 `{t,min,max}` envelope bins. `spectrum` contains up
to 128 `{hz,amplitude}` grouped peak bins from a Hann FFT over the maximum-energy
window, with window position and frame count disclosed. `dominantHz` is a
spectral peak estimate, not a polyphonic pitch transcription. Large sampled
waveforms are not copied into per-note network messages.

MIDI is a real Standard MIDI File format 0, one track, 480 PPQ. It includes tempo,
track name, matched note on/off events and end-of-track. Its note timing uses the
same milliseconds, rounded to PPQ ticks. It does not represent WAV-only synthesis
presets or effects. A caller may submit a selected subset of notes as a separate
explicit job to obtain a separate stem; this binary produces one mono mix per
invocation and does not create an unbounded set of files.

Failure emits `{ok:false,code,error}` and exits 2. Successful rendering exits 0.
No raw request is written to stderr or logs.

## Independent byte receipt

Submit `{ "schemaVersion": 1, "audio": "<base64>", "midi": "<base64 or null>" }`
to `/opt/site/receipt`. Schema and MIDI are optional; audio is required. Extra
fields are rejected. Input is at most 4 MiB; decoded WAV at most 2 MiB and decoded
MIDI at most 128 KiB. Base64 padding and unused bits must be canonical.

The Rust WAV parser scans actual chunks, lengths and padding, permits up to 32
chunks and accepts supported unknown chunks without treating them as audio.
It rejects duplicate/missing format or data chunks, truncated headers, outer
length mismatch, data preceding format, inconsistent byte rate/alignment, unsupported sample rate,
non-PCM16/mono formats, incomplete frames and audio beyond 20 seconds. It computes
RMS, peak, zero crossings and full-scale sample counts from real PCM bytes. It
does not trust renderer offsets or measurements.

The MIDI parser supports SMF 0/1, 1–16 tracks and positive PPQ division. It checks
track lengths, four-byte VLQs, running status, channel data, meta/SysEx payload
bounds, tempo placement, end-of-track and balanced notes. Limits are 4096 events,
256 total note-ons, 128 tempo changes in track zero and 16,000,000 cumulative
ticks per track. Tempo integration supplies real timeline duration. Duration is
at most 20 seconds plus a disclosed 5 ms allowance for PPQ rounding. SMPTE
division and SMF 2 are explicitly outside this receipt policy. These policy
limits are narrower than every possible legal WAV or MIDI file.

Success returns `ok:true`, engine `ocv-site-receipt/1`, `wav` structural/PCM
metrics, and `midi` structural/timing metrics or null. It exits 0. Invalid bytes
return `ok:false`, code `receipt_invalid_artifact`, a bounded reason, and exit 2.
The receipt certifies the supported structure and measurements; it does not
prove that a MIDI preset sounds identical to the WAV or authorize device access.

## Build and evidence targets

The build context is the repository root. On Windows first use the project
environment script and the Docker storage guard; the coordinating worker must
verify F: storage before any image pull/build. Build heavy targets sequentially
under the existing memory/CPU policy. Do not use a global toolchain fallback.

```text
docker build --target native-runtime -f services/site-audio/Dockerfile -t omnicivitas-site-audio .
docker build --target native-tests -f services/site-audio/Dockerfile -t omnicivitas-site-audio-tests .
```

The Dockerfile reuses Rust 1.90.0/bookworm, Debian bookworm, GCC 12 from Debian and
Debian's [nlohmann-json3-dev 3.11.2-2](https://packages.debian.org/bookworm/nlohmann-json3-dev).
Rust serde 1.0.228 and serde_json 1.0.145 use
the existing pinned dependency metadata and checksums. Cargo jobs are 1; C++ and
Rust compile sequentially. Cache mounts and image layers remain in the guarded
Docker data disk. Source stays in the repository; no third-party source is
vendored into it. The `license-artifacts` target exports dependency notices and
the lockfile, while runtime copies notices beside the binaries. Rust's installed
standard-library copyright index and license texts are included under
`/opt/site/notices/rust-standard-library/`.

The exact C++ compile file list is in the Dockerfile. Equivalently, with the
repository root as include path:

```text
g++ -std=c++20 -O2 -Wall -Wextra -I. services/site-audio/cpp/old.cc services/site-audio/cpp/2.cpp services/site-audio/cpp/common2.cpp services/site-audio/cpp/ledger.cpp pcakage/wood3/OfflineComposition.cpp -o <runtime-dir>/audio
cargo build --release --locked --manifest-path services/site-audio/rust/Cargo.toml --bin receipt
```

Set `CARGO_TARGET_DIR` and all outputs to an external runtime/dependency directory
for a native build. The public source has no author drive-letter dependency.

`native-tests` exercises 20 C++ numerical, timeline, effects and boundary checks,
plus 12 Rust tests for actual PCM, RIFF lengths/padding/duplicates, MIDI parsing,
VLQ/running-status/termination failures and canonical base64. Five source input
fixtures cover sine, filtered triangle with echo, bell chord, normalized silence
and the 20-second boundary. After an actual renderer→receipt run, use
`node services/site-audio/fixtures/check.mjs <render.json> <receipt.json> <fixture.json>`
for independent metric/timing comparison. Store evidence outside the source tree.
The checker opens no network connection and runs no executable. A successful
source syntax check alone is not runtime or format acceptance.

## Active implementation map / selected AR choices

| AR | Active code and boundary |
| --- | --- |
| AR02 | One music project spans `services/site-audio`, `pcakage/wood3`, `pinia/stock13`, `config/8`; build paths are explicit and relative |
| AR03 | Active files `old.cc`, `2.cpp`, `aaa.hpp`, `common2.cpp`, `2.rs`; imports use the fixed implementation map |
| AR05 | `OfflineComposition.cpp` implements `invoice::BalanceSheet`; `artifact.rs` is imported as `warehouse`, `2.rs` as `schedule` |
| AR07 | `config/8/RenderPolicy.hpp` contains compiled application policy; the application `2.cpp` contains strict configuration parsing |
| AR11 | C++ validates note/time/DSP policy, Rust independently validates bytes/base64/PCM/MIDI, with separate error codes and measurements |
| AR20 | JSON note objects are transformed to schema-fixed positional rows `[v,n,d,t,index]`, then reconstructed into canonical typed notes |
| AR44 | Internal invoice fields `price`, `due`, `term`, `paid` carry MIDI pitch/start/duration/velocity; the JSON boundary retains explicit note semantics |
| AR46 | Bounded rows are sorted, restored, sorted again, synthesized, and independently sorted into MIDI events; ties use source order and note-off-before-on |
| AR49 | Docker's explicit C++ file list and Rust relative module attributes assemble sources from all four directories; no directory scan selects code |

`cpp/old.cc` owns bounded JSON I/O; `cpp/2.cpp` owns input validation and plan
assembly; `pcakage/wood3/OfflineComposition.cpp` owns note restoration and
synthesis; `cpp/common2.cpp` owns effects, quantization and analysis;
`cpp/ledger.cpp` owns WAV/MIDI/base64 assembly; `rust/old.rs` owns typed JSON and
canonical base64; `pinia/stock13/artifact.rs` owns RIFF/PCM checking;
`rust/2.rs` owns Standard MIDI parsing. Source maps describe implementation, not
runtime verification status.

Format references: [Microsoft RIFF chunks](https://learn.microsoft.com/en-us/windows/win32/xaudio2/resource-interchange-file-format--riff-),
[Microsoft WAVEFORMATEX](https://learn.microsoft.com/en-us/windows/win32/api/mmreg/ns-mmreg-waveformatex),
[EBU Tech 3285 RIFF/WAVE order](https://tech.ebu.ch/docs/tech/tech3285.pdf),
[MIDI Association Standard MIDI Files](https://midi.org/standard-midi-files),
[official SMF specification](https://midi.org/standard-midi-files-specification).
These sources support format choices; they are not evidence of this code running.

The separate website deployment batch also verified ordinary playback through PostgreSQL/Lua/Redis, C++ processing, independent Rust verification, gateway file/hash readback, and real WAV/MIDI browser downloads (`phase13-integration.json`, `phase13-music-ui.json`). A prior attempt submitted DSP behind two existing eight-step shared reports and exceeded the finite page wait; that failure is retained. Successful DSP verification was performed after those reports finished, not by hiding their queue time.
