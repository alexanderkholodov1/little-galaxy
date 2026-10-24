import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { beforeAll, afterAll, beforeEach, expect, it } from 'vitest';
import { migrateSky } from '../../apps/stand/src/sky.ts';
import { releaseSky, prepareSkyMigration, restoreSkySeason } from '../../apps/stand/src/release-sky.ts';
import { orbitFromVelocity, planetDefaults } from '../../packages/shared/src/index.ts';
let app, db;
beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Demo emulator required');
  app = initializeApp({ projectId: 'demo-little-galaxy' }, 'release-sky'); db = getFirestore(app);
});
beforeEach(async () => {
  await db.recursiveDelete(db.collection('objects'));
  await db.recursiveDelete(db.collection('sky'));
  await db.doc('migrations/sky-v1').delete();
  await db.doc('config/live').set({ seasonOpen: true, edits: true });
});
afterAll(async () => { await db.terminate(); await deleteApp(app); });
const snapshot = async () => (await db.getAll(db.doc('config/live'), db.doc('migrations/sky-v1'), ...Array.from({ length: 16 }, (_, i) => db.doc(`sky/${i.toString(16)}`))))
  .map((doc) => [doc.data(), doc.updateTime]);
it('migrates once and makes second releases and direct reruns write nothing', async () => {
  let deploys = 0;
  await releaseSky(db, async () => { deploys++; expect((await db.doc('config/live').get()).data().seasonOpen).toBe(false); });
  expect((await db.doc('config/live').get()).data()).toEqual({ seasonOpen: true, edits: true });
  const before = await snapshot();
  await releaseSky(db, async () => { deploys++; expect((await db.doc('config/live').get()).data().seasonOpen).toBe(true); });
  await migrateSky(db);
  expect(deploys).toBe(2);
  expect(await snapshot()).toEqual(before);
});
it.each([true, false])('restores seasonOpen=%s after a failed deploy', async (seasonOpen) => {
  await db.doc('config/live').update({ seasonOpen });
  await expect(releaseSky(db, async () => { throw new Error('deploy failed'); })).rejects.toThrow('deploy failed');
  expect((await db.doc('config/live').get()).data().seasonOpen).toBe(seasonOpen);
  expect((await db.doc('sky/0').get()).exists).toBe(false);
});
it('restores the flag after migration validation fails and can retry', async () => {
  await db.doc('objects/broken').set({ status: 'active' });
  await expect(releaseSky(db, async () => {})).rejects.toThrow('Unsupported source object');
  expect((await db.doc('config/live').get()).data().seasonOpen).toBe(true);
  await db.doc('objects/broken').delete();
  await releaseSky(db, async () => {});
  expect((await db.doc('sky/0').get()).exists).toBe(true);
});
it('recovers the original flag after interruption, including completed migration before restoration', async () => {
  await prepareSkyMigration(db);
  expect((await db.doc('config/live').get()).data().seasonOpen).toBe(false);
  await migrateSky(db);
  await restoreSkySeason(db);
  expect((await db.doc('config/live').get()).data().seasonOpen).toBe(true);
  const before = await snapshot(); await restoreSkySeason(db); expect(await snapshot()).toEqual(before);
});
it('preserves exact legacy and seeded records and never resets later live shard edits', async () => {
  const data = { schemaVersion: 2, ownerUid: 'alice', type: 'planet', nameKey: 'quiet-aurora',
    params: planetDefaults({ size: .4, palette: 0, oceans: .5 }), orbit: orbitFromVelocity(0, 2.58, 0, Date.now()),
    status: 'active', createdAt: Timestamp.now(), updatedAt: Timestamp.now(), season: 'bad-2026' };
  await db.doc('objects/legacy').set(data);
  await db.doc('objects/seed').set({ ...data, ownerUid: '' });
  await releaseSky(db, async () => {});
  expect((await db.collection('sky').get()).docs.flatMap((d) => Object.values(d.data().entries)))
    .toEqual(expect.arrayContaining([{ id: 'legacy', data }, { id: 'seed', data: { ...data, ownerUid: '' } }]));
  await db.doc('sky/0').update({ entries: { later: { id: 'later' } } });
  const before = await snapshot(); await migrateSky(db); expect(await snapshot()).toEqual(before);
});
it('fails loudly and retains recovery state if restoration fails', async () => {
  const proxy = new Proxy(db, { get(target, key) {
    if (key === 'runTransaction') return async (callback) => {
      if ((await db.doc('migrations/sky-v1').get()).data()?.complete) throw new Error('restoration unavailable');
      return target.runTransaction(callback);
    };
    const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
  } });
  await expect(releaseSky(proxy, async () => {})).rejects.toThrow(/restor/i);
  expect((await db.doc('migrations/sky-v1').get()).data().seasonOpenBefore).toBe(true);
  await restoreSkySeason(db);
  expect((await db.doc('config/live').get()).data().seasonOpen).toBe(true);
});

it('retains the original flag on retry after interruption before migration', async () => {
  await prepareSkyMigration(db);
  await releaseSky(db, async () => {
    expect((await db.doc('config/live').get()).data().seasonOpen).toBe(false);
    await db.doc('config/live').update({ edits: false });
  });
  expect((await db.doc('config/live').get()).data()).toEqual({ seasonOpen: true, edits: false });
});
