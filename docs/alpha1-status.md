# Vivo: alpha.1 local acceptance

The implementation lives on `v1.0.0-alpha.1-alive`, based on `v1.0.2-delivery`.
No push, tag, pull request, Hosting/rules deployment, repository dispatch or key
provisioning was performed. Local tests never certify the current public deployment.

## Delivery state

| Item | State and evidence |
| --- | --- |
| 1. Quota design first | Done after review. The load script generates both quota documents from measured counters and explicit whole-day allowances, including phone resumes/background tabs, replay, public pages, portfolio banners and two incremental restarts. Acceptance requires at most 37,500 reads / 15,000 writes (75% of Spark), rather than the original 48,048-read scenario. |
| 2. A1 without a stand | Done locally. Client launch/edit/relaunch transactions mirror the active object atomically into a bounded shard; reciprocal rules reject absent/forged mirrors and cross-owner changes. Home, Screen and host selection use shards. Emulator cases exercise a confirmed empty sky, launch/edit/replacement/relaunch without snapshots or a stand, same-shard concurrency, and moon hosts. |
| 2. Beacon and laptop enrichment | Code and emulator acceptance done; production activation pending. Firestore server readTime elects the leader; 90-second heartbeats renew a 360-second expiry. Every production enrichment transaction checks owner, fencing token and server expiry. A transient renewal failure retains services until the monotonic deadline. Tests cover a contender ten minutes ahead, stale writer rejection, grace, failover and cleanup. RUNBOOK section 11 gives the operator steps; no keys were created or read. |
| 3. Empty and connection states | Done locally. A confirmed empty sky renders 3D and an EN/ES creation invitation. Initial cached bodies are unconfirmed; actual connection loss retains the last sky with retry. Empty data or stopped enrichment is not a connection error. |
| 4. Sound | Done locally. No repeating note timer remains. Initial delivery, rendering and unlock are silent. Phone design/launch/touch actions request responses; fresh booth arrivals/comets are spaced at least four seconds apart, and pets are throttled. Operator suppression and eight monophonic slots remain. Unit and browser evidence covers silence, sparse events, unlock, mute, volume and unclipped offline rendering. |
| 5. Full viewport and identity | Done locally. A 44px Credits control opens a native dialog with the game title, Alexander Kholodov · USFQ, and one same-site portfolio link; Escape restores focus. Object and postcard views have no profile or social links. The document never scrolls; measurement/history/detail panes can scroll internally. Browser cases cover 375×812, 390×844 and 1440×900. Workshop, hangar, shared effects, replay, postcard, object pages, kiosk, kill switches and live-safe recovery remain exercised. |
| 6. Exact-tag release chain | Done in code; remote execution pending captain. All three package versions are `1.0.0-alpha.1`. The guard accepts exact positive `v1.0.0-alpha.N` tags; publishing adds `--prerelease --latest=false`. After publication, the final step posts `galaxy-release`, `client_payload.tag = GITHUB_REF_NAME`, to `alexanderkholodov1/portfolio` using `PORTFOLIO_DISPATCH_TOKEN`. RUNBOOK section 12 documents authorization and retry boundaries. |

## Original alpha replay before independent review

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
- An earlier viewport fixture expected an obsolete identity label; the current journey checks Credits. Later full runs caught hidden-pane selectors and a replay canvas selector that also matched the effects canvas. Named controls and the historical-sky image role now identify the intended elements.
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
# Historical run: four passed; the obsolete identity fixture was later replaced by Credits checks.
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

## Independent review fixes and final replay

This section supersedes the pre-review acceptance figures above. All five findings are
addressed locally; production activation remains the captain's work.

| Finding | State and evidence |
| --- | --- |
| Major 1, quota | Done. Both quota documents are generated by the load script. Final 100/100-visitor burst: 43.0s, 5,995 reads versus the reviewed 9,036, and 2,493 writes. Whole quota day: 35,316 reads (70.632% of 50k) / 10,392 writes (51.96% of 20k). The script fails above 75%. It includes 125 phone reconnects, hidden tabs, 100 replay views with live fallback, 600 object/postcard views, two incremental restarts, portfolio banners, fencing/publication reads and the closed 16h remainder. These are explicit scenario allowances, not a billing guarantee. |
| Major 2, lease | Done. Firestore readTime governs election/expiry and heartbeatAt uses serverTimestamp. A persistent token is checked transactionally by every production enrichment writer. Heartbeat/expiry are 90s/360s. Emulator cases reject a contender ten minutes ahead and reject stale archive, meteor and snapshot writes. |
| Minor 3, transient failures | Done. A failed renewal keeps services until the last confirmed monotonic deadline; confirmed ownership loss stops them immediately. Emulator regression covers both grace and eventual deadline shutdown. |
| Minor 4, portfolio snapshot | Done. Retained snapshots/live for the portfolio's creators/at banner contract, correcting the review's unused-consumer assumption. Compact content debounces for 120s. Unchanged content, including process restarts, preserves at and writes nothing. Snapshot unit and emulator regressions cover this. at denotes last content publication, never a stand heartbeat. |
| Note, shard cap | Done. live-sky documents 512 entries per shard, skew/size limits, atomic failure of entry 513, replacement by an existing owner, retained drafts and no automatic rebucketing. Emulator test verifies rejection without partial user/object creation while an existing owner can edit. |

