# G v0.5.0 — Global interactions and screen scenes

Built locally on `v0.5.0-interactions`, stacked on the reviewed G v0.4.0 sound release.
Physical Android/iPhone motion and booth scanning remain captain acceptance. This task performs no
publication or deployment. The operator's 2026-10-22 decision applies: no voice spike, assistant orb,
subtitles, assistant controls or new `/talk` behavior.

## Delivered behavior

- The phone's observing log has a shared-sky section. Motion permission is requested directly inside
  a tap (including iOS `requestPermission`), with two acceleration-change peaks above 16 m/s²,
  100–800 ms apart, then a ten-second detector debounce. Unsupported/insecure/denied sensors and
  missing readings after four seconds explain the manual wave button, which is always visible.
  A 900 ms coalescing window issues one shake transaction, drops concurrent samples and queues no
  trailing shake. Changing a switch or losing connectivity during that window cancels the gesture.
- A pointer-captured swipe of at least 24 px sends a normalized direction. Cancellation sends nothing.
  A labelled rightward-comet button is the keyboard alternative. The comet is ephemeral; it never
  creates a persistent object. Twelve predefined EN/ES messages live in `packages/shared`; neither
  rules nor UI accept visitor text.
- A screen-local particle curtain sweeps the dark field for six seconds. Shakes received within
  1.5 seconds share a wave; strength caps at 20 and increases its depth/brightness. Directional
  luminous tails, translated shooting-star captions and twelve staggered ambient meteors use a
  separate canvas. At most 48 effects survive, each for six seconds; no historical replay on reload.
- Scenes are `galaxy`, `bigQr`, `spotlight`, `cinematic`, `timelapse`. Legacy raw `qr` config reads as
  `bigQr`. New launch/relaunch events trigger an eight-second camera flight/caption, then return to
  the chart. `spotlight` config waits for the next launch. Galaxy/spotlight idle for `idleSeconds`
  (default 60, bounded 10–3600) enter a slow cinematic orbit; activity resumes the chart. Explicit
  cinematic config persists until changed. Manual object selection/petting still works. A dark wash
  cross-fades scene changes; the join QR remains visible. The big QR fits the field and grows at booth
  width. Timelapse explicitly announces that replay arrives in G v0.6.0. Reduced-motion preferences
  remove camera motion and moving dust/tails while keeping the interaction visible.
- A tiny signed `config/live` listener drives phone controls and screen scenes/effect switches.
  Missing, unsupported, cached-only or disconnected configuration fails closed for phone writes.
  Disabled features have honest copy and disabled/hidden controls, including launch/relaunch.
  Server rules independently enforce switches; no client can write configuration.
- The stand keeps its snapshot writer and also schedules meteors. Default random interval is 360–900
  seconds; configurable min/max must be finite and between 60–3600 seconds, min ≤ max. A config
  listener cancels timers immediately; an admin transaction rechecks the switch/season at commit.
  One server-timestamped `meteorShower` event represents twelve meteors. Invalid/missing config
  disables scheduling. Shutdown clears listeners/timers and awaits issued writes. Run one stand
  process: multiple instances would each schedule showers.

## Schema and security surface

Object schema stays **2**. User/event/config/snapshot envelopes stay **1**. Optional user fields
`interactionDay` / `interactionsToday` migrate legacy accounts on their next interaction. One UTC day
allows **10 total** shake/comet/shooting-star events per anonymous identity, alongside the existing
five launches and 100 edits. Non-interaction actions preserve this budget. A pre-launch interaction
creates a user with `activeObjectId: ''`, `launchesToday: 0`, and epoch clocks for untouched types;
its first later launch uses the normal four-write batch. Old object schemas and names remain readable.
Older write clients that replace user documents without preserving the new counters can be denied
once that identity has interacted; retain drafts and reload into this release. Safe version handoff
remains the G v0.7.0 milestone.

