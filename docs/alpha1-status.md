# Vivo: alpha.1 local acceptance

The implementation lives on `v1.0.0-alpha.1-alive`, based on `v1.0.2-delivery`.
No push, tag, pull request, Hosting/rules deployment, repository dispatch or key
provisioning was performed. Local tests never certify the current public deployment.

## Delivery state

| Item | State and evidence |
| --- | --- |
| 1. Quota design first | Done. `docs/live-sky.md` was the first commit. It compares direct active-object queries with 16 owner shards using the measured delivery baseline, 300 visitors in eight hours and a 24-hour idle day. The final base full-day scenario budgets 48,048 reads / 13,311 writes (updated from the final alpha burst, including its retry ratio); archive views, retries/reconnects and repeated history backfills are additional. |
| 2. A1 without a stand | Done locally. Client launch/edit/relaunch transactions mirror the active object atomically into a bounded shard; reciprocal rules reject absent/forged mirrors and cross-owner changes. Home, Screen and host selection use shards. Emulator cases exercise a confirmed empty sky, launch/edit/replacement/relaunch without snapshots or a stand, same-shard concurrency, and moon hosts. |
| 2. Beacon and laptop enrichment | Code and emulator acceptance done; production activation pending. A transactional admin-only lease elects one service set, with 30-second heartbeats / 90-second expiry, a local deadline and cleanup. Tests exercise election, crashed-leader expiry takeover, graceful handoff and migration. RUNBOOK section 11 gives the credential, systemd and laptop steps. The Beacon key is absent; no keys were created or read. |
| 3. Empty and connection states | Done locally. A confirmed empty sky renders 3D and an EN/ES creation invitation. Initial cached bodies are unconfirmed; actual connection loss retains the last sky with retry. Empty data or stopped enrichment is not a connection error. |
| 4. Sound | Done locally. No repeating note timer remains. Initial delivery, rendering and unlock are silent. Phone design/launch/touch actions request responses; fresh booth arrivals/comets are spaced at least four seconds apart, and pets are throttled. Operator suppression and eight monophonic slots remain. Unit and browser evidence covers silence, sparse events, unlock, mute, volume and unclipped offline rendering. |
| 5. Full viewport and identity | Done locally. A 44px corner mark opens a native glass dialog with supplied profile/navigation links; Escape restores focus. Postcard and object views reuse the supplied links, with visible TODOs for missing content. The document never scrolls; measurement/history/detail panes can scroll internally. Browser cases cover 375×812, 390×844 and 1440×900. Workshop, hangar, shared effects, replay, postcard, object pages, kiosk, kill switches and live-safe recovery remain exercised. |
| 6. Exact-tag release chain | Done in code; remote execution pending captain. All three package versions are `1.0.0-alpha.1`. The guard accepts exact positive `v1.0.0-alpha.N` tags; publishing adds `--prerelease --latest=false`. After publication, the final step posts `galaxy-release`, `client_payload.tag = GITHUB_REF_NAME`, to `alexanderkholodov1/portfolio` using `PORTFOLIO_DISPATCH_TOKEN`. RUNBOOK section 12 documents authorization and retry boundaries. |

## Ordered final replay

The driver is `~/bad/work/g-alpha1/replay.sh`; it stops on the first failure and
appends each result to `~/bad/checkpoints/g-alpha1.md`. Every command ran from this
worktree, one heavy command and one Chromium browser at a time, with:

```sh
export TURBO_FORCE=true
export JAVA_TOOL_OPTIONS=-Xmx512m
export TMPDIR=/home/alexamaze/bad/work/g-alpha1/tmp
export CASPIAN_TMP="$TMPDIR"
export GALAXY_SCREENSHOTS="$PWD/.alpha1-evidence"
unset GOOGLE_APPLICATION_CREDENTIALS
```

Available tools: Node 24.9.0 (CI uses Node 22), pnpm 11.5.2, Java 21.0.12.1,
Playwright 1.64.1. The existing Chromium installation was checked; the privileged
CI `--with-deps` OS bootstrap was not run on this shared machine.

