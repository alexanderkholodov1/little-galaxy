# NOTES — round 3, "Little Galaxy" prototype (proto3)

For the operator and for the packager. The history is in `CHECKPOINT.md`, the physics decisions are in
`SIM-DECISIONS.md` and the identity is in `IDENTITY.md`. Status as of 2026-10-25 ~08:30Z.

**Last verification (2026-10-25, after the M6 palette):**
- `node tools/physics-test.mjs`: **30/30 PASS**.
- Browser, through `with-browser.sh`, one size per session:
  - Phone 390×844 (`play.cjs phone home,name,anon,prefs,toss,admin`): **0 console errors**.
  - Desktop 1440×900 (`play.cjs desktop home,galaxy,admin`): **0 console errors**.
- Shots: `shots/phone-{01-home,30-name-screen,32-named-label,35-prefs-open,37-frozen,38-admin,20-toss-after}.png`,
  `shots/desktop-{01-home,23-home-two-systems,38-admin}.png`.
- SwiftShader runs at 10–18 fps, so in these runs sim time is about half of real time.

## R1–R27, one by one

| R | Status | Where | Evidence |
|---|---|---|---|
| R1 no dome/grid at the edge of space | **done** | `world.js` sky: cubemap painted by view direction + fullscreen triangle; 4 parallax star layers; far galaxies | sky phase shots (6 angles, round 3 session 1): no dome, seam, pole or horizon |
| R2 less purple, warm gradients, celeste | **done** | `css/style.css` vars (`--celeste*`, ground Tinta `#0D1018`), `player-ui.css`, `admin.css`, icons, `world.js`, `bodies.js`; IDENTITY.md Amendment 2 | shots 01-home phone/desktop; lavanda left only as an accent (focus, fall state, assist sparks, Rosa/Atardecer palettes). Not measured with a histogram |
| R3 faint launcher name, stronger on hover, phone equivalent | **done** | `js/ui/labels.js`, `css/labels.css`, `#nameLayer`, `world.labelItems()` | phone: labels at 0.2–0.3, the touched/own one at 0.95; desktop hover shot from the previous run |
| R4 name screen before the first launch, anonymous option | **done** | `js/ui/player.js`, `css/player-ui.css`; opens on the first "take it to launch"; toss stays instant | phone run: named launch ("Alexa"), then anonymous (`maker {anon:true}`) |
| R5 growing galaxy | **done in the prototype**, with gaps | `js/sim/core.js` (captures, binaries ≤ apoapsis 19, new system beyond 38, barycentric recentre), map widens, `#sysRow` chooser | desktop: star founds a system @25 s, chooser shows 2 fires; tests "new system", "capture ×3". Gaps (SIM-DECISIONS "Known gaps"): wall-clock catch-up, moons around planets, real two-component binary, nursery |
| R6 launch from the player's view, any direction/strength, dotted prediction, in-plane | **done** | `world.js` launch point under the view, pull→velocity, `js/sim/predict.js` | phone/desktop launches; state-coloured dotted path |
| R7 per-type interactions, playful, spam-guarded | **done** | `js/sim/rules.js` effects, slings, `js/sim/admission.js` budgets | tests: contact matrix, sling + conservation, spam ×3; desktop: second star refused |
| R8 only comet-likes return as comets | **done** | logarithmic halo in `js/sim/core.js` | tests: star/hole come back without a comet; asteroid/meteor become comets |
| R9 real orbital mechanics, gentle | **done** | KDK leapfrog DT 1/120, universal-variable Kepler (`js/sim/kepler.js`) | energy drift 8.3e-6 / 1,000 orbits; Kepler period error 0.215% |
| R10 music never runs out | **done** (helper) | `js/music.js` (5 pieces), `audio.js` delegates | music report: 35-min composition test (no repeated four-bar window), 50 simulated min, real soak 29.3 score min. My own 30-min soak: **not run** |
| R11 title "Little Galaxy" | **done** | `<title>`, brand, admin, strings | both runs: "Little Galaxy", "Little Galaxy · Admin" |
| R12 comet/asteroid impacts by type | **done** | `rules.js` effects, `world.js` sparks + `audio.impact` | test "contact matrix" (frost, crater, storm, squash, pass) |
| R13 admin: delete bodies, separate galaxies, backups, confirmations | **partly** | `admin.html`, `js/admin/*` (local only) | admin report PASS; frozen galaxy verified in the game. Gap: clear/delete act on the legacy arrays `fogata.sky.v1:<id>`, not on the v2 state the game now saves; no Firestore |
| R14 admin dashboard metrics | **done locally** | `js/metrics.js` + admin metrics tab | runs: visits/launches/tosses/members recorded |
| R15 "Créditos" → "Autor" | **done** | strings | home shot: "Author" / "Autor" |
| R16 Spanish + English, basic preferences | **done** | `js/i18n.js`, `js/strings/*`, `js/ui/prefs.js` | phone: lang, names, motion, quality, music, sfx applied live and persisted after reload. A full screen-by-screen EN/ES pass was **not repeated** in this run |
| R17 path /little-galaxy + redirect /galaxy | **not** | deployment, packager | — |
| R18 admin sign-in with Google | **not** | demo SHA-256 passphrase only (`js/admin/config.js`): **not security** | — |
| R19 surfaces for everyone (trees, cities, desert, volcanoes…) | **partly** | `bodies.js`: ocean↔desert, mountains (real relief), ice, clouds; giant bands/swirls; moon maria | no trees, cities or volcanoes |
| R20 timelapse of a frozen galaxy | **not** | — | the action log in the snapshot is the base for it |
| R21 admin player list | **done locally** | admin metrics tab: name, first/last seen, active (5 min), launches | admin report |
| R22 destructive mode for signed-in players | **not** | only `mode:'gentle'` in the manifest | — |
| R23 one account shared with the portfolio | **not** | — | — |
| R24 owner/members/settings per galaxy | **partly** | manifest fields (owner, mode, visibility, writePolicy) in `js/admin/local-store.js`; no player UI | — |
| R25 a body keeps the orbit its launch created | **done** | no eccentricity caps, no settling; rails on exact Kepler | tests R25 ×4; long orbit e 0.85 kept |
| R26 operator chooses the booth galaxy | **done locally** | admin "booth" selection → `fogata.galaxies.v1.boothGalaxyId`; game `?booth` | admin report; `js/store.js` |
| R27 limits: galaxies per account, size per galaxy | **partly** | per-galaxy/player budgets in `admission.js`; 3-galaxy local cap in admin | no per-account limit (no accounts) |

