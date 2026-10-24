import { objectFeed } from '../apps/stand/src/object-feed';
import { claimLease } from '../apps/stand/src/lease';
import { measureQuotaProbes } from './quota-probes';
import { fairDayModel, fairDayMarkdown, liveSkyMarkdown } from './quota-model';
import type { QuotaProbes } from './quota-probes';
import { initializeApp as initClientApp, deleteApp as deleteClientApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
} from 'firebase/firestore';
import { initializeApp as initAdminApp, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, FieldValue as AdminFieldValue } from 'firebase-admin/firestore';
import {
  OBJECT_SCHEMA_VERSION,
  orbitFromVelocity,
  planetDefaults,
  SEASON,
} from '../packages/shared/src/index.js';
import { launchPlanet, editObject, listenActive } from '../apps/web/src/galaxy-data';
import { sendInteraction, listenRecentEvents } from '../apps/web/src/interaction-data';
import { observeTransactions } from '../apps/web/src/firestore-observer';
import { setUidProvider } from '../apps/web/src/session-uid';
import { startSnapshotWriter } from '../apps/stand/src/snapshots';
import { buildSeason, startMemoryWriter } from '../apps/stand/src/memory';
import { startMeteorScheduler, writeMeteorShower } from '../apps/stand/src/meteors';
import fs from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';

