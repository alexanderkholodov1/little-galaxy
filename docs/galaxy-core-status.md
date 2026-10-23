# G v0.2.0 — Galaxy core

Local implementation and verification on 2026-10-22, branch `v0.2.0-core`.
This is not a deployed or real-device acceptance report. No credentials were inspected,
no live project was accessed, and nothing was deployed or pushed.

## Milestone evidence

| Roadmap item | State | Evidence |
| --- | --- | --- |
| Screen: 3D scene, central star, QR, counter | Done locally | `Screen.tsx`, lazy `GalaxyScene.tsx`; central emissive star with additive halos, orbit paths and timestamp-driven motion. SVG QR encodes the absolute current-origin `/galaxy/create`. Count means active anonymous identities; unknown stays unknown. Browser checks and screenshots at 375px/1440px. |
| Phone: basic planet, private preview, swipe launch | Done locally | `Create.tsx`; palette, radius and oceans; generated-name choices; lightweight SVG preview, pointer capture/cancellation, accessible gentle-launch button. Validated localStorage draft; own active object recovered after reload. English/Spanish, light/dark, confirmation/error/offline states. |
| Shared orbital model | Done | `packages/shared/src/orbit.ts`, `orbit.test.ts`; analytic energy/angular momentum, bounded elements, deterministic Kepler solver. Escapes and stellar falls become closed eccentric ellipses; tests verify finite period and return to the launch point. |
| Data, launch batch, rules and rate limits | Done locally | Shared types/schema, `galaxy-data.ts`, `firestore.rules`, `tests/rules/core.test.js`. First launch, replacement, relaunch and edit batches; per-type events, UTC day reset, five launches/day, 2/10/10/20-second cooldowns, ownership, immutable fields, public read limits, kill switches and recursive denial tested. |
| Stand snapshots every ~30 seconds | Done locally | `snapshots.ts`; one cached admin listener, immediate initial snapshot and 30-second timer, bounded compact payload, no overlapping flushes, shutdown cleanup. Emulator test verifies initial state, subsequent timestamp and a second visitor. |
| Acceptance: two real phones, ≤2-second appearance, invalid writes, returning comet | Partial | Auth/Firestore emulator test uses two anonymous identities and a third screen client, measuring from launch start until both documents arrive with a hard two-second deadline. Invalid writes and comet return pass automated checks. Physical phones, real network and deployed URL remain unverified. |

## Data and security contract

`packages/shared` owns domain interfaces, schema version, render readers, palette, name keys and
orbital calculations; web, stand and emulator fixtures import them. Firestore's separate rules
language enforces the same bounds at the trust boundary. v1 currently accepts planets only;
visitor stars/moons and richer shaders remain G v0.3.0. No free text is accepted.

Objects, users, events, config and snapshots carry `schemaVersion: 1`. Readers treat a missing
object version as v1 and skip unknown future versions or invalid render data. v0.1 wrote no domain
documents. New writes must include the version. Fields are strictly allowlisted in client rules.

Each user holds `action` and a fresh `writeId`. The main event ID equals `writeId`; a new object
also requires `<writeId>-create`; replacement/relaunch requires `<writeId>-crumble`. Launch and
edit event payloads contain the exact resulting object, including its timestamps, so later replay
can recover appearance and orbit without guessing. Archive records preserve the previous params
and orbit. Rules compare these snapshots against `getAfter` documents, and require every changed
object/event to share `users.lastWriteAt == request.time`. A transaction commits the launch batch
atomically and retries concurrent conflicts. Its reads are only config, the visitor's user record,
and that visitor's previous active object.

The user rule verifies the canonical UTC `yyyy-mm-dd` against `request.time`, exact counter
increments (or reset to one on a later day), the old object's archive, the new active object and
matching events. Object ownership, type, creation timestamp and season are immutable. Edits keep
orbits unchanged. There are no client deletes. Events are append-only, timestamped at server request
time, and enforce exact payload shapes; shake/comet/shooting-star cooldowns are 10/10/20 seconds
in addition to the two-second write cooldown. `meteorShower`, config and snapshots are admin-only.
Client assistant paths stay denied: assistant/voice scope is deferred by the operator.

Signed-in screen clients query only `objects where status == active`. Firestore cannot redact document
fields, so that surface includes the active object's anonymous owner UID and schema fields.
Unauthenticated object reads are denied. Hangar objects are owner-readable only; unrestricted collection queries, other users, event history,
unknown paths and collection listings for config/snapshots are denied. Phones never subscribe to
objects; they read their own records and `config/live`. Public snapshot consumers can get only
`snapshots/live`; the home route remains its foundation reference view in this release.

