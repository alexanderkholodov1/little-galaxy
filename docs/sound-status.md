# G v0.4.0 — Sound

Local implementation and review-fix merge on 2026-10-22, branch `v0.4.0-sound`.
This handoff records automated/local evidence. Physical Android/iPhone audio unlock and
booth-speaker listening remain operator acceptance. This task does not authorize deployment.

| Roadmap bullet | State | Evidence |
| --- | --- | --- |
| Parametric Tone.js fingerprint, one scale | Done | `packages/shared/src/sound.ts`; D minor pentatonic, including the pet octave. Size lowers register and lengthens release; atmosphere changes the low-pass cutoff; mountains/craters change harmonic partials; oceans increase chorus; rings/corona feed reverb; temperature increases brightness; clouds soften attack; palette/moon colour change timbre. Every visual control reaches the audio graph. |
| Phone and focused-screen petting | Done locally | The immediate SVG specimen and shared instanced renderer apply the same damped, volume-preserving squash/stretch spring. The 3D inspector loads only on explicit inspection; petting and audio unlock also work before opening it. Tap a phone specimen; select/tap a screen object to focus it, then tap again to pet. Equivalent labelled buttons support keyboard access. Pets use the fingerprint one octave up, a short envelope, and the existing voice slot. |
| Eight-voice screen mix, global volume, phone mute, first-tap unlock | Partial acceptance | Eight monophonic slots; camera-frustum eligibility, a 10% incumbent relative-distance margin; focused/petted/new objects take priority. Gentle staggered envelopes, shared reverb, master compressor and −6 dB limiter. Global volume/mute controls; phone mute persists with guarded storage. Native context resume and silent-buffer priming happen inside a trusted tap/key gesture before the lazy import. Chromium unlock/reload/failure tests pass; physical iPhone/Android unlock remains open. |
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

## Merged bundle cost

The merged rehearsal build reports the following decimal KB estimates. These are Vite asset sizes,
not Hosting wire measurements or a measured first-load transfer. The SVG preview is in main JS;
opening the 3D inspector loads its entry, the shared renderer and the Three/R3F runtime.

| Chunk | Raw KB | Gzip KB | Loading |
| --- | ---: | ---: | --- |
| Main JavaScript | 884.14 | 274.34 | Initial phone path |
| CSS | 10.57 | 3.00 | Initial phone path |
| Audio engine and Tone | 248.49 | 61.75 | After an unmuted trusted gesture |
| Three/R3F runtime | 910.17 | 241.19 | 3D inspection or galaxy scene |
| Shared rich renderer | 10.70 | 4.23 | 3D inspection or galaxy scene |
| Phone 3D entry | 0.91 | 0.59 | Explicit inspection |
| Galaxy scene entry | 4.74 | 2.15 | Screen route |

The browser tests verify no Three/preview/renderer request before inspection and no audio-engine
request before the first gesture, including saved-mute petting after reload. License notices remain
separate payload files. Existing large-chunk and mixed Firebase import warnings remain.

## Reproducing verification

From the checkout, run sequentially (one heavy process at a time):

```sh
pnpm install --frozen-lockfile
TURBO_FORCE=true pnpm run typecheck
TURBO_FORCE=true pnpm run lint
TURBO_FORCE=true PLAYWRIGHT_BROWSERS_PATH=/home/alexamaze/bad/work/g-v0.3.0/browsers GALAXY_SCREENSHOTS=/home/alexamaze/bad/work/merge-g-v0.4.0 pnpm run test
TURBO_FORCE=true pnpm run test:rules
TURBO_FORCE=true pnpm run build:rehearsal
```

The browser path is a preinstalled local Chromium; other machines can use their normal Playwright
installation. `pnpm run test:sound` repeats just the three audio browser checks and offline evidence.
Set `GALAXY_SCREENSHOTS` to an existing scratch directory to save screenshots and measurement JSON.
The development synthetic mode uses no live galaxy subscription. Merged-run logs, screenshots
and offline measurements are under `~/bad/work/merge-g-v0.4.0/`; progress is in
`~/bad/checkpoints/merge-g-v0.4.0.md`. Verification results are recorded in the review-fix merge
section below. This supersedes the original sound-branch verification and cleanup handoff.

