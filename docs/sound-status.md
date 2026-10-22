# G v0.4.0 — Sound

Local implementation on 2026-10-22, branch `v0.4.0-sound`, stacked on v0.3.0.
This handoff records automated/local evidence. Physical Android/iPhone audio unlock and
booth-speaker listening remain operator acceptance. This task does not authorize deployment.

| Roadmap bullet | State | Evidence |
| --- | --- | --- |
| Parametric Tone.js fingerprint, one scale | Done | `packages/shared/src/sound.ts`; D minor pentatonic, including the pet octave. Size lowers register and lengthens release; atmosphere changes the low-pass cutoff; mountains/craters change harmonic partials; oceans increase chorus; rings/corona feed reverb; temperature increases brightness; clouds soften attack; palette/moon colour change timbre. Every visual control reaches the audio graph. |
| Phone and focused-screen petting | Done locally | The immediate SVG specimen and shared instanced renderer apply the same damped, volume-preserving squash/stretch spring. The 3D inspector loads only on explicit inspection; petting and audio unlock also work before opening it. Tap a phone specimen; select/tap a screen object to focus it, then tap again to pet. Equivalent labelled buttons support keyboard access. Pets use the fingerprint one octave up, a short envelope, and the existing voice slot. |
| Eight-voice screen mix, global volume, phone mute, first-tap unlock | Partial acceptance | Eight monophonic slots; camera-frustum eligibility, distance bands and incumbent hysteresis; focused/petted/new objects take priority. Gentle staggered envelopes, shared reverb, master compressor and −6 dB limiter. Global volume/mute controls; phone mute persists with guarded storage. Native context resume and silent-buffer priming happen inside a trusted tap/key gesture before the lazy import. Chromium unlock/reload/failure tests pass; physical iPhone/Android unlock remains open. |
| Different designs; 50 active objects avoid muddy mix | Done locally; listening open | Offline renders use the production graph and allocator. Eight voices from 50 objects, full user volume, simultaneous ambient/pet stress; measured peak/RMS, zero clipping and differing spectra below. The operator still needs to judge timbre and balance through the actual booth speakers. |

## Audio contract

Fingerprints are deterministic functions of validated appearance parameters, with the same legacy
planet defaults as the renderer. The mapping preserves continuous values alongside quantized pitch:
30,000 seeded valid designs have no fingerprint collisions. Each individual control changes a graph
parameter; object/property order and generated names have no influence. Identical appearance values
produce the same fingerprint. Adjacent slider positions are not guaranteed to be perceptually
separable: finite human hearing cannot establish mathematical uniqueness.

Fundamentals use D minor pentatonic across four registers; pet fundamentals are exactly one octave
above the ambient note. Harmonic partials and chorus colour the tone without selecting another scale.
Ambient voices breathe for 1.6 seconds with long attacks/releases and roughly six-second spacing.
Changing workshop controls auditions the updated fingerprint within the next scheduler interval.
Pets replace the slot's ambient envelope; rapid pets are limited to four per second. A pet cannot
create an extra synth. Departing/invisible objects release; new selections reuse those eight slots.

The allocator is independent of input order and uses ID ties. Incumbents tolerate minor distance
jitter; sufficiently closer objects, disappearance, focus and new/pet priority can change membership.
Tests exercise 50 candidates, 500 jitter frames, visibility/departure, invalid distances and interaction
priority. Hidden tabs fade the master to zero. Unmount clears schedulers, nodes and the audio context;
a late import cannot create a graph after the route is gone.

The first page paint does not import Tone or construct an audio context. An unmuted first trusted
`pointerup` or keydown resumes the native context synchronously and primes a silent buffer, then
loads the engine. The explicit Enable sound button is also a retry. A saved mute prevents loading
and playback even when the specimen is petted. Denied storage and unavailable/suspended audio have
covered failure paths. No sound is emitted before a gesture; a browser/device may still reject audio,
which displays a retry state. Audio data is synthesized locally; it is not transmitted or persisted.