The screen keeps its last known objects moving offline. An empty local cache is not a confirmed
empty galaxy; it shows an unknown count, then connection feedback after eight seconds without a
server result. A successful server snapshot establishes the empty state or count. Reconnect and
3D-load recovery controls preserve navigation and the join QR.

A first launch writes four documents; replacement writes six. Stand snapshot writes are roughly
2,880 per continuously running day. Its single listener reads the initial active collection and
changes, rather than rescanning every 30 seconds. Snapshot documents omit owner IDs, history,
user counters and creation timestamps; a 900,000-byte JSON guard refuses an oversized state and
reports that sharding is needed. 500-object performance is a G v0.3.0 acceptance task, not measured
here. Cloud Firestore quota usage on a real event remains to be measured.

## Local operation

Use Node 22.18+, pnpm 11.5.2 and Java 21. Browser tests require Chromium:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm exec firebase emulators:start --only firestore,auth --project demo-little-galaxy
```

With emulators running, in separate terminals:

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=demo-little-galaxy pnpm run demo:seed
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=demo-little-galaxy pnpm --filter @little-galaxy/stand start
VITE_USE_EMULATORS=1 pnpm --filter @little-galaxy/web dev
```

Open `/galaxy/screen` and `/galaxy/create`. A normal flick in any direction finds an orbit; an extreme or
unusually slow flick returns as a comet. The button offers a circular launch for keyboard users. To use
physical phones intentionally on a trusted LAN, use the README's `emulators:lan` and `dev:lan`
commands instead of the loopback servers; the QR automatically uses that page's origin. Stop all
processes after verification. Do not point emulator tests at a live project.

The demo seed refuses any host/project other than loopback port 8080 and `demo-little-galaxy`.
For an actual stand, the operator supplies `GOOGLE_APPLICATION_CREDENTIALS` as a file path and
`FIREBASE_PROJECT_ID`. No `.env` is automatically loaded. The stand refuses non-demo project IDs
when `FIRESTORE_EMULATOR_HOST` is set. Without a credential or emulator configuration it remains
an inert version/status command. Real `config/live` must be provisioned by the operator; absent
config or `seasonOpen: false` / `launches: false` closes launches. The writer never opens a season.

## Verification

Final uncached checks and measurements are recorded below after the complete run. Automated
browser tests run without emulators; emulator tests run after the browser has stopped, and the
build runs after the emulators stop. Turbo commands use concurrency one for this machine.

The browser checks cover the workshop at 375px, EN/ES and dark chrome, draft restoration, mouse
pointer gestures, offline error state, no horizontal overflow, visible current-origin SVG QR,
unknown initial counter, and a rendered WebGL central star. Unit tests cover the fast-swipe →
comet path, server rejection, recovery, and cache/empty-state behavior. Screenshots were inspected
against the observatory-chart/observing-log artifact: printed type, marginal readings, measurement
scales, large specimen and dark star field. Physical touch input is still an open verification item.

Open: two real phones and deployed-preview acceptance; real Firebase console/config setup and
live-project rules are operator work. No external acceptance is inferred from emulator results.
Complete version-update/chunk recovery is G v0.7.0. No assistant, voice or new `/talk` behavior was built.

Final commands, all successful (logs and inspected screenshots are in
`~/bad/work/g-v0.2.0/`, outside the release):

```sh
pnpm install --frozen-lockfile
TURBO_FORCE=true pnpm run typecheck
TURBO_FORCE=true pnpm run lint
TURBO_FORCE=true PLAYWRIGHT_BROWSERS_PATH=/home/alexamaze/bad/work/g-v0.2.0/browsers GALAXY_SCREENSHOTS=/home/alexamaze/bad/work/g-v0.2.0 pnpm run test
TURBO_FORCE=true pnpm run test:rules
TURBO_FORCE=true pnpm run build:rehearsal
```

- Typecheck/lint: all three workspace packages, no cached results.
- Tests: shared 7, stand 6, web 55, release/privacy/workflow scripts 26; Chromium 2.
- Rules: 41 passed against Auth + Firestore, including the unchanged recursive deny-all tests
  for unknown paths. Two concurrent anonymous launches arrived at the third client in **173 ms**.
- Build: web version 0.2.0, all build tasks uncached, privacy gate passed (16 files).
  Main JS is 265.08 KB gzip; lazy 3D runtime 241.16 KB gzip, plus the small scene chunks and
  fonts. Vite warns about large raw chunks and the pre-existing SessionLine dynamic import
  sharing a now-statically-imported Firebase module; the 3D runtime remains outside the phone's
  initial bundle. Rehearsal uses the six committed placeholder public variables, not live config.
- Servers/emulators are stopped after their checks. No preview, deployment, push, PR or tag.

Review hardening and per-path rule access counts: [review-fixes.md](review-fixes.md).