export interface LoadTestMetrics {
  probes?: QuotaProbes;
  archivePublications?: number;
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
    standMeteorWrites: number;
    perVisitorAvg: number;
    perVisitorBreakdown: string;
  };
  reads: {
    total: number;
    phoneTransactionReads: number;
    screenObjectReads: number;
    screenEventReads: number;
    standReads: number;
    rulesReads: number;
    perVisitorAvg: number;
  };
  transactionAttempts: number;
  commitRequests: number;
  projections: { visitors: number; writes: number; reads: number; memoryWrites: number; screenReads: number; standReads: number }[];
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

  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('Explicit demo Firestore/Auth emulator environment required');
  }
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
  const [fHost, fPortStr] = emulatorHost.split(':');
  const firestorePort = parseInt(fPortStr || '8080', 10);

  log(`[load-test] Starting load test with ${phoneCount} concurrent phones...`);
  log(`[load-test] Firestore emulator: ${emulatorHost}, Auth emulator: ${authHost}`);

  // 1. Initialize Admin SDK for stand simulation and config provisioning
  const adminApp = initAdminApp({ projectId: 'demo-little-galaxy' }, `load-test-admin-${Date.now()}`);
  const adminDb = getAdminFirestore(adminApp);
  const cleanup: (() => unknown | Promise<unknown>)[] = [() => deleteAdminApp(adminApp)];
  try {

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

  const seed = await adminDb.doc('objects/unclaimed-planet-alpha').get();
  if (seed.exists) await adminDb.doc('sky/f').set({ entries: { 'unclaimed-planet-alpha': { id: seed.id, data: seed.data() } } });

  log(`[load-test] Seeded config/live and unclaimed host planet.`);

  // 2. Setup Screen Listeners (real production subscription paths)
  setUidProvider(() => Promise.resolve('screen-client-uid'));
  const screenApp = initClientApp({ projectId: 'demo-little-galaxy', apiKey: 'demo-key' }, `screen-client-${Date.now()}`);
  cleanup.push(() => deleteClientApp(screenApp));
  const screenAuth = getAuth(screenApp);
  connectAuthEmulator(screenAuth, `http://${authHost}`, { disableWarnings: true });
  const screenDb = getFirestore(screenApp);
  connectFirestoreEmulator(screenDb, fHost, firestorePort);
  await signInAnonymously(screenAuth);

  let screenObjectDocReads = 0;
  let screenEventDocReads = 0;

  const serviceErrors: string[] = [];
  let screenObjects = 0;
  let screenEvents = 0;
  const stopActive = listenActive(screenDb, (objects) => { screenObjects = objects.length; },
    () => serviceErrors.push('screen objects'), (n) => { screenObjectDocReads += n; });
  const stopRecent = listenRecentEvents(screenDb, (events) => { screenEvents += events.length; },
    () => serviceErrors.push('screen events'), (n) => { screenEventDocReads += n; });

  cleanup.push(stopActive, stopRecent);

  // 3. Start actual stand services: snapshot writer, memory archive writer, and meteor scheduler
  let standSnapshotWrites = 0;
  let standMemoryWrites = 0;
  let archivePublications = 0;
  let standMeteorWrites = 0;
  let standReads = 0;

  const fence = await claimLease(adminDb, 'load-test');
  if (!fence) throw new Error('Load test lease unavailable');
  const feed = objectFeed();
  const observeStand = (n: number) => { standReads += n; };
  const stopSnapshot = startSnapshotWriter(adminDb, () => serviceErrors.push('snapshot'), 8_000, observeStand, (n) => { standSnapshotWrites += n; }, fence, feed.subscribe);
  const stopMemory = startMemoryWriter(adminDb, () => serviceErrors.push('memory'), 8_000, observeStand, (n) => { standMemoryWrites += n; archivePublications++; }, fence, feed.publish);
  const stopMeteors = startMeteorScheduler(adminDb, () => serviceErrors.push('meteors'), Math.random, undefined, observeStand, (n) => { standMeteorWrites += n; }, fence);
  cleanup.push(stopSnapshot, stopMemory, stopMeteors);
  // Exercise the real transaction writer without waiting for the production timer window.
  await writeMeteorShower(adminDb, observeStand, (n) => { standMeteorWrites += n; }, fence);

  // 4. Run Concurrent Visitors with realistic pacing and instrumented operations
  const startTime = Date.now();
  let completedVisitors = 0;
  let failedVisitors = 0;

  let visitorCommittedWrites = 0;
  let visitorTransactionReads = 0;
  let visitorRulesReads = 0;
  let visitorEventsWritten = 0;
  let transactionAttempts = 0;
  let commitRequests = 0;

  const visitorTasks = Array.from({ length: phoneCount }, async (_, idx) => {
    const phoneApp = initClientApp({ projectId: 'demo-little-galaxy', apiKey: 'demo-key' }, `phone-${idx}-${Date.now()}`);
    const auth = getAuth(phoneApp);
    connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
    const db = getFirestore(phoneApp);
    connectFirestoreEmulator(db, fHost, firestorePort);

    const unobserve = observeTransactions(db, {
      attempt: () => { transactionAttempts++; },
      read: () => { visitorTransactionReads++; },
      request: (writes) => {
        commitRequests++;
        // Explicit dependency union for this planet-only journey; see generated report.
        visitorRulesReads += new Set(['config/live', ...writes]).size;
      },
    });
    try {
      // Step A: Anonymous Sign-in (Auth emulator only, 0 Firestore reads)
      const userCred = await signInAnonymously(auth);
      const uid = userCred.user.uid;

      // Realistic arrival jitter: visitors arrive over ~5 seconds
      await sleep(Math.floor(Math.random() * 5000));

      const names = ['quiet-aurora', 'bright-tide', 'gentle-horizon', 'distant-garden'] as const;

      // Step B: First planet launch (5 writes including the sky shard, 2 events)
      const draft = {
        nameKey: names[idx % names.length],
        params: { size: 0.4, palette: (idx % 4) as 0 | 1 | 2 | 3, oceans: 0.5 },
      };
      const orbit = orbitFromVelocity(0, Math.sqrt(40 / 6) + (idx * 0.0001), 0, Date.now());
      await launchPlanet(db, uid, draft, orbit);
      visitorCommittedWrites += 5;
      visitorEventsWritten += 2;

      // Realistic editing pause (visitors explore the workshop)
      await sleep(3000 + Math.floor(Math.random() * 4000));

      // Step C: Edit planet parameters (4 writes including the sky shard, 1 event)
      const editDraft = {
        nameKey: names[(idx + 1) % names.length],
        params: { size: 0.45, palette: ((idx + 1) % 4) as 0 | 1 | 2 | 3, oceans: 0.6 },
      };
      await editObject(db, uid, editDraft);
      visitorCommittedWrites += 4;
      visitorEventsWritten += 1;

      // Visitors interact at natural pace
      await sleep(2500 + Math.floor(Math.random() * 3000));

      // Step D: Shake (2 writes, 1 event)
      await sendInteraction(db, uid, 'shake', {});
      visitorCommittedWrites += 2;
      visitorEventsWritten += 1;

      await sleep(2500 + Math.floor(Math.random() * 2000));

      // Step E: Comet (2 writes, 1 event)
      await sendInteraction(db, uid, 'comet', { dx: 0.8, dy: -0.2 });
      visitorCommittedWrites += 2;
      visitorEventsWritten += 1;

      await sleep(2500 + Math.floor(Math.random() * 2000));

      // Step F: Shooting Star (2 writes, 1 event)
      await sendInteraction(db, uid, 'shootingStar', { messageKey: 'together' });
      visitorCommittedWrites += 2;
      visitorEventsWritten += 1;

      await sleep(2500 + Math.floor(Math.random() * 2000));

      // Step G: Second launch with crumble (7 writes including the sky shard, 3 events)
      const draft2 = {
        nameKey: names[(idx + 2) % names.length],
        params: { size: 0.5, palette: ((idx + 2) % 4) as 0 | 1 | 2 | 3, oceans: 0.4 },
      };
      const orbit2 = orbitFromVelocity(0, Math.sqrt(40 / 8) + (idx * 0.0001), 0, Date.now());
      await launchPlanet(db, uid, draft2, orbit2);
      visitorCommittedWrites += 7;
      visitorEventsWritten += 3;

      // Wait for shake cooldown (>10s since step D)
      await sleep(3500 + Math.floor(Math.random() * 2000));

      // Step H: Second shake (2 writes, 1 event)
      await sendInteraction(db, uid, 'shake', {});
      visitorCommittedWrites += 2;
      visitorEventsWritten += 1;

      completedVisitors++;
    } catch (err) {
      failedVisitors++;
      console.error(`[load-test] Phone ${idx} failed:`, err);
    } finally {
      unobserve();
      await deleteClientApp(phoneApp).catch(() => {});
    }
  });

  await Promise.all(visitorTasks);

  const durationMs = Date.now() - startTime;
  log(`[load-test] All ${phoneCount} visitor flows finished in ${(durationMs / 1000).toFixed(1)}s.`);

  // Let stand writers flush at least one snapshot + memory publication
  await sleep(10_000);

  // Cleanup stand and screen
  await Promise.all([stopSnapshot(), stopMemory(), stopMeteors()]);
  stopActive();
  stopRecent();

  if (serviceErrors.length) throw new Error(`Service errors: ${serviceErrors.join(', ')}`);
  if (screenObjects !== completedVisitors + 1 || screenEvents === 0) {
    throw new Error(`Screen content mismatch: ${screenObjects} objects, ${screenEvents} events`);
  }
  if (standSnapshotWrites === 0 || standMeteorWrites === 0) throw new Error('Stand writer was not exercised');

  // Count actual stored documents for reconciliation
  const storedEvents = await adminDb.collection('events').get();
  const storedObjects = await adminDb.collection('objects').get();
  const storedUsers = await adminDb.collection('users').get();

  log(`[load-test] Stored documents: ${storedEvents.size} events, ${storedObjects.size} objects, ${storedUsers.size} users`);

  // The archive also contains baseline creation rows for operator-seeded objects.
  const expectedArchive = buildSeason(storedObjects.docs, storedEvents.docs);
  const manifest = await adminDb.doc(`seasons/${SEASON}/meta/manifest`).get();
  if (!manifest.exists || !isDeepStrictEqual(manifest.data()?.manifest, expectedArchive.manifest)) {
    throw new Error('Memory archive manifest did not match the final committed source state');
  }
  const archiveIds = Object.keys(expectedArchive.files);
  const archiveFiles = await adminDb.getAll(...archiveIds.map((id) => adminDb.doc(`seasons/${SEASON}/log/${id}`)));
  if (archiveFiles.some((file, i) => !file.exists || !isDeepStrictEqual(file.data(), expectedArchive.files[archiveIds[i]]))) {
    throw new Error('Memory archive referenced missing or mismatched chunks');
  }
  log(`[load-test] Archive reconciled: ${expectedArchive.manifest.eventCount} rows including seed baselines, ${archiveFiles.length} matching chunks`);

  // Reconciliation assertion: 10 visitor events per completed journey + stand meteors
  const expectedEvents = visitorEventsWritten + standMeteorWrites;
  log(`[load-test] Stored events: ${storedEvents.size} (expected: ${expectedEvents} = ${visitorEventsWritten} visitor + ${standMeteorWrites} meteor)`);
  if (storedEvents.size !== expectedEvents) {
    throw new Error(`Event reconciliation failed: stored ${storedEvents.size} events in Firestore, expected ${expectedEvents} (${visitorEventsWritten} visitor + ${standMeteorWrites} stand meteor)`);
  }

  // Calculate write counts from stored documents (ground truth)
  const visitorObjectWrites = storedObjects.size - 1; // subtract seeded unclaimed planet
  const visitorUserWrites = storedUsers.size; // each user doc written multiple times
  const visitorEventWrites = storedEvents.size;

  const totalVisitorWrites = visitorCommittedWrites;
  const totalWrites = totalVisitorWrites + standSnapshotWrites + standMemoryWrites + standMeteorWrites;
  const totalReads = visitorTransactionReads + visitorRulesReads + screenObjectDocReads + screenEventDocReads + standReads;


  const perVisitorWrites = completedVisitors > 0 ? visitorCommittedWrites / completedVisitors : 0;
  // ONE dataset for the budget summary and every crowd row. This is a burst-scaled
  // scenario estimate, not a production cadence upper bound or a billing measurement.
  const denominator = Math.max(1, completedVisitors);
  const projections = [100, 200, 300, 500, 800].map((visitors) => {
    const scale = visitors / denominator;
    const memoryWrites = Math.ceil(standMemoryWrites * scale);
    const screenReads = Math.ceil((screenObjectDocReads + screenEventDocReads) * scale) + 320;
    const projectedStandReads = Math.ceil(standReads * scale) + 60;
    return {
      visitors, memoryWrites, screenReads, standReads: projectedStandReads,
      writes: Math.ceil(visitorCommittedWrites * scale) + Math.ceil(standSnapshotWrites * scale) + memoryWrites + 60,
      reads: Math.ceil((visitorTransactionReads + visitorRulesReads) * scale) + screenReads + projectedStandReads,
    };
  });
  const target = projections.find((row) => row.visitors === 300)!;
  const fairDayWrites300 = target.writes;
  const fairDayReads300 = target.reads;
  const perVisitorReads = fairDayReads300 / 300;

  const DAILY_WRITE_LIMIT = 20000;
  const DAILY_READ_LIMIT = 50000;

  await stopSnapshot(); await stopMemory(); await stopMeteors(); stopActive(); stopRecent();
  const probes = await measureQuotaProbes(adminDb, screenDb, fence, expectedArchive, storedObjects.docs[0].id);
  const metrics: LoadTestMetrics = {
    probes, archivePublications, transactionAttempts, commitRequests, projections,
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
      standMeteorWrites,
      perVisitorAvg: perVisitorWrites,
      perVisitorBreakdown: `launch1: 5, edit: 4, shake: 2, comet: 2, star: 2, launch2+crumble: 7, shake2: 2 = ${perVisitorWrites}`,
    },
    reads: {
      total: totalReads,
      phoneTransactionReads: visitorTransactionReads,
      screenObjectReads: screenObjectDocReads,
      screenEventReads: screenEventDocReads,
      standReads,
      rulesReads: visitorRulesReads,
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

  const wholeDay = fairDayModel(metrics);
  metrics.reads.perVisitorAvg = wholeDay.reads / 300;
  metrics.budgetValidation.fairDayProjectedReads300 = wholeDay.reads;
  metrics.budgetValidation.fairDayProjectedWrites300 = wholeDay.writes;
  metrics.budgetValidation.readBudgetPass = wholeDay.reads <= DAILY_READ_LIMIT * .75;
  metrics.budgetValidation.writeBudgetPass = wholeDay.writes <= DAILY_WRITE_LIMIT * .75;
  log(`[load-test] Whole-day quota: ${wholeDay.reads} reads, ${wholeDay.writes} writes; 75% ceilings 37500/15000`);
  log(`[load-test] Measured probes: ${JSON.stringify(probes)}`);
  log(`[load-test] Successful: ${completedVisitors}/${phoneCount}`);
  log(`[load-test] Writes per visitor: ${perVisitorWrites} (${metrics.writes.perVisitorBreakdown})`);
  log(`[load-test] Total Visitor Writes: ${totalVisitorWrites}`);
  log(`[load-test] Stand writes observed: snapshots=${standSnapshotWrites}, memory=${standMemoryWrites}, meteors=${standMeteorWrites}`);
  log(`[load-test] Total Writes (visitor + stand): ${totalWrites}`);
  log(`[load-test] Total Reads: ${totalReads} (tx: ${visitorTransactionReads}, rules: ${visitorRulesReads}, screen: ${screenObjectDocReads}+${screenEventDocReads}, stand: ${standReads})`);
  log(`[load-test] Stored events: ${storedEvents.size} (expected: ${expectedEvents} = ${visitorEventsWritten} visitor + ${standMeteorWrites} meteor)`);
  log(`[load-test] 300-Visitor Fair Day Projection: ${wholeDay.writes} writes (75% ceiling ${DAILY_WRITE_LIMIT * .75}), ${wholeDay.reads} reads (75% ceiling ${DAILY_READ_LIMIT * .75})`);
  log(`[load-test] Budget: Writes ${metrics.budgetValidation.writeBudgetPass ? 'PASS' : 'FAIL'}, Reads ${metrics.budgetValidation.readBudgetPass ? 'PASS' : 'FAIL'}`);

  return metrics;
  } finally {
    for (const stop of cleanup.reverse()) {
      try { await stop(); } catch { /* preserve the original failure after cleanup */ }
    }
  }
}

