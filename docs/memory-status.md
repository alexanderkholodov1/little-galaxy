# G v0.6.0 — Memory

Built on `v0.6.0-memory`, with the final `v0.5.0-interactions` sound review fixes merged locally.
This is local implementation/verification evidence. No deployment, push, PR, tag, real-project
access or physical-phone acceptance occurred. The talk stub and existing assistant text remain;
no assistant, voice or talk feature was added.

| Roadmap bullet | State | Evidence |
| --- | --- | --- |
| Exact event-log timelapse with scrubber, speed and pause | Done locally | Shared replay applies complete create/launch/edit/crumble/relaunch snapshots at server timestamps. Historical Kepler motion, retained moon hosts, assembly/debris and bounded global effects use the replay clock. Home opens frozen replay when a static manifest exists; fair visitors explicitly open replay. `screenScene: timelapse` now renders it with an in-field join QR. Keyboard range Home/End, play/pause and 1×/10×/60×/300×/600× are covered in Chromium. Reaching end halts playback (playing=false, interval cleared); Home after end does not auto-play. |
| Permanent `/galaxy/o/{id}` with 3D, sound, name, date, Credits | Done locally | Public hashed shard needs one document get, including hangared specimens. Shared procedural renderer, trusted-gesture sound/pet controls, EN/ES name/type/status, original launch date, shared Credits dialog and galaxy return link, with no profile fetch or social links. Browser checks cover hangar, Credits rendering, 375px width and distinct missing/offline/retry states. No visitor sign-in surface. |
| 1080×1920 phone postcard, event title, QR/link, share/download | Done locally; device acceptance open | Offscreen capture uses the same R3F rich-body preview/light, then a 2D canvas prints name/type/date, “Be a Dragon 2026”, current-origin absolute object QR and printed short link. A separate Share tap preserves user activation; `canShare({files})` selects file share or PNG download, with cancellation/retry/download states. Real browser PNG dimensions and specimen pixels pass; pure-JS `jsqr` 1.4.0 decodes the production QR encoder output to the exact URL. Mocked file share and unsupported-share download pass. |
| `freeze-season` static JSON script, emulator tested | Done locally | Admin read-only transaction exports all objects/log/metadata in format 1, deterministic bytes, validates schemas/capacity and refuses an existing output directory. Rules integration compares two function exports and the actual CLI output file-for-file against a scripted emulator session. It proves `seasonOpen` stays true. CLI refuses non-demo/non-loopback/no emulator before admin initialization. |
| Acceptance: reconstructed session equals recorded history | Done locally | Production launch/edit/new star/relaunch helpers run against the emulator; replay is compared with actual committed object states at each action and before the first action. Historical position calculations are also compared. Compact packing, public get-only access and privacy assertions pass. |
| Acceptance: postcard shares on Android and iPhone | Not done | Physical devices were unavailable. Local Chromium with a share stub/download event proves browser branches, not OS share-sheet behavior. Captain checklist below. |

The [format and P v1.1.0 contract](memory-format.md) defines all paths, fields, fallback behavior,
capacity/read/write budgets and the emulator CLI. The fair home reads one aggregate snapshot and
prints its observation time; Refresh is explicit. Replay never scans `events` or `objects` from a
browser. The 300-object/five-action fixture takes at most five public reads; object pages take one.
Frozen browser replay issues zero Firestore/Auth requests. Public rules permit only canonical
chunk/manifest gets; lists, collection-group queries, unknown paths and client mutations are denied.
Archive publication coalesces a 30-second window; a newly launched permanent page can take that
long to become available. This is explained in its not-found state.

## Verification

Required commands run sequentially with Turbo caching bypassed, following the local upstream merge:

```sh
pnpm install --frozen-lockfile
TURBO_FORCE=true pnpm run typecheck
TURBO_FORCE=true pnpm run lint
TURBO_FORCE=true PLAYWRIGHT_BROWSERS_PATH=/home/alexamaze/bad/work/g-v0.3.0/browsers GALAXY_SCREENSHOTS=/home/alexamaze/bad/work/g-v0.6.0 pnpm run test
JAVA_TOOL_OPTIONS=-Xmx512m GALAXY_MEMORY_EXPORT_DIR=/home/alexamaze/bad/work/g-v0.6.0/export TURBO_FORCE=true pnpm run test:rules
TURBO_FORCE=true pnpm run build:rehearsal
```

