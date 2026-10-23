# Memory format 1 and P v1.1.0 serving contract

G v0.6.0 uses one public, versioned format for the fair and the frozen season. Owner UIDs, user
records, counters and credentials never enter it. IDs and generated bilingual name keys remain
stable. No object is deleted when it crumbles; its status becomes `hangar`.

## Files and Firestore paths

| Static file under `/galaxy/season/bad-2026/` | Live document |
| --- | --- |
| `manifest.json` | `seasons/bad-2026/meta/manifest` |
| `log-<24 hex SHA256>.json` | `seasons/bad-2026/log/log-<hash>` |
| `objects-0.json` … `objects-f.json` | `seasons/bad-2026/log/objects-<hex>` |

Every file/document has `format: 1`. All exported files are compact JSON with a final newline.
A manifest has `season: "bad-2026"`, `title: "BAD 2026"`, `start`, `end` (UTC epoch milliseconds),
`eventCount`, ordered `log` filenames without extensions, and the 16 `objects` shard names.
The live manifest additionally carries publication hashes; readers ignore these admin bookkeeping
fields. The frozen manifest contains only the portable metadata.

A log chunk has `states: MemoryObject[]` and `events: string`. The string is JSON encoding an
array of `[eventId, at, type, objectId, stateIndexOrPayload]` tuples. **Encoding the tuple table as
a string is intentional:** Firestore cannot store arrays directly inside arrays. Both static JSON
and Firestore use this identical representation; `readLog` decodes and validates it before replay.
Object actions reference a deduplicated state in that chunk; global events retain their tiny payload.
Create and launch events remain separate events, sharing one state when identical. Object state has
`id`, schema version 2, `type`, `nameKey`, normalized `params`, `orbit`, optional `hostOrbit`,
`status`, `createdAt`, `updatedAt`, `season`, and optional `unclaimed: true`; no `ownerUid`.
Version 1 planets are normalized with the same legacy defaults as the renderer, then stored as v2.

An object shard has `objects: MemoryObject[]`, including active and hangared specimens. The bucket
is the unsigned 32-bit polynomial hash of the object's ID (multiply by 31, add each character),
modulo 16. A permanent page therefore needs **one public document get**, without authentication,
and never an object collection query. Missing IDs and offline failures have different UI states.

Log chunks have content-addressed names. A manifest points to an immutable, complete revision;
readers fetching it during publication cannot mix old and new log tails. Publication atomically
writes the changed chunks/shards and the manifest in a single admin batch. Unchanged shards are
not rewritten. Old log tails may remain in Firestore for readers already holding old manifests;
there is no client deletion or log garbage collection in this milestone. Export includes only the
current referenced log chunks and all 16 object shards.

## Exact replay and bounds

Replay sorts events by server timestamp and then event ID. Each object event supplies the exact
resulting object state checked against its transaction by rules. All events in a launch batch share
a timestamp, so replacement/crumble is reconstructed atomically. Scrubbing includes every event
at or before the selected timestamp; there is no interpolation of appearance/status. Kepler motion,
moon parent snapshots, fixed visitor-star placement, surface animation and transient debris use
the historical clock. Assembly uses the most recent launch/relaunch, not an edit's update time.
Global waves/comets/messages/meteors are replayed with the same bounded presentation as live effects.
Operator-seeded objects without events receive a synthetic creation at their recorded creation time.
A seeded object subsequently edited without an initial creation log cannot recover its earlier
appearance; operators must seed the matching creation event for such bodies.

Each chunk/shard is guarded at **600,000 UTF-8 JSON bytes**, leaving margin below Firestore's 1 MiB
limit, including serialization overhead. Overflow/unsupported schemas fail publication/export and
report a stand error; they do not silently omit data. Current publication refuses >450 changed
chunks in one batch. Increasing these bounds needs a new, reviewed capacity strategy, not truncation.
A 300-body, five-action fixture requires at most five reads (one manifest + up to four log chunks),
compared with 1,500 event-document reads. A replay reads a finite published revision once; play,
pause, speed changes and scrubbing issue no additional reads. Large seasons need proportionally more
chunks; there is no promise of constant read cost for unlimited history. Client rules allow only
public `get` on these paths, deny list/collection-group queries and deny all client writes.

## Stand operation and quota

The stand maintains cached object and event listeners, backfilling historical events once at startup.
Publication coalesces changes into a **30-second window** (not an indefinitely trailing debounce).
This is a separate archive from the live snapshot; permanent pages can lag a launch by ~30 seconds.
Restarting repeatedly rereads history, so run one stand and monitor its archive error output.
Unchanged windows write nothing. A changed window writes one manifest, its changed log tail(s),
and each affected object shard. Global-only windows do not rewrite object shards.

The planning load of 300 visitors, one launch + three edits + ten interactions each, is about
12,917 existing writes/day (see interactions handoff). At an eight-hour fair with evenly distributed
activity, 960 publication windows add ~1,920 log/manifest writes plus up to ~1,200 changed object
shard writes: **~16,037 total** before retries/config changes. Bursts and shard overlap change this
estimate; it is not a quota lock. Stand reads add the initial inventory/event history and one per
changed object/new event; a restart repeats the initial cost. At 500 timelapse views × 5 reads,
public replay adds ~2,500 reads rather than 750,000. Watch actual usage against 50k reads/20k writes;
the identity maxima cannot all be consumed by all visitors within Spark.

## Freeze rehearsal (emulator only in this release)

The CLI refuses missing emulators, a non-`demo-` project or invalid arguments **before initializing
admin credentials**. It does not change `config/live`, close a season, publish files, or deploy.
A read-only Firestore transaction captures objects/events consistently. A fresh output directory
is required; existing files are never overwritten. Identical data yields byte-identical output,
with no wall-clock export timestamp. Source schemas and output bounds are validated before writing.

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=demo-little-galaxy \
  pnpm --filter @little-galaxy/stand freeze-season /absolute/fresh/output-directory
```

The rules integration test records real production launch/edit/replacement/relaunch transactions,
compares reconstructed states at each timestamp and before the first action, runs the stand writer,
checks public read boundaries, and compares two exports byte-for-byte. Live-project export is
intentionally unavailable in this rehearsal CLI. G v1.1.0 must add an explicit operator-controlled
production workflow after closing and verifying the season; this task never accesses real data.

## Portfolio P v1.1.0

Copy the **entire** exported directory to `dist/galaxy/season/bad-2026/` without changing filenames
or JSON. Preserve the Galaxy SPA rewrite for `/galaxy/o/**`, so shared object URLs survive direct
navigation and reload. Serve `.json` with `application/json`; use revalidation/no-cache for the
manifest and object shards. Hashed log files may be immutable. Publish the complete directory
atomically with the Galaxy payload, after reviewing the exported data. Do not rewrite missing JSON
requests to the HTML app if avoidable; Galaxy recognizes an HTML rewrite as a missing static file.

The ordinary fair home reads only `snapshots/live` once and displays its observation time; a refresh
is explicit. Opening Replay loads the compact season. A present static manifest makes the home
open the frozen timelapse automatically.

Galaxy tries static JSON first. A 404 or HTML rewrite falls back to one public Firestore get per
requested document; a present but malformed/incomplete static archive produces a designed error,
not an event-collection scan. Successfully served static archives require **zero Firestore/Auth
requests**. Network failure is shown as unavailable with retry. EN/ES and theme use the ordinary
portfolio shell. `/profile.json` supplies the real header/socials; absent content is not invented.
No portfolio files are changed by this worktree task.
