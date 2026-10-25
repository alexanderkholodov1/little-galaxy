# GalaxyStore — alpha.2 B1

The frontend imports `createGalaxyStore`, domain types, `MASSES` and canonical helpers from
`@little-galaxy/shared`. Import the browser transport separately from
`@little-galaxy/shared/firestore`; the common entry point has no Firebase dependency at runtime.
The in-memory driver implements the same transaction/subscription interface for local practice.

```ts
import { createGalaxyStore } from '@little-galaxy/shared';
import { firestoreGalaxyDriver } from '@little-galaxy/shared/firestore';

const store = createGalaxyStore(firestoreGalaxyDriver(db), {
  uid: auth.currentUser.uid,
  memberId: crypto.randomUUID(), // persist per galaxy; reuse membership.memberId on later sessions
  now: () => sharedClock.now(), // milliseconds, anchored to server time, monotonic between anchors
});
const loaded = await store.loadGalaxy(); // follows config/live.activePublicGalaxyId
await store.setName(loaded.galaxy.id, 'Alice'); // empty string chooses Anonymous
const accepted = await store.launch(loaded.galaxy.id, {
  id: savedDraftNonce, type: 'launch', kind: 'planet', system: '0', seed: 42,
  origin: [7000000, 0], velocity: [0, 1400000], design: { colour: 0 },
  effectiveTick: Math.ceil((sharedClock.now() - loaded.galaxy.epoch + 2400) * 120 / 1000),
});
const stop = store.subscribeToActions(loaded.galaxy.id, loaded.head.sequence,
  actions => worker.accept(actions), error => showConnectionError(error));
// Stop on visibilitychange -> hidden. On resume, load the missing tail before subscribing again.
stop();
```

A member profile is galaxy-scoped, private and keyed by Auth UID. `memberId` is its public
pseudonym. First launch can create Anonymous membership. Use the `player` returned by `loadGalaxy` for the private name and inventory. Existing membership
identity is reused automatically; `memberId` is only the seed for a new membership. Do not expose UID mappings in logs or exported public genesis.
Chosen labels are nonunique, escaped text, at most 24 Unicode code points (a stricter bound than
24 grapheme clusters). First/last seen and launch totals live in the membership. `touch()` writes
only after five minutes; call it only while foreground. `metrics()` returns at most 300 members,
requires admin access, and lets the dashboard calculate the five-minute active window locally.
This B1 interface has no visit/session tracker, global identity roll-up or one-second presence.

`loadGalaxy(id?)` distinguishes a missing galaxy/head/page from an empty world. It returns the
manifest, coherent head boundary, imported `genesis`, accepted actions, and an optional verified
checkpoint. The head may advance during loading; returned actions stop at its original sequence.
Subscribe from that sequence to close the race. Pages hold 64 entries; the listener follows the
next numbered page when the current one seals and deduplicates sequence overlap. Missing pages
are errors, never empty worlds. Listeners must be stopped by their host when hidden/unmounted.

`launch`, `edit`, and `admin.remove` use online Firestore transactions. Six common writes are
head, member, immutable action, append-only page, body, and latest checkpoint cache. The common
launch reads seven documents: nonce, galaxy, head, member, live config, Pacific quota descriptor,
and current page. A moon adds its parent read/write; an edit/removal reads its existing body.
All reads precede writes. A conflict retries bounded validation/copying; stale prepared physics
must be recomputed outside the transaction. Persist the nonce and draft before calling. Retrying
an identical accepted nonce returns its old result, and different content using it fails.
Offline/denied/stale attempts do not become queued authoritative writes. Their drafts belong to
the frontend and must remain available after rejection. Clock skew requires resynchronization.

`origin` and `velocity` are exact integer millionths of world units in x–z; velocity magnitude
is at most eight world units/s. Seeds are unsigned 32-bit integers. Ticks are integers at 120 Hz
from the galaxy epoch, strictly increasing, between 0.5 and 3 seconds after server request time.
No orbital eccentricity or semimajor-axis clamp is applied. Design size does not affect mass.
Fixed masses are integer millionths of a star: planet 1000, giant 10000, moon 10, asteroid/comet/
meteor 1, nebula 100, star 1000000, binary 2000000, pulsar 1400000, black hole 2000000.
Binary is a two-slot recipe. Client input is not permission to alter anyone else's orbit.

