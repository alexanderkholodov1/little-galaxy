# Fair-Day Runbook · Collective Galaxy (G v1.0.0-alpha.1)

**Alpha.1:** the live sky works with both stands stopped. Stand startup below is optional
enrichment. Section 11 covers the merge/approval release path, one-time console IAM,
GitHub controls and optional Beacon/laptop failover setup.

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
   2. Terminal B — explicitly open the season (repeat exports; Terminal A does not share them):
      ```sh
      cd /ruta/al/checkout/galaxy
      export GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/private/serviceAccountKey.json
      export FIREBASE_PROJECT_ID=little-galaxy
      pnpm --filter @little-galaxy/stand control flag seasonOpen on
      ```
      Stand startup creates missing `config/live` with closed defaults and preserves existing settings. Explicitly open only when ready. The optional `control init` command refuses to overwrite an existing document.
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

# Start E3 below to explicitly open the season before opening the screen.
# Terminal E2 — web client configured for demo emulators
# VITE_USE_EMULATORS=1 selects the demo project and emulator connections.
# --host 0.0.0.0 allows real phones on the same Wi-Fi to scan the QR code and connect.
export VITE_USE_EMULATORS=1
pnpm --filter @little-galaxy/web exec vite --host 0.0.0.0 --port 4177
```

For screen testing on the booth laptop, open `http://127.0.0.1:4177/galaxy/screen` and press **F**.
For real phone rehearsal across Wi-Fi, open `http://<laptop-lan-ip>:4177/galaxy/screen` (e.g. `192.168.1.50:4177`) so the on-screen join QR code encodes the reachable LAN IP.

After the stand creates any missing configuration, open the season from a dedicated control terminal (Terminal E3). Then open the screen and test a phone:

```sh
# Terminal E3 — controls (requires explicit emulator exports)
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FIREBASE_PROJECT_ID=demo-little-galaxy
# Stand startup creates config/live if absent; existing settings are preserved.
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

Do not print or commit the key. The elected stand publishes the legacy `snapshots/live` after its first healthy object read, independently of `config/live`. Home and Screen use client-maintained sky shards and remain live with both contenders stopped. A confirmed empty sky invites creation; only a real connection failure offers Retry.

### Step 2: Explicitly open the season (secondary terminal)

```sh
cd /path/to/galaxy-checkout
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/private/serviceAccountKey.json
export FIREBASE_PROJECT_ID=little-galaxy
# Stand startup creates config/live if absent; existing settings are preserved.
pnpm --filter @little-galaxy/stand control flag seasonOpen on
pnpm --filter @little-galaxy/stand control scene galaxy
```

### Step 3: Screen kiosk
1. On the TV browser: `https://alexanderkholodov.web.app/galaxy/screen`
2. Press **F** or click **Fullscreen / Pantalla completa**.
3. Confirm the galaxy fills the viewport, the corner mark opens links and the cursor hides after 2.5s idle.
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
- [ ] Sound enabled deliberately; sparse responses at a comfortable volume.
- [ ] Home and Screen receive a phone launch/edit with both stands stopped.
- [ ] Restart enrichment contenders; one leader heartbeat advances and its archive/snapshot logs stay clean.
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

Expect a line like `Little Galaxy stand v1.0.0-alpha.1 | languages: en, es | default: en`. Only the elected leader logs `Stand enrichment leadership acquired.` and resumes archive/legacy snapshot/meteor services. With the section 11 systemd setup, use `systemctl --user restart galaxy-stand.service` instead of launching an extra process. The live sky does not pause during this restart.

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
pnpm run deploy-local --galaxy ../galaxy-alpha1
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

## Appendix: Earlier Command Verification Scope

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
# E3: explicitly open (startup already creates missing config)
cd /path/to/galaxy-checkout
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FIREBASE_PROJECT_ID=demo-little-galaxy
# Stand startup creates config/live if absent; existing settings are preserved.
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

### Release path: merge and approve in GitHub

