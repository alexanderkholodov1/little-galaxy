import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  limit,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import {
  createGalaxyStore,
  canonicalHash,
  initialGalaxy,
  initialHead,
  initialMember,
  quotaWindow,
} from '../../packages/shared/src/galaxy-store.ts';
import { firestoreGalaxyDriver } from '../../packages/shared/src/firestore-galaxy-driver.ts';
let env;
let now;
let galaxy;
const provider = {
  firebase: { sign_in_provider: 'google.com' },
  email_verified: true,
  email: 'kholodov.alexander1@gmail.com',
};
const context = (uid = 'alice', claims) =>
  env.authenticatedContext(uid, claims ?? { firebase: { sign_in_provider: 'anonymous' } });
const store = (uid = 'alice', claims, admin = false) =>
  createGalaxyStore(firestoreGalaxyDriver(context(uid, claims).firestore()), {
    uid,
    memberId: `m-${uid}`,
    now: () => Date.now(),
    admin,
  });
const intent = (id = 'n1', extra = {}) => ({
  id,
  type: 'launch',
  kind: 'planet',
  system: '0',
  origin: [7000000, 0],
  velocity: [0, 1400000],
  seed: 42,
  design: { colour: 0 },
  effectiveTick: Math.ceil(((Date.now() - galaxy.epoch + 2400) * 120) / 1000),
  ...extra,
});
async function seed(path, data) {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), path), data));
}
async function patch(path, data) {
  await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), path), data));
}
beforeAll(async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-little-galaxy',
    firestore: { host, port: Number(port), rules: await readFile('firestore.rules', 'utf8') },
  });
});
afterAll(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  now = Date.now();
  galaxy = initialGalaxy('g', 'operator', 'BAD 2026', now - 10000, 'kernel-sha256');
  await seed('galaxies/g', galaxy);
  await seed('galaxies/g/control/head', initialHead(now));
  await seed('quotaWindows/' + quotaWindow(now).id, quotaWindow(now));
  await seed('config/live', { activePublicGalaxyId: 'g', boothGalaxyId: 'g', seasonOpen: true });
  await seed('config/admins', { emails: ['kholodov.alexander1@gmail.com'] });
});
describe('atomic galaxy admission', () => {
  it('accepts a real adapter transaction, loads history and deduplicates a nonce', async () => {
    const s = store(),
      i = intent();
    const a = await assertSucceeds(s.launch('g', i));
    expect((await s.launch('g', i)).sequence).toBe(1);
    expect(a.sequence).toBe(1);
    expect((await s.loadGalaxy('g')).actions).toHaveLength(1);
    await expect(s.launch('g', intent('n2'))).rejects.toThrow();
  });
  it('rejects partial action/body/head/cache writes and history rewriting', async () => {
    const db = context().firestore();
    for (const path of [
      'actions/forged',
      'objects/forged',
      'control/head',
      'logPages/0',
      'checkpoints/latest',
    ])
      await assertFails(setDoc(doc(db, 'galaxies/g/' + path), { forged: true }));
    await store().launch('g', intent());
    for (const path of [
      'actions/n1',
      'logPages/0',
      'objects/n1',
      'checkpoints/latest',
      'control/head',
    ])
      await assertFails(deleteDoc(doc(db, 'galaxies/g/' + path)));
    await assertFails(updateDoc(doc(db, 'galaxies/g/actions/n1'), { displayName: 'Forged' }));
  });
  it.each(['frozen', 'archived'])('blocks launch into %s', async (status) => {
    await patch('galaxies/g', { status });
    await expect(store().launch('g', intent())).rejects.toThrow();
  });
  it('blocks old public pointer and wrong generation', async () => {
    await patch('config/live', { activePublicGalaxyId: 'other' });
    await expect(store().launch('g', intent())).rejects.toThrow();
  });
  it.each([
    ['galaxy bodies', { bodies: 1024 }, {}, 'planet'],
    ['galaxy mass', { mass: 96000000 }, {}, 'planet'],
    ['galaxy black holes', { blackholes: 4 }, {}, 'blackhole'],
    ['player slots', {}, { bodyIds: ['a', 'b', 'c'] }, 'planet'],
    ['player mass', {}, { mass: 3100000 }, 'planet'],
    ['player black hole', {}, { blackholes: 1 }, 'blackhole'],
    ['stellar recipe', {}, { stellar: 1 }, 'star'],
    ['daily player', {}, { dayLaunches: 6 }, 'planet'],
    ['daily galaxy', { dayLaunches: 900 }, {}, 'planet'],
    ['lifetime log', { sequence: 4096 }, {}, 'planet'],
  ])('denies %s without partial documents', async (_, head, member, kind) => {
    await patch('galaxies/g/control/head', head);
    await seed('galaxies/g/members/alice', { ...initialMember('m-alice', now - 20000), ...member });
    await expect(store().launch('g', intent('n1', { kind }))).rejects.toThrow();
    expect((await getDoc(doc(context().firestore(), 'galaxies/g/actions/n1'))).exists()).toBe(
      false,
    );
  });
  it('accepts black-hole mass and binary physical slots', async () => {
    const a = await store().launch('g', intent('hole', { kind: 'blackhole' }));
    expect(a.sequence).toBe(1);
    await expect(
      store('bob').launch('g', intent('hole2', { kind: 'blackhole' })),
    ).rejects.toThrow();
    await patch('galaxies/g/control/head', { tokens: 6, lastBlackholeAt: 0 });
    await assertSucceeds(
      store('carol').launch('g', intent('pair', { kind: 'binary', system: '1' })),
    );
  });
  it('enforces edits ownership and preserves launch orbit', async () => {
    await store().launch('g', intent());
    const edit = {
      id: 'edit',
      type: 'edit',
      bodyId: 'n1',
      design: { colour: 2 },
      effectiveTick: intent().effectiveTick + 1,
    };
    await expect(store('bob').edit('g', edit)).rejects.toThrow();
    await patch('galaxies/g/members/alice', {
      mutationTime: new Date(now - 20000),
      lastMutationAt: now - 20000,
    });
    await assertSucceeds(store().edit('g', edit));
    const b = await getDoc(doc(context().firestore(), 'galaxies/g/objects/n1'));
    expect(b.data().launch.origin).toEqual([7000000, 0]);
  });
  it('accepts five successive launches by one member and a moon from a member with two bodies', async () => {
    const s = store();
    for (let k = 1; k <= 5; k++) {
      if (k > 1) {
        await patch('galaxies/g/members/alice', {
          mutationTime: new Date(Date.now() - 20000),
          lastMutationAt: Date.now() - 20000,
          ...(k > 3 ? { bodyIds: ['n1', 'n2'] } : {}),
        });
      }
      await assertSucceeds(s.launch('g', intent(`n${k}`)));
    }
    const bob = store('bob');
    await patch('galaxies/g/control/head', {
      tokens: 6,
      bucketSlot: Math.floor(Date.now() / 2000),
    });
    await assertSucceeds(bob.launch('g', intent('b-planet', { kind: 'planet', system: '1' })));
    await patch('galaxies/g/members/bob', {
      mutationTime: new Date(Date.now() - 20000),
      lastMutationAt: Date.now() - 20000,
    });
    await patch('galaxies/g/control/head', {
      tokens: 6,
      bucketSlot: Math.floor(Date.now() / 2000),
    });
    await assertSucceeds(bob.launch('g', intent('b-asteroid', { kind: 'asteroid', system: '1' })));
    await patch('galaxies/g/members/bob', {
      mutationTime: new Date(Date.now() - 20000),
      lastMutationAt: Date.now() - 20000,
    });
    await patch('galaxies/g/control/head', {
      tokens: 6,
      bucketSlot: Math.floor(Date.now() / 2000),
    });
    await assertSucceeds(
      bob.launch('g', intent('b-moon', { kind: 'moon', system: '1', parent: 'b-planet' })),
    );
  });
});
describe('privacy and administration', () => {
  it('allows public history and denies private members and unbounded lists', async () => {
    const db = context().firestore();
    await store().setName('g', 'Alice');
    await assertSucceeds(getDoc(doc(db, 'galaxies/g')));
    await assertSucceeds(getDoc(doc(db, 'galaxies/g/members/alice')));
    await assertFails(getDoc(doc(context('bob').firestore(), 'galaxies/g/members/alice')));
    await assertFails(getDocs(collection(db, 'galaxies/g/members')));
    await assertSucceeds(
      getDocs(query(collection(db, 'galaxies'), where('visibility', '==', 'public'), limit(100))),
    );
    await assertFails(updateDoc(doc(db, 'galaxies/g/members/alice'), { launches: 999 }));
    expect(await store().touch('g')).toBe(false);
  });
  it('allows any profile write, rename included, only five minutes after the previous one', async () => {
    await store().setName('g', 'Alice');
    const member = doc(context().firestore(), 'galaxies/g/members/alice');
    const rename = (displayName) =>
      updateDoc(member, { displayName, lastSeen: Date.now(), updatedTime: serverTimestamp() });
    await patch('galaxies/g/members/alice', { updatedTime: new Date(Date.now() - 16000) });
    await assertFails(rename('Bob'));
    await patch('galaxies/g/members/alice', { updatedTime: new Date(Date.now() - 299000) });
    await assertFails(rename('Bob'));
    await patch('galaxies/g/members/alice', { updatedTime: new Date(Date.now() - 301000) });
    await assertSucceeds(rename('Bob'));
  });
  it.each([
    {},
    { ...provider, email_verified: false },
    { ...provider, email: 'outsider@example.com' },
    { ...provider, firebase: { sign_in_provider: 'password' } },
  ])('denies unverified/nonallowlisted admin %#', async (claims) => {
    await assertFails(store('operator', claims, true).admin.update('g', 1, { status: 'frozen' }));
    await assertFails(
      setDoc(doc(context('operator', claims).firestore(), 'config/admins'), {
        emails: ['outsider@example.com'],
      }),
    );
  });
  it('allows only allowlisted verified Google admins to freeze, choose booth and read metrics', async () => {
    const admin = store('operator', provider, true);
    await assertSucceeds(admin.admin.update('g', 1, { status: 'frozen', writePolicy: 'frozen' }));
    await assertSucceeds(admin.admin.select('g', 'boothGalaxyId'));
    await assertSucceeds(admin.metrics('g'));
    await expect(store().admin.update('g', 1, { status: 'active' })).rejects.toThrow();
  });
  it('denies outsider reads and self-admission to invite-only members galaxies', async () => {
    await patch('galaxies/g', { visibility: 'invite-only', writePolicy: 'members' });
    await assertFails(getDoc(doc(context().firestore(), 'galaxies/g')));
    await expect(store().launch('g', intent())).rejects.toThrow();
    await assertFails(store().setName('g', 'intruder'));
    await seed('galaxies/g/members/alice', initialMember('m-alice', now));
    await assertSucceeds(getDoc(doc(context().firestore(), 'galaxies/g')));
    await assertSucceeds(store().launch('g', intent()));
  });
  it('denies checkpoint certifications to players, permits immutable admin certification', async () => {
    const path = 'galaxies/g/certifications/0';
    await assertFails(setDoc(doc(context().firestore(), path), { hash: 'fake' }));
    await assertSucceeds(
      setDoc(doc(context('operator', provider).firestore(), path), { hash: 'trusted' }),
    );
    await assertFails(
      updateDoc(doc(context('operator', provider).firestore(), path), { hash: 'changed' }),
    );
  });
});

