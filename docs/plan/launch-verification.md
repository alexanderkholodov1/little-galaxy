# rc2 launch verification extension

Operator instruction: 2026-10-28 16:05Z. Visitor-facing content and visuals belong
to the separate Opus pass. The later lead steer approves the naming and administration logic below; physics and rules remain unchanged.

## Production-fixture and returning-session evidence

The captain captured an active public sandbox with an empty sequence-0 head, an
old epoch and bucket slot, no genesis and no checkpoint/log page. The earlier
public export in this worktree retained that exact state. A later read-only curl
snapshot showed sequence 1, so the statement that no launch had ever succeeded
was no longer current at investigation time.

The original sequence-0 documents were seeded into the Firestore emulator. A real
browser used the existing workshop and drag gesture through `shared-world.js` and
the shared store. The original production-age launch succeeded. A second run aged
the epoch, creation time and bucket by 36 hours and crossed the quota-window boundary;
`ensureOpenSandbox` preserved the galaxy and its first launch succeeded. Named-visitor
probes also succeeded for planet, giant, star, binary, pulsar, blackhole, nebula,
asteroid and comet. No rule-evaluation denial was emitted by those reproductions.

Galaxy age alone is not the cause. The later returning-session probe below establishes
a clock defect with a real emulator denial; the owner's exact historical request has
no captured browser/request receipt, so its attribution remains an inference. No rule
or limit has been removed speculatively. Local fixture evidence is under
`.tmp/rc2-launch/`; production writes were not performed.

## Repeatable launch and cleanup proof

Acceptance forces `ensureOpenSandbox` to provision a fresh sandbox 36 hours before
its first launch, then calls it again at the current time to prove idempotence.
It asserts that the initial bucket and quota window are old. The new browser journey
launches through the real client and observes the exact logical body in a second
browser's replay-worker output. It then exercises ownership-checked admin cleanup,
retained history, idempotence and removal observed in both browsers.

`pnpm accept:live <game-url>` runs the same journey against a deployed client. It
uses the production database as an anonymous visitor. A server-side credential by
path is mandatory for cleanup before any browser opens. The credential never enters
the page. The cleanup verifies that the body belongs to the fresh anonymous account,
refuses other visitors' bodies and host objects, and appends a shared-store admin
removal rather than deleting history. A private journal retains the Auth UID for
failure cleanup; the uploaded public receipt excludes it.

Release deploys the exact checksummed artifact to a seven-day portfolio-project
channel named `release-<tag>` (dots become hyphens for the channel ID). It pins
`version.json` to the release SHA and tag, then runs the proof against the existing
active production galaxy. Only a passing proof and cleanup unlock rules deployment
and the exact-tag portfolio live dispatch. The candidate never provisions or changes
the active selection. Failure leaves live Hosting, rules and selection untouched;
the requested probe still appends immutable launch/removal history in production.
An always-run cleanup precedes credential deletion, including on browser failure.

## Seven-day PR previews

Operator decision (2026-10-28, lead steer): restore Little Galaxy's own preview-only
Hosting channel deployment using the existing
`FIREBASE_SERVICE_ACCOUNT_ALEXANDERKHOLODOV`. The portfolio repository stays unchanged.
The single `pnpm check` job prepares frozen records and uploads its checked client;
a same-repository PR job downloads that artifact without rebuilding and deploys
`pr-<number>` on project `alexanderkholodov`, expiring after seven days. Root
`firebase.json` still has no Hosting target; generated preview-only configuration
serves the artifact at `/little-galaxy/` and never deploys the live channel.

The job uses `GITHUB_TOKEN` with `pull-requests: write` to create or update one bot
comment with the exact checked SHA and playable URL. It explicitly says the channel
uses the production database and admin Google sign-in is unavailable there because
preview domains are not Firebase Auth authorized domains. Fork PRs receive no secret
preview deployment. A real PR run must prove the existing credential's Hosting access,
comment permission and deployed browser behavior; no deployment ran during this work.

`pnpm accept:live <channel-root-or-game-url>` accepts `*.web.app` channel addresses.
Before privileged cleanup, the stand verifies the anonymous Firebase ID token against
the data project. Browser Auth identities are accepted only from the official Auth
endpoint (or the isolated emulator), and neither tokens nor Auth UIDs enter public
receipts. A deployed proof requires separate operator authorization outside release.

## Change log

- 2026-10-28: record the operator's extension, the successful aged production-fixture
  reproductions, the still-unresolved denial, the long-gap/live launch proofs and the
  initial preview credential/workspace blockers, superseded by the lead’s preview-only
  decision above. No visitor content or rules changed.
