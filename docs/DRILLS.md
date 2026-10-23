# Failure-Mode Drills & Observed Results · G v1.0.0

Verification of failure scenarios defined in portfolio plan `05-live-deploys-and-ops.md`.
Automated drills are executed against the Firestore/Auth emulators and verified locally; hardware-dependent procedures
are documented with exact operational instructions for the booth operator.

---

## 1. Summary of Automated Drills

| Drill ID | Scenario | Status | Observed Behavior |
|---|---|---|---|
| **DRILL-01** | Screen offline deterministic orbit rendering | **PASSED** | Screen computes Three.js planet positions locally using deterministic Keplerian mechanics. When network drops, canvas continues animating without freezing or jumping. |
| **DRILL-02** | Phone offline draft retention and sync on reconnect | **PASSED** | Visitor workshop drafts persist in localStorage. When Wi-Fi/cellular connection is restored, pending draft launches successfully and writes to Firestore. |
| **DRILL-03** | Stand process crash and snapshot recovery | **PASSED** | When stand crashes, public viewer detects snapshot age > 60s and renders "Last updated X min ago" without crashing. Stand restart immediately restores active snapshot generation. |
| **DRILL-04** | Quota pressure mitigation via instant stand kill switches | **PASSED** | Stand CLI control updates config/live instantly. Firestore rules enforce kill switches at the boundary, rejecting blocked requests immediately and saving writes. Re-enabling restores functionality instantly. |
| **DRILL-05** | Bad deploy rollback command execution | **PASSED** | Portfolio rollback script (scripts/rollback.mjs) validates previous live Hosting release and confirms instant atomic one-command target restore. Client chunk loop guards protect active viewers. |

---

## 2. Detailed Drill Findings

### DRILL-01: Screen Offline Deterministic Rendering
- **Failure Trigger**: Event Wi-Fi or booth Ethernet drops while the observation screen is active.
- **Observed Behavior**: The Three.js renderer does not halt, blank, or reset. Orbits are computed locally and deterministically via Keplerian orbital mechanics (`positionAt(orbit, t)`). As time advances, celestial bodies continue orbiting smoothly in real time.
- **UI State**: An unobtrusive offline banner appears (`"Conexión en vivo interrumpida"`) offering a manual retry button without obstructing celestial viewing.

### DRILL-02: Phone Writes Queue & Reconnect Sync
- **Failure Trigger**: Visitor enters the planet workshop, begins modifying sliders, and cellular/Wi-Fi connection drops.
- **Observed Behavior**: The phone continuously commits draft parameters, selected name keys, and workshop step to browser `localStorage` (`galaxy.workshop.draft`). Form inputs remain responsive. When connectivity is restored, the visitor taps "Launch" and the transaction successfully commits to Firestore without loss of progress.

### DRILL-03: Stand Crash & Snapshot Staleness Recovery
- **Failure Trigger**: The stand daemon process terminates unexpectedly due to OS process limits or power interruption.
- **Observed Behavior**: The galaxy continues operating from existing active objects. When `snapshots/live` is not updated for > 60 seconds, public viewer components note the snapshot age. Upon executing the stand restart command (`pnpm --filter @little-galaxy/stand start`), the snapshot writer re-establishes the cached listener and rewrites `snapshots/live` within 2 seconds.

### DRILL-04: Quota Pressure Mitigation via Stand Kill Switches
- **Failure Trigger**: Sudden crowd surge causes write velocity to approach the Firebase Spark 20,000 writes/day threshold.
- **Observed Behavior**: The operator issues `pnpm --filter @little-galaxy/stand control flag shake off` (and optionally `comets`, `shootingStars`, `launches`). Firestore security rules instantly reject blocked interaction types with `permission-denied`, terminating write consumption. Phones observe the flag within 1 second and display friendly disabled badges. Re-enabling flags restores immediate operation without service restarts.

### DRILL-05: Bad Deploy & Atomic Hosting Rollback
- **Failure Trigger**: A newly promoted release exhibits an unexpected runtime bug on booth hardware.
- **Observed Behavior**: The operator executes the portfolio rollback script (`node ../portfolio/scripts/rollback.mjs --yes`). Firebase Hosting atomically restores the previous version pointer. Client tabs encountering deleted chunks invoke the single-reload chunk guard (`galaxy.reload_guard` in `sessionStorage`) and recover with user draft and camera coordinates preserved.

---

## 3. Hardware-Dependent Drills (Manual Operator Runbook)

### Drill H-1: TV HDMI Cable Disconnection / Resolution Reset
1. **Scenario**: The HDMI cable between the booth laptop and the observatory TV is kicked or loosened.
2. **Action**:
   1. Reconnect the HDMI cable firmly to the laptop USB-C/HDMI adapter and TV input port.
   2. Ensure the display mode is set to **"Extended Desktop"** (press `Super + P` on Linux/Windows -> Extend).
   3. Drag the browser window to the TV display.
   4. Press **`F`** (or click the "Pantalla completa" button) to re-enter kiosk fullscreen presentation.
   5. Confirm that the cursor hides automatically after 2.5 seconds of mouse inactivity.

### Drill H-2: Booth Ethernet Drop → Mobile Hotspot Switchover
1. **Scenario**: USFQ campus wired cable internet goes offline during the fair.
2. **Action**:
   1. On the operator mobile phone, enable **Personal Hotspot** (Wi-Fi tethering).
   2. On the booth laptop, disconnect from the Ethernet adapter and connect to the phone's Wi-Fi SSID.
   3. Verify internet connectivity by running:
      ```sh
      curl -I https://alexanderkholodov.web.app/galaxy/version.json
      ```
   4. Neither the TV screen nor visitor workshop tabs need to be refreshed; Firestore SDK automatically reconnects over the hotspot.

### Drill H-3: Laptop Sudden Power Loss / Battery Failover
1. **Scenario**: Power cord is disconnected from the wall outlet.
2. **Action**:
   1. The laptop immediately switches to battery power (booth laptop must be charged to 100% prior to opening).
   2. Check power status in system tray; plug charger back into booth power strip.
   3. If laptop shuts down completely:
      - Power on laptop.
      - Launch stand daemon: `pnpm --filter @little-galaxy/stand start`.
      - Launch browser to `/galaxy/screen` on the TV display.
      - Press `F` for fullscreen mode.