describe('hostile clients bypassing adapter admission', () => {
  function forged(modify) {
    const driver = firestoreGalaxyDriver(context().firestore());
    return createGalaxyStore(
      {
        ...driver,
        transaction: (run) =>
          driver.transaction((tx) =>
            run({
              get: tx.get,
              set: (path, data) => tx.set(path, modify(path, structuredClone(data))),
            }),
          ),
      },
      { uid: 'alice', memberId: 'm-alice', now: () => Date.now() },
    );
  }
  it.each([
    'dayMutations',
    'mass',
    'bodies',
    'blackholes',
    'dayLaunches',
    'contributors',
    'tokens',
    'sequence',
  ])('rejects forged head %s deltas in actual rules', async (field) => {
    const s = forged((path, d) => {
      if (path.endsWith('/control/head')) d[field] += 1;
      return d;
    });
    await assertFails(s.launch('g', intent()));
    expect((await getDoc(doc(context().firestore(), 'galaxies/g/actions/n1'))).exists()).toBe(
      false,
    );
  });
  it.each(['mass', 'blackholes', 'stellar', 'dayLaunches', 'launches'])(
    'rejects forged member %s deltas',
    async (field) => {
      await assertFails(
        forged((path, d) => {
          if (path.endsWith('/members/alice')) d[field] += 1;
          return d;
        }).launch('g', intent()),
      );
    },
  );
  it('requires body, page and checkpoint reciprocity', async () => {
    for (const suffix of ['/objects/n1', '/logPages/0', '/checkpoints/latest']) {
      const d = firestoreGalaxyDriver(context().firestore());
      const s = createGalaxyStore(
        {
          ...d,
          transaction: (run) =>
            d.transaction((tx) =>
              run({
                get: tx.get,
                set: (p, v) => {
                  if (!p.endsWith(suffix)) tx.set(p, v);
                },
              }),
            ),
        },
        { uid: 'alice', memberId: 'm-alice', now: () => Date.now() },
      );
      await assertFails(s.launch('g', intent()));
    }
  });
  it('refuses an edit that would create a body nobody launched', async () => {
    const real = firestoreGalaxyDriver(context('mallory').firestore());
    // A hostile client pretends the body exists so its own ownership precheck passes.
    const ghost = { id: 'ghost', memberId: 'm-mallory', kind: 'planet', system: '0', parent: '',
      moons: 0, design: {}, tombstone: false, lastAction: '' };
    const s = createGalaxyStore(
      {
        ...real,
        transaction: (run) =>
          real.transaction((tx) =>
            run({ get: (p) => (p.endsWith('/objects/ghost') ? ghost : tx.get(p)), set: tx.set }),
          ),
      },
      { uid: 'mallory', memberId: 'm-mallory', now: () => Date.now(), admin: true },
    );
    await store('mallory').setName('g', 'Mallory');
    const edit = { id: 'evil', type: 'edit', bodyId: 'ghost', design: { colour: 1 } };
    await assertFails(s.edit('g', { ...edit, effectiveTick: intent().effectiveTick }));
    expect((await getDoc(doc(context().firestore(), 'galaxies/g/actions/evil'))).exists()).toBe(
      false,
    );
  });
  it('rejects forged effective time and generation', async () => {
    for (const field of ['generation', 'effectiveTick'])
      await assertFails(
        forged((path, d) => {
          if (path.includes('/actions/')) {
            if (field === 'generation') d.generation++;
            else d.intent.effectiveTick += 999999;
          }
          return d;
        }).launch('g', intent()),
      );
  });
});

