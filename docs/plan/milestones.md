# Little Galaxy milestones (hitos)

Every hito from the first plan to production and beyond. The release policy, version scheme and how to read this file
are in [README.md](README.md). Dates are UTC. "PR" means a pull request in `alexanderkholodov1/little-galaxy`; merge
commits are on `main`.

## Map

| # | Hito | Version | State | Evidence |
| --- | --- | --- | --- | --- |
| H0 | Plan (M0) | `v0.0.1` | done; branch retired into `docs/plan/` | PR #1 (closed unmerged), branch `plan/v0.0.1-galaxy-m0` |
| H1 | Foundations | `v0.1.0` | released | PR #2, merge `25200ad`, tag `v0.1.0` |
| H2 | Galaxy core | `v0.2.0` | released | PR #3, `1f026db`, tag `v0.2.0` |
| H3 | Rich objects and hangar | `v0.3.0` | released | PR #4, `4cc11c6`, tag `v0.3.0` |
| H4 | Sound | `v0.4.0` | released | PR #5, `05de78f`, tag `v0.4.0` |
| H5 | Global interactions and screen scenes | `v0.5.0` | released | PR #6, `cafe0ec`, tag `v0.5.0` |
| H6 | Memory | `v0.6.0` | released | PR #7, `9171a34`, tag `v0.6.0` |
| H7 | Live-safe deploys | `v0.7.0` | released | PR #8, `b34756b`, tag `v0.7.0` |
| H8 | Fair-ready (historical `v1.0.0`, `v1.0.1`, `1.0.2`) | see Versions in README | released | PR #9 `2dd811a` tag `v1.0.0`; PR #10 `f4644e8` tag `v1.0.1`; `1.0.2` in `CHANGELOG.md` (no tag) |
| H9 | Design round 2 and requirements R1-R27 | — (design) | done | `~/bad/spec/r3-operator-review.md`; status `docs/prototype/NOTES.md:15-45` |
| H10 | Vivo: the sky lives with nothing running | `v1.0.0-alpha.1` | released | PR #11, `8d54df5`, tag `v1.0.0-alpha.1` |
| H11 | Galaxies, the shipped game, admin and timelapse | `v1.0.0-alpha.2` | released | PR #12 `b0b7fac` tag `v1.0.0-alpha.2`; PR #13 `373749d` (released by H12) |
| H12 | Fair-day releases | `v1.0.0-alpha.3` to `alpha.8` | released; production rolled back to `alpha.8` | PRs #14-#19, tags `v1.0.0-alpha.3`…`alpha.8`; post-mortem `~/caspian-kb/improvement/OBITUARY-2026-10-25-little-galaxy-fair.md` |
| H13 | Close the database after the fair | `v1.0.0-alpha.9` | released | PR #20, `1c07d9e`, tag `v1.0.0-alpha.9` |
| H14 | Welcome title and timelapse arrow | `v1.0.0-alpha.9.6` | released | PR #21, `4a20e85`, tag `v1.0.0-alpha.9.6` |
| **H15** | **The whole game ready to show** | **`v1.0.0-alpha.10.0-rc1`** | **open** | **PR #22 (draft), branch `v1.0.0-alpha.10.0-rc1`** |
| H16 | Destructive galaxies (R22) | `v1.0.0-alpha.11` | future | owner order, `~/caspian-kb/agenda/HANDOFF-after-fair-2026-10-25.md:65-67` |
| H17 | Planet surfaces for everyone (R19) | `v1.0.0-alpha.12` | future | same |
| H18 | Player accounts shared with the portfolio (R19 sign-in, R23) | `v1.0.0-alpha.13` | future | same; `r3-operator-review.md:67-90` |
| H19 | Player galaxies with invites and limits (R24, R27) | `v1.0.0-alpha.14` | future | same; `r3-operator-review.md:92-113` |
| H20 | Perfect: the owner's review | `v1.0.0` | future | owner's version scheme (README) |

