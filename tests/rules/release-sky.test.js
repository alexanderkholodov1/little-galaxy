import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { beforeAll, afterAll, beforeEach, expect, it } from 'vitest';
import { migrateSky } from '../../apps/stand/src/sky.ts';
import { releaseSky, prepareSkyMigration, restoreSkySeason } from '../../apps/stand/src/release-sky.ts';
import { orbitFromVelocity, planetDefaults } from '../../packages/shared/src/index.ts';
import { applyControl, initialConfig, ensureLiveConfig } from '../../apps/stand/src/control.ts';
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
it.each([true, false])('keeps the season closed after a possibly partial deploy (previous=%s)', async (seasonOpen) => {
  await db.doc('config/live').update({ seasonOpen });
  await expect(releaseSky(db, async () => { throw new Error('deploy failed'); })).rejects.toThrow('Operate the sky');
  await expect(restoreSkySeason(db)).rejects.toThrow('Operate the sky');
  expect((await db.doc('config/live').get()).data().seasonOpen).toBe(false);
  expect((await db.doc('sky/0').get()).exists).toBe(false);
});
it('restores the flag after migration validation fails and can retry', async () => {
  await db.doc('objects/broken').set({ status: 'active' });
  let deployed = false;
  await expect(releaseSky(db, async () => { deployed = true; })).rejects.toThrow('Unsupported source object');
  expect(deployed).toBe(false);
  expect((await db.doc('config/live').get()).data().seasonOpen).toBe(true);
  await db.doc('objects/broken').delete();
  await releaseSky(db, async () => {});
  expect((await db.doc('sky/0').get()).exists).toBe(true);
});

it('initializes missing config once with closed defaults and preserves existing configuration', async () => {
  await db.doc('config/live').delete();
  await releaseSky(db, async () => {});
  expect((await db.doc('config/live').get()).data()).toEqual(initialConfig());
  const before = await snapshot();
  await releaseSky(db, async () => {});
  expect(await snapshot()).toEqual(before);
});

it('allows concurrent server startups without replacing existing settings', async () => {
  await db.doc('config/live').delete();
  await Promise.all([ensureLiveConfig(db), ensureLiveConfig(db)]);
  expect((await db.doc('config/live').get()).data()).toEqual(initialConfig());
  await db.doc('config/live').update({ seasonOpen: true, idleSeconds: 45 });
  const before = (await db.doc('config/live').get()).updateTime;
  await ensureLiveConfig(db);
  expect((await db.doc('config/live').get()).updateTime).toEqual(before);
});

it('cannot replace a shard created after validation but before the atomic migration commit', async () => {
  await db.doc('config/live').update({ seasonOpen: false });
  const proxy = new Proxy(db, { get(target, key) {
    if (key === 'batch') return () => {
      const batch = target.batch(), commit = batch.commit.bind(batch);
      batch.commit = async () => {
        await db.doc('sky/0').create({ entries: { visitor: { id: 'keep' } } });
        return commit();
      };
      return batch;
    };
    const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
  } });
  await expect(migrateSky(proxy)).rejects.toThrow();
  expect((await db.doc('sky/0').get()).data()).toEqual({ entries: { visitor: { id: 'keep' } } });
  expect((await db.doc('migrations/sky-v1').get()).exists).toBe(false);
});

it('preserves an explicit emergency close when restoration recovery was retained', async () => {
  await prepareSkyMigration(db);
  await migrateSky(db);
  await Promise.all([restoreSkySeason(db), applyControl(db, ['flag', 'seasonOpen', 'off'])]);
  await restoreSkySeason(db);
  expect((await db.doc('config/live').get()).data().seasonOpen).toBe(false);
});

it('keeps the season closed when migration fails after deployment, including recovery retries', async () => {
  await expect(releaseSky(db, async () => {
    await db.doc('objects/broken').set({ status: 'active' });
  })).rejects.toThrow('Operate the sky');
  await expect(restoreSkySeason(db)).rejects.toThrow('Operate the sky');
  expect((await db.doc('config/live').get()).data().seasonOpen).toBe(false);
  await db.doc('objects/broken').delete();
  await releaseSky(db, async () => {});
  expect((await db.doc('config/live').get()).data().seasonOpen).toBe(true);
});

it('preserves the emergency close and other controls made during deployment', async () => {
  await releaseSky(db, async () => {
    await Promise.all([applyControl(db, ['flag', 'seasonOpen', 'off']), applyControl(db, ['flag', 'edits', 'off'])]);
  });
  expect((await db.doc('config/live').get()).data()).toEqual({ seasonOpen: false, edits: false });
});

it('refuses to open writes while a migration window is active', async () => {
  await prepareSkyMigration(db);
  await expect(applyControl(db, ['flag', 'seasonOpen', 'on'])).rejects.toThrow(/migration/i);
  expect((await db.doc('config/live').get()).data().seasonOpen).toBe(false);
});

it('never overwrites existing shards when the completion marker is absent', async () => {
  await db.doc('sky/0').set({ entries: { visitor: { id: 'keep' } } });
  const before = (await db.doc('sky/0').get()).updateTime;
  let deployed = false;
  await expect(releaseSky(db, async () => { deployed = true; })).rejects.toThrow(/existing sky shards/i);
  expect(deployed).toBe(false);
  expect((await db.doc('sky/0').get()).updateTime).toEqual(before);
});

it.each(['duplicate', 'capacity', 'bytes'])('rejects %s sources before deploying', async (failure) => {
  const data = { schemaVersion: 2, ownerUid: 'alice', type: 'planet', nameKey: 'quiet-aurora',
    params: planetDefaults({ size: .4, palette: 0, oceans: .5 }), orbit: orbitFromVelocity(0, 2.58, 0, Date.now()),
    status: 'active', createdAt: Timestamp.now(), updatedAt: Timestamp.now(), season: 'bad-2026' };
  const batch = db.batch();
  if (failure === 'duplicate') {
    batch.set(db.doc('objects/a'), data); batch.set(db.doc('objects/b'), data);
  } else if (failure === 'bytes') {
    await db.doc('objects/large').set({ ...data, legacyNote: 'x'.repeat(600_001) });
  } else {
    // Repeated IDs chosen for one partition exceed its 512-entry limit.
    const ids = Array.from({ length: 513 }, (_, i) => `a-owner-${i}`);
    for (let start = 0; start < ids.length; start += 450) {
      const group = db.batch();
      for (const id of ids.slice(start, start + 450)) group.set(db.doc(`objects/${id}`), { ...data, ownerUid: id });
      await group.commit();
    }
  }
  if (failure === 'duplicate') await batch.commit();
  let deployed = false;
  await expect(releaseSky(db, async () => { deployed = true; })).rejects.toThrow(failure === 'duplicate' ? 'Multiple active objects' : 'capacity exceeded');
  expect(deployed).toBe(false);
  expect((await db.doc('config/live').get()).data().seasonOpen).toBe(true);
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
