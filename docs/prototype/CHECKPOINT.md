# CHECKPOINT — round 2 (opus)

## 2026-10-24
- [x] Read DESIGN-DOCTRINE.md, 01-product-spec.md, PROMPT.md (round 1), and all of prototype C (index.html, css/style.css, js/main.js, js/galaxy.js).
- [x] IDENTITY.md written: "Fogata". Brasa #FF8A5B, Lavanda #A99BFF, Crema #FFF1DE on Ciruela #150E24; Unbounded + Figtree; motion and sound rules.
- Plan:
  - One WebGL renderer, one scene: the galaxy, the workshop bench (floating in front of the galaxy) and the launch pad all live in the same world. Transitions are camera flights.
  - Real physics: a leapfrog integrator with a fixed step. Gravity comes from the central star plus the massive bodies (stars, giants, binaries). Too-fast launches escape and are turned back as comets; too-slow launches are blown back out by the star.
  - Custom camera rig: drag to orbit, pinch or wheel to zoom, damping, idle drift. Tapping a body focuses it.
  - Workshop types: planet, ringed gas giant, star, binary star, moon, comet, nebula.
  - Audio: C's pentatonic notes are kept, plus a generated reverb, kalimba, bell, pad, noise, generative music and a music-box rotation.
  - The portfolio view and the operator-links sheet are removed. Only a tiny "Créditos" card remains.
- [x] build: index.html, css/style.css, js/{main,world,bodies,physics,audio,glass}.js (the captain saw home and workshop working)
- [ ] verify in Chromium  - [ ] shots  - [ ] NOTES.md

## 2026-10-24 (resume after the memory stop)
Re-read everything. What I found:
- The aurora renders as a white smoke blob: point sprites are too big and additive white saturates. It must read as coloured 3D particles flowing through the disc.
- Home reads mostly orange-on-plum. Lavanda is underused, and there is no third hue.
- Planet surface: only palette, clouds and rings. The spec asks for ocean↔desert, mountains, clouds, rings and atmosphere colour.
- Launch never played. tools/run.sh breaks the new memory rule (background server outside the wrapper, nested flock).

