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
} from 'firebase/firestore';
import {
  createGalaxyStore,
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
  await seed('config/live', { activePublicGalaxyId: 'g', boothGalaxyId: 'g', seasonOpen: false });
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
  it.each(['dayMutations', 'mass', 'bodies', 'blackholes', 'dayLaunches', 'contributors', 'tokens', 'sequence'])(
    'rejects forged head %s deltas in actual rules',
    async (field) => {
      const s = forged((path, d) => {
        if (path.endsWith('/control/head')) d[field] += 1;
        return d;
      });
      await assertFails(s.launch('g', intent()));
      expect((await getDoc(doc(context().firestore(), 'galaxies/g/actions/n1'))).exists()).toBe(
        false,
      );
    },
  );
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
  it('creates at most three account galaxies and rejects anonymous creation', async () => {
    const google = { ...provider, email: 'player@example.com' };
    const signed = createGalaxyStore(firestoreGalaxyDriver(context('player', google).firestore()), {
      uid: 'player',
      memberId: 'player-label',
      now: () => Date.now(),
    });
    for (let i = 0; i < 3; i++)
      await assertSucceeds(
        signed.admin.create(
          initialGalaxy('own' + i, 'player', 'Own galaxy', Date.now(), 'kernel-sha256'),
        ),
      );
    await expect(
      signed.admin.create(initialGalaxy('own4', 'player', 'Fourth', Date.now(), 'kernel-sha256')),
    ).rejects.toThrow();
    await assertFails(
      store().admin.create(
        initialGalaxy('anonymous', 'alice', 'Anonymous galaxy', Date.now(), 'kernel-sha256'),
      ),
    );
    await assertFails(
      setDoc(doc(context('player', google).firestore(), 'galaxyAccounts/player'), {
        ids: ['own0', 'own1', 'own2', 'fourth'],
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
    await assertFails(setDoc(doc(user, 'galaxies/g/control/certified'), { sequence: 1 }));
    await assertSucceeds(setDoc(doc(admin, 'galaxies/g/certifications/1'), { sequence: 1 }));
    await assertSucceeds(setDoc(doc(admin, 'galaxies/g/control/certified'), { sequence: 1 }));
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