Order and dependencies: H0 → H1 → … → H15 strictly in sequence (each consumed the previous `main`). After H15:
H16 → H17 → H18 → H19 → H20. This is the owner's order for C, "destructive mode first" (2026-10-25). Hard dependencies
are listed per hito. H17 does not depend on H16 and may run in parallel only if their shared-file owners are distinct
and the owner agrees.

## Shared files and their owners

These files are touched by almost every hito (counts from `git log --since=2026-10-20`). Within one hito, each has one
owner, normally the hito's **integrator** (the builder who owns the hito branch). Other packages hand their changes to
that owner.

| File or area | Owner within a hito | Why it is shared |
| --- | --- | --- |
| `firestore.rules`, `firestore.indexes.json`, `tests/rules/**` | integrator | Security; every data change touches them; deployed on merge |
| `.github/workflows/**`, `firebase.json`, `scripts/accept*`, `scripts/check.mjs` | integrator | Release and acceptance path |
| `CHANGELOG.md`, `README.md`, `docs/RUNBOOK.md`, `docs/plan/**` | integrator | One voice per release |
| `packages/shared/src/**` (kernel, schema, store) and `apps/web/integration/replay*.js` | the physics/kernel package owner | Changing the simulation needs a new kernel identity and replay proof against frozen records |
| `apps/web/js/main.js`, `apps/web/js/world.js`, `apps/web/integration/shared-world.js`, `apps/web/css/**`, `apps/web/js/strings/**` | the UI package owner | Visitor experience, both languages and both themes |
| `apps/stand/**` | the stand package owner | Server-side enrichment with the admin key; never bundled |

## Interfaces between hitos

What exists on `main` (or on the open hito branch) and what later hitos consume:

| Interface | Defined in | Delivered by | Consumed by |
| --- | --- | --- | --- |
| Galaxy manifest `galaxies/{g}`: `owner`, `mode` (`gentle`/`destructive`), `visibility` (`public`/`invite-only`), `writePolicy` (`public`/`members`/`frozen`), `status`, `kernel`, `generation` | `firestore.rules:296-302`, `packages/shared/src/schema.ts` | H11 | H15 (open sandbox), H16 (`mode`), H19 (owner, visibility, members) |
| Members `galaxies/{g}/members/{uid}` with `role` | `firestore.rules:494-504` | H11 | H19 (invites) |
| Live selection `config/live.activePublicGalaxyId`, `seasonOpen` | `docs/RUNBOOK.md` § config/live | H10-H11 | every client; admin "activate" |
| Admin identity: verified Google email in `config/admins.emails`, checked by `bAdmin()` | `firestore.rules:262-265` | H11 | H15 admin sign-in, all admin paths |
| Kernel identity and frozen records: `KERNEL` in `apps/web/integration/replay.js`, `recorded/` assets in each release | `docs/prototype/A-OPEN.md`, `CHANGELOG.md` rc1 | H15 | every hito that changes physics (H16) must keep the fair's frozen kernel |
| Release artifact `galaxy-dist-<tag>.tar.gz` with `version.json`; portfolio receiver `galaxy-release` | `docs/automatic-releases.md`, `docs/portfolio-contract.md` | H10, H15 | every release; the portfolio repository |
| Visitor identity: Firebase Auth of project `little-galaxy`, anonymous per device | `apps/web/src/firebase.ts:28-37` | H1 | H18 (upgrade to accounts) |

## Past hitos

### H0. Plan (M0), 2026-10-05 to 2026-10-09

- **Scope:** the game's own plan: direct QR entry → name → explore → optional creation; ownership split from the
  portfolio; milestones M1-M6 with no calendar days; open design questions. The assistant feature was excluded.
