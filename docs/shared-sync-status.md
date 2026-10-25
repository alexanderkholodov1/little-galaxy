# Shared sky launch and motion fixes

Base: `92e2e75`. Integration and shared-store boundary only; game JavaScript, CSS and HTML are unchanged.

## Launch acceptance

`Replay.accept` compared duplicate accepted actions using `JSON.stringify`. A local transaction result
and a Firestore snapshot can represent the same nested maps in a different property order. The second
copy then raised `Conflicting accepted action`, even though admission had already committed successfully.
The action arrives through the subscription, the adapter's immediate accepted-action event, and the
launch-completion message. These are normal deliveries of one fact.

Duplicates now use the shared canonical typed encoding, which sorts nested map keys and preserves
array order and values. A genuinely different action at an existing sequence still raises a conflict.
No admission rules, nonce ownership checks or physics kernel changed.

Retry coverage confirms that a lost commit acknowledgement retains the draft's original nonce and tick.
A new session can return that same accepted launch after its effective tick has passed, without charging
another slot or adding a second object. Only an explicit `Resynchronize effective tick` rejection permits
the adapter to refresh the scheduling tick. Uncertain failures retain the original intent.

## Motion

The shared renderer did not advance its simulation, while authoritative worker states arrived every
100 ms. It therefore held each body's position at approximately 10 Hz, including while the camera
followed that body.

A presentation layer now blends body and system positions on every render frame. It adds approximately
one worker interval of presentation delay during ordinary playback. Authoritative coordinates are
restored in a `finally` block before input or another worker message can run. It neither runs competing
physics nor feeds interpolated coordinates back into the accepted replay. Identical-tick echoes do not
restart the blend; irregular corrections begin at the currently displayed position. Resume resets the
blend. Live targets cannot move backward when a refreshed server-clock estimate changes slightly;
frozen history still uses its final recorded tick.

## Resume and trail handoff

The integration visibility handler reloads a coherent store boundary and creates a new Replay in the
worker after showing the page. Previously every 480-step catch-up slice was published to the renderer,
including slices preceding bodies that were already on screen. The game's `applySharedState` removes
entries missing from a slice. Later slices recreate them with empty trail buffers.

The worker now publishes only a completed target state. A second integration guard also refuses
partial states, preserving existing entries while resume or late-delivery catch-up runs.

A remaining game-side responsibility is to rebuild orbit-line geometry across a hidden interval.
`apps/web/js/world.js:sampleTrails` records only visible render frames; trails are not Replay state.
The UI worker should preserve or rebuild trails using the final rail/orbit state when simulation time
jumps forward. This change does not claim to fill that missing geometry.

## Regression evidence

The new Replay unit test, rules-backed test and production-build browser test first failed with the
exact conflict error. This emulator preserves natural insertion order in the observed launch, so the
rules and browser regressions explicitly normalize keys in an otherwise identical duplicate. The
browser instrumentation is at the real worker delivery boundary; the gesture, Auth session, transaction,
security rules, log subscription, replay worker and renderer are the packaged game.

The browser regressions also run with ordinary unmodified emulator echoes. They require one accepted
sequence, one action document, one object document, one displayed object, and no conflict toast. The
normal UI suite includes them; `tests/ui/packaged-sync.config.js` runs them against a compiled demo build.
All browser network traffic in these tests is restricted to loopback hosts.

## Validation

- `pnpm run typecheck` and `pnpm run lint`: passed.
- Package unit tests, one worker and one package at a time: 164 passed.
- Root script tests: 78 passed. Prototype physics suite: all passed.
- `pnpm run test:rules`: 280 passed across eight files; no rules modifications.
- `pnpm run build` with public demo-project configuration: passed, including the privacy gate.
- Compiled demo build through `tests/ui/packaged-sync.config.js`: both launch regressions passed.
- `pnpm run test:ui`: 11 passed, including ten emulator scenarios and the unconfigured-build check.

Browsers ran only through `/home/alexamaze/bad/tools/with-browser.sh`. Heavy steps ran sequentially;
owned emulator processes stopped after every run. Detailed logs, red regressions and delivery hashes
are in `/home/alexamaze/bad/checkpoints/fix-sync.md` and adjacent `fix-sync-*.log` files.

Deployed-preview and physical-phone verification remain operator acceptance steps after importing the
bundle. Existing tabs receive the change after reloading the new build. No Hosting or rules deploy was
performed, and the accepted schema and physics kernel are unchanged.

