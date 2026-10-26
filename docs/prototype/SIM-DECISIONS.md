# SIM-DECISIONS — what I took from the physics note, what I changed, and why

Input: `spec/galaxy-sim-design.md` (the note, 2026-10-24) and the operator's override **R25** in
`spec/r3-operator-review.md`. The note is input, not a decision; the original R25 is superseded by the operator decision of 2026-10-25 below. Code: `js/sim/**` (DOM-free,
runs the same in Node), wired into `js/world.js`. Tests: `node tools/physics-test.mjs` (30 checks).

## The model in one paragraph

Compact bodies anchor systems. Launches first follow the existing fixed-step KDK / exact Kepler dynamics,
without a settling intervention for their first 60 simulated seconds. After that, each compact system takes a
300-second continuous position-and-velocity residual bridge to a stable galactic orbit. Its immutable site belongs to a
26-unit square spiral, mass-centred and rotating at 0.004 rad/s. True binaries retain both components and acquire
an internal circular separation of 3–6 units. A light body chooses the nearest suitable system after its protected
minute, then takes the same 300-second bridge into a circular Kepler rail of radius at most 14. Admission homes
remain accounting metadata; a physically valid capture by another system stands. A shared translation recentres new sites smoothly without restarting individual ages. All age, target and bridge state
is in snapshots and rewind marks. The old conservative integrator can be isolated with `settling: false` for its
energy and Kepler solver regressions; a null halo also disables the galaxy settling assist.

## Point by point