describe('release migration', () => {
  async function adminDb() {
    const { initializeApp, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    const app =
      getApps().find((a) => a.name === 'b1-migration') ??
      initializeApp({ projectId: 'demo-little-galaxy' }, 'b1-migration');
    return getFirestore(app);
  }
  it('imports once inside the release, preserves sources, and restores the season', async () => {
    const { releaseGalaxies, migrateGalaxies } = await import('../../apps/stand/src/galaxies.ts');
    const db = await adminDb();
    const legacy = {
      schemaVersion: 2,
      ownerUid: 'alice',
      type: 'planet',
      status: 'active',
      orbit: { a: 7, e: 0.999 },
      params: { colour: 2 },
    };
    await seed('objects/legacy', legacy);
    await patch('config/live', { seasonOpen: true });
    await releaseGalaxies(
      db,
      async () => {
        expect((await db.doc('config/live').get()).data().seasonOpen).toBe(false);
      },
      async () => {},
    );
    expect((await db.doc('config/live').get()).data()).toMatchObject({
      seasonOpen: true,
      dataLayerVersion: 2,
      activePublicGalaxyId: 'bad-2026',
    });
    expect((await db.doc('objects/legacy').get()).data()).toEqual(legacy);
    const before = (await db.doc('galaxies/bad-2026').get()).updateTime;
    expect(await migrateGalaxies(db)).toBe(false);
    expect((await db.doc('galaxies/bad-2026').get()).updateTime).toEqual(before);
    const loaded = await store().loadGalaxy('bad-2026');
    expect(loaded.genesis[0].legacy.orbit).toEqual(legacy.orbit);
    expect(loaded.actions).toHaveLength(0);
  });
  it('ends a failed-then-retried release with the season as it was', async () => {
    const { releaseGalaxies } = await import('../../apps/stand/src/galaxies.ts');
    const db = await adminDb();
    await patch('config/live', { seasonOpen: true });
    // Fails in preflight planning, before any deploy: the source cannot be imported.
    await seed('objects/broken', { ownerUid: 'alice', type: 'planet', status: 'active' });
    const deploy = async () => {};
    await expect(releaseGalaxies(db, deploy, async () => {})).rejects.toThrow('Unsupported source');
    expect((await db.doc('config/live').get()).data().seasonOpen).toBe(true);
    await db.doc('objects/broken').delete();
    await releaseGalaxies(db, deploy, async () => {});
    expect((await db.doc('config/live').get()).data()).toMatchObject({
      seasonOpen: true,
      dataLayerVersion: 2,
    });
    expect((await db.doc('migrations/galaxies-v1').get()).data().complete).toBe(true);
  });
  it('retains a closed recovery window after deploy failure and honors emergency close', async () => {
    const { releaseGalaxies, restoreGalaxySeason } = await import(
      '../../apps/stand/src/galaxies.ts'
    );
    const { applyControl } = await import('../../apps/stand/src/control.ts');
    const db = await adminDb();
    await patch('config/live', { seasonOpen: true });
    await expect(
      releaseGalaxies(
        db,
        async () => {
          throw new Error('deploy interrupted');
        },
        async () => {},
      ),
    ).rejects.toThrow('SEASON KEPT CLOSED');
    await expect(restoreGalaxySeason(db)).rejects.toThrow();
    expect((await db.doc('config/live').get()).data().seasonOpen).toBe(false);
    await releaseGalaxies(
      db,
      async () => {
        await applyControl(db, ['flag', 'seasonOpen', 'off']);
      },
      async () => {},
    );
    expect((await db.doc('config/live').get()).data().seasonOpen).toBe(false);
  });
});

describe('remaining role, system and read boundaries', () => {
  it('creates at most three account galaxies, only for allowlisted keepers', async () => {
    const keeper = createGalaxyStore(firestoreGalaxyDriver(context('operator', provider).firestore()), {
      uid: 'operator',
      memberId: 'operator-label',
      now: () => Date.now(),
    });
    for (let i = 0; i < 3; i++)
      await assertSucceeds(
        keeper.admin.create(
          initialGalaxy('own' + i, 'operator', 'Own galaxy', Date.now(), 'kernel-sha256'),
        ),
      );
    await expect(
      keeper.admin.create(initialGalaxy('own4', 'operator', 'Fourth', Date.now(), 'kernel-sha256')),
    ).rejects.toThrow();
    await assertFails(
      store().admin.create(
        initialGalaxy('anonymous', 'alice', 'Anonymous galaxy', Date.now(), 'kernel-sha256'),
      ),
    );
    // Any other verified Google account is not a keeper.
    const google = { ...provider, email: 'stranger@example.com' };
    const stranger = createGalaxyStore(firestoreGalaxyDriver(context('stranger', google).firestore()), {
      uid: 'stranger',
      memberId: 'stranger-label',
      now: () => Date.now(),
    });
    await assertFails(
      stranger.admin.create(initialGalaxy('mine', 'stranger', 'Mine', Date.now(), 'kernel-sha256')),
    );
    await assertFails(
      setDoc(doc(context('stranger', google).firestore(), 'galaxyAccounts/stranger'), {
        ids: ['mine'],
      }),
    );
  });
  it('lets only allowlisted keepers write administrative audit records, even for a galaxy they own', async () => {
    const google = { ...provider, email: 'stranger@example.com' };
    await seed('galaxies/owned', { ...galaxy, id: 'owned', owner: 'stranger' });
    await assertFails(
      setDoc(doc(context('stranger', google).firestore(), 'galaxies/owned/adminActions/a'), {
        actor: 'stranger',
        type: 'update',
      }),
    );
    await assertSucceeds(
      setDoc(doc(context('operator', provider).firestore(), 'galaxies/owned/adminActions/a'), {
        actor: 'operator',
        type: 'update',
      }),
    );
  });
  it('admits two moons with reciprocal parent changes and retains player entitlements after admin removal', async () => {
    await store().launch('g', intent('planet'));
    await assertSucceeds(
      store('bob').launch('g', intent('moon1', { kind: 'moon', parent: 'planet' })),
    );
    await assertSucceeds(
      store('carol').launch('g', intent('moon2', { kind: 'moon', parent: 'planet' })),
    );
    await expect(
      store('dave').launch('g', intent('moon3', { kind: 'moon', parent: 'planet' })),
    ).rejects.toThrow();
    const a = store('operator', provider, true);
    await expect(
      a.admin.remove('g', {
        id: 'rm-host',
        type: 'remove',
        bodyId: 'planet',
        reason: 'test',
        effectiveTick: intent().effectiveTick,
      }),
    ).rejects.toThrow();
    await assertSucceeds(
      a.admin.remove('g', {
        id: 'rm-moon',
        type: 'remove',
        bodyId: 'moon1',
        reason: 'test',
        effectiveTick: intent().effectiveTick,
      }),
    );
    expect(
      (await getDoc(doc(context('bob').firestore(), 'galaxies/g/members/bob'))).data().bodyIds,
    ).toEqual(['moon1']);
  });
  it('uses admin and owner invitations without exposing Auth UIDs in the public label', async () => {
    const admin = store('operator', provider, true);
    await assertSucceeds(admin.admin.invite('g', 'invited', 'viewer'));
    const m = (
      await getDoc(doc(context('invited').firestore(), 'galaxies/g/members/invited'))
    ).data();
    expect(m.memberId).not.toBe('invited');
    expect(m.role).toBe('viewer');
    await expect(store('alice').admin.invite('g', 'someone', 'editor')).rejects.toThrow();
  });
  it('covers public page reads, private source paths, quota calendars and immutable administrative records', async () => {
    await store().launch('g', intent());
    const anonymous = env.unauthenticatedContext().firestore(),
      user = context().firestore(),
      admin = context('operator', provider).firestore();
    await assertSucceeds(getDoc(doc(anonymous, 'galaxies/g/logPages/0')));
    for (const path of [
      'galaxies/g/legacyObjects/source',
      'galaxies/g/legacySky/0',
      'config/admins',
      'adminAudit/a',
    ])
      await assertFails(getDoc(doc(user, path)));
    await assertSucceeds(getDoc(doc(user, 'quotaWindows/' + quotaWindow(now).id)));
    await assertFails(setDoc(doc(user, 'quotaWindows/forged'), quotaWindow(now)));
    for (const path of ['galaxies/g/archive/a', 'adminAudit/a']) {
      await assertSucceeds(setDoc(doc(admin, path), { at: now }));
      await assertFails(updateDoc(doc(admin, path), { at: now + 1 }));
      await assertFails(deleteDoc(doc(admin, path)));
    }
    for (const path of [
      'galaxies/g/genesis/a',
      'galaxies/g/legacyObjects/a',
      'galaxies/g/legacySky/a',
    ])
      await assertFails(setDoc(doc(user, path), { fake: true }));
    await assertFails(setDoc(doc(user, 'galaxies/g/control/certified'), { sequence: 1, tick: 600 }));
    const certify = (db, sequence, tick) => {
      const batch = writeBatch(db);
      batch.set(doc(db, `galaxies/g/certifications/${sequence}-${tick}`), { sequence });
      batch.set(doc(db, 'galaxies/g/control/certified'), { sequence, tick });
      return batch.commit();
    };
    await assertFails(certify(user, 1, 600));
    // One commit; a quiet log is certified again at a later tick, never an earlier one.
    await assertSucceeds(certify(admin, 1, 600));
    await assertSucceeds(certify(admin, 1, 72600));
    await assertFails(certify(admin, 1, 7200));
    await assertFails(certify(admin, 2, 80000));
    await assertFails(setDoc(doc(admin, 'galaxies/g/control/certified'), { sequence: 1, tick: 90000 }));
    await assertFails(
      setDoc(doc(user, 'galaxies/g/adminActions/a'), { actor: 'alice', type: 'update' }),
    );
  });
});

it('anchors a skewed device through authenticated emulator REST readTime', async () => {
  const { ServerClock } = await import('../../packages/shared/src/firestore-galaxy-driver.ts');
  const signup = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
    },
  );
  const { idToken } = await signup.json();
  expect(idToken).toBeTruthy();
  const clock = new ServerClock();
  const driver = firestoreGalaxyDriver(context().firestore(), {
    clock,
    getToken: async () => idToken,
    emulatorOrigin: `http://${process.env.FIRESTORE_EMULATOR_HOST}`,
  });
  expect((await driver.get('config/live')).activePublicGalaxyId).toBe('g');
  expect(Math.abs(clock.now() - Date.now())).toBeLessThan(1500);
});

