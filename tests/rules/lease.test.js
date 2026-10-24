import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { beforeAll, afterAll, beforeEach, expect, it, vi } from 'vitest';
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
it('rejects a contender whose host clock is ahead and fences all stale enrichment writes', async () => {
  const { writeMeteorShower } = await import('../../apps/stand/src/meteors.ts');
  const { publishSeason, buildSeason } = await import('../../apps/stand/src/memory.ts');
  const { writeSnapshot } = await import('../../apps/stand/src/snapshots.ts');
  const first = await claimLease(database, 'beacon');
  expect(first.fencingToken).toBeGreaterThan(0);
  const realNow = Date.now();
  // Skew only decision code: grpc itself uses Date.now for transport deadlines.
  const skewed = {
    doc: (path) => database.doc(path),
    runTransaction: (callback) => database.runTransaction(async (tx) => {
      let skew;
      const proxy = new Proxy(tx, { get(target, key) {
        if (key === 'get') return async (...args) => {
          const snapshot = await target.get(...args);
          skew = vi.spyOn(Date, 'now').mockReturnValue(realNow + 600_000);
          return snapshot;
        };
        const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
      } });
      try { return await callback(proxy); } finally { skew?.mockRestore(); }
    }),
  };
  expect(await claimLease(skewed, 'skewed-laptop')).toBe(false);
  await database.doc('leases/stand').update({ expiresAt: Timestamp.fromMillis(0) });
  const second = await claimLease(database, 'laptop');
  expect(second.fencingToken).toBeGreaterThan(first.fencingToken);
  await database.doc('config/live').set({ schemaVersion: 1, seasonOpen: true, meteorShowers: true });
  await expect(writeMeteorShower(database, undefined, undefined, first)).rejects.toThrow('Stand lease lost');
  await expect(publishSeason(database, buildSeason([], []), undefined, undefined, first)).rejects.toThrow('Stand lease lost');
  await expect(writeSnapshot(database, { schemaVersion: 1, objects: [], creators: 0, activeCount: 0 }, first)).rejects.toThrow('Stand lease lost');
  expect(await writeMeteorShower(database, undefined, undefined, second)).toBe(true);
});
it('keeps services through a transient heartbeat error but stops at the last confirmed deadline', async () => {
  const events = [], errors = [];
  const stop = startLeasedStand(database, () => { events.push('start'); return async () => { events.push('stop'); }; },
    () => errors.push('failed'), { owner: 'grace', heartbeatMs: 100, leaseMs: 1200 });
  let failure;
  try {
    await expect.poll(() => events).toEqual(['start']);
    failure = vi.spyOn(database, 'runTransaction').mockRejectedValue(new Error('temporary network failure'));
    await expect.poll(() => errors.length).toBeGreaterThan(0);
    expect(events).toEqual(['start']);
    await expect.poll(() => events, { timeout: 5000 }).toEqual(['start', 'stop']);
  } finally { failure?.mockRestore(); await stop(); }
});
it('automatically starts the follower services when a crashed leader lease expires', async () => {
  const errors = [], events = [];
  await claimLease(database, 'crashed-beacon', 350);
  const stop = startLeasedStand(database, () => {
    events.push('start'); return async () => { events.push('stop'); };
  }, () => errors.push('failed'), { owner: 'backup-laptop', heartbeatMs: 30, leaseMs: 250 });
  try {
    expect(events).toEqual([]);
    await expect.poll(() => events).toEqual(['start']);
    await expect.poll(async () => (await database.doc('leases/stand').get()).data()?.owner).toBe('backup-laptop');
  } finally { await stop(); }
  expect(events).toEqual(['start', 'stop']); expect(errors).toEqual([]);
  expect((await database.doc('leases/stand').get()).data().owner).toBeNull();
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
