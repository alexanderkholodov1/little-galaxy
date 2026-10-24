import type { Firestore } from 'firebase-admin/firestore';
import { readObject, skyBucket } from '@little-galaxy/shared';
/** Operator-only migration. Close launches AND edits first; do not run concurrently with client writes. */
export async function migrateSky(database: Firestore) {
  const config = await database.doc('config/live').get();
  if (config.data()?.seasonOpen) throw new Error('Close the season before migrating the sky.');
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
  const batch = database.batch();
  shards.forEach((entries, i) => batch.set(database.doc(`sky/${i.toString(16)}`), { entries }));
  await batch.commit();
}