Each interaction is an atomic transaction writing only **event + own user**. It reads own user and
config, never other visitors or the event collection. Rules require server timestamps, matching fresh
write ID/action/event, exact counters and immutable object/launch/edit state. Cooldowns are **≥2 s**
for any write and **≥10/10/20 s** for shake/comet/shootingStar. Shake payload is empty; comet has only
finite bounded `dx`/`dy` in [-1,1], squared magnitude ≥0.01; shootingStar has only an allowlisted
`messageKey`. Event mutation/deletion and client meteor writes remain denied.

The signed screen can now **list recent events**, with an enforced maximum of 100 results and a
lower timestamp bound within the preceding 120 seconds. Direct event gets, unlimited/history queries,
unsigned reads and other users' records remain denied. The actual screen query is
`at > now - 60 seconds`, ordered ascending with `limitToLast(100)`, rebased every 45 seconds. The
120-second rule envelope permits the 45-second listener lifetime plus modest clock/network skew.
No composite index is needed. Server-confirmed events are deduplicated across rebases/reconnects;
invalid/unknown schemas and events older than ten seconds are not animated. This is a bounded live
window, not the future timelapse read surface. A >100-event burst may shed older visual effects;
the immutable event log remains complete. Anonymous auth gates reads; it cannot prevent quota abuse
through additional identities. Recent event documents include anonymous UIDs and launch snapshots,
just as the signed active-object surface already includes anonymous owner IDs.

## Document access budgets

Conservative rule access counts, **without cache savings** (limits: 10 per write, 20 per transaction):

| New/changed path | get | getAfter | exists | Total |
| --- | ---: | ---: | ---: | ---: |
| Initial pre-launch interaction user | 0 | matching event: 1 | 0 | 1 |
| Existing interaction user (including daily budget) | 0 | matching event: 1 | 0 | 1 |
| Shake/comet/shootingStar event | config: 1 | user: 1 | 0 | 2 |
| Recent event list / signed config get | 0 | 0 | 0 | 0 |

An interaction costs **3/20 accesses**, maximum **2/10** on one write. New budget checks use only
`resource`/`request.resource` and add zero accesses to existing launch/edit/relaunch paths. Existing
maxima stay hosted replacement **18/20**, hosted relaunch **15/20**, hosted first launch **10/20**;
central first launch **9/20**, edit **5/20**. See [the existing table](review-fixes.md) and
[D6/edit contract](d6-and-write-budgets.md). Admin meteor/control writes bypass rules; each admin
transaction reads config once and writes one document. Emulator tests exercise these complete paths.

## Quota estimates

A crowd of 300 identities can write at most **6,000 global-interaction documents/day** (300 × 10 × 2),
regardless of shaking duration, reloads, tabs or gesture frequency. Sensor and UI aggregation further
reduce bursts; malicious clients still meet the rule cap. Extra anonymous identities can evade the
per-identity cap. This is not a project-wide quota lock.

A planning visitor with one first launch (4 writes), three edits (9), and all ten interactions (20)
costs **33 writes**. At 300 visitors: 9,900, plus 2,880 stand snapshots over 24h and approximately 137
meteor events at the default mean interval: **~12,917 writes/day**, under 20,000. The existing 100-edit
and five-launch maxima are not a guarantee that every visitor can consume every budget. Watch the
project's actual quota; disable interactions and launches if needed. Multiple stand processes, more
visitors, edits, operator config changes and retries change this estimate.