| Note | Decision | Why |
|---|---|---|
| G = 15, star mass 1, h = 1/120, KDK leapfrog, fixed pair order, no dropped ticks | **Accepted** (`rules.js`, `integrator.js`). The 8-substep cap per frame remains: a long stall loses screen time, never changes h | Matches M2. Measured energy drift 1.7e-5 over 1,000 orbits of a mass-1 star (e = 0.5) |
| Galaxy level H = 1/30 for topology decisions | **Accepted**: `GALAXY_EVERY = 4` | Same idea, one place |
| Softening by pair category (0.2 stellar, 0.01 ordinary, 0.8 nebula, 16 galaxy) | **Changed**: only ε = 0.2, because only compact bodies exert gravity | Light bodies are test particles (below), so there are no ordinary–ordinary or nebula-source pairs. A galaxy-level ε = 16 would create an energy jump at the hand-off between levels |
| All nonzero masses participate reciprocally (giants 0.01, planets 0.001…) | **Changed**: light bodies are test particles, with their masses kept for impact momentum and budgets | R25: a quiet orbit must not drift from secular nudges by its neighbours. That is also the note's own quiet regime ("quiet systems do not accumulate fresh secular perturbations") |
| Masses table (star 1, binary 2, pulsar 1.4, black hole 2, giant 0.01 … asteroid/comet 1e-6, nebula 1e-4) | **Accepted** (`TYPE_RULES`). The `binary` workshop type is **one** mass-2 body (an unresolved compact pair) for now | Two real components need a second design slot and a pair renderer; the mass and budget (2 slots) are already right, so the split can come later without changing any rule |
| Collision cores (planet 0.035, etc.) | **Changed**: contact radii stay at the prototype's visual scale (planet 0.35, comet 0.2 …) | With 0.035 cores, R12 impacts would almost never happen at this zoom. Impacts are gentle bounces, so a generous radius is safe |
| 8 s encounter window, then analytic paths | **Accepted** (`WINDOW = 8`) for impacts, close passes and a compact launch (which wakes unsettled bodies for 8 s; the mature population stays on its stable orbits) | Same intent. A light launch goes straight onto rails when bound: that is the launch's exact orbit, with zero integration error |
| Settling to Kepler elements with eccentricity caps 0.65 / 0.90 and lane settling | **Superseded, operator decision 2026-10-25**: preserve the launch for 60 simulated seconds, then settle over 300 seconds into the nearest suitable system, independent of admission home | The original quote applies while there are no further changes to the system; the collective galaxy keeps changing. See the verbatim decision below |
| Bounded Kepler solver | **Accepted, robust version**: universal variables with Stumpff functions, Laguerre iteration with a fixed count, bisection fallback (the universal equation is monotone), and the same modulo-period reduction every time | Handles ellipses, parabolas and hyperbolas. e = 0.995 returns to its start within 2e-9·a after 1,000 periods |
| e ≥ 1 → leaving | **Accepted (R25)**: e ≥ 1 relative to every system means `drift` mode | "e >= 1 leaves the system into the drift and capture rules" |
| Far travellers: outer-nebula rescue, return in 3–10 min | **Changed**: the rescue is the conservative logarithmic halo from M2 (no force inside r0 = 22). Before the age gate, return times follow from the throw (a hard throw returns in ~50–70 s); the later settling assist imposes its own finite deadline | A conservative potential needs no energy ledger and changes no orbit by fiat. The dotted preview shows the real loop |
| Only comets / icy asteroids grow comas; stars, binaries, pulsars and black holes never become comets | **Accepted, as R8 already does**: comet, asteroid and meteor may become comets; everything else returns as itself | The operator accepted asteroids returning as comets in round 2; a dry/icy asteroid choice can come with the surfaces work (R19) |
| Hill-region hosts with 0.4/0.6 hysteresis, held 1 s | **Initial capture**: a body's host is the system it is most bound to (most negative two-body energy). A traveller is captured only inside R_FAR = 19 of a system, bound for 1 s in a row. A rail may not reach farther than 0.45 × the distance to the next system (else it stays integrated). After the protected minute, the explicit assist chooses the nearest suitable system, including for unbound travellers | Moons around planets are not in this run (their Hill orbits, 0.08–0.3 units, are below the visual scale of a planet). The 1 s hold is the note's |
| Capture needs an energy account; nebula assist with a cap | **Accepted for the initial dynamics / isolated conservative model**: pure two-body flybys stay unbound when the halo and settling assist are disabled (test 13a). A three-body exchange can bind naturally; the revised scenario also verifies eventual settled capture by a second system. A nebula passed within 2.2 radii near a system removes only the energy needed for a slightly bound orbit, at most 1.6 per unit mass, once per nebula per 30 s, with the removed energy on `sim.assistEnergy` (13b) | Visible and bounded, as the note asks |
| Binary: compact semimajor axis 1.8–2.5, e ≤ 0.1, planets outside 4a | **Changed (R25)**: two compacts are a binary when bound with apoapsis ≤ 19 (the visible edge), with hysteresis to 24. Their first-minute orbit is the one the throw made; after that, the convergence assist freezes membership and bridges both members to a 3–6-unit internal circular orbit. The other bodies orbit the pair's barycentre with the total mass (circumbinary, the note's aggregate) | The approved hybrid assist permits a gradual change after the protected minute. Both real components remain separate; quiet light rails orbit the aggregate |
| Fast star founds a new system; systems balance about the galaxy COM | **Accepted**: an unpaired compact more than 38 units from every other system founds its own (event `system`). The frame is the compacts' centre of mass. During the initial dynamics, event reframes follow compact admission; mature systems occupy the rotating sites and a shared smooth translation brings their barycentre to the origin | Recentring every step is non-conservative with an origin-centred halo (my first try failed the energy test with 0.73). At an event it is a frame change, as the note says |
| Black hole: Newtonian, mass 2, sling, safety core | **Accepted**: no multiplier. A moving hole slings passers (test 14: 17 slings, Campfire speed 1.6, nothing lost, no comet). Its guard contact is an "accretion" puff onto a long safe orbit. The protected encounter phase retains the existing kiss/snuggle response; mature systems use the spacing guarantee below. Isolated unbound encounters still conserve energy to 1e-4 | — |
| Restitution 0.6, equal and opposite impulses, no fragments, one effect per contact, 2 s per pair | **Accepted** (`bounce`, `touch`). Effect by receiver: frost (a comet or meteor hits), chips, crater (moon), storm (giant), squash (planet), sparkle, pass (nebula, no bounce). No low-speed asteroid aggregates yet | The aggregate needs a two-pebble renderer; nothing in the rules blocks it |
| Budgets: player 3 slots / 3.1 mass / 1 black hole / 1 stellar recipe; system 32 bodies, ≤ 2 compacts, ≤ 1 hole; galaxy 1,024 bodies, 4 holes, 32 systems; 10 min between new holes | **Accepted** in `admission.js` (pure functions over a ledger inside the snapshot). Exception: the **3-slot player limit is off in the local prototype** (`BUDGET.playerSlots = Infinity`) so the operator can test freely; the shared app turns it on. `?sandbox` lifts the heavy-type player limits for testing | Spam test: 100 attempts from one player → 1 hole; 100 fresh players → 4 holes at minutes 0, 10, 21, 31, ≤ 1 per system; rejects leave no body |
| Never evict old bodies | **Accepted**: the world's 48-body eviction is gone. Toys (throw for fun) still fade by themselves; a full galaxy rejects the launch and keeps the draft | — |
| Shared nursery primary when crowded | **Not yet** | Needs the crowding rule and the admin view first |
| Deterministic Wasm kernel, Firestore log, checkpoints, rules | **Not in the prototype** (that is M7). Prepared: the sim records an accepted-action log (`sim.log`: seq, tick, id, type, owner, p, v) and a ledger, both in the snapshot; persistence is behind one interface (`js/store.js`) | The swap to GalaxyStore is one file |

