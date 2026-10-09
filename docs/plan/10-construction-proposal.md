# Galaxy construction plan — M0

Status: **M0 approved with operator corrections on 2026-10-09; documentation and commits only.**
The small, production-quality first experience is explicitly approved. General technical
preparation is accepted subject to the corrections below. M1 implementation has not started.
Interaction sketches and final naming remain open for the dedicated design session.

## 1. Intent and current evidence

The game is an independent project hosted under Alexander's domain, currently using the working
title Collective Galaxy. It gives visitors a beautiful, tender, responsive place to experiment, leave an individual mark,
and feel part of a shared history. Technical correctness is necessary, but it does not by itself
prove that the experience is enjoyable or visually successful.

Current instruction: complete and commit M0 in each dedicated repository. Priority is galaxy
first, portfolio second. Future foundation work precedes a dedicated visual/game-design session.
The assistant is entirely excluded: no research, spike, scaffolding, dependency or milestone.
Game branding and the public route remain open; the intended URL is
`alexanderkholodov.web.app/<game-name>`, with a memorable name chosen during design.

Observed locally:

- This repository exists with Git history and initially had a clean `main` checkout. Its contents
  are documentation and repository instructions; no application implementation exists.
- The current workstation is **Hearth**, a desktop: Intel i7-7700K, NVIDIA GTX 1070,
  approximately 48 GiB system RAM, active display 2560×1440. These are inventory results,
  not a performance benchmark. WMI did not provide a reliable GPU-memory measurement.
- The fair uses a **different laptop**, probably with a 2560×1600 display. CPU, GPU, RAM,
  browser, and external-monitor configuration remain unknown. Hearth cannot certify fair performance.
- Node 22.19.0, pnpm 11.25.0 and Java 25.0.1 are present. Toolchain compatibility and emulator
  startup have not been tested; package versions will be selected together and locked at M1.
- Portfolio brand references are owned by the portfolio repository. Their use in game chrome
  is provisional and does not select the game's final art direction.
- The referenced CASPIAN design doctrine was absent at the paths checked. The operator's
  current visual brief is usable; record any later supplied doctrine before final art approval.
- Cloud services, credentials and deployed content were not inspected in this preparation.
  Old unchecked setup tasks are unverified, rather than proof that the services are still absent.

**Scheduling instruction:** milestones are defined by outcomes, with no calendar-day allocation.
October 21 remains the operator's delivery deadline; he owns scheduling. The roadmap in 06
contains outcome-based milestones; the superseded dated timeline remains in Git history.

## 2. Experience principles and the first complete loop

1. **Tenderness:** objects visibly respond to touch through small deformation, motion and sound.
   Failed launches remain playful and recoverable. Personality need not depend on cartoon faces;
   this is an art-direction question for M2.
2. **Beauty:** composition, scale, light, atmospheric depth and deliberate motion come before
   adding expensive effects. Close-up and overview must both work.
3. **Personal agency:** controls make clear, immediate changes. The visitor can experiment freely
   in a private workshop, recognize their creation in the crowd, and return to it later.
4. **Belonging:** a launch receives a visible welcome, contributes to the shared scene, and is
   recorded in the season's history. Quiet objects still deserve attention.
5. **Discovery:** optional details reward exploration after the visitor understands the basic loop.
   Advanced controls are progressively revealed; first participation must be understandable quickly.
6. **Continuity:** identity, drafts and confirmed creations survive reloads and recoverable failures.

The first production-quality slice is:

**Fair QR → game directly → enter visitor name → see/explore the galaxy and access other
actions → optionally choose Create.**

The creation branch can then test shaping one planet, touch/rotation, launch, visibility on the
shared screen, returning to the object, editing and a stable object page. The exact interactions
are provisional design-session material. A visitor can participate without creating a planet.

People discovering the portfolio separately may follow its project link into the same game.
Neither the profile page nor an automatic creation workshop is a prerequisite for QR visitors.

This slice establishes the visual standard, interaction feel, persistence, history and portfolio
relationship. It precedes broad object variety. It is not a proposal to remove approved features.

### Provisional interaction sketches — open, non-exhaustive design-session material

