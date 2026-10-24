import { FieldValue, type Firestore } from 'firebase-admin/firestore';

export const skyMigrationPath = 'migrations/sky-v1';

/** Persist recovery state and close writes together, before any deployment. */
export async function prepareSkyMigration(database: Firestore) {
  return database.runTransaction(async (tx) => {
    const markerRef = database.doc(skyMigrationPath), configRef = database.doc('config/live');
    const [marker, config] = await tx.getAll(markerRef, configRef);
    const state = marker.data();
    if (state?.complete && state.seasonOpenBefore === undefined) return false;
    if (!config.exists || typeof config.data()?.seasonOpen !== 'boolean')
      throw new Error('Initialize config/live with Operate the sky before releasing.');
    if (state?.seasonOpenBefore === undefined) tx.set(markerRef, { seasonOpenBefore: config.data()!.seasonOpen }, { merge: true });
    if (config.data()!.seasonOpen) tx.update(configRef, { seasonOpen: false });
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
    if (typeof previous !== 'boolean' || !config.exists) throw new Error('Cannot restore season; recovery state needs operator review.');
    if (config.data()!.seasonOpen !== previous) tx.update(configRef, { seasonOpen: previous });
    tx.update(markerRef, { seasonOpenBefore: FieldValue.delete() });
  });
}

export async function releaseSky(database: Firestore, deploy: () => Promise<void>) {
  // Include prepare in the try: an ambiguous commit must still attempt recovery.
  try {
    await prepareSkyMigration(database);
    await deploy();
    // Import here to keep migration independently callable without a module cycle.
    const { migrateSky } = await import('./sky.js');
    await migrateSky(database);
  } finally {
    await restoreAfterRelease(database);
  }
}

async function restoreAfterRelease(database: Firestore) {
  try { await restoreSkySeason(database); }
  catch {
    throw new Error('SEASON RESTORATION FAILED. Recovery state retained. Run Operate the sky: restore-season.');
  }
}
