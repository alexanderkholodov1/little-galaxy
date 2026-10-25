# SIM-DECISIONS — what I took from the physics note, what I changed, and why

Input: `spec/galaxy-sim-design.md` (the note, 2026-10-24) and the operator's override **R25** in
`spec/r3-operator-review.md`. The note is input, not a decision; R25 is a decision. Code: `js/sim/**` (DOM-free,
runs the same in Node), wired into `js/world.js`. Tests: `node tools/physics-test.mjs` (30 checks).

## The model in one paragraph

Compact bodies (the Campfire, stars, binaries, pulsars, black holes) anchor **systems**. Their mutual gravity is
always integrated: fixed-step kick-drift-kick leapfrog, h = 1/120 s, Plummer ε = 0.2, plus a conservative
logarithmic galaxy halo. Every other body is a test particle in one of three modes. **rail**: an exact Kepler orbit
about its system, propagated with universal variables, i.e. exactly the orbit the launch created, however eccentric
or long (R25). **active**: integrated for an encounter window after an impact or a close pass by another system's
compact body, then re-railed with whatever orbit the encounter left. **drift**: unbound from every system, so it is
integrated with the halo, which brings it back, until it arrives bound somewhere (capture) or a nebula slows it
(assist). Topology (binaries, new systems), rails, contacts and captures run on a galaxy tick of 4 steps (H = 1/30
s). Everything is ordered by id. A JSON snapshot restored into a fresh Sim replays to the same hash.

## Point by point