Install, typecheck and lint pass. Full tests pass: **31 shared / 15 stand / 111 web / 26 scripts /
17 Chromium**. Turbo reports zero cached tasks. The complete browser suite includes the upstream
picking-bounds and sound regressions, existing interactions and all four new memory checks.
Final emulator/build results are recorded below after their sequential runs.

The shared-machine 500-object sample: 1920×1080, DPR 1, Chromium SwiftShader, **14.125 mean FPS**,
samples 18.9/12.8/13.7/14.7/11.3/13.5/13.7/14.4, **six draw calls**, no synthetic backend traffic
or shader errors. The offline sound regression selects eight voices from 50 objects with zero
clipping; existing upstream sound acceptance remains as documented. This is not booth hardware
performance or physical listening acceptance.

Targeted iteration commands (full final checks supersede earlier failures):

```sh
pnpm --filter @little-galaxy/shared exec vitest run src/season.test.ts
pnpm --filter @little-galaxy/stand exec vitest run src/memory.test.ts
pnpm --filter @little-galaxy/web run typecheck
pnpm --filter @little-galaxy/stand run typecheck
pnpm --filter @little-galaxy/web exec vitest run src/season-data.test.ts src/postcard.test.ts
pnpm --filter @little-galaxy/web exec vitest run src/season-data.test.ts src/postcard.test.ts src/App.test.tsx src/Screen.test.tsx src/Create.test.tsx
pnpm --filter @little-galaxy/web exec vitest run src/App.test.tsx src/Screen.test.tsx src/season-data.test.ts src/postcard.test.ts
JAVA_TOOL_OPTIONS=-Xmx512m GALAXY_MEMORY_EXPORT_DIR=/home/alexamaze/bad/work/g-v0.6.0/export pnpm exec firebase emulators:exec --only firestore,auth --project demo-little-galaxy 'pnpm exec vitest run --config tests/rules/vitest.config.js tests/rules/memory.test.js'
PLAYWRIGHT_BROWSERS_PATH=/home/alexamaze/bad/work/g-v0.3.0/browsers GALAXY_SCREENSHOTS=/home/alexamaze/bad/work/g-v0.6.0 pnpm exec playwright test --config tests/ui/playwright.config.js tests/ui/memory.spec.js
```

Earlier iterations caught Firestore's nested-array restriction (fixed with the documented JSON
encoded tuple table), stale foundation route assertions, a plain-component test's router context,
a cross-realm AbortError and missing browser-global lint declarations. A later targeted browser
retry found port 4177 occupied and refused to start; the full combined suite ran once it was free.
No other worker's server was stopped. Existing Vite large-chunk/mixed-Firebase-import and Three Clock
warnings remain. Full logs and inspected screenshots are under `~/bad/work/g-v0.6.0/`; checkpoint:
`~/bad/checkpoints/g-v0.6.0.md`.

The 375px specimen/postcard screenshot preserves the observing-log accession grid, printed display
type, ringed procedural body and quiet-zone QR. Replay has a dark finding chart and an aligned time
ruler with large controls; the 1920px screen retains its QR within the viewport. Layout checks cover
no horizontal overflow and 44px object actions. These local silhouette checks do not claim the
deployed-preview/physical-device verification required by AGENTS.md.

## Captain acceptance still needed

On an HTTPS preview, use one Android and one iPhone. Open a real active object's permanent URL,
check the Credits dialog and its same-site portfolio link, tap to unlock/listen, render the postcard, then invoke Share.
Confirm the native share sheet offers the PNG and the selected receiving app receives a 1080×1920
image; scan its QR on the other device and verify the exact permanent URL. Cancel once and retry.
Test an unsupported-share browser's download, saved image, ES/dark chrome, a hangared specimen,
direct URL reload and offline/reconnect. Record device, OS/browser and destination app.

For P v1.1.0, publish a reviewed complete export per the serving contract, verify static replay and
object pages with Firestore blocked, and update the read-only portfolio plan/changelog. G v1.1.0
needs the explicitly controlled production season-close/export workflow; this rehearsal CLI stays
emulator-only. Physical phones, booth GPU, remote CI, production rules and any publication belong
to the captain. No production or paid service was used here.