The actual production-loader probes measured 16 initial Home reads, 16 on resume, zero
hidden-update deliveries, warm/cold workshop reads of 0/16, replay live/static-chunks/frozen
reads of 3/1/0, and two public object/postcard reads per pair. Restart hydration with 20
pending events cost 46 reads / 2 writes; the day model adds chunk growth and rollover for
300 visitors. Stand reads fell from the reviewed 1,813 to 1,031; recent event deliveries
fell from 1,566 to 575. Snapshot and archive cadence in the compressed load run is 8s;
the model separately budgets the production 120s cadence and transactional guard costs.

### Exact ordered verification

Driver: `/home/alexamaze/bad/work/g-alpha1-fixes/verify.sh`; logs use the same directory.
All commands run from this checkout. TURBO_FORCE=true bypasses cache; Java heap is 512m
for rules/drills/load and connected browser emulators. Node is locally 24.9.0 (CI: 22),
pnpm 11.5.2, Java 21.0.12.1. Temporary exports use the designated task scratch directory.

| Command, in checks.yml order | Result |
| --- | --- |
| `pnpm install --frozen-lockfile --offline` | PASS, existing pinned dependencies |
| `pnpm run typecheck` | PASS, 3 packages, zero cache hits |
| `pnpm run lint` | PASS, packages plus root scripts/tests, zero cache hits |
| `pnpm exec playwright install --dry-run chromium` | PASS, read-only installation plan; existing Chromium exercised below |
| `java -version` | PASS, Java 21 |
| `pnpm run test` | PASS, 278 unit/script cases (38 shared, 170 web, 17 stand, 53 script), 26 surface browser cases, 2 connected journeys; native click-to-render 1,406ms against the unchanged 2,000ms gate |
| `pnpm run test:live-safety` | PASS, actual A→B→A swap/rollback and hosted read-only smoke |
| `pnpm run test:rules` | PASS, 192 cases in 5 files |
| `pnpm run test:drills` | PASS, 5 building-block drills; DRILLS.md regenerated |
| `pnpm run test:load` | PASS, 100/100 visitors, exact source/archive reconciliation, all quota probes and both 75% gates |
| `node scripts/with-example-env.js pnpm run build` | PASS, real build plus privacy gate (42 files), zero cache hits; committed rehearsal configuration |
| `test -s apps/web/dist/index.html` | PASS; artifact exists, no remote upload |

The CI OS bootstrap (`playwright install --with-deps chromium`) was not performed: it
would write outside this checkout. A read-only `--with-deps --dry-run` reported missing
package-manager dependencies; the existing browser successfully ran every suite. No OS
packages were installed. No upload, push, tag, PR, rules/index/Hosting deploy or remote
release action was performed.

### Red-first and iteration evidence

- `pnpm --filter @little-galaxy/web exec vitest run src/galaxy-data.test.ts src/season-data.test.ts`: new hidden-tab/static-chunk cases failed first, then 10/10 passed.
- `pnpm --filter @little-galaxy/web exec vitest run src/galaxy-data.test.ts src/interaction-data.test.ts src/season-data.test.ts src/firestore-observer.test.ts`: cache/window/retry regressions failed before the changes; final focused set 17/17 passed.
- `pnpm --filter @little-galaxy/stand exec vitest run src/snapshots.test.ts`: periodic-write and unchanged-restart cases failed first; 5/5 passed after the fixes.
- `pnpm exec vitest run scripts/load-test-report.test.js`: omitted-consumer report regression failed first, then 2/2 passed.
- Emulator regression prefix: `JAVA_TOOL_OPTIONS=-Xmx512m pnpm exec firebase emulators:exec --only firestore,auth --project demo-little-galaxy 'pnpm exec vitest run --config tests/rules/vitest.config.js <files-and-filter>'`. Lease and incremental-memory cases failed first; the lease/memory focused set passed 9/9. Core filters `-t "one transaction get"` and `-t "duplicate config gets"` failed on duplicate reads; `-t "honours season|duplicate config gets"` passed 2/2 after preserving disabled-edit permission errors.
- The first new load harness exposed an eager browser-environment import; Firebase is now loaded lazily only for the default browser data source. A subsequent load with five transaction lock timeouts was rejected. Bounded retries increased from five to ten, with all attempts still metered; later load acceptance passed 100/100.
- Real A→B and B→A passed before hosted smoke caught an execution-context race in its raw width evaluation. A retrying html scrollWidth assertion retains the 375px bound. A later rules replay caught changed permission-error semantics (191/192); the existing error contract was restored, then the complete replay passed 192/192.
- Drill text now describes commit-time switch enforcement and content timestamp semantics. `pnpm exec eslint scripts/drills.ts` and `pnpm exec vitest run scripts/drills-report.test.js` passed after that documentation correction (2/2 report cases).

The declared events type+at index still requires captain provisioning before activation.
Emulators do not validate production index availability. Real phones, TV, campus Wi-Fi,
Node 22 remote CI and physical failover remain operator acceptance. No requested code fix
is left open. The quota scenario does not certify arbitrary additional sessions or traffic.

## Alpha.1 navigation decision (2026-10-24)

The captain keeps the current navigation for alpha.1: Home links to the workshop;
the booth screen is opened directly by its `/galaxy/screen` URL. Credits contains
only the portfolio return link. Navigation will be defined by the later redesign.