| Note | Decision | Why |
|---|---|---|
| G = 15, star mass 1, h = 1/120, KDK leapfrog, fixed pair order, no dropped ticks | **Accepted** (`rules.js`, `integrator.js`). The 8-substep cap per frame remains: a long stall loses screen time, never changes h | Matches M2. Measured energy drift 1.7e-5 over 1,000 orbits of a mass-1 star (e = 0.5) |
| Galaxy level H = 1/30 for topology decisions | **Accepted**: `GALAXY_EVERY = 4` | Same idea, one place |
| Softening by pair category (0.2 stellar, 0.01 ordinary, 0.8 nebula, 16 galaxy) | **Changed**: only ε = 0.2, because only compact bodies exert gravity | Light bodies are test particles (below), so there are no ordinary–ordinary or nebula-source pairs. A galaxy-level ε = 16 would create an energy jump at the hand-off between levels |
| All nonzero masses participate reciprocally (giants 0.01, planets 0.001…) | **Changed**: light bodies are test particles, with their masses kept for impact momentum and budgets | R25: a quiet orbit must not drift from secular nudges by its neighbours. That is also the note's own quiet regime ("quiet systems do not accumulate fresh secular perturbations") |
| Masses table (star 1, binary 2, pulsar 1.4, black hole 2, giant 0.01 … asteroid/comet 1e-6, nebula 1e-4) | **Accepted** (`TYPE_RULES`). The `binary` workshop type is **one** mass-2 body (an unresolved compact pair) for now | Two real components need a second design slot and a pair renderer; the mass and budget (2 slots) are already right, so the split can come later without changing any rule |
| Collision cores (planet 0.035, etc.) | **Changed**: contact radii stay at the prototype's visual scale (planet 0.35, comet 0.2 …) | With 0.035 cores, R12 impacts would almost never happen at this zoom. Impacts are gentle bounces, so a generous radius is safe |
| 8 s encounter window, then analytic paths | **Accepted** (`WINDOW = 8`) for impacts, close passes and a compact launch (which wakes its whole system for 8 s) | Same intent. A light launch goes straight onto rails when bound: that is the launch's exact orbit, with zero integration error |
| Settling to Kepler elements with eccentricity caps 0.65 / 0.90 and lane settling | **Rejected (R25)**. No caps, no settling, no lanes. Launches with e = 0.97 and 0.995 stay exactly that (test 10: \|Δa/a\| 1.5e-14, \|Δe\| 3e-16 after 3 h) | Operator: "la órbita que se creó cuando fue lanzado, no importa que tan elíptica o larga" |
| Bounded Kepler solver | **Accepted, robust version**: universal variables with Stumpff functions, Laguerre iteration with a fixed count, bisection fallback (the universal equation is monotone), and the same modulo-period reduction every time | Handles ellipses, parabolas and hyperbolas. e = 0.995 returns to its start within 2e-9·a after 1,000 periods |
| e ≥ 1 → leaving | **Accepted (R25)**: e ≥ 1 relative to every system means `drift` mode | "e >= 1 leaves the system into the drift and capture rules" |
| Far travellers: outer-nebula rescue, return in 3–10 min | **Changed**: the rescue is the conservative logarithmic halo from M2 (no force inside r0 = 22). Return times follow from the throw (a hard throw returns in ~50–70 s); there is no time cap | A conservative potential needs no energy ledger and changes no orbit by fiat. The dotted preview shows the real loop |
| Only comets / icy asteroids grow comas; stars, binaries, pulsars and black holes never become comets | **Accepted, as R8 already does**: comet, asteroid and meteor may become comets; everything else returns as itself | The operator accepted asteroids returning as comets in round 2; a dry/icy asteroid choice can come with the surfaces work (R19) |
| Hill-region hosts with 0.4/0.6 hysteresis, held 1 s | **Simplified**: a body's host is the system it is most bound to (most negative two-body energy). A traveller is captured only inside R_FAR = 19 of a system, bound for 1 s in a row. A rail may not reach farther than 0.45 × the distance to the next system (else it stays integrated) | Moons around planets are not in this run (their Hill orbits, 0.08–0.3 units, are below the visual scale of a planet). The 1 s hold is the note's |
| Capture needs an energy account; nebula assist with a cap | **Accepted**: pure two-body flybys stay unbound (test 13a). A three-body exchange binds naturally (13c: 9 of 48 travellers end up orbiting a second system). A nebula passed within 2.2 radii near a system removes only the energy needed for a slightly bound orbit, at most 1.6 per unit mass, once per nebula per 30 s, with the removed energy on `sim.assistEnergy` (13b) | Visible and bounded, as the note asks |
| Binary: compact semimajor axis 1.8–2.5, e ≤ 0.1, planets outside 4a | **Changed (R25)**: two compacts are a binary when bound with apoapsis ≤ 19 (the visible edge), with hysteresis to 24. Their orbit is the one the throw made. The other bodies orbit the pair's barycentre with the total mass (circumbinary, the note's aggregate) | Forcing 1.8–2.5 would be a settling assist. The trade-off (planets inside a wide pair would really be chaotic) is handled by the quiet regime: a rail is not perturbed by its own system's compacts; only a visible graze of one's guard changes its orbit (a puff) |
| Fast star founds a new system; systems balance about the galaxy COM | **Accepted**: an unpaired compact more than 38 units from every other system founds its own (event `system`). The frame is the compacts' centre of mass. It is recentred only when a compact enters or leaves (event `reframe`), and the camera absorbs the shift in about 1 s | Recentring every step is non-conservative with an origin-centred halo (my first try failed the energy test with 0.73). At an event it is a frame change, as the note says |
| Black hole: Newtonian, mass 2, sling, safety core | **Accepted**: no multiplier. A moving hole slings passers (test 14: 17 slings, Campfire speed 1.6, nothing lost, no comet). Its guard contact is an "accretion" puff onto a long safe orbit. Two compacts never pass closer than 2.4: they bounce elastically (`kiss`), which conserves energy and momentum (the stellar encounter conserves energy to 1e-4) | — |
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

## Feel pass (2026-10-25): wide pairs, returning systems and the kiss chain

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
- Feel: the note's main uncertainty is still open. How often a wide pair or a passing system reshuffles a
  neighbourhood needs the operator's 30-minute play.