Screen events cost one read per new event; cursor-based rebasing from the latest seen event timestamp
eliminates re-query overlap, with at least one read per empty reattach (~1,920/day at continuous 24h uptime).
Thus conservatively **1.0 × events + 1,920 reads/day**, bounded to 100 documents per attach. For 600 launch/create,
900 edit, 3,000 interaction and ~137 meteor events (4,637 total events): **~6,557 screen-event reads/day**
(saving ~6,214 daily reads compared to overlapping re-queries). Additional screen/stand active-object listeners
read initial objects and changes. Phone interactions read 20 own/config docs at the daily cap; conservatively
include 30 extra dependent rule reads. With launch/edit/initial-inventory/snapshot/config reads, the example is
roughly **85 reads/visitor**, 25,500 for 300. A single screen and stand, ~500 initial objects and ~1,200 changes each,
meteors and rebases bring this to about **~35,800 reads/day**, safely under the Spark tier's 50,000 daily read ceiling
(before public snapshot consumers, operator config updates, D6 host fetches, errors/retries and extra displays).
A config change fans out to every connected phone/screen/stand; each extra display also duplicates listeners.
These are estimates, not measured Spark billing or a guarantee. Run during booth hours, avoid gratuitous config
changes, and monitor both 20k writes and 50k reads. Phones never listen to global events or objects.

## Operator commands (admin SDK only)

After starting the isolated demo emulators, seed/open a demo season as in the README. In another shell:

```sh
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_PROJECT_ID=demo-little-galaxy
pnpm --filter @little-galaxy/stand control scene bigQr
pnpm --filter @little-galaxy/stand control scene galaxy
pnpm --filter @little-galaxy/stand control flag shake off
pnpm --filter @little-galaxy/stand control flag meteorShowers on
pnpm --filter @little-galaxy/stand control timing idleSeconds 60
pnpm --filter @little-galaxy/stand control timing meteorMaxSeconds 900
pnpm --filter @little-galaxy/stand control timing meteorMinSeconds 360
pnpm --filter @little-galaxy/stand start
```

Flags: `launches`, `comets`, `shake`, `shootingStars`, `meteorShowers`, `seasonOpen`; values `on|off`.
Timing: `idleSeconds` 10–3600, meteor min/max 60–3600. Controls update only allowlisted fields on an
existing config; they never provision/open a new season. Configure valid min/max in the appropriate
order. The command exits after one transaction. Without a demo emulator or the operator's configured
admin connection it fails without loading inline credentials. The normal start command remains inert
without either connection. No client operator UI or assistant tools are added.

## Verification and acceptance

All required checks passed locally, sequentially, with Turbo cache bypassed. This is local CI-equivalent
verification; no remote GitHub Actions run or deployed preview was performed. Implementation/artifact
commit: `2e1f2e0`; final documentation follows separately. All three package versions and built
`version.json` report **0.5.0**. The build metadata records `2026-10-23T00:48:48.681Z`.

| Roadmap bullet | State | Evidence |
| --- | --- | --- |
| Shake, swipe comets, predefined messages, ambient meteors | Done locally | Permission/threshold/null-reading and fallback tests; burst coalescing and switch-race tests; normalized/cancelled pointer gestures; all 12 EN/ES keys; rendered pixels/crowd strength/Spanish star text in Chromium; admin scheduler and event writes against the demo emulator. |
| Cooldowns in rules | Done | 174 emulator tests, including 2/10/10/20 clocks, complete invalid payload batches, standalone/spoofed writes, initial accounts, 10/11/day reset, migration and forged budgets. |
| Five config-driven screen scenes | Done locally | Live scene/spotlight-return/idle state test; actual camera focus regression; dedicated big-QR bounds and timelapse-placeholder browser checks; dark scene wash and smooth camera interpolation. |
| Live kill switches | Done locally | Signed config subscription fails closed; phone launch/relaunch/interaction controls and pending gestures respect switches; emulator denies disabled writes independently. Admin CLI allowlist/transaction tested. |
| Voice spike | Not done — explicitly excluded | Deferred to CASPIAN by the operator. Existing talk stub and assistant text retained; no new assistant behavior or scene. |
| Real Android and iPhone acceptance | Not done — captain work | Local mocks/emulators/Chromium establish no physical sensor, iOS or Android acceptance. Checklist below. |

Exact final commands (log redirection omitted):

