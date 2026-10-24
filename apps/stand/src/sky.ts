import type { Firestore } from 'firebase-admin/firestore';
import { skyMigrationPath } from './release-sky.js';
import { readObject, skyBucket } from '@little-galaxy/shared';
/** Read-only preflight, also repeated by the writer inside the closed window. */
export async function validateSkyMigration(database: Firestore) {
  if ((await database.doc(skyMigrationPath).get()).data()?.complete) return false;
  const config = await database.doc('config/live').get();
  if (config.data()?.seasonOpen !== false) throw new Error('Close the season before migrating the sky.');
  if (!(await database.collection('sky').limit(1).get()).empty)
    throw new Error('Existing sky shards without a completed migration. Operate the sky: review existing data before retrying.');
  const objects = await database.collection('objects').where('status', '==', 'active').get();
  const shards = Array.from({ length: 16 }, () => ({} as Record<string, unknown>));
  for (const row of objects.docs) {
    const object = readObject(row.data());
    if (!object) throw new Error('Unsupported source object');
    // Operator-seeded unclaimed bodies use a stable ID partition; clients cannot replace their entry.
    const key = object.ownerUid || row.id;
    const shard = shards[parseInt(skyBucket(key), 16)];
    if (shard[key]) throw new Error('Multiple active objects for one owner');
    shard[key] = { id: row.id, data: row.data() };
    if (Object.keys(shard).length > 512 || Buffer.byteLength(JSON.stringify(shard)) > 600_000)
      throw new Error('Sky shard capacity exceeded');
  }
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