Not verified in this run: a separate reduced-motion run (only through prefs on the phone), a full EN/ES visual pass, and
a 30-minute music soak of my own.

## Packaging notes

**Entry points.** `index.html` (game) and `admin.html` (admin; not linked from the game). Both are static ES modules
with no build step. The game boot is `js/main.js`; the admin boot is `js/admin/app.js`. `tools/`, `explore/`, `tasks/`,
`ref/`, `shots/` and the `.md` files are not part of the app.

**URL flags.** `?galaxy=<id>` (explicit galaxy), `?booth` (booth selection), `?lang=es|en`, `?debug` (fps overlay,
`setupDebug` in main.js), `?sandbox` (lifts the heavy-body budgets; **must not ship**, or must be admin-only).

**Globals and test hooks to strip or gate.**
- `window.__fog = {world, S, audio, labels, prefs, store}`, `window.__FOG_OK`, `window.__FOG_T` (main.js).
- `window.__FOG_FAIL` (the inline loader in index.html shows the load-error veil; keep it, it is the user-facing
  fallback).
- In `world.js`: `debugCam`, `pullFor`, `launchInfo`, `aimState`, `lastLaunched`. They are harmless, but they are test
  surface.
- The `?debug` overlay.
- `tools/play.cjs` and `tools/feel-wide-binary.mjs` depend on these hooks, so keep a test build that has them.