## Launch from the player's view (R6)

The launch point is the point on the galactic plane under screen position (0.5, 0.64) of the player's own view,
clamped to 3.4–30 units from the dominant system. The pull is measured in screen pixels, so zoom does not multiply
it. Its direction, reversed, is expressed in the camera's flattened right/forward basis, so any in-plane direction
works (prograde, retrograde, radial) and orbits stay flat (inclination 0, inside the planned ±8°). Strength is
v = 6.5·s/(1+s), with s = pull / (0.45 × the short side of the screen): no hard stop and a finite limit, below the
note's 8 u/s. The host system's velocity is added. The dotted preview runs the same rules. A bound light body is
drawn as its exact Kepler ellipse (two thirds of the dots on the near 90 units). A fall or an escape uses the same
integrator with a massless probe. A compact body is integrated with its own mass in the frame the simulation will
have after the launch.

## Historical feel pass (2026-10-25, superseded by the convergence decision): wide pairs, returning systems and the kiss chain

Probe: `node tools/feel-wide-binary.mjs [minutes]`. It reruns the desktop scenario: six planets, a star thrown out
that founds a second system, then a black hole thrown into a wide pair with the Campfire. It prints per minute the
systems, the pairs, the closest system–system approach and how many planets changed host.

What it showed (before): the founded star does not orbit the Campfire. It rides the halo out to ~44 and falls back
through the middle every ~6–8 min. At minute 6–7 it passed 2.3 units from the pair and broke it. After that, two
compacts stayed bound but kept bouncing off the elastic `kiss` at 2.4 units: **≈ 60 kisses, one every ~2 s, for 2+
minutes**, each with sparks, a squash and the storm sound. 32 host changes in 10 min.

Decision:
- **Changed: a kiss between a *bound* compact pair is soft** (`SNUGGLE` = 0.35 restitution on the normal component, in
  `rules.js`). Two stars that would fall back together settle in a few touches into a tight binary just outside 2.4,
  so they "snuggle" instead of bouncing forever. An unbound flyby is still perfectly elastic, so slings and the
  conservation test are unchanged. The energy taken goes to `sim.snuggleEnergy` (in the snapshot), next to
  `assistEnergy`. A touch slower than `KISS_QUIET` = 0.25 u/s is resolved with no event and no sound. A snuggle sounds
  like a sparkle, not a storm.