```sh
pnpm install --frozen-lockfile
TURBO_FORCE=true pnpm run typecheck
TURBO_FORCE=true pnpm run lint
TURBO_FORCE=true PLAYWRIGHT_BROWSERS_PATH=/home/alexamaze/bad/work/g-v0.5.0/browsers GALAXY_SCREENSHOTS=/home/alexamaze/bad/work/g-v0.5.0 pnpm run test
JAVA_TOOL_OPTIONS=-Xmx512m TURBO_FORCE=true pnpm run test:rules
TURBO_FORCE=true pnpm run build:rehearsal
```

- Install: frozen lockfile unchanged; no new dependency.
- Typecheck/lint: all three packages; zero cached tasks. Root script/test lint also passed.
- Tests: **28 shared, 99 web, 11 stand, 26 script, 13 Chromium**. The full test command passed twice;
  the second run includes the final timelapse layout correction. Auth/Firestore: **174 passed**,
  only `demo-little-galaxy`; emulators stopped afterward. The meteor scheduler test injects its timer
  to fire the asserted 630-second random interval immediately, then uses the real admin transaction;
  it verifies one logged shower, rescheduling, switch-off and cleanup without waiting ten minutes.
- Rehearsal build: both build tasks uncached; **privacy gate passed, 28 files**. The final build follows
  the timelapse correction. The existing large-chunk and mixed Firebase import warnings remain, as
  does Three's development Clock deprecation warning; shader-error assertions pass.
- The final 500-object sample at **1920×1080, DPR 1, Chromium SwiftShader** reports **14.525 mean FPS**,
  samples 18.1/12.5/12.8/14.1/16.4/13.6/14.0/14.7, **six draw calls**, no backend traffic or shader
  errors. The previous run averaged 13.7125 FPS. These are shared-machine software measurements,
  not a booth GPU result or a stable performance floor.

Final Vite sizes (decimal kB, gzip): main JS **267.88** (raw 865.65), CSS **3.64** (raw 13.50), lazy
interaction controls **3.28**, shared interaction data **1.17**, lazy screen **10.83**, galaxy entry
**2.24**, Three/R3F **241.19**, rich renderer **4.25**, audio **61.75**. The phone loads no Three until
inspection and no Tone until a gesture, as verified by Chromium. The screen module, QR generator and
particle rendering are outside the phone's initial main module. These are chunk sizes, not measured
Hosting transfers or a physical-phone speed score.

Screenshots inspected in `~/bad/work/g-v0.5.0/`: `interactions-1920-es.png` (stronger crowd curtain,
meteor/comet tails, translated message, intact corner QR); `big-qr-1920.png` (~659px QR within the
TV chart); `interaction-controls-open-375-es.png` (instrumented open config, permission denied,
visible manual wave, swipe and 44px actions); `interaction-controls-375-es-dark.png` (truthful
unavailable controls); `timelapse-375-es.png` (settled placeholder with the creator reading hidden,
no overlap); and the unchanged workshop/sound/500-body regression images. The observing-log strips
and dark finding chart remain recognizable in the five-second silhouette check. Physical/deployed
verification is still required by AGENTS.md and belongs to the captain.

Iteration commands also used (all pass in the final complete suite):

