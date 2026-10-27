# A-open: opening at the live present

The complete alpha.10.0-rc1 delivery now provisions and selects its new sandbox automatically,
**after** the compatible production client is verified live. No keeper create/select step is
needed, and no historical generation is relabelled. Frozen-record release assets also remove
the one-time keeper certification requirement. See [the current journey and release contract](RELEASE-CANDIDATE.md).

Work package `v1.0.0-alpha.9.5`, on top of integrated hito A (`3a1099e`).
This implements the operator-approved formula-orbit / client-leader snapshot design.
Local Node results are evidence about replay, not deployed-preview or real-phone acceptance.
The subsequent alpha.9.7 [SHOWCASE.md](SHOWCASE.md) supersedes the current-kernel identity and
adds indexed frozen certifications; the measurements below retain their original alpha.9.5 source identity.

## Formula advancement

`Sim.advanceAnalytically` evaluates mature galactic sites, binary internal orbits and circular
light rails from their immutable initial conditions at an integer tick. It uses the existing
deterministic math and the exact `tick * DT` clock used by fixed steps. It is enabled only when
all bodies have settled, every light host exists and the shared centre translation has finished.
Young launches and unfinished bridges retain the existing fixed-step path. Every accepted fact
is still applied in sequence at its tick; the shortcut stops at the next fact. No body is removed.

Settled bodies stop the transient escape/return watcher. Their existing watch metadata freezes
at settlement, consistent with the mature cohort's existing quiet contact policy. This prevents
sampling a continuous stable orbit at different frame intervals from changing discrete state.
Expired nebula-assist contact markers are removed at the same last completed galaxy tick as in
fixed steps; ordinary quiet contact records retain their existing suppression semantics.
The deterministic light-contact grid retains bounce-chain requery and its all-pairs oracle.
Compact kisses and safety guards also share a primary grid at each step for groups of 32 or more
primaries. Smaller groups retain a cheaper direct scan; this threshold selects an algorithm and
never restricts bodies or launches. Cell width covers the kiss separation and the largest guard.
Candidate indices sort back to original primary order. Kisses change velocity, and guard puffs
move only the light query, so the shared primary grid remains valid through the step. Mature
compacts are excluded from kisses before distance work. A frozen all-pairs primary oracle checks
complete state and ordered events across cell boundaries and moving encounters; a separate sparse
100-primary test guards against quadratic enumeration. No contact/admission policy, player cap,
cooldown or budget is added.

This changes the kernel identity to
`proto3-81e31788dd7a8eef8ab2a1a738c42055541186f33e3d6b26d9bb1329a0614e05`.
It follows the `scripts/sync-prototype.mjs` allowlist/order and SHA-256 recipe. Existing galaxies,
especially the frozen fair record, retain their historical identity.

## Production kernel decision — 2026-10-27

The owner's release plan needs **no generation migration or fork**. After publishing the client
and rules, the keeper creates a **new galaxy in `admin.html`** and selects it as the active public
galaxy. `createAdminStore.createGalaxy` already calls `initialGalaxy` with the current `KERNEL`;
the new document starts at generation 1, with an empty head and its own epoch. Its first players
can elect a snapshot writer normally. Creating/selecting it never updates the old manifest,
accepted pages, generation or kernel. Do not unfreeze or relabel BAD 2026 for this plan.

The released client now includes a kernel dispatcher. The current identity uses the unchanged
A-open simulation/replay. Only the known historical identity
`proto3-ed2f1b0ac6cdf637229711dc5c1b94e3645a4d18eea47786082e1393b50bf30e`,
on a frozen/archived record with frozen write policy, selects the archived final fair release
(`9ccf27d`, alpha.8). It preserves the original motion, including native JavaScript mathematics;
the deterministic A2/A-open equations are for new galaxies. Unknown identities and active old
identities still fail closed. No identity alias accepts historical state into new physics.

`integration/kernels/fair-alpha8/manifest.json` pins original and packaged source SHA-256 values.
Simulation, home and name modules retain their release bytes. Replay changes only its relative
simulation import and pins the historical constant instead of importing the new one. Tests
reverse those packaging substitutions and compare original hashes. The shared name table is
also pinned. Historical admission helpers cannot limit players: this reader only applies already
accepted facts, and the UI/rules keep the galaxy frozen. New player admissions are unchanged.

Both the worker and display select the historical implementation. The display restores old
topology/rails with that implementation, so current `Sim.restore` cannot reinterpret an old
frame. Timelapse still requests authoritative history and supports play and seeking. No mismatch
notice or compatibility warning is added. The ordinary resting notice remains. Live snapshots
are current-kernel-only; an optional keeper certification retains the historical identity.

