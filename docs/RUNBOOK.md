# Fair-Day Runbook · Collective Galaxy (G v1.0.0)

**Plan of record reference**: \`portfolio/docs/plan/05-live-deploys-and-ops.md\` § Fair-day runbook.

---

## Resumen Operativo en Español (Para el Capitán)

Este manual contiene las instrucciones operativas completas para la exhibición de **Galaxia Colectiva** en el evento BAD Day 2026 de la USFQ.

### Secuencia Rápida de Operación

1. **Montaje de Hardware**:
   - Conectar la laptop a corriente eléctrica continua.
   - Conectar la TV del stand como pantalla extendida mediante HDMI.
   - Conectar internet por cable Ethernet (y configurar hotspot móvil en el teléfono como respaldo inmediato).
2. **Arranque en Orden**:
   1. Iniciar el proceso del stand:
      \`\`\`sh
      GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/private/serviceAccountKey.json FIREBASE_PROJECT_ID=little-galaxy pnpm --filter @little-galaxy/stand start
      \`\`\`
   2. En la TV, abrir el navegador en la pantalla del observatorio:
      \`https://alexanderkholodov.web.app/galaxy/screen\`
      Presionar la tecla **\`F\`** (o el botón "Pantalla completa") para activar el modo quiosco. El cursor se oculta automáticamente a los 2.5 segundos.
   3. Abrir la temporada y permitir lanzamientos desde otra terminal:
      \`\`\`sh
      pnpm --filter @little-galaxy/stand control flag seasonOpen on
      pnpm --filter @little-galaxy/stand control flag launches on
      \`\`\`
   4. Probar desde tu teléfono: escanear el código QR en pantalla, crear y lanzar un planeta de prueba, y confirmar que aparece en la TV en menos de 2 segundos.
3. **Gestión Durante el Día**:
   - **Cambio de escenas**: \`pnpm --filter @little-galaxy/stand control scene <galaxy|bigQr|spotlight|cinematic|timelapse>\`.
   - **Monitoreo de cuota gratuita**: Revisar en Firebase Console (límite Spark: 20,000 escrituras y 50,000 lecturas/día).
   - **Presión de cuota (surges)**: Apagar interacciones con \`pnpm --filter @little-galaxy/stand control flag shake off\` (ahorra ~25% de escrituras).
   - **Rollback de emergencia**: Si un deploy falla, desde \`~/Fauns/wt/portfolio-v0.3.0\` ejecutar \`pnpm run rollback\` (o con confirmación automática: \`node scripts/rollback.mjs --yes\`).
4. **Cierre de la Feria**:
   1. Cerrar la temporada: \`pnpm --filter @little-galaxy/stand control flag seasonOpen off\`.
   2. Exportar la temporada estática: \`pnpm --filter @little-galaxy/stand freeze-season ./temporada-bad-2026\`.
   3. Verificar el timelapse estático y los archivos JSON exportados.

---

## 1. Hardware Setup

### Equipment Checklist
- **Booth Laptop**: Battery charged to 100%, connected to AC power adapter.
- **Observatory Display (TV/Monitor)**: 1080p (1920×1080) or 4K display.
- **Cables & Adapters**: High-speed HDMI cable, USB-C to HDMI adapter (if needed).
- **Network**:
  - Primary: USFQ Campus wired Ethernet cable connected to laptop USB/Ethernet adapter.
  - Backup: Operator smartphone with personal Wi-Fi hotspot active and cellular data enabled.
- **Audio (Optional/Ambient)**: TV built-in speakers or booth Bluetooth speaker connected via 3.5mm jack.

### Display Configuration
1. Connect the TV to the laptop via HDMI.
2. In OS Display Settings, select **"Extended Desktop"** (Do not duplicate/mirror):
   - **Linux / X11 / Wayland**: Open display settings or press \`Super + P\` -> Choose "Join Displays" / "Extend".
   - Set TV resolution to \`1920×1080\` at \`60Hz\`.
3. Open a dedicated browser window (Chromium/Chrome) and drag it to the TV desktop area.

---

## 2. Startup Order

Always execute the startup steps in this strict sequence:

### Step 1: Launch Stand Background Daemon
The stand process manages snapshot generation, memory archives, ambient meteor schedules, and operator control.

**On the Booth Laptop (Production)**:
\`\`\`sh
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/private/serviceAccountKey.json
export FIREBASE_PROJECT_ID=little-galaxy
pnpm --filter @little-galaxy/stand start
\`\`\`

*(For rehearsal or local dry-runs against emulators)*:
\`\`\`sh
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_PROJECT_ID=demo-little-galaxy
pnpm --filter @little-galaxy/stand start
\`\`\`

### Step 2: Open Screen Page in Fullscreen Kiosk Mode
1. In the browser window located on the TV display, navigate to:
   \`\`\`text
   https://alexanderkholodov.web.app/galaxy/screen
   \`\`\`
   *(Or \`http://127.0.0.1:4177/galaxy/screen\` in local rehearsal).*
2. Enter kiosk mode:
   - Click the **"Pantalla completa / Fullscreen"** button in the sound/control bar, OR
   - Press the **\`F\`** key on your keyboard.
3. Verify that the portfolio header and navigation are hidden, and the mouse cursor disappears after 2.5 seconds of inactivity.

### Step 3: Open Season & Enable Creation
From a secondary terminal on the laptop:
\`\`\`sh
# 1. Open the season
pnpm --filter @little-galaxy/stand control flag seasonOpen on

# 2. Allow planet and star launches
pnpm --filter @little-galaxy/stand control flag launches on

# 3. Verify screen scene is set to 'galaxy'
pnpm --filter @little-galaxy/stand control scene galaxy
\`\`\`

### Step 4: Test Phone Joins
1. With your smartphone, scan the dynamic QR code displayed in the bottom-right corner of the TV screen.
2. The phone will open \`/galaxy/create\`.
3. Customize a test planet (adjust surface palette, ring style, ocean ratio).
4. Tap **"Launch / Lanzar"** and swipe upwards in the launch window.
5. **Verification**: Confirm that the new planet appears on the booth TV screen within 2 seconds with its spotlight title announcement.

---

## 3. Pre-Opening Checklist (15 Minutes Before Doors Open)

- [ ] **Power**: Laptop charging cable plugged into wall outlet and indicator light is on.
- [ ] **Network**: Ethernet connection verified (\`ping 8.8.8.8\`). Operator phone hotspot configured as known Wi-Fi network.
- [ ] **TV Display**: Screen window running on TV, resolution crisp, no taskbars visible, press \`F\` to verify fullscreen.
- [ ] **Cursor Hiding**: Mouse left idle; cursor vanishes completely after 2.5 seconds.
- [ ] **QR Code Scanning**: Tested scanning the join QR code from a distance of 2 meters using a standard phone camera.
- [ ] **Audio Level**: Screen sound enabled and set to a comfortable ambient volume (not muddy or distorted).
- [ ] **Stand Heartbeat**: Terminal shows stand running without errors; \`snapshots/live\` updating smoothly.
- [ ] **Backup Video Ready**: Verify rehearsal backup video file exists in \`records/\` (see Section 8).

---

## 4. How to Read Quota Usage (Firebase Console)

The data project operates strictly on the **Firebase Spark (free tier)**:
- **Daily Writes Quota**: 20,000 writes / UTC day.
- **Daily Reads Quota**: 50,000 reads / UTC day.

### Checking Usage in Real-Time:
1. Open a browser tab on the booth laptop and navigate to:
   \`\`\`text
   https://console.firebase.google.com/
   \`\`\`
2. Select the data project: **\`little-galaxy\`**.
3. In the left navigation menu, click **Firestore Database**.
4. Click on the **Usage** tab at the top.
5. Review:
   - **Document Writes**: Compare today's count against 20,000.
   - **Document Reads**: Compare today's count against 50,000.
   - Note: Usage resets at 00:00 UTC (19:00 Ecuador time).
6. **Action Thresholds**:
   - **< 10,000 writes (50%)**: Normal operations; full interactions enabled.
   - **12,000–15,000 writes (60–75%)**: High attendance; monitor write velocity hourly.
   - **> 16,000 writes (80%)**: Quota pressure; engage Level 1 kill switches (Section 5).

---

## 5. Stand CLI Controls: Scenes & Kill Switches

All live runtime adjustments execute instantly through the stand CLI without redeploying code or refreshing client browsers.

### Screen Scene Commands
\`\`\`sh
# Default: Main observatory 3D view of all active celestial bodies
pnpm --filter @little-galaxy/stand control scene galaxy

# Big QR: Enlarges join QR code to fill TV display (ideal for opening/closing rushes)
pnpm --filter @little-galaxy/stand control scene bigQr

# Spotlight: Automatically focuses camera and announces newly launched bodies
pnpm --filter @little-galaxy/stand control scene spotlight

# Cinematic: Slow panoramic idle camera sweeping around the galaxy
pnpm --filter @little-galaxy/stand control scene cinematic

# Timelapse: Visual scrubber of the historical replay from fair opening
pnpm --filter @little-galaxy/stand control scene timelapse
\`\`\`

### Feature Kill Switches (Instant Mitigation)
\`\`\`sh
# Disable aurora shake waves (saves ~25% of total fair writes)
pnpm --filter @little-galaxy/stand control flag shake off

# Disable swipe comets
pnpm --filter @little-galaxy/stand control flag comets off

# Disable shooting star messages
pnpm --filter @little-galaxy/stand control flag shootingStars off

# Disable scheduled ambient meteor showers
pnpm --filter @little-galaxy/stand control flag meteorShowers off

# Disable planet parameter editing in the workshop
pnpm --filter @little-galaxy/stand control flag edits off

# Halt new launches (locks galaxy into read-only viewing mode)
pnpm --filter @little-galaxy/stand control flag launches off

# Silence booth screen audio (operator suppression; sets both sound and soundOnScreen)
pnpm --filter @little-galaxy/stand control flag sound off

# Silence booth screen audio only (leaves phone audio intact)
pnpm --filter @little-galaxy/stand control flag soundOnScreen off

# Disable automatic spotlight camera zoom on new launches
pnpm --filter @little-galaxy/stand control flag spotlight off

# Re-enable any feature (e.g. restores shake or sound)
pnpm --filter @little-galaxy/stand control flag shake on
pnpm --filter @little-galaxy/stand control flag sound on
\`\`\`

The same \`flag <name> <on|off>\` syntax supports \`launches\`, \`edits\`, \`shake\`, \`comets\`, \`shootingStars\`, \`meteorShowers\`, \`soundOnScreen\`, \`sound\`, \`spotlight\`, and \`seasonOpen\`. \`sound\` sets both audio flags (\`sound\` and \`soundOnScreen\`).

### Timing Adjustments
\`\`\`sh
# Change cinematic camera idle timeout (seconds of inactivity before cinematic mode starts)
pnpm --filter @little-galaxy/stand control timing idleSeconds 45

# Adjust ambient meteor shower frequency (minimum and maximum interval in seconds)
pnpm --filter @little-galaxy/stand control timing meteorMinSeconds 300
pnpm --filter @little-galaxy/stand control timing meteorMaxSeconds 900
\`\`\`

---

## 6. Restarting the Stand Daemon

If the stand process terminates or is accidentally closed:
1. Open a terminal on the booth laptop.
2. Check if a zombie process is still running:
   \`\`\`sh
   pgrep -fl "little-galaxy/stand"
   \`\`\`
3. Restart the stand process:
   \`\`\`sh
   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/private/serviceAccountKey.json
   export FIREBASE_PROJECT_ID=little-galaxy
   pnpm --filter @little-galaxy/stand start
   \`\`\`
4. Verify output logs confirm startup:
   \`\`\`text
   Little Galaxy stand v1.0.0 | languages: en, es | default: en
   \`\`\`
5. The snapshot writer immediately resumes updating \`snapshots/live\`.

---

## 7. Emergency Rollback Procedure

If a newly promoted version causes issues on visitor devices or the booth TV, rollback to the previous known-good release in a single command using the portfolio deploy tooling.

### Exact Rollback Command

For the captain, from \`~/Fauns/wt/portfolio-v0.3.0\`:

\`\`\`sh
# 1. Preview the rollback target release (dry run)
pnpm run rollback -- --dry-run
# (or directly: node scripts/rollback.mjs --dry-run)

# 2. Execute instantaneous atomic rollback to previous Hosting release
pnpm run rollback
# (or with automatic confirmation: node scripts/rollback.mjs --yes)
\`\`\`

*(From the Galaxy worktree, the same script can be invoked directly: \`node ../portfolio-v0.3.0/scripts/rollback.mjs --dry-run\` or \`node ../portfolio-v0.3.0/scripts/rollback.mjs --yes\`).*

Rollback creates a new live Hosting release of the previous version after revalidation and confirmation. It does not change \`games.json\`. Changing the pinned Git release for a future build is a separate captain-owned Git operation. Config \`appVersion\` does not need to match either direction for browsers to settle.

### Pre-Deploy Verification & Hosted Smoke

Before promoting a preview or during deployment rehearsal, verify the build and test against the preview URL:

From \`~/Fauns/wt/portfolio-v0.3.0\`:
\`\`\`sh
# Deploy local Galaxy checkout to an isolated preview channel and smoke test
pnpm run deploy-local -- --galaxy ../galaxy-v1.0.0
\`\`\`

From Galaxy (\`~/Fauns/wt/galaxy-v1.0.0\`):
\`\`\`sh
# Read-only smoke check against a deployed preview channel (blocks all writes/mutations)
BASE_URL=https://<preview-domain> pnpm exec playwright test --config tests/ui/playwright.config.js
\`\`\`

\`BASE_URL\` selects only \`smoke-preview.spec.js\`. It installs a context route before opening any page and blocks every non-read request except Firebase's POST read/listen endpoints. Auth signup, Firestore commits, write channels and unknown POSTs are blocked before transmission. Service workers are blocked. Pages use \`?smoke=readonly\`, which rejects application authentication/UID acquisition before anonymous sign-up; normal authenticated live data is therefore unavailable in this fresh smoke context. The preview check asserts static workshop/screen surfaces and their graceful disconnected states, not a connected launch. Never run local mutation specs against a hosted URL. The connected test requires local demo emulators and fails before seeding otherwise.

### Expected Rollback Behavior
- Firebase Hosting atomically updates the live site pointer to the previous release.
- Active phone and screen browser tabs catch missing asset chunks and trigger a single soft reload via \`galaxy.reload_guard\`.
- All visitor workshop drafts, selected colors, and screen camera positions are preserved through \`localStorage\`.

---

## 8. Backup Video Recording (Rehearsal Procedure)

A fallback video ensures the booth display remains vibrant even in the event of total network or laptop failure.

### Option A: Automated Playwright 1080p Recording Script
Execute the provided automated recording script on the laptop:
\`\`\`sh
# Record 30 seconds of high-resolution 1080p screen animation to records/
node scripts/record-screen.mjs --duration 30 --output records/
\`\`\`

### Option B: Free OBS Studio Recording
1. Open OBS Studio on the laptop.
2. Add Source -> **Window Capture** -> Select browser window showing \`/galaxy/screen\`.
3. Press **\`F\`** on the screen to enter fullscreen presentation.
4. In OBS Settings -> Video: Base Canvas \`1920×1080\`, Output \`1920×1080\`, 60 FPS.
5. In OBS Settings -> Output: Recording Format: \`MP4\`.
6. Click **Start Recording**, record 5 minutes of galaxy motion, then click **Stop Recording**.
7. Keep this MP4 file on the desktop as an emergency video player loop (e.g. VLC in fullscreen loop mode).

---

## 9. Visitor-Facing Incident Responses (What to Say)

If a technical issue arises during public hours, maintain calm and professional communication using these bilingual explanations:

| Incident | Visitor Explanation (Español) | Visitor Explanation (English) |
|---|---|---|
| **Temporary network drop** | "Estamos recalibrando los sensores del observatorio; los planetas continúan su curso orbital sin interrupciones." | "The observatory is calibrating telemetry; all celestial bodies continue orbiting smoothly in real time." |
| **Shake/Comets paused (quota)** | "La magnetosfera de la galaxia está absorbiendo una tormenta solar temporal. La creación de planetas sigue abierta." | "The galaxy magnetosphere is absorbing a brief solar storm; planet workshop and launches remain active." |
| **Launches paused (quota limit)** | "El cielo ha alcanzado su capacidad gravitacional máxima para esta hora. En breve abriremos una nueva ventana de lanzamiento." | "The sky has reached gravitational capacity for this hour; our next launch window will open shortly." |
| **Phone reload / sync delay** | "Tu diseño espacial está guardado de forma segura en tu teléfono; en cuanto reconecte se lanzará directamente." | "Your planet design is safely saved on your device; it will launch into the sky as soon as connection reconnects." |

---

## 10. Closing the Day (Season Freeze Protocol)

When the fair concludes, follow this exact sequence to freeze the season for permanent archival:

### Step 1: Close the Live Season
\`\`\`sh
pnpm --filter @little-galaxy/stand control flag launches off
pnpm --filter @little-galaxy/stand control flag seasonOpen off
\`\`\`

### Step 2: Export Static Season Files
Export all objects and historical event logs into a standalone static directory:
\`\`\`sh
pnpm --filter @little-galaxy/stand freeze-season /tmp/season-bad-2026-export
\`\`\`

### Step 3: Verify Exported Files
Confirm the exported archive contains the complete season manifest and partition chunks:
\`\`\`sh
ls -la /tmp/season-bad-2026-export
\`\`\`
Expected files:
- \`manifest.json\` (season metadata, object count, timestamp bounds)
- \`objects-0.json\` through \`objects-f.json\` (partitioned object records)
- \`log-*.json\` (content-addressed timelapse event chunks)

---

## 11. Dry-Run Verification Evidence

Every command listed in this runbook was tested and validated against local Firebase emulators on 2026-10-23.

\`\`\`text
=== 1. Stand Seed ===
$ pnpm --filter @little-galaxy/stand exec tsx src/seed-demo.ts
Demo launch window opened. No live project was accessed.

=== 2. Stand Control: Open Season ===
$ tsx src/index.ts control flag seasonOpen on
Little Galaxy stand v1.0.0 | languages: en, es | default: en
Live controls updated.

=== 3. Stand Control: Enable Launches ===
$ tsx src/index.ts control flag launches on
Little Galaxy stand v1.0.0 | languages: en, es | default: en
Live controls updated.

=== 4. Stand Control: Scene BigQr ===
$ tsx src/index.ts control scene bigQr
Little Galaxy stand v1.0.0 | languages: en, es | default: en
Live controls updated.

=== 5. Stand Control: Scene Spotlight ===
$ tsx src/index.ts control scene spotlight
Little Galaxy stand v1.0.0 | languages: en, es | default: en
Live controls updated.

=== 6. Stand Control: Scene Galaxy ===
$ tsx src/index.ts control scene galaxy
Little Galaxy stand v1.0.0 | languages: en, es | default: en
Live controls updated.

=== 7. Stand Control: Kill Switch Shake Off ===
$ tsx src/index.ts control flag shake off
Little Galaxy stand v1.0.0 | languages: en, es | default: en
Live controls updated.

=== 8. Stand Control: Restore Shake On ===
$ tsx src/index.ts control flag shake on
Little Galaxy stand v1.0.0 | languages: en, es | default: en
Live controls updated.

=== 9. Portfolio Rollback Dry Run ===
node ../portfolio-v0.3.0/scripts/rollback.mjs --dry-run
[dry-run] would require GOOGLE_APPLICATION_CREDENTIALS (outside the repository or in private/)
[dry-run] GET alexanderkholodov/alexanderkholodov live channel (current release) and its releases (all pages, ordered by releaseTime)
[dry-run] would show the live version and the previous version, then ask for the word "rollback" (or --yes)
[dry-run] POST live channel release with versionName = previous version
CI path: revert the games.json pin (git revert the commit that changed it) and merge; the main workflow redeploys the previous game release.

=== 10. Stand Freeze Season ===
$ tsx src/index.ts freeze-season /tmp/dryrun-freeze
Little Galaxy stand v1.0.0 | languages: en, es | default: en
Season exported; live configuration unchanged.
-rw-rw-r-- manifest.json
-rw-rw-r-- objects-0.json ... objects-f.json
\`\`\`
`;
