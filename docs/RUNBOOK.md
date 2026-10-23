# Fair-Day Runbook · Collective Galaxy (G v1.0.0)

**Plan of record reference**: `portfolio/docs/plan/05-live-deploys-and-ops.md` § Fair-day runbook.

---

## Resumen Operativo en Español (Para el Capitán)

Este manual contiene las instrucciones operativas para **Galaxia Colectiva** en BAD Day 2026 (USFQ).

### Secuencia Rápida de Operación

1. **Montaje de Hardware**: laptop a corriente, TV como pantalla extendida por HDMI, Ethernet primario y hotspot móvil de respaldo.
2. **Arranque en Orden** (cada terminal debe exportar sus propias variables):
   1. Terminal A — stand de producción:
      ```sh
      cd /ruta/al/checkout/galaxy
      export GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/private/serviceAccountKey.json
      export FIREBASE_PROJECT_ID=little-galaxy
      pnpm --filter @little-galaxy/stand start
      ```
   2. En la TV: abrir `https://alexanderkholodov.web.app/galaxy/screen`, pulsar **F** para el modo quiosco (el cursor se oculta a los 2.5 s). Tras un reload, el layout quiosco se restaura; el fullscreen del navegador puede exigir pulsar **F** otra vez.
   3. Terminal B — controles (repetir exports; no hereda la Terminal A):
      ```sh
      cd /ruta/al/checkout/galaxy
      export GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/private/serviceAccountKey.json
      export FIREBASE_PROJECT_ID=little-galaxy
      pnpm --filter @little-galaxy/stand control flag seasonOpen on
      pnpm --filter @little-galaxy/stand control flag launches on
      ```
      `config/live` debe existir ya (producción). En ensayo local, sembrar antes (sección 2).
   4. Probar desde el teléfono: escanear el QR, lanzar un planeta y confirmar que aparece en la TV.
3. **Durante el día**: escenas y kill switches vía `control`; monitorear cuota Spark; rollback desde el checkout de portfolio.
4. **Cierre**: cerrar temporada con `seasonOpen off`. La exportación estática reproducible hoy es el ensayo `freeze-season` **solo contra emulador demo** (sección 10). La publicación de producción en `/galaxy/season/…` es un hito posterior; verificar el timelapse estático cuando ese camino exista.

---

## 1. Hardware Setup

### Equipment Checklist
- **Booth Laptop**: Battery at 100%, AC adapter connected.
- **Observatory Display**: 1080p (1920×1080) or 4K.
- **Cables**: HDMI, USB-C→HDMI adapter if needed.
- **Network**: Campus Ethernet primary; operator phone hotspot as backup.
- **Audio (optional)**: TV speakers or booth Bluetooth speaker.

### Display Configuration
1. Connect the TV via HDMI.
2. OS display settings → **Extended Desktop** (do not mirror). Linux: `Super + P` → Extend. Set TV to `1920×1080` @ `60Hz`.
3. Open a dedicated Chromium/Chrome window and drag it onto the TV.

---

## 2. Startup Order

Run steps in order. Every new terminal must `cd` into the Galaxy checkout and export its own environment — shell exports are not inherited by a separately opened terminal.

### Local rehearsal (emulators) — cold start from a fresh checkout

```sh
cd /path/to/galaxy-checkout
pnpm install --frozen-lockfile

# Terminal E0 — emulators (leave running)
JAVA_TOOL_OPTIONS=-Xmx512m pnpm exec firebase emulators:start --only firestore,auth --project demo-little-galaxy

# Terminal E1 — seed config/live (required before any control flag)
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FIREBASE_PROJECT_ID=demo-little-galaxy
pnpm run demo:seed

# Terminal E1 — stand against emulators
pnpm --filter @little-galaxy/stand start

# Terminal E2 — web (example env; separate terminal, same exports as needed for tooling)
pnpm --filter @little-galaxy/web exec vite --host 127.0.0.1 --port 4177
# Or serve a rehearsal build on 4177 if that is your usual local screen port.
```

Open `http://127.0.0.1:4177/galaxy/screen` on the TV window, press **F**. From another terminal with the same emulator exports:

```sh
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_PROJECT_ID=demo-little-galaxy
pnpm --filter @little-galaxy/stand control flag seasonOpen on
pnpm --filter @little-galaxy/stand control flag launches on
pnpm --filter @little-galaxy/stand control scene galaxy
```

Controls never create `config/live`. Without `demo:seed` (or an existing production doc), `control flag …` fails with “Provision config/live first.”

### Production booth — Step 1: Stand daemon

```sh
cd /path/to/galaxy-checkout
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/private/serviceAccountKey.json
export FIREBASE_PROJECT_ID=little-galaxy
pnpm --filter @little-galaxy/stand start
```

Do not print or commit the key. Confirm `config/live` already exists in the data project before opening flags (production preflight).