The following table is preserved at the operator's request as a **provisional sketch-proposal**.
It is not approved interaction design, an exhaustive feature list, an implementation checklist,
or a limit on what can be added, replaced or removed during the dedicated design session.
No new interaction semantics are decided by M0. Older baseline concepts are identified only
to show provenance; their detailed behavior remains open.

| Interaction | Sketch to discuss, not settled semantics | Provenance / provisional status |
| --- | --- | --- |
| Rotate, grab, zoom, change parameters | Local workshop feedback; changes to an existing public object save as deliberate revisions | Provisional sketch |
| Launch with a gesture | Preview direction/strength; commit an orbit; unsafe trajectories become returning comets | Existing concept, feel to validate |
| Find my object | Clear private navigation and a recognizable selection treatment; public spotlight uses a bounded queue | Proposed addition |
| Touch/pet | Immediate local reaction; public propagation only if useful and affordable | Existing feature, propagation to decide |
| Shake / comet / shooting star | Immediate local acknowledgement, bounded confirmed public effect, transparent cooldown | Existing features |
| Drag a launched object or change its orbit | Requires an explicit ownership, history and fairness design | Deferred decision; no assumption of permission to move others |
| Small discoveries | Try options such as cloud response, ring ripples, spin or sound variation in PoCs | Candidates, not committed features |

The earlier non-destructive direction remains a reference. Public editing, spotlight fairness,
control choices and small discoveries belong to the design session, which may expand beyond
this table. Visitor-name entry is required; its format and public visibility are still undecided.
Generated object names and predefined shooting-star messages are separate from visitor names.

## 3. Technical foundation

Retain two independent repositories, one production origin, and a separate Firebase data project.
Only `portfolio` assembles and deploys the production site; `galaxy` produces versioned artifacts.
No new hosting provider or public name is proposed.

| Area | Proposed foundation | Reason |
| --- | --- | --- |
| Galaxy UI | Vite, React, TypeScript; small Zustand stores for workshop/UI state | Clear boundary between UI and simulation |
| Rendering | Three.js + React Three Fiber; WebGL2 production baseline, custom materials, selective postprocessing | Broad device coverage and an established shader/effects path |
| Simulation | Pure TypeScript deterministic orbital functions and seeded generation | Same model for screen, object pages and replay |
| Data | Firebase Auth + Firestore, versioned commands and records, security rules tested in emulators | Preserve the agreed backend while proving its invariants |
| Stand | Node/TypeScript service with modular jobs, checkpoints and health status | Snapshots and game operations; core writes do not depend on its uptime |
| Sound | Web Audio, with Tone.js only where its scheduling/synthesis earns its cost | Deferred loading, bounded voices, user-initiated audio |
| Tooling | pnpm workspaces; add task orchestration only where the dependency graph needs it | Reproducible installs without unnecessary foundation work |
| Checks | TypeScript, lint, Vitest, Firestore rules emulator tests, Playwright | Different checks for math, security and real user journeys |

`galaxy`: `apps/web`, `apps/stand`, `packages/shared`. Within the web application, keep domain
commands, transport, rendering and UI separate. Define a small adapter boundary for local
fixtures/emulators and Firebase, not a general-purpose backend framework. Local fixture mode
must be explicit and cannot silently replace failed production connectivity.

The portfolio owns project assembly, root profile/token files and production Hosting. The
game owns a versioned build artifact and must consume the public integration contract without
depending on portfolio source code. See the
[hosting contract](../../../portfolio/docs/plan/02-architecture.md).
Use a configurable base path so the final name does not require gameplay changes. Standalone
previews need compatible identity/token fixtures and a direct game entry.

Do not make WebGPU a prerequisite for the first release. Its alternative shader/postprocessing
path would be a separate experiment if measured benefits justify it. Pin a mutually compatible
renderer/R3F/React toolchain and prove one shader scene before expanding materials.

## 4. Game graphics and input

Use three scene responsibilities: an expressive close-up workshop, a composed shared overview,
and a focused hero/spotlight view. They reuse object data and material logic, with different
detail budgets. Nearby objects receive detail; distant objects use simpler geometry/materials,
instancing where applicable and restrained light approximations. Avoid one shadow-casting
dynamic light per star and expensive full-screen blur layers.