it('serializes twenty real phones racing for the last galaxy slot without partial records', async () => {
  const h = initialHead(Date.now());
  h.bodies = 1023;
  h.mass = 32991000;
  h.systems = Object.fromEntries(
    Array.from({ length: 32 }, (_, i) => [
      String(i),
      {
        bodies: i === 0 ? 31 : 32,
        mass: i === 0 ? 1030000 : 1031000,
        compact: 1,
        giants: 0,
        blackholes: 0,
        ordinaryMass: i === 0 ? 30000 : 31000,
      },
    ]),
  );
  galaxy = { ...galaxy, epoch: Date.now() - 2_000_000 };
  await seed('galaxies/g', galaxy);
  const entries = [];
  let prefixHash = '';
  for (let i = 0; i < 63; i++) {
    const payload = {
      schemaVersion: 1,
      generation: 1,
      sequence: i + 1,
      previousHash: prefixHash,
      memberId: 'member-' + String(i).padStart(30, '0'),
      displayName: 'W'.repeat(24),
      acceptedAt: Date.now() - (63 - i) * 16000,
      intent: {
        ...intent('past-' + String(i).padStart(30, '0')),
        system: String(i % 32),
        design: {
          size: 1000000,
          palette: 1000000,
          oceans: 1000000,
          mountains: 1000000,
          clouds: 1000000,
          rings: 1000000,
          atmosphere: 1000000,
        },
        effectiveTick: (i + 1) * 120,
      },
    };
    prefixHash = await canonicalHash(payload);
    entries.push({ ...payload, hash: prefixHash });
  }
  h.sequence = 63;
  h.hash = prefixHash;
  h.dayMutations = 63;
  h.dayLaunches = 63;
  h.contributors = 63;
  expect(Buffer.byteLength(JSON.stringify(entries))).toBeGreaterThan(32768);
  await seed('galaxies/g/logPages/0', { entries, public: true });
  await seed('galaxies/g/control/head', h);
  const racers = Array.from({ length: 20 }, (_, i) => store('racer' + i));
  await Promise.all(racers.map((racer) => racer.loadGalaxy('g')));
  const outcomes = await Promise.allSettled(
    racers.map((racer, i) => racer.launch('g', intent('race' + i))),
  );
  expect(outcomes.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    expect((await getDocs(collection(db, 'galaxies/g/actions'))).size).toBe(1);
    expect((await getDocs(collection(db, 'galaxies/g/members'))).size).toBe(1);
    expect((await getDoc(doc(db, 'galaxies/g/control/head'))).data().bodies).toBe(1024);
    expect((await getDoc(doc(db, 'galaxies/g/logPages/0'))).data().entries).toHaveLength(64);
  });
});

