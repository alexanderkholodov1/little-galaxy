# G v0.3.0 — Rich objects & hangar

Historical implementation handoff. The [confirmed review fixes](confirmed-review-fixes.md) supersede
the renderer, D6 visibility, edit-budget, phone-loading and verification details below.
See [D6 and write budgets](d6-and-write-budgets.md) for the current contract.

Implemented locally on 2026-10-22, branch `v0.3.0-objects`, on G v0.2.0.
This is a local handoff, not deployed-preview, physical-phone or booth-laptop acceptance.
No live services, credentials, deployments, pushes, PRs or tags were used.

| Roadmap bullet | State | Evidence |
| --- | --- | --- |
| Planet / star / moon controls and procedural shaders; visitor-star lighting and hosts; D6 moons | Done locally | `Create.tsx`, shared `presets`/schema, `RichBodies.tsx`, `layout.ts`; bounded controls, two presets/type, noise terrain relief, animated cloud mask, atmosphere rim, procedural rings, craters, temperature and corona. Phone and screen use the same lazy renderer. Stars occupy deterministic spiral arms and illuminate nearby bodies. D6 cases cross the emulator rules boundary. |
| Generated names in EN/ES | Done | `packages/shared/src/names.ts`: 40 adjectives × 40 nouns in each language, stable `n00-00`…`n39-39` keys, plus four legacy names. New-name button; names remain translated after a language change. Unit tests check 1,600 unique combinations per language; rules bound the key grammar. |
| Live non-destructive editing | Done locally | Debounced owner edits use a transaction containing the exact edit event, user write clock and updated object. Orbit, host, type, ownership and creation time stay fixed. Rules enforce ≥2 seconds. The production screen-listener emulator test observes edits. Draft, design/edit mode and active draft ID survive reload; unit tests exercise the workshop state machine. |
| Hangar, crumble / reassemble and D5b rocks | Done locally | Production launch/relaunch transactions archive the current object and activate the target atomically, preserving all documents and exact event snapshots. Screen removals crumble into instanced fragments; arrivals reassemble over 1.2 seconds. The phone uses the same fragments after confirmed transitions. Rocks fade for 120 seconds. Emulator round trips include the five-launch/relaunch daily maximum; UI state-machine tests cover the controls. |
| Instancing + LOD | Done locally | Shared instanced sphere batches (24×16 near, 8×6 distant), rings, corona/comet halos and fragments. Distant surfaces skip a noise octave. Uniforms carry the nearest visitor stars' positions/colours, with instance attributes as a fallback beyond 31 visitor lights. Synthetic mode is dev-only, uses no Firestore traffic, and reports fps and draw calls. |
| Acceptance: 500 objects, real-phone hangar, no free text | Partial | Final automated run: **16.75 fps mean** (9.1–19.9), 500 mixed objects, four draw calls, SwiftShader software rendering at 1440×900, DPR 1. Browser checks reject text inputs, textareas and editable content and exercise all types at 375px. Physical phone hangar and the booth laptop's GPU figure remain open. |

## Domain and security contract

New objects carry `schemaVersion: 2`. User, event, config and snapshot envelope schemas remain v1;
versions are independent. Readers accept v0.2.0 planet documents (including a missing v1 marker),
default mountains/clouds to 0.3, rings to 0 and atmosphere to the legacy palette. Unknown future
object versions are skipped. Old documents are not destructively migrated: an edit upgrades that
object; archive/relaunch preserves its stored schema and appearance.

All radii are bounded to 0.2–0.7. Ocean coverage, mountains, clouds, rings, temperature, corona and
craters are finite numbers in 0–1. Palette, atmosphere and moon colour are integer indices 0–3.
Version 2 requires every field for its type; extra keys and wrong types are rejected in shared
validation and Firestore rules. Legacy v1 planets retain their three-field parameter shape.
No generated name, appearance control or event accepts visitor text.

A star's position is a stable hash of its immutable object ID, mapped to one of three outward
spiral arms. Planets use host-relative Kepler elements. Stars have a fixed spiral position rather
than an orbit; their stored bounded orbit retains the launch gesture for history. Host mass uses
the existing normalized orbital model rather than changing with the visual size control.
The phone reads `snapshots/live` once to offer stars and choose the least crowded host (by planet
count, central star wins ties). That catalog can be up to the stand's ~30-second interval old;
reload to refresh it. Phones read their own inventory but never subscribe to the whole galaxy.

**Unclaimed** means an operator-seeded planet whose `ownerUid` is the empty string. Clients cannot
create that state, claim it, or edit someone else's planet. Snapshots expose only `unclaimed: true`,
not other visitors' owner IDs, for host selection. Unclaimed planets do not increment the creator
counter. D6 permits a moon around a planet with that marker or the same authenticated UID;
other owners, stars and missing hosts are rejected. Without an eligible planet, the phone explains
why moon launch is disabled.

Moon writes include a `hostOrbit` snapshot, checked against the real planet's orbit by rules.
Parent orbits are immutable, including through relaunch. Thus a moon can continue around its own
planet after that planet enters the hangar, and after a screen reload, without making the private
hangar public. Moon distances use 0.2 display scale around the parent's position. The deterministic
parent motion and moon elements remain available for exact later replay. Star-host positions also
remain computable when a star enters the hangar; its illumination ends when it leaves the active sky.

