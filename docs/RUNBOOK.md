# Fair-Day Runbook · Collective Galaxy (G v1.0.2)

**Alpha.1:** the live sky works with both stands stopped. Stand startup below is optional
enrichment. Before the first alpha publication follow section 11 for migration and Beacon/laptop
failover; never provision credentials as part of a builder run.

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
   2. Terminal B — inicializar una sola vez y abrir explícitamente (repetir exports; no hereda la Terminal A):
      ```sh
      cd /ruta/al/checkout/galaxy
      export GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/private/serviceAccountKey.json
      export FIREBASE_PROJECT_ID=little-galaxy
      pnpm --filter @little-galaxy/stand control init
      pnpm --filter @little-galaxy/stand control flag seasonOpen on
      ```
      `control init` crea `config/live` para `bad-2026`, imprime el documento y deja `seasonOpen` apagado. Todas las interacciones están habilitadas; el asistente sigue apagado. Si el documento ya existe, rechaza la operación sin modificarlo: omitir `init` en los siguientes arranques. El stand publica `snapshots/live` al recibir su primera lectura, incluso sin configuración ni objetos.
   3. En la TV: abrir `https://alexanderkholodov.web.app/galaxy/screen`, pulsar **F** para el modo quiosco (el cursor se oculta a los 2.5 s). Tras un reload, el layout quiosco se restaura automáticamente; pulsar **F** restaura de inmediato la pantalla completa del navegador.
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

### Local rehearsal (LAN emulators) — cold start from a fresh checkout

```sh
cd /path/to/galaxy-checkout
pnpm install --frozen-lockfile

# Terminal E0 — emulators (leave running)
export JAVA_TOOL_OPTIONS=-Xmx512m
pnpm run emulators:lan

# Terminal E1 — stand (no config required)
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FIREBASE_PROJECT_ID=demo-little-galaxy
pnpm --filter @little-galaxy/stand start

# Start E3 below to initialize and open the season before opening the screen.
# Terminal E2 — web client configured for demo emulators
# VITE_USE_EMULATORS=1 selects the demo project and emulator connections.
# --host 0.0.0.0 allows real phones on the same Wi-Fi to scan the QR code and connect.
export VITE_USE_EMULATORS=1
pnpm --filter @little-galaxy/web exec vite --host 0.0.0.0 --port 4177
```

For screen testing on the booth laptop, open `http://127.0.0.1:4177/galaxy/screen` and press **F**.
For real phone rehearsal across Wi-Fi, open `http://<laptop-lan-ip>:4177/galaxy/screen` (e.g. `192.168.1.50:4177`) so the on-screen join QR code encodes the reachable LAN IP.

After the stand starts, initialize once and open the season from a dedicated control terminal (Terminal E3). Then open the screen and test a phone:

```sh
# Terminal E3 — controls (requires explicit emulator exports)
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FIREBASE_PROJECT_ID=demo-little-galaxy
pnpm --filter @little-galaxy/stand control init # first time only
pnpm --filter @little-galaxy/stand control flag seasonOpen on
pnpm --filter @little-galaxy/stand control scene galaxy
```

`control init` creates `config/live` transactionally only when missing; it refuses to overwrite any existing document. It prints the full document it wrote: schema version 1, season `bad-2026`, the stand app version, every interaction flag on, assistant off, galaxy scene, 60-second idle and 360–900-second meteor timings. The season stays closed until `control flag seasonOpen on`. On later starts, skip `init`; existing operator settings are preserved. The demo seed is optional test data, not a production provisioning step.

### Production booth — Step 1: Stand daemon

```sh
cd /path/to/galaxy-checkout
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/private/serviceAccountKey.json
export FIREBASE_PROJECT_ID=little-galaxy
pnpm --filter @little-galaxy/stand start
```

Do not print or commit the key. The stand immediately publishes `snapshots/live` after its first healthy object read, including an empty sky, independently of `config/live`. Before the booth starts, Home says “The sky opens when the booth starts.” A failed connection still offers Retry.

### Step 2: Initialize once, then open season (secondary terminal)

```sh
cd /path/to/galaxy-checkout
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/private/serviceAccountKey.json
export FIREBASE_PROJECT_ID=little-galaxy
pnpm --filter @little-galaxy/stand control init # first time only
pnpm --filter @little-galaxy/stand control flag seasonOpen on
pnpm --filter @little-galaxy/stand control scene galaxy
```

### Step 3: Screen kiosk
1. On the TV browser: `https://alexanderkholodov.web.app/galaxy/screen`
2. Press **F** or click **Fullscreen / Pantalla completa**.
3. Confirm portfolio header/nav are hidden and the cursor hides after 2.5s idle.
4. After a version reload, immersive layout restores from `localStorage`; browser DOM fullscreen may need **F** again.

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