Only the operator merges the version PR. A push to main reads `apps/web/package.json`:
if `v<version>` already exists it skips with an Actions notice and run summary; otherwise CI creates that exact tag
on the merge commit and calls the full release workflow directly. No polling
machine, laptop key, terminal command or manual tag is part of this path.
External tag pushes still invoke the same release workflow; guards require the
exact package version and a commit on main. Alpha and beta releases are prereleases.

1. Merge the reviewed PR. Follow **Release on merge** in GitHub Actions. All normal
   checks and the privacy gate run before the data-project job.
2. Approve the existing **little-galaxy-rules** environment when GitHub requests it.
   The job uses the existing `FIREBASE_SERVICE_ACCOUNT_LITTLE_GALAXY` secret.
   If `config/live` is missing, the release creates the documented defaults below
   transactionally without overwriting any existing document. No prior dispatch is
   required for the first merge. Before any season/marker writes, the deploy CLI
   authenticates and reads the target project with read-only `apps:list --project`;
   failure leaves all season/recovery data untouched and fails loudly. This proves
   visibility, not every deploy permission. Before the first backfill only, it atomically saves
   `seasonOpen` and closes writes. It dry-runs all active sources, ownership keys and
   shard capacity while closed, and refuses pre-existing shards without a completed
   marker. Only then does it persist `deploymentStarted`, deploy rules and indexes,
   backfill the 16 shards atomically and restore the saved flag (including closed).
   An explicit operator close during this window supersedes the saved open flag.
3. The migration commits `migrations/sky-v1.complete` with all shards. A successful
   rerun or later release leaves both config and shards untouched while still
   deploying rules/indexes. The marker is admin-only; clients cannot read or write
   it. Existing objects and seeds remain the source for the first backfill.
4. After rules/migration succeed, CI publishes the checked artifact as a GitHub
   Release and dispatches its exact tag to portfolio. Portfolio owns production
   Hosting. This repository never deploys production Hosting.
5. Verify the deployed preview and production Home/Screen on real phones before
   accepting the rollout. Old pre-alpha transactions omit reciprocal shards and
   will be rejected after the new rules; their saved drafts and version watcher
   allow a safe update. A restored open season can precede portfolio publication:
   this compatibility boundary can briefly reject old-client writes.

Validation failures before deployment restore the prior season setting. Once
`deploymentStarted` is persisted, any deployment failure (including rules applied
but indexes failed) or incomplete migration **keeps the season closed**. The red
job retains the original deploy/migration error alongside the recovery failure.
Automatic recovery and manual `restore-season` both refuse to reopen an incomplete
post-deploy migration. Run **Operate the sky → inspect** (empty key/value) to print
`migrations/sky-v1`, `seasonOpen`, active/unsupported/duplicate-owner counts, existing
shard count, and each computed shard's entry/byte counts and limits. Inspection is
read-only and its validation result uses the same checks as the migration. Keep
`seasonOpen off` with the `flag` action while investigating. Repairs are reviewed
**Firestore Console** (or separately reviewed Admin SDK) edits, not workflow actions:
- Unsupported source: review active `objects` against the supported schema; repair
  the invalid record before retrying.
- Multiple active objects for one owner: reconcile the conflicting active records
  with the operator; preserve the intended specimen and archive before editing.
- Capacity exceeded: review per-shard counts/bytes (512 entries, 600,000 bytes);
  reconcile sources or ship a reviewed capacity/design change. Do not truncate data.
- Existing shards without a completed marker: stop and compare them with the source
  objects. Export/backup both first. Only after confirming the shards are disposable
  remnants, remove those specific shards in Console before retrying; do not delete
  live visitor entries or set `complete` manually to bypass validation.
- Invalid config or recovery state: review `config/live` and the marker in Console;
  preserve the saved season setting and correct only the diagnosed invalid field.

Then **Re-run failed jobs** on the current release; successful migration permits
restoration. Never delete the migration marker to bypass recovery. After a runner
interruption before deploy, or successful migration but failed restoration,
**Operate the sky → restore-season** (empty key/value) safely restores the saved
setting.