- **Accepted as real dynamics: founded systems come back.** A founded system rides the halo and passes by the old
  neighbourhood every several minutes. I did not add a galaxy-level softening (the note's ε = 16), because it makes
  an energy jump at the hand-off, and I did not add a settling force on galactic orbits (R25's spirit: no orbit
  changes by fiat). The tight pair a snuggle leaves behind is much harder to break than the wide pair the throw made.
- After (same seed): 10 min → the pair holds, closest pass 12.4, 9 host changes, 4 kisses. 20 min → the pair still
  holds, closest pass 5.7, 19 host changes, kisses only in short snuggles of 2–4 touches. `physics-test.mjs` 30/30.
- Still open for the operator's 30-minute play: with many founded systems, passes get more frequent. If it reads as
  too busy, the next knob is `D_FOUND` (found farther out → longer halo periods) and not a new force.

## Known gaps (for the next run)

- The sim resumes at its saved time when a page reopens. Rails could be evaluated at wall-clock time analytically,
  but the compact bodies and travellers would need catch-up integration, so I did not mix the two.
- Moons do not orbit planets; all light bodies orbit systems.
- The pair renderer for a real two-component `binary`, low-speed aggregates, the nursery primary.
- Visual feel of the young cohort, crossings of quiet light rails and the galactic site pattern still need deployed-preview and real-phone play. Node measurements cannot establish browser/device rendering quality.

## Convergence decision and change log — 2026-10-25

The operator superseded R25 and approved hybrid option (a), verbatim:

> "tecnicamente si, pero considera que hay muchos otros objetos estelares, esta cita textual aplica si no hay MAS cambios
> en el sistema, mientras que (como es nuestro caso) tenemos una mulitutd de nuevos sistemas solares, obviamente la masa y
> campos gravitacionales van a cambiar, entonces la galaxia en si debe converger hacia un punto estable sobre un tiempo
> determinado; apruebo la opcion hibrida a)".

The earlier "la órbita que se creó cuando fue lanzado, no importa que tan elíptica o larga" now protects the first
minute of each launch. Nothing disappears, fragments, merges into another body or loses its stellar identity.
This is an explicit dissipative/design assist, not a claim that a closed Newtonian galaxy converges spontaneously.

- **Finite convergence:** cubic Hermite decay around the moving target has zero residual and the target velocity at 300 seconds. Initial
  position and velocity match exactly; there is no instantaneous capture teleport. With no subsequent perturbation,
  a body reaches its final orbit 360 seconds after birth (up to one 1/30 s decision tick). A binary waits until both members have completed their protected minute. A missing/unsuitable
  light host delays the start until a suitable one exists. A disrupted host restarts selection from the current
  state. Young contacts can also restart a captured light body. A constant stream of launches therefore has an
  active recent cohort; the old population converges, rather than resetting a galaxy-wide age timer on every launch.
- **No compact collapse in the settled state:** distinct site centres stay at least 26 units apart under common
  rigid rotation. Each binary component is at most 4 units from its centre for the available masses and a 6-unit
  separation (the conservative general bound is 6). Even that looser bound gives at least 14 units between
  unrelated compacts, above the 8-unit acceptance threshold. The two real binary members are at least 3 units apart,
  above the 2.5-unit stuck threshold. A new compact's first minute and the bridges are still transient dynamics;
  they do not have that spacing guarantee. Unlike radial braking, the final equations cannot dissipate sites into
  the origin. The galactic motion is a prescribed stable orbit, not a mutually integrated N-body equilibrium.
- **Light capture:** suitable means enough room outside the system guard and inside 0.8 times its rail limit.
  The radius follows the body's distance at selection, clamped between guard + 2 and 14. The angular direction is
  inherited from its relative motion. The bridge ends at zero eccentricity, then the existing universal-variable
  solver carries the rail. Captured/bridging light test particles share the quiet regime and do not bounce off
  one another; a fresh launch still participates in the original contact rules. Captures emit a visible event.
- **Replay:** birth steps, sites, binary geometry and bridge conditions are restored with the simulation. Fixed
  1/120-second steps and id ordering remain; no wall clock or unseeded random source enters the equations. Quiet
  replay skipping is disabled while a light body still needs its age gate/bridge processed.
- **Acceptance:** `MEASURE=1 pnpm --filter @little-galaxy/web exec vitest run integration/settle-measure.test.js`
  reads the private fair fixtures locally and also replays 150 seeded throws over 30 minutes. No private fixture
  data or names are embedded in this document or in the test. The first-minute comparison advances two complete accepted-log replays in lockstep. An independent control
  explicitly disables settling for every body during its first minute; older bodies retain the same equations.
  Position, velocity and mode are compared for each young body on all 7,200 steps, including later launches. This isolates the launch's age gate; it does not
  claim an unchanged historical trajectory in a galaxy whose older systems now follow different equations.

### Kernel and frozen-galaxy migration

