# G v0.3.0 confirmed review fixes

2026-10-22, `v0.3.0-objects`. Local implementation and verification only. No deployment, push,
PR, tag, service-account access or changes to the read-only portfolio plan.

## Finding ledger

| Finding | State | Implementation and evidence |
| --- | --- | --- |
| M1 | Done | `galaxy-data.ts` hydrates missing active-moon hosts by signed document get, deduplicates/prunes the cache and discards obsolete results. Supporting planets render normally in their original orbits with ownership/status unchanged. `snapshots.ts` includes them, strips ownership and excludes them from counters. Emulator tests verify complete screen/snapshot scenes, host removal and signed/public/list boundaries; snapshot unit tests cover unrelated hangar omission. [D6 implementation](d6-and-write-budgets.md). |
| M2 | Done | One `selectedHost` derived from the same deduplicated host list drives select and launch. Workshop test supplies own and unclaimed planets and verifies untouched select/launch agreement. |
| M3 | Done | `editDay` / `editsToday`, 100 edits per UTC day, enforced on `users/{uid}` and checked by the client. Rules deny forged counters/day, same-day reset and edit 101; tests allow edit 100, day reset and legacy migration. Client serializes/coalesces saves and has designed EN/ES exhaustion copy; workshop tests verify no extra write attempts after exhaustion. |
| M4 | Done | FPS output and React FPS updates are gated by DEV or `?debug=1`. Screen test pins production default and explicit debug opt-in. Synthetic fixtures remain development-only. |
| M5 | Done | `editSaving` is separate from launch/relaunch `busy`. Edits never disable the fieldset or replace inputs. Focus remains on the same control during an unresolved save; multiple intervening changes produce one latest-draft follow-up save in the workshop test. |
| M6 | Test portion done; hardware acceptance open | Synthetic browser test reports renderer, viewport, DPR, eight FPS samples, mean and draw calls. It checks liveness, bounded calls, no shader errors and zero backend traffic. Repeated SwiftShader samples vary; no stable CI performance floor is claimed. Actual booth and physical-phone acceptance remain open. |
| m1 | Done | `BodyHistory` uses Map/Set differences, skips initial/empty-reconnect assembly and prunes departed/expired births. Unit tests cover 500-body startup, unchanged reconnect, arrival and expiry; no historical 6,000-fragment startup burst. |
| m2 | Done | V1 parameters permit only `size`, `palette`, `oceans`; both rules and shared readers reject V1 stars/rich keys. Shared contract and complete negative launch-batch tests pin this. |
| m3 | Done | Star hosts must be active in the resulting launch/relaunch transaction (`getAfter`), including when the same transaction archives an owner's old star. Existing planet edits retain historical hosts/orbits. Emulator tests cover both cases. |
| m4 | Done | Snapshot-built body/light data, a balanced spatial nearest-star index, reusable positions/colours/transforms and upload-range objects replace frame allocations and stars × objects scans. All five instance batches upload only live matrix/attribute components. Tests compare 400 spatial queries with exhaustive results and verify 500/1/0 instance upload ranges. Browser checks bound total calls including merged trails. |
| m5 | Done | Constant-time own-property name validation replaces array membership in `readObject` and draft restore. Shared tests reject inherited/unknown keys and accept boundary names. |
| m6 | Done | One merged line geometry restores faint orbit finding-chart loops. LOD uses 64 segments at small counts and 24 at exhibition scale, omitting tiny moon loops there. Small-scene moon loops follow their moving parent using pooled geometry updates. Geometry tests verify closed finite loops and bounded 500-object data. |
| m7 | Done locally | At 200+ bodies, frame the busiest system's 85th-percentile path radius rather than the farthest star. Camera test checks a readable projected body diameter; 1920×1080 screenshot inspected. Chart height reserves the existing masthead/title bands; browser test ensures the full corner QR is inside the TV viewport. Physical-TV readability remains part of booth acceptance. |
| m8 | Partial | Checkout docs record schema 2, immutable `hostOrbit`, unclaimed ownership, name grammar, D6 visibility and edit budget. Portfolio plan/changelog are read-only here and need the captain's corresponding update. Historical handoffs are explicitly marked superseded. |
| m9 | Done | Name select retains every rolled name in tab-session storage, including after reload. Workshop test reselects an earlier roll. All 1,600 Spanish pairs were read as a matrix; noun/adjective choices and five pair-specific solar/glacier phrases remove awkward/redundant combinations while retaining keys and unique EN/ES names. Shared tests pin the corrections. |
| m10 | Done | Double-sided rings tilt 1.05 radians with an oblique rotation; 375px rich-planet screenshot inspected. Runtime test pins the tilt range. |
| m11 | Done | Complete negative edit/relaunch batches now cover schema downgrade, `hostOrbit` tampering, relaunch params/name changes, V1 rich keys and hangared-star hosting. Existing positive round trips remain covered. Budget probes use fresh event IDs so event immutability cannot mask the budget check. |
| m12 | Done | Immediate SVG specimen plus explicit 3D inspection keeps Three/R3F off the initial phone path. Browser test verifies no Three/preview/renderer request until inspection. Production first-load measurement below; no runtime dependency added. |
| m13 | Local checks done; remote CI unverified | All required commands pass sequentially with Turbo cache bypassed. Synthetic poll has a scoped 60-second test timeout and one browser worker. No remote CI run or publication was authorized. |

