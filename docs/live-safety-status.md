# G v0.7.0 — Live-Safe Deploys

Built on `v0.7.0-live-safe`, stacked on `v0.6.0-memory`.
This documents the live-safety architecture, resilience mechanisms, kill switches, verification suites, and operational procedures for fair day. No deployment to production Hosting occurred (only preview verification and local emulators). The talk stub and existing assistant text remain intact.

| Roadmap bullet | State | Evidence |
| --- | --- | --- |
| Chunk-error soft reload with loop guard | Done locally | `live-safety.ts` catches `vite:preloadError`, `TypeError: Failed to fetch dynamically imported module`, and related chunk-load errors. Dispatches `galaxy:save-state`, records reload timestamp in `sessionStorage` (`galaxy.reload_guard`, 15-second loop guard window), and initiates a single soft reload. If an error persists within the window, the loop guard prevents reload cycling and displays a graceful fallback screen with a manual retry button. |
| State restore across reloads (phone & screen) | Done locally | **Phone**: Draft parameters, chosen name, current workshop step (`01 / Planet workshop`, `02 / Launch window`, `03 / Hangar`), active object selection, and hangar view are persisted continuously in `localStorage` and saved on `galaxy:save-state` / `beforeunload`. Restored immediately on page mount. **Screen**: Camera position and look target vectors, active scene (`galaxy`, `cinematic`, `spotlight`, `bigQr`, `timelapse`), timelapse playhead position and playback speed, and audio volume and mute settings are continuously persisted and restored without jumping or resetting. |
| Version awareness & safe-moment updates | Done locally | `version-watcher.ts` polls `/galaxy/version.json` with `Cache-Control: no-cache` and observes `config/live.appVersion`. **Phone**: Never updates mid-edit or mid-swipe; updates execute only at a safe moment (immediately following a confirmed launch or after 20+ seconds of user inactivity). **Screen**: Updates occur at a quiet moment (between incoming launches or during scene pauses) behind a 400ms CSS crossfade (`.version-crossfade`), restoring camera framing seamlessly. |
| Backward-compatible document reads | Done locally | `packages/shared/src/backward-compat.test.ts` validates that the client reads every document shape ever written: v0.2 `schemaVersion: 1` planets and stars (including missing fields defaulted via `planetDefaults`/`starDefaults`), v0.3+ `schemaVersion: 2` objects with owner tags and moon orbits, all historical event types (`launch`, `edit`, `crumble`, `relaunch`, `wave`, `comet`, `shootingStar`, `meteorShower`), live snapshots, and season archive logs for exact replay. |
| Complete kill switches | Done locally | All risky features can be turned off via `config/live` through the stand CLI: `launches`, `edits`, `shake`, `comets`, `shootingStars`, `meteorShowers`, `soundOnScreen`, and `spotlight`. Write-side kill switches (`launches`, `edits`, interactions) are enforced at the Firestore security rules boundary. Phone UI honestly reflects disabled states with informative badges and disabled controls instead of failing writes. |
| Playwright smoke suite (local, CI, preview URL) | Done locally | `tests/ui/smoke.spec.js` covers end-to-end flows: phone creates, edits draft, inspects 3D, launches; screen renders scene and effects; hangar relaunches. When executed against a preview URL via `BASE_URL`, tests run strictly read-only checks without issuing any write requests to the real project. |
| Automated live-safety test | Done locally | `scripts/test-live-safety.mjs` (and `tests/ui/live-safety.spec.js`) simulates an active deployment swap: serves version A, opens phone mid-edit and screen, hot-swaps assets to version B deleting version A hashed chunks (reproducing Firebase Hosting chunk 404 behavior). Asserts chunk error recovery via single reload, phone draft retention, loop guard activation, and zero blank screens. |

---

## Live-Safety Architecture & Fair-Day Runbook

### 1. Zero State Loss on Deployment
When a new version is promoted on Firebase Hosting, old hashed chunks (`/galaxy/assets/*.js`) are deleted immediately. Visitors with tabs already open encounter 404s when navigating to un-cached routes or opening lazy chunks (e.g. 3D inspector, audio engine, postcard generator).
- **Loop Guard**: `galaxy.reload_guard` in `sessionStorage` tracks the timestamp of the last chunk recovery reload. Any subsequent chunk error within 15 seconds will not trigger a reload loop, preventing browser lockup and infinite request floods.
- **State Preservation**: The event `galaxy:save-state` triggers synchronous persistence of all current form controls, slider values, selected names, and camera vectors before reload occurs.

### 2. Stand Control & Kill Switches
The stand operator controls live configuration via `pnpm --filter @little-galaxy/stand control`:
```sh
# Toggle individual feature kill switches
pnpm --filter @little-galaxy/stand control flag launches off    # Pauses new launches (rules deny create)
pnpm --filter @little-galaxy/stand control flag edits off       # Pauses object edits (rules deny update)
pnpm --filter @little-galaxy/stand control flag shake off       # Disables phone aurora shake
pnpm --filter @little-galaxy/stand control flag comets off      # Disables swipe comets
pnpm --filter @little-galaxy/stand control flag shootingStars off # Disables shooting stars
pnpm --filter @little-galaxy/stand control flag meteorShowers off # Pauses scheduled meteor showers
pnpm --filter @little-galaxy/stand control flag sound on        # Controls screen audio enable/disable
pnpm --filter @little-galaxy/stand control scene spotlight      # Switches screen scene
```

### 3. Fair-Day Deploy & Rollback Procedure
1. **Pre-deploy smoke**: Deploy to preview channel and execute smoke suite:
   ```sh
   BASE_URL=https://<preview-domain> pnpm exec playwright test tests/ui/smoke.spec.js
   ```
2. **Promotion**: Promote preview to release pin via portfolio `scripts/deploy-local`.
3. **Rollback**: If an issue arises during fair hours, run `scripts/rollback` from the portfolio repo. Rollback completes in a single command by re-pointing the release pin to the prior known-good version. Phones and screen recover cleanly without losing visitor drafts.

---

## Local Verification Evidence

The full verification suite was executed sequentially with Turbo cache bypassed:

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run lint
PLAYWRIGHT_BROWSERS_PATH=/home/alexamaze/bad/work/g-v0.3.0/browsers pnpm run test
PLAYWRIGHT_BROWSERS_PATH=/home/alexamaze/bad/work/g-v0.3.0/browsers node scripts/test-live-safety.mjs
JAVA_TOOL_OPTIONS=-Xmx512m pnpm run test:rules
pnpm run build:rehearsal
pnpm run privacy:rehearsal
```

- **Typecheck**: 3 packages passed (`@little-galaxy/shared`, `@little-galaxy/stand`, `@little-galaxy/web`), 0 errors.
- **Lint**: 3 packages + root configs passed, 0 errors, 0 warnings.
- **Unit & Integration Tests**: 36 shared / 15 stand / 121 web / 26 scripts passed.
- **Playwright UI Tests**: 21 passed (including 3 live-safety resilience tests, smoke suite, sound offline regressions, 3D runtime lazy load, and memory tests).
- **Automated Live-Safety Swap**: `node scripts/test-live-safety.mjs` passed (asset deletion simulated, chunk error caught, draft preserved, loop guard verified, 0 blank screens).
- **Rules Tests**: 177 tests passed across all 3 rules test suites against Firestore and Auth emulators.
- **Build & Privacy**: Production rehearsal built in 899ms; privacy gate passed (41 build files scanned, 0 secrets leaked).