Expect a line like `Little Galaxy stand v1.0.2 | languages: en, es | default: en`. Snapshot writer resumes `snapshots/live`.

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
pnpm run deploy-local --galaxy ../galaxy-v1.0.2
```

Read-only hosted smoke from Galaxy:

```sh
export BASE_URL='https://<preview-domain>' # replace with the approved preview URL
pnpm exec playwright test --config tests/ui/playwright.config.js
```

---

## 8. Backup Video Recording

A fallback video is only a booth backup after playback confirms a healthy kiosk galaxy (not loading/error frames, not a synthetic demo unless explicitly labeled demo).

### Option A: Playwright recorder

```sh
# Demo only (synthetic) — never claim this is the fair backup
node scripts/record-screen.mjs --mode demo --duration 30 --output records/

# Rehearsal / backup candidate — set this to the actual laptop LAN IP first
export GALAXY_LAN_HOST=192.168.1.50
# Explicit healthy screen URL, no synthetic=
node scripts/record-screen.mjs --mode rehearsal --url "http://${GALAXY_LAN_HOST}:4177/galaxy/screen" --duration 30 --output records/
```

The script uses one recording context, validates drawn canvas motion, then re-encodes only the healthy kiosk interval with Playwright's bundled ffmpeg (or `GALAXY_FFMPEG`). Startup/loading/kiosk-entry footage is discarded. It labels demo versus rehearsal clips. Play the output back, inspect its first and last frames, and scan the displayed QR from a separate phone before relying on it.

Known limitation: no campus/production rehearsal backup or physical playback/QR reachability is certified by automated recorder checks. Record the actual artifact path and playback result here after operator acceptance; until then the usable fair backup remains pending.

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

The following is a reproducible command recipe, not an observed physical-phone transcript. Replace `/path/to/galaxy-checkout` in **each** terminal. E0 uses `firebase.lan.json` through the package script, binding Auth and Firestore to all interfaces as well as Vite. Use a trusted rehearsal network; allow inbound TCP 4177, 8080 and 9099 and disable Wi-Fi client isolation. Keep all terminals open until rehearsal is finished.

```sh
# E0: emulator terminal
cd /path/to/galaxy-checkout
export JAVA_TOOL_OPTIONS=-Xmx512m
pnpm run emulators:lan
```

```sh
# E1: start stand before provisioning
cd /path/to/galaxy-checkout
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FIREBASE_PROJECT_ID=demo-little-galaxy
pnpm --filter @little-galaxy/stand start
```

```sh
# E2: web terminal
cd /path/to/galaxy-checkout
export VITE_USE_EMULATORS=1
pnpm --filter @little-galaxy/web exec vite --host 0.0.0.0 --port 4177
```

```sh
# E3: initialize once, then explicitly open (before screen and phone test)
cd /path/to/galaxy-checkout
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FIREBASE_PROJECT_ID=demo-little-galaxy
pnpm --filter @little-galaxy/stand control init # first time only
pnpm --filter @little-galaxy/stand control flag seasonOpen on
pnpm --filter @little-galaxy/stand control scene galaxy
```

Operator acceptance still required: open the screen using the laptop's actual LAN IP, scan its QR on a separate phone, launch, and record the observed TV receipt time. No campus Wi-Fi, physical phone/TV, Hosting rollback or production static publication is certified by this recipe. Stop E1, E2 and E0 with Ctrl+C after rehearsal. A screen opened on loopback produces a QR inaccessible from a separate phone.


### Earlier v1.0.0 local command and recorder probe (2026-10-23)

A clean-shell probe started the exact `pnpm run emulators:lan` package script, then ran the
then-current E1 demo seed/stand, E2 web and E3 control commands with their own exported environments.
A Chromium phone-sized browser joined through the laptop LAN address, launched, and showed
“In orbit”. This is emulator/browser evidence, not a physical-phone receipt-time measurement.

The recorder produced a three-second, 1920×1080 local probe at:
`~/bad/work/fix3-g-v1.0.0/recordings/galaxy-rehearsal-2026-10-23T10-21-34-469Z.webm`.
Chromium decoded its duration and dimensions. Its first and last frames were independently
decoded with Playwright's bundled ffmpeg and visually inspected: full-frame dark kiosk,
visitor planet at different orbital positions, LAN-origin QR, no startup/loading frames or
gray capture padding. The retained PNGs are `decoded-first.png` and `decoded-last.png` in
that scratch directory. This short probe is not the booth's long rehearsal backup. Actual
campus/production backup recording, physical playback and QR scanning remain operator steps.
All probe-started browsers, stand/web processes and emulators were stopped.

## 11. Alpha.1 live sky, Beacon and automatic laptop backup

The home and booth read `sky/0`…`sky/f` directly; launch/edit/relaunch transactions
maintain them under rules. Both stands may be stopped without taking the sky down.
Archive/timelapse publication, legacy snapshots and scheduled meteors require one
leader. Operator controls are independent admin commands and do not need leadership.
See [live-sky.md](live-sky.md) for quota assumptions and failure boundaries.

### Before the first alpha.1 publication

1. The captain stages the release and rules through the reviewed release workflow.
   Existing pre-alpha phone transactions do not write shards and will be rejected
   by the new reciprocal rules. Close the season before activating these rules,
   preserve saved drafts, and let the old clients' version watcher offer a safe
   update. Reopen only after the alpha artifact is served and both views pass the
   read-only check. This is a compatibility boundary, not a zero-interruption rollout.
2. With the operator's admin environment exported, run:
   ```sh
   pnpm --filter @little-galaxy/stand control flag seasonOpen off
   pnpm --filter @little-galaxy/stand migrate-sky
   ```
   Migration refuses an open season, validates sources and atomically writes all
   16 shards. Never run it while writes are open. It includes pre-alpha active
   objects and unclaimed operator seeds. It does not alter objects or open config.
3. Open Home and Screen with both stands stopped. Confirm an existing object (or
   a valid empty sky). Reopen explicitly with `control flag seasonOpen on` and
   confirm a new phone launch/edit appears on both without a stand. Start the
   enrichment processes after this check. No migration repeats on ordinary restart.

### Missing Beacon credential: exact operator steps (none executed by this task)

Beacon currently has no Galaxy admin key. The operator must supply it; do not use
portfolio/Hosting credentials or copy another project's key.

1. In Google Cloud Console, select the **data project matching the repository's
   VITE_FIREBASE_PROJECT_ID**. In IAM & Admin → Service Accounts, select or create
   a dedicated Galaxy stand service account. Grant **Cloud Datastore User**
   (`roles/datastore.user`) on that data project; no Hosting or project-owner role.
2. Service account → Keys → Add key → Create new key → JSON, on the operator's
   trusted machine. Transfer that file securely to Beacon. Never paste its contents
   into chat, shell arguments, environment values, Git or browser files. If an
   existing approved key is available, transfer that instead of creating another.
3. On each machine, as the operator, place its approved key at a private absolute
   path outside the checkout/public output, readable only by the stand user
   (directory mode 700, key mode 600). Use the same data project on both machines.
   Set `GOOGLE_APPLICATION_CREDENTIALS` to its **path**, never its contents.
4. Install Node ≥22.18, pnpm 11.5.2 and the pinned dependencies in the selected
   release checkout. Test the stand once in a terminal, then stop it with SIGTERM.
   No emulator variables may be present for the production service.
5. Install this user systemd unit as `~/.config/systemd/user/galaxy-stand.service`
   on Beacon and the Linux laptop (substitute all three operator-owned paths and
   the actual data project ID; `pnpm` must be an absolute executable path):
   ```ini
   [Unit]
   Description=Collective Galaxy enrichment contender
   After=network-online.target
   Wants=network-online.target

   [Service]
   Type=simple
   WorkingDirectory=/absolute/path/to/release-checkout
   Environment=FIREBASE_PROJECT_ID=ACTUAL_DATA_PROJECT_ID
   Environment=GOOGLE_APPLICATION_CREDENTIALS=/absolute/private/galaxy-stand.json
   ExecStart=/absolute/path/to/pnpm --filter @little-galaxy/stand start
   Restart=on-failure
   RestartSec=15
   TimeoutStopSec=30
   KillSignal=SIGTERM
   UMask=0077

   [Install]
   WantedBy=default.target
   ```
   On a non-systemd laptop, run the identical stand command in the operator's
   supervised session with those two exports. It is still an automatic contender.
6. On Beacon, enable user lingering only if the operator wants it running after
   logout: `loginctl enable-linger "$USER"`. Then on both systemd hosts:
   `systemctl --user daemon-reload` and
   `systemctl --user enable --now galaxy-stand.service`.
7. Inspect `journalctl --user -u galaxy-stand.service` and Firestore Console's
   admin-only `leases/stand`: one random process owner, `heartbeatAt` advancing
   every 30 seconds, `expiresAt` 90 seconds ahead. Healthy follower checks add
   reads, not heartbeat writes. Only one process starts archive/snapshot/meteor
   listeners. Clocks must be synchronized (OS network time enabled).
8. Rehearse failure: stop Beacon's service, verify the laptop becomes owner within
   30 seconds after graceful release, then restart Beacon and confirm no duplicate
   leader. For a crash/partition, takeover occurs within approximately 120 seconds
   of the last heartbeat (90-second expiry plus a 30-second poll). Home/Screen
   should continue receiving visitor writes throughout. Check quota in Console.
9. To stop enrichment, run `systemctl --user stop galaxy-stand.service` on both.
   To revoke access, stop both and remove the approved key in IAM; delete its local
   copies via the operator's normal secure procedure. No client config changes.

A lease deadline stops local services when renewal stalls. A write already sent by
an old leader cannot be atomically fenced by the admin SDK after a network partition;
check archive continuity after recovery. Beacon/laptop installation, credential
provisioning, production migration and physical failover remain operator acceptance.