Define low/medium/high quality profiles, capped device-pixel ratio and adaptive internal
resolution with hysteresis. Keep physical screen resolution separate from render resolution.
Measure frame time, memory trend, draw calls and responsiveness in representative scenes,
including simultaneous phone input and stand activity. Reuse resources and dispose scene
resources on navigation. Provide a visible recovery path after WebGL context loss.

**Provisional measurement targets, to calibrate on the actual laptop and phones:**

- Desktop/stand: aim for sustained 60 fps; inspect p95 frame time around a 16.7 ms budget,
  not only average fps. Test 100/300/500 objects and high-density effects separately.
- Phones: aim for 60 fps for one-object editing, with a stable reduced-quality profile around
  30 fps on weaker devices. Never lock controls behind a quality benchmark.
- Input: reflect drag/control changes on the next available frame, with no network round trip.
  Aim for p95 visible feedback below 50 ms on agreed target devices; measure separately from
  backend acknowledgement.
- Healthy network: aim for p95 accepted launch → shared screen visibility within 2 seconds.
  Report the environment and real result; disconnected operation cannot meet this target.
- Responsive checks: 320 px through tablet/desktop, portrait/landscape, safe areas, long ES
  labels, keyboard navigation, screen-reader labels, reduced motion and browser zoom.

These are acceptance targets, not hardware promises. Preserve interaction quality when reducing
visual cost. Test the laptop at its actual display configuration before declaring fair readiness.

Portfolio identity and public asset curation are specified in the portfolio repository.
They do not fix game materials, controls, atmosphere or final branding. The phone must support
the initial galaxy-viewing experience as well as a close-up workshop; budget both explicitly.

## 5. Backend resilience: contracts before feature count

### Responsive editing and durable actions

Workshop exploration is local and continuous. Persist the draft locally with a versioned schema
and show a fallback if browser storage is unavailable. Coalesce live object edits; never write to
Firestore per animation frame, pointer event or slider tick. Decide the save cadence from measured
quota costs and the visible promise of live editing.

Every persistent command has an identity, object revision and explicit pending/confirmed/rejected
state. Lifecycle operations use atomic, online-validated updates to object, user ownership and
history. Keep offline intent in a bounded durable outbox; process it after revalidation on reconnect.
Deduplicate retries through stable command/event IDs and recorded receipts. Reconcile a lost
acknowledgement before generating another command. Limit outstanding lifecycle operations per user.

Offline drafts remain editable; an unconfirmed launch is shown as waiting to join the shared galaxy.
Reconnection can reject an intent because the season closed, a limit was reached or another tab
changed the active object. Explain the result and retain the design. Ephemeral effects expire and
must not arrive in a large burst after a long disconnection. This replaces the old implication
that queued offline writes always become valid public actions.

### Invariants to prove in emulator tests

- One active object per anonymous identity, including concurrent tabs and launch/relaunch retries.
- Ownership and immutable fields cannot be forged; generated-name and parameter values are bounded.
- Each accepted persistent mutation and its replay event agree and commit atomically.
- Lifecycle transitions cannot leave two active objects or a dangling active-object pointer.
- Rate counters and cooldowns cannot be reset or bypassed by omitting related documents.
- Season closure rejects new public mutations; public clients cannot change privileged config.
- Recorded event ordering uses server time plus a deterministic tie-break/revision rule.
- Replaying committed events reconstructs the accepted state; versioned event data includes the
  seeds, parameters and orbital information needed for that reconstruction.

An exact history means reproducible domain state and timing, not pixel-identical rendering across
all GPUs. Draft movements are not public historical events. Version the replay schema and protect
old seasons from future algorithm changes.

Prove the smallest rules-backed command flow within Firestore rule access limits before adding
more actions. If the invariant set cannot be secured economically with this model, bring a
specific backend alternative and trade-offs to the operator before changing architecture.

### Cost, failure and publication

- Establish read/write budgets per command, per session and per event day, including rules reads,
  listeners, reconnects and snapshots. The old visitor estimate is not a load test.
- For example, 300 visitors × 20 confirmed edits × 3 writes already means 18,000 writes,
  before launches and background work. Do not promise unlimited persistent tinkering on Spark.
  Unlimited local experimentation and a carefully budgeted public save cadence are compatible.
