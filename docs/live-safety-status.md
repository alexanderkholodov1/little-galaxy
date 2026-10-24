# G v0.7.0 — Live-safe deploys

Local acceptance uses the real Galaxy production application and demo Firebase emulators. No Hosting release, rules deployment, preview channel or physical handset verification is claimed. Assistant work remains deferred; the existing stub and text are unchanged.

| Roadmap requirement | Local evidence |
| --- | --- |
| Chunk recovery and loop guard | Production Vite lazy imports fail after replacing A's served tree with B. The phone coordinator saves state and waits for gestures/transactions to finish; a second chunk failure is bounded by the session guard. |
| Phone draft, step, active identity | Draft, inspector choice, mode and active identity survive recovery. Workshop navigation restores the selected section and focus, including the hangar. Component regressions assert visible inspection and focus. |
| Screen camera, scene, timelapse and volume | Effective automatic scene derives from restored idle/spotlight context. Focus, camera/look vectors and cinematic phase persist. Operator scene changes take precedence and reset the activity context. Replay restores timestamp, speed and playing/paused state after data loads. Audio volume/mute remain visitor preferences; operator suppression reaches the engine without overwriting them. |
| Version awareness and safe updates | `version.json` is fetched with `cache: no-store`. Config only prompts verification. Different served builds, including rollbacks, are update targets. Session storage remembers source→target attempts; matching served metadata clears the notice. Automatic updates require working session storage. Phone waits 20 seconds after activity and never updates with a dirty active object, transaction or held pointer. Screen waits for no effects/spotlight and eight quiet seconds, then crossfades. Timelapse includes the same transition. |
| Backward-compatible reads | Existing legacy object/event fixtures pass without a migration. This is sampled historical-shape coverage, not an audit of production documents. |
| Kill switches | Rules gate writes; component/controller regressions cover sound suppression and UI state. Flags include launches, edits, shake, comets, shootingStars, meteorShowers, soundOnScreen/sound and spotlight. |
| Local/CI smoke | `pnpm run test:ui` runs surface checks with Firebase unconfigured (so other workers’ emulators are never contacted), then a separate connected demo-emulator flow: launch→screen within two seconds, persisted edit, crumble, hangar relaunch and comet subscription. One browser worker; emulators stop on completion. |
| Build swap acceptance | `pnpm run test:live-safety` builds production A and B sequentially, swaps the served tree while a phone gesture is held and a screen is open, then checks real missing lazy assets, draft/inspector restoration, safe timing, screen focus/camera/volume and bounded updates. It swaps back to A to exercise rollback. CI runs this command. |

## Operational commands

From Galaxy, using the operator's existing stand credentials (never put them in the client):

```sh
pnpm --filter @little-galaxy/stand control flag launches off
pnpm --filter @little-galaxy/stand control flag edits off
pnpm --filter @little-galaxy/stand control flag sound off
pnpm --filter @little-galaxy/stand control flag spotlight off
pnpm --filter @little-galaxy/stand control scene galaxy
```

The same `flag <name> <on|off>` syntax supports shake, comets, shootingStars, meteorShowers, soundOnScreen and seasonOpen. `sound` sets both audio flags. These operator commands write live config; they were not run as part of this fix.

Hosted smoke, from Galaxy:

```sh
BASE_URL=https://<preview-domain> pnpm exec playwright test --config tests/ui/playwright.config.js
```

`BASE_URL` selects **only** `smoke-preview.spec.js`. It installs a context route before opening any page and blocks every non-read request except Firebase's POST read/listen endpoints. Auth signup, Firestore commits, write channels and unknown POSTs are blocked before transmission. Service workers are blocked. Pages use `?smoke=readonly`, which rejects application authentication/UID acquisition before anonymous sign-up; normal authenticated live data is therefore unavailable in this fresh smoke context. The preview check asserts static workshop/screen surfaces and their graceful disconnected states, not a connected launch. Never run local mutation specs against a hosted URL. The connected test requires local demo emulators and fails before seeding otherwise.

For the captain, from `~/Fauns/wt/portfolio-v0.3.0` (these commands describe operations; none were executed here):

```sh
pnpm run deploy-local -- --galaxy ../galaxy-v0.7.0
pnpm run rollback
```

The real implementations are `scripts/deploy-local.mjs` and `scripts/rollback.mjs`, exposed by those portfolio package scripts. Deploy-local builds the selected local Galaxy checkout, assembles the portfolio, asks before preview upload, smokes the preview and asks before promoting the tested immutable Hosting version. Rollback creates a new live Hosting release of the previous version after revalidation and confirmation. It does not change `games.json`. Changing the pinned Git release for a future build is a separate captain-owned Git operation. Config `appVersion` does not need to match either direction for browsers to settle.

## Verification boundaries

The required final verification is recorded in `~/bad/checkpoints/fix-g-v0.7.0.md` and the builder's final report. Logs under `~/bad/work/fix-g-v0.7.0/` distinguish failing pre-fix regressions from final checks. Local release swapping validates the client and static artifact behavior; a real Hosting promotion/rollback, CI execution and physical-phone acceptance remain captain/operator work.


## Alpha.1 Vivo acceptance

Home and Screen now read client-maintained owner shards, independent of stand
snapshots. Cached data is unconfirmed until a server response; a confirmed empty
sky is valid. The alpha.1 local replay passed 273 unit/script cases, 26 surface
browser cases, two connected journeys, 187 emulator rules cases, five drills and
the 100-visitor load rehearsal. Native click to rendered booth frame was 1,672 ms.
Production A→B→A swapping and locally hosted read-only smoke passed, retaining
held-gesture protection, drafts, camera, focus, volume and bounded recovery.

The schema/rules transition from pre-alpha clients requires a closed season and
one-time sky migration; it is not a zero-interruption legacy-client migration.
Beacon/laptop credentials and service activation, actual hardware failover, remote
CI and production deployment remain captain/operator work. See
[the full command/results record](alpha1-status.md), [quota decision](live-sky.md)
and RUNBOOK sections 11–12. No portfolio files, deployed rules or Hosting releases
were changed by this builder.