| Exact command, in checks.yml order | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm run typecheck` | PASS, 3 packages, zero cache hits |
| `pnpm run lint` | PASS, 3 packages plus root scripts/tests, zero cache hits |
| `pnpm exec playwright install chromium` | PASS, existing installation |
| `pnpm run test` | PASS: 273 unit/script cases (38 shared, 166 web, 16 stand, 53 script), 26 surface browser cases and two connected emulator journeys. Native click→render: 1,672 ms against the unchanged 2,000 ms gate. |
| `pnpm run test:live-safety` | PASS: production A→B→A, deleted chunks, held gesture, restored UI/camera/focus/volume, bounded reloads; one locally hosted read-only browser case passed. |
| `pnpm run test:rules` | PASS, 187 cases across five files; emulators stopped. |
| `pnpm run test:drills` | PASS, all five building-block drills; report regenerated. |
| `pnpm run test:load` | PASS, 100/100 visitors in 48.4 seconds, 24 visitor writes each, 9,036 observed/modelled reads; archive reconciled 1,002 rows / 18 files. Source-only 300-visitor projection: 27,808 reads / 8,511 writes; phone/lease/idle allowances are in live-sky.md. |
| `pnpm run build:rehearsal` | PASS, two build tasks, zero cache hits; privacy gate scanned 41 files. Uses committed rehearsal variables rather than production credentials. |

The final assertion passed. It reads `apps/web/dist/version.json`, requires `1.0.0-alpha.1` and
a 40-character Git commit. The release guard also passed:

```sh
GITHUB_REF_NAME=v1.0.0-alpha.1 node scripts/verify-release.js
```

## Iteration and failure evidence

Earlier runs stopped at real failures; they were corrected rather than hidden:

- First typecheck found obsolete Home test fixtures after removing the stand snapshot dependency.
- The first full rules run passed 184/186 cases. The shard partition originally exhausted Firestore's 1,000-expression limit in a moon round trip; four bit tests replaced up to 15 regex checks. Lease test deadlines were shorter than real emulator transaction retries; production remains 30/90 seconds. Core rules subsequently passed 175/175; lease cases passed 4/4.
- Lint caught an unused renderer eligibility parameter after removing ambient scheduling; the retained controller signature now explicitly ignores that input.
- A viewport fixture expected the wrong profile label. Later full runs caught hidden-pane selectors and a replay canvas selector that also matched the effects canvas. Named controls and the historical-sky image role now identify the intended elements.
- The connected journey exposed launch confirmation overriding a player-selected pane. A deferred-launch component regression and the real journey verify the fix.
- Node-side latency initially included automation scrolling/poll scheduling. The same 2,000 ms gate now measures a native click timestamp and the first rendered-frame mutation in the two browser pages. Separate targeted acceptance measured 1,348 ms; the ordered replay measured 1,672 ms.

Targeted commands and results:

```sh
pnpm --filter @little-galaxy/web exec vitest run src/Home.test.tsx src/galaxy-data.test.ts src/season-data.test.ts
# 14 passed
pnpm --filter @little-galaxy/web exec vitest run src/Home.test.tsx src/Screen.test.tsx
# 25 passed after cache-state regressions
pnpm --filter @little-galaxy/web exec vitest run src/sound-engine.test.ts src/sound-controller.test.ts src/Create.test.tsx src/Screen.test.tsx
# 49 passed at the sound commit
pnpm --filter @little-galaxy/web exec vitest run src/ScreenSound.test.tsx
# 1 passed
pnpm --filter @little-galaxy/web exec vitest run src/App.test.tsx src/Create.test.tsx src/Home.test.tsx
# 46 passed at the shell commit
pnpm --filter @little-galaxy/web exec vitest run src/Create.test.tsx
# 22 passed after deferred-launch navigation regression
pnpm exec vitest run scripts/verify-release.test.js scripts/workflows.test.js
# 14 passed
JAVA_TOOL_OPTIONS=-Xmx512m pnpm exec firebase emulators:exec --only firestore,auth --project demo-little-galaxy 'pnpm exec vitest run --config tests/rules/vitest.config.js tests/rules/core.test.js tests/rules/lease.test.js'
# Core 175/175; first lease rerun 3/4, corrected timeout below
JAVA_TOOL_OPTIONS=-Xmx512m pnpm exec firebase emulators:exec --only firestore,auth --project demo-little-galaxy 'pnpm exec vitest run --config tests/rules/vitest.config.js tests/rules/lease.test.js'
# 4 passed
```

Browser iteration used `run` / `runDemo` from `scripts/demo-emulators.mjs` to choose
unused loopback ports and clean up child processes. The exact targeted wrapper:

```sh
node --input-type=module -e "import {runDemo,availablePort} from './scripts/demo-emulators.mjs'; await runDemo('pnpm exec playwright test --config tests/ui/playwright.config.js',{EMULATOR_SMOKE:'1',GALAXY_UI_PORT:await availablePort()});"
# Both connected journeys passed; no stand was started.
```

The surface wrapper used the same free-port helper with these actual Playwright
arguments (one worker):

```sh
pnpm exec playwright test --config tests/ui/playwright.config.js tests/ui/viewport.spec.js tests/ui/home.spec.js tests/ui/sound.spec.js
# Four passed; one profile-fixture label corrected.
pnpm exec playwright test --config tests/ui/playwright.config.js tests/ui/viewport.spec.js
# Passed after fixture correction and again after asserting the full booth field bounds.
```

This safe negative check returned exit 1 and `No admin connection`, as required:

```sh
env -u GOOGLE_APPLICATION_CREDENTIALS -u FIRESTORE_EMULATOR_HOST -u FIREBASE_PROJECT_ID pnpm --filter @little-galaxy/stand migrate-sky
```

Local screenshots and logs are retained under the ignored `.alpha1-evidence/`
directory. They show local fixtures/emulators, never the public deployment.

## Captain/operator work remaining

- Supply the approved data-project key, install the Beacon contender and start the laptop backup using RUNBOOK section 11. Actual machine failover and physical-phone/TV/campus-network acceptance remain unperformed.
- Close the season, activate compatible rules/artifact and run the one-time closed-season migration. Pre-alpha clients cannot write the required mirror: preserve their drafts and let them update before reopening. The A→B→A check covers alpha builds; it is not proof of a zero-interruption legacy-rule transition.
- Implement/merge the portfolio dispatch receiver in its separate task, then perform captain-owned remote CI/release/deployment. No highest-semver lookup may replace the dispatched exact tag.
- Observe real Spark usage. The quota model is a scenario, not production billing or an eight-hour sustained certification; archive traffic and history backfills can consume its remaining read headroom.
- Update the plan of record from the captain's authorized checkout. This builder kept the portfolio plan read-only.


## Final evidence and cleanup

The ordered replay verified runtime code at `6c445dc`. Afterwards the generated
quota-report title was corrected to alpha.1, and
`pnpm exec vitest run scripts/load-test-report.test.js` passed both report cases.
The other final changes are runbook/acceptance documentation and regenerated
emulator reports. The built local artifact records code commit
`6c445dc3572d6062c085201171c88733ebc77ae8`; a captain release must use its own fresh
checked build, as the release workflow already requires.

The license, delivery PDFs/images and source assets have no diff from
`v1.0.2-delivery`. Reduced-motion and desktop-object-page browser regressions pass.
Emulator ports 8080, 9099, 9150 and 4400 have no listeners after completion. No task
browser, stand or web-server process remains. Test logs were moved from scratch
into `.alpha1-evidence/logs/`; scratch build/test caches were deleted. Screenshots
are in `.alpha1-evidence/`, and real production-swap evidence remains in
`.live-safety/evidence/`. All retained build/test output is inside this checkout.

## Implementation commits

- `4d47417` 1.0.0-alpha.1.1 Document the stand-independent live sky and its quota model
- `c5d2c84` 1.0.0-alpha.1.2 Keep the live sky independent of stands and elect one enrichment leader
- `7f01af4` 1.0.0-alpha.1.3 Invite creation in a confirmed empty sky in English and Spanish
- `0892873` 1.0.0-alpha.1.4 Answer visitor actions and sparse booth events without a sound loop
- `cb8b054` 1.0.0-alpha.1.5 Fill the game viewport and move identity links into a corner glass sheet
- `f451ec7` 1.0.0-alpha.1.6 Publish alpha pre-releases and dispatch their exact tags to portfolio
- `33043dd` 1.0.0-alpha.1.7 Preserve named launch controls in the pane-aware acceptance journeys
- `cf86a66` 1.0.0-alpha.1.8 Reject unconnected migrations and check visible game panes precisely
- `135fead` 1.0.0-alpha.1.9 Keep cached skies unconfirmed until the server answers
- `6c445dc` 1.0.0-alpha.1.10 Preserve navigation during launch confirmation and report sky quota costs accurately