- A shared snapshot reduces documents per update, not the number of subscribed clients: 300
  continuous viewers × 8 hours × one update/30 seconds is 288,000 deliveries before overhead.
  Budget realistic concurrent viewing duration; choose finite reads/refreshes for the portfolio
  banner and measure public-view behavior. Consider a cache/hosting change only with approval.
- Keep render data, owner-only state, operator-only configuration in separate access
  paths. Explicitly decide how screen clients read the render projection before implementing it.
- The stand writes snapshots only when useful, resumes jobs idempotently, exposes last-success
  timestamps and can restart without losing accepted creations. Its failure leaves core editing
  and the live screen usable where connectivity and quota allow; snapshots may become stale.
- Include bounded retries/backoff, stale/pending status, structured operational logs without
  private payloads, and queue/error counters. Any quota estimate is labelled as an estimate.
- Test kill switches and exhausted-budget behavior. A cloud kill switch cannot be assumed to
  propagate when connectivity or quota is already exhausted; clients need a local safe state.
- Keep old sessions recoverable across releases. Preview, retain compatible assets where needed,
  preserve drafts, and test old/new clients together before promotion. Deployment atomicity alone
  does not guarantee uninterrupted clients.
- Freeze each season into versioned static data with a checksum/manifest and a tested restore
  path. Anonymous device identity is not portable ownership; permanent links remain shareable.

## 6. Outcome-based milestones

See [06-roadmap.md](06-roadmap.md) for the authoritative game-only milestone sequence.
M0 records the corrected plan. M1 is the next implementation boundary, followed by M2's
dedicated design session. The portfolio has a separate roadmap; the assistant has no milestone.

### Game M1 scope for the next implementation step

1. Compatible pinned toolchain, package layout, scripts and versioned domain/data interfaces.
2. Configurable game routes and base path, error boundaries, a diagnostic renderer lab,
   viewport/input harness, quality controls, and local draft persistence/recovery.
3. Entry-state contracts accommodate visitor name, galaxy viewing/actions and optional creation.
   Do not implement a create-only entry or choose an unapproved name/interaction policy.
4. Emulator configuration, deny-all rules with tests, command/event interfaces and explicit
   local fixtures; a minimal stand skeleton for game operational tasks only.
5. Build/privacy gates, release artifact contract and preview configuration. Actual cloud
   verification depends on valid access and project configuration.
6. Record measurements and remaining dependencies, then hold M2 before expanding gameplay.

### M2 is a dedicated, open design session

The operator and agent will explore visual and interaction PoCs together. Candidate comparisons
already suggested (astronomical, miniature, hybrid) are only sketches, not a fixed shortlist.
The session can add new ideas, revise the earlier specification and choose a memorable game
name. It must cover direct QR entry, visitor naming, initial galaxy exploration, actions available
before creation, optional creation and the relationship to the shared screen.

Reference images can inform art direction; executable PoCs validate feel and performance.
Do not settle grabbing/moving semantics, public effects, moderation or social mechanics before
that session. The earlier moon/active-object conflict remains an open question to resolve there.

## 7. Dependencies and decision status

Cloud verification needs the data project/public config, authorized domains, appropriate
deployment credentials and GitHub access. Pending cloud access does not prevent local emulator
preparation, but local completion is not deployed verification.

Final performance validation needs the actual laptop and phones. Scheduling belongs to the
operator. Portfolio content is not a prerequisite for game entry or game-design work.

M0 implements the operator's corrections in the planning record and repository contracts only.
It approves the small high-quality slice as an approach and retains the general technical plan.
It does not approve the provisional interaction table, final game branding, a fixed public path,
or any assistant work. The next implementation step is M1; no application code is part of M0.

## 8. Primary technical references

Checked 2026-10-09; proposals above are engineering judgments, not promises made by these sources.

- [Three.js renderer overview](https://threejs.org/manual/pages/webgpurenderer): renderer and
  material/postprocessing compatibility considerations.
- [React Three Fiber performance guidance](https://r3f.docs.pmnd.rs/advanced/scaling-performance):
  resource reuse, instancing, level of detail and adaptive quality.
- [Firestore atomic operations](https://firebase.google.com/docs/firestore/manage-data/transactions):
  transactions require connectivity; atomic batches and rules have distinct constraints.
- [Firestore quotas](https://firebase.google.com/docs/firestore/quotas): free daily operation
  budgets and document limits must be included in design validation.