Tone.js 15.1.22 is pinned exactly. One deterministic 1.4-second convolution impulse is shared by the
voices, avoiding a reverb/worklet per object. The payload carries Tone and transitive dependency
license notices. The offline harness is never imported by the application and is absent from the
release payload.

## Offline evidence

`apps/web/src/sound-offline.ts` renders the actual `createSoundGraph` with `Tone.Offline`; the
Playwright sound test drives this browser-only harness. It creates 50 mixed synthetic objects and
runs the shared allocator, then schedules all eight chosen voices together at 0.2 seconds, all eight
pets at 4 seconds, and another ambient attack at 6.5 seconds. Stereo, 44,100 Hz, 12 seconds, user
volume **1.0** (default in the app is **0.32**). The production graph's per-voice −32 dB gain,
compressor and limiter remain in place. This deliberately stresses headroom beyond the normally
staggered ambient schedule. It does not attempt to play 50 simultaneous sources.

Measurements are stored in [sound-measurements.json](sound-measurements.json). Values are linear
full-scale amplitudes and dBFS; clipping counts samples with absolute value ≥ 1. The test requires
non-silent output, peak < 0.51, RMS < −24 dBFS and zero clipped samples on both channels.

The difference check separately renders both planet presets for three seconds, then a third variant
with preset 2's material and preset 1's size (same register). It averages three 2,048-sample Hann-window
power spectra at 0.4, 0.8 and 1.2 seconds. Distance is 1 minus cosine similarity of normalized power.
The tests require > 0.1 for the two presets and > 0.01 for materials at the same register. This proves
measurable spectral difference and headroom; subjective booth acoustics remain unmeasured.

The final render measured left/right peaks **0.14450 / 0.16640** (−16.80 / −15.58 dBFS),
RMS **0.01286 / 0.01302** (−37.82 / −37.71 dBFS), and **zero clipped samples**. Preset
spectral distance was **0.99374**; materials at the same register differed by **0.07526**.
Preset spectral centroids were **394.30 / 296.21 Hz**. These are automated measurements,
not a claim of physical-speaker listening acceptance.

## Bundle cost (before review-fix merge)

The figures in this section describe the original sound branch. Updated merged-build evidence is
recorded below after verification; the immediate phone preview now defers Three/R3F until inspection.

Against the clean stacked checkout's rehearsal build, main JavaScript changed from **270.39 to
272.62 KB gzip** (**+2.23 KB**, +6.20 KB raw). CSS changed from **2.81 to 2.93 KB gzip**
(**+0.12 KB**). The already-lazy phone preview/shared rich renderer adds another **0.16 KB gzip**.
Tone plus the audio engine is a separate **248.49 KB raw / 61.75 KB gzip** chunk fetched only on
unlock; the Three/R3F chunk stays **241.18 KB gzip**. Therefore audio adds about **2.51 KB gzip**
to the phone's initial JS/CSS/preview transfer and **61.75 KB gzip after the gesture**. Notices are
additional payload files, not automatically fetched resources. Sizes are Vite decimal KB estimates,
not Hosting wire measurements. Existing large-chunk and mixed Firebase import warnings remain.

A production-build smoke test on loopback port 4178 confirmed **zero audio-chunk requests before a
gesture, exactly one after unlock, zero page errors**, and successful cleanup/re-unlock through an
internal phone → screen route change. External backend requests were blocked during this test.

## Reproducing verification

From the checkout, run sequentially (one heavy process at a time):

```sh
pnpm install --frozen-lockfile
TURBO_FORCE=true pnpm run typecheck
TURBO_FORCE=true pnpm run lint
TURBO_FORCE=true PLAYWRIGHT_BROWSERS_PATH=/home/alexamaze/bad/work/g-v0.3.0/browsers GALAXY_SCREENSHOTS=/home/alexamaze/bad/work/g-v0.4.0 pnpm run test
TURBO_FORCE=true pnpm run test:rules
TURBO_FORCE=true pnpm run build:rehearsal
```

