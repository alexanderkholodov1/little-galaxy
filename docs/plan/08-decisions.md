# Galaxy decisions and precedence

## Current operator decisions — 2026-10-09

| Topic | Decision |
| --- | --- |
| Quality approach | Establish a small complete experience at final-quality standards before expanding breadth |
| Fair entry | One QR opens the game directly under the portfolio domain; no profile visit is required |
| Visitor flow | Enter visitor name, see/explore galaxy and access other actions; creation is a subsequent optional choice |
| Other discovery | A portfolio visitor arriving independently can follow a project link to the same game |
| Priority | Galaxy first, portfolio second |
| Ownership | Each project owns its plan/source/commits in its own repository; portfolio will host many projects |
| Current work | Complete and commit M0; application implementation belongs to the later M1 boundary |
| Interactions | Preserve the already-written table solely as a provisional, open, non-exhaustive sketch-proposal; detailed design waits for the dedicated session |
| Assistant | Entirely excluded from current work: no design, research, spike, scaffold, dependencies or implementation |
| Naming | Galaxy is a prototype/repository name; choose a memorable public name in the design session |
| URL | Intention is `alexanderkholodov.web.app/<game-name>`; exact path remains pending |
| Schedule | Outcome-based milestones, no calendar-day allocation; operator retains October 21 deadline and owns scheduling |
| Hardware | Develop on Hearth; fair laptop is a different device, probably with a 2560×1600 screen |

## Earlier baseline retained subject to the design session

An expressive, non-destructive shared universe; planet/star/moon concepts; editing/hangar;
returning-comet behavior for a failed launch; sound, global effects and season memory. These
remain the earlier product references in 01, not permission to invent detailed interaction rules
before the dedicated session. New ideas may be added there.

Technical baseline: React/TypeScript/Three.js, deterministic domain state, Firebase data project,
rules-enforced access, free-tier preference, separate artifact releases and portfolio-owned
production Hosting. English primary, Spanish secondary; light/dark UI with accessible controls.

## Open design and engineering decisions

- Final memorable name and route; visual personality, materials, layout and motion.
- Visitor-name format, validation/moderation, visibility and storage. The prior blanket ban on
  free text does not prohibit visitor naming; object names/messages are separate decisions.
- What visitors can do while viewing the galaxy before choosing creation; exact controls and gestures.
- Social effects, ownership/movement semantics, spotlight treatment and optional discoveries.
- Moon host lifetime and the interaction with one active object per anonymous identity.
- The bounded phone render-data read model and measured per-session/day quota budget.
- Target-laptop quality settings; actual cloud access and compatible dependency versions.

Do not apply defaults to these open design questions as if approved. Current operator decisions
override older text, example paths, assistant promises and any create-first flow in historical
material. The separately archived assistant plan cannot reactivate itself.

## Legacy reference IDs

Older documents use these IDs. They are preserved for traceability, not as a way to bypass M2:

| ID | Earlier reference / present status |
| --- | --- |
| D4 | Central starting star; earlier orbital baseline, design can revisit presentation |
| D5 | Generated object names; does not replace visitor-name entry |
| D5b | Earlier crumble-rock fade proposal was about two minutes; provisional detail |
| D6 | Earlier moon proposal allowed own/unclaimed planet hosts; host lifetime and active-object conflict remain open |
| D7 | Humming was outside the earlier event scope; not added by M0 |
| D10 | Earlier baseline: light/dark UI, dark galaxy scene; visual treatment remains for review |
| D11 | English primary, Spanish secondary; Russian was deferred |
| D12 | Post-event season/interactivity decision remains open |
| D14 | Data-project public name chosen by operator; M0 reserves nothing |

Assistant-related IDs have no active default. Event schedule questions belong to the operator.