**Break glass, only when deployment is verified unchanged:** if deployment failed
before any rules change and cannot be retried in time, the operator must verify in
Firebase Console's Rules release/history that the previously deployed rules are
still active (and verify indexes were unchanged). A successful CLI visibility
preflight alone is not that proof. With the season closed, record the failed run,
current rules release and marker, then in **Firestore Console → migrations/sky-v1**
remove only `deploymentStarted`; retain `seasonOpenBefore`, the marker and shards.
Run **Operate the sky → restore-season** with empty key/value. If rules may have
changed, do not clear that field: keep the season closed and recover through a
successful current release. Direct Console edits bypass emergency-close coordination;
use `flag seasonOpen off` first if restoration must remain closed.

Both deployment and publication fetch the current tip of `main` and refuse unless
the tag equals `v` plus its web package version. Dispatch rechecks this boundary.
Historical `v1.0.0` and `v1.0.1` tags do not determine the current alpha version.
A stale run must remain red: run the current version's release instead. Releases
serialize their data jobs in `galaxy-sky-releases`; controls have no concurrency
pending slot and cannot be cancelled by a queued release. GitHub can still replace
an older pending **release** with a newer release: inspect cancelled release jobs
and retry only if the exact current-main version guard permits it.

Known alpha limitations from review:
- **MINOR-1:** the workflow's main-branch `if` is a convenience, not a security
  boundary. Restrict the **little-galaxy-rules** environment's deployment branches
  to `main` and retain the operator as required reviewer. If external tag-push
  releases are needed, explicitly allow `v*` tags too; otherwise they are blocked.
- **MINOR-2:** no watchdog runs after runner loss or a Firestore outage. Recovery
  state remains in the marker; inspect the red run and use the recovery flow above.
- **MINOR-3 (fixed for supported controls):** an explicit `seasonOpen off` through
  Operate the sky updates the retained saved flag in the same transaction, so a
  later restoration stays closed. Direct Console/Admin SDK edits bypass this
  coordination and can still be superseded by recovery; use Operate the sky.
- **MINOR-5:** **Re-run failed jobs** reuses the exact `release-files` artifact,
  retained for **7 days**. A full rebuild is not byte-identical (timestamps) and
  fails checksum comparison if the release already exists. After artifact expiry,
  recover through a newly reviewed version release; do not overwrite published bytes.

Initial defaults (`initialConfig`, shared by release and stand startup): schema 1,
season `bad-2026`, the stand package's `appVersion`, **seasonOpen false**, launches,
edits, comets, shake, shooting stars, meteor showers, screen sound, sound alias and
spotlight enabled; public assistant disabled; idle 60 seconds; meteors 360–900
seconds; scene `galaxy`. The stand also creates these only if missing on startup.
An existing document is never overwritten; open the season explicitly when ready.
IAM grants and environment restrictions/reviewer must be set before the first merge;
there is no required `init` dispatch. Live IAM and GitHub approval behaviour still
need the first approved run to verify them.

### One-time release service-account IAM (Google Cloud Console only)

In Google Cloud Console select the **data project matching the repository variable
VITE_FIREBASE_PROJECT_ID** (normally `little-galaxy`), then **IAM & Admin → IAM**.
Locate the principal used by the existing GitHub environment secret, normally
`firebase-adminsdk-<suffix>@<data-project-id>.iam.gserviceaccount.com`; a dedicated
account may instead be `<account-id>@<data-project-id>.iam.gserviceaccount.com`.
Match the email in **IAM & Admin → Service Accounts** to the account originally
used for that secret. Do not inspect, print or replace the key to identify it.

Click the principal's **Edit principal** pencil → **Add another role**, add only
missing roles from this list, then **Save**. Existing equivalent grants may already
cover some permissions; the builder has not inspected live IAM.