Suite evidence: `kernel-production.test.js` exercises the actual admin adapter over the memory
driver, creation/selection, lease/publication and a snapshot join with byte-identical canonical
state and SHA-256 equality to full replay. It verifies old identity/log immutability, bodies,
backward/forward seeking, display restoration, certification and invalid-identity rejection.
`replay-worker.test.js` exercises old-kernel opening and scrubbing without an error message.
`tests/ui/kernel-production.spec.js` runs the real admin create/select flow, a player launch and
leader snapshot, and a fresh browser's provisional snapshot load. Its frozen-fair journey checks
rendered bodies, play, scrubbing, empty toast notices and unchanged stored history. The fixtures
are public synthetic records; private fair visitor payloads are never committed.

An additional local check reads the private fair fixture without committing it: all 21 accepted
launches / 22 bodies reach tick 2,278,338 under the unchanged historical identity and generation 1.
A historical display restoration preserves all positions. Canonical end-state SHA-256:
`a267df14ea2e750d5ebe02049bf64c0170b61ae70d8080fe61fa818c55ec802d`.
This uses a local read-only frozen view through the last accepted tick, not a production write
or a claim about current Hosting. The reproducible suite uses the public fixture above.

The current fingerprint and measured simulation path below are unchanged by this dispatcher.
A running old galaxy that must adopt new equations would still need an explicit generation/fork
design; the owner's frozen-record plus new-galaxy plan does not perform that operation.

## Snapshot writer and storage

Existing editor/owner members (including anonymous Auth players) can contend for
`galaxies/{g}/control/snapshotLease`. Firestore transactions elect one random tab token for
30 seconds. The current holder renews while saving; another member can take over after expiry.
The lease exposes only the already-public galaxy-scoped `memberId` and a random tab token,
never the private Auth UID. Read-only visitors do not create accounts or membership to save.
Viewer members, outsiders, expired holders and frozen galaxies cannot write snapshots.

Every approximately ten seconds during activity, a verified visible holder forks a rewind mark
and saves `liveSnapshots/latest`. The snapshot is two seconds behind the server-clock read.
A1 requires later commits to have effective ticks newer than that boundary. Facts already
committed but scheduled after the snapshot remain in the downloaded tail. Saving is separate
from launch/profile transactions and failures have no effect on admissions. Saving continues
through settling and records one mature state, then stops until new activity. The lease can
expire during quiet time: mature orbits do not need periodic persistence to reach the present.

The document names its schema, generation, kernel, reached tick, covered sequence, regenerated
log-prefix hash, holder, wire hash and canonical replay hash. Its semantic payload is sorted-key
JSON with finite IEEE-754 values and canonical zero; gzip/base64 is transport only. The replay
hash uses shared `canonicalHash`, including big-endian number bytes, over the JSON-normalized
payload. Wire integrity hashes the packed string independently. Gzip implementations need not
produce identical compressed bytes. Readers require canonical plaintext and exact restoration.
State expands to at most 8 MiB and the packed string is limited to 900,000 bytes, below the
Firestore document ceiling. If it no longer fits, snapshot saving skips without limiting play;
the accepted action log remains complete.

Rules constrain authority, lease expiry, schema, generation, head sequence, time and monotonic
replacement. Rules cannot establish the physical truth of client-submitted bytes. Snapshot
contents therefore remain provisional until independently replayed. No snapshot can write
accepted actions, objects, membership accounting or administrator certifications.

## Join, verification and fallback

The foreground reads the manifest/head, optional snapshot and only its uncovered log pages.
It checks packed integrity, canonical state/hash, kernel/generation/galaxy/tick/sequence and
restoration before using a snapshot. It rejects candidates beyond the coherent head, frozen
endpoint or safe server-time boundary. A tail fact at/before a candidate tick also rejects it.
An unusable snapshot takes the normal authoritative-history path.

The worker publishes the provisional present first, then the main thread downloads history
independently, explicitly disabling all checkpoints and certifications. If advancing the candidate
throws before its first frame, independent history starts immediately and no provisional frame is shown. The worker
replays from genesis in 240-tick slices with an 8 ms yield, alongside the ordinary live pump.
It compares both the complete canonical replay hash at the snapshot tick and the regenerated
accepted-log prefix hash. A match enables snapshot writing. On mismatch the independently
replayed state catches up to the current target and atomically replaces the provisional frame;
intermediate historical frames/effects are never published. Live facts arriving during this
verification are retained. Network/verification failures retry; load tokens fence those retries and saving remains disabled until
verification succeeds. Provisional clients cannot
publish snapshots and thereby propagate an unverified cache. Load tokens fence delayed results
across visibility reloads. Hiding/stopping detaches saving; resuming loads a coherent boundary.
Timelapse and administrator certification keep their existing independent history paths.

This trust model intentionally allows a malicious eligible leader to supply a temporary forged
view before independent verification. A hash alone cannot authenticate a client snapshot. The
approved provisional-opening design cannot guarantee authoritative first-frame contents without
waiting for replay or a separate trusted certification. No production security rules were deployed.

## Measurements and reproduction

