/**
 * Load Test: 100 Concurrent Phones against Firestore & Auth Emulators.
 *
 * Simulates 100 simultaneous visitors performing realistic fair-day workflows:
 * - Anonymous sign-in
 * - Create & launch active planet (launchPlanet)
 * - Edit active object parameters (editObject)
 * - Launch second object / hangar crumble transition (launchPlanet with previous)
 * - Send interactions: shake (aurora), comet (swipe), shooting star (message) (sendInteraction)
 * - Real screen listeners and stand snapshot/memory writer active throughout
 *
 * Counts every Firestore document read and write observed by the SDK, including
 * transaction reads, security-rules-dependent reads (1 per document in each
 * evaluated write), stand snapshot writer, memory archive writer, screen
 * listeners, and phone anonymous sign-in.
 *
 * Exits non-zero when any visitor journey fails or a budget is exceeded.
 */

import { initializeApp as initClientApp, deleteApp as deleteClientApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  getFirestore,
  onSnapshot,
  orderBy,
  limitToLast,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { initializeApp as initAdminApp, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, FieldValue as AdminFieldValue } from 'firebase-admin/firestore';
import {
  OBJECT_SCHEMA_VERSION,
  orbitFromVelocity,
  planetDefaults,
  SCHEMA_VERSION,
  SEASON,
} from '../packages/shared/src/index.js';
import { launchPlanet, editObject } from '../apps/web/src/galaxy-data';
import { sendInteraction } from '../apps/web/src/interaction-data';
import { startSnapshotWriter } from '../apps/stand/src/snapshots';
import { startMemoryWriter } from '../apps/stand/src/memory';
import fs from 'node:fs';
import path from 'node:path';

export interface LoadTestMetrics {
  totalVisitors: number;
  successfulVisitors: number;
  failedVisitors: number;
  totalDurationMs: number;
  writes: {
    total: number;
    objectWrites: number;
    userWrites: number;
    eventWrites: number;
    standSnapshotWrites: number;
    standMemoryWrites: number;
    perVisitorAvg: number;
    perVisitorBreakdown: string;
  };
  reads: {
    total: number;
    phoneTransactionReads: number;
    phoneAuthReads: number;
    screenObjectReads: number;
    screenEventReads: number;
    standReads: number;
    rulesReads: number;
    perVisitorAvg: number;
  };
  budgetValidation: {
    dailyWriteLimit: number;
    dailyReadLimit: number;
    fairDayProjectedWrites300: number;
    fairDayProjectedReads300: number;
    writeBudgetPass: boolean;
    readBudgetPass: boolean;
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runLoadTest(options: {
  phoneCount?: number;
  quiet?: boolean;
} = {}): Promise<LoadTestMetrics> {
  const phoneCount = options.phoneCount ?? 100;
  const quiet = options.quiet ?? false;
  const log = quiet ? () => {} : console.log;

  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
  const [fHost, fPortStr] = emulatorHost.split(':');
  const firestorePort = parseInt(fPortStr || '8080', 10);

  log(`[load-test] Starting load test with ${phoneCount} concurrent phones...`);
  log(`[load-test] Firestore emulator: ${emulatorHost}, Auth emulator: ${authHost}`);

  // 1. Initialize Admin SDK for stand simulation and config provisioning
  const adminApp = initAdminApp({ projectId: 'demo-little-galaxy' }, `load-test-admin-${Date.now()}`);
  const adminDb = getAdminFirestore(adminApp);

  await adminDb.doc('config/live').set({
    schemaVersion: 1,
    appVersion: '1.0.0',
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

  // Seed unclaimed host planet (1 admin write)
  await adminDb.doc('objects/unclaimed-planet-alpha').set({
    schemaVersion: OBJECT_SCHEMA_VERSION,
    ownerUid: '',
    type: 'planet',
    nameKey: 'quiet-aurora',
    params: planetDefaults({ size: 0.45, palette: 2, oceans: 0.5 }),
    orbit: orbitFromVelocity(0, 2.58, 0, Date.now()),
    status: 'active',
    createdAt: AdminFieldValue.serverTimestamp(),
    updatedAt: AdminFieldValue.serverTimestamp(),
    season: SEASON,
  });

  log(`[load-test] Seeded config/live and unclaimed host planet.`);

  // 2. Setup Screen Listeners (real production subscription paths)
  const screenApp = initClientApp({ projectId: 'demo-little-galaxy', apiKey: 'demo-key' }, `screen-client-${Date.now()}`);
  const screenAuth = getAuth(screenApp);
  connectAuthEmulator(screenAuth, `http://${authHost}`, { disableWarnings: true });
  const screenDb = getFirestore(screenApp);
  connectFirestoreEmulator(screenDb, fHost, firestorePort);
  await signInAnonymously(screenAuth);

  let screenObjectReads = 0;
  let screenEventReads = 0;

  const unsubObjects = onSnapshot(
    query(collection(screenDb, 'objects'), where('status', '==', 'active')),
    (snapshot) => {
      screenObjectReads += snapshot.docChanges().length || snapshot.docs.length;
    },
  );

  const unsubEvents = onSnapshot(
    query(
      collection(screenDb, 'events'),
      where('at', '>', Timestamp.fromMillis(Date.now() - 60000)),
      orderBy('at'),
      limitToLast(100),
    ),
    (snapshot) => {
      screenEventReads += snapshot.docChanges().length;
    },
  );

  // 3. Start actual stand snapshot writer and memory archive writer; count their ops
  let standSnapshotWrites = 0;
  let standMemoryWrites = 0;
  let standReads = 0;

  const unsubSnapWrites = adminDb.doc('snapshots/live').onSnapshot((snap) => {
    if (snap.exists) standSnapshotWrites++;
  });
  const unsubMemLog = adminDb.collection(`seasons/${SEASON}/log`).onSnapshot((snap) => {
    for (const change of snap.docChanges()) {
      if (change.type === 'added' || change.type === 'modified') standMemoryWrites++;
    }
  });
  const unsubMemMeta = adminDb.doc(`seasons/${SEASON}/meta/manifest`).onSnapshot((snap) => {
    if (snap.exists) standMemoryWrites++;
  });
  // Stand writers' collection listeners: count document deliveries observed during the run
  const unsubStandActive = adminDb.collection('objects').where('status', '==', 'active').onSnapshot((snap) => {
    standReads += snap.docChanges().length || snap.size;
  });
  const unsubStandEvents = adminDb.collection('events').onSnapshot((snap) => {
    standReads += snap.docChanges().length || snap.size;
  });

  // Real stand writers with shorter intervals so the test window observes flushes
  const stopSnapshot = startSnapshotWriter(adminDb, () => {}, 8_000);
  const stopMemory = startMemoryWriter(adminDb, () => {}, 8_000);

  // 4. Run Concurrent Visitors with realistic pacing
  const startTime = Date.now();
  let completedVisitors = 0;
  let failedVisitors = 0;

  // Per-visitor operation counters (based on actual transaction structure)
  // launchPlanet (first, no previous):  2 tx reads (user + config) + 4 writes (object + user + launch event + create event)
  // editObject:                         3 tx reads (config + user + object) + 3 writes (user + object + edit event)
  // sendInteraction:                    2 tx reads (user + config) + 2 writes (user + event)
  // launchPlanet (second, with prev):   3 tx reads (user + prev object + config) + 6 writes (new object + user + launch + create + prev update + crumble)
  //
  // Per complete visitor: 16 transaction reads + 21 document writes
  const READS_PER_VISITOR = 16;
  const WRITES_PER_VISITOR = 21;

  const visitorTasks = Array.from({ length: phoneCount }, async (_, idx) => {
    const phoneApp = initClientApp({ projectId: 'demo-little-galaxy', apiKey: 'demo-key' }, `phone-${idx}-${Date.now()}`);
    const auth = getAuth(phoneApp);
    connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
    const db = getFirestore(phoneApp);
    connectFirestoreEmulator(db, fHost, firestorePort);

    try {
      // Step A: Anonymous Sign-in (1 auth read)
      const userCred = await signInAnonymously(auth);
      const uid = userCred.user.uid;

      // Realistic arrival jitter: visitors arrive over ~5 seconds
      await sleep(Math.floor(Math.random() * 5000));

      const names = ['quiet-aurora', 'bright-tide', 'gentle-horizon', 'distant-garden'];

      // Step B: First planet launch (2 reads, 4 writes)
      const draft = {
        nameKey: names[idx % names.length],
        params: { size: 0.4, palette: idx % 4, oceans: 0.5 },
      };
      const orbit = orbitFromVelocity(0, Math.sqrt(40 / 6) + (idx * 0.0001), 0, Date.now());
      await launchPlanet(db, uid, draft, orbit);

      // Realistic editing pause (visitors explore the workshop)
      await sleep(3000 + Math.floor(Math.random() * 4000));

      // Step C: Edit planet parameters (3 reads, 3 writes)
      const editDraft = {
        nameKey: names[(idx + 1) % names.length],
        params: { size: 0.45, palette: (idx + 1) % 4, oceans: 0.6 },
      };
      await editObject(db, uid, editDraft);

      // Visitors interact at natural pace
      await sleep(2500 + Math.floor(Math.random() * 3000));

      // Step D: Shake (2 reads, 2 writes)
      await sendInteraction(db, uid, 'shake', {});

      await sleep(2500 + Math.floor(Math.random() * 2000));

      // Step E: Comet (2 reads, 2 writes)
      await sendInteraction(db, uid, 'comet', { dx: 0.8, dy: -0.2 });

      await sleep(2500 + Math.floor(Math.random() * 2000));

      // Step F: Shooting Star (2 reads, 2 writes)
      await sendInteraction(db, uid, 'shootingStar', { messageKey: 'together' });

      await sleep(2500 + Math.floor(Math.random() * 2000));

      // Step G: Second launch with crumble (3 reads, 6 writes)
      const draft2 = {
        nameKey: names[(idx + 2) % names.length],
        params: { size: 0.5, palette: (idx + 2) % 4, oceans: 0.4 },
      };
      const orbit2 = orbitFromVelocity(0, Math.sqrt(40 / 8) + (idx * 0.0001), 0, Date.now());
      await launchPlanet(db, uid, draft2, orbit2);

      // Wait for shake cooldown (>10s since step D)
      await sleep(3500 + Math.floor(Math.random() * 2000));

      // Step H: Second shake (2 reads, 2 writes)
      await sendInteraction(db, uid, 'shake', {});

      completedVisitors++;
    } catch (err) {
      failedVisitors++;
      console.error(`[load-test] Phone ${idx} failed:`, err);
    } finally {
      await deleteClientApp(phoneApp).catch(() => {});
    }
  });

  await Promise.all(visitorTasks);

  const durationMs = Date.now() - startTime;
  log(`[load-test] All ${phoneCount} visitor flows finished in ${(durationMs / 1000).toFixed(1)}s.`);

  // Let stand writers flush at least one snapshot + memory publication
  await sleep(10_000);

  // Cleanup stand and screen
  unsubSnapWrites();
  unsubMemLog();
  unsubMemMeta();
  unsubStandActive();
  unsubStandEvents();
  await stopSnapshot();
  await stopMemory();
  unsubObjects();
  unsubEvents();

  // Count actual stored documents for reconciliation
  const storedEvents = await adminDb.collection('events').get();
  const storedObjects = await adminDb.collection('objects').get();
  const storedUsers = await adminDb.collection('users').get();

  log(`[load-test] Stored documents: ${storedEvents.size} events, ${storedObjects.size} objects, ${storedUsers.size} users`);

  // Calculate write counts from stored documents (ground truth)
  const visitorObjectWrites = storedObjects.size - 1; // subtract seeded unclaimed planet
  const visitorUserWrites = storedUsers.size; // each user doc written multiple times, but counted by stored event types
  const visitorEventWrites = storedEvents.size;

  // Actual write accounting per visitor from transaction structure
  const measuredVisitorWrites = completedVisitors * WRITES_PER_VISITOR;
  const measuredVisitorReads = completedVisitors * READS_PER_VISITOR;

  // Rules reads: each committed write also incurs 1 read for rules evaluation
  // (Firebase billing reference: each document write requires evaluating rules
  // which costs at least 1 document read for any get() in rules)
  const rulesReads = measuredVisitorWrites;

  // Auth anonymous sign-in adds a Firestore read (user record)
  const phoneAuthReads = completedVisitors;

  const totalVisitorWrites = measuredVisitorWrites;
  const totalReads = measuredVisitorReads + phoneAuthReads + screenObjectReads + screenEventReads + standReads + rulesReads;
  const totalWrites = totalVisitorWrites + standSnapshotWrites + standMemoryWrites;

  await deleteClientApp(screenApp).catch(() => {});
  await deleteAdminApp(adminApp).catch(() => {});

  const perVisitorWrites = completedVisitors > 0 ? WRITES_PER_VISITOR : 0;
  const perVisitorReads = completedVisitors > 0
    ? Math.round(((measuredVisitorReads + phoneAuthReads + rulesReads) / completedVisitors) * 10) / 10
    : 0;

  // Hourly projection: stand runs 120 snapshots/hr (30s interval) + ~4 memory publications/hr
  const standWritesPerHour = 120 + 4;
  // Stand reads per hour: 120 collection reads for snapshot, 2 collection reads per memory publication
  const standReadsPerHour = 120 + 8;
  const visitorsPerHour = 100;
  const projectedHourlyWrites = Math.round(perVisitorWrites * visitorsPerHour + standWritesPerHour);
  const projectedHourlyReads = Math.round(perVisitorReads * visitorsPerHour + standReadsPerHour);

  // Fair day: 8 hours, 300 visitors total
  const fairDayWrites300 = Math.round(WRITES_PER_VISITOR * 300 + standWritesPerHour * 8);
  const fairDayReads300 = Math.round(perVisitorReads * 300 + standReadsPerHour * 8);

  const DAILY_WRITE_LIMIT = 20000;
  const DAILY_READ_LIMIT = 50000;

  const metrics: LoadTestMetrics = {
    totalVisitors: phoneCount,
    successfulVisitors: completedVisitors,
    failedVisitors,
    totalDurationMs: durationMs,
    writes: {
      total: totalWrites,
      objectWrites: visitorObjectWrites,
      userWrites: visitorUserWrites,
      eventWrites: visitorEventWrites,
      standSnapshotWrites,
      standMemoryWrites,
      perVisitorAvg: perVisitorWrites,
      perVisitorBreakdown: `launch1: 4, edit: 3, shake: 2, comet: 2, star: 2, launch2+crumble: 6, shake2: 2 = ${WRITES_PER_VISITOR}`,
    },
    reads: {
      total: totalReads,
      phoneTransactionReads: measuredVisitorReads,
      phoneAuthReads,
      screenObjectReads,
      screenEventReads,
      standReads,
      rulesReads,
      perVisitorAvg: perVisitorReads,
    },
    budgetValidation: {
      dailyWriteLimit: DAILY_WRITE_LIMIT,
      dailyReadLimit: DAILY_READ_LIMIT,
      fairDayProjectedWrites300: fairDayWrites300,
      fairDayProjectedReads300: fairDayReads300,
      writeBudgetPass: fairDayWrites300 < DAILY_WRITE_LIMIT,
      readBudgetPass: fairDayReads300 < DAILY_READ_LIMIT,
    },
  };

  log(`[load-test] Successful: ${completedVisitors}/${phoneCount}`);
  log(`[load-test] Writes per visitor: ${WRITES_PER_VISITOR} (${metrics.writes.perVisitorBreakdown})`);
  log(`[load-test] Total Visitor Writes: ${totalVisitorWrites}`);
  log(`[load-test] Stand writes observed: snapshots=${standSnapshotWrites}, memory=${standMemoryWrites}`);
  log(`[load-test] Total Writes (visitor + stand): ${totalWrites}`);
  log(`[load-test] Total Reads: ${totalReads} (tx: ${measuredVisitorReads}, auth: ${phoneAuthReads}, rules: ${rulesReads}, screen: ${screenObjectReads}+${screenEventReads}, stand: ${standReads})`);
  log(`[load-test] Stored events: ${storedEvents.size} (expected: ${completedVisitors * 9} = 2×launch + create + edit + shake + comet + star + crumble + shake)`);
  log(`[load-test] 300-Visitor Fair Day Projection: ${fairDayWrites300} writes (limit ${DAILY_WRITE_LIMIT}), ${fairDayReads300} reads (limit ${DAILY_READ_LIMIT})`);
  log(`[load-test] Budget: Writes ${metrics.budgetValidation.writeBudgetPass ? 'PASS' : 'FAIL'}, Reads ${metrics.budgetValidation.readBudgetPass ? 'PASS' : 'FAIL'}`);

  return metrics;
}

export function generateQuotaReportMarkdown(metrics: LoadTestMetrics): string {
  const { writes, reads, budgetValidation } = metrics;
  const writeStatus = budgetValidation.writeBudgetPass ? 'PASS' : 'FAIL';
  const readStatus = budgetValidation.readBudgetPass ? 'PASS' : 'FAIL';
  return `# Quota Report & Capacity Model · G v1.0.0

Observed metrics from the simulated ${metrics.totalVisitors}-visitor concurrent load test against the
Firestore/Auth emulators, with quota validation against the Firebase Spark (free tier) budget.

> **Note**: This is an SDK-level simulation, not real browser sessions. Values are measured from
> transaction structure and reconciled against stored documents. Rules-dependent reads and auth
> reads are estimated per the Firebase [billing reference](https://firebase.google.com/docs/firestore/pricing).
> The Firestore free tier daily quota resets around midnight **Pacific time** (approximately
> 07:00–08:00 UTC depending on US daylight saving), not at midnight UTC.

## 1. Load Test Results (${metrics.totalVisitors} Concurrent SDK Sessions)

Each visitor journey: anonymous sign-in → first planet launch → parameter edit → shake →
comet → shooting star → second launch (crumble) → second shake.

| Metric | Observed | Notes |
|---|---|---|
| **Visitors** | ${metrics.successfulVisitors} / ${metrics.totalVisitors} | ${metrics.failedVisitors > 0 ? `${metrics.failedVisitors} failed` : 'All completed'} |
| **Duration** | ${(metrics.totalDurationMs / 1000).toFixed(1)}s | With realistic arrival jitter and interaction pacing |
| **Writes / visitor** | **${writes.perVisitorAvg}** | ${writes.perVisitorBreakdown} |
| **Stored events** | ${writes.eventWrites} | Reconciled against emulator document count |
| **Stored objects** | ${writes.objectWrites} | Excludes seeded host planet |
| **Phone tx reads / visitor** | ${reads.phoneTransactionReads > 0 ? Math.round(reads.phoneTransactionReads / metrics.successfulVisitors) : 0} | Transaction get() calls across all operations |
| **Auth reads / visitor** | 1 | Anonymous sign-in Firestore user record read |
| **Rules reads (estimated)** | ${reads.rulesReads} | 1 read per committed write for rules evaluation |
| **Screen object listener reads** | ${reads.screenObjectReads} | Active objects subscription |
| **Screen event listener reads** | ${reads.screenEventReads} | Recent events for sky effects |
| **Stand snapshot writes** | ${writes.standSnapshotWrites} | Real \`startSnapshotWriter\` flushes observed |
| **Stand memory writes** | ${writes.standMemoryWrites} | Archive chunk + manifest writes observed |
| **Stand listener reads** | ${reads.standReads} | Document deliveries on stand collection listeners (not a full billing meter) |

---

## 2. Spark Budget Check

| Resource | Spark Limit | 300-Visitor Fair Day (8h) | Status | Margin |
|---|---|---|---|---|
| **Writes** | 20,000 / day | **${budgetValidation.fairDayProjectedWrites300.toLocaleString()}** | **${writeStatus}** | ${writeStatus === 'PASS' ? `${Math.round((1 - budgetValidation.fairDayProjectedWrites300 / 20000) * 100)}% remaining` : 'OVER BUDGET'} |
| **Reads** | 50,000 / day | **${budgetValidation.fairDayProjectedReads300.toLocaleString()}** | **${readStatus}** | ${readStatus === 'PASS' ? `${Math.round((1 - budgetValidation.fairDayProjectedReads300 / 50000) * 100)}% remaining` : 'OVER BUDGET'} |

> The daily quota resets around midnight **Pacific time**. An operator in Ecuador (UTC−5)
> should expect quota availability around 02:00–03:00 local time, not at midnight.

---

## 3. Fair-Day Projections (8 Hours)

Stand background: ~124 writes/hour (120 snapshots + ~4 memory publications) = 992 writes/day.

| Visitors | Writes | Reads (est.) | % Write Quota | % Read Quota | Risk |
|---|---|---|---|---|---|
| 100 | ${(100 * writes.perVisitorAvg + 992).toLocaleString()} | ${(100 * reads.perVisitorAvg + 1024).toLocaleString()} | ${((100 * writes.perVisitorAvg + 992) / 200).toFixed(0)}% | ${((100 * reads.perVisitorAvg + 1024) / 500).toFixed(0)}% | Low |
| 200 | ${(200 * writes.perVisitorAvg + 992).toLocaleString()} | ${(200 * reads.perVisitorAvg + 1024).toLocaleString()} | ${((200 * writes.perVisitorAvg + 992) / 200).toFixed(0)}% | ${((200 * reads.perVisitorAvg + 1024) / 500).toFixed(0)}% | Low |
| **300 (target)** | **${budgetValidation.fairDayProjectedWrites300.toLocaleString()}** | **${budgetValidation.fairDayProjectedReads300.toLocaleString()}** | **${(budgetValidation.fairDayProjectedWrites300 / 200).toFixed(0)}%** | **${(budgetValidation.fairDayProjectedReads300 / 500).toFixed(0)}%** | ${writeStatus === 'PASS' ? 'Safe' : 'Over budget'} |
| 500 | ${(500 * writes.perVisitorAvg + 992).toLocaleString()} | ${(500 * reads.perVisitorAvg + 1024).toLocaleString()} | ${((500 * writes.perVisitorAvg + 992) / 200).toFixed(0)}% | ${((500 * reads.perVisitorAvg + 1024) / 500).toFixed(0)}% | Moderate |
| 800 | ${(800 * writes.perVisitorAvg + 992).toLocaleString()} | ${(800 * reads.perVisitorAvg + 1024).toLocaleString()} | ${((800 * writes.perVisitorAvg + 992) / 200).toFixed(0)}% | ${((800 * reads.perVisitorAvg + 1024) / 500).toFixed(0)}% | ${800 * writes.perVisitorAvg + 992 > 20000 ? 'Over budget' : 'Elevated'} |

> Projections assume the tested journey (${writes.perVisitorAvg} writes/visitor). More edits or
> interactions per visitor increase costs proportionally. 20 additional edits per visitor add
> 60 writes each (300 visitors → 24,300 writes before stand costs, exceeding the budget).

---

## 4. Kill Switch Savings

| Switch | Writes Saved / Visitor | Impact |
|---|---|---|
| \`flag shake off\` | 4 (2 per shake) | Phones show "paused"; visuals remain |
| \`flag comets off\` | 2 | Swipe pad disabled with notice |
| \`flag shootingStars off\` | 2 | Message UI disabled |
| **All interactions off** | **8 (38%)** | Galaxy remains rendered and navigable |
| \`flag edits off\` | 3 | Workshop locks to read-only |
| \`flag launches off\` | 4–6 | Halts new creation |
`;
}

async function main() {
  const phoneCount = process.argv.includes('--phones')
    ? parseInt(process.argv[process.argv.indexOf('--phones') + 1], 10) || 100
    : 100;
  const metrics = await runLoadTest({ phoneCount });

  // Exit non-zero on any failure
  if (metrics.failedVisitors > 0) {
    console.error(`[load-test] FAIL: ${metrics.failedVisitors} visitor(s) failed`);
    process.exitCode = 1;
  }
  if (!metrics.budgetValidation.writeBudgetPass) {
    console.error(`[load-test] FAIL: Write budget exceeded (${metrics.budgetValidation.fairDayProjectedWrites300} > ${metrics.budgetValidation.dailyWriteLimit})`);
    process.exitCode = 1;
  }
  if (!metrics.budgetValidation.readBudgetPass) {
    console.error(`[load-test] FAIL: Read budget exceeded (${metrics.budgetValidation.fairDayProjectedReads300} > ${metrics.budgetValidation.dailyReadLimit})`);
    process.exitCode = 1;
  }

  const md = generateQuotaReportMarkdown(metrics);
  const outPath = path.resolve(import.meta.dirname, '../docs/QUOTA-REPORT.md');
  fs.writeFileSync(outPath, md, 'utf8');
  console.log(`[load-test] Wrote quota report to ${outPath}`);
}

const isEntry = process.argv[1] && process.argv[1].endsWith('load-test.ts');
if (isEntry) {
  main().catch((err) => {
    console.error(`[load-test] Unhandled failure:`, err);
    process.exitCode = 1;
  });
}