| Console role | Role ID | Why this release identity needs it |
| --- | --- | --- |
| Cloud Datastore User | `roles/datastore.user` | Read objects/config; write migration shards/marker and close/restore season flags; execute GitHub controls. This is the new data-write requirement. |
| Cloud Datastore Index Admin | `roles/datastore.indexAdmin` | List, create/update and remove declared Firestore indexes during the release. This is the index-deploy requirement. |
| Firebase Rules Admin | `roles/firebaserules.admin` | Compile and publish Firestore rulesets/releases; keep the existing reviewed rules deployment permission. |
| Firebase Viewer | `roles/firebase.viewer` | Firebase CLI project discovery (`firebase.projects.get`) and read-only API/service checks for the existing Firebase project. |
| Service Usage Consumer | `roles/serviceusage.serviceUsageConsumer` | Use the data project as the quota project (`serviceusage.services.use`) for the pinned CLI's API checks, which send `x-goog-user-project`. |

No Owner, Editor, Hosting Admin, service-agent role or billing upgrade is needed.
The data project's Firestore and Rules APIs/database already exist; deployment
must not depend on enabling paid services. GitHub tagging/release permissions are
job-scoped `contents: write`; data jobs use `contents: read`. Portfolio dispatch
continues to use its existing separate `PORTFOLIO_DISPATCH_TOKEN`.