## Operator acceptance remaining

**Open: no physical-device or subjective listening result has been recorded.** Automated
Chromium/offline checks do not close these items. The captain supplies a deployed preview URL;
this task does not deploy. Run the checklist on that preview, not a local synthetic-only build.
Do not mark the sound milestone accepted until every row has a recorded result.

Record each run: date, preview URL and commit, device/model, OS version, browser/version, output
(built-in speaker / wired / Bluetooth / booth speaker model), hardware volume, app volume,
step/result, and any retry needed. Leave unknown details as TODO. A failure stays open with its
reproduction steps; a retry is recorded separately from first-tap success.

Required configurations (each currently **TODO / unverified**):

| Device | Browser | Output | Required checklist |
| --- | --- | --- | --- |
| Physical Android phone (model/OS: TODO) | Chrome stable (version: TODO) | Built-in speaker; repeat with intended visitor output if different | A1–A7 |
| Physical iPhone (model/iOS: TODO) | Safari (version: TODO) | Built-in speaker; repeat with intended visitor output if different | A1–A7 |
| Booth screen computer (model/OS: TODO) | Intended exhibition browser (name/version: TODO) | Actual booth speakers, at intended placement and room level | B1–B5 |

Phone steps, on **both** listed phones:

- [ ] **A1 — Cold visit / first tap.** Clear this preview origin's site data, close its tabs, and
  open `/galaxy/create` with audible hardware volume and no saved mute. Listen for silence before
  interaction. Tap the specimen once. Confirm sound unlocks without a second tap, the specimen
  squashes, and a short higher pet note is audible (not only a long ambient note). Record first-tap
  pass/fail. If suspended, record whether Enable sound appears and whether tapping it recovers.
- [ ] **A2 — Materials / pets.** Compare planet Preset 1 and Preset 2 after allowing the audition
  interval; repeat at the same size to compare material rather than pitch alone. Try star and moon.
  Listen for distinguishable tone/attack/brightness, in-scale pitches and a short octave-up pet.
  Tap rapidly, then pause at least 0.25 seconds and tap again: listen for bounded retriggers, no
  clicks or runaway loudness, and a new pet after the pause. Repeat petting in Inspect in 3D;
  enlarge the radius and tap its visible outer surface.
- [ ] **A3 — Mute / reload / unmute.** Mute, reload, pet the SVG and 3D specimens, and wait at least
  seven seconds: all remain silent and Unmute sound remains available. Unmute with a tap; confirm
  sound returns without reloading. Mute again and confirm any effect tail fades to silence.
- [ ] **A4 — Background / lock.** With sound enabled, background the browser for 15 seconds, return,
  then lock the phone for 15 seconds and return. Listen for no background playback, burst of queued
  notes, doubled mix or stuck tone. Pet on return; confirm recovery or an honest Enable sound retry.
- [ ] **A5 — Interruption.** Interrupt active audio with a call or another audio app, end the
  interruption and return. Pet and check sound resumes or offers a working Enable sound retry;
  listen for stuck notes, duplicate voices, clicks or unexpected volume jumps. Record interruption
  type and whether recovery needed a gesture.
- [ ] **A6 — Route return.** While sounding, use the internal galaxy navigation to go from
  `/galaxy/create` to `/galaxy/` and back to `/galaxy/create`. Listen for old-route audio to stop and no doubled graph on return. Pet to unlock
  the new route, then repeat the round trip while muted; saved mute must keep the return silent.
- [ ] **A7 — Record verdict.** Record A1–A6 separately, including device/browser/output details and
  first-tap versus retry results. A suspended context with a working retry does not count as a
  first-tap pass. Report any unrecovered state with exact steps.

Booth listening steps (use **50 active objects** in the captain's authorized preview/test dataset;
record the actual count and setup, with no production-data writes for this check):