### Step 2: Screen kiosk
1. On the TV browser: `https://alexanderkholodov.web.app/galaxy/screen`
2. Press **F** or click **Fullscreen / Pantalla completa**.
3. Confirm portfolio header/nav are hidden and the cursor hides after 2.5s idle.
4. After a version reload, immersive layout restores from `localStorage`; browser DOM fullscreen may need **F** again.

### Step 3: Open season (secondary terminal)

```sh
cd /path/to/galaxy-checkout
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/private/serviceAccountKey.json
export FIREBASE_PROJECT_ID=little-galaxy
pnpm --filter @little-galaxy/stand control flag seasonOpen on
pnpm --filter @little-galaxy/stand control flag launches on
pnpm --filter @little-galaxy/stand control scene galaxy
```

### Step 4: Phone join test
1. Scan the on-screen QR → `/galaxy/create`.
2. Customize and **Launch**.
3. Confirm the planet appears on the TV within ~2 seconds with spotlight when enabled.

---

## 3. Pre-Opening Checklist (15 Minutes Before Doors Open)

- [ ] Power: laptop charging.
- [ ] Network: Ethernet (`ping 8.8.8.8`); hotspot known as backup.
- [ ] TV: screen on TV, press `F`, no taskbar.
- [ ] Cursor hides after 2.5s idle.
- [ ] QR scanned from ~2 m.
- [ ] Sound at comfortable ambient level.
- [ ] Stand logs clean; `snapshots/live` updating.
- [ ] Backup video: only after a verified `--mode rehearsal` recording (or OBS) has been played back; do not treat a demo/synthetic clip as backup (Section 8).

---

## 4. How to Read Quota Usage (Firebase Console)

Spark free tier:
- **Writes**: 20,000 / day
- **Reads**: 50,000 / day

Firestore’s free-tier day resets around **midnight Pacific time** (about **02:00–03:00 Ecuador** depending on US daylight saving) — **not** at 00:00 UTC. Interaction-day counters in the app remain UTC; keep those separate from the provider quota day.

1. Open `https://console.firebase.google.com/` → project **`little-galaxy`** → Firestore → **Usage**.
2. Compare Document Writes / Reads to the limits above.
3. Thresholds: &lt;50% normal; 60–75% monitor hourly; &gt;80% engage kill switches (Section 5).

---

## 5. Stand CLI Controls: Scenes & Kill Switches

All adjustments need the same `GOOGLE_APPLICATION_CREDENTIALS` / `FIREBASE_PROJECT_ID` (or emulator exports) in the terminal that runs them.

### Screen scenes

```sh
pnpm --filter @little-galaxy/stand control scene galaxy
pnpm --filter @little-galaxy/stand control scene bigQr
pnpm --filter @little-galaxy/stand control scene spotlight
pnpm --filter @little-galaxy/stand control scene cinematic
pnpm --filter @little-galaxy/stand control scene timelapse
```

### Kill switches

```sh
pnpm --filter @little-galaxy/stand control flag shake off
pnpm --filter @little-galaxy/stand control flag comets off
pnpm --filter @little-galaxy/stand control flag shootingStars off
pnpm --filter @little-galaxy/stand control flag meteorShowers off
pnpm --filter @little-galaxy/stand control flag edits off
pnpm --filter @little-galaxy/stand control flag launches off
pnpm --filter @little-galaxy/stand control flag sound off
pnpm --filter @little-galaxy/stand control flag soundOnScreen off
pnpm --filter @little-galaxy/stand control flag spotlight off
pnpm --filter @little-galaxy/stand control flag shake on
pnpm --filter @little-galaxy/stand control flag sound on
```

Supported flags: `launches`, `edits`, `shake`, `comets`, `shootingStars`, `meteorShowers`, `soundOnScreen`, `sound`, `spotlight`, `seasonOpen`. `sound` sets both audio flags.

### Timing

```sh
pnpm --filter @little-galaxy/stand control timing idleSeconds 45
pnpm --filter @little-galaxy/stand control timing meteorMinSeconds 300
pnpm --filter @little-galaxy/stand control timing meteorMaxSeconds 900
```

---

## 6. Restarting the Stand Daemon

```sh
pgrep -fl "little-galaxy/stand"
cd /path/to/galaxy-checkout
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/private/serviceAccountKey.json
export FIREBASE_PROJECT_ID=little-galaxy
pnpm --filter @little-galaxy/stand start
```

Expect a line like `Little Galaxy stand v1.0.0 | languages: en, es | default: en`. Snapshot writer resumes `snapshots/live`.

---

## 7. Emergency Rollback Procedure

From the portfolio checkout (sibling of Galaxy), use the forms that pnpm 11 accepts — **do not** insert an extra `--` before flags:

```sh
cd /path/to/portfolio-checkout
pnpm run rollback --dry-run
# or: node scripts/rollback.mjs --dry-run

pnpm run rollback
# or with confirmation: node scripts/rollback.mjs --yes
```