**CDN imports to replace.**
- `three@0.170.0` from jsDelivr through the import map in `index.html` → the npm dependency.
- The fonts `@fontsource-variable/unbounded@5.2.5` and `figtree@5.2.5` (CSS from jsDelivr; index uses `index.min.css`,
  admin uses `index.css`) → the npm packages.
- No other network use, and no audio or image files: all textures and sound are procedural.

**Assets.** Inline SVG symbols and the favicon data URI are in `index.html`. Nothing else.

**`js/store.js` → GalaxyStore** (`Fauns/wt/galaxy-alpha2/docs/galaxy-store.md`). This is the only file that touches
game storage. Its shape already follows GalaxyStore: `loadGalaxy()→{galaxy, player, state}`, `setName(id, '')` =
anonymous, `launch(id, intent)`, `save`, `touch`, `owner()` (= memberId), `galaxyId`, plus `legacy()` for the one-time
`fogata.sky.v1` migration. Differences the adapter must bridge:
- Units: GalaxyStore wants `origin`/`velocity` as integer **millionths** in x–z, |v| ≤ 8 u/s, and a 120 Hz
  `effectiveTick` 0.5–3 s after server time. The prototype passes floats (world units).
  - The sim already steps at DT 1/120.
  - The launch speed is ≤ 6.5 u/s plus the host's velocity. Check the sum against the 8 u/s bound.
- Masses match the store's table exactly (`TYPE_RULES[*].micro` in `js/sim/rules.js`).
- Admission: the prototype admits locally with `js/sim/admission.js` **before** `store.launch`. In the real app the
  transaction is the authority. Keep the draft on rejection; main.js already keeps the workshop draft on
  `launch-denied`.
- Names: GalaxyStore allows 24 code points; the name screen limits to 2–20 (`js/ui/player.js` MIN/MAX).
- `save(state)` is a local cache; in the real app the action log is the authority (`state.sim` carries the accepted
  action log and the ledger).
- B1 has no kernel or Kepler solver: the packager must pin `js/sim/*` as the kernel (DOM-free on purpose) and replay
  accepted intents with it.
- `touch()` should write at most every 5 min, foreground only (main.js already pings only when visible).
- Subscribe/stop on `visibilitychange`.

**`track()` calls** (`main.js` `metric()` wraps `js/metrics.js` `track`, which writes `fogata.metrics.v1` in
localStorage):
- `visit` at boot and when the page comes back to the foreground.
- `player_new` on the first name or anonymous choice.
- `launch` (accepted, `{type}`).
- `toss` (`{kind}`).
- `session_ping` every 5 min while visible.
- `flush()` on hidden/pagehide.

Every event carries `{galaxyId, memberId, displayName}`. B1 has no visit/session tracker, so these need a transport of
their own (or they get dropped). No IP, device or email is collected.

**Frozen galaxy.** Status `frozen`/`archived` (manifest) → `S.frozen`:
- create and toss buttons hidden;
- a glass note ("… está congelada: se puede mirar, no lanzar");
- no saves (`store.save` refuses too);
- no legacy migration.

The galaxy still plays and can be looked at. The admin's "clear" currently clears the legacy arrays, not
`fogata.galaxy.v2:<id>`; the Firestore swap replaces both.

**Do not change.**
- `js/sim/*` maths and constants (DT, ε, halo, `SNUGGLE`, `KISS_QUIET`, budgets): determinism and the 30 tests depend
  on them. Run `node tools/physics-test.mjs` after any move.
- TYPE_RULES masses, which match the store.
- The identity variables in `css/style.css` (`--brasa`, `--celeste`, `--menta`, `--crema`, `--lavanda` as an accent,
  `--noche` Tinta) and their meanings in IDENTITY.md.
- The localStorage keys while the local store is in use (`fogata.galaxy.v2:`, `fogata.sky.v1`, `fogata.galaxies.v1`,
  `fogata.metrics.v1`, `fogata.prefs.v2`, `fogata.player.v1`, `fogata.uid.v1`). The id `fogata` is internal; the
  visible name is Little Galaxy.
- The register order of i18n catalogs (core, then `strings/galaxy.js`, which overrides two keys).
- File names: the packager re-syncs from this folder.