## Roadmap state

| Roadmap bullet | State | Evidence |
| --- | --- | --- |
| Planet/star/moon controls and procedural shaders; nearby star light; spiral visitor-star hosts; D6 moons | Done locally | Bounded workshop controls/presets, shared renderer, exact nearest-star spatial lookup, tightened launch-host rules and visible D6 planets. Unit/browser/emulator coverage. |
| Generated EN/ES names | Done locally | 1,600 unique generated keys/names, four legacy names, full Spanish copy audit and session selection tests. |
| Live non-destructive editing | Done locally | Coalesced saves preserve focus, immutable orbital/owner data, rules-enforced 100-edit budget and designed exhaustion state. |
| Hangar, crumble/reassembly, D5b 120-second fade | Done locally | Existing production round trips pass; live arrivals assemble, historical loads do not; bounded rocks fade and D6 hosts stay visible. |
| Instancing + LOD | Done locally | Five pooled instance batches, exact spatial lights, live buffer ranges, near/far spheres and one merged LOD trail layer. |
| Acceptance: 500 objects on booth laptop | Partial | Reported software figures below; booth GPU/TV measurement is still required. |
| Acceptance: hangar round trip on real phones | Not done | Local Chromium and emulator round trips pass; physical Android/iPhone were unavailable. |
| Acceptance: no free text | Done locally | Browser checks reject text inputs, textareas and editable content across every object type at 375px. |

## Verification

Final command results and screenshots: `~/bad/work/fix-g-v0.3.0/`.
Checkpoint: `~/bad/checkpoints/fix-g-v0.3.0.md`.

```sh
pnpm install --frozen-lockfile
TURBO_FORCE=true pnpm run typecheck
TURBO_FORCE=true pnpm run lint
GALAXY_SCREENSHOTS=/home/alexamaze/bad/work/fix-g-v0.3.0 TURBO_FORCE=true pnpm run test
TURBO_FORCE=true pnpm run test:rules
TURBO_FORCE=true pnpm run build:rehearsal
```

Local runtime: Node 24.9.0, pnpm 11.5.2, OpenJDK 21.0.12.1. GitHub uses Node 22; that remote
job is unverified here.

Install, all three typecheck/lint tasks, shared 20 / web 76 / stand 9 unit tests, 26 script tests,
6 browser tests, 116 demo-emulator tests and the build/privacy gate pass. Turbo logs show cache
bypass and zero cached tasks. Emulator tests use only `demo-little-galaxy` and shut down afterwards.
The privacy gate scans 18 build files. Existing large-chunk, mixed Firebase import and Three Clock
warnings remain; there are no shader errors. No lockfile changes or new packages.

Additional targeted iteration commands (all pass after fixes):