From Galaxy: `node ../portfolio-v0.3.0/scripts/rollback.mjs --dry-run` (path may be `../portfolio` depending on checkout layout).

Rollback restores the previous Hosting release pointer. It does not change `games.json`. Client tabs missing chunks soft-reload once via `galaxy.reload_guard`; drafts and screen camera stay in `localStorage`.

### Preview deploy / smoke (portfolio)

```sh
cd /path/to/portfolio-checkout
pnpm run deploy-local --galaxy ../galaxy-v1.0.0
```

Read-only hosted smoke from Galaxy:

```sh
BASE_URL=https://<preview-domain> pnpm exec playwright test --config tests/ui/playwright.config.js
```

---

## 8. Backup Video Recording

A fallback video is only a booth backup after playback confirms a healthy kiosk galaxy (not loading/error frames, not a synthetic demo unless explicitly labeled demo).

### Option A: Playwright recorder

```sh
# Demo only (synthetic) — never claim this is the fair backup
node scripts/record-screen.mjs --mode demo --duration 30 --output records/

# Rehearsal / backup candidate — explicit healthy screen URL, no synthetic=
node scripts/record-screen.mjs --mode rehearsal --url http://127.0.0.1:4177/galaxy/screen --duration 30 --output records/
```

The script refuses error/loading-only output, requires kiosk presentation, and labels demo vs rehearsal filenames. Play the file back before relying on it.

### Option B: OBS Studio
Follow the steps printed by `node scripts/record-screen.mjs --obs`. Press **F** for kiosk, record 5+ minutes, play back, keep the MP4 for VLC fullscreen loop.

---

## 9. Visitor-Facing Incident Responses

State only real behavior. Drafts stay on the phone; launch requires an online visitor action — there is no automatic pending-launch replay.

| Incident | Español | English |
|---|---|---|
| **Network drop** | "Se interrumpió la conexión en vivo. La galaxia en pantalla sigue con las órbitas locales; al reconectar se actualizan los datos." | "Live connection interrupted. On-screen orbits keep moving from local math; live data resumes when the network returns." |
| **Shake/comets paused** | "El operador pausó esta interacción por capacidad. El taller de planetas sigue abierto." | "The operator paused this interaction for capacity. The planet workshop stays open." |
| **Launches paused** | "Los lanzamientos están pausados por ahora. Puedes seguir diseñando; lanza cuando se reabra la ventana." | "Launches are paused for now. You can keep designing; launch when the window reopens." |
| **Phone offline / draft** | "Tu diseño está guardado en este teléfono. Cuando vuelva la red, pulsa Lanzar otra vez." | "Your design is saved on this phone. When you are back online, tap Launch again." |

---

## 10. Closing the Day

### Step 1: Close the live season

```sh
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/private/serviceAccountKey.json
export FIREBASE_PROJECT_ID=little-galaxy
pnpm --filter @little-galaxy/stand control flag launches off
pnpm --filter @little-galaxy/stand control flag seasonOpen off
```

### Step 2: Static export — rehearsal only (demo emulator)

`freeze-season` is guarded: it requires a loopback `demo-` emulator and an output directory. It does **not** publish to Hosting or `/galaxy/season/bad-2026/`. Production freeze/publish is a later roadmap milestone.

```sh
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_PROJECT_ID=demo-little-galaxy
pnpm --filter @little-galaxy/stand freeze-season /tmp/season-bad-2026-export
ls -la /tmp/season-bad-2026-export
# Expect manifest.json, objects-0.json … objects-f.json, log-*.json
```

### Step 3: Static timelapse verification (when a published season exists)

When production static files are published at `/galaxy/season/bad-2026/`:

1. Open `/galaxy` Home and the season timelapse/object pages.
2. Block or disconnect Firestore (or use a build without credentials) and confirm pages still load from the static JSON.
3. Until that publish path ships, treat Step 2 as local rehearsal evidence only — do not claim production static verification.

---

## 11. Command Verification Scope

Commands in this runbook were exercised against local Firebase emulators (seed, control flags/scenes/timing, stand start/stop, demo `freeze-season`, portfolio rollback `--dry-run`) where noted in the G v1.0.0 acceptance work. **Not** claimed here: production Hosting promote/rollback, campus Wi-Fi, physical TV/HDMI, or production static season publish.

```text
=== Emulator seed ===
$ FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=demo-little-galaxy pnpm run demo:seed
Demo launch window opened. No live project was accessed.

=== Control (after seed; same emulator exports in that terminal) ===
$ pnpm --filter @little-galaxy/stand control flag seasonOpen on
Live controls updated.

=== Rollback dry-run (portfolio checkout) ===
$ pnpm run rollback --dry-run
[dry-run] … POST live channel release with versionName = previous version

=== Demo freeze (emulator only) ===
$ pnpm --filter @little-galaxy/stand freeze-season /tmp/dryrun-freeze
Season exported; live configuration unchanged.
```