The browser path is a preinstalled local Chromium; other machines can use their normal Playwright
installation. `pnpm run test:sound` repeats just the three audio browser checks and offline evidence.
Set `GALAXY_SCREENSHOTS` to an existing scratch directory to save screenshots and measurement JSON.
The development synthetic mode uses no live galaxy subscription. Full test logs and inspected 375px
phone/screen screenshots are under `~/bad/work/g-v0.4.0/`; progress is in
`~/bad/checkpoints/g-v0.4.0.md`.

Final results: frozen install passed; all three packages passed uncached typecheck/lint; **24 shared,
8 stand, 71 web, 26 script and 8 Chromium tests passed**; **93 Auth/Firestore rules tests passed**
against `demo-little-galaxy`; both rehearsal build tasks were uncached and the privacy gate passed
(**25 files**). All workspace versions and built `version.json` report **0.4.0**. The existing
500-object regression reported **9.2 fps / four draw calls under SwiftShader** on this shared machine;
this does not establish booth GPU speed. Reviewed phone and focused-screen images at 375px, plus the
existing EN/ES/light/dark browser coverage. There was no horizontal overflow. The local production
smoke command was:

```sh
PLAYWRIGHT_BROWSERS_PATH=/home/alexamaze/bad/work/g-v0.3.0/browsers node /home/alexamaze/bad/work/g-v0.4.0/production-smoke.mjs
```

The scratch script starts no server; it used `pnpm --filter @little-galaxy/web preview --port 4178
--strictPort`. Automated test servers and emulators stopped (ports 4177, 8080 and 9099). The additional
preview on **4178** survived its closed command session. Command shells have isolated PID namespaces,
so a subsequent shell cannot see or signal that listener. **Host cleanup remains open**: run
`python3 ~/bad/work/g-v0.4.0/stop-preview.py` from the host terminal. The helper checks both the
listening socket and its process working directory, and signals only this checkout's listener.
The captain was asked to run it; cleanup has not been confirmed. This is an execution-environment
limitation, not an audio test failure. No live services, credentials or assistant features were used.
No branch was merged, pushed or tagged.

## Operator acceptance remaining

Use one Android and one iPhone: open the workshop with a fresh preference, verify silence before
tapping, tap the specimen to unlock/pet, adjust all materials, mute, reload, and verify muted petting
stays silent before unmuting. Repeat after backgrounding, interruption and an internal route change.
On the booth screen enable sound, focus/pet an object, adjust global volume/mute and listen with
50 active objects through the intended speakers. Record OS/browser/output and the results. A device
that remains suspended should offer Enable sound again. Check deployed behavior when the captain
publishes a preview; this local task performs no deployment. The v0.3 review fixes are now integrated. Existing v0.3 hardware acceptance remains operator work.

## Review-fix merge

Merged `v0.3.0-objects` into `v0.4.0-sound` on 2026-10-22, retaining version 0.4.0.
The confirmed review ledger in [confirmed-review-fixes.md](confirmed-review-fixes.md) applies here.
The combined renderer retains pooled frame data/live upload ranges, Map/Set history with pruned births,
spatial star lighting, merged LOD orbit trails and oblique double-sided rings alongside instance
picking and the pet spring. Galaxy view frames the busiest system; focusing still follows an object
and returning restores that chart framing. Production FPS state/readout require `?debug=1`.

The workshop retains shared host selection, coalesced live saves with enabled controls, 100 edits
per UTC day with EN/ES exhaustion feedback, session name history and corrected Spanish pairs.
D6 moon hosts remain visible without inflating creator counts. Phone first paint uses the SVG
specimen; tapping it pets/unlocks audio without loading Three. Explicit 3D inspection preserves
petting and the lazy audio engine remains gesture-only. Fingerprints, eight-voice allocation,
volume, mute persistence and unlock/retry behavior are unchanged.