- [ ] **B1 — Enable / default level.** On `/galaxy/screen`, enable sound and start at app volume
  **0.32**, with hardware volume set to the intended booth level. Listen for at least 60 seconds
  from the visitor position: distinct breathing attacks and releases, audible differences between
  objects, no persistent low/mid-frequency wash that masks individual tones, no clicks/distortion
  or accumulating reverb. Record the room/output and an explicit muddy / clear verdict.
- [ ] **B2 — Focus / pet.** Focus several different visible objects, then tap again or use Pet
  focused object. Listen for the focused design and short higher pet to remain identifiable over
  the mix. Return to Galaxy view; confirm no stuck note, abrupt loudness jump or duplicated mix.
- [ ] **B3 — Full level.** Repeat B1–B2 at app volume **1.0** with unchanged hardware volume.
  Listen for clipping/distortion, harsh peaks, masked pets and an indistinct sustained wash.
  Record default and full-volume verdicts separately; unclipped offline samples do not prove clarity.
- [ ] **B4 — Controls / lifecycle.** Sweep global volume down/up, mute/unmute, background/return and
  leave/re-enter the screen route. Confirm smooth level changes, silence when muted/hidden,
  recovery/retry on return, and no stacked voices or stuck tails. Return app volume to **0.32**.
- [ ] **B5 — Record verdict.** Record B1–B4, the two compared designs, count, listening duration,
  listener/operator, actual speakers/placement and room conditions. Explicitly answer whether the
  designs sound different and the 50-object scene is clear at default and full level. Any muddy or
  uncertain result leaves acceptance open for tuning and another listening run.

Existing v0.3 hardware acceptance and captain-owned remote CI/portfolio updates remain open in
[confirmed-review-fixes.md](confirmed-review-fixes.md); this checklist does not close them.

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

### Merged verification results

All six commands above passed locally, sequentially, with Turbo force execution and zero cached
tasks. Install was already up to date. Typecheck/lint passed in all three packages; unit tests
passed **26 shared / 9 stand / 81 web / 26 script**, plus **9 Chromium tests**. Auth/Firestore
passed **116 tests** against `demo-little-galaxy`. Rehearsal build passed both build tasks and the
privacy gate (**25 build files**). All three workspace versions and built `version.json` are **0.4.0**.
The tested code is `c0ee55e` (merge `b85db6d` plus TV layout correction); the handoff update is docs only.
All five requested review commits are ancestors of the merged branch.

The 500-object test reported **15.2125 FPS mean** (13.5–16.8) and **six draw calls** at 1920×1080,
DPR 1, Chromium SwiftShader. This reports software rendering on the shared machine; booth GPU/TV
performance remains unmeasured. Shader-error and synthetic backend-traffic assertions passed.
Offline production-graph evidence again selects **eight voices from 50 objects**, with left/right
peaks **0.14450 / 0.16640**, **zero clipping**, preset spectral distance **0.99374** and same-register
material distance **0.07526**. Physical-device and booth-speaker acceptance remain as listed above.

Inspected fresh test-run screenshots:

- `workshop-375-es-dark.png`: observing log with immediate specimen, pet/audio/3D actions, aligned
  controls, names/hosts and designed offline/history states; no overlapping controls.
- `synthetic-500-1920.png`: busiest-system finding chart, faint LOD orbit lines, legible body colours,
  and full corner QR/caption inside the viewport beneath the sound controls.
- `sound-screen-focus-1920.png`: volume, mute, focus and pet actions remain aligned above the dark
  chart. The focused-screen and normal TV QR bounds pass; 375px and 1920px overflow assertions pass.

The Playwright server and Auth/Firestore emulators shut down. Final `ss -ltn` inspection of ports
**4177, 4178, 8080 and 9099** found no listeners; there is no outstanding preview cleanup.
No deployment, push, PR, tag, read-only plan edit or assistant feature was performed.
Captain work remains: portfolio plan/changelog update, remote CI/deployed verification when
appropriate, physical Android/iPhone unlock/hangar round trips, booth GPU/TV measurement and listening.

## Confirmed sound review corrections — 2026-10-23

The confirmed code findings are fixed on `v0.4.0-sound`:

- `dd582af`: every completed instance batch recomputes its picking sphere after both matrix and
  live-count updates. Three reuses each mesh's sphere and module scratch storage after initial
  creation; this adds no per-frame arrays/objects and retains pooled bodies and live upload ranges.
  Production-frame/real-Three regressions pick the phone after radius 0.4 → 0.7 (ray x=1.8), a moved
  screen body, and an arrival in a far batch previously raycast while empty.
- `3dd831b`: the allocator gives incumbents a **10% relative-distance margin**, with explicit
  interaction priority and deterministic ties. The distance-1 candidate now displaces a distance-60
  incumbent; 5% changes retain membership and 20% improvements replace it at distances 5 and 60.
  The original 500-frame jitter test remains unchanged and passes.
- `a15f806`: last-pet time starts at negative infinity. The production scheduler/graph test emits
  the first short octave-up pet at context age **0.23 s**, suppresses rapid repeats and accepts the
  next pet after the 0.25 s interval. Browser audio nodes are doubled in this unit test; the real
  production graph is still covered by the offline browser render.

All five new regressions failed on the original implementation and pass with these changes.
The acceptance checklist above is the action for finding 2; hardware/listening is **still open**.

### Verification of the corrections

Ran these exact commands sequentially from this worktree; all exited **0**. No Turbo task was
served from cache. The Java heap cap applies to the rules emulator.

```sh
pnpm install --frozen-lockfile
TURBO_FORCE=true pnpm run typecheck
TURBO_FORCE=true pnpm run lint
TURBO_FORCE=true PLAYWRIGHT_BROWSERS_PATH=/home/alexamaze/bad/work/g-v0.3.0/browsers GALAXY_SCREENSHOTS=/home/alexamaze/bad/work/fix-g-v0.4.0/v040 pnpm run test
JAVA_TOOL_OPTIONS=-Xmx512m TURBO_FORCE=true pnpm run test:rules
TURBO_FORCE=true pnpm run build:rehearsal
```

Typecheck/lint passed in all three packages. Tests: **27 shared, 9 stand, 85 web, 26 script,
9 Chromium**. Rules: **116 passed**, `demo-little-galaxy`, followed by successful shutdown.
Build: **2 tasks passed**, privacy gate **25 files**, workspace and built versions **0.4.0**.
Existing large-chunk/Firebase import warnings remain. Main gzip is **274.35 kB**, deferred audio
**61.76 kB**, rich renderer **4.25 kB** and Three/R3F **241.19 kB**.

The unchanged 500-object synthetic browser test was run before the fix and in the full suite after:

| Chromium SwiftShader, 1920×1080, DPR 1 | Mean FPS | Samples | Draw calls |
| --- | ---: | --- | ---: |
| Before | 13.775 | 13.3, 13.0, 12.2, 14.5, 15.1, 13.6, 14.9, 13.6 | 6 |
| After | 15.100 | 15.3, 14.9, 14.2, 14.5, 15.9, 16.2, 14.3, 15.5 | 6 |

This shared-machine software measurement does not establish a speedup or booth-GPU acceptance.
The pooled renderer retains six draw calls; no steady-state frame allocation is added by the fix.
The before-only command was:

```sh
PLAYWRIGHT_BROWSERS_PATH=/home/alexamaze/bad/work/g-v0.3.0/browsers pnpm exec playwright test --config tests/ui/playwright.config.js -g '500 synthetic'
```

Focused iteration commands were `pnpm --filter @little-galaxy/web exec vitest run
src/RichBodies.test.tsx src/sound-engine.test.ts` and `pnpm --filter @little-galaxy/shared exec
vitest run src/sound.test.ts` (final results: **4/4** and **7/7**). The initial picking-only run used
`pnpm --filter @little-galaxy/web exec vitest run src/RichBodies.test.tsx` and failed before the fix.
Changed-file ESLint and `git diff --check` also passed. Logs (including expected red regressions),
screenshots and offline measurement JSON are in `~/bad/work/fix-g-v0.4.0/`; checkpoint:
`~/bad/checkpoints/fix-g-v0.4.0.md`. All started servers/emulators were stopped. No deployment or
physical-device acceptance was performed. This section supersedes the earlier local test counts.