```sh
PLAYWRIGHT_BROWSERS_PATH=/home/alexamaze/bad/work/g-v0.5.0/browsers pnpm exec playwright install chromium
pnpm --filter @little-galaxy/shared exec vitest run src/interactions.test.ts
pnpm --filter @little-galaxy/stand exec vitest run src/control.test.ts src/stand.test.ts
pnpm --filter @little-galaxy/web exec vitest run src/motion.test.ts src/screen-effects.test.ts src/Screen.test.tsx src/Create.test.tsx
pnpm --filter @little-galaxy/web exec vitest run src/Interactions.test.tsx src/motion.test.ts src/screen-effects.test.ts src/Screen.test.tsx src/Create.test.tsx
pnpm --filter @little-galaxy/web exec vitest run src/App.test.tsx src/Create.test.tsx src/Interactions.test.tsx src/Screen.test.tsx src/motion.test.ts src/screen-effects.test.ts src/live-config.test.ts
pnpm --filter @little-galaxy/web exec vitest run src/App.test.tsx src/interaction-data.test.ts src/Interactions.test.tsx src/Screen.test.tsx
pnpm --filter @little-galaxy/web exec vitest run src/Create.test.tsx src/Interactions.test.tsx
PLAYWRIGHT_BROWSERS_PATH=/home/alexamaze/bad/work/g-v0.5.0/browsers GALAXY_SCREENSHOTS=/home/alexamaze/bad/work/g-v0.5.0 pnpm exec playwright test --config tests/ui/playwright.config.js tests/ui/interactions.spec.js
git diff --check
ss -ltn '( sport = :4177 or sport = :4178 or sport = :8080 or sport = :9099 )'
```

Initial iterations corrected an expected motion trace, client-error assertion matchers (cooldown/
closed errors happen before rules), lazy-screen test settling, a missing browser global declaration,
and an actual batched-state autosave retry race after a gesture used the common write clock. Final
screenshot review found/fixed a creator-count overlap in the phone-width timelapse placeholder;
the complete test suite and build were repeated. The stand, SDK credentials and live data were never
started/accessed outside the demo emulator. Logs retain the iteration failures and final passes.
All test servers and emulators are stopped; the four ports above have no listeners.

Implementation commits:

- `91fb2b2` — shared bilingual interaction/scene contracts and admin controls/meteor scheduler.
- `91a2d13` — budgeted interaction batches, pre-launch identities, recent event reads and rule budgets.
- `3560d8f` — lazy phone controls, motion permission/fallback, live switches and edit cooldown recovery.
- `4defeeb` — sky effects, scenes/camera and browser regressions.
- `2e1f2e0` — clear timelapse placeholder and its browser regression.

The read-only portfolio plan/changelog need the captain's corresponding update. Remote CI, any
publication, physical devices and booth scanning/performance remain captain work. No push, PR,
merge, tag, deployment, branch deletion or history rewriting was performed.

## Operator acceptance remaining

**Open: physical Android and iPhone sensor motion and booth screen acceptance remain unverified on real hardware.**
Local Chromium/SwiftShader automation and synthetic sensor tests establish algorithm correctness, but do not close physical acceptance.
The captain supplies a deployed HTTPS preview channel (sensor APIs like `DeviceMotionEvent.requestPermission` require a secure context; plain LAN HTTP denies sensor access).
Do not mark the G v0.5.0 interaction milestone accepted until every row has a recorded result on real hardware.

### Required configurations (each currently TODO / unverified)

| Device | Browser | Connection | Required checklist |
| --- | --- | --- | --- |
| Physical iPhone (model/iOS: TODO) | Safari stable (version: TODO) | HTTPS preview URL | M1–M8 |
| Physical Android phone (model/Android: TODO) | Chrome stable (version: TODO) | HTTPS preview URL | M1–M8 |
| Booth screen computer (model/OS: TODO) | Intended exhibition browser (name/version: TODO) | Booth TV / large display (1080p+) | S1–S6 |

Record each run in the release ledger: date, preview URL and commit SHA, device/model, OS version, browser/version, step/result, and any retry needed. Leave unknown details as TODO. A failure stays open with reproduction steps.

### Mobile interaction checklist (M1–M8), run on BOTH physical phones:

- [ ] **M1 — Sensor permission & unlock (Safari / Chrome).**
  - **Steps:** Navigate to `/galaxy/create` on a cold browser session (no cached permission). Scroll down to the shared-sky section.
  - **Action:** Tap the "Enable motion" control.
  - **What counts as pass:**
    - On iOS Safari, the native dialog *"“...web.app” Would Like to Access Motion and Orientation"* appears immediately in response to the tap without delay or requiring a second tap.
    - Granting permission transitions the UI to the listening state ("Listening for shakes...").
    - If permission is denied, the UI displays the honest permission denied notice and reveals the always-visible manual wave button.
    - On Android Chrome, if permission is granted by default on secure origin, sensor listener attaches immediately.
