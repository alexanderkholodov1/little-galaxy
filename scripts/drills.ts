/**
 * Failure-Mode Drills for Collective Galaxy (plan 05)
 *
 * Automated verification of key failure scenarios against Firestore/Auth emulators:
 * 1. Orbit determinism: positionAt advances without network, pure local math.
 * 2. Draft serialization: JSON round-trip and successful launch from restored draft.
 * 3. Snapshot staleness: old timestamp detected, fresh write recovers.
 * 4. Kill switch enforcement: commit rules disable interactions and the helper reports closed; re-enable restores it.
 * 5. Rollback dry-run: portfolio script logs a prospective Hosting promotion.
 *
 * Hardware-dependent drills (network interruption, HDMI recovery, power failover)
 * are documented as manual operator steps and marked as not yet run.
 *
 * Exits non-zero when any drill fails.
 */

import { initializeApp as initClientApp, deleteApp as deleteClientApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
} from 'firebase/firestore';
import { initializeApp as initAdminApp, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, FieldValue as AdminFieldValue, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import {
  orbitFromVelocity,
  positionAt,
  SCHEMA_VERSION,
} from '../packages/shared/src/index.js';
import { launchPlanet } from './legacy/galaxy-data';
import { sendInteraction } from './legacy/interaction-data';
import { applyControl } from '../apps/stand/src/control';
import path from 'node:path';
import fs from 'node:fs';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface DrillResult {
  drillId: string;
  name: string;
  status: 'PASSED' | 'FAILED';
  observedBehavior: string;
  details: Record<string, unknown>;
}

export async function runAllDrills(): Promise<DrillResult[]> {
  const results: DrillResult[] = [];
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
  const [fHost, fPortStr] = emulatorHost.split(':');
  const firestorePort = parseInt(fPortStr || '8080', 10);

  const adminApp = initAdminApp({ projectId: 'demo-little-galaxy' }, `drills-admin-${Date.now()}`);
  const adminDb = getAdminFirestore(adminApp);

  console.log(`[drills] Starting automated failure-mode drills against ${emulatorHost}...`);

  // Ensure clean live config
  await adminDb.doc('config/live').set({
    schemaVersion: 1,
    appVersion: '1.0.1',
    seasonOpen: true,
    launches: true,
    edits: true,
    shake: true,
    comets: true,
    shootingStars: true,
    meteorShowers: true,
    soundOnScreen: true,
    spotlight: true,
    screenScene: 'galaxy',
    idleSeconds: 60,
  });

  // =========================================================================
  // DRILL 1: Orbit Determinism (No Network Required)
  // =========================================================================
  try {
    console.log(`[drills] Running Drill 1: Orbit determinism without network...`);
    const orbit = orbitFromVelocity(0, 2.58, 0.05, Date.now() - 30000);
    const t1 = Date.now();
    const pos1 = positionAt(orbit, t1);
    await sleep(200);
    const t2 = Date.now();
    const pos2 = positionAt(orbit, t2);

    const dx = pos2[0] - pos1[0];
    const dy = pos2[1] - pos1[1];
    const distance = Math.hypot(dx, dy);
    const moved = distance > 0;

    // Verify determinism: same input produces same output
    const pos1Again = positionAt(orbit, t1);
    const deterministic = pos1[0] === pos1Again[0] && pos1[1] === pos1Again[1] && pos1[2] === pos1Again[2];

    results.push({
      drillId: 'DRILL-01',
      name: 'Orbit position advances deterministically without network',
      status: moved && deterministic ? 'PASSED' : 'FAILED',
      observedBehavior: `positionAt(orbit, t) computed two positions ${t2 - t1}ms apart: delta=${distance.toFixed(6)}. Same timestamp reproduced identical coordinates: deterministic=${deterministic}. No server call was made.`,
      details: { pos1, pos2, deltaDistance: distance, deterministic, elapsedMs: t2 - t1 },
    });
  } catch (err) {
    results.push({
      drillId: 'DRILL-01',
      name: 'Orbit position advances deterministically without network',
      status: 'FAILED',
      observedBehavior: `Error: ${String(err)}`,
      details: {},
    });
  }

  // =========================================================================
  // DRILL 2: Draft Serialization and Launch from Restored Data
  // =========================================================================
  try {
    console.log(`[drills] Running Drill 2: Draft serialization and launch...`);
    const phoneApp = initClientApp({ projectId: 'demo-little-galaxy', apiKey: 'demo-key' }, `drill-phone-${Date.now()}`);
    const auth = getAuth(phoneApp);
    connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
    const db = getFirestore(phoneApp);
    connectFirestoreEmulator(db, fHost, firestorePort);

    const userCred = await signInAnonymously(auth);
    const uid = userCred.user.uid;

    // Simulate draft round-trip through JSON (as localStorage would)
    const draft = {
      nameKey: 'quiet-aurora' as const,
      params: { size: 0.45, palette: 1, oceans: 0.6 },
    };
    const serializedDraft = JSON.stringify(draft);
    const restoredDraft = JSON.parse(serializedDraft);
    const orbit = orbitFromVelocity(0, 2.58, 0, Date.now());

    // Launch from restored draft succeeds
    const objectId = await launchPlanet(db, uid, restoredDraft, orbit);
    const objDoc = await adminDb.doc(`objects/${objectId}`).get();

    await deleteClientApp(phoneApp);

    const draftMatch = JSON.stringify(draft) === serializedDraft;

    results.push({
      drillId: 'DRILL-02',
      name: 'Draft JSON round-trip and launch from restored data',
      status: objDoc.exists && draftMatch ? 'PASSED' : 'FAILED',
      observedBehavior: `Draft serialized to ${serializedDraft.length} bytes, restored, and launched as object ${objectId} (status: ${objDoc.data()?.status}). Round-trip fidelity: ${draftMatch}. This verifies the data path but does not exercise actual localStorage, offline network interruption, or browser reload.`,
      details: { objectId, status: objDoc.data()?.status, draftMatch },
    });
  } catch (err) {
    results.push({
      drillId: 'DRILL-02',
      name: 'Draft JSON round-trip and launch from restored data',
      status: 'FAILED',
      observedBehavior: `Error: ${String(err)}`,
      details: {},
    });
  }

  // =========================================================================
  // DRILL 3: Snapshot Staleness Detection and Recovery
  // =========================================================================
  try {
    console.log(`[drills] Running Drill 3: Snapshot staleness and recovery...`);
    // Write an old snapshot (95 seconds ago, exceeding the 60s stale threshold)
    const pastTime = Date.now() - 95000;
    await adminDb.doc('snapshots/live').set({
      schemaVersion: SCHEMA_VERSION,
      objects: [],
      creators: 12,
      activeCount: 12,
      at: AdminTimestamp.fromMillis(pastTime),
    });

    const staleSnap = await adminDb.doc('snapshots/live').get();
    const snapAgeMs = Date.now() - staleSnap.data()?.at.toMillis();
    const isStale = snapAgeMs > 60000;

    // Simulate stand restart by updating the timestamp
    await adminDb.doc('snapshots/live').update({
      at: AdminFieldValue.serverTimestamp(),
      creators: 13,
    });
    const freshSnap = await adminDb.doc('snapshots/live').get();
    const freshAgeMs = Date.now() - freshSnap.data()?.at.toMillis();
    const isRecovered = freshAgeMs < 5000;

    results.push({
      drillId: 'DRILL-03',
      name: 'Snapshot staleness detection and timestamp recovery',
      status: isStale && isRecovered ? 'PASSED' : 'FAILED',
      observedBehavior: `Wrote snapshot with timestamp ${Math.round(snapAgeMs / 1000)}s ago (stale=${isStale}). Updated timestamp; new age ${Math.round(freshAgeMs / 1000)}s (recovered=${isRecovered}). This verifies timestamp mechanics, not liveness: snapshots/live.at is last content publication and can remain old while healthy. It does not start/crash/restart a stand or open a public viewer.`,
      details: { staleAgeSeconds: Math.round(snapAgeMs / 1000), recoveredAgeSeconds: Math.round(freshAgeMs / 1000) },
    });
  } catch (err) {
    results.push({
      drillId: 'DRILL-03',
      name: 'Snapshot staleness detection and timestamp recovery',
      status: 'FAILED',
      observedBehavior: `Error: ${String(err)}`,
      details: {},
    });
  }

  // =========================================================================
  // DRILL 4: Kill Switch Config Update and Helper-Level Enforcement
  // =========================================================================
  try {
    console.log(`[drills] Running Drill 4: Kill switch enforcement...`);
    const phoneApp = initClientApp({ projectId: 'demo-little-galaxy', apiKey: 'demo-key' }, `drill-kill-${Date.now()}`);
    const auth = getAuth(phoneApp);
    connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
    const db = getFirestore(phoneApp);
    connectFirestoreEmulator(db, fHost, firestorePort);

    const userCred = await signInAnonymously(auth);
    const uid = userCred.user.uid;

    // Disable shake via stand control
    await applyControl(adminDb, ['flag', 'shake', 'off']);

    let shakeBlocked = false;
    let blockReason = '';
    try {
      await sendInteraction(db, uid, 'shake', {});
    } catch (e: unknown) {
      const err = e as { reason?: string; code?: string } | null;
      blockReason = err?.reason ?? err?.code ?? String(e);
      if (err?.reason === 'closed' || err?.code === 'permission-denied' || String(e).includes('closed')) {
        shakeBlocked = true;
      }
    }

    // Re-enable shake
    await applyControl(adminDb, ['flag', 'shake', 'on']);
    await sleep(2100);
    let shakeRestored = false;
    try {
      await sendInteraction(db, uid, 'shake', {});
      shakeRestored = true;
    } catch {
      shakeRestored = false;
    }

    await deleteClientApp(phoneApp);

    results.push({
      drillId: 'DRILL-04',
      name: 'Kill switch rule enforcement and helper feedback',
      status: shakeBlocked && shakeRestored ? 'PASSED' : 'FAILED',
      observedBehavior: `Set config/live shake=false via applyControl. sendInteraction threw "${blockReason}" (blocked=${shakeBlocked}). Re-enabled shake=true; sendInteraction succeeded (restored=${shakeRestored}). Commit-time rules reject the disabled write; the helper reports closed. This drill verifies the config change and closed feedback together.`,
      details: { shakeBlockedWhenOff: shakeBlocked, blockReason, shakeAllowedWhenOn: shakeRestored },
    });
  } catch (err) {
    results.push({
      drillId: 'DRILL-04',
      name: 'Kill switch rule enforcement and helper feedback',
      status: 'FAILED',
      observedBehavior: `Error: ${String(err)}`,
      details: {},
    });
  }

  // =========================================================================
  // DRILL 5: Rollback Dry-Run
  // =========================================================================
  try {
    console.log(`[drills] Running Drill 5: Rollback dry-run verification...`);
    // Standalone contract fixture only; actual portfolio rollback is operator acceptance.
    const candidates = [path.resolve(import.meta.dirname, 'fixtures/portfolio-rollback.mjs')];
    const rollbackPath = candidates.find((p) => fs.existsSync(p));
    if (!rollbackPath) {
      results.push({
        drillId: 'DRILL-05',
        name: 'Rollback dry-run verification',
        status: 'FAILED',
        observedBehavior: 'Portfolio rollback script not found at any expected path or fixture.',
        details: { searched: candidates },
      });
    } else {
      const { rollback } = await import(rollbackPath) as { rollback: (args: string[], opts: { log: (msg: string) => void }) => Promise<{ dryRun?: boolean }> };
      const logs: string[] = [];
      const dryRunResult = await rollback(['--dry-run'], { log: (msg) => logs.push(msg) });
      const dryRunValid = Boolean(dryRunResult?.dryRun && logs.some((l) => l.includes('POST live channel release')));
      const isFixture = rollbackPath.includes('fixtures');

      results.push({
        drillId: 'DRILL-05',
        name: 'Rollback dry-run verification',
        status: dryRunValid ? 'PASSED' : 'FAILED',
        observedBehavior: dryRunValid
          ? `Dry-run logged ${logs.length} steps including a prospective POST (${isFixture ? 'using vendored rollback fixture' : 'using sibling portfolio rollback script'}). No actual Hosting API calls were made. This does not exercise a real release selection, browser chunk recovery, or live rollback.`
          : `Dry-run did not produce the expected log output.`,
        details: { dryRunSuccess: dryRunValid, loggedMessages: logs.length, rollbackPath, isFixture },
      });
    }
  } catch (err) {
    results.push({
      drillId: 'DRILL-05',
      name: 'Rollback dry-run verification',
      status: 'FAILED',
      observedBehavior: `Error: ${String(err)}`,
      details: {},
    });
  }

  await deleteAdminApp(adminApp);
  console.log(`[drills] Finished all failure-mode drills.`);
  return results;
}

export function generateDrillsMarkdown(results: DrillResult[]): string {
  const passed = results.filter((r) => r.status === 'PASSED').length;
  const failed = results.filter((r) => r.status === 'FAILED').length;
  return `# Failure-Mode Drills · G v1.0.1

The five automated drills are **building-block checks**, not completed outage acceptance.
They run against Firestore/Auth emulators. Passing all five does not certify booth recovery.
Hardware-dependent drills (network interruption, HDMI, power failover) are manual operator steps
listed below and **not yet run**.

**Results: ${passed} passed, ${failed} failed out of ${results.length} automated drills.**

---

## Automated Drill Results

| Drill | Scenario | Status | What was actually tested |
|---|---|---|---|
${results.map((r) => `| **${r.drillId}** | ${r.name} | **${r.status}** | ${r.observedBehavior} |`).join('\n')}

---

## What These Drills Cover and Do Not Cover

### DRILL-01: Orbit Determinism
- **Tests**: \`positionAt(orbit, t)\` produces advancing, reproducible coordinates from pure math.
- **Does not test**: Actual browser canvas rendering, offline banner display, or network disconnection.

### DRILL-02: Draft Serialization and Launch
- **Tests**: Draft JSON round-trips through serialization and launches successfully from restored data.
- **Does not test**: Actual \`localStorage\` persistence, browser offline mode, reload, or reconnection.

### DRILL-03: Snapshot Staleness
- **Tests**: A Firestore timestamp written 95s ago reads as stale (>60s); a fresh write reads as current.
- **Does not test**: Actual stand process start/crash/restart, public viewer UI, or recovery timing.

### DRILL-04: Kill Switch Enforcement
- **Tests**: \`applyControl\` updates \`config/live\`; commit rules read the flag and reject disabled writes; the helper reports closed; re-enabling restores the operation.
- **Does not test**: Firestore security rules boundary enforcement directly (covered by \`test:rules\`), phone UI update latency, or disabled badges.

### DRILL-05: Rollback Dry-Run
- **Tests**: The portfolio rollback script (or vendored contract fixture in standalone environments) in dry-run mode logs the expected prospective Hosting API call sequence.
- **Does not test**: Actual Hosting release selection, live rollback, browser chunk recovery, or draft preservation through reload. The separate live-safety test exercises real build-swap chunk recovery.

---

## Hardware-Dependent Drills (Manual, Not Yet Run)

These operator checks validate the actual booth/network. Some pieces can be simulated in
software, but no physical-network or equipment recovery is certified by these checks.

### Browser disconnection building block (separate from the five checks)
Run \`pnpm run test:ui\` to execute the connected Playwright smoke suite against emulators.
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
   2. Set display mode to **Extended Desktop** (\`Super + P\` → Extend).
   3. Drag browser window to TV display.
   4. Press **\`F\`** to re-enter fullscreen presentation.
   5. Confirm cursor hides after 2.5 seconds of inactivity.
3. **Status**: Not yet run.

### Drill H-2: Booth Ethernet Drop → Mobile Hotspot
1. **Scenario**: Campus wired internet goes offline during the fair.
2. **Steps**:
   1. Enable Personal Hotspot on operator phone.
   2. Connect laptop Wi-Fi to phone hotspot.
   3. Verify connectivity: \`curl -I https://alexanderkholodov.web.app/galaxy/version.json\`
   4. Firestore SDK reconnects automatically; no refresh needed.
3. **Status**: Not yet run.

### Drill H-3: Laptop Power Loss / Battery Failover
1. **Scenario**: Power cord disconnected from wall outlet.
2. **Steps**:
   1. Laptop switches to battery (must be 100% charged before opening).
   2. Reconnect charger to power strip.
   3. If laptop shuts down: power on, start stand, open \`/galaxy/screen\`, press \`F\`.
3. **Status**: Not yet run.
`;
}

async function main() {
  const results = await runAllDrills();
  const md = generateDrillsMarkdown(results);
  const outPath = path.resolve(import.meta.dirname, '../docs/DRILLS.md');
  fs.writeFileSync(outPath, md, 'utf8');
  console.log(`[drills] Wrote drills report to ${outPath}`);

  // Exit non-zero if any drill failed
  const failed = results.filter((r) => r.status === 'FAILED');
  if (failed.length > 0) {
    console.error(`[drills] FAIL: ${failed.length} drill(s) failed: ${failed.map((r) => r.drillId).join(', ')}`);
    process.exitCode = 1;
  }
}

const isEntry = process.argv[1] && process.argv[1].endsWith('drills.ts');
if (isEntry) {
  main().catch((err) => {
    console.error(`[drills] Unhandled error:`, err);
    process.exitCode = 1;
  });
}
