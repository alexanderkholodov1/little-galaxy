import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { beforeAll, afterAll, beforeEach, expect, it } from 'vitest';
import { claimLease, startLeasedStand } from '../../apps/stand/src/lease.ts';
import { migrateSky } from '../../apps/stand/src/sky.ts';
import { orbitFromVelocity, planetDefaults } from '../../packages/shared/src/index.ts';
let app, database;
beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Demo emulators required');
  app = initializeApp({ projectId: 'demo-little-galaxy' }, 'lease-test'); database = getFirestore(app);
});
beforeEach(async () => { await database.doc('leases/stand').delete(); });
afterAll(async () => { await database.terminate(); await deleteApp(app); });
it('elects one contender atomically, rejects a follower heartbeat and fences the previous owner after expiry', async () => {
  const acquired = await Promise.all(['beacon', 'laptop'].map((owner) => claimLease(database, owner, 1000, 90)));
  expect(acquired.filter(Boolean)).toHaveLength(1);
  const leader = acquired[0] ? 'beacon' : 'laptop', follower = acquired[0] ? 'laptop' : 'beacon';
  expect(await claimLease(database, follower, 1089, 90)).toBe(false);
  expect(await claimLease(database, follower, 1090, 90)).toBe(true);
  expect(await claimLease(database, leader, 1091, 90)).toBe(false);
  expect((await database.doc('leases/stand').get()).data().owner).toBe(follower);
});
it('automatically starts the follower services when a crashed leader lease expires', async () => {
  const errors = [], events = [];
  await claimLease(database, 'crashed-beacon', Date.now(), 350);
  const stop = startLeasedStand(database, () => {
    events.push('start'); return async () => { events.push('stop'); };
  }, () => errors.push('failed'), { owner: 'backup-laptop', heartbeatMs: 30, leaseMs: 250 });
  try {
    expect(events).toEqual([]);
    await expect.poll(() => events).toEqual(['start']);
    await expect.poll(async () => (await database.doc('leases/stand').get()).data()?.owner).toBe('backup-laptop');
  } finally { await stop(); }
  expect(events).toEqual(['start', 'stop']); expect(errors).toEqual([]);
  expect((await database.doc('leases/stand').get()).exists).toBe(false);
});
it('runs only one service set with two healthy contenders and releases it on shutdown', async () => {
  const events = [], errors = [];
  const start = (owner) => () => { events.push(`start:${owner}`); return async () => { events.push(`stop:${owner}`); }; };
  const first = startLeasedStand(database, start('beacon'), () => errors.push('failed'), { owner: 'beacon', heartbeatMs: 100, leaseMs: 5000 });
  const second = startLeasedStand(database, start('laptop'), () => errors.push('failed'), { owner: 'laptop', heartbeatMs: 100, leaseMs: 5000 });
  try {
    await expect.poll(() => events.length, { timeout: 10_000 }).toBe(1);
    const owner = (await database.doc('leases/stand').get()).data().owner;
    if (owner === 'beacon') await first(); else await second();
    await expect.poll(() => events.filter((e) => e.startsWith('start:')).length, { timeout: 10_000 }).toBe(2);
  } finally { await first(); await second(); }
  expect(events.filter((e) => e.startsWith('stop:'))).toHaveLength(2);
  expect(errors).toEqual([]);
});
it('migrates legacy and seeded active objects only while closed and preserves exact source records', async () => {
  await database.recursiveDelete(database.collection('objects'));
  const data = { schemaVersion: 2, ownerUid: 'alice', type: 'planet', nameKey: 'quiet-aurora',
    params: planetDefaults({ size: .4, palette: 0, oceans: .5 }), orbit: orbitFromVelocity(0, 2.58, 0, Date.now()),
    status: 'active', createdAt: Timestamp.now(), updatedAt: Timestamp.now(), season: 'bad-2026' };
  await database.doc('objects/legacy').set(data);
  await database.doc('config/live').set({ seasonOpen: true });
  await expect(migrateSky(database)).rejects.toThrow('Close the season');
  await database.doc('config/live').set({ seasonOpen: false });
  await migrateSky(database);
  const shards = await database.collection('sky').get();
  expect(shards.size).toBe(16);
  expect(shards.docs.flatMap((d) => Object.values(d.data().entries))).toEqual([{ id: 'legacy', data }]);
});