Role references: [Firestore IAM](https://firebase.google.com/docs/firestore/security/iam),
[Rules IAM](https://docs.cloud.google.com/iam/docs/roles-permissions/firebaserules),
[Firebase Viewer](https://docs.cloud.google.com/iam/docs/roles-permissions/firebase),
[Service Usage Consumer](https://docs.cloud.google.com/iam/docs/roles-permissions/serviceusage)
and [Firebase CLI prerequisites](https://firebase.google.com/docs/projects/iam/permissions).
These are project IAM grants, not new credentials or external services.

### Operate the sky from GitHub

Open this repository's **Actions → Operate the sky → Run workflow**, select **main**,
enter the action/key/value, and approve **little-galaxy-rules**. Dispatches from
other branches are normally skipped; enforce the environment branch policy above.
Controls execute independently of release queues. Transactions coordinate config
and migration recovery: emergency close takes precedence, other flags are preserved,
and `seasonOpen on` is refused while a migration recovery flag remains.

| Action | Key | Value |
| --- | --- | --- |
| `flag` | `seasonOpen`, `launches`, `edits`, `shake`, `comets`, `shootingStars`, `meteorShowers`, `soundOnScreen`, `sound`, `spotlight` | `on` or `off` |
| `scene` | `galaxy`, `bigQr`, `spotlight`, `cinematic`, `timelapse` | empty |
| `timing` | `idleSeconds`, `meteorMinSeconds`, `meteorMaxSeconds` | seconds within the stand's bounds |
| `init` | empty | empty; create missing config once, closed; refuses overwrite |
| `inspect` | empty | empty; read-only migration marker, source and shard validation counts |
| `restore-season` | empty | empty; restore saved flag only before deployment or after completed migration |

Inputs reach the stand as data and are validated against its own control parser;
there is no separate workflow allowlist of flags. Invalid keys/values fail before
opening an admin connection. `sound` updates the existing sound alias and screen
flag together. The result appears in the workflow log. These controls need no stand
daemon, laptop terminal or local admin key. The optional enrichment service setup
below is independent of the release path.

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
   every 90 seconds, `expiresAt` 360 seconds ahead (Firestore server time). Healthy follower checks add
   reads, not heartbeat writes. Only one process starts archive/snapshot/meteor
   listeners. Lease authority uses server readTime; host clock skew cannot steal leadership. Start Beacon
   first if it should initially lead; a recovered Beacon does not preempt a healthy
   laptop leader. Leadership changes on release/expiry, not machine preference.
8. Rehearse failure: stop Beacon's service, verify the laptop becomes owner within
   90 seconds after graceful release, then restart Beacon and confirm no duplicate
   leader. For a crash/partition, takeover occurs within approximately 450 seconds
   of the last heartbeat (360-second expiry plus a 90-second poll). Home/Screen
   should continue receiving visitor writes throughout. Check quota in Console.
9. To stop enrichment, run `systemctl --user stop galaxy-stand.service` on both.
   To revoke access, stop both and remove the approved key in IAM; delete its local
   copies via the operator's normal secure procedure. No client config changes.

A monotonic deadline stops local services at the last confirmed lease duration; transient
renewal failures retain services until that deadline. All production enrichment writes
check the owner, persistent fencing token and server-time expiry in the write transaction.
A concurrent takeover conflicts with old writes; stale transaction retries are rejected.
The portfolio still reads snapshots/live (creators/at): content changes debounce for 120s,
with no idle heartbeat writes. Its at is a content publication time, not a liveness signal.
Archive writes debounce for 120s; restarts hydrate public chunks and query only the inclusive
source timestamp boundary/new records. The reviewed release job deploys the declared
events type+at composite index before publishing this build.
Check archive continuity after recovery. Beacon/laptop installation, credential
provisioning and physical failover remain operator acceptance; migration is automated by the reviewed release job.


## 12. Exact-tag release dispatch (chain b)

A merge to main creates a missing package-version tag in CI and calls `release.yml`
with that exact tag. Tags remain immutable; an existing version is skipped.
`verify-release.js` accepts stable `vX.Y.Z` or `vX.Y.Z-alpha.N`/`vX.Y.Z-beta.N`
(positive non-zero-padded N), exactly matching the web package version. The tagged
commit must belong to main. All checkout/build/deploy jobs use the verified tag's
commit, including reusable calls whose event ref is main. Alpha/beta publication
uses `--prerelease --latest=false`, preserving the stable latest release.

Only after `gh release create` succeeds, the final publish step posts:

```json
{
  "event_type": "galaxy-release",
  "client_payload": { "tag": "v1.0.0-alpha.1" }
}
```

The tag comes from the release guard, never a highest-semver/latest lookup.
The destination is `alexanderkholodov1/portfolio`'s `repository_dispatch` endpoint.
Repository secret `PORTFOLIO_DISPATCH_TOKEN` must authorize dispatch to that repo
(fine-grained Contents write, or the existing appropriate classic repo scope).
It reaches only the final dispatch step. Missing/expired authorization or a non-2xx
response fails publication; this does not imply a Hosting update. If release
publication succeeded but dispatch failed, use GitHub **Re-run failed jobs** after
correcting authorization. The publish job verifies the existing assets against
the checked checksums before repeating dispatch; it never overwrites them.
An incomplete or mismatched existing release fails loudly for review.

The portfolio receiver and its production policy remain separately owned. This
builder performed no GitHub dispatch, rule/index deployment or Hosting mutation.

## 13. Alpha.2 B1 galaxies and admission

The existing operator-approved `release-sky` workflow entry now runs `releaseGalaxies`.
It preflights CLI access, persists `migrations/galaxies-v1`, closes legacy writes, validates the
source, deploys rules/indexes, imports sources into `galaxies/bad-2026` (name **BAD 2026**),
read-back verifies public genesis chunks and publishes both galaxy pointers atomically.
`restore-season` recovers both alpha.2 and any older alpha.1 window. A possibly applied deploy
with incomplete migration leaves the season closed. Rerun the failed release; do not delete its
marker. An emergency `control flag seasonOpen off` supersedes the saved state for either migration.
Existing global objects/shards/archive are retained for old object URLs and rollback inspection.
`config/live.dataLayerVersion = 2` closes the old player write path even after flag restoration.
Old phones keep their local draft and must load the new packaged client to contribute again.

The import stores exact private legacy objects/shards, publicly hashed genesis without Auth UID
mappings, private entitlement profiles, and counted physical bodies. It fails on unsupported data
or exceeded budgets; it never silently clamps a legacy orbit or drops an object. The initial
manifest uses kernel `legacy-orbit-v2`: the frontend must support that genesis format before this
release is deployed. Imported ownership uses private UID memberships; the first galaxy's logical
owner is `operator`, with administration granted independently by the email allowlist.

The release provisions a rolling 370 Pacific quota windows, including DST boundaries, in
`quotaWindows`. Renew descriptors through the same admin tooling before expiry. Client clocks
cannot create/reset the quota calendar. Do this preparation outside the fair quota day or include
all imported documents and descriptors in that day's usage.

The runtime admin allowlist is **only `config/admins.emails`**. Migration creates it only if absent,
with `kholodov.alexander1@gmail.com`. To change it, edit that array with an authorized Firebase
Console/Admin SDK operator; client rules forbid writing the allowlist. No custom Auth claims or
email-only UI checks are required: rules also require verified email and `google.com` provider.
Keep at least one working admin account before removing an address.

Stop existing alpha.1 stand binaries before opening alpha.2; a new alpha.2 daemon exits after
recognizing data-layer version 2, disabling the obsolete enrichment stream. No new rules, indexes,
allowlist, credential, public name or production Hosting were deployed by B1 implementation.
Rules deployment retains the existing required-reviewer release environment.

Before opening: integrate the pinned kernel and legacy genesis reader; anchor the client clock;
verify the accepted log on the deployed preview and real phones; test a hidden/resumed phone,
nonce retry, freeze/switch race, and no-stand late join. Review `alpha2-b1-quota.md`: its fair model
has only 401 reads below the 50% gate and excludes optional services. UI confirmations, backup
exports/restore/purge, dashboard and new routes belong to their packages; B1 provides no purge API.

B1 defaults `dailyLimit` to 600 accepted mutations/day, including edits/removals. This revised
quota budget includes up to eleven imported genesis chunks per cold/resume join; a 900-action
scenario with the imported world does not fit the requested 50% margin. Raising the limit is
an admin data operation and needs a revised fair-day model.

The migrated public galaxy honors the existing seasonOpen/launches/edits kill switches. A
restored closed season stays closed to canonical actions; admin tombstones remain available for
repair. Clients forging an open local config cannot bypass these server checks.

Import preparation accounts for read-request rule dependencies as well as commit dependencies.
It chooses a ceiling of 600 down to 300 using actual genesis size; fourteen chunks choose 550.
An oversized import fails preflight before deployment. See the executable quota model.

## 14. Alpha.2 P2 — prototype game and keeper’s ledger

Before using the admin, enable **Google** in `little-galaxy` Firebase Authentication → Sign-in
method (if disabled). Add `alexanderkholodov.web.app` and the actual preview/LAN test domains to
Authentication → Settings → Authorized domains. Provision the captain's verified Google email
in the existing private `config/admins.emails` allowlist. No client-side password or admin key
is used. This change does not deploy rules or enable providers automatically.

The release game mounts at `/little-galaxy/`; admin at `/little-galaxy/admin`. The admin retains
the prototype's ledger layout, with Google identity checked independently by Firestore rules.
Start fresh by creating another galaxy, then select **Open to public** and **Show at fair**
independently. The account limit is three galaxies. Freeze retains accepted future launches,
closes writes and publishes a verified, pinned-kernel replay certification for later joins.
Archive retains the same history; switch both selections first.

A body removal shows the exact galaxy/count, requires typing its name, then a three-second
Space/pointer hold and release. A click or Enter cannot confirm. The browser verifies and
downloads an export before the append-only removal. Keep that export on operator-controlled
media. Compacts and hosts with moons are refused by B1; removals do not refund lifetime budgets.
There is no purge, in-place restore or local 30-second undo against the real shared world.

Admin metrics count galaxy memberships, chosen names/Anonymous, first/last sampled activity,
five-minute active status, lifetime launches and accepted-log type/hour/day charts. Visits and
cosmetic throws display an unavailable value because they are not collected. Imported bodies
have no accepted launch-time history. **Refresh** explicitly rereads bounded data; the dashboard
does not poll private members or add per-visit writes. Large repeated refreshes consume quota.
