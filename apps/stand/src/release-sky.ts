import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { initialConfig } from './control.js';

export const skyMigrationPath = 'migrations/sky-v1';

/** Persist recovery state and close writes together, before any deployment. */
export async function prepareSkyMigration(database: Firestore) {
  return database.runTransaction(async (tx) => {
    const markerRef = database.doc(skyMigrationPath), configRef = database.doc('config/live');
    const [marker, config] = await tx.getAll(markerRef, configRef);
    const state = marker.data();
    const live = config.exists ? config.data()! : initialConfig();
    if (!config.exists) tx.create(configRef, live);
    if (state?.complete && state.seasonOpenBefore === undefined) return false;
    if (typeof live.seasonOpen !== 'boolean') throw new Error('Invalid config/live seasonOpen. Operate the sky: review configuration.');
    if (state?.seasonOpenBefore === undefined) tx.set(markerRef, { seasonOpenBefore: live.seasonOpen }, { merge: true });
    if (live.seasonOpen) tx.update(configRef, { seasonOpen: false });
    return true;
  });
}

/** Safe to retry, including from the workflow's always-run recovery step. */
export async function restoreSkySeason(database: Firestore) {
  await database.runTransaction(async (tx) => {
    const markerRef = database.doc(skyMigrationPath), configRef = database.doc('config/live');
    const [marker, config] = await tx.getAll(markerRef, configRef);
    const previous = marker.data()?.seasonOpenBefore;
    if (previous === undefined) return;
    if (marker.data()?.deploymentStarted && !marker.data()?.complete)
      throw new Error('SEASON KEPT CLOSED: deployment may have changed rules; migration incomplete. Operate the sky: keep seasonOpen off, repair the migration source and re-run failed release jobs before restore-season.');
    if (typeof previous !== 'boolean' || !config.exists) throw new Error('Cannot restore season; recovery state needs operator review.');
    if (config.data()!.seasonOpen !== previous) tx.update(configRef, { seasonOpen: previous });
    tx.update(markerRef, { seasonOpenBefore: FieldValue.delete(), deploymentStarted: FieldValue.delete() });
  });
}

export async function releaseSky(database: Firestore, deploy: () => Promise<void>) {
  // Include prepare in the try: an ambiguous commit must still attempt recovery.
  try {
    await prepareSkyMigration(database);
    // Import here to keep migration independently callable without a module cycle.
    const { migrateSky, validateSkyMigration } = await import('./sky.js');
    await validateSkyMigration(database);
    // Persist before invoking the CLI: it can apply rules and then fail on indexes,
    // or the runner can disappear. The always-run recovery must see this boundary.
    await database.runTransaction(async (tx) => {
      const ref = database.doc(skyMigrationPath), configRef = database.doc('config/live');
      const [marker, config] = await tx.getAll(ref, configRef);
      if (marker.data()?.complete) return;
      if (config.data()?.seasonOpen !== false || marker.data()?.seasonOpenBefore === undefined)
        throw new Error('Migration window is not closed. Operate the sky: review recovery state.');
      tx.update(ref, { deploymentStarted: true });
    });
    await deploy();
    await migrateSky(database);
  } finally {
    await restoreAfterRelease(database);
  }
}

async function restoreAfterRelease(database: Firestore) {
  try { await restoreSkySeason(database); }
  catch (error) {
    throw new Error(`SEASON RESTORATION FAILED OR BLOCKED. Recovery state retained. Operate the sky: inspect the migration before restore-season. ${error instanceof Error ? error.message : ''}`, { cause: error });
  }
}