it('rejects a forged historical first-seen date on first participation', async () => {
  const driver = firestoreGalaxyDriver(context().firestore());
  const hostile = createGalaxyStore(
    {
      ...driver,
      transaction: (run) =>
        driver.transaction((tx) =>
          run({
            get: tx.get,
            set: (path, data) =>
              tx.set(path, path.endsWith('/members/alice') ? { ...data, firstSeen: 0 } : data),
          }),
        ),
    },
    { uid: 'alice', memberId: 'm-alice', now: () => Date.now() },
  );
  await assertFails(hostile.launch('g', intent()));
});

it.each(['line\nline\nline', '<script>', 'x'.repeat(25)])(
  'denies forged invalid public name %j in rules',
  async (displayName) => {
    const driver = firestoreGalaxyDriver(context().firestore());
    await assertFails(
      driver.transaction(async (tx) => {
        tx.set('galaxies/g/members/alice', {
          ...initialMember('m-alice', Date.now()),
          displayName,
        });
      }),
    );
  },
);

it.each(['seasonOpen', 'launches', 'edits'])(
  'enforces the existing public %s kill switch against a forged client view',
  async (flag) => {
    if (flag === 'edits') {
      await store().launch('g', intent());
      await patch('galaxies/g/members/alice', {
        mutationTime: new Date(Date.now() - 20000),
        lastMutationAt: Date.now() - 20000,
      });
    }
    await patch('config/live', { [flag]: false });
    const real = firestoreGalaxyDriver(context().firestore());
    const hostile = createGalaxyStore(
      {
        ...real,
        transaction: (run) =>
          real.transaction((tx) =>
            run({
              get: async (path) => {
                const value = await tx.get(path);
                return path === 'config/live'
                  ? { ...value, seasonOpen: true, launches: true, edits: true }
                  : value;
              },
              set: tx.set,
            }),
          ),
      },
      { uid: 'alice', memberId: 'm-alice', now: () => Date.now() },
    );
    const action =
      flag === 'edits'
        ? hostile.edit('g', {
            id: 'rejected',
            type: 'edit',
            bodyId: 'n1',
            design: { colour: 2 },
            effectiveTick: intent().effectiveTick,
          })
        : hostile.launch('g', intent('rejected'));
    await assertFails(action);
  },
);

