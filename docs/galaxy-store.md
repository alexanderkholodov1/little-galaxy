# GalaxyStore — frictionless admission

Import the common contract from `@little-galaxy/shared` and the Firebase transport from
`@little-galaxy/shared/firestore`. The common entry has no Firebase runtime dependency.
Memory practice supplies the same atomic transaction and subscription interface.

```ts
const store = createGalaxyStore(firestoreGalaxyDriver(db), {
  uid: auth.currentUser.uid,
  memberId: crypto.randomUUID(), // seed only; existing membership identity is reused
  now: () => sharedClock.now(),
});
const loaded = await store.loadGalaxy();
await store.setName(loaded.galaxy.id, 'Alice'); // empty means Anonymous
const accepted = await store.launch(loaded.galaxy.id, {
  id: savedDraftNonce, type: 'launch', kind: 'planet', system: '0', seed: 42,
  origin: [7000000, 0], velocity: [0, 1400000], design: { colour: 0 },
  effectiveTick: 0, // admission assigns this on every transaction attempt
});
```

## Player contract

There are two admission safety ceilings: 2,048 physical bodies per galaxy (including seed
and nursery stars; binary costs two slots), and one accepted launch per second per member.
Launch pacing reuses the existing Firestore server timestamp, `mutationTime`; `lastLaunchAt` supplies the
numeric client/memory equivalent. Edits, renames and activity updates neither consume nor
reset this clock. Recovering an accepted nonce does not consume another launch.
Already-open clients may omit the new numeric field and keep updating retired bucket telemetry.
Older clients still stamp mutationTime on edits, conservatively restarting their one-second
interval; updated clients preserve it for edits, names and presence. No new required server
write field blocks cached phones during rollout.

Removed: the 15-second mutation cooldown, global token bucket, 4,096-action ceiling, daily
mutation and launch budgets, first-contribution reservation, per-player bodies/mass/black-hole/
stellar caps, black-hole spacing and five-minute profile gap. Existing daily counters remain
telemetry; `dailyLimit`, `tokens` and `bucketSlot` remain compatible stored fields without
admission authority. Admission no longer reads quota calendar documents. `quotaWindow` still
supplies Pacific-day telemetry, including DST transitions.

Mass (4,096,000,000) and black-hole (2,048) schema bounds derive from physical slots and the
heaviest material (2,000,000 per body); they cannot independently fill a valid galaxy.
Ownership inventory has the same physical bound. Removal leaves tombstones and does not refund
slots. Lifetime sequence/launch counters have no former gameplay ceilings.

System envelopes (32 bodies, 3,200,000 mass, two compacts, six giants, one hole, 200,000 ordinary
mass) guide routing. The phone tries the selected home, another existing home, then a fresh
numeric home. IDs extend through 2,047. Funded reserves do not consume admission homes.
A final ordinary slot may share an existing home instead of charging another nursery.
Concurrent launches may cross a target; rules enforce exact accounting without denying that
launch. Moons stay with a real planet/giant in its admitted home, even across a routing target.
Parent reciprocity remains; the old two-moon count ceiling is removed.
Only galaxy capacity has a full-capacity message, in English and Spanish. Drafts stay saved.

Compact launches into existing homes fund contingency cells in `head.reserves`, keyed by nonce,
without counting mass twice. Replay may materialize the deterministic `r-<nonce>` home if the
body leaves. Reservations remain conservative; no transfer/refund API is supplied.

## Transaction timing and recovery

The browser saves a quantized draft and stable nonce with unscheduled `effectiveTick: 0`.
After all transaction reads, each callback attempt samples the anchored clock and chooses
`max(head.effectiveTick + 1, ceil((now - epoch + 2400) * 120 / 1000))`.
Retries do not reuse time sampled before contention, backoff or slow reads.
Callers and replay use the tick in the returned accepted action.

Nonce recovery compares authored content while ignoring the admission-owned tick. An accepted
nonce returns its original action unchanged after a lost acknowledgement or session reload.
Different vectors, design, material or other authored content with that nonce still fail.

The rules window is request time minus 1.5 seconds through plus 15 seconds, strictly above
the old head tick. The usual plus-2.4-second target allows about 3.9 seconds from final reads
to commit; the upper margin accommodates clock estimates and ordered contended heads.
This finite window does not guarantee acceptance after an indefinitely suspended request.
The lower bound remains newer than the keeper's existing two-second certification lag, so
a later commit cannot introduce an action at/before the saved certification tick.
Accepted-at and member time estimates allow 30 seconds of transport tolerance. Launch pacing
uses server timestamps, never submitted milliseconds.