The data contract does **not** supply the simulation's scalar Wasm kernel, transcendental math,
Kepler solver, state reducer, reservation-driven transfers, capture or encounter windows. The
prototype packaging worker must pin identical kernel bytes/version and consume the accepted
intent and genesis. B1 canonical encoding supplies sorted object keys, typed binary64 bit
patterns (big endian, normalized negative zero), UTF-8 and SHA-256; nonfinite values fail.
Hashes written by phones are hints, because rules cannot validate SHA-256 or run gravity.
Replay recomputes its own prefix hash from accepted facts, ignoring corrupt hash hints.
`verifyTail(..., strictHints=true)` also provides a strict diagnostic integrity check.

A prepared compact checkpoint can be supplied as the third launch/edit argument:

```ts
await store.launch(id, intent, {
  baseSequence: verifiedHead.sequence, generation: galaxy.generation,
  state: compactStateString, stateHash: await canonicalHash(compactStateString),
});
```

It is limited to 14,000 string characters and checked against the current generation/sequence.
An absent prepared state produces a compact `admission-v1` summary of the admitted head and body,
with a state hash. It is a comparison cache, not a full physical checkpoint. Every cache
is untrusted. It never determines admission or another body's physics. Default loads ignore
caches and replay from genesis. A `verifyCheckpoint` callback must perform actual replay or
validate trusted certification, not merely compare a submitted state hash.

Optional trusted snapshots use immutable `certifications/{sequence}` and an admin-only
`control/certified` pointer. With a verifier, the loader first tries that certified snapshot,
checks its kernel/generation/state hash, and fetches only the later packed log. A locally
verifiable phone cache is considered after full log loading when no trusted snapshot exists.
No periodic checkpoint writer is required. Cold replay after a quiet week evaluates analytic
paths in the kernel; B1 does not step elapsed animation time or write positions.

Galaxies own every action, body, checkpoint, genesis chunk and membership. They contain owner,
name, mode, visibility, write policy, status, epoch, generation, creation and freeze dates.
`config/live.activePublicGalaxyId` selects new public play; `boothGalaxyId` is independently
chosen by the admin. A public launch rechecks the active pointer; switch/freeze races reject
or conflict atomically. Frozen and archived galaxies reject player mutations. A new seed system
is allocated with each new ordinary-body system; its mass and slot are charged once. Admission
never evicts a visitor. Removal leaves a tombstone and does not refund lifetime budgets; host
removal is refused until a safe fork/reparent operation exists.

`admin.create(galaxy)` atomically reserves one of three account galaxy IDs and creates its seed
head. Only verified Google users can create real Firestore galaxies. Player sign-in UI is a
later package. `admin.update(id, expectedGeneration, patch)`, `admin.select(id, target)`,
`admin.invite(id, uid, role)` and `admin.remove(id, intent)` are data operations, without UI.
The caller's `admin: true` option only enables adapter commands; Firestore independently checks
Google provider, verified email and `config/admins.emails`. Lifecycle/selection/invitation changes
also append immutable `adminActions` audit records; body removals use the accepted physics log.
No deletion or purge API exists. Visibility is fixed after creation: fork to change it, so public
log pages can be read without an extra dependency read on every delivery. Public history cannot
be made private retroactively. Ownership/admin status never exempts ordinary play budgets.

```ts
import { MemoryGalaxyDriver, createGalaxyStore, initialGalaxy, initialHead, quotaWindow }
  from '@little-galaxy/shared';
const driver = new MemoryGalaxyDriver();
const now = Date.now();
await driver.seed('config/live', { seasonOpen: true, activePublicGalaxyId: 'practice', boothGalaxyId: 'practice' });
await driver.seed('galaxies/practice', initialGalaxy('practice', 'owner', 'Practice', now, kernelHash));
await driver.seed('galaxies/practice/control/head', initialHead(now));
const window = quotaWindow(now);
await driver.seed(`quotaWindows/${window.id}`, window);
const practice = createGalaxyStore(driver, { uid: 'local', memberId: 'local-label', now: Date.now });
```

Memory mode implements atomic persistence and the local admission budgets, not Google identity or
Firestore authorization. It must be labelled local practice and never silently replace a failed
network launch.