The kernel fingerprint is recomputed from the current allowlisted `js/sim/*` text in the exact order of
`scripts/sync-prototype.mjs`, then `replay.js`, `homes.js`, `names.js` and shared `names.ts`.
The frozen fair galaxy must keep its old kernel identity and its accepted log. Relabelling the document with the
new identity would silently rewrite its historical timelapse. Its timelapse needs an archived old-kernel build
(or a kernel-version dispatcher serving that implementation); the current Replay deliberately rejects the old
identity. An active galaxy adopting this model needs an explicit new kernel generation and replay/rebuilt certified
checkpoints under that identity; old snapshots cannot be reused. No Firestore document, Hosting deployment or
production kernel routing is changed by this patch.

### Measured acceptance — 2026-10-25

Final source kernel: `proto3-d5a11fdf3009ac4c43eb5503cb2158546c88ca066215a7abf89deec3f21cba0d`. The fair fixture is replayed on its original accepted ticks (over five
simulated hours); the synthetic log contains exactly 150 seeded throws over 30 simulated minutes. Each then gets
10 launch-free simulated minutes. Radius is measured from the barycentre of **all body masses**.

| Criterion | Fair: 21 actions | Synthetic: 150 launches |
|---|---:|---:|
| Light rails, at least 80% | 13/13, 100% — PASS | 135/135, 100% — PASS |
| Maximum radius, at most 200 | 40.281507 — PASS | 73.291744 — PASS |
| Non-rail pairs closer than 2.5, excluding moon/parent | 0 — PASS | 0 — PASS |
| Unrelated compact pairs closer than 8 | 0 — PASS | 0 — PASS |
| Minimum unrelated compact separation | 26.000000 | 26.000000 |
| Last 5 min binary + kiss + impact + puff + sling + escape + away, at most 30 | 1 — PASS | 2 — PASS |
| First 60 s maximum position/velocity delta; changed modes | 0; 0 — PASS | 0; 0 — PASS |
| First-minute samples (7,200 per light launch) | 93,600 — PASS | 972,000 — PASS |
| Bodies retained, including initial/nursery primaries | 22/22 — PASS | 154/154 — PASS |

Measured wall-clock replay of 10 simulated quiet minutes on this machine:

| Dataset | Alpha.8 before | New kernel after |
|---|---:|---:|
| Fair | 4,823.684 ms | 3,438.696 ms |
| Synthetic | 97,167.606 ms | 13,506.530 ms |

These are individual wall-clock runs, with other local checks running concurrently, not a controlled browser
benchmark. The alpha.8 synthetic baseline also measured 0/135 light rails, 83 stuck pairs, 52 compact spacing
violations and 173,875 last-five-minute chaos events. Final checks: web 97 passed / 1 opt-in test skipped; physics
30 passed; opt-in measurement 1 passed (both datasets, 235.697 s). Deployed preview, real phones and cross-browser
bitwise agreement remain unverified. The prescribed mature orbits and quiet captured test particles are design
assists; close young encounters and bridge paths are transient and do not carry the settled-spacing guarantee.


### A2 review round 1 — deterministic arithmetic and independent controls (2026-10-25)

The alpha.9.10–12 paired-replay first-minute result is superseded: both sides ran the same
production step and could share the same defect. This round replaces that evidence and addresses
all six coordinator-selected findings. The 60 s launch grace, 300 s bridge, capture across
admission homes and 26-unit compact sites remain the acceptance model.

**Deterministic arithmetic.** js/sim/math.js implements the functions used by the kernel:
sin, cos, atan, atan2, acos, exp, log, sinh, cosh and hypot. Its only Math primitives are sqrt,
abs and floor; other numerical operations are explicitly rounded binary64 +, -, *, /,
comparisons and constants. Square/cube multiplication replaces exponentiation. The RNG and
hash retain specified exact integer operations. No native transcendental or hypot call remains
in any sim source or replay's legacy-orbit physics. Source-scan tests enforce both restrictions.
The new module is included in the sync allowlist and therefore in the kernel fingerprint.

