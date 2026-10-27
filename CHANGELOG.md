# Changelog

## Releases without manual approval — 2026-10-27

- The `little-galaxy-rules` environment no longer requires the owner as reviewer: a merge to main deploys rules,
  indexes and the client to production directly. The environment keeps its `main`/`v*` deployment restriction.
- Remove every instruction to approve releases by hand from the workflow, README, runbook and release guide.

## Welcome title and timelapse icon fix — 2026-10-27

- Keep each word of the welcome title on one line: from 1024px the 420px box split "Galaxy" between its letters.
- The layout journeys now fail when any title word wraps across lines.
- Draw the "Watch the timelapse" arrow as an icon instead of the U+2197 character, which showed as an empty box where the visitor's fonts lack it.

## A-show presentation — 2026-10-26

- Place resting status and its timelapse action in the home layout above visibly disabled launches.
- Give the intro and sheets a clear foreground; align attribution and preserve the current visual identity.
- Expand touch targets, accommodate long labels and keep workshop/timelapse controls readable in both themes.
- Add emulator browser geometry journeys for EN/ES at 360/1280px with reduced motion.
- Stage the plan changelog entry in `docs/plan-updates/alpha9-show.patch`; no other checkout or deployment is changed.

## Admin sign-in journey repair — 2026-10-26

- Permit Google's static gapi loader and iframe scripts during emulator keeper sign-in;
  keep production OAuth pages, Auth APIs and Firestore traffic blocked.
- Require the popup to use the local Auth handler and assert the specific allowlist refusal;
  retain the allowlisted keeper's galaxy and membership dashboard checks.

## Automatic release and A4 cleanup — 2026-10-25

- Allocate shipping merge versions from PR milestone/work-package prefixes and free dotted successors;
  keep numeric semver order, explain fallbacks in PR forecasts,
  stamp the exact release tag into the build and confirm both version and commit in production.
- Reserve tags with collision retries and merged-PR lookup; resume exact-commit tags on retries,
  remove the manual package-version gate and reject
  shallow history, tag collisions and stale shipping releases. Include all current build/deploy inputs.
- Keep Windows emulator ownership through test completion and stop its full tree after success,
  failures or interruption; route rules tests through the same cleanup. POSIX retains emulators:exec.
- Retain the prior fix round's explicit tag fetch, index/config shipping regressions and admin/booth journey.
- Document the design, operational boundaries and exact portfolio receiver regex in
  `docs/automatic-releases.md`; portfolio's separate plan/CHANGELOG must record its receiver update.

## 1.0.0-alpha.3–8 — 2026-10-25, during the fair (operator's orders)

- alpha.3: release PR #13's fixes, which its merge had not released (the version had not been bumped); the release
  path ran install and build only.
- alpha.4: no launch limits; Firestore rules open to anyone, signed in or not.
- alpha.5: a late shared launch rewinds the replay to its last one-second mark instead of the checkpoint or genesis,
  so other screens update at once instead of freezing for seconds.
- alpha.6: confine every body (brake beyond 300, spring beyond 400) and cap the home view; rolled back in production
  to alpha.5 because stars and planets clustered.
- alpha.7: no notice when other bodies form a double system.
- alpha.8: light bodies lose only radial speed beyond 60 and feel a spring beyond 100; compact bodies feel only a
  conservative spring beyond 150; the whole-galaxy view shows up to 40 names on phones and 80 on desktop.

## 1.0.0-alpha.2.60–61 — 2026-10-25

- Route reserve-only founded systems through a funded admission home with a matching replay frame.
- Choose the nearby moon parent within its persisted home and explain accepted reroutes honestly.
- Log original launch errors and distinguish permission failures and player quotas in English/Spanish.
- Cover founded and central-fire planet, moon and comet launches with emulator and second-client regressions.

## 1.0.0-alpha.1 — Vivo

- Keep Home and Screen live through client-maintained Firestore sky shards without a stand.
- Elect one Beacon/laptop enrichment leader; document migration and operator credential setup.
- Invite creation in an empty sky, keep phone sound action-driven, and remove recurring booth notes.
- Fill the viewport, keep attribution in a small Credits dialog with one portfolio link.
- Preflight deploy CLI access before season writes; retain migration root causes and provide read-only inspection.
- Publish alpha tags as pre-releases and dispatch the exact published tag to portfolio.


## 1.0.2 — 2026-10-24

- Keep booth scenes uncovered under reduced motion and expire stationary shooting-star messages;
  add Chromium regressions and audit all reduced-motion rules.
- Let permanent object pages and the memory log span the page grid, so the 3D specimen is no longer
  squeezed into a narrow column on desktop; add a desktop layout regression.
- Reserve the software and asset rights for Alexander Kholodov, with UNLICENSED/private package
  metadata and third-party license preservation.
- Introduce the project to fair evaluators with real application screenshots, architecture,
  sourced CI evidence, Spanish summary and delivery PDF handoff.
- Align web, stand and shared package versions at 1.0.2.

These changes implement the operator’s 2026-10-23 decisions: keep testing and updating before
and during the fair, retain rollback, restrict reuse of the game, and deliver evaluator
README/PDF materials together. The portfolio plan of record is maintained in its separate repo;
its receiver and plan updates belong to the companion portfolio delivery.

## 1.0.1

Provisioning and fair startup instructions, including explicit stand/control initialization.
See [the v1.0.1 release](https://github.com/alexanderkholodov1/little-galaxy/releases/tag/v1.0.1)
and the historical implementation handoffs in `docs/`.
