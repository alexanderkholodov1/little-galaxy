# Alpha.1 release automation: prior-round local evidence

Historical evidence for commits .18–.23. Release recovery, initialization, queueing and
credits behaviour below are superseded by [the review fixes](alpha1-fix-review-status.md).

2026-10-24. Scope: release-on-merge, reviewed sky migration/recovery, GitHub controls,
and console-only release IAM. No push, tag, GitHub settings change, dispatch,
production rules/index deployment or Hosting deployment was performed.

## Regression evidence

- `scripts/release-plan.test.js` first ran against the original verifier: **5 failed,
  5 passed**. Tag decisions and prerelease helpers were missing.
- `tests/rules/sky-idempotency.test.js` failed against the original migration:
  after a first migration, a later visitor shard update was overwritten by a rerun.
- `scripts/release-publish.test.js` ran its three cases against the original
  `release.yml` shell with a fake `gh`: **3 failed**, because reusable calls from
  main would publish `main` instead of the exact alpha/beta/stable tag.
- The initial `release-sky.test.js` emulator run could not collect: the release
  orchestrator did not exist. Its eight cases now pass in the full emulator run:
  no-op releases, originally open/closed flags after deploy failure, migration
  validation failure/retry, interrupted recovery, exact legacy/seed data, loud
  restoration failure with retained state, and interruption before migration.

## Final validation

Heavy checks ran sequentially with the same package scripts as `checks.yml`.
Local tools: Node 24.9.0 (CI uses 22), pnpm 11.5.2, Java 21.0.12.1.
`TURBO_FORCE=true` prevented test/build cache reuse. Local emulator commands used
`JAVA_TOOL_OPTIONS=-Xmx512m`, `CI=1` and writable
`XDG_CONFIG_HOME=/tmp/galaxy-firebase-config`; the default CLI update store is
read-only in this sandbox. No credentials were needed or created locally.

| Check | Observed result |
| --- | --- |
| Frozen dependency install | passed |
| Typecheck and lint | passed |
| Shared unit tests | 38 passed |
| Stand unit tests | 19 passed |
| Web unit tests | 170 passed |
| Script tests, including real publish-shell execution with fake gh | 68 passed |
| Browser UI checks | 26 passed |
| Connected emulator browser smoke | 2 passed |
| Actual production-build swap | A→B and B→A passed, preserving draft/camera/focus/volume |
| Hosted-mode read-only smoke against a local built app | 1 passed |
| Firestore rules and admin integration tests | 203 passed across 7 files |
| Failure-mode drills | 5 passed |
| Load/quota | 100/100 visitor journeys; 1,001 expected events; whole day 35,280 reads / 10,392 writes, below 37,500 / 15,000 ceilings |
| Build and privacy | passed; 42 build files scanned |
| Workflow syntax | all 5 workflows parsed with PyYAML; actionlint unavailable |

The final build used the public rehearsal placeholders from `.env.example` through
`with-example-env.js`; it is not a production-configured release artifact. Local
build metadata still sees the original linked-worktree HEAD because Git metadata
is read-only. Production CI will check out the verified tagged merge commit.
The quota and drill scripts completed successfully; incidental report rewrites
were reverted, preserving the existing published reports. This file records the
new run's measured counts without implying a client quota change.

Logs: `/tmp/alpha1-{install,typecheck,lint,tests,scripts,live-safety,rules,drills,load,build}.log`.
Baseline logs: `/tmp/alpha1-red-{emulator,idempotency,publish}.log`.
The first release-plan failure was captured directly in the tool transcript.

## Handoff boundaries

The linked worktree's Git metadata and `~/bad/checkpoints` are outside the writable
sandbox. Source changes remain visible in this worktree; commits authored as
alexanderkholodov1 <kholodov.alexander1@gmail.com> are preserved in
`/tmp/galaxy-alpha1-no-manual-steps.bundle`, with no tag or remote mutation.
The checkpoint is `/tmp/alpha1-no-manual-steps.md`.
The portfolio plan is also read-only; its architecture and CHANGELOG update is
staged as `docs/plan-updates/alpha1-no-manual-steps.patch`, not applied there.

RUNBOOK §11 lists the five service-account roles, their purpose and console clicks;
actual IAM grants and the environment approval remain operator actions. Existing
project/database/APIs, environment protection and secrets were not inspected or
changed. A merge-triggered GitHub run is still needed to prove those integrations.

A runner disappearing or a Firestore outage can prevent immediate restoration:
the job fails, durable recovery state remains, and the GitHub `restore-season`
action retries it. The first schema boundary can reject old-client writes between
new rules and the portfolio rollout. A production index may still be building
after its definition is deployed. Deployed-preview, physical phones, campus
network and production index readiness remain acceptance work after review/push.