Sine/cosine use split three-term pi/2 reduction and fixed polynomials. Dense tests cover
[-2pi,2pi], [-1e6,1e6] and cancellation around pi/2 multiples. Settling callers first reduce
orbital time to one period, bounding angles regardless of replay age. The math API rejects
trig arguments outside +/-2^20; reduced orbital angles and the bound Kepler solver's reduced
time stay well inside this range. Atan uses reciprocal/quadrant and pi/4 reduction; log uses
power-of-two scaling and an atanh series; exp uses split ln2 and power-of-two scaling.
Operations are engine-independent by construction rather than assuming V8, JavaScriptCore and
SpiderMonkey share libm. Cross-engine execution has not been performed here. Accuracy against
this machine's V8 Math implementation is empirical, not a proof of exact real-function rounding.

**Canonical zero.** Input vectors, orbital initial conditions, bridge outputs, rail outputs,
hash inputs and recursively cloned snapshot/restore state normalize -0 to +0. The public
add/rail APIs previously produced live hash f421b228 and JSON-restored hash 0ab2f228 for the
same signed-zero orbit; the regression now requires equality and checks saved vectors.

**Independent first minute.** integration/first-minute-reference.js contains no Sim or settling
implementation. It advances a separate probe with plain KDK against the primary positions
consumed by production. Integrated intervals require exact position/velocity equality, including
the completed step after guard/contact handling. For pre-existing analytic Kepler rails, separate
central-force KDK (no softening or halo, matching the rail force law) advances at h/16 and h/32
relative to the same host. Its second-order accumulated truncation error differs from production's
analytic universal-variable solution, so both position and velocity must stay within 1e-4 game
units / game units per second. The h/16-to-h/32 difference must also remain within 1e-4.

The primary trajectory and discrete encounter timeline are fixed. A guard, contact, nebula
impulse, rail transition or frame change provides a new segment's initial conditions; the prior
continuous interval is checked before the impulse. This controls settling without claiming to
independently test existing contact/guard policy. No probe is corrected during an uninterrupted
integration interval. Every light launch contributes exactly 7,200 completed-step samples.
Settling during that minute is independently forbidden. A shared production-list velocity
mutation, which passed the old paired replay, must now fail. A mutation on the last protected
step must fail too. Circular and e=.3/.8/.97/.995 launches and a primary-addition/frame-change
scenario exercise the reference outside the opt-in measurement.

**Distinct light paths.** Bridges reserve radii in body-id order, considering ongoing bridges
and finished rails of the same host. Search starts at the preferred radius, then tests +.01,
-.01, +.02, -.02, etc. within guard/rail bounds. A full host does not assign an occupied lane.
Reservations survive snapshots; removal releases a lane. Eight identical launches previously
assigned one radius; the regression requires eight paths and at least .01 radial separation
after completion. Separate paths do not imply finite-radius specimens never visually overlap.

**Host dissolution.** Topology releases bridges/rails whose host disappeared before the next
KDK. Current world p/v already contain the former host's motion, so both remain unchanged at
removal and acceleration refreshes in the surviving world frame. The next step integrates
normally instead of returning with stale coordinates. The binary-removal test compares its
full p/v with independent plain KDK against the same surviving primary positions.

**Contact and rail costs.** A mutable spatial grid replaces all-pairs enumeration. Candidates
are sorted into original body-id i/j order. After a bounce, both cell memberships update and
later candidates are queried again, preserving newly created bounce-chain contacts. Distant
recorded contacts remain candidates for cooldown cleanup. Fully quiet populations take an early
exit with the original suppression semantics. A test-only frozen all-pairs algorithm checks full
snapshots and ordered impact events at every contact update in the existing 30-check physics
suite, plus a dense cell-boundary/bounce-chain regression. Rail limits are computed once per
system per topology position update, then read by classification and settling; a call-count
regression prevents per-body recomputation. Completed circular rails rotate stored p/v directly
instead of repeatedly solving universal variables. A 10,000 s check bounds differences from
the general solver below 1e-9 and verifies exact JSON restoration.

Red/green evidence: all five original regressions (native math scan, signed-zero wire state,
identical paths, missing host step, rail-limit cache) failed before their fixes. The shared
production-defect test failed against the original control, then passed after replacement.
The grid is checked against an independent all-pairs oracle throughout existing scenarios.
Raw local evidence remains ignored under .tmp; no private launch payload is added.

### A2 round 1 resume on Beacon (2026-10-26)

