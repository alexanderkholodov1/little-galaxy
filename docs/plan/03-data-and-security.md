# 03 — Data model, security rules, quota budget

> **M0 update, 2026-10-09:** game planning belongs to this repository. Read
> [the current decisions](08-decisions.md) and [construction plan](10-construction-proposal.md)
> before applying older details below. The fair QR opens the game directly: enter a visitor
> name, see/explore the galaxy and access other actions, then optionally choose creation.
> The assistant is entirely out of current scope. Game naming, final route and detailed
> interaction design remain for the dedicated design session. Old dates are not a work schedule.

All data lives in the **galaxy data project's** Firestore. Types are defined once in
`galaxy/packages/shared` and reused by the web app, the stand process and the rules tests.

## Principles

1. **Firestore is the single source of truth.** No page holds important state only in memory: any
   phone or screen can reload and recover.
2. **Phones can view/explore the galaxy before creating.** Design a bounded render-data read
   path for this requirement (snapshot or equivalent); do not restrict phones to their own object.
   Avoid unbounded full-collection listeners on every phone and measure fan-out costs.
3. **Nothing is ever deleted** during a season. Events are append-only.
4. Deny-by-default rules; every field validated (type, range, enum), ownership enforced.

## Collections

### `objects/{objectId}`
| Field | Type | Notes |
|---|---|---|
| `ownerUid` | string | `request.auth.uid` at creation; immutable |
| `type` | `"planet" \| "star" \| "moon"` | immutable |
| `nameKey` | string | id of the generated name combination (rendered in EN/ES); no free text |
| `params` | map | per-type, every value range-checked (sizes, colours as palette indices or bounded numbers) |
| `orbit` | map | orbital elements + epoch; `isComet` boolean; `hostId` |
| `status` | `"active" \| "hangar"` | transitions only by the owner, via the launch/relaunch batch |
| `createdAt`, `updatedAt` | timestamp | `== request.time` |
| `season` | string | e.g. `"bad-2026"` |

### `users/{uid}`
`activeObjectId`, `launchesToday` (int), `launchDay` (yyyy-mm-dd), `lastWriteAt` (timestamp),
`lastShakeAt`, `lastCometAt`, `lastStarAt` (timestamps). Only the owner writes it.

### `events/{eventId}` (append-only log; source of the timelapse)
`type` ∈ `create | edit | launch | crumble | relaunch | shake | comet | shootingStar | meteorShower`,
`objectId?`, `uid?`, `at` (`== request.time`), `payload` (small, validated per type).
`meteorShower` events are written only by the stand (admin SDK).

### `snapshots/live` (written by the stand only)
Compact state of the whole galaxy (all active objects' render params + orbits + counters), rewritten
every ~30 s by `apps/stand`. Public viewers of `/galaxy` and the portfolio's live banner read **this
one document** instead of every object.

### `config/live` (written by stand / operator only)
`appVersion`, feature flags / kill switches (`comets`, `shake`, `shootingStars`, `launches`,
…), `screenScene`, `ownerUid`, `seasonOpen` (bool).

### Visitor name (required; policy not yet designed)

The visitor enters a name before exploring. Name format, public visibility, moderation,
retention and the final schema will be decided in the design session. The old prohibition on
all free text must not remove this requirement. Do not silently use a generated object name
as a substitute or require a real/legal name.

## Earlier rules sketch — validate against the current invariants before implementation

This outline is not a completed security design. The versioned command/revision/idempotency
contract and atomic history requirements in 10 must be reconciled with it and proven in the
emulator. Do not implement old per-write examples as if they already enforce every invariant.

- `match /{document=**} { allow read, write: if false; }` as the base.
- `objects`: create if signed in, `ownerUid == request.auth.uid`, schema valid, `createdAt ==
  request.time`, `status == "active"`, and part of a valid launch batch (below). Update only by owner,
  immutable fields unchanged, params valid. No delete. Read: owner reads own docs; screen and public
  read via snapshot (screen may read `objects` — decide per implementation, keep public reads minimal).
- `events`: create only, `at == request.time`, `uid == request.auth.uid`, per-type payload checks,
  per-type cooldown via `users/{uid}` timestamps. No update/delete.
- `users/{uid}`: owner only; counters may only move forward; `launchesToday ≤ MAX_LAUNCHES_PER_DAY`
  (default 5).
- `snapshots`, `config`: read public (snapshot) / read for clients that need flags; write: nobody
  from clients (stand uses admin SDK, which bypasses rules).

**Rate-limit technique:** write the object/event **in the same batch** as an update of
`users/{uid}.lastWriteAt = request.time`; rules check
`request.time > resource.data.lastWriteAt + duration.value(N, 's')` on the user doc and
`getAfter(/users/$(uid)).data.lastWriteAt == request.time` on the object/event. Cooldowns (defaults,
tune in testing): any write ≥ 2 s; shake ≥ 10 s; comet ≥ 10 s; shooting star ≥ 20 s.

**Launch batch** (new object or relaunch): in one batch — previous active object → `hangar`,
new/relaunched object → `active`, `users.activeObjectId` updated, `launchesToday` incremented,
`crumble` + `launch|relaunch` events appended.

**Identity limits (be honest):** one active object per *anonymous identity*. A visitor could get a
second identity by switching browser/private mode. Acceptable for the fair; do not claim "one per
person" as a hard guarantee.

## Quota budget (Spark, per day, data project) — see 09-sources.md

The following numbers are the original rough budget, not verified capacity. Recompute from
actual commands, viewer duration, rule reads, fan-out and reconnects; the worked counterexamples
in 10 explain why the earlier visitor estimate alone cannot establish feasibility.

- Writes: 20,000/day. Estimate 300 visitors × ~30 writes ≈ 9,000. Throttle shakes so a crowd shaking
  together can't burn the budget (cooldowns above; optionally aggregate shakes client-side).
- Reads: 50,000/day. Screen listener ≈ 1 read per new doc/change. Public `/galaxy` viewers read
  `snapshots/live` (1 doc + updates) — never the whole `objects` collection.
- Document max size 1 MiB → keep the snapshot compact
  (if it approaches the limit, shard into `snapshots/live-0..n`).
- Realtime Database is **not used** (Spark caps it at 100 simultaneous connections).
- After the fair, the season is frozen to static JSON on Hosting → zero Firestore reads forever.
- Hosting transfer (portfolio project): 10 GB/month on Spark; 500 visitors × ~2–3 MB bundle ≈ 1.5 GB.
  Keep the galaxy bundle lean; large future game assets go elsewhere.
