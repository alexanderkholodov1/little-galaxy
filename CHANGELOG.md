# Changelog

## 1.0.0-alpha.10.0-rc2 — the admin on the game’s address, visible with blockers, 2026-10-28

- Fix the empty admin and first-paint flash caused by EasyList hiding the old `ad-`
  namespace. Rename every admin class and ID to `keeper-`; vendor EasyList’s generic
  selectors and gate all shipped markup plus rendered admin states in `pnpm check`.
- Revert the rc1 domain move. Keep the admin at
  `https://alexanderkholodov.web.app/little-galaxy/admin` in the game’s account system.
  Open Firebase Google sign-in synchronously in a popup; show session progress and
  actionable errors. Preserve the server-side verified-Google allowlist unchanged.
- Disable data-project Hosting content at release and require Firebase’s reserved
  auth helper to remain available. Probe the admin after the portfolio release is live.
- Exercise real Auth emulator popups and keeper/outsider journeys under EasyList styles.
  Replace redirect and Hosting-deploy assertions with popup and content-retirement checks.

## 1.0.0-alpha.10.0-rc1 — an open shared sandbox and the original fair, ready to visit, 2026-10-27

- Open active galaxies from canonical leased snapshots, verify history in the background and fall
  back on mismatch; evaluate mature orbits directly and share deterministic contact grids.
- Keep the original fair kernel and history intact. Build verified endpoint and indexed timeline
  assets into every release; frozen visits and seeks avoid replaying hours without an admin step.
- Open timelapse at the recorded endpoint, play from its first launch, support pointer and
  Home/End/arrow seeking, and display completed frames and each launch at every playback speed.
- Preserve checkpoint coordinates at compact-launch frame changes and frame every body with the
  camera, including distant travellers; remove the old home-view crop.
- Anchor the current kernel's mature galaxy on the fire and guide light bodies into its system;
  preserve genuine satellite captures. Black holes retain their bodies and orbits without shifting
  the settled galactic anchor.
- Preserve the physical launch minute, deterministic snapshots/replay and finite settling bridges.
  Add no player cooldown, cap or budget. Record before/after timings and fair-intent end states.
- Keep each welcome-title word on one line, and draw the timelapse arrow as an icon so a missing font glyph never shows as a box.
- Create and activate an open sandbox idempotently during release; preserve all frozen generations.
- Explain Be A Dragon 2026, visitor nicknames and timelapse in English and Spanish; add clear
  navigation between the shared sandbox, fair and timelapse, with a phone-sized information panel.
- Replace blocked cross-site Google popups with Firebase's standard same-tab redirect on the data
  project's own Hosting address, keeping the server-side verified-Google keeper allowlist.
- Honour exact release-candidate requests. Run the same local `pnpm check` in one CI job;
  remove preview, rules and browser jobs from GitHub. Prove built-client journeys with local
  `pnpm accept`, production public reads and an isolated emulator seeded from an ignored export.
- A merge to main publishes the keeper admin to the data project Hosting, then deploys rules,
  indexes and the client directly. The rules environment only allows `main` and `v*` tags and has no manual reviewer.
- Publish replay moments without visitor nicknames; restore those labels in memory from hash-pinned history.
- Draw wide recorded orbits inside the painted spiral so the opening shows readable bodies and the
  fire without changing the stored history. Use the same Unbounded/Figtree typography, glass,
  pill navigation and speed chips across the fair, timelapse and workshop in both themes.
- Centralize recorded explanations, navigation and playback copy; correct the Spanish orbit count
  and give the workshop dice readable contrast. Consolidate component styles at their source.
- Keep failed acceptance assertions in its JSON report. Check actual timelapse return navigation,
  visible product typefaces and projected body sizes, with EN/ES phone/laptop screenshots in both themes.
- Keep the timelapse's running clock and replay requests together, so suspending live-world
  visibility updates cannot leave Play running without frames. Retain per-speed failure state.

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