The WIP commit omitted six new files. The coordinator recovered the originals; the deterministic
math, shared fixture/reference driver and three regression files are restored from those originals.
The complete allowlisted source independently regenerates the existing pin
`proto3-a7309c9242d1a8d6a8308f9201860dae09b78ee7992a7e6af9f95c59ef2eceed`.
No fingerprint from an incomplete checkout is accepted as evidence.

Fresh red/green evidence uses frozen `abcb9fa` source in ignored `.tmp/before`. The native-math
scan, signed-zero round trip, eight identical lanes, binary-host removal, cached limits and both
shared-defect mutation assertions fail on that source/control and pass with the restored fixes.
A separate sparse-contact regression counts position reads for 100 distant active bodies; it
requires fewer than 1,000 reads, while the all-pairs oracle separately checks state and event order.

The performance harness now requires `PERF=1 PERF_SIZE=150|1000 PERF_VARIANT=before|after`.
Each invocation constructs one galaxy, measures exactly 72,000 steps (600 simulated seconds),
and exits. The before source is extracted from `abcb9fa`; the synthetic seed/actions and the
1,000-body mature fixture are identical across variants. The latter contains one primary and
999 circular rails at radii `4 + i * .01`; it retains the original fixture's universal solver
path, rather than setting bridge metadata solely to select the new circular shortcut.
Fixture preparation is reported separately from the measured replay.

All benchmark and acceptance processes on Beacon use a 1,024 MB Node heap limit. A local wrapper
checks `free -m`, refuses to start below 700 MB available, samples memory every .25 seconds,
and stops only its own process group below 650 MB, leaving headroom above the required 500 MB
floor. Cases run serially. The full convergence test also releases its completed trajectory replay
before constructing the independent first-minute reference sky. No fair payload, local logs or
benchmark snapshots are committed.

Dense accuracy against Node 22.23.2 / V8 on Beacon (ULPs, maximum observed):

| Function | Swept range / arguments | Sweep samples | Max ULP |
|---|---|---:|---:|
| sin | [-1e6, 1e6] and [-2pi, 2pi] | 200,002 | 2 |
| cos | [-1e6, 1e6] and [-2pi, 2pi] | 200,002 | 2 |
| atan | [-100, 100] | 100,001 | 1 |
| atan2 | x in [-100, 100], second argument 100*cos(i) | 100,001 | 2 |
| acos | [-1, 1] | 100,001 | 3 |
| exp | [-700, 700] | 100,001 | 1 |
| log | exp([-30, 30]) | 100,001 | 2 |
| sinh | [-20, 20] | 100,001 | 2 |
| cosh | [-20, 20] | 100,001 | 2 |
| hypot | [x, 100*sin(i), .1*cos(i)], x in [-100, 100] | 100,001 | 2 |

The test additionally probes cancellation around seven pi/2 multiples and enforces at most 4 ULP.
These are empirical comparisons to V8, while platform independence follows from the restricted
arithmetic implementation and source scan. JavaScriptCore/SpiderMonkey and real-phone execution
remain unverified.

Controlled wall times on Beacon (milliseconds, one run per case; Node/Vitest overhead excluded from setup/replay):

| Case | Variant | Setup ms | 600 s replay ms | Peak RSS MiB | Minimum available MiB |
|---|---|---:|---:|---:|---:|
| 150 launches (154 bodies) | before | 37380.085 | 9008.664 | 256.4 | 1409.2 |
| 150 launches (154 bodies) | after | 64655.569 | 9011.655 | 219.7 | 1789.0 |
| 1,000 bodies | before | 38.047 | 40156.016 | 235.7 | 1787.6 |
| 1,000 bodies | after | 47.015 | 20570.057 | 232.9 | 1774.5 |

The 150-launch quiet replay is effectively unchanged (+0.033%). Its launch-history setup is
slower (64.656 s versus 37.380 s) after replacing native libm with deterministic arithmetic.
The 1,000-body quiet replay takes 48.775% less time (1.952x throughput). These are local
server measurements, not browser frame-rate or real-phone results. No memory guard fired.

The 150-launch benchmark setup includes the 30-minute accepted launch schedule and a further
600 s settling warmup; the measured interval is the following 600 s. The convergence test below
measures the first 600 s after the last launch, including unfinished bridges, so its quiet time
is a different interval. The mature 1,000-body fixture needs no warmup.