Release migration and quota assumptions are in RUNBOOK §13 and `alpha2-b1-quota.md`. Integration
acceptance still requires the packaged kernel, deployed preview and real phones; emulator success
is not that acceptance.

For the initial clock anchor, the Firebase transport accepts optional `{clock, getToken,
emulatorOrigin?}`. Import `ServerClock` from the Firestore subpath, create it once, and pass
`getToken: () => auth.currentUser.getIdToken()`. With this option, `driver.get('config/live')`
uses Firestore's authenticated REST batchGet read (one billed document, replacing the SDK config
read), observes its server `readTime`, and advances on `performance.now()`. Await that config
read before constructing/using a store whose `now` is `clock.now`. Re-anchor on foreground resume.
For emulators, provide their explicit HTTP origin. This works even when device wall time is ten
minutes wrong; a committed timestamp from an old quiet galaxy is not used as current time.
Design fields are bounded integer parameters (0–1,000,000); use `DESIGN_FIELDS` for the allowed
sliders/palettes and quantize floats before admission. Nested/unbounded design payloads are rejected.

A compact launch into an existing system also funds a dormant contingency cell in `head.reserves`,
keyed by its action nonce. Active systems plus these cells must fit the same 32-system allowance.
Its hypothetical per-system count/mass envelope is reserved while physical galaxy mass/count is
charged once. Replay can use the deterministic `r-<nonce>` destination if the compact body leaves
its admission home. B1 retains these reservations conservatively; it has no refund/transfer API.
Ordinary bodies have only their admitted home envelope. A reducer must not capture into an
unfunded destination; extending ordinary inter-system reservations needs another admitted intent.

New galaxies default to a shared 600-mutation Pacific-day ceiling (launches, edits and admin body
removals). The admin may configure `dailyLimit` from 300 to 900 after reviewing the quota model.
This supplements the six-launch player ceiling; it does not promise six launches to each player.

The binary's second ownership slot is `<nonce>:b`; colons are forbidden in action nonces. A
kernel must likewise namespace implicit seed/nursery IDs (for example `seed:<system>`) so a
visitor's valid nonce cannot shadow a pre-existing physical component.

Use `subscribeToSelection` for rare active-public/booth pointer changes and `subscribeToGalaxy`
for lifecycle changes. Start the manifest subscription **before** `loadGalaxy(id)`; the store
reuses its first server snapshot rather than billing another manifest fetch. Both return stop
functions; stop them when hidden. The quota model charges one extra selection listener per
join/resume and up to fourteen genesis chunks, plus the private player inventory read (the same
total envelope as sixteen without the listener and inventory). A frozen renderer evaluates through `max(head.effectiveTick, ceil((frozenAt-epoch)*120/1000))`
so a launch already admitted for a future tick is included. Repeating a freeze preserves its date.

Import genesis chunks pack complete legacy records up to the 60,000-byte JSON target rather than
wasting one chunk per fixed body count. Their hashes and exact legacy orbital fields remain stable.
The quota model still charges the conservative fourteen-chunk bound, not a free genesis download.

Body identity records retain the public creator `displayName` selected at launch, while Auth UID
ownership remains private. Later profile renames do not silently rewrite historical authorship;
name redaction/export policy is a separate administrative feature.

`loadGalaxy().player` returns only the caller's private profile and up to three ownership slots;
it is null before first participation. Nonce recovery checks that persisted membership, so a
returning session does not need to retain its originally proposed public member label.

Packed pages have a 128 KiB payload cap and at most 64 entries; accepted actions have a
2,000-byte JSON envelope. This replaces the note's 32 KiB page target, which a fixture of
64 valid full-design planet actions exceeded. The richer rollover fixture and real twenty-phone
last-slot/page-fill race guard against blocking a galaxy before the next page can open.

Public admissions also honor the existing `config/live.seasonOpen`, `launches` and `edits`
controls, including against clients forging their local config view. An emergency close therefore
still closes the migrated public world. Verified admin tombstones remain available for repair.
Memory practice must explicitly seed `seasonOpen: true` when its write policy is public.
Phone hashing requires a secure browser context; use the deployed HTTPS preview for phone checks.
