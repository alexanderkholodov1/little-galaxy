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
    if (typeof live.seasonOpen !== 'boolean') throw new Error('Invalid config/live seasonOpen. Review config/live in Firestore Console; seasonOpen must be boolean.');
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
      throw new Error('SEASON KEPT CLOSED: deployment may have changed rules; migration incomplete. Run Operate the sky → inspect (empty key/value); review source objects/configuration in Firestore Console, then re-run failed release jobs before restore-season.');
    if (typeof previous !== 'boolean' || !config.exists) throw new Error('Cannot restore season; recovery state needs operator review.');
    if (config.data()!.seasonOpen !== previous) tx.update(configRef, { seasonOpen: previous });
    tx.update(markerRef, { seasonOpenBefore: FieldValue.delete(), deploymentStarted: FieldValue.delete() });
  });
}

export async function releaseSky(database: Firestore, deploy: () => Promise<void>, preflight: () => Promise<void>) {
  // A CLI identity/project failure must not touch even the recovery marker.
  await preflight();
  let releaseError: unknown;
  let failed = false;
  // Catch prepare too: an ambiguous commit must still attempt recovery.
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
        throw new Error('Migration window is not closed. Run Operate the sky → inspect (empty key/value) and review config/live in Firestore Console.');
      tx.update(ref, { deploymentStarted: true });
    });
    await deploy();
    await migrateSky(database);
  } catch (error) {
    failed = true;
    releaseError = error;
  }
  // Always attempt recovery, but throw outside cleanup so neither error replaces the other.
  let recoveryError: unknown;
  let recoveryFailed = false;
  try { await restoreAfterRelease(database); }
  catch (error) { recoveryFailed = true; recoveryError = error; }
  if (recoveryFailed) {
    if (!failed) throw recoveryError;
    // The CLI prints message only: include both failures and retain the original cause.
    throw new Error(`${errorMessage(releaseError)}\n${errorMessage(recoveryError)}`, { cause: releaseError });
  }
  if (failed) throw releaseError;
}

async function restoreAfterRelease(database: Firestore) {
  try { await restoreSkySeason(database); }
  catch (error) {
    throw new Error(`SEASON RESTORATION FAILED OR BLOCKED. Recovery state retained. Run Operate the sky → inspect (empty key/value) before restore-season. ${error instanceof Error ? error.message : ''}`, { cause: error });
  }
}

function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error); }