Final opt-in acceptance (both datasets, 201.76 s total; all assertions pass):

| Metric | Fair | Synthetic 150 launches |
|---|---:|---:|
| Retained bodies | 22/22 | 154/154 |
| Light bodies on rails | 13/13 | 135/135 |
| Rail percentage (>=80) | 100 | 100 |
| Maximum all-mass COM radius (<=200) | 40.286674 | 67.330418 |
| Stuck pairs | 0 | 0 |
| Unrelated compact spacing violations | 0 | 0 |
| Minimum unrelated compact spacing | 26.000000 | 26.000000 |
| Last-five-minute chaos events (<=30) | 1 | 2 |
| Launch-history replay ms | 19574.392 | 54546.059 |
| First 600 s after last launch, replay ms | 2382.077 | 14048.985 |
| First-minute launches audited | 13 | 135 |
| First-minute completed-step samples | 93600 | 972000 |
| Integrated maximum state delta (exact) | 0 | 0 |
| Rail maximum state delta (<=1e-4) | 2.499847227e-7 | 3.245467948e-5 |
| Rail maximum position delta | 2.499847227e-7 | 8.352532618e-6 |
| Rail maximum velocity delta | 1.125010375e-7 | 3.245467948e-5 |
| Reference refinement delta (<=1e-4) | 7.499571921e-7 | 9.736375969e-5 |
| Independent reference segments | 29 | 505 |

Every light launch contributes exactly 7,200 samples. Integrated segments agree bit for bit.
Analytic rails use the independently integrated unsoftened reference at h/16 and h/32; their
bounded truncation error is reported rather than claiming exact agreement. The synthetic
refinement maximum is close to the asserted 1e-4 limit; it remains within that limit.
The minimum synthetic compact spacing differs from 26 only by floating-point rounding.
The acceptance process peaked at 230.7 MiB RSS and retained at least 1,745.7 MiB available.

Final required commands, run serially with the heap limit and memory guard:

- `MEASURE=1 pnpm --filter @little-galaxy/web exec vitest run integration/settle-measure.test.js`: 1 passed, both datasets (201.76 s).
- `pnpm --filter @little-galaxy/web test`: 112 passed, 2 opt-in skipped; 22 files passed, 2 skipped.
- `node tests/prototype/physics.mjs`: all 30 checks passed, with the contact oracle enabled throughout.
- `pnpm --filter @little-galaxy/web run lint`: passed.

Eight selected pre-fix assertions failed on frozen abcb9fa; all 15 math/review/reference tests
pass after the fixes. The direct sparse-contact regression observed 9,900 position reads in
the old all-pairs path, exceeding its 1,000-read ceiling. Kernel regeneration was repeated after
all checks and matches the pin above. Available memory never fell below 1,409.2 MiB across
all guarded runs. The installed exact pnpm 11.5.2 entry point was used through an ignored local
shim because the global shim attempted to write a package-manager database outside the sandbox.

Production fixes are in the inherited `e117934` WIP commit. `b3f1291` (alpha.9.14) restores the
omitted deterministic module and independent tests; `e36fe94` (alpha.9.15) commits the isolated
benchmark, reduced replay lifetime and contact-cost regression. The final report is committed
separately. All commits use the operator's author identity. Nothing was pushed or deployed.
No preview/real-phone or V8/JavaScriptCore/SpiderMonkey comparison has been performed; local
arithmetic construction and empirical V8 accuracy do not replace those deployment checks.

## Hito A integration — 2026-10-26

A1's friction-free home routing and A2's deterministic hybrid simulation are combined with A4's
checks and releases. The kernel fingerprint was recomputed using the current allowlisted simulation
files in `scripts/sync-prototype.mjs` order, then the named replay/home/name integration files and
shared names source, following that script's SHA-256 recipe. The A2-only identity
`proto3-a7309c9242d1a8d6a8308f9201860dae09b78ee7992a7e6af9f95c59ef2eceed` reproduces exactly before integration; A1's changed
`homes.js` makes the integrated identity `proto3-1abd3a0c4e19d4217695088203b6bb16a8793c13261fd3d1dc798d2581989f37`.
The frozen fair galaxy must retain its historical kernel identity; the generation migration
requirements above still apply. No physics or admission behavior was changed by integration.
