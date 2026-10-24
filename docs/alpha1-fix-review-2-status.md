# Alpha.1 re-review 2 fixes — local evidence

Base: `cf014bc`. No rules, indexes, Hosting, IAM or GitHub state was changed.

- NEW-1: the same deploy CLI first authenticates and reads the exact target project
  with `apps:list --project … --non-interactive`. This runs before any season or
  migration-marker write. Failure rejects loudly without attempting deployment or
  restoration. Visibility does not prove all deployment permissions. RUNBOOK §11
  describes clearing only `deploymentStarted` after independently verifying that
  rules and indexes stayed unchanged.
- NEW-2: release and recovery failures are captured separately. The thrown message
  includes the original migration/deployment error and the retained closed-season
  recovery error; `cause` retains the original failure. Cleanup cannot replace it.
- NEW-3: Operate the sky includes `inspect` (empty key/value). It reads and prints
  the migration marker, season flag, active/unsupported/duplicate-owner counts,
  existing-shard count, and computed shard entries/bytes and limits. Inspection and
  validation share source analysis. Inspection writes nothing. The runbook names
  real GitHub actions and explicitly identifies reviewed Console/Admin repairs,
  including the existing-shard refusal and backup requirements.
- NEW-5: retired profile module/test, unused `nav` copy and profile fixture route
  are removed. The four status/format documents and changelog follow the Credits
  contract, with no profile fetch or social links.
- NEW-4: the captain retains Home → workshop and direct booth URL navigation for
  alpha.1. `alpha1-status.md` records that the later redesign defines navigation.

## Regression evidence

Tests ran before implementation: the emulator release suite had 19 passing tests
and three intended failures (ignored CLI preflight, lost root cause, absent
inspection). Stand tests rejected inspect and could not import the absent CLI
helper. The profile retirement regression failed on the still-present module.
The focused release emulator suite then passed 22/22. New checks also exercise the
real inspect dispatch CLI and its unchanged configuration update time, and the
same duplicate/capacity/byte counts used by validation.

## Final checks (2026-10-24)

The checks use the scripts in `checks.yml`, with forced Turbo execution. Heavy
steps ran serially; Chromium commands used `flock /tmp/beacon-chromium.lock`.
Dependencies and installed Chromium were already present; no dependency changed.

| Check | Result |
| --- | --- |
| Typecheck and lint | Passed; final runs after code edits |
| `pnpm run test` | 296 unit/script tests: shared 38, stand 23, web 161, scripts 74 |
| UI journeys | 26 passed, including memory, postcard and Credits/viewport journeys |
| Connected emulator smoke | 2 passed |
| `pnpm run test:live-safety` | Real A→B and B→A swaps passed; hosted read-only smoke 1 passed |
| `pnpm run test:rules` | 217 passed across 7 files |
| `pnpm run test:drills` | 5 automated drills passed |
| `pnpm run test:load` | 100/100 flows in 40.3s; 1,001 expected events reconciled |
| Load day model | 35,166 reads / 10,392 writes, below 37,500 / 15,000 ceilings |
| `pnpm run build` + privacy | Passed; 42 files scanned; six public repository Firebase variables |
| Diff and staged portfolio patch | Diff check and portfolio `git apply --check` passed |

Logs are `/tmp/galaxy-review2-{test,typecheck,lint,live-safety,rules,drills,load,build}.log`.
Incidental drill/quota report rewrites were retained under `/tmp/galaxy-review2-*`
and restored in the source tree. All owned runners, emulators, web servers and
browsers exited. Emulator ports are clear and the Chromium lock is free.

## Handoff and remaining acceptance

Git metadata for the original worktree remains unchanged at `cf014bc`. Commits
`1.0.0-alpha.1.28` onward are authored and committed as
`alexanderkholodov1 <kholodov.alexander1@gmail.com>` in a scratch clone, with no
trailers, and transferred as `~/bad/checkpoints/galaxy-alpha1-fix-review-2.bundle`.
The bundle requires `cf014bc` and exposes branch `alpha1-fix-review-2`.
The checkpoint `~/bad/checkpoints/alpha1-fix-review-2.md` records exact hashes and
bundle verification. The worktree retains the same source content as that branch.

Still open: deployed-preview and physical-phone acceptance; the first approved
GitHub release to verify live IAM, environment restrictions/reviewer, reusable
workflow wiring and tag rulesets; applying the extended portfolio plan patch in
that repository. The portfolio checkout is outside the writable roots; the patch
is staged and apply-checked, not applied. No live deployment is certified here.