```sh
pnpm --filter @little-galaxy/web exec tsc --noEmit
pnpm --filter @little-galaxy/shared exec vitest run src/rich.test.ts
pnpm --filter @little-galaxy/web exec vitest run src/Create.test.tsx src/Screen.test.tsx src/galaxy-data.test.ts
pnpm --filter @little-galaxy/stand exec vitest run src/snapshots.test.ts
pnpm --filter @little-galaxy/web exec vitest run src/rich-runtime.test.ts src/chart-fit.test.ts src/orbit-trails.test.ts
GALAXY_SCREENSHOTS=/home/alexamaze/bad/work/fix-g-v0.3.0 pnpm exec playwright test --config tests/ui/playwright.config.js --grep '500 synthetic' --repeat-each=2
node /home/alexamaze/bad/work/fix-g-v0.3.0/measure-load.mjs
```

The first rules iteration exposed legacy test fixtures missing edit counters and legacy planet
appearance normalization. Those were corrected; the final complete suites above pass.

## Performance and first load

Synthetic fixture: 500 mixed objects, 1920×1080 viewport, DPR 1, Chromium SwiftShader
(`ANGLE / Vulkan / SwiftShader Device Subzero`). The final full-suite measurement was **15.75 FPS mean** (13.4–25.5), six draw calls. Three earlier
measurements of the same renderer yielded means 15.575, 14.2125 and 15.4125 FPS, with samples
spanning 12.5–20.8 FPS. This variation
on the shared software renderer is retained as printed measurement, not a CI FPS guarantee.
The final full-suite measurement is recorded in `test.log`. A booth-GPU 60-FPS result is unmeasured.

| Requested first-load asset bodies | Before | After | Change |
| --- | ---: | ---: | ---: |
| JavaScript (gzip) | 510.80 kB | 269.25 kB | -47.3% |
| CSS (gzip) | 2.81 kB | 2.86 kB | +1.9% |
| Self-hosted WOFF2 | 45.27 kB | 45.27 kB | +0.0% |
| Total assets | 558.87 kB | 317.38 kB | -43.2% |

The load probe serves the saved pre-change rehearsal build and the final build sequentially at a
local origin on port 4179, with gzip on JS/CSS, raw WOFF2, a fresh 375×812 browser context each time,
and external/backend traffic blocked. The table counts requested asset response bodies, excluding
HTML, HTTP headers and unavailable portfolio metadata. It measures loading weight, not a throttled
phone speed score. `first-load.jsonl` lists every requested asset. Opening the 3D inspector still
loads roughly 246 kB gzip of additional runtime/renderer/entry code according to Vite's report.

## Screenshot inspection

- `workshop-375-es-dark.png`: dark observing log, clear display heading, immediate blue specimen,
  aligned range scales and name/host selectors; no horizontal overflow. Explicit 3D action is visible.
  Offline/history failures explain the state and keep the saved draft and reconnect controls visible.
- `preview-planet-375.png` / `rich-workshop-375.png`: warm procedural terrain and clearly oblique rings;
  rich preview fits the phone specimen. All controls remain within the 375px width and 44px targets.
- `synthetic-500-1920.png`: 1920×1080 viewport (not a taller full-page capture), dark chart with visible
  coloured bodies around the busiest system, faint orbital loops and a fully visible large corner QR.
  Other systems may fall outside the framing percentile. FPS appears because this is a debug run.
- `screen-375.png`: join QR and truthful unknown-count/connection state remain visible at phone width.

The observatory chart and observing log remain identifiable when text is blurred. These are local
browser observations; no deployed preview, physical-phone or physical-TV acceptance is claimed.

## Commits and remaining work

- `de30b17` — retain moon hosts, daily edit budgets, tighter contracts/rules and D6 documentation.
- `41890f3` — live controls/coalescing, host selection, session names and deferred 3D inspection.
- `2728bf1` — renderer/history/lighting/upload costs, trails, framing, tilted rings and debug gating.
- `12ff736` — remaining Spanish pair-specific copy corrections with stable persistent keys.

Captain: update the read-only portfolio plan/changelog, measure on the booth laptop/TV, exercise the
hangar round trip on real Android/iPhone, and run remote CI/deployed verification when authorized.
No assistant, voice or new talk behavior was built. All task-owned servers/emulators are stopped.
