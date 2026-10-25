Firebase Console: verify/enable [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin), authorize the actual Hosting/preview domains, and provision the captain's verified email in the private `config/admins.emails` allowlist.

# Little Galaxy alpha.2 — P2 handoff

The implementation is packaged for review and release, not deployed. It uses proto3's own
plain ES modules and exact numerical simulation sources, local three.js **0.170.0**, bundled
fonts/licences, and B1's real GalaxyStore/Firestore contract. React views and obsolete view tests
are removed. Existing rules, CI, release/tag/artifact conventions, stand tooling and portfolio
assembly are retained. No production Hosting, rules, provider or account configuration changed.

## Delivery

| Route | Behavior |
| --- | --- |
| `/little-galaxy/` | Named or anonymous players, anonymous Firebase Auth, accepted shared launches, persistent workshop, live frozen/read-only state |
| `/little-galaxy/admin` | Verified Google identity plus server allowlist, separate public/booth selection, create/freeze/archive, exported three-step body removals, verified sky saves, member metrics |
| `/little-galaxy/screen` | Booth pointer followed live, full-screen control, names, QR to the game, no Auth creation or writes |
| `/little-galaxy/timelapse?g=<id>` | Genesis/history replay, play/pause, speed and scrub, no Auth creation or writes |

Launch design, mass and host-relative origin/velocity are quantized into B1's bounded intent.
Admission targets anchored server time 2.4 seconds ahead, inside the 0.5–3 second rule window.
The specimen remains launching until its accepted tick. Failed/offline/frozen launches retain
the draft and pending nonce. Foreground resumes recover a coherent accepted boundary; activity
touches stop when hidden. Players never publish authoritative positions.

The worker uses one pinned DOM-free kernel, replays accepted sequence/tick order and rewinds
late deliveries. Admin-certified immutable checkpoints are verified caches, never new physics;
unsigned phone caches cannot establish state. Active saves cover a reached prefix, frozen saves
include accepted future launches, and pointers cannot regress. Timelapse loads the full history
so a checkpoint cannot hide the beginning. Empty quiet skies have a deterministic fast path;
interacting skies integrate in bounded fixed-step batches.

Admin metrics report memberships, chosen names, first/last sampled activity, five-minute active
status, lifetime launches and accepted-log charts. Visits/cosmetic throws are uncollected and
shown as unavailable. There is no per-visit counter or private-member polling. Three galaxies
per account and the B1 lifetime/player/home budgets remain enforced. A fresh start means a new
galaxy; there is no recursive purge or unsafe local undo on the shared world.

## Prototype provenance and repeatable sync

Run from the repository root:

```sh
node scripts/sync-prototype.mjs /home/alexamaze/bad/proto3
```

The script names every copied app file, applies small committed integration seams, records
source hashes in `apps/web/prototype-state.json`, snapshots NOTES/CHECKPOINT/SIM-DECISIONS, and
refreshes the upstream physics fixture. The kernel hash also covers the replay/home/name codec
and legacy name table; a different-kernel galaxy is visibly rejected. Re-sync before releasing
any later prototype changes, then rerun the checks. Production strips/guards the prototype test
hooks and local-storage doubles behind Vite's development flag.

Packaged CHECKPOINT's last line:

> - **Next:** packager (Codex) syncs. Open items for later: admin clear/delete on v2 state, a separate reduced-motion + EN/ES visual pass, a 30-min soak in the real loop, R19 biomes, R20 timelapse, SIM known gaps.

P2 implements the timelapse and shared admin operations listed above; that quotation records the
upstream state rather than claiming those upstream open items were all closed.

## Commits and import

The original worktree's Git metadata remains untouched. The bundle is based on **e6ae2d0** and
contains the following operator-authored commits, with no co-author trailers:

| Commit | Milestone |
| --- | --- |
| `a63df6f` | `1.0.0-alpha.2.5`: package the prototype with local graphics/fonts |
| `4a1e808` | `1.0.0-alpha.2.6`: accepted shared launches and pinned replay |
| `b197fda` | `1.0.0-alpha.2.7`: Google keeper ledger and shared galaxies |
| `2539e05` | `1.0.0-alpha.2.8`: independent read-only booth finding chart |
| `25a71c4` | `1.0.0-alpha.2.9`: genesis timelapse and time ruler |
| `f7fd0ef` | `1.0.0-alpha.2.10`: portfolio mount and printed-QR patch |
| `b55e0d0` | `1.0.0-alpha.2.11`: shipped quota envelope |
| `a39d996` | `1.0.0-alpha.2.12`: funded routing, draft recovery and certifications |
| See external checkpoint | `1.0.0-alpha.2.13`: final CI verification and release handoff |

Final verification commit and bundle digest are recorded in the external checkpoint
`/home/alexamaze/bad/checkpoints/alpha2-p2.md`, avoiding a self-referential commit hash.

```sh
git bundle verify /home/alexamaze/bad/checkpoints/galaxy-alpha2-p2.bundle
git fetch /home/alexamaze/bad/checkpoints/galaxy-alpha2-p2.bundle v1.0.0-alpha.2-galaxies
```

Review/import onto the version branch, then use the normal **v1.0.0-alpha.2: …** PR and green-CI
merge/release flow. This handoff does not create a remote PR, merge, tag or release on behalf of
the captain. Galaxy's artifact remains `galaxy-dist-v1.0.0-alpha.2.tar.gz`.

## Verification

