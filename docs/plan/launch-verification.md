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

Release runs this proof after the exact client is live and its sandbox is selected.
An always-run cleanup step precedes credential deletion, including when the browser
step fails. Production proof failure fails the release; local tests do not certify
live Google, real phones or the owner's previously failing browser session.

## PR preview dependency

The requested preview architecture is a Little Galaxy PR build dispatched to the
portfolio, which assembles the complete site and deploys a seven-day channel. The
Little Galaxy PR comment must identify the exact build and state that the preview
uses production data. No game-repository Hosting deployment is allowed.

The portfolio has `FIREBASE_SERVICE_ACCOUNT`, but lacks a token for downloading the
Little Galaxy Actions artifact and commenting on its PR. This requires a portfolio
secret such as `LITTLE_GALAXY_PREVIEW_TOKEN` with Actions read and Pull requests write
on `alexanderkholodov1/little-galaxy`, or equivalent GitHub App access. Its built-in
`GITHUB_TOKEN` is scoped to portfolio. The existing Little Galaxy
`PORTFOLIO_DISPATCH_TOKEN` covers the outward dispatch, not this portfolio-side access.
The credential-dependent preview item is stopped per the operator's instruction.
The portfolio checkout is also outside this session's writable roots; a separate
portfolio branch/commit set cannot be created with the current sandbox permissions.

## Change log

- 2026-10-28: record the operator's extension, the successful aged production-fixture
  reproductions, the still-unresolved denial, the long-gap/live launch proofs and the
  precise preview credential/workspace blockers. No visitor content or rules changed.

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
