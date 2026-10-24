import type { Firestore } from 'firebase-admin/firestore';
import { skyMigrationPath } from './release-sky.js';
import { readObject, skyBucket } from '@little-galaxy/shared';

/** Shared source analysis keeps inspection counts identical to validation. */
async function analyzeSky(database: Firestore) {
  const [marker, config, existing, objects] = await Promise.all([
    database.doc(skyMigrationPath).get(), database.doc('config/live').get(),
    database.collection('sky').get(), database.collection('objects').where('status', '==', 'active').get(),
  ]);
  const shards = Array.from({ length: 16 }, () => ({} as Record<string, unknown>));
  let unsupportedObjects = 0, duplicateOwners = 0;
  for (const row of objects.docs) {
    const object = readObject(row.data());
    if (!object) { unsupportedObjects++; continue; }
    // Operator-seeded unclaimed bodies use a stable ID partition.
    const key = object.ownerUid || row.id;
    const shard = shards[parseInt(skyBucket(key), 16)];
    if (shard[key]) { duplicateOwners++; continue; }
    shard[key] = { id: row.id, data: row.data() };
  }
  const counts = shards.map((entries, i) => ({ id: i.toString(16), entries: Object.keys(entries).length, bytes: Buffer.byteLength(JSON.stringify(entries)) }));
  const validationError = marker.data()?.complete ? null
    : config.data()?.seasonOpen !== false ? 'Close the season before migrating the sky.'
    : !existing.empty ? 'Existing sky shards without a completed migration. Run Operate the sky → inspect (empty key/value); review shards and source objects in Firestore Console before retrying. See RUNBOOK §11.'
    : unsupportedObjects ? 'Unsupported source object'
    : duplicateOwners ? 'Multiple active objects for one owner'
    : counts.some((shard) => shard.entries > 512 || shard.bytes > 600_000) ? 'Sky shard capacity exceeded' : null;
  return { shards, report: { marker: marker.data() ?? null, seasonOpen: config.data()?.seasonOpen ?? null,
    activeObjects: objects.size, unsupportedObjects, duplicateOwners, existingShards: existing.size,
    shards: counts, limits: { entries: 512, bytes: 600_000 }, validationError } };
}

/** Read-only operator report; no repair or restoration is attempted. */
export async function inspectSky(database: Firestore) {
  return (await analyzeSky(database)).report;
}

/** Read-only preflight, also repeated by the writer inside the closed window. */
export async function validateSkyMigration(database: Firestore) {
  if ((await database.doc(skyMigrationPath).get()).data()?.complete) return false;
  const { shards, report } = await analyzeSky(database);
  if (report.validationError) throw new Error(report.validationError);
  return shards;
}

/** One-time backfill. Creation preconditions protect shards even after preflight. */
export async function migrateSky(database: Firestore) {
  const shards = await validateSkyMigration(database);
  if (shards === false) return false;
  const batch = database.batch();
  shards.forEach((entries, i) => batch.create(database.doc(`sky/${i.toString(16)}`), { entries }));
  batch.set(database.doc(skyMigrationPath), { complete: true }, { merge: true });
  await batch.commit();
  return true;
}
