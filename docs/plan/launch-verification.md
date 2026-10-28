# rc2 launch verification extension

Operator instruction: 2026-10-28 16:05Z. Visitor-facing content and visuals belong
to the separate Opus pass. This extension changes no visitor UI, physics or rules.

## Evidence and unresolved production denial

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

Age is therefore not an established cause. No failing rule expression can honestly
be cited from this evidence. No rule or limit has been removed speculatively. The
production denial remains unresolved pending the failed request/browser receipt or
an export of the actual deployed rules if they differ from the checked-in rules.
Local evidence is under `.tmp/rc2-launch/`; production writes were not performed.

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
Four returning-state cases now extend the long-gap acceptance proof.

## 0.25x playback assertion

The 2e9e73c failure was a wall-clock observation race: its two-second sequence
predicate timed out, then the captured diagnostic already showed tick 18538 and
sequence 1 (the first launch is at tick 18536). The replay crossed the event. The
check now waits for the rendered replay tick to reach the first launch, then still
requires sequence >= 1, using the suite's existing assertion policy. All five speeds
remain covered. No playback, physics, animation or latency threshold is changed.