it('never lets a stale migration overwrite a phone edit after another migration completes', async () => {
  const { initializeApp, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app =
    getApps().find((a) => a.name === 'b1-migration') ??
    initializeApp({ projectId: 'demo-little-galaxy' }, 'b1-migration');
  const db = getFirestore(app);
  const { prepareGalaxies, migrateGalaxies, restoreGalaxySeason } = await import(
    '../../apps/stand/src/galaxies.ts'
  );
  await db
    .doc('objects/legacy')
    .set({
      schemaVersion: 2,
      ownerUid: 'alice',
      type: 'planet',
      status: 'active',
      orbit: { a: 7, e: 0.5 },
      params: { colour: 0 },
    });
  await prepareGalaxies(db);
  let calls = 0;
  const delayed = new Proxy(db, {
    get(target, key) {
      if (key === 'runTransaction')
        return async (callback) => {
          const result = await target.runTransaction(callback);
          if (++calls === 1) {
            await migrateGalaxies(db);
            await restoreGalaxySeason(db);
            const s = store(),
              loaded = await s.loadGalaxy('bad-2026');
            await s.edit('bad-2026', {
              id: 'later-edit',
              type: 'edit',
              bodyId: 'legacy',
              design: { colour: 2 },
              effectiveTick: Math.ceil(((Date.now() - loaded.galaxy.epoch + 2400) * 120) / 1000),
            });
          }
          return result;
        };
      const value = target[key];
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const copied = await migrateGalaxies(delayed);
  expect((await db.doc('galaxies/bad-2026/objects/legacy').get()).data().design).toEqual({
    colour: 2,
  });
  expect(copied).toBe(false);
});

it('lets read-only booth and replay viewers read the public selection without creating Auth identities', async () => {
  const db=env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db,'config/live')));
  await assertFails(getDoc(doc(db,'config/admins')));
  await assertFails(updateDoc(doc(db,'config/live'),{boothGalaxyId:'other'}));
});