The isolated measurement table follows below; raw local reports stay under ignored `.tmp/`.
`integration/open-measure.test.js` is opt-in and runs one case per process:

```sh
mkdir -p .tmp/t
TMPDIR=$PWD/.tmp/t NODE_OPTIONS=--max-old-space-size=768 \
  OPEN_MEASURE=1 OPEN_VARIANT=after OPEN_CASE=hour \
  corepack pnpm --filter @little-galaxy/web exec vitest run integration/open-measure.test.js
```

Cases are `fair`, `hour`, `six`; variants are `before`, `after`. The before tree is the work
package's original `3a1099e` simulation/replay/homes/names source extracted to
`.tmp/before/apps/web/`, with dependencies resolved from the workspace:

```sh
mkdir -p .tmp/before
git archive 3a1099e apps/web/js/sim apps/web/integration/replay.js \
  apps/web/integration/homes.js apps/web/integration/names.js | tar -x -C .tmp/before
ln -s ../../node_modules .tmp/before/node_modules
```

Private fair inputs
stay outside Git; set `FAIR_GALAXY` and `FAIR_ACTIONS` to their paths. The default paths are the
coordinator's local `lg-inputs` directory. The fair is evaluated through its last accepted tick
(or frozen endpoint, whichever is later), using the current kernel in this isolated experiment;
it does not migrate or modify the real frozen record.

Synthetic cases use the existing seed `0xa209`, the same 150 launch kinds/coordinates and four
admission homes, spread across one/six hours (24/144 seconds between launches). They are moderate
activity histories, not a maximum-population stress test. A snapshot ten seconds before the
endpoint leaves the final launch in the tail. Before measures full replay. After includes cache
integrity/canonical/restoration checks, decompression and tail replay. Snapshot preparation is
excluded from opening and reported separately. The original full replay then advances to the
endpoint and must have the identical canonical SHA-256 state hash.

Each foreground catch-up slice has a 480-tick budget and yields for 4 ms. The phone proxy is
four times the entire measured Node opening time, including yields; it is an explicit heuristic,
not CPU throttling or a phone benchmark. Beacon is shared infrastructure; these are single runs without exclusive CPU allocation.
Network, Auth, Firestore latency, JS download and WebGL
rendering are excluded. Cold starts without a usable snapshot still pay for authoritative replay.
The roughly two-second whole-game goal remains pending deployed-preview and real-phone checks.

| History | Actions / bodies | Full replay before (s) | Snapshot to present (ms) | 4× Node proxy (s) | Snapshot document (KiB) | Exact SHA-256 state |
|---|---:|---:|---:|---:|---:|---|
| Fair log | 21 / 22 | 56.003 | 64.234 | 0.257 | 9.1 | Equal |
| 1 h activity | 150 / 154 | 95.478 | 592.461 | 2.370 | 47.5 | Equal |
| 6 h activity | 150 / 154 | 586.721 | 232.371 | 0.929 | 47.9 | Equal |

Final after-runs began from genesis (`setupResumedAt=0`) and used the final kernel above.
The snapshot's full-replay preparation, excluded from join timing, took 15.438 s (fair),
90.328 s (one hour) and 284.707 s (six hours). The six-hour case has fewer young bodies near
the endpoint than the one-hour case, because both contain 150 launches with different spacing.
This explains the faster six-hour tail; it does not establish a maximum-population bound.
Full numeric reports are committed in [a-open-measurements.json](a-open-measurements.json).
The final environment reports Node v24.9.0 / V8 13.6.233.10-node.27. CI rehearsals use Node 22.
These are single observations; no percentile, network or actual-phone claim is made.
One earlier after-six attempt stalled with the runner overnight and timed out; it produced no
accepted measurement. Final after-runs were rerun from genesis after the last kernel change.

Preparation writes ignored, hash-bound progress under `.tmp/open-*-prepared.json`. An interrupted
setup may be reused only with explicit `OPEN_RESUME_SETUP=1`, matching kernel, fixture hash,
endpoint and state hash. This does not alter the timed opening. No final report reused setup.

Local final checks: root tests (39 shared, 16 stand, 136 web and 137 scripts), lint, typecheck,
a separate web run (136 pass, three opt-in measurements skipped), all 30 physics checks, and
`build:rehearsal` with the 24-file privacy gate passed. Cases ran serially with the 768 MiB heap
and workspace TMPDIR. The fingerprint independently reproduces the committed pin. No local
browser, emulator or rules command ran; those belong to the rehearsal jobs.

## Rehearsal evidence

Recovery commit `9b64c23` passed rehearsal run `40446067586`: unit/build/privacy, rules and
player journey all succeeded. Accepted measurement commit `06e2be1` passed run `40448518129`.
Merge commit `34b66f1` passed run `40493679723`, including A-show and its expanded journey
timeout. The kernel compatibility commit requires its own passing rehearsal. Its receipt is kept in
`.tmp/rehearse-results/` and reported in the final handoff. Rehearsals do not deploy a preview.