- [ ] **M2 — Shake threshold & casual motion rejection.**
  - **Steps:** Hold the phone in hand while walking, tilting, and gently handling it for 30 seconds.
  - **Action:** Then perform two deliberate shakes (jolt peak acceleration > 16 m/s², 100–800 ms apart).
  - **What counts as pass:**
    - Walking and gentle handling trigger **zero** accidental shakes.
    - Two deliberate shakes reliably trigger the shake event ("Wave sent!"), initiate the 10-second cooldown timer countdown, and coalesce rapid shake bursts into a single transaction without multi-write errors.
- [ ] **M3 — Manual wave fallback button.**
  - **Steps:** Tap the manual wave button (`Send aurora wave`).
  - **What counts as pass:**
    - The wave transaction is submitted atomically to Firestore.
    - The 10-second cooldown countdown starts immediately on the phone.
    - The button is disabled during cooldown with tabular seconds remaining.
- [ ] **M4 — Comet pointer swipe gesture.**
  - **Steps:** In the comet swipe pad, test short gestures (< 24 px), cancelled gestures (touch moves off target or touchcancel), and deliberate swipes in 4 directions (up, down, left, right). Also test the keyboard/button alternative.
  - **What counts as pass:**
    - Swipes under 24 px or cancelled swipes send nothing and consume no quota.
    - Deliberate swipes (> 24 px) emit an ephemeral comet event with normalized direction $(dx, dy)$ and enter the 10-second cooldown.
    - The accessible comet button emits a rightward comet.
- [ ] **M5 — Predefined shooting star messages (EN / ES).**
  - **Steps:** Switch UI language between English and Spanish via the language toggle. Open the shooting-star message dropdown and select 3 different messages. Send one.
  - **What counts as pass:**
    - Dropdown lists all 12 predefined messages matching the current language without untranslated keys.
    - Sending writes `{ type: 'shootingStar', payload: { messageKey } }` with the allowlisted key and enters the 20-second star cooldown.
    - No free text input is present anywhere in the UI.
- [ ] **M6 — Cooldown enforcement & daily 10-interaction cap.**
  - **Steps:** Perform interactions consecutively until 10 interactions are used in a single UTC day.
  - **What counts as pass:**
    - The global 2-second rate limit prevents rapid multi-tapping across all controls.
    - Cooldown countdowns display truthful remaining seconds.
    - Upon reaching the 10th interaction, the daily cap message appears ("Daily interactions used up..."), all interaction controls disable gracefully, and reloading the page retains the exhausted daily budget without resetting.
- [ ] **M7 — Background / lock / resume & offline behavior.**
  - **Steps:** With active sensors, background the browser for 15 seconds, lock the phone, and return. Disconnect Wi-Fi/cellular and attempt an interaction.
  - **What counts as pass:**
    - No queued shake bursts fire upon resuming from background.
    - Sensor listeners cleanly recover or provide a manual retry.
    - Disconnection shows the honest offline status; gestures do not buffer and fire unexpectedly on reconnection.
- [ ] **M8 — Object workshop editing & season kill switch honesty.**
  - **Steps:** In `/galaxy/create`, adjust a slider on an active launched object. Wait 2.2s for debounced autosave. Then have the operator disable `seasonOpen` via stand CLI (`control flag seasonOpen off`).
  - **What counts as pass:**
    - When `seasonOpen` is true, autosave saves cleanly ("In the sky · edits appear live").
    - When `seasonOpen` is false, editing pauses without submitting failing writes, displaying `"The launch window is closed. Your design is saved here."` instead of an unhandled `PERMISSION_DENIED` or failed red error state.