| Check | Result |
| --- | --- |
| Shared / stand / web / root unit-script tests | **66 / 26 / 42 / 76 = 210 passed** |
| Packaged prototype physics | **30 passed** |
| Browser suite | **9 passed**: 1 unconfigured + 8 connected-emulator cases |
| Firestore/Auth rules | **274 passed in 8 files** |
| Actual production A→B→A build swap | **Passed**, plus **1 hosted read-only smoke** |
| Retained legacy drills / load | **5 passed / 100 of 100 journeys completed** |
| Portfolio assembly alternatives | **17 / 20 passed** |
| Typecheck / lint / rehearsal build / privacy | **Passed**, 24 build files scanned |

Final stable-run results and log locations are recorded in the external checkpoint. The suite
includes real Firestore/Auth-emulator browser contexts for named/anonymous launch visibility,
offline draft retention, frozen refusal, Google allowlist denial and success, three-step removal,
active/frozen certification, booth switch, replay controls and return membership recovery.
Screen/replay checks reject identity creation and write requests. Production build-swap acceptance
deletes the old actual Vite entry, edits an already-open phone, updates A→B, rolls back B→A,
preserves an alpha.1-converted draft, and checks the booth plus guarded hosted smoke.

The 300-visitor P2 journey exercises real B1 admission logic with its memory driver; it is not
300 simultaneous emulator browsers. The retained 100-client emulator load and five failure-mode
drills exercise the legacy alpha.1 paths and write separately labelled reports. They do not
certify P2 load/performance. The copied prototype physics suite runs against packaged `js/sim/`.

Typecheck, lint, unit, browser, rules, drills, load and build/privacy follow `checks.yml`, serially.
Local builds use the documented example environment (`build:rehearsal`) because this session has
no production web configuration. Browsers run only through `with-browser.sh`; all task-owned
emulators/servers are stopped after checks. No deployed URL, real phone, campus Wi-Fi, 30-minute
soak, billing measurement or physical screen acceptance has been performed here.

## Portfolio patches

`docs/plan-updates/portfolio-little-galaxy.patch` passes `git apply --check` in the requested
`~/Fauns/portfolio` foundations checkout. It also composes after the retained, still-needed
`alpha2-b1.patch`, whose default-ceiling wording now reflects P2's 400. The isolated old-checkout
assembly suite passes **17 tests**.

The deployment worktree discovered at `~/Fauns/wt/portfolio-alpha1.1` already has its dispatch
receiver and latest/tag handling. The alternative `portfolio-little-galaxy-current.patch`
preserves those and passes `git apply --check` there; its isolated assembly suite passes
**20 tests**. Apply the patch matching the deployment checkout, not both alternatives. No actual
portfolio files or Git metadata were changed. The B1 patch also checks there and composes after
the current P2 patch in an isolated fixture. The captain must confirm the production target.

Both alternatives preserve the `galaxy` artifact key, mount at `little-galaxy`, add the admin
rewrite, redirect `/galaxy` and `/galaxy/**` to the game, and send the old screen path to the new
screen. The Galaxy preview workflow uses the same routes. Production publication remains the
portfolio's exact-tag `galaxy-release` dispatch. Old open alpha.1 tabs may require a manual
reload because `/galaxy/version.json` follows the required wildcard redirect; supported alpha.1
drafts/themes are recovered on the new route without deleting the original stored draft.

## Quota

| Scenario | Reads | Writes |
| --- | ---: | ---: |
| 300-visitor fair day, 400 mutations | **23,416 (46.832%)** | **2,900 (14.5%)** |
| Idle day | 50 (0.1%) | 0 |
| Idle week | 350 | 0 |
| Optional two leased stands, idle day | 1,982 (3.964%) | 962 (4.81%) |
| Optional two leased stands, idle week | 13,874 | 6,734 |

The fair row includes eleven genesis chunks, 125 foreground resumes, two mean foreground phones
plus TV, 100 replay views, 100 activity samples, two booth starts, keeper dashboard/refreshes,
admin operations and reserve. It leaves **1,584 reads below the half-quota gate**. Existing galaxy
settings are preserved: review/lower an already-created galaxy's `dailyLimit` before opening.
Migration sizes its ceiling to actual genesis (one chunk: 600; eleven: 400; fourteen: 350), and
fails an oversized import. Do not add legacy enrichment/optional stand leases to the fair row.
Imports/quota-window preparation belong on a prior Pacific day or must fit that day's remaining
budget. See `alpha2-b1-quota.md` for all bounds; this is a model, not observed billing or a global
anonymous-read limit. Hosting/font transfer is a separate project budget.

## Remaining operator gates and open questions

1. Verify the Google provider/domains and allowlist above; confirm rules deployment explicitly.
   Only `config/live` was made publicly readable for zero-write viewers; the allowlist remains
   private and mutations remain protected.
2. Confirm the portfolio deployment checkout, apply its matching mount/redirect and B1 plan
   updates, and review an imported galaxy's exact kernel, daily ceiling and quota window.
3. Run a deployed HTTPS preview on actual phones: cold/late replay time, two-device numerical
   agreement, mid-edit deploy/rollback, booth switch, QR reachability, Google popup and Wi-Fi
   reconnection. No production readiness claim replaces that AGENTS.md gate.
4. Long complex cold replay is still fixed-step work, and certified snapshots must fit the
   Firestore document limit. The prototype's unresolved binary recipe and system-orbiting moons
   remain. Ordinary capture cannot enter an unfunded B1 home: it stays integrated with unchanged
   velocity until a funded path exists; an ordinary transfer-reservation extension is absent.
5. Player sign-in/shared portfolio accounts (R19/R23), destructive mode (R22), and player-created
   galaxy/invite UI (R24) are explicitly out of scope. Prototype surface biomes, a full bilingual
   reduced-motion visual audit and the long real-loop soak remain upstream follow-ups.