Pass `{clock, getToken, emulatorOrigin?}` to the Firebase transport, with `ServerClock` from its
Firestore subpath and `getToken: () => auth.currentUser.getIdToken()`.
Then `driver.get('config/live')` uses authenticated REST batchGet, anchors to server `readTime`
and advances on `performance.now()`. Await this before using the store, and re-anchor on
foreground resume. Neither device wall time nor an old galaxy timestamp is current-time authority.

Transactions normally read nonce, galaxy, head, private member, live config and the current
64-entry page. Moons additionally read/write their parent; edits/removals read their body.
All reads precede writes. The common writes are head, member, immutable action, append-only
page, body and latest cache. The transport stamps `mutationTime` only when the launch count increases;
member updatedTime, action reciprocity and head updatedTime link edits to their transaction.
Prepared caches must match the current head sequence/generation and be recomputed outside a
conflicted transaction. Failed network actions are never queued as authoritative writes.

## Integrity, profiles and administration

Rules remain deny-by-default, including the final recursive catch-all. Field allowlists,
types, bounded integer vectors/design, ownership, generation and sequence checks remain.
Auth UID owners write their private membership; public `memberId` labels do not expose UIDs.
Only body owners edit; only allowlisted keepers remove. Moon parent changes and every
head/action/member/body/page/cache write remain reciprocal in the same atomic commit.
Actions are immutable; pages preserve the entire prior prefix and append exactly one action.
Frozen/archived galaxies and frozen write policies reject player writes, including profiles.
Public play rechecks active selection, season, launch and edit switches.

Names are nonunique escaped labels up to 24 printable Unicode code points. Empty means
Anonymous. Prototype whole-word rude-name filtering remains in `setName`.
Names may change at any time in a writable galaxy; historical creator labels remain unchanged.
`touch()` voluntarily coarsens automatic presence to five minutes without blocking names.
`metrics()` requires keeper access and returns at most 300 members. There is no visit/session
tracker or one-second presence writer.

Keepers require a verified Google token and an email in `config/admins.emails`.
Client `admin: true` is not authority. Only keepers create real galaxies (three per account).
Administrative updates require the expected generation; archived galaxies cannot reactivate.
Visibility is fixed; fork to change it. Updates, selections and invitations append immutable
audit records. There is no deletion/purge API. No rules or production Hosting are deployed here.

## Hashes, logs and checkpoints

Canonical encoding sorts keys, types values, uses big-endian IEEE754 binary64, normalizes
negative zero, encodes UTF-8 and rejects nonfinite/unsupported values.
SHA-256 uses Web Crypto when `crypto.subtle` exists. Plain HTTP LAN practice uses the pure
JavaScript fallback only when it is absent, including when `crypto` itself is absent.
Tests compare both paths across Unicode, compound values, multi-block input and padding
boundaries. A rejected Web Crypto operation is not silently replaced.
Firebase network authorization is unchanged.

Vectors are integer millionths in x–z, speed is at most eight world units/second, seeds are
uint32, design fields are bounded integers 0–1,000,000 and intents have a 512-byte client
envelope. Material masses are fixed; design size does not change mass. Binary component IDs
use `<nonce>:b`; colons are invalid in action nonces, preventing component collisions.

Pages contain at most 64 actions and a 128 KiB client payload. Accepted actions have a
2,000-byte client envelope. There is no lifetime page count ceiling.
Phone hashes are hints: rules cannot calculate SHA-256 or gravity. Replay recomputes its own
prefix from accepted facts; `verifyTail(..., true)` additionally checks recorded hash hints.

`loadGalaxy` returns a coherent head boundary, manifest, private caller profile, genesis,
actions and optional verified checkpoint. Missing pages are errors, never empty worlds.
Subscribe from the returned boundary; listeners deduplicate overlap and follow page rollover.
Start the manifest subscription before loading to reuse its first server snapshot.
Stop listeners when hidden/unmounted, then reload history and re-anchor on foreground.
Read-only public viewers do not create Auth identities or private memberships.

Prepared state has a 14,000-character bound and is checked against generation/sequence/hash.
Without it, the comparison cache stores an `admission-v1` sequence/body summary instead of the
growing head map. Phone caches are untrusted and ignored by default; verifiers must replay
or validate trusted certification, never merely accept a submitted state hash.
Immutable keeper certifications use `{sequence}-{tick}` keys (old sequence-only keys still
load) and an admin-only monotonically advancing pointer. The loader checks kernel, generation
and state hash, then fetches the later tail. Frozen rendering includes already-admitted future
actions. Repeated freezing retains the original date.

Memory practice enforces admission but supplies neither Google identity nor Firestore rules.
It must remain explicitly local and never replace a failed network launch silently.
Simulation bytes, kernel pin, reducer, replay protocol and UI are unchanged. Deployed preview
and real-phone HTTP/HTTPS checks remain acceptance requirements beyond automated tests.
