# Failure-Mode Drills · G v1.0.0

The five automated drills are **building-block checks**, not completed outage acceptance.
They run against Firestore/Auth emulators. Passing all five does not certify booth recovery.
Hardware-dependent drills (network interruption, HDMI, power failover) are manual operator steps
listed below and **not yet run**.

**Results: 5 passed, 0 failed out of 5 automated drills.**

---

## Automated Drill Results

| Drill | Scenario | Status | What was actually tested |
|---|---|---|---|
| **DRILL-01** | Orbit position advances deterministically without network | **PASSED** | positionAt(orbit, t) computed two positions 202ms apart: delta=0.520520. Same timestamp reproduced identical coordinates: deterministic=true. No server call was made. |
| **DRILL-02** | Draft JSON round-trip and launch from restored data | **PASSED** | Draft serialized to 74 bytes, restored, and launched as object ytEBQ6qTRUSx1rXKw88K (status: active). Round-trip fidelity: true. This verifies the data path but does not exercise actual localStorage, offline network interruption, or browser reload. |
| **DRILL-03** | Snapshot staleness detection and timestamp recovery | **PASSED** | Wrote snapshot with timestamp 95s ago (stale=true). Updated timestamp; new age 0s (recovered=true). This verifies Firestore timestamp mechanics but does not start/crash/restart an actual stand process or open a public viewer. |
| **DRILL-04** | Kill switch config update and helper-level enforcement | **PASSED** | Set config/live shake=false via applyControl. sendInteraction threw "closed" (blocked=true). Re-enabled shake=true; sendInteraction succeeded (restored=true). The helper reads config/live and rejects before writing. Separate rules tests verify boundary enforcement; this drill verifies the config update propagates to the client helper. |
| **DRILL-05** | Rollback dry-run verification | **PASSED** | Dry-run logged 5 steps including a prospective POST (using vendored rollback fixture). No actual Hosting API calls were made. This does not exercise a real release selection, browser chunk recovery, or live rollback. |

---

## What These Drills Cover and Do Not Cover

### DRILL-01: Orbit Determinism
- **Tests**: `positionAt(orbit, t)` produces advancing, reproducible coordinates from pure math.
- **Does not test**: Actual browser canvas rendering, offline banner display, or network disconnection.

### DRILL-02: Draft Serialization and Launch
- **Tests**: Draft JSON round-trips through serialization and launches successfully from restored data.
- **Does not test**: Actual `localStorage` persistence, browser offline mode, reload, or reconnection.

### DRILL-03: Snapshot Staleness
- **Tests**: A Firestore timestamp written 95s ago reads as stale (>60s); a fresh write reads as current.
- **Does not test**: Actual stand process start/crash/restart, public viewer UI, or recovery timing.

### DRILL-04: Kill Switch Enforcement
- **Tests**: `applyControl` updates `config/live`; the client helper reads the flag and rejects before writing; re-enabling restores the operation.
- **Does not test**: Firestore security rules boundary enforcement directly (covered by `test:rules`), phone UI update latency, or disabled badges.

### DRILL-05: Rollback Dry-Run
- **Tests**: The portfolio rollback script (or vendored contract fixture in standalone environments) in dry-run mode logs the expected prospective Hosting API call sequence.
- **Does not test**: Actual Hosting release selection, live rollback, browser chunk recovery, or draft preservation through reload. The separate live-safety test exercises real build-swap chunk recovery.

---

## Hardware-Dependent Drills (Manual, Not Yet Run)

These operator checks validate the actual booth/network. Some pieces can be simulated in
software, but no physical-network or equipment recovery is certified by these checks.

### Browser disconnection building block (separate from the five checks)
Run `pnpm run test:ui` to execute the connected Playwright smoke suite against emulators.
Its offline-to-online case disconnects an actual browser context, changes and saves a draft,
checks that offline launch controls are disabled, reconnects and reloads, verifies localStorage draft
restoration with no automatic launch, then launches with a fresh visitor action. This covers
browser network emulation only, not campus connectivity or an offline reload of uncached HTML.

### Drill H-0: Event Internet Outage and Stand Crash / Restart
1. Start the actual stand, public Home, live TV and a phone workshop on booth hardware.
2. Disconnect the booth uplink; retain the TV tab. Confirm the last sky keeps moving and draft edits persist on the phone. Do not promise queued launch replay.
3. Reconnect or switch to hotspot. Confirm live updates resume; ask the visitor to press Launch again and observe receipt on the TV.
4. Stop the stand process, leaving clients open. Wait beyond the stale threshold and observe the public Home last-updated/stale state while the sky continues locally.
5. Restart the stand using the appropriate RUNBOOK environment exports. Confirm a fresh snapshot and removal of the stale indication. Record the observed times.
6. Status: not yet run on booth hardware.

### Drill H-4: Quota Pressure, Bad Release and Total Failure
1. With a phone designing and TV live, turn off the documented interaction flags. Observe disabled phone controls and continued sky rendering, then restore flags.
2. Captain/operator: rehearse the approved portfolio rollback with a known previous release and verify both phone draft and TV recovery. This checkout's fixture does not validate Hosting.
3. Disconnect live services entirely, play the identified rehearsal backup fullscreen, and scan its QR from a separate phone on the intended network.
4. Status: not yet run; do not exhaust real quotas or deploy as part of automated checks.

### Drill H-1: TV HDMI Cable Disconnection / Resolution Reset
1. **Scenario**: The HDMI cable between the booth laptop and the TV is loosened.
2. **Steps**:
   1. Reconnect the HDMI cable to the laptop adapter and TV input.
   2. Set display mode to **Extended Desktop** (`Super + P` → Extend).
   3. Drag browser window to TV display.
   4. Press **`F`** to re-enter fullscreen presentation.
   5. Confirm cursor hides after 2.5 seconds of inactivity.
3. **Status**: Not yet run.

### Drill H-2: Booth Ethernet Drop → Mobile Hotspot
1. **Scenario**: Campus wired internet goes offline during the fair.
2. **Steps**:
   1. Enable Personal Hotspot on operator phone.
   2. Connect laptop Wi-Fi to phone hotspot.
   3. Verify connectivity: `curl -I https://alexanderkholodov.web.app/galaxy/version.json`
   4. Firestore SDK reconnects automatically; no refresh needed.
3. **Status**: Not yet run.

### Drill H-3: Laptop Power Loss / Battery Failover
1. **Scenario**: Power cord disconnected from wall outlet.
2. **Steps**:
   1. Laptop switches to battery (must be 100% charged before opening).
   2. Reconnect charger to power strip.
   3. If laptop shuts down: power on, start stand, open `/galaxy/screen`, press `F`.
3. **Status**: Not yet run.