### Booth screen display checklist (S1–S6), run on the booth screen computer:

- [ ] **S1 — Real-time effects rendering on the dark chart.**
  - **Steps:** Trigger a phone wave, swipe a comet, send a shooting star, and trigger a meteor shower from the stand CLI.
  - **What counts as pass:**
    - Phone shake displays a dust curtain / aurora wave sweeping the screen canvas for 6 seconds. Multiple simultaneous shakes visibly coalesce into a brighter/stronger wave.
    - Comet swipe displays a directional luminous tail.
    - Shooting star displays the translated caption matching the screen language.
    - Meteor shower displays 12 staggered meteors across the sky.
    - Frame rate remains smooth (> 30 FPS on booth GPU) without memory leaks over 30 minutes of continuous effects.
- [ ] **S2 — Five config-driven scenes.**
  - **Steps:** Using the stand CLI (`control scene <scene>`), cycle through `galaxy`, `bigQr`, `spotlight`, `cinematic`, `timelapse`.
  - **What counts as pass:**
    - `galaxy`: standard interactive observatory finding chart with live visitor orbits and corner QR.
    - `bigQr`: QR code expands up to 760 px, centered, readable from across the booth.
    - `spotlight`: camera focuses on the next newly launched object for 8 seconds, then returns smoothly to the galaxy view.
    - `cinematic`: slow dramatic camera orbit persists until changed.
    - `timelapse`: truthful announcement indicating full replay arrives in G v0.6.0.
    - Dark wash cross-fades smoothly between scene transitions.
- [ ] **S3 — Idle camera orbit.**
  - **Steps:** Leave the screen in `galaxy` scene with zero mouse/keyboard activity for `idleSeconds` (default 60s).
  - **What counts as pass:**
    - Screen automatically transitions into slow cinematic camera orbit after 60 seconds of inactivity.
    - Moving the mouse or tapping the screen instantly returns to the finding chart.
- [ ] **S4 — Booth QR readability.**
  - **Steps:** Stand at the typical visitor booth distance (~2–3 meters from the TV).
  - **Action:** Scan the corner QR in `galaxy` scene, and scan the expanded QR in `bigQr` scene using both iPhone and Android camera apps.
  - **What counts as pass:**
    - Both QR codes scan reliably without optical distortion or chromatic aberration.
- [ ] **S5 — Stand meteor scheduler.**
  - **Steps:** Start the stand daemon (`node apps/stand/dist/index.js`).
  - **What counts as pass:**
    - Stand scheduler logs ambient meteor showers at randomized intervals (360–900s).
    - Stand admin transaction commits successfully; screen renders the meteor shower.
    - CLI switch `control flag meteorShowers off` pauses scheduling.
- [ ] **S6 — Long-running stability & zero read amplification.**
  - **Steps:** Leave the screen display running for 2 hours with periodic interactions.
  - **What counts as pass:**
    - `listenRecentEvents` rebases every 45s using the cursor of the last seen event without reading duplicate events.
    - Memory usage remains flat; no WebGL context loss or gRPC channel timeouts.

## Inherited sound review fixes — 2026-10-23

Normal local merge **`ff71757`** brings in `v0.4.0-sound` at **`1d0fce2`**, with parents
`15499fa` (the existing interactions implementation) and `1d0fce2`. It merged without conflicts.
The merge changes only seven sound renderer/allocator/engine/test/documentation files. The existing
interaction UI, screen scenes/camera, effects, live switches, stand scheduler, data helpers and rules
are byte-for-byte unchanged from `15499fa`; all three package versions remain **0.5.0**.

Inherited commits:

- `dd582af`: refresh reusable instance picking spheres after matrices/live counts change; real Three
  regressions hit an enlarged phone preview, a moved screen instance and a newly populated far batch.