- **Acceptance:** separate documentation commits, no application scaffolding, provisional ideas labelled.
- **State:** the plan branch was never merged (PR #1 closed). Its still-valid content now lives in
  [README.md](README.md) (decisions, history) and below (original roadmap, open questions, backlog).

Original roadmap (plan branch `06-roadmap.md`) and what delivered each step:

| Planned | Planned delivery and acceptance | Delivered by |
| --- | --- | --- |
| M1 | Toolchain, routes, renderer lab, draft recovery, data contracts, emulators, deny-all rules tests, build/release foundation. Reproducible local checks. | H1 |
| M2 | Dedicated naming, visual and interaction design session; the owner compares images and executable prototypes | H9 (round 2 review, 2026-10-24) |
| M3 | Small complete experience at final quality: QR → name → explore → optional creation; two phones and a screen; no duplicates or loss | H2, then H11 for the final design |
| M4 | Broader depth and community behaviour, with security, budget and performance checks per addition | H3-H5 |
| M5 | Memory and permanence: object pages, timelapse, postcard, season export; replay matches history | H6, H11 (timelapse), H15 |
| M6 | Event readiness: real laptop, long session, load, drills, deploy/rollback, runbook | H7-H8 |

### H1-H7. `v0.1.0` to `v0.7.0`, 2026-10-22/23

One PR each, merged the same day. Scope by PR title: foundations (#2), galaxy core (#3), rich objects and hangar (#4),
sound (#5), global interactions and screen scenes (#6), memory (#7), live-safe deploys (#8). Status reports per
package: `docs/foundations-status.md`, `galaxy-core-status.md`, `rich-objects-status.md`, `sound-status.md`,
`interactions-status.md`, `memory-status.md`, `live-safety-status.md`. Acceptance at the time was CI and preview
channels on the portfolio project. Those were later judged not to be evidence (README, Tests).

### H8. Fair-ready, 2026-10-23/24

`v1.0.0` (PR #9) and `v1.0.1` (PR #10: provisioning and an honest booth-not-started state), then `1.0.2` (reduced
motion, page grid, rights reservation, evaluator README/PDF, `CHANGELOG.md` § 1.0.2; delivery files in
`docs/delivery/`). The version numbers predate the owner's scheme (README, Versions).

### H9. Design round 2 and requirements, 2026-10-24

The owner chose the Opus prototype "Fogata" ("by far the best", "80% of perfection"). His review defines R1-R27
(`~/bad/spec/r3-operator-review.md`). The prototype and its R-status live in `docs/prototype/` (`NOTES.md`,
`CHECKPOINT.md`). Still open after H15: R19 trees, cities and volcanoes; R22; R23; R24 player UI; R27 per-account
limits.

### H10. `v1.0.0-alpha.1` "Vivo", 2026-10-24

Home and Screen stay live through client-maintained Firestore sky shards, without a stand. One elected Beacon/laptop
enrichment leader. Alpha tags became pre-releases dispatched to the portfolio (PR #11; `CHANGELOG.md` § alpha.1).

### H11. `v1.0.0-alpha.2` Galaxies, the shipped game, admin and timelapse, 2026-10-25

The Fogata design shipped. Separate galaxies (instances), the admin page (`/little-galaxy/admin`) with Google sign-in
(popup) and the server allowlist, member metrics, and the timelapse. Work packages `alpha.2.1` to `alpha.2.61`
(`docs/alpha2-p2-report.md`, `docs/alpha2-b1-status.md`). PR #13 (`alpha.2.1`, rules integrity) merged at 16:46Z but did
not release, because the version was not bumped (post-mortem § 1).

### H12. Fair-day releases `alpha.3` to `alpha.8`, 2026-10-25 17:32Z-19:04Z

Emergency releases during the fair, on the owner's orders, with tests skipped: alpha.3 released #13; alpha.4 removed
all launch limits and opened the rules; alpha.5 gave instant sync; alpha.6 confinement (rolled back); alpha.7 removed
the double-system notice; alpha.8 gathered bodies around the centre. Production served `alpha.8` at the end. The fair
galaxy `bad-2026` was frozen at 19:04Z and backed up (post-mortem § 1; `CHANGELOG.md` § alpha.3-8). Lessons that
became decisions are in README (Players, Tests, Process).

### H13. `v1.0.0-alpha.9` Close the database after the fair, 2026-10-27

PR #20 carried the after-fair plan's first packages:

- A1: rules secure without player friction (no cooldowns or caps), two invisible safety ceilings, the catch-all
  closed, admin = verified Google allowlist.
- A2: bodies settle on deterministic stable orbits, with a fingerprinted kernel (`alpha.9.0.2`-`9.0.3`).
- A4: fast checks and automatic milestone releases with no manual version bump (`alpha.9.0.1`, `alpha.9.4.x`;
  `docs/automatic-releases.md`).
- A-show: responsive player screens (`alpha.9.0.6`).
- Rehearsal mode (`alpha.9.0.5`).

Commits `47b6b88`…`650b07b`.

### H14. `v1.0.0-alpha.9.6` Welcome title and timelapse arrow, 2026-10-27

Each welcome-title word stays on one line; the timelapse arrow is drawn as an icon (PR #21).

## Current hito

### H15. `v1.0.0-alpha.10.0-rc1` The whole game ready to show (PR #22, draft)

**Scope (owner, 2026-10-27; `~/caspian-kb/handoffs/2026-10-28T0200Z-beacon-captain.md` and `LG-whole-game.md`).** In one PR:
an open shared sandbox anyone can play in; the original fair galaxy and its timelapse, intact; bodies that stay in the
galaxy and settle around the fire; admin works on the production domain; production on merge with nothing manual;
simple, fast workflows.

**Packages delivered on the branch** (commits since `main` `4a20e85`):

| Package | Commits | What it delivers |
| --- | --- | --- |
| A-open (`alpha.9.5`) | `ce7ad41`…`364a60b` (`alpha.9.5.1`-`9.5.8`) | Open galaxies from leased snapshots, verify history in background, mature orbits computed directly, frozen fair kernel preserved (`docs/prototype/A-OPEN.md`) |
| A-show and rehearsal mode (`alpha.9.0.5`-`9.0.7`, already released in H13) | merged into A-open by `1ffe4c1`, `34b66f1` | Keeps the A-open package current with `main` (`docs/a-show.md`) |
| Showcase (`alpha.9.7`) | `1f61351`, `8bee8d0` | Recorded skies open from verified moments; new galaxies bound around the fire (`docs/plan-updates/alpha9.7-showcase.md`) |
| rc1.1 | `2022772` | Open sandbox provisioning, instant recorded skies, OIDC admin sign-in (superseded, see Remaining 1), local `pnpm accept`, one CI job |
| rc1.2-rc1.4 | `23b6f2a`, `7afb548`, `a66823c` | Rehearsal verdicts, visible bodies and phone controls, no nicknames in published replay records, H14 merged in |
| rc1.5 | `7a5d6da` | Production on merge with no manual approval |
| rc1.6 | `0365097` | Named a console redirect URI for the OIDC design. **Rejected by the owner (2026-10-28); replaced by `admin-sign-in.md`** |
| rc1.7-rc1.16 | `125849d`…`eb743b7` | Readable labels and dialogs, fair and timelapse shown as one galaxy, tappable navigation and speeds in both themes, language kept across destinations, stable acceptance probes, replay requests tied to the playback clock |
| rc1.17 | `664282a`, `8186765`, `db38391` | Admin sign-in decision ([admin-sign-in.md](admin-sign-in.md)) |
| rc1.18 | this plan | Plan of record and release policy in the repository |

**Last verified state** (captain, 2026-10-28 ~02:30Z, head `eb743b7`): `pnpm check` PASS, `pnpm accept` PASS 13/13,
rehearsal run 40605193504 success, deploy preflight PASS (`~/caspian-kb/handoffs/2026-10-28T0200Z-beacon-captain.md:44-46`).

**Remaining, in order:**

| # | Work | Who | Done when |
| --- | --- | --- | --- |
| 1 | Admin sign-in per `admin-sign-in.md`: P0 preflight, then P1-P3 (one builder, it owns `firebase.json` and `release.yml`), then P4 | captain (P0), one builder (P1-P4) | `admin-sign-in.md` § Implementation packages, "Done" |
| 2 | Shorten `pnpm accept` (20 minutes, 84 screenshots). Keep deterministic checks: geometry, sizes, computed fonts, text equality, link destinations. Keep only screenshots that a review uses. | one builder (integrator) | `pnpm accept` passes with the same named checks in less time; the report lists each kept capture and the review that uses it |
| 3 | Re-verify everything on the final head: `pnpm check`, `pnpm accept`, rehearsal, screenshots judged by the captain | captain | all pass on the same SHA; receipts in `.tmp/accept-<sha>.json` |
| 4 | Mark PR #22 ready and tell the owner. The owner merges. | captain, then owner | PR merged |
| 5 | Release and acceptance in real use | automatic, then captain and owner | README release steps 2-4; the owner signs in to the admin once at `https://little-galaxy.firebaseapp.com/little-galaxy/admin` |

**Acceptance (all, in production):**

1. A phone and a laptop open `/little-galaxy`, EN and ES, both themes. A visitor names themselves, launches, and a
   second device sees it at once. Bodies stay in the visible galaxy and settle around the fire, including with black
   holes (the fair's 21 launch intents replayed on the current kernel).
2. The fair galaxy `bad-2026` opens frozen and intact. Its timelapse plays from the first launch at every speed,
   seeks, and returns to the same recorded fair.
3. The owner signs in to the admin with Google and can list, create, activate and freeze galaxies. Any other Google
   account is refused by Firestore.
4. The merge released everything with no manual step. Live `version.json` equals the tag.

## Future hitos

Scope below comes only from the owner's documents. Packages are the planned breakdown. Each future hito starts with a
design package whose result the owner approves before building, following his decision that design comes first
(`08-decisions.md`). Anything beyond his words is marked **proposed, the owner decides**.

### H16. `v1.0.0-alpha.11` Destructive galaxies (R22)

- **Owner's words:** "prender la opción 'destructiva' en la galaxia - que los objetos puedan colisionar entre sí y
  crear fusiones como en Universe Sandbox" (2026-10-24). The shared galaxy stays gentle. He wants to "crear otra más
  donde sí prenda la opción de destructividad … abrirlo a todo público con permisos de escritura" with the same QR
  (`r3-operator-review.md:82-96`). C order: destructive mode first (2026-10-25).
- **Interpretation (proposed, the owner decides):** player accounts do not exist yet (H18). So this hito delivers
  destructive mode for galaxies that the admin creates and opens. Player-owned destructive galaxies come with H19.
- **Packages:** D1 design of collisions and mergers (what merges with what, mass and momentum, visuals, sound),
  approved by the owner. D2 kernel: a new kernel identity with deterministic collisions, used only when
  `mode == 'destructive'`. Gentle galaxies and the frozen fair keep their kernels. D3 admin control: create a galaxy with
  `mode: 'destructive'` (the schema already allows it, `firestore.rules:300`). D4 entry: one QR lets a visitor choose
  between the open galaxies (R24 text). D5 acceptance and docs.
- **Depends on:** H15 merged (open sandbox, snapshot opening, admin).
- **Acceptance:** the owner creates a destructive galaxy and opens it to the public. Visitors on two devices see the same
  collisions and mergers. The gentle sandbox and the fair are unchanged (frozen-record replay proof). The owner judges
  the feel.

### H17. `v1.0.0-alpha.12` Planet surfaces for everyone (R19, corrected)

- **Owner's words:** surfaces "no es solo para los jugadores registrados, es para todos" (trees, cities, desert,
  volcanoes; `r3-operator-review.md:80-87`).
- **State:** partly built (ocean and desert, mountains, ice, clouds, giant bands, moon maria); missing trees, cities
  and volcanoes (`docs/prototype/NOTES.md:37`).
- **Packages:** S1 design of the biomes and of how a visitor chooses them, approved by the owner. S2 rendering in
  `bodies.js` at phone frame budgets. S3 the choice in the workshop, stored in the body's parameters. This needs a rules
  and schema change, owned by the integrator. S4 acceptance.
- **Depends on:** H15. Independent of H16.
- **Acceptance:** on a mid-range phone and the laptop, a visitor gives a planet a surface and everyone sees it. The frame
  rate stays within the H15 measurements. The owner judges the look.

### H18. `v1.0.0-alpha.13` Player accounts shared with the portfolio (R19 sign-in, R23)

- **Owner's words:** sign-in for players ("de acuerdo con iniciar sesión"); "las cuentas que crean los pueden compartir
  para mi página de portafolio, a lo mejor me pueden contactar ahí y yo gestionar órdenes y trabajos con clientes en un
  futuro". Player sign-in comes after the admin panel (`r3-operator-review.md:67-90`).
- **Prerequisite decision (proposed, the owner decides):** which Firebase project owns the accounts. Google sign-in
  works without console changes only on the Hosting domain of the project that owns the accounts (`admin-sign-in.md`
  E3, E5). Choices:
  (a) accounts in project `little-galaxy`, with sign-in on `little-galaxy.firebaseapp.com`, and the portfolio reads them
  from there;
  (b) one Firebase project for the portfolio and its games, serving `alexanderkholodov.web.app`. This needs a one-time
  OAuth redirect URI for that project and a data migration.
  This plan recommends deciding this together with the portfolio redesign (after-fair plan B), because the portfolio is
  the other consumer.
- **Packages:** P1 the identity decision and contract with the portfolio repository. P2 upgrade anonymous visitors to
  accounts without losing their bodies (`linkWithCredential`). P3 account UI in both languages. P4 rules: what a
  signed-in player may do. P5 the portfolio side, in the portfolio repository. P6 acceptance.
- **Depends on:** H15 (admin), the owner's identity decision, and the portfolio's plan.
- **Acceptance:** a visitor with existing bodies signs in on a phone and keeps them; the same account is recognised on
  the portfolio; the admin's rights stay exclusive to the owner's account.

### H19. `v1.0.0-alpha.14` Player galaxies with invites and limits (R24, R27, R22 for players)

- **Owner's words:** "que los usuarios registrados puedan crear sus propias galaxias, E INVITAR A OTROS JUGADORES A
  ELLOS"; limits on "galaxias por cuenta y de tamaño por galaxia" (`r3-operator-review.md:92-113`). Priority low;
  data model ready from the start (it is: manifest and members, see Interfaces).
- **Packages:** G1 design. G2 create and invite flows. G3 per-galaxy settings for owners (mode, visibility, write
  access). G4 rules with limits per account and per galaxy, inside the Spark quota. G5 acceptance.
- **Depends on:** H18 (accounts) and H16 (destructive kernel).
- **Acceptance:** a signed-in player creates an invite-only destructive galaxy, invites a second account that can play,
  a third account cannot write, and the limits refuse one more galaxy than allowed.

### H20. `v1.0.0` Perfect

- **Owner's words:** `v1.0.0` only when it is "perfecta e impecable, revisada por mí, amada en todo" (2026-10-28).
- **Packages:** the owner's review list, each item fixed in `v1.0.0-alpha.X` hitos. If the owner accepts the proposal
  in README (Versions), first rename the historical `v1.0.0`/`v1.0.1` tags.
- **Acceptance:** the owner says so. Nobody else can declare it.

## Not scheduled

The owner's own backlog ideas (plan branch `90-idea-backlog.md`), kept for him to schedule or drop:

- AR view of your planet on the table through the phone camera (`<model-viewer>`). Not a priority.
- Humming as an interaction (pitch → glow) (D7).
- Galaxy "weather" tied to real data.
- Season 2 open to portfolio visitors after BAD (D12). The open sandbox of H15 provides this. **Proposed, the owner
  decides:** mark D12 as done once H15 is released.

Open questions carried from the plan branch (`08-decisions.md`, "Open design and engineering decisions"). They are
resolved, except where noted:

- Moon host lifetime with one active object per identity: superseded by the no-caps decision (README, Players).
- Phone render-data read model and quota budget: delivered by snapshots and sky shards (H10, H15). Re-measure them
  in H16 and H19.
- Target-laptop quality settings: measured for the fair (H8, H12). Re-check them for H16 and H17 at phone frame
  budgets.
