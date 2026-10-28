# Little Galaxy plan of record

This folder is the plan of record for Little Galaxy (repository `alexanderkholodov1/little-galaxy`). It replaces the
plan branch `plan/v0.0.1-galaxy-m0` (PR #1, closed unmerged). Everything still useful from that branch is carried
here, so the branch can be retired. Anyone (captain, brigade member or worker) can resume at any milestone ("hito")
from this folder without any chat history.

| File | What it holds |
| --- | --- |
| [README.md](README.md) | What the product is, how to read the plan, versions, release policy, how the plan changes, history |
| [milestones.md](milestones.md) | Every hito, past, current and future: scope, packages, order, shared-file owners, interfaces, acceptance, state with evidence |
| [admin-sign-in.md](admin-sign-in.md) | Decision for the admin sign-in (part of the current hito) |

Supporting records that stay where they are: `CHANGELOG.md` (what each release shipped), `docs/RUNBOOK.md`
(operations), `docs/automatic-releases.md` (version allocation), `docs/prototype/NOTES.md` (status of the owner's
requirements R1-R27), `docs/prototype/RELEASE-CANDIDATE.md` (current hito evidence).

## The product

Little Galaxy is a live, shared 3D galaxy that visitors build from their phones. It started empty at USFQ's open house
BAD Day 2026 ("Be a Dragon", 2026-10-25). Each body was made by one person, and everything is recorded so the day can be
replayed. Its tone is tender, satisfying and non-destructive (plan branch `01-product-spec.md`, Concept). It is served
under the portfolio at `https://alexanderkholodov.web.app/little-galaxy`. The printed fair QR (`/galaxy`) redirects
there.

The owner's decisions that still define it:

| Topic | Decision | Source |
| --- | --- | --- |
| Entry | QR opens the game directly. The visitor sees and explores the galaxy first. Creating is optional. A name is asked before the first launch, with an anonymous option. | plan branch `08-decisions.md` (2026-10-09); R4 in `~/bad/spec/r3-operator-review.md` |
| Quality | Build a small complete experience at final quality before adding breadth | `08-decisions.md` |
| Ownership | Each project owns its plan, source and commits. The portfolio hosts many projects and receives versioned release artifacts, not source. | `08-decisions.md`; plan branch `README.md` |
| Languages | English primary, Spanish secondary in the UI. Repository content in English only. | `08-decisions.md`; `AGENTS.md` rule 4; owner 2026-10-28 |
| Name and path | "Little Galaxy" (R11) at `/little-galaxy` (R17), the old `/galaxy` redirected | `r3-operator-review.md` |
| Physics | A launched body keeps the orbit its launch created (R25); real orbital mechanics, made gentle (R9) | `r3-operator-review.md` |
| Players | No cooldowns, per-player caps, rename gaps or daily budgets that players can feel. Only two invisible safety ceilings: about 2,000 bodies per galaxy, at most one launch per second per player. | owner 2026-10-25, `~/caspian-kb/agenda/HANDOFF-after-fair-2026-10-25.md:15-16,50-55` |
| Tests | Keep only tests that catch real failures. GitHub CI is not evidence; real proof is local `pnpm accept` and use in production. | owner 2026-10-25 and 2026-10-27 (`HANDOFF-after-fair…:17-18`; `~/Workspaces/lg-inputs/LG-whole-game.md:23-25`) |
| Cost | Firebase Spark (free) plan only; no Cloud Functions | `AGENTS.md` rule 8 |
| Process | Proportional: under a deadline nothing may block use or slow a fix. With time, build it well. An emergency order is not a permanent rule. | D-31, `HANDOFF-after-fair…:11-14` |
| Simplicity | "If something can be done easier and simpler, do it that way", and as one durable solution, not a workaround | owner 2026-10-28 (`~/caspian-kb/rules/sources/2026-10-28T0204Z-session-8db6acd1.md:8`) |

## How to read the plan

1. Find the current hito in [milestones.md](milestones.md) (state **open**). Its "Remaining" list says exactly what is
   left, who does it and how it is proven.
2. Before working on a package, read the hito's **interfaces** (what it consumes and delivers) and **shared-file
   owners**. Only the named owner edits a shared file within a hito. Others hand their change to that owner.
3. A hito is done only when its **acceptance** is met in real use (production or the owner's devices), never on a green
   CI status alone.
4. Anything marked **proposed, the owner decides** is not approved scope. Do not build it before the owner approves it.

## Versions

The owner's maturity scheme (2026-10-28) applies to new projects. Little Galaxy already released a `v1.0.0` line, so
its tags stay as they are and its own final goal is `v1.1.0` (owner, 2026-10-28: "dejalos asi ... tecnicamente los
alphas de v1.0.0 si eran la produccion ... lo que queremos alcanzar como meta final es v1.1.0"):

| Stage | Version | Meaning |
| --- | --- | --- |
| Complete and in use, still gaining features | `v1.0.0-alpha.X.Y.Z` | Hito `alpha.X`, work package `alpha.X.Y`, commit `1.0.0-alpha.X.Y.Z` |
| Feature-complete, only fixes and polish | `v1.0.0-beta.X.Y.Z` | Same levels as alpha; the first beta hito extends the release tooling, which today compares only alpha tags (`scripts/release-version.js`) |
| Reviewed by the owner and called perfect | `v1.1.0` | Only the owner names it |

Little Galaxy is in the alpha stage: it is complete and in use. A release-candidate suffix (`-rc2`) is used by the
current admin fix hito. The owner has not yet decided between `-rc` and `-release` for future hitos (2026-10-28).
Versions are allocated automatically from the PR head branch (`docs/automatic-releases.md`). Nobody edits a version by
hand, and nothing requires a PR title to repeat a version written elsewhere (owner, 2026-10-28: manual version updates
"must be purged").

History: tags `v1.0.0` (2026-10-23, PR #9 "Fair-ready") and `v1.0.1` (PR #10) were created before this scheme was
stated, and the line was renumbered to `v1.0.0-alpha.1` on 2026-10-24 (PR #11). They are production history and are
not renamed (owner, 2026-10-28).

## Release policy

**Production follows a merge, with no approval step** (owner, 2026-10-28: Little Galaxy is urgent).

| Step | Who | What happens | Evidence that it worked |
| --- | --- | --- | --- |
| 1. Merge the hito's PR into `main` | The owner. A captain merges only on his explicit instruction for that PR (D-30, 2026-10-25, `HANDOFF-after-fair…:20-21`). | — | PR state "merged" |
| 2. Release on merge | GitHub Actions `release-on-merge.yml` → `release.yml`, automatically | Allocates the exact tag from the head branch. Builds once, with the privacy gate. Disables data-site content and verifies the reserved auth helper. Deploys Firestore rules and indexes to project `little-galaxy` (environment `little-galaxy-rules`: branches `main` and `v*`, no reviewer). Publishes the GitHub release with `galaxy-dist-<tag>.tar.gz`. Dispatches `galaxy-release` with that tag to the portfolio, which deploys Hosting for `alexanderkholodov.web.app`. Then it probes the admin on the game’s address, verifies the Google popup return and provisions the open sandbox. | Workflow green; `docs/automatic-releases.md`; `docs/RUNBOOK.md` § Release path |
| 3. Live check | The release workflow, then the captain | Production `little-galaxy/version.json` reports the tag and commit | `version.json` equals the tag |
| 4. Acceptance in real use | The captain, then the owner | Play the hito's journeys in production at phone and desktop sizes (EN/ES, both themes) | The hito's acceptance list in `milestones.md` |
| Rollback | The captain, on the owner's word or a broken production | The portfolio's Hosting rollback (`rollback.yml` in the portfolio repository) or `pnpm run rollback` (`docs/RUNBOOK.md:227`). Rules roll back by merging a fix. | Live `version.json` shows the previous tag |

Rules for every hito:

- One branch and one PR per hito, named `v1.0.0-alpha.X[...]-<slug>`. The owner wants a hito delivered as **one PR
  with everything ready** (2026-10-27/28). Work packages are commits or sub-branches merged into the hito branch,
  not separate PRs to `main`.
- Commits are authored `alexanderkholodov1 <kholodov.alexander1@gmail.com>`, with no AI attribution. Each message
  starts with its version and states what it delivers.
- GitHub CI runs one fast job, `pnpm check` (lint, typecheck, unit, physics, build with privacy gate, rendered EasyList gate). Before a PR is
  marked ready, the builder runs `pnpm accept` locally: rules, emulator and real browser journeys. The captain re-runs
  it and verifies screenshots.
- This repository never deploys the portfolio's Hosting. Production Hosting for `alexanderkholodov.web.app` happens only
  through the portfolio's `galaxy-release` receiver, including the admin. The data site's content is disabled;
  Firebase's reserved auth helper remains available for Google popups (`admin-sign-in.md`).
- Secrets are never printed, committed or bundled (`AGENTS.md` rule 6).

## How this plan changes

- Owner decisions are recorded here or in `milestones.md` with their date and source, verbatim when they are quoted.
- Implementation-level improvements (how, not what) may be made by whoever works on the hito. Record them in the hito's
  "Remaining" or "Notes".
- Scope, product, security or architecture changes are proposed first, marked "proposed, the owner decides", unless the
  owner has already instructed them.
- Every change to this folder is a commit on the open hito's branch. The history below is the plan's changelog.

## History of the plan

- 2026-10-05: original joint specification prepared in the portfolio repository.
- 2026-10-09: M0. Planning moved into this repository (PR #1, branch `plan/v0.0.1-galaxy-m0`). Direct QR entry,
  name, explore, optional creation. Small final-quality experience first. Galaxy first, portfolio second. The assistant
  feature was excluded entirely. Public name and path pending.
- 2026-10-24: design round 2 review. Winner "Fogata" (Opus prototype). Requirements R1-R27, path `/little-galaxy`,
  name "Little Galaxy" (`~/bad/spec/r3-operator-review.md`).
- 2026-10-25: after-fair plan approved: A, Little Galaxy done well; B, portfolio redesign; C, remaining requirements,
  destructive mode first (`~/caspian-kb/agenda/HANDOFF-after-fair-2026-10-25.md:48-67`).
- 2026-10-28: this folder replaces the plan branch. Admin sign-in decision added. Release policy: production on merge
  with no approval. Version scheme `v0.X.Y` / `v1.0.0-alpha.X.Y.Z` / `v1.0.0` restated.
- 2026-10-28: the released `v1.0.0`/`v1.0.1` tags stay; alpha hitos, then beta hitos, toward the final goal `v1.1.0`
  (owner).

- 2026-10-28, rc2: operator decision keeps the admin on the game’s own address and account system.
  EasyList was the empty-page cause; replace its matching namespace and add a blocker gate. Revert the
  rc1 domain move, use synchronous Firebase Google popups and disable data Hosting content while
  preserving the reserved auth helper. Update the release probes and keeper/outsider acceptance.