- `3dd831b`: replace the fixed retention bonus with a **10% relative-distance margin**. The original
  jitter test passes, alongside a substantially nearer candidate replacing an incumbent at two scales.
- `a15f806`: start last-pet time at negative infinity; the first pet at **0.23 s** context age plays
  the short octave-up note, rapid repeats are suppressed and the next spaced pet plays.
- `1d0fce2`: exact physical Android Chrome, iPhone Safari and booth-listening operator checklist in
  [sound-status.md](sound-status.md#operator-acceptance-remaining), plus the v0.4.0 verification evidence.

All five new regression tests failed before their respective fixes and pass on this merged branch.
Sound acceptance remains partial: no physical mobile unlock/recovery or subjective booth-speaker
listening was performed. The existing motion/QR/hardware checklist, remote CI and captain-owned
portfolio plan/changelog updates remain open. The excluded voice spike stays excluded; no assistant
or `/talk` behavior was changed.

### Verification after the merge

Ran these exact commands sequentially in the v0.5.0 worktree; **every command exited 0**, with
**zero cached Turbo tasks**. No heavy command overlapped another command started by this task.

```sh
pnpm install --frozen-lockfile
TURBO_FORCE=true pnpm run typecheck
TURBO_FORCE=true pnpm run lint
TURBO_FORCE=true PLAYWRIGHT_BROWSERS_PATH=/home/alexamaze/bad/work/g-v0.3.0/browsers GALAXY_SCREENSHOTS=/home/alexamaze/bad/work/fix-g-v0.4.0/v050 pnpm run test
JAVA_TOOL_OPTIONS=-Xmx512m TURBO_FORCE=true pnpm run test:rules
TURBO_FORCE=true pnpm run build:rehearsal
```

- Frozen install was up to date; no dependencies or lockfile changed.
- Typecheck and lint passed for all three packages, plus root lint.
- Tests passed: **29 shared, 11 stand, 103 web, 26 script, 13 Chromium**. These include the existing
  interactions/scenes/kill-switch and bounded-backend browser checks, plus all inherited regressions.
- Rules: **174 passed**, using only **`demo-little-galaxy`**, Java heap **512 MB**; the command logged
  full Auth/Firestore/hub/logging shutdown and exited successfully.
- Rehearsal build: **2 uncached tasks passed**, privacy gate **28 files**. Package/built versions
  remain **0.5.0**. Gzip: main **267.89 kB**, audio **61.75 kB**, rich renderer **4.26 kB**, Three/R3F
  **241.19 kB**. Existing chunk-size/Firebase import warnings remain.
- The 500-object run reports **11.0125 mean FPS**, samples **16.5, 9.7, 9.9, 12.3, 11.4, 7.9, 9.5,
  10.9**, **six draw calls**, Chromium SwiftShader, **1920×1080 / DPR 1**. This is a separate v0.5.0
  shared-machine sample, not the v0.4.0 before/after comparison or a booth performance claim.
  The v0.4.0 comparison is **13.775 → 15.100 FPS**, six calls in both, recorded in sound-status.
- Real offline audio graph: **eight voices from 50 objects**, zero clipping; preset spectral distance
  **0.99374**, same-register material distance **0.07526**. This remains signal evidence, not listening.

The tested implementation is merge `ff71757`; this handoff is a documentation-only follow-up.
`git diff --check` passes. Logs, screenshots and measurements are under
`~/bad/work/fix-g-v0.4.0/` (`v050-*` logs and `v050/` images); checkpoint:
`~/bad/checkpoints/fix-g-v0.4.0.md`.

Playwright's server exited and the rules command logged successful emulator shutdown. The
4177/8080/9099 ports were free before the rules run. Other emulator listeners appeared after that
command exited (8080/4400/9150, followed by 9099/4500); their owning processes are not visible in
this command's isolated PID namespace. They were left untouched. No server is retained by this task.
No deployment, push, PR, tag, branch deletion, history rewrite or plan edit was performed.
