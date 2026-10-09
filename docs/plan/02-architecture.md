# Galaxy architecture

## Ownership and entry contract

Galaxy is an independent game. This repository owns the web client, game simulation/rendering,
data model, security rules, stand process for game operations, tests and release artifact.
The portfolio owns its own application and production Hosting assembly.

The QR opens the game entry directly: visitor name → galaxy viewing/exploration and other
actions → optional creation. Both the initial galaxy view and workshop must work on phones.
Profile navigation is optional, including when the game is entered directly or reloaded.

The intended URL is a path under `alexanderkholodov.web.app`, with final name/path pending design.
Use configurable base-path routing. Earlier `/galaxy` paths are prototype examples only.

## Technical baseline

```text
apps/web/         Vite + React + TypeScript + React Three Fiber / Three.js
apps/stand/       Node + TypeScript: snapshot and game operational jobs only
packages/shared/  Versioned domain records/commands, schema, deterministic math and replay data
tests/            Rules emulator coverage, unit tests and browser user journeys
```

Keep domain behavior separate from input/UI, rendering and transport. Use small Zustand stores
where useful; do not route per-frame animation through React state updates. WebGL2 is the first
renderer baseline; verify the compatible React/R3F/Three toolchain and lock dependencies.
pnpm workspaces are the package baseline; add task orchestration only when useful.

The physics baseline is deterministic two-body orbital math with seeded generation, with
failed escape/fall trajectories converted to returning comets. Detailed launch feel, host
behavior and moon ownership remain for design. Domain replay fidelity must survive rendering
changes; exact domain state does not imply identical pixels across hardware.

## Data and resilience

Use the separate game Firebase project for Auth and Firestore. The public web config is not
a service-account secret. Deny by default and prove ownership/lifecycle/history invariants in
emulator tests before expanding capabilities. Do not assume the old schema is implementation-ready.

Visitor names are distinct from generated object names. Their input rules, public visibility,
moderation and final storage contract are pending design; do not remove the required name step.

Continuous controls respond locally. Coalesce persistent edits and use explicit pending,
confirmed and rejected states. Commands carry IDs/revisions for atomic acceptance, deduplication
and replay consistency. Preserve offline drafts/intent, revalidate on reconnect and retain the
design if an action cannot be accepted. Expire ephemeral actions instead of replaying bursts.

Phones must receive enough bounded render data to explore before creating. Decide the
snapshot/projection read model and measure fan-out instead of assuming every phone only renders
its own object. Core accepted actions should not depend on stand-process uptime. Stand jobs
resume safely and expose snapshot freshness. Budget read/write costs including rules/reconnects.

`apps/stand` has no assistant integration, voice dependencies or assistant scaffold. The old
assistant specification is archived and inactive.

## Rendering validation

Share object representations across workshop, overview and focused views with different detail
budgets. Use resource reuse, instancing where appropriate, bounded lighting/postprocessing and
adaptive quality. Support reduced motion, touch alternatives and context-loss recovery.

Hearth (i7-7700K, GTX 1070, about 48 GiB RAM) is the development desktop. The fair uses a
different laptop, probably 2560×1600; its actual hardware and performance remain to be checked.
Target sustained fluidity and immediate feedback; publish measured evidence, not a hardware
promise. Detailed targets and load cases are in [10](10-construction-proposal.md).

## Release and portfolio integration

Galaxy PRs run checks/builds and use preview channels once access is configured. Releases
provide a versioned static artifact (`galaxy-dist-vX.Y.Z.tar.gz` is the internal convention),
version metadata, a checksum and declared base-path/identity-contract compatibility.

Portfolio pins the release and assembles it under the selected path. Galaxy never replaces
production Hosting independently. Standalone previews use compatible profile/token fixtures
so they remain testable without the portfolio source. See the portfolio-owned
[integration contract](../../../portfolio/docs/plan/02-architecture.md).

Data rules have a separate tested, operator-confirmed deployment process; do not automatically
deploy them as a side effect of a static release tag. Live client compatibility and state recovery
must be checked in previews before production promotion.
