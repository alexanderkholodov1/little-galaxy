# Alpha.1 cross-vendor review fixes

2026-10-24. Base: `a33f92b` (.23), branch `v1.0.0-alpha.1-alive`.
Local work only: no push, tag, merge, rules/index deploy, GitHub dispatch or Hosting deploy.

## Fixes and regression coverage

| Review item | Result and test |
| --- | --- |
| MAJOR-1 | Read-only migration validation runs after closure and before deployment. A durable deployment boundary prevents reopening incomplete migrations, including workflow recovery retries. Emulator tests exercise invalid sources, duplicate ownership, entry/byte capacity, possibly partial deployment and post-deploy migration failure/retry. |
| MAJOR-4 | Release and stand startup transactionally create missing config with shared closed defaults, preserving existing documents. Emulator tests cover first release without init, concurrent startups, exact default values and unchanged update times. The CLI journey starts the actual stand before any config exists. |
| MAJOR-2 | Controls have no concurrency pending slot. Releases serialize data jobs separately. Config/marker transactions preserve explicit emergency closure during deployment or retained recovery, preserve other operator flags, and reject reopening a migration window. Workflow boundary tests and emulator races cover these paths. |
| MAJOR-3 | Deployment, publication and dispatch fetch current main and require its exact web package tag. A real local remote advancing after checkout proves stale reruns fail; historical stable tags above the alpha do not affect authorization. Job-token auth is subprocess-only; checkout credentials remain unpersisted. |
| MINOR-4 | Existing shards without completion are refused before deployment. Atomic create preconditions also refuse a shard inserted after validation. Emulator tests verify original contents/update times survive. |
| MINOR-6 | Same-version merges emit an Actions notice and run summary. The test executes the actual planning command against a tagged fixture repository and reads both outputs. |
| MINOR-7 | Behaviour tests execute tag creation, current-main guards, recovery shell exits and published-artifact verification. Static workflow assertions remain for declarative wiring; actual GitHub scheduler/environment behaviour needs a GitHub run. |
| Credits | Every route uses a small Credits / Créditos control. The card contains only the game name, Alexander Kholodov · USFQ and one localized portfolio home link. Removed profile fetching and object/postcard social links. Browser journeys cover every view at 375/390/1440px, 44px targets, both languages, focus wrapping/return, Escape and postcard sharing/download. |

## Before-fix evidence

Final tests were run against an isolated `git archive a33f92b` source tree with existing
dependencies linked read-only; no package install was run in that tree.

- Migration/recovery integration suite: **14 failed, 5 passed** (19 tests).
- Updated App suite: **9 failed, 8 passed** (17 tests).
- Workflow boundary suite using original workflow/verifier sources: **3 failed, 2 passed**.

Logs: `/tmp/alpha1-fix-rules-baseline.log`, `/tmp/alpha1-fix-credits-baseline.log`,
`/tmp/alpha1-boundaries-before.log`.

## Validation

Checks follow `.github/workflows/checks.yml`. Heavy jobs run sequentially, every
Chromium command holds `flock /tmp/beacon-chromium.lock`, emulator JVMs use
`JAVA_TOOL_OPTIONS=-Xmx512m`, and CLI state uses writable
`XDG_CONFIG_HOME=/tmp/galaxy-firebase-config` with `CI=1`. No live service-account file was read.

- Typecheck and lint: passed with `TURBO_FORCE=true`.
- Unit/script suites: **299 passed** (shared 38, stand 19, web 169, scripts 73).
- UI: **26 passed**, plus **2 connected-emulator smoke journeys passed**.
  The first browser pass found an obsolete postcard-social assertion and native
  focus wrapping; both were corrected before the successful full UI rerun.
- Final App recheck after focus wrapping: **17 passed**.
- Workflow syntax: all five YAML files parsed with PyYAML.
- Full Firestore rules/admin integration suite: **214 passed** across seven files.
  The first full pass caught one older fixture that retained shards from preceding
  tests. Its setup now clears its own sky fixture; the complete rerun passed.
- Real production-build swap: **A→B and B→A rollback passed**, preserving phone
  draft, camera, scene, selected object and volume; no reload loop.
- Hosted-mode read-only smoke against a local built app: **1 passed**.
- Failure-mode drills: **5 passed**.
- Load: **100/100 journeys**, 1,001 expected events; modeled day **36,348 reads /
  10,392 writes**, below the 37,500 / 15,000 safety ceilings. Probe duration 52.9s.
- Build and privacy: **passed**, 42 build files scanned. The build uses public
  `.env.example` rehearsal values, not production configuration.
- Credits screenshot journey: passed; light English and dark Spanish phone cards
  plus the closed workshop inspected at 375px. Screenshots are retained in
  `/tmp/alpha1-fix-visuals/`. Both schemes preserve the finding-chart typography
  and focus/touch targets; the closed game shows only the small Credits control.
- Reports written incidentally by drills/load were restored to the existing checked-in
  versions; the new measured results are recorded here.

Logs: `/tmp/alpha1-fix-{tests,scripts,ui,typecheck,lint,credits-final,rules,live-safety,drills,load,build,visuals}.log`.

## Acceptance boundaries

RUNBOOK §11 documents MINOR-1 (environment branch policy is the security boundary),
MINOR-2 (no runner-loss watchdog), and MINOR-5 (7-day exact-artifact retry window;
full rebuilds cannot replace published bytes). MINOR-3 is fixed for supported
controls; direct Console/Admin SDK edits bypass transaction coordination and remain
an explicitly documented caveat. GitHub's single pending slot can still replace an
older queued release, but cannot cancel emergency controls.

No deployed preview or physical phone verification was performed. Those checks,
the first approved GitHub run and live IAM/environment enforcement remain open.
The portfolio plan is outside writable roots: its product/architecture/config/
decision/CHANGELOG corrections are staged in
`docs/plan-updates/alpha1-no-manual-steps.patch`, which passes `git apply --check`
against the current local portfolio plan, but remains unapplied there.

## Commit handoff limitation

Normal `git add` and `git commit` could not create `index.lock`: the exact linked
worktree metadata directory `/home/alexamaze/Fauns/little-galaxy/.git/worktrees/galaxy-alpha1`
is bind-mounted read-only. The broader common `.git` writable root does not change
that child mount. The review worktree remains at `a33f92b` with these source changes
uncommitted. A mount correction was requested while validation continued.

The requested operator-authored .24–.27 history is preserved in the recovery bundle
`/home/alexamaze/bad/checkpoints/galaxy-alpha1-fix-review.bundle`; it has not been
applied to the actual review branch. No workaround changed protected metadata.
The local rehearsal build's commit metadata therefore still identifies `a33f92b`;
production CI must rebuild the exact approved tag after the commit handoff.