Resume plan (operator's notes on the other team apply to us):
- [x] tools: play.cjs starts its own http.server child, runs the browser and stops both; always run as `with-browser.sh node tools/play.cjs ...`; delete run.sh/smoke.cjs/zoom.cjs
- [x] palette: third distinct hue, **Menta #7FE0C4** ("what comes back / free play / the aurora crown"); lavanda used for real on secondary chrome; IDENTITY.md amended
- [x] surfaces: planet gets Agua (ocean↔desert), Montañas (real relief: vertex displacement + bump normals), Hielo, Nubes amount, a re-roll terrain dice; giant gets Bandas + Remolinos; moon gets Mares; controls split into Forma / Superficie on phone
- [x] more things to launch: new workshop types Asteroide, Púlsar, Agujero negro; a "Lanzar por lanzar" toss mode (comet / asteroid / meteor shower) straight to the pad, with no workshop, ephemeral, repeatable
- [x] softer motion: lower camera damping, longer inertia, smoother flights, jelly squash, smoothed workshop spin
- [x] aurora rebuilt: 3 ribbons of small coloured particles (brasa base → menta body → lavanda crown) streaming along 3D paths that weave through the disc
- [ ] verify the whole loop at 390x844 and 1440x900, with zero console errors; shots
- [ ] NOTES.md

Progress notes (same day):
- Baseline run, before any changes: the launch loop already worked (orbit / escape→comet / fall→puff). The only console output is SwiftShader's "GPU stall due to ReadPixels" warning, which comes from screenshot readback; play.cjs now counts it separately.
- Relief: the first try used screen-space derivatives on a displaced mesh and gave blocky shading in two ways: (a) the high-frequency ridges crumpled the mesh, (b) dFdx gives 2x2 blocks. Fix: vertices take only a low-frequency height (heightLow), and the fragment uses 3-tap finite differences on the sphere. Smooth now. Galaxy-size bodies (LOD low) skip the bump.
- Ocean: water was the palette's deep colour (wine). Each planet palette now has its own water tone (violet or teal).
- Aurora: tiny soft points were invisible (about 2% alpha). Now there are solid-core points, ray columns that travel along the ribbon, and a near-vertical curtain.
- Desktop: the Superficie group was hidden by CSS specificity; fixed. Types grid is 4 columns; the bench camera is pulled back.
- Next: desktop launch+toss session, final phone full session, IDENTITY amendment, NOTES.md.

# CHECKPOINT — round 3 (opus, lead)

## 2026-10-24 (planning run, no code)
- [x] Copied proto2/opus → proto3 (without shots/ and shots-captain/, 91 MB; they stay in proto2/opus)
- [x] WORKPLAN.md: ownership table, window W0, my steps M1-M7, helper table, what waits for the physics note
- [x] tasks/: i18n-copy, music, player-ui, labels, palette, admin (reports go to tasks/out/)
- [x] M1 edge of space · [x] M2 sim core · [ ] M3 launch from view · [ ] M4 note-driven physics · [ ] M5 integration · [ ] M6 final look

## 2026-10-24 (round 3, essential work part 1: M1 + M2)
- [x] M2 sim core in `js/sim/` (rules, rng, bus, integrator, kepler, predict, core, index); `js/physics.js` is now a re-export shim with the same exports (main.js untouched, W0)
  - KDK leapfrog, DT 1/120, Plummer ε 0.2; the Fogón is a body (mass 1); barycentric recentre every step; seeded RNG; snapshot/restore (reuses body objects by id); FNV-1a state hash; event bus
  - TYPE_RULES (mass, radius, attracts, canComet, impact) in `js/sim/rules.js`
  - R8: the fake turn-back guard is gone. A logarithmic halo (zero force inside r0 = 22, rc 14, v 2.0) binds everything; escapers turn at their apoapsis and come back. Only comet/asteroid/meteor become comets (event `comet`); everything else emits `return` and stays itself. A hard launch (3.15) turns at r ≈ 49 after ~28 s and is home at ~51 s
  - contacts: radius-sum test, one `impact` event per contact (base for R12)
- [x] `node tools/physics-test.mjs`: 13/13 PASS (energy drift 8.3e-6 over 1,000 orbits; Kepler period error 0.215%; same seed → same hash; snapshot/restore → same hash; star and black hole come back without comet; halo energy drift 1.1e-6; asteroid and meteor do become comets; one impact per contact; predict orbit/escape/fall)
- [x] M2 wiring in `world.js`: sim built with a seed; entries pass type/meteor/toy/launch group; masses only in TYPE_RULES (removed from bodies.js TYPE_INFO); the fire mesh follows the Fogón body; `return` gets a cream sparkle; `impact` gets a placeholder sparkle and squash; shower pieces don't collide with each other
- [x] M1 edge of space (`world.js`): the 700-unit textured BackSide sphere is gone. The sky colour and a tilted dust band (3D fbm, dark lane, warm↔cool along its length, no vertical gradient) are painted once into a 512 cubemap by view direction and sampled by a fullscreen triangle with triangular dither: no surface, seam, pole or banding. Four star layers (R 900/520/300/170) follow the camera with parallax 0/0.02/0.07/0.18 and distance-scaled point size; uniform on the sphere with extra density near the band. Nine faint far-galaxy sprites at infinity. `paintSky(colors)` repaints for M6. The workshop bench decoration now fades in only near the bench (from far away it floated in space)
- [x] tools/play.cjs: `sky` phase (closest, farthest, pole, pole-far, plane, plane-far via `world.debugCam`); the hard launch now checks R8 (escape → return, comet=false) and leaves by #lpBack, since main.js shows no result card for `return` until M3
- Browser session 1 (phone, full loop, 10 min): loop works; far launch `escape@92.2 return@112.7 · comet=false · type=planet`; sky shots show no dome, grid, seam or horizon. 1 page error, not mine: `main.js:224 function ago(t)` shadows the i18n `t()` (i18n-copy, W0) → TypeError when a body's card opens. The desktop half was cut by the wrapper's 10-minute limit
- Fixes after session 1: the bench decoration fades in only within ~36 units of the bench; the dust band is a little stronger
- Browser session 2 (desktop, phases home,sky,launch,toss): waited ~4 min for the lock behind the helpers' runs, then stopped by the 10-minute limit while it waited for the far planet's return. Shots up to `desktop-15-escape-f3` are good: home, all six sky angles (bench gone, band and dust lane visible, no dome, grid or horizon), launch → "In orbit" result card. Desktop console totals were not printed (the run was killed), so desktop zero-errors is NOT verified
- Note: a full `play.cjs phone,desktop` no longer fits the wrapper's 600 s; run one size per session from now on
- [ ] M3 needs: the `return` result card and new copy in main.js (after W0)

## 2026-10-25 (round 3, essential work part 2: M3 + M4 + M5 start)
- [x] W0 closed (tasks/out/i18n-status.md). player-ui: no `tasks/out/player-ui.md` yet → not wired (next run).
- [x] **M3 launch from the player's view (R6)** in `world.js` + `main.js`: no fixed PAD; launch point = plane point under screen (0.5, 0.64) of the player's own view (clamped 3.4–30 from the dominant system), marked by the ring; bench→launch is a straight glide synced with the camera (the arc "placing" hop is retired, its easing kept for the camera); camera returns to the last galaxy view; home↔launch keep the camera; pull from the body or anywhere in the lower 55%; direction = −pull in the camera's flattened right/forward basis (any in-plane direction, flat orbits); v = 6.5·s/(1+s), s = pull/(0.45·short side) — no hard stop, zoom-independent; wheel = fine strength while aiming; host velocity added; preview ≤ ~14/s; dotted path state colours (orbit crema→lavanda, escape brasa, fall lavanda, long menta); camera keeps the launched body in frame 2 s (zoom-out capped ×1.45). Test hooks `world.pullFor`, `world.launchInfo`.
- [x] **M4 growing galaxy (R5, R7, R9, R12, R25)** — `SIM-DECISIONS.md` has every accept/change/reject. `js/sim/`: rules (note masses, budgets, effects), kepler (universal variables, Laguerre + bisection; arc-length orbit sampling), core (compacts always N-body; light bodies rail/active/drift; binaries ≤ apoapsis 19; new system beyond 38; capture inside 19 held 1 s; nebula assist with ledger; guards/puffs; elastic `kiss` between compacts; gentle bounces with per-type effects; sling detection; `reframe` at compact add/remove), admission (player/system/galaxy budgets, 10-min hole gap; prototype has no 3-slot limit, `?sandbox` lifts heavy limits), predict (exact ellipse for rails, probes for fall/escape, compact preview with own mass). World: entries split from sim bodies, admission at release (draft kept, `launch-denied`), no eviction, camera absorbs `reframe`, per-type impact sparks + `audio.impact`, map widens with founded systems, systems chooser chips on home (`#sysRow`), dust/embers follow the Campfire, `world.serialize/loadGalaxy`. Demo seeds: light bodies only (one system to start).
- [x] Persistence behind `js/store.js` (one small async interface: galaxyId, owner(), load(), save(state), legacy()); key `fogata.galaxy.v2:<id>`; migrates `fogata.sky.v1` once; state carries the sim snapshot incl. ledger and accepted-action log. GalaxyStore swap = this one file.
- [x] **M5 start**: i18n wired (core + my catalog `js/strings/galaxy.js`, registered after core; it overrides `launch.aim.title/stats` for the new pull).
- [x] Tests: `node tools/physics-test.mjs` → **30/30 PASS** (13 M2 + 17 M4: R25 ×4, binary star + hole, new system, capture ×3, sling + conservation, spam ×3, contact matrix, persistence).
- [x] Browser (wrapper, one size per session): phone home,launch,toss → loop ok up to the fall (test pull under the dead zone; fixed); phone galaxy,toss → **0 errors** (star founds system @28 s, chooser, second star refused, hole as wide pair, save 11 entries/2 actions); desktop launch,toss → **0 errors** (orbit, long e 0.85 on rails, fall; the desktop "escape" hit a giant and was puffed — real impact). SwiftShader runs ~3–11 fps so sim time runs at ≈½ real time in these runs.
- [x] Browser desktop galaxy → **0 errors**: star founds system @24.7 s (6 slings, 4 captures along the way), chooser on desktop at left under the brand, second star refused (`stellar-player`), the hole binds as a binary with the Campfire (e 0.37); a minute later that wide binary had come apart and the hole wanders between the two systems. That is real dynamics, and it is the feel risk named in SIM-DECISIONS.
- No process of mine left running (the only live processes are the helpers' opencode runs).
- **Next run:** (1) wire player-ui when `tasks/out/player-ui.md` says DONE (name screen before the first launch → `world.pendingName`/owner label; prefs → music/sfx/lang/motion/names), then labels (R3), music (R10), admin (R13/R14 against the `js/store.js` interface); (2) feel pass on the real loop: how often wide pairs/passing systems reshuffle neighbourhoods (consider making a compact launch's preview warn when its periapsis crosses the planet zone); (3) M4 leftovers in SIM-DECISIONS "Known gaps" (wall-clock catch-up, moons around planets, real two-component binary, aggregates, nursery); (4) M6 palette + final verification.

## 2026-10-25 (round 3, essential work part 3: M5 integration + M6) — fair day
- Helpers at start: labels DONE, music DONE, i18n done; player-ui stalled (no report, I own its files now); palette and admin not reported.
- [x] **M5 music (R10)**: `audio.js` delegates to `js/music.js` (5 pieces, fixed scheduler). The hide→suspend policy is gone (resume on show + engine re-anchor); music bus at unity; `setMusicVolume`/`setSfxVolume`/`nextPiece`; old CHORDS/timer section deleted.
- [x] **M5 player-ui review + wiring (R4, R16)**: fixed `prefs.js` chip crash (`self.r()` on a function → every chip click threw); panel re-reads storage on open/`refresh()` (top music button no longer leaves it stale); titles/versions say Little Galaxy; quality hint now matches what it does (pixels). Name screen opens on the first "Llevarlo a lanzar" (toss stays instant, its toys carry no name); "Ahora no" keeps the workshop. Settings button (gear) replaces the sounds toggle in the top bar; sounds live in settings.
- [x] Prefs applied live: lang (setLang), music on/vol, sounds on/vol, names (labels.setMode), motion (`world.setMotion` + `html[data-motion]`, CSS calm rule), quality (`world.setQuality`: low 1×, auto 1.75× adaptive, high 2× fixed).
- [x] **M5 labels (R3)**: `#nameLayer` overlay; `world.labelItems()`; entries carry `maker {name, anon}` (persisted in serialize; seeds have demo visitor names, two anonymous); focus card says "Lo lanzó {name}"; mouse hover / touch contact feed `labels.setPointer`.
- [x] `js/store.js` reshaped toward GalaxyStore: `loadGalaxy()→{galaxy, player, state}`, `setName(id, '')`=anonymous, `launch(id, intent)`, `save`, `legacy`, `touch`.
- [x] Phone smoke (wrapper, no shots): name, not-now, named + anonymous launches, labels, prefs + reload persistence, toss → **0 errors**.
- [x] **M5 admin wiring (R13, R14)** (admin report DONE at ~06:00Z): `js/store.js` follows the admin selection (`fogata.galaxies.v1`: activePublicGalaxyId, `?booth` → boothGalaxyId, `?galaxy=<id>` explicit) and the manifest status; `save()` refuses frozen/archived. main.js: `metric()` wraps `track()` — `visit` (boot + back to foreground), `player_new` (first name/anon choice), `launch` (accepted, with type), `toss` (with kind), `session_ping` (5 min, visible only), `flush()` on hidden/pagehide. Frozen/archived galaxy: create/toss hidden, a glass note, no saves, no legacy migration. Known gap: admin clear/delete act on the legacy arrays `fogata.sky.v1:<id>`, not on the v2 state (the Firestore swap replaces both); in the prototype "start from zero" = new galaxy + set active.
- [x] **Feel pass** (`tools/feel-wide-binary.mjs`): the founded star rides the halo back through the middle every ~6–8 min; that pass broke the wide Campfire–hole pair and two bound compacts then **kiss-chained** (~60 elastic bounces, one every 2 s, each with storm sound). Fix: bound compact pairs kiss softly (`SNUGGLE` 0.35, energy on `sim.snuggleEnergy`), slow grazes (< `KISS_QUIET`) silent, snuggle sounds as sparkle. After: pair holds 20 min, 19 host changes/20 min (was 32/10 min). Physics 30/30. Recorded in SIM-DECISIONS "Feel pass".

## 2026-10-25 (round 3, part 4: M6 final look, verification, NOTES.md)
- [x] **M6 palette (R2)** at 08:15Z: option A's roles, with a dark-ink ground in place of the warm black that all three options shared. Brasa + **Celeste #56CCF2** (others, look, atardecer far end); menta kept (play); lavanda only as an accent (focus, the fall state, assist sparks, Rosa/Atardecer palettes); ground **Tinta #0D1018 / #182030**; sky band brasa → miel #F4A261 → celeste. Applied in `css/style.css` (vars + new `--celeste*`, all lavender rgba → celeste), `css/player-ui.css`, `css/admin.css`, icons in `index.html`/`admin.html`, `world.js` (sky, stars, dust, fire corona, bench, trails, aurora crown, others' colour, sparks), `bodies.js` (night ambient, rim, 4 lavender palettes → celeste), palette names in `strings/core.js`. Why: A's roles fit the brief. C drops menta for honey, which loses the third distinct hue. The warm-black grounds read sepia/muddy in agy's own shots, and the helper's "88–98% warm" is mostly that near-black ground counted as orange. IDENTITY.md Amendment 2. Title already "Little Galaxy" in index/admin/titles; the style.css header comment fixed.
- [x] Planet water: Durazno and Menta oceans were violet → deep celeste blue (`#235a86`, `#1f5f86`); Rosa keeps its violet as an accent.
- [x] `tools/play.cjs` admin phase now also opens `admin.html` in a second page (console listeners, title, shot `38-admin`).
- [x] **Verification 1/2, phone 390×844** (`play.cjs phone home,name,anon,prefs,toss,admin`): **0 errors**; named launch (label "Alexa", focus "You threw it 7 s ago"), anonymous launch (maker anon), prefs live + persisted after reload (lang, names, motion reduce, quality low, music off, sfx 0.35), metrics recorded, frozen galaxy hides create/toss and skips the save, admin.html title "Little Galaxy · Admin", toss comet/asteroid/shower. Shots: phone-01-home, -30-name-screen, -32-named-label, -35-prefs-open, -37-frozen, -38-admin, -20-toss-after.
- [x] `node tools/physics-test.mjs` → **30/30 PASS** after the palette change.
- [x] **Verification 2/2, desktop 1440×900** (`play.cjs desktop home,galaxy,admin`): **0 errors**; named first launch; star founds its own system @25.0 s (chooser: Campfire 6 · Luciérnaga Dormida 3), second star refused (launch-denied), hole → wide pair e 0.50, save 11 entries/2 actions, metrics, frozen in English, admin.html opens. Shots: desktop-01-home, -23-home-two-systems, -38-admin. **10 new shots in total.** No process left.
- Not verified this run: reduced motion as a separate run (only via prefs motion=reduce on phone), a full English+Spanish pass of every screen, the 30-minute music soak (M6 asked for it; no time window).
- [x] **NOTES.md** written: R1–R27 table (done 16 · done locally/in prototype incl. gaps · partly R13 R19 R24 R27 · not R17 R18 R20 R22 R23) + packaging notes (entry points, URL flags, globals/hooks, CDN imports, assets, store.js→GalaxyStore deltas, track() calls, frozen behaviour, do-not-change list).
- **Next:** packager (Codex) syncs. Open items for later: admin clear/delete on v2 state, a separate reduced-motion + EN/ES visual pass, a 30-min soak in the real loop, R19 biomes, R20 timelapse, SIM known gaps.