- 2026-10-28: widen the action rule's late-tick window from 1.5 s to 10 s and move the
  keeper's certification lag from 2 s to 12 s, after the production late-commit denial
  below (lead brief; the owner's principle of few limits and a working launch).

## Returning-visitor investigation (lead steer, 2026-10-28)

The four requested returning states were reproduced through the real browser client:
per-galaxy saved name with profile synchronization delayed, persisted Auth with only
an older BAD member, the legacy `fogata.player.v1` name and the legacy scoped name.
Each target member was absent on entry. All four launches succeeded with no rule
evaluation denial. The first two created `Anonymous` through `initialMember`; the
legacy prompt cases created a valid named profile before admission. Thus the current
client does not exercise the hypothesized named first-launch member creation. The
`bMemberWrite` Anonymous-only clause cannot honestly be cited as the observed cause
from these reproductions and is not changed speculatively. The owner’s failed request
or whether the tab still ran an older release remains needed to identify that denial.
Those four returning-state cases extend the long-gap acceptance proof, with the stale-clock case below added as a fifth.

## 0.25x playback assertion

The 2e9e73c failure was a wall-clock observation race: its two-second sequence
predicate timed out, then the captured diagnostic already showed tick 18538 and
sequence 1 (the first launch is at tick 18536). The replay crossed the event. The
check now waits for the rendered replay tick to reach the first launch, then still
requires sequence >= 1, using the suite's existing assertion policy. All five speeds
remain covered. No playback, physics, animation or latency threshold is changed.

## Approved administration logic and naming

The lead approved three visible changes on 2026-10-28: count visitor-launched bodies,
remove fair/booth selection, and present the shared sky as Open Galaxy / Galaxia abierta.
Administration counts now derive from genesis and accepted launch/removal records,
including both members of binary pairs, instead of the head's count of generated
central/nursery hosts. Cards, metrics and backup summaries use this count; exported
history and its raw head remain intact. BAD therefore shows 21 rather than 22; an
empty open galaxy shows zero. No physics or animation changes are involved.

The admin exposes only activation of the public galaxy. The read-only screen follows
that same active selection, including later selection changes, and retains its join QR.
The old database field remains for compatibility with older clients and unchanged
rules, but current screen selection and periodic certification ignore it. Provisioning
renames only the legacy default of an active open galaxy; custom names and frozen
histories stay intact. Presentation also localizes old default names before release.

## Returning-session clock denial and fix

A persisted Google account with membership only in BAD also launched successfully.
A session with a two-hour stale server-time anchor then reproduced the exact existing
permissions message, head sequence zero and no accepted body through the real client.
The new member was `Anonymous`, ruling out the named-first-member clause in this run.
The regression injects an old readTime before admission without changing Date or the
monotonic clock, and allows an actual fresh server read once the draft is submitted.
It fails on unchanged application commit `72508e8`; receipts and rule logs are under
`.tmp/rc2-clock/baseline*`. An earlier direct clock-gap probe is retained separately.

The emulator reports denied member create at `firestore.rules:496`, action create at
`:542` and head update at `:538`. The submitted lastSeen/acceptedAt are two hours behind
request time: they violate `bMemberSchema` line 455 and `bAccepted` line 372, and the
scheduled tick also violates line 376. This is a stale session clock, independent of
the galaxy's epoch age or the saved name. A visibility resume normally re-anchors time,
but admission previously relied on that event or a reload having happened.

The client now obtains a fresh config readTime before profile writes and before each
launch, then the existing shared transaction derives the tick after its reads. The
saved nonce and design survive a synchronization failure. All schema, ownership,
freeze, allowlist and clock-ordering protections remain unchanged; no rule or limit
is removed. The fifth long-gap journey requires both the stale opening and a fresh
admission-time read, exact-body second-browser visibility and admin removal. No
visitor wording, physics or animation changes accompany this fix. Real-device sleep
and the owner's original failing request still require their own receipt to confirm
that historical attribution.

## Late-commit tick denial and fix

The lead captured a refused and an accepted production launch on the same head
(`LG-launch-denial-evidence.md`). In the refused one the client stamped `acceptedAt`
and the effective tick, then sent the commit about 6.5 s later, after publishing a live
snapshot. The tick leads its stamp by 2.4 s and the action rule (`bAccepted`) allowed it
at most 1.5 s behind the server, so the whole transaction was refused as a permissions
error. The emulator never showed it: local work is fast and seeded documents keep the
snapshot publisher quiet. This is independent of the stale session clock above.

The Firestore web SDK runs one transaction commit at a time per page and holds that
queue until the commit returns. A launch that stamped while the page's snapshot
transaction was still reading could therefore wait behind a snapshot upload of up to
900 KB, and every await after the stamp let a busy phone run other work.

The launch transaction now finishes every read and tick-independent check, then stamps,
schedules and hashes. It re-reads the synchronized clock right before the writes and
stamps again when more than 250 ms passed. Snapshot lease claims and publishes yield
while a launch is pending; a launch starts after a snapshot already sending.

Owner's principle: few limits and a launch that works. The rule now accepts a tick up to
10 s behind the server (12.4 s from stamp to server), which covers the observed gap, a
slow mid-range phone and a slow uplink, and still bounds backdating; replay rewinds late
actions from its once-a-second marks. The keeper certifies 12 s behind its clock, so a
commit its read missed, whose tick the rule admits no more than 10 s back, is never
covered. Both numbers live in the shared `TIMING`; emulator rules tests prove 9.6 s is
accepted, 10.6 s refused and the accepted tick stays ahead of an earlier certification,
and fail against the 1.5 s rule. Live snapshots keep their 2 s lag: they are provisional
and loaders already replay full history when a later action falls at or before their tick.

Acceptance journey 3 runs a phone at 6x CPU throttling, holds the launch commit six
seconds in the browser and requires acceptance with a tick more than 1.5 s behind the
server. On the unfixed application code of `5fe9e20` it fails there with the emulator's
"false for 'create' @ L542"; receipts are under `.tmp/rc2-tick/before/`. It then forces
a permission-denied commit and requires the plain refusal notice for at least eight
seconds with the body still in hand, and accepts the same body on the next throw.

Other client-stamped time checks: `acceptedAt` and member `lastSeen` keep +/-30 s, which
the new 12.4 s budget stays inside. A keeper's galaxy creation requires the head
`bucketSlot` to be the server's current or previous two-second slot, about 2 to 4 s from
stamp to server; it is a keeper action, not a visitor launch, and is left unchanged for
the lead's decision. The snapshot lease (expiry at most 35 s ahead) is optional work.