Archive and relaunch may change only status and update time. Live edits may change appearance and
name, never orbital data. Existing ownership, UTC-day accounting, five launches/relaunches per day,
2-second write cooldown, kill switches, exact event snapshots and recursive denial remain enforced.
An edit writes three documents, a first launch four, and a replacement/relaunch six. No additional
screen event subscription is needed for the animations. Nothing is deleted.

Fragment meshes are ephemeral presentation: each tab starts their 120-second clock when it observes
a transition. Reloading starts from the active sky; it does not replay historical fragments. Persistent
objects and event history remain intact. At most 500 departed bodies are retained for transient rocks,
with bounded instance buffers. Complete live-deploy/chunk recovery is still G v0.7.0.

## Reproducing the performance figure

```sh
pnpm --filter @little-galaxy/web dev
```

Open `/galaxy/screen?synthetic=500`. This query works only in Vite development/test; production ignores
it. The deterministic fixture contains 25 stars, 375 planets and 100 moons. It never writes or listens
to Firestore, even when public Firebase configuration exists. The fps readout uses one-second frame
samples; the browser test verifies zero Firestore/Auth requests and no shader compilation errors.

The final run used headless Chromium 156 with explicit `--use-gl=angle --use-angle=swiftshader
--enable-unsafe-swiftshader`. WebGL reported `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device
(Subzero) (0x0000C0DE)), SwiftShader driver)`. After the first non-zero meter value, eight ~1.1-second samples were
13.9, 9.1, 13.4, 19.5, 19.7, 18.9, 19.6, 19.9 fps. An earlier full-suite run measured
19.775 fps mean; software results vary on this shared machine. This measures **software rendering on this
shared machine**, not the booth laptop or a hardware-GPU 60-fps result. Repeat on the booth laptop
at its actual display resolution, with 500 objects, and record the renderer, fps, viewport and DPR.

## Verification

Final logs and inspected screenshots are under `~/bad/work/g-v0.3.0/`; the checkpoint is
`~/bad/checkpoints/g-v0.3.0.md`. No runtime dependency was added. The phone's 3D code stays lazy.
The observing-log layout, dark specimen, printed type hierarchy and calibration controls were
inspected at 375px; the sky/QR were inspected at 375px and 1440px. EN/ES, light/dark, draft reload,
offline feedback, host-empty/error states, 44px controls and no horizontal overflow are covered.

```sh
pnpm install --frozen-lockfile
TURBO_FORCE=true pnpm run typecheck
TURBO_FORCE=true pnpm run lint
TURBO_FORCE=true PLAYWRIGHT_BROWSERS_PATH=/home/alexamaze/bad/work/g-v0.3.0/browsers GALAXY_SCREENSHOTS=/home/alexamaze/bad/work/g-v0.3.0 pnpm run test
TURBO_FORCE=true pnpm run test:rules
TURBO_FORCE=true pnpm run build:rehearsal
```

All six commands passed, with Turbo cache bypassed and one heavy command at a time:

- Install: frozen lockfile unchanged; all workspace versions are 0.3.0.
- Typecheck and lint: all three packages passed, no cached results.
- Tests: shared 16, web 56, stand 7, release/privacy/workflow scripts 26, Chromium 4.
  Browser checks include all three large presets; the camera fits the largest rings/corona.
  The phone state-machine test covers restored active object → live edit → private design → relaunch.
- Rules: **58 passed** against Auth + Firestore using `demo-little-galaxy`. Every new field is tested
  at both endpoints and with invalid ranges/types/extra keys. Tests cover D6, forged parent orbits,
  immutable data, exact snapshots, daily limits and live screen edits/launch/hangar transitions.
  The two-anonymous-client launch test reached the third screen client in **145 ms**.
- Rehearsal build: web metadata reports version **0.3.0**, implementation commit **2c5a6b2**;
  both build tasks uncached. Privacy gate passed, **18 files** scanned. Main JS is **270.32 KB gzip**;
  the lazy R3F/Three runtime is **241.18 KB gzip**, shared rich renderer **3.16 KB gzip**, and lazy
  phone-preview entry **0.57 KB gzip**. No new runtime dependencies. The existing large-chunk and
  mixed static/dynamic Firebase-import warnings remain; Three is outside the initial phone bundle.
- Browser logs include expected unavailable demo-backend feedback while emulators are stopped,
  plus the existing R3F `THREE.Clock` deprecation warning. The synthetic test verifies no Auth or
  Firestore requests and no shader compilation errors.
- All test servers and emulators stopped; ports 4177, 8080 and 9099 have no listeners.
  Screenshots inspected: rich workshop, all three presets, Spanish/dark phone, and the synthetic sky.

Implementation commits: `6093c00` (domain/security), `d7ee7c9` (renderer/workshop),
`2c5a6b2` (phone camera fit). The documentation commit records the final evidence.

## Remaining acceptance

- Captain-run hangar round trip on real Android and iPhone, including swipe launch, live edit,
  new-object crumble, relaunch assembly, reload recovery, network interruption and five-launch limit.
- Booth-laptop measurement at the actual TV resolution; 60 fps has not been established here.
- Deployed preview and real-network verification. This task prohibits deployments; no deployed claim
  follows from local Chromium or demo-emulator tests.
- Real build/release uses repository variables; the rehearsal uses the committed placeholders.
  Any rules release remains operator work. Assistant/voice and new `/talk` behavior were not built.