export function generateQuotaReportMarkdown(metrics: LoadTestMetrics): string {
  const { writes, reads, budgetValidation: budget } = metrics;
  return `# Quota Report & Capacity Model · G v1.0.0-alpha.1

Generated by scripts/load-test.ts from the demo emulator run. SDK reads/writes are observed;
rule dependencies and day projections are models, not production billing telemetry.

| Measured burst | Result |
| --- | ---: |
| Visitors | ${metrics.successfulVisitors}/${metrics.totalVisitors} (${metrics.failedVisitors ? `${metrics.failedVisitors} failed` : 'All completed'}) |
| Duration | ${(metrics.totalDurationMs / 1000).toFixed(1)} seconds |
| Transaction attempts / proposed commits | ${metrics.transactionAttempts} / ${metrics.commitRequests} |
| Transaction gets / rule dependencies | ${reads.phoneTransactionReads} / ${reads.rulesReads} |
| Screen sky / recent event deliveries | ${reads.screenObjectReads} / ${reads.screenEventReads} |
| Stand reads (including transactional fencing) | ${reads.standReads} |
| Combined reads | ${reads.total} |
| Visitor writes per journey | ${writes.perVisitorAvg} |
| Snapshot / archive / meteor writes | ${writes.standSnapshotWrites} / ${writes.standMemoryWrites} / ${writes.standMeteorWrites} |
| Combined workload writes | ${writes.total} |

${fairDayMarkdown(metrics)}

| Resource | Daily Spark limit | Whole-day model | 75% margin check |
| --- | ---: | ---: | --- |
| **Writes** | ${budget.dailyWriteLimit.toLocaleString()} | **${budget.fairDayProjectedWrites300.toLocaleString()}** | **${budget.writeBudgetPass ? 'PASS' : 'FAIL'}** |
| **Reads** | ${budget.dailyReadLimit.toLocaleString()} | **${budget.fairDayProjectedReads300.toLocaleString()}** | **${budget.readBudgetPass ? 'PASS' : 'FAIL'}** |

Visitor journey: ${writes.perVisitorBreakdown}. Direct gets count every attempt, including retries.
Rule reads union each proposed commit's config/live, after user/object/event and sky mirror paths;
repeated access to the same dependency counts once per request. This SDK model cannot measure
backend caching, short-circuit denial costs or production reconnect billing. Empty queries count
at least one; metadata-only deliveries count zero after the first server result. Removed query
rows are conservatively included in delivery counts. Instrumentation/setup/reconciliation and
probe fixture writes are excluded from the visitor workload; probes are listed separately.

The 100-phone burst is scaled by completed visitors. It is not a sustained eight-hour or physical
phone/Wi-Fi acceptance. All source events and archive files reconcile exactly; service errors fail
the command. Snapshot writes include first publication and actual content changes, not a heartbeat.
Static chunks are tried before live chunks; the day model budgets the full live fallback anyway.
Additional sessions or reconnects beyond the stated allowances can exceed this scenario. Close
interaction switches before exhaustion. Firebase quota resets around midnight Pacific time.
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
    console.error(`[load-test] FAIL: 75% write ceiling exceeded (${metrics.budgetValidation.fairDayProjectedWrites300} > ${metrics.budgetValidation.dailyWriteLimit * .75})`);
    process.exitCode = 1;
  }
  if (!metrics.budgetValidation.readBudgetPass) {
    console.error(`[load-test] FAIL: 75% read ceiling exceeded (${metrics.budgetValidation.fairDayProjectedReads300} > ${metrics.budgetValidation.dailyReadLimit * .75})`);
    process.exitCode = 1;
  }

  const md = generateQuotaReportMarkdown(metrics);
  fs.writeFileSync(path.resolve(import.meta.dirname, '../docs/live-sky.md'), liveSkyMarkdown(metrics), 'utf8');
  const outPath = path.resolve(import.meta.dirname, '../docs/QUOTA-REPORT.md');
  fs.writeFileSync(outPath, md, 'utf8');
  console.log(md);
  console.log(`[load-test] Wrote quota report to ${outPath}`);
}

const isEntry = process.argv[1] && process.argv[1].endsWith('load-test.ts');
if (isEntry) {
  main().catch((err) => {
    console.error(`[load-test] Unhandled failure:`, err);
    process.exitCode = 1;
  });
}
