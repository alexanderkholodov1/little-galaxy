import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  limit,
  limitToLast,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { editObject, launchPlanet, ownActive, ownObjects, relaunchObject } from '../../apps/web/src/galaxy-data.ts';
import {
  orbitFromVelocity,
  presets,
  SCHEMA_VERSION,
  SEASON,
  utcDay,
} from '../../packages/shared/src/index.ts';
import { initializeApp as adminApp, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getFirestore as adminFirestore } from 'firebase-admin/firestore';
import { sendInteraction, listenRecentEvents } from '../../apps/web/src/interaction-data.ts';
import { messageKeys } from '../../packages/shared/src/index.ts';
import { applyControl } from '../../apps/stand/src/control.ts';
import { startMeteorScheduler, writeMeteorShower } from '../../apps/stand/src/meteors.ts';
import { startSnapshotWriter } from '../../apps/stand/src/snapshots.ts';
vi.mock('../../apps/web/src/firebase.ts', () => ({ anonymousUid: vi.fn().mockResolvedValue('screen') }));
let env;
let admin;
const projectId = 'demo-little-galaxy';
const draft = { nameKey: 'quiet-aurora', params: { size: 0.4, palette: 0, oceans: 0.5 } };
const orbit = () => orbitFromVelocity(0, Math.sqrt(40 / 6), 0, Date.now());
const flags = {
  schemaVersion: SCHEMA_VERSION,
  appVersion: '0.3.0',
  seasonOpen: true,
  launches: true,
  comets: true,
  shake: true,
  shootingStars: true,
  assistantPublic: false,
  screenScene: 'galaxy',
};
const db = (uid = 'alice') => env.authenticatedContext(uid).firestore();
async function bypass(callback) {
  return env.withSecurityRulesDisabled((ctx) => callback(ctx.firestore()));
}
async function ageUser(uid = 'alice', overrides = {}) {
  await bypass((database) =>
    updateDoc(doc(database, 'users', uid), {
      lastWriteAt: Timestamp.fromMillis(Date.now() - 3000),
      ...overrides,
    }),
  );
}
/** Schema fixtures come from the shared domain contract; mutations below probe the rules boundary. */
async function launchBatch(
  database,
  { uid = 'alice', objectId = 'planet', writeId = 'launch', object = {}, user = {}, omit = [] } = {},
) {
  const old = (await getDoc(doc(database, 'users', uid))).data();
  const previous = old ? (await getDoc(doc(database, 'objects', old.activeObjectId))).data() : null;
  const at = serverTimestamp();
  /** @type {import('../../packages/shared/src/index.ts').GalaxyObject} */
  const body = {
    schemaVersion: SCHEMA_VERSION,
    ownerUid: uid,
    type: 'planet',
    ...draft,
    orbit: orbit(),
    status: 'active',
    createdAt: at,
    updatedAt: at,
    season: SEASON,
    ...object,
  };
  const day = utcDay(Date.now());
  const account = {
    schemaVersion: SCHEMA_VERSION,
    activeObjectId: objectId,
    launchDay: day,
    editDay: day,
    editsToday: old?.editDay === day ? (old.editsToday ?? 0) : 0,
    ...(old?.interactionDay !== undefined ? { interactionDay: old.interactionDay, interactionsToday: old.interactionsToday } : {}),
    launchesToday: old?.launchDay === day ? old.launchesToday + 1 : 1,
    lastWriteAt: at,
    lastShakeAt: old?.lastShakeAt ?? Timestamp.fromMillis(0),
    lastCometAt: old?.lastCometAt ?? Timestamp.fromMillis(0),
    lastStarAt: old?.lastStarAt ?? Timestamp.fromMillis(0),
    writeId,
    action: 'launch',
    ...user,
  };
  const batch = writeBatch(database);
  if (!omit.includes('object')) batch.set(doc(database, 'objects', objectId), body);
  if (!omit.includes('user')) batch.set(doc(database, 'users', uid), account);
  const base = { schemaVersion: SCHEMA_VERSION, uid, at, objectId, payload: body };
  if (!omit.includes('launch')) batch.set(doc(database, 'events', writeId), { ...base, type: 'launch' });
  if (!omit.includes('create'))
    batch.set(doc(database, 'events', `${writeId}-create`), { ...base, type: 'create' });
  if (previous) {
    const archived = { ...previous, status: 'hangar', updatedAt: at };
    if (!omit.includes('archive'))
      batch.update(doc(database, 'objects', old.activeObjectId), { status: 'hangar', updatedAt: at });
    if (!omit.includes('crumble'))
      batch.set(doc(database, 'events', `${writeId}-crumble`), {
        ...base,
        type: 'crumble',
        objectId: old.activeObjectId,
        payload: archived,
      });
  }
  return batch;
}
async function interaction(
  type,
  payload,
  { account = {}, id = `event-${type}`, objectId, at = serverTimestamp() } = {},
) {
  const database = db();
  const old = (await getDoc(doc(database, 'users', 'alice'))).data();
  const batch = writeBatch(database);
  const cooldown = { shake: 'lastShakeAt', comet: 'lastCometAt', shootingStar: 'lastStarAt' }[type];
  batch.update(doc(database, 'users', 'alice'), {
    action: type,
    writeId: id,
    lastWriteAt: at,
    ...(cooldown ? { [cooldown]: at } : {}),
    ...(type === 'edit' ? { editDay: utcDay(Date.now()), editsToday: old.editDay === utcDay(Date.now()) ? (old.editsToday ?? 0) + 1 : 1 } : {}),
    ...(cooldown ? { interactionDay: utcDay(Date.now()), interactionsToday: old.interactionDay === utcDay(Date.now()) ? (old.interactionsToday ?? 0) + 1 : 1 } : {}),
    ...account,
  });
  batch.set(doc(database, 'events', id), {
    schemaVersion: SCHEMA_VERSION,
    uid: 'alice',
    at,
    type,
    objectId: objectId ?? old.activeObjectId,
    payload,
  });
  return batch;
}
beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)
    throw new Error('Use test:rules; both demo emulators required');
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host,
      port: Number(port),
      rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8'),
    },
  });
  admin = adminApp({ projectId }, 'snapshot-test');
  await bypass((database) => setDoc(doc(database, 'config', 'live'), flags));
  await getDoc(doc(db('warmup'), 'config', 'live'));
});
beforeEach(async () => {
  await env.clearFirestore();
  await bypass((database) => setDoc(doc(database, 'config', 'live'), flags));
});
afterAll(async () => {
  await env?.cleanup();
  if (admin) await deleteAdminApp(admin);
});
it('launches, archives the previous object, and keeps all immutable event snapshots', async () => {
  const database = db();
  const first = await launchPlanet(database, 'alice', draft, orbit());
  await ageUser();
  const second = await launchPlanet(database, 'alice', draft, orbitFromVelocity(100, 100, 0, Date.now()));
  expect((await getDoc(doc(database, 'objects', first))).data().status).toBe('hangar');
  expect((await getDoc(doc(database, 'objects', second))).data().orbit.isComet).toBe(true);
  expect((await getDoc(doc(database, 'users', 'alice'))).data().launchesToday).toBe(2);
  await bypass(async (database) => {
    expect((await getDocs(collection(database, 'events'))).size).toBe(5);
  });
});
it.each(['object', 'user', 'launch', 'create'])(
  'rejects an incomplete first launch missing %s',
  async (part) => {
    await assertFails((await launchBatch(db(), { omit: [part] })).commit());
  },
);
it.each(['archive', 'crumble'])('rejects replacement missing %s', async (part) => {
  await launchPlanet(db(), 'alice', draft, orbit());
  await ageUser();
  await assertFails((await launchBatch(db(), { omit: [part] })).commit());
});
it.each([
  { ownerUid: 'other' },
  { type: 'star' },
  { nameKey: 'arbitrary text' },
  { extra: true },
  { schemaVersion: 2 },
  { season: 'other' },
  { status: 'hangar' },
  { createdAt: Timestamp.fromMillis(0) },
  { updatedAt: Timestamp.fromMillis(0) },
  { params: { size: 20, palette: 0, oceans: 0.5 } },
  { params: { size: 0.4, palette: 1.2, oceans: 0.5 } },
  { params: { size: 0.4, palette: 0, oceans: -0.1 } },
  { params: { size: 0.4, palette: 0, oceans: 0.5, text: 'x' } },
  { orbitPatch: { e: 1 } },
  { orbitPatch: { inclination: 1 } },
  { orbitPatch: { a: 0 } },
  { orbitPatch: { epoch: -1 } },
  { orbitPatch: { hostId: 'visitor' } },
  { orbitPatch: { isComet: 'yes' } },
])('rejects malformed object %#', async (entry) => {
  const object = entry.orbitPatch ? { orbit: { ...orbit(), ...entry.orbitPatch } } : entry;
  await assertFails((await launchBatch(db(), { object })).commit());
});
it('enforces ownership, immutable fields, no direct edits, no deletes', async () => {
  const objectId = await launchPlanet(db(), 'alice', draft, orbit());
  await ageUser();
  await assertFails(updateDoc(doc(db('bob'), 'objects', objectId), { nameKey: 'bright-tide' }));
  await assertFails(
    updateDoc(doc(db(), 'objects', objectId), { nameKey: 'bright-tide', updatedAt: serverTimestamp() }),
  );
  for (const path of [`objects/${objectId}`, 'users/alice']) await assertFails(deleteDoc(doc(db(), path)));
  await assertFails(updateDoc(doc(db('bob'), 'users', 'alice'), { launchesToday: 1 }));
});
it('enforces cooldown, exact daily increments, daily reset and the five-launch maximum', async () => {
  const database = db();
  await launchPlanet(database, 'alice', draft, orbit());
  await assertFails((await launchBatch(database)).commit());
  await ageUser();
  for (const user of [
    { launchesToday: 0 },
    { launchesToday: 1.5 },
    { launchesToday: 3 },
    { extra: true },
    { launchDay: 'tomorrow' },
    { lastWriteAt: Timestamp.fromMillis(0) },
    { lastShakeAt: Timestamp.now() },
  ]) {
    await assertFails((await launchBatch(database, { user })).commit());
  }
  for (let count = 2; count <= 5; count++) {
    await ageUser();
    await launchPlanet(database, 'alice', draft, orbit());
  }
  await ageUser();
  await assertFails((await launchBatch(database)).commit());
  await ageUser('alice', { launchDay: '2026-01-01' });
  await assertSucceeds((await launchBatch(database)).commit());
  expect((await getDoc(doc(database, 'users', 'alice'))).data().launchesToday).toBe(1);
});
it.each([
  ['shake', {}, 10],
  ['comet', { dx: 0.4, dy: -0.3 }, 10],
  ['shootingStar', { messageKey: 'together' }, 20],
])('validates %s cooldown and append-only event', async (type, payload, seconds) => {
  await launchPlanet(db(), 'alice', draft, orbit());
  await ageUser();
  await assertSucceeds((await interaction(type, payload)).commit());
  await ageUser();
  await assertFails((await interaction(type, payload, { id: 'too-soon' })).commit());
  const field = { shake: 'lastShakeAt', comet: 'lastCometAt', shootingStar: 'lastStarAt' }[type];
  await ageUser('alice', { [field]: Timestamp.fromMillis(Date.now() - (seconds + 1) * 1000) });
  await assertFails(
    (await interaction(type, { ...payload, text: 'free text' }, { id: 'bad-payload' })).commit(),
  );
  await assertSucceeds((await interaction(type, payload, { id: 'later' })).commit());
  await assertFails(updateDoc(doc(db(), 'events', `event-${type}`), { payload: {} }));
  await assertFails(deleteDoc(doc(db(), 'events', `event-${type}`)));
});
it('rejects spoofed, backdated, standalone and admin-only events', async () => {
  const id = await launchPlanet(db(), 'alice', draft, orbit());
  await ageUser();
  const event = {
    schemaVersion: 1,
    uid: 'alice',
    at: serverTimestamp(),
    type: 'shake',
    objectId: id,
    payload: {},
  };
  await assertFails(setDoc(doc(db(), 'events', 'alone'), event));
  for (const [type, payload] of [
    ['meteorShower', {}],
    ['comet', { dx: 4, dy: 0 }],
    ['shootingStar', { messageKey: 'free text' }],
  ]) {
    await assertFails((await interaction(type, payload)).commit());
  }
  await assertFails((await interaction('shake', {}, { at: Timestamp.fromMillis(0) })).commit());
  await assertFails((await interaction('shake', {}, { objectId: 'someone-else' })).commit());
});
it('allows owner edits with exact event snapshots, and relaunches from hangar', async () => {
  const database = db();
  const first = await launchPlanet(database, 'alice', draft, orbit());
  await ageUser();
  const original = (await getDoc(doc(database, 'objects', first))).data();
  const at = serverTimestamp();
  const edited = { ...original, nameKey: 'bright-tide', updatedAt: at };
  const batch = writeBatch(database);
  batch.update(doc(database, 'users', 'alice'), { action: 'edit', writeId: 'edit', lastWriteAt: at, editDay: utcDay(Date.now()), editsToday: 1 });
  batch.update(doc(database, 'objects', first), { nameKey: 'bright-tide', updatedAt: at });
  batch.set(doc(database, 'events', 'edit'), {
    schemaVersion: 1,
    uid: 'alice',
    type: 'edit',
    at,
    objectId: first,
    payload: edited,
  });
  await assertSucceeds(batch.commit());
  await ageUser();
  const second = await launchPlanet(database, 'alice', draft, orbit());
  await ageUser();
  const old = (await getDoc(doc(database, 'objects', first))).data();
  const current = (await getDoc(doc(database, 'objects', second))).data();
  const relaunch = writeBatch(database);
  relaunch.update(doc(database, 'objects', first), { status: 'active', updatedAt: at });
  relaunch.update(doc(database, 'objects', second), { status: 'hangar', updatedAt: at });
  relaunch.update(doc(database, 'users', 'alice'), {
    action: 'relaunch',
    writeId: 'return',
    activeObjectId: first,
    launchesToday: 3,
    lastWriteAt: at,
  });
  for (const [key, type, objectId, payload] of [
    ['return', 'relaunch', first, { ...old, status: 'active', updatedAt: at }],
    ['return-crumble', 'crumble', second, { ...current, status: 'hangar', updatedAt: at }],
  ]) {
    relaunch.set(doc(database, 'events', key), {
      schemaVersion: 1,
      uid: 'alice',
      type,
      at,
      objectId,
      payload,
    });
  }
  await assertSucceeds(relaunch.commit());
});
it('keeps public reads minimal and all client admin writes denied', async () => {
  const id = await launchPlanet(db(), 'alice', draft, orbit());
  await ageUser();
  await launchPlanet(db(), 'alice', draft, orbit());
  const publicDb = env.unauthenticatedContext().firestore();
  await assertFails(getDocs(query(collection(publicDb, 'objects'), where('status', '==', 'active'))));
  await assertSucceeds(getDocs(query(collection(db('screen'), 'objects'), where('status', '==', 'active'))));
  await assertSucceeds(getDocs(query(collection(db(), 'objects'), where('ownerUid', '==', 'alice'))));
  await assertFails(getDocs(collection(db('screen'), 'objects')));
  await assertSucceeds(getDoc(doc(db('bob'), 'objects', id))); // D6 signed document lookup
  await assertFails(getDocs(query(collection(db('bob'), 'objects'), where('ownerUid', '==', 'alice'))));
  await assertFails(getDocs(collection(publicDb, 'objects')));
  await assertFails(getDoc(doc(publicDb, 'objects', id)));
  await assertSucceeds(getDoc(doc(db(), 'objects', id)));
  await assertFails(getDoc(doc(publicDb, 'config', 'live')));
  await assertSucceeds(getDoc(doc(db(), 'config', 'live')));
  await bypass((database) => setDoc(doc(database, 'snapshots', 'live'), { schemaVersion: 1 }));
  await assertSucceeds(getDoc(doc(publicDb, 'snapshots', 'live')));
  for (const path of [
    'config/live',
    'config/secret',
    'snapshots/live',
    'snapshots/other',
    'assistant/inbox/messages/one',
    'assistant/outbox/messages/one',
    'unknown/one',
  ]) {
    await assertFails(setDoc(doc(db(), path), { value: true }));
    await assertFails(deleteDoc(doc(db(), path)));
  }
  for (const path of [
    'users/alice',
    'events/anything',
    'config/secret',
    'snapshots/other',
    'assistant/inbox',
  ])
    await assertFails(getDoc(doc(publicDb, path)));
  await assertFails(getDocs(collection(publicDb, 'config')));
  await assertFails(getDocs(collection(db(), 'users')));
  await assertFails(
    setDoc(doc(publicDb, 'objects', 'unauthenticated'), { ownerUid: 'anonymous', status: 'active' }),
  );
});
it('honours season and launch/interaction kill switches', async () => {
  await bypass((database) => updateDoc(doc(database, 'config', 'live'), { launches: false }));
  await assertFails((await launchBatch(db())).commit());
  await bypass((database) => updateDoc(doc(database, 'config', 'live'), { launches: true }));
  await launchPlanet(db(), 'alice', draft, orbit());
  await ageUser();
  await bypass((database) => updateDoc(doc(database, 'config', 'live'), { edits: false }));
  await assertFails(editObject(db(), 'alice', { ...draft, nameKey: 'bright-tide' }));
  await bypass((database) => updateDoc(doc(database, 'config', 'live'), { edits: true }));
  await assertSucceeds(editObject(db(), 'alice', { ...draft, nameKey: 'bright-tide' }));
  await ageUser();
  for (const [flag, type, payload] of [
    ['shake', 'shake', {}],
    ['comets', 'comet', { dx: 0, dy: 1 }],
    ['shootingStars', 'shootingStar', { messageKey: 'hello' }],
  ]) {
    await bypass((database) => updateDoc(doc(database, 'config', 'live'), { [flag]: false }));
    await assertFails((await interaction(type, payload)).commit());
  }
  await bypass((database) => updateDoc(doc(database, 'config', 'live'), { seasonOpen: false }));
  await assertFails((await launchBatch(db())).commit());
  await expect(editObject(db(), 'alice', draft)).rejects.toThrow('closed');
});
it('two real anonymous Auth clients launch; a third screen listener receives both within two seconds', async () => {
  const apps = [];
  let stop;
  try {
    const clients = [];
    for (let i = 0; i < 3; i++) {
      const app = initializeApp({ projectId, apiKey: 'demo-key', appId: `demo-${i}` }, `latency-${i}`);
      apps.push(app);
      const database = getFirestore(app);
      const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
      connectFirestoreEmulator(database, host, Number(port));
      const auth = getAuth(app);
      connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, {
        disableWarnings: true,
      });
      await signInAnonymously(auth);
      clients.push({ database, auth });
    }
    let ready;
    const initial = new Promise((resolve) => {
      ready = resolve;
    });
    let arrived;
    const both = new Promise((resolve, reject) => {
      stop = onSnapshot(
        query(collection(clients[2].database, 'objects'), where('status', '==', 'active')),
        (snapshot) => {
          ready();
          if (snapshot.size === 2) resolve(performance.now());
        },
        reject,
      );
      arrived = reject;
    });
    await initial;
    const start = performance.now();
    const timeout = setTimeout(() => arrived(new Error('Screen exceeded 2 seconds')), 2000);
    try {
      await Promise.all(
        clients
          .slice(0, 2)
          .map(({ database, auth }) => launchPlanet(database, auth.currentUser.uid, draft, orbit())),
      );
      const elapsed = (await both) - start;
      console.log(`Two anonymous launches → third screen listener: ${elapsed.toFixed(0)} ms`);
      expect(elapsed).toBeLessThanOrEqual(2000);
    } finally {
      clearTimeout(timeout);
    }
  } finally {
    stop?.();
    for (const app of apps) await deleteApp(app);
  }
});
it('admin snapshot writer publishes compact state on its interval against the demo emulator', async () => {
  const id = await launchPlanet(db(), 'alice', draft, orbit());
  let errors = 0;
  const stop = startSnapshotWriter(
    adminFirestore(admin),
    () => {
      errors++;
    },
    150,
  );
  try {
    await expect
      .poll(async () => (await adminFirestore(admin).doc('snapshots/live').get()).data()?.activeCount)
      .toBe(1);
    const first = (await adminFirestore(admin).doc('snapshots/live').get()).data();
    expect(first.objects[0].id).toBe(id);
    expect(first.objects[0].ownerUid).toBeUndefined();
    await expect
      .poll(async () => (await adminFirestore(admin).doc('snapshots/live').get()).data()?.at.toMillis())
      .toBeGreaterThan(first.at.toMillis());
    await launchPlanet(db('bob'), 'bob', draft, orbit());
    await expect
      .poll(async () => (await adminFirestore(admin).doc('snapshots/live').get()).data()?.activeCount)
      .toBe(2);
    expect(errors).toBe(0);
  } finally {
    await stop();
  }
});

// Every rich field crosses the real rules trust boundary: lower/upper endpoints,
// below/above limits, wrong types and extra keys; failed writes leave no partial batch.
for (const type of ['planet', 'star', 'moon']) {
  for (const field of Object.keys(presets[type][0])) {
    it(`validates ${type}.${field} at both bounds, wrong types and unknown keys`, async () => {
      let hostId = 'central';
      if (type === 'moon') {
        await bypass((database) =>
          setDoc(doc(database, 'objects', 'seed'), {
            schemaVersion: 1,
            ownerUid: '',
            type: 'planet',
            ...draft,
            orbit: orbit(),
            status: 'active',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            season: SEASON,
          }),
        );
        hostId = 'seed';
      }
      const hostOrbit = type === 'moon' ? (await getDoc(doc(db(), 'objects', hostId))).data().orbit : null;
      const params = presets[type][0],
        discrete = ['palette', 'atmosphere', 'colour'].includes(field),
        low = field === 'size' ? 0.2 : 0,
        high = field === 'size' ? 0.7 : discrete ? 3 : 1;
      const body = (value) => ({
        schemaVersion: 2,
        type,
        nameKey: 'n39-39',
        params: { ...params, [field]: value },
        orbit: { ...orbit(), hostId },
        ...(hostOrbit ? { hostOrbit } : {}),
      });
      for (const bad of [low - 0.01, high + 0.01, '0', null, true, ...(discrete ? [1.5] : [])])
        await assertFails((await launchBatch(db(), { object: body(bad) })).commit());
      await assertFails(
        (await launchBatch(db(), { object: { ...body(low), params: { ...params, extra: 0 } } })).commit(),
      );
      await assertSucceeds((await launchBatch(db(), { object: body(low) })).commit());
      await ageUser();
      await assertSucceeds(
        (await launchBatch(db(), { objectId: 'upper', writeId: 'upper', object: body(high) })).commit(),
      );
    });
  }
}
it('enforces D6 for own and unclaimed planets, including hangar parents; rejects foreign planets, stars and forged parent orbits', async () => {
  const database = db(),
    planet = await launchPlanet(database, 'alice', draft, orbit());
  await ageUser();
  const moonDraft = { type: 'moon', nameKey: 'n00-00', params: presets.moon[0] };
  const moon = await launchPlanet(database, 'alice', moonDraft, { ...orbit(), hostId: planet });
  await ageUser();
  expect((await getDoc(doc(database, 'objects', planet))).data().status).toBe('hangar');
  await editObject(database, 'alice', { ...moonDraft, nameKey: 'n01-01' });
  await ageUser();
  await relaunchObject(database, 'alice', planet);
  await ageUser();
  await relaunchObject(database, 'alice', moon);
  await ageUser();
  const foreign = await launchPlanet(db('bob'), 'bob', draft, orbit());
  await assertFails(launchPlanet(database, 'alice', moonDraft, { ...orbit(), hostId: foreign }));
  const star = await launchPlanet(
    db('carol'),
    'carol',
    { type: 'star', nameKey: 'n00-00', params: presets.star[0] },
    orbit(),
  );
  await assertFails(launchPlanet(database, 'alice', moonDraft, { ...orbit(), hostId: star }));
  await assertFails(
    (
      await launchBatch(db(), {
        object: {
          schemaVersion: 2,
          type: 'moon',
          params: presets.moon[0],
          orbit: { ...orbit(), hostId: planet },
          hostOrbit: { ...orbit(), a: 20 },
        },
      })
    ).commit(),
  );
});
it('visitor stars host planets, while host type, name bounds and parent-orbit fields are enforced', async () => {
  const star = await launchPlanet(
    db('bob'),
    'bob',
    { type: 'star', nameKey: 'n00-00', params: presets.star[0] },
    orbit(),
  );
  await assertSucceeds(launchPlanet(db(), 'alice', draft, { ...orbit(), hostId: star }));
  await ageUser();
  for (const nameKey of ['n40-00', 'n00-40', 'n0-0', 'n00-00 extra'])
    await assertFails((await launchBatch(db(), { object: { nameKey } })).commit());
  await assertFails(
    (
      await launchBatch(db(), {
        object: {
          schemaVersion: 2,
          type: 'star',
          params: presets.star[0],
          orbit: { ...orbit(), hostId: star },
        },
      })
    ).commit(),
  );
  await assertFails((await launchBatch(db(), { object: { hostOrbit: orbit() } })).commit());
});
it('production edit and hangar helpers complete the round trip without deletion, preserve orbits and enforce cooldown/limit', async () => {
  const database = db(),
    first = await launchPlanet(database, 'alice', draft, orbit());
  await expect(
    editObject(database, 'alice', { ...draft, type: 'planet', params: presets.planet[1] }),
  ).rejects.toThrow('cooldown');
  await ageUser();
  const original = (await getDoc(doc(database, 'objects', first))).data();
  await editObject(database, 'alice', {
    ...draft,
    type: 'planet',
    params: presets.planet[1],
    nameKey: 'n12-34',
  });
  await ageUser();
  const changed = (await getDoc(doc(database, 'objects', first))).data();
  expect(changed.orbit).toEqual(original.orbit);
  expect(changed.createdAt).toEqual(original.createdAt);
  const second = await launchPlanet(
    database,
    'alice',
    { type: 'star', nameKey: 'n39-39', params: presets.star[1] },
    orbit(),
  );
  await ageUser();
  await relaunchObject(database, 'alice', first);
  await ageUser();
  expect((await getDoc(doc(database, 'objects', first))).data()).toMatchObject({
    status: 'active',
    nameKey: 'n12-34',
    params: presets.planet[1],
  });
  expect((await getDoc(doc(database, 'objects', second))).data().status).toBe('hangar');
  await relaunchObject(database, 'alice', second);
  await ageUser();
  await relaunchObject(database, 'alice', first);
  await ageUser();
  await expect(relaunchObject(database, 'alice', second)).rejects.toThrow('limit');
  expect(await ownObjects(database, 'alice')).toHaveLength(2);
  await bypass(async (admin) => {
    const events = await getDocs(collection(admin, 'events'));
    expect(events.docs.filter((e) => e.data().type === 'relaunch')).toHaveLength(3);
  });
});
it('the live screen receives owner edits and both hangar transitions through production listeners', async () => {
  const { listenActive } = await import('../../apps/web/src/galaxy-data.ts');
  let objects = [];
  const stop = listenActive(
    db('screen'),
    (value) => {
      objects = value;
    },
    () => {
      throw new Error('Screen listener failed');
    },
  );
  try {
    const first = await launchPlanet(db(), 'alice', draft, orbit());
    await expect.poll(() => objects.map((o) => o.id)).toEqual([first]);
    await ageUser();
    await editObject(db(), 'alice', {
      ...draft,
      type: 'planet',
      params: presets.planet[1],
      nameKey: 'n05-08',
    });
    await expect.poll(() => objects[0]?.nameKey).toBe('n05-08');
    await ageUser();
    const second = await launchPlanet(
      db(),
      'alice',
      { type: 'star', nameKey: 'n39-39', params: presets.star[0] },
      orbit(),
    );
    await expect.poll(() => objects.map((o) => o.id)).toEqual([second]);
    await ageUser();
    await relaunchObject(db(), 'alice', first);
    await expect.poll(() => objects.map((o) => o.id)).toEqual([first]);
    expect(objects[0].params).toEqual(presets.planet[1]);
  } finally {
    stop();
  }
});

it.each([
  { a: 20.1 }, { a: 3.4 }, { e: 0.76 }, { a: 20, e: 0.755 },
  { inclination: 0.351 }, { omega: 3.142 }, { meanAnomaly: 3.142 },
  { epochOffset: -180000 }, { epochOffset: 180000 },
])('rejects orbit bounds outside the generated envelope: %j', async (patch) => {
  const orbitPatch = 'epochOffset' in patch ? { epoch: Date.now() + patch.epochOffset } : patch;
  await assertFails((await launchBatch(db(), { object: { orbit: { ...orbit(), ...orbitPatch } } })).commit());
});
it.each([-90000, 90000])('accepts new epochs within two minutes (%s ms)', async (offset) => {
  await assertSucceeds((await launchBatch(db(), { object: { orbit: { ...orbit(), epoch: Date.now() + offset } } })).commit());
});
async function launchTyped(database, uid, type) {
  let hostId = 'central';
  if (type === 'moon') {
    hostId = 'review-host';
    await bypass(async (d) => {
      const ref = doc(d, 'objects', hostId);
      if (!(await getDoc(ref)).exists()) await setDoc(ref, {
        schemaVersion: 1, ownerUid: '', type: 'planet', ...draft,
        orbit: { ...orbit(), epoch: Date.now() - 86400000 }, status: 'active',
        createdAt: Timestamp.now(), updatedAt: Timestamp.now(), season: SEASON,
      });
    });
  }
  return launchPlanet(database, uid, { type, nameKey: 'quiet-aurora', params: presets[type][0] }, { ...orbit(), hostId });
}
it.each(['planet', 'star', 'moon'].flatMap((type) => ['orbit', 'params', 'event', 'schemaVersion', ...(type === 'moon' ? ['hostOrbit'] : [])].map((invalid) => [type, invalid])))('rejects invalid %s edit %s with an otherwise complete batch', async (type, invalid) => {
  const database = db();
  const id = await launchTyped(database, 'alice', type); await ageUser();
  const old = (await getDoc(doc(database, 'objects', id))).data();
  const at = serverTimestamp();
  const object = { ...old, nameKey: 'bright-tide', updatedAt: at,
    ...(invalid === 'orbit' ? { orbit: { ...old.orbit, a: 7 } } : {}),
    ...(invalid === 'params' ? { params: { ...old.params, size: 5 } } : {}),
    ...(invalid === 'schemaVersion' ? { schemaVersion: 1, ...(type === 'planet' ? { params: draft.params } : {}) } : {}),
    ...(invalid === 'hostOrbit' ? { hostOrbit: { ...old.hostOrbit, a: 7 } } : {}) };
  const batch = writeBatch(database);
  batch.set(doc(database, 'objects', id), object);
  batch.update(doc(database, 'users', 'alice'), { action: 'edit', writeId: 'bad-edit', lastWriteAt: at, editDay: utcDay(Date.now()), editsToday: 1 });
  batch.set(doc(database, 'events', 'bad-edit'), { schemaVersion: 1, uid: 'alice', type: 'edit', at, objectId: id,
    payload: invalid === 'event' ? { ...object, nameKey: 'distant-garden' } : object });
  await assertFails(batch.commit());
});
it.each(['planet', 'star', 'moon'].flatMap((type) => ['counter', 'crumble', 'owner', 'params', 'nameKey'].map((invalid) => [type, invalid])))('rejects invalid %s relaunch %s with an otherwise complete batch', async (type, invalid) => {
  const database = db();
  const first = await launchTyped(database, 'alice', type); await ageUser();
  const second = await launchPlanet(database, 'alice', draft, orbit()); await ageUser();
  if (invalid === 'owner') await bypass((d) => updateDoc(doc(d, 'objects', first), { ownerUid: 'bob' }));
  const old = await bypass(async (d) => (await getDoc(doc(d, 'objects', first))).data());
  const current = (await getDoc(doc(database, 'objects', second))).data();
  const at = serverTimestamp();
  const batch = writeBatch(database);
  const active = { ...old, status: 'active', updatedAt: at,
    ...(invalid === 'params' ? { params: presets[type][1] } : {}),
    ...(invalid === 'nameKey' ? { nameKey: 'n02-02' } : {}) };
  const archived = { ...current, status: 'hangar', updatedAt: at };
  batch.set(doc(database, 'objects', first), active);
  batch.set(doc(database, 'objects', second), archived);
  batch.update(doc(database, 'users', 'alice'), { action: 'relaunch', writeId: 'bad-return', activeObjectId: first,
    launchesToday: invalid === 'counter' ? 2 : 3, lastWriteAt: at });
  batch.set(doc(database, 'events', 'bad-return'), { schemaVersion: 1, uid: 'alice', type: 'relaunch', at, objectId: first, payload: active });
  if (invalid !== 'crumble') batch.set(doc(database, 'events', 'bad-return-crumble'), { schemaVersion: 1, uid: 'alice', type: 'crumble', at, objectId: second, payload: archived });
  await assertFails(batch.commit());
});
it('rejects writing another user activeObjectId and selecting another owner active object', async () => {
  await launchPlanet(db(), 'alice', draft, orbit());
  const bob = await launchPlanet(db('bob'), 'bob', draft, orbit()); await ageUser();
  await assertFails(updateDoc(doc(db(), 'users', 'bob'), { activeObjectId: 'stolen' }));
  await assertFails((await interaction('edit', {}, { account: { activeObjectId: bob } })).commit());
});
it('allows an unchanged historical orbit to be archived, edited and relaunched', async () => {
  const database = db();
  const first = await launchPlanet(database, 'alice', draft, orbit()); await ageUser();
  await bypass((d) => updateDoc(doc(d, 'objects', first), { 'orbit.epoch': Date.now() - 86400000 }));
  const old = (await getDoc(doc(database, 'objects', first))).data();
  const at = serverTimestamp();
  const batch = writeBatch(database);
  const object = { ...old, nameKey: 'bright-tide', updatedAt: at };
  batch.set(doc(database, 'objects', first), object);
  batch.update(doc(database, 'users', 'alice'), { action: 'edit', writeId: 'historic-edit', lastWriteAt: at, editDay: utcDay(Date.now()), editsToday: 1 });
  batch.set(doc(database, 'events', 'historic-edit'), { schemaVersion: 1, uid: 'alice', type: 'edit', at, objectId: first, payload: object });
  await assertSucceeds(batch.commit()); await ageUser();
  const second = await launchPlanet(database, 'alice', draft, orbit()); await ageUser();
  const current = (await getDoc(doc(database, 'objects', second))).data();
  const relaunch = writeBatch(database);
  relaunch.update(doc(database, 'objects', first), { status: 'active', updatedAt: at });
  relaunch.update(doc(database, 'objects', second), { status: 'hangar', updatedAt: at });
  relaunch.update(doc(database, 'users', 'alice'), { action: 'relaunch', writeId: 'historic-return', activeObjectId: first, launchesToday: 3, lastWriteAt: at });
  for (const [key, type, objectId, payload] of [['historic-return', 'relaunch', first, { ...object, status: 'active', updatedAt: at }], ['historic-return-crumble', 'crumble', second, { ...current, status: 'hangar', updatedAt: at }]]) {
    relaunch.set(doc(database, 'events', key), { schemaVersion: 1, uid: 'alice', type, at, objectId, payload });
  }
  await assertSucceeds(relaunch.commit());
});

it.each(['planet', 'star', 'moon'])('applies generated orbit bounds and epoch checks to %s', async (type) => {
  await launchTyped(db(), 'alice', type); await ageUser();
  const current = (await getDoc(doc(db(), 'users', 'alice'))).data().activeObjectId;
  const original = (await getDoc(doc(db(), 'objects', current))).data();
  const base = { schemaVersion: 2, type, nameKey: original.nameKey, params: original.params,
    ...(original.hostOrbit ? { hostOrbit: original.hostOrbit } : {}) };
  for (const invalid of [{ a: 30 }, { e: 0.8 }, { meanAnomaly: 4 }, { epoch: Date.now() + 180000 }]) {
    await assertFails((await launchBatch(db(), { object: { ...base, orbit: { ...orbit(), hostId: original.orbit.hostId, ...invalid } } })).commit());
  }
  if (type === 'moon') {
    await assertFails((await launchBatch(db(), { object: { ...base, orbit: original.orbit, hostOrbit: { ...original.hostOrbit, a: 30 } } })).commit());
  }
});
it('supports largest hosted replacement/relaunch batches and preserves an old moon host epoch', async () => {
  const database = db();
  await launchTyped(database, 'alice', 'star'); await ageUser();
  const moon = await launchTyped(database, 'alice', 'moon'); await ageUser();
  const old = (await getDoc(doc(database, 'objects', moon))).data();
  const star = await launchTyped(db('bob'), 'bob', 'star');
  await launchPlanet(database, 'alice', draft, { ...orbit(), hostId: star }); await ageUser();
  await relaunchObject(database, 'alice', moon); await ageUser();
  await editObject(database, 'alice', { type: 'moon', nameKey: 'n01-01', params: presets.moon[1] });
  const changed = (await getDoc(doc(database, 'objects', moon))).data();
  expect(changed.hostOrbit).toEqual(old.hostOrbit);
  expect(changed.orbit).toEqual(old.orbit);
  expect(changed.hostOrbit.epoch).toBeLessThan(Date.now() - 120000);
});
let editSequence = 0;
async function editBatch({ user = {}, object = {} } = {}) {
  const database = db();
  const u = (await getDoc(doc(database, 'users', 'alice'))).data();
  const old = (await getDoc(doc(database, 'objects', u.activeObjectId))).data();
  const at = serverTimestamp();
  const body = { ...old, updatedAt: at, nameKey: 'n01-01', ...object };
  const writeId = `budget-edit-${++editSequence}`;
  const batch = writeBatch(database);
  batch.set(doc(database, 'objects', u.activeObjectId), body);
  batch.update(doc(database, 'users', 'alice'), { action: 'edit', writeId, lastWriteAt: at,
    editDay: utcDay(Date.now()), editsToday: u.editDay === utcDay(Date.now()) ? (u.editsToday ?? 0) + 1 : 1, ...user });
  batch.set(doc(database, 'events', writeId), { schemaVersion: 1, uid: 'alice', type: 'edit', objectId: u.activeObjectId, at, payload: body });
  return batch;
}
it('allows edit 100, denies edit 101 in rules and client, and resets at the UTC day', async () => {
  await launchPlanet(db(), 'alice', draft, orbit());
  await ageUser('alice', { editsToday: 99, editDay: utcDay(Date.now()) });
  await assertSucceeds((await editBatch()).commit());
  await ageUser();
  await assertFails((await editBatch()).commit());
  await expect(editObject(db(), 'alice', draft)).rejects.toThrow('editLimit');
  await ageUser('alice', { editDay: '2020-01-01', editsToday: 100 });
  await assertSucceeds(editObject(db(), 'alice', draft));
  expect((await getDoc(doc(db(), 'users', 'alice'))).data()).toMatchObject({ editsToday: 1, editDay: utcDay(Date.now()) });
});
it.each([
  { editsToday: 0 }, { editsToday: 100 }, { editsToday: -1 }, { editsToday: 1.5 },
  { editsToday: '1' }, { editDay: '2099-01-01' }, { editDay: '2020-01-01' },
])('denies a forged edit budget with an otherwise valid edit: %j', async (user) => {
  await launchPlanet(db(), 'alice', draft, orbit()); await ageUser();
  await assertFails((await editBatch({ user })).commit());
});
it('initializes legacy edit counters without allowing a reset by launch or relaunch', async () => {
  const id = await launchPlanet(db(), 'alice', draft, orbit()); await ageUser();
  const { deleteField } = await import('firebase/firestore');
  await bypass((d) => updateDoc(doc(d, 'users', 'alice'), { editsToday: deleteField(), editDay: deleteField() }));
  await editObject(db(), 'alice', draft); await ageUser();
  expect((await getDoc(doc(db(), 'users', 'alice'))).data().editsToday).toBe(1);
  await assertFails((await launchBatch(db(), { user: { editsToday: 0 } })).commit());
  await launchPlanet(db(), 'alice', draft, orbit()); await ageUser();
  await relaunchObject(db(), 'alice', id); await ageUser();
  expect((await getDoc(doc(db(), 'users', 'alice'))).data().editsToday).toBe(1);
});
it('rejects v1 rich keys and v1 stars with complete launch batches', async () => {
  await assertFails((await launchBatch(db(), { object: { params: presets.planet[0] } })).commit());
  await assertFails((await launchBatch(db(), { object: { type: 'star', params: presets.star[0] } })).commit());
});
it('requires an active star for a new launch but preserves a previously launched orbit', async () => {
  const star = await launchTyped(db('bob'), 'bob', 'star');
  const planet = await launchPlanet(db(), 'alice', draft, { ...orbit(), hostId: star }); await ageUser();
  await ageUser('bob'); await launchPlanet(db('bob'), 'bob', draft, orbit());
  await assertFails(launchPlanet(db('carol'), 'carol', draft, { ...orbit(), hostId: star }));
  await assertSucceeds(editObject(db(), 'alice', draft));
  expect((await getDoc(doc(db(), 'objects', planet))).data().orbit.hostId).toBe(star);
});
it('signed screen fetches a hangared moon host by id and the stand snapshot includes it', async () => {
  const { listenActive } = await import('../../apps/web/src/galaxy-data.ts');
  const planet = await launchTyped(db(), 'alice', 'planet'); await ageUser();
  const moon = await launchPlanet(db(), 'alice', { type: 'moon', nameKey: 'n00-00', params: presets.moon[0] }, { ...orbit(), hostId: planet });
  await assertSucceeds(getDoc(doc(db('screen'), 'objects', planet)));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'objects', planet)));
  await assertFails(getDocs(query(collection(db('screen'), 'objects'), where('status', '==', 'hangar'))));
  let objects = [], failed = false;
  const stop = listenActive(db('screen'), (value) => { objects = value; }, () => { failed = true; });
  const stopWriter = startSnapshotWriter(adminFirestore(admin), () => { failed = true; }, 50);
  try {
    await expect.poll(() => objects.map((o) => o.id).sort()).toEqual([planet, moon].sort());
    expect(objects.find((o) => o.id === planet).moonHost).toBe(true);
    await expect.poll(async () => (await getDoc(doc(db('screen'), 'snapshots', 'live'))).data()?.objects.length).toBe(2);
    const snapshot = (await getDoc(doc(db('screen'), 'snapshots', 'live'))).data();
    expect(snapshot.creators).toBe(1); expect(snapshot.activeCount).toBe(1);
    expect(JSON.stringify(snapshot)).not.toContain('ownerUid');
    await ageUser(); await launchTyped(db(), 'alice', 'star');
    await expect.poll(() => objects.length).toBe(1);
    expect(failed).toBe(false);
  } finally { stop(); await stopWriter(); }
});
it('rejects launching a planet while archiving its own star host in the same transaction', async () => {
  const star = await launchTyped(db(), 'alice', 'star'); await ageUser();
  await assertFails(launchPlanet(db(), 'alice', draft, { ...orbit(), hostId: star }));
});

it.each([
  ['shake', {}], ['comet', { dx: -1, dy: 1 }], ['shootingStar', { messageKey: 'thanks' }],
])('production %s transaction supports pre-launch identities and preserves the budget through launch/edit/relaunch', async (type, payload) => {
  await sendInteraction(db(), 'alice', type, payload);
  let account = (await getDoc(doc(db(), 'users', 'alice'))).data();
  expect(account.activeObjectId).toBe(''); expect(account.launchesToday).toBe(0);
  expect(await ownActive(db(), 'alice')).toBeNull();
  await expect(editObject(db(), 'alice', draft)).rejects.toThrow('closed');
  expect(account.interactionsToday).toBe(1); expect(account.interactionDay).toBe(utcDay(Date.now()));
  await expect(sendInteraction(db(), 'alice', type, payload)).rejects.toThrow('cooldown');
  await ageUser();
  const first = await launchPlanet(db(), 'alice', draft, orbit());
  await ageUser(); await editObject(db(), 'alice', { ...draft, nameKey: 'bright-tide' });
  await ageUser(); await launchPlanet(db(), 'alice', draft, orbit());
  await ageUser(); await relaunchObject(db(), 'alice', first);
  account = (await getDoc(doc(db(), 'users', 'alice'))).data();
  expect(account.interactionsToday).toBe(1); expect(account.interactionDay).toBe(utcDay(Date.now()));
  expect(account.launchesToday).toBe(3);
});
it.each(['shake','comet','shootingStar'])('enforces the global two-second cooldown on %s in rules', async (type) => {
  await launchPlanet(db(), 'alice', draft, orbit());
  const payload = type === 'comet' ? { dx: 1, dy: 0 } : type === 'shootingStar' ? { messageKey: 'hello' } : {};
  // last type clock is epoch; only lastWriteAt can deny this complete valid batch.
  await assertFails((await interaction(type, payload, { id: 'any-clock' })).commit());
  await ageUser();
  await assertSucceeds((await interaction(type, payload, { id: 'after-two-seconds' })).commit());
});
it.each(messageKeys)('allows the predefined shooting star key %s through rules', async (messageKey) => {
  await launchPlanet(db(), 'alice', draft, orbit()); await ageUser();
  await assertSucceeds((await interaction('shootingStar', { messageKey })).commit());
});
it.each([
  ['shake', { count: 5 }], ['comet', { dx: 0, dy: 0 }], ['comet', { dx: 1.01, dy: 0 }],
  ['comet', { dx: -1.01, dy: 0 }], ['comet', { dx: '1', dy: 0 }], ['comet', { dx: 1, dy: NaN }],
  ['comet', { dx: 1, dy: Infinity }], ['comet', { dx: 1 }], ['comet', { dx: 1, dy: 0, text: 'text' }],
  ['shootingStar', { messageKey: 'constructor' }], ['shootingStar', { messageKey: 'toString' }],
  ['shootingStar', { messageKey: 1 }], ['shootingStar', {}], ['shootingStar', { messageKey: 'hello', text: 'text' }],
])('denies malformed %s payload %j in complete batches', async (type, payload) => {
  await launchPlanet(db(), 'alice', draft, orbit()); await ageUser();
  await assertFails((await interaction(type, payload)).commit());
});
it('enforces interaction 10/11, day reset, migration and unforgeable counter increments', async () => {
  await launchPlanet(db(), 'alice', draft, orbit());
  await ageUser();
  await assertSucceeds((await interaction('shake', {}, { id: 'legacy-budget' })).commit());
  await ageUser('alice', { interactionDay: utcDay(Date.now()), interactionsToday: 9, lastShakeAt: Timestamp.fromMillis(0) });
  await assertSucceeds((await interaction('shake', {}, { id: 'tenth' })).commit());
  await ageUser('alice', { lastShakeAt: Timestamp.fromMillis(0) });
  await assertFails((await interaction('shake', {}, { id: 'eleventh' })).commit());
  for (const account of [{ interactionsToday: 1 }, { interactionDay: '2000-01-01', interactionsToday: 1 }, { interactionsToday: 9 }, { interactionsToday: 10.5 }, { interactionDay: '2099-01-01' }])
    await assertFails((await interaction('shake', {}, { id: 'forged', account })).commit());
  // A launch cannot erase the interaction budget.
  await assertFails((await launchBatch(db(), { writeId: 'erase-budget', objectId: 'next', user: { interactionsToday: 0 } })).commit());
  await ageUser('alice', { interactionDay: '2000-01-01', interactionsToday: 10 });
  await assertSucceeds((await interaction('shake', {}, { id: 'new-day' })).commit());
  expect((await getDoc(doc(db(), 'users', 'alice'))).data().interactionsToday).toBe(1);
});
it.each(['shake','comets','shootingStars','seasonOpen'])('denies initial interaction transactions when %s is off', async (flag) => {
  await bypass((database) => updateDoc(doc(database, 'config', 'live'), { [flag]: false }));
  const type = flag === 'comets' ? 'comet' : flag === 'shootingStars' ? 'shootingStar' : 'shake';
  const payload = type === 'comet' ? { dx: 1, dy: 0 } : type === 'shootingStar' ? { messageKey: 'hello' } : {};
  await expect(sendInteraction(db(), 'alice', type, payload)).rejects.toThrow('closed');
  expect((await getDoc(doc(db(), 'users', 'alice'))).exists()).toBe(false);
});
it('allows only bounded recent ordered event queries, denies history, get, anonymous and oversized lists', async () => {
  await launchPlanet(db(), 'alice', draft, orbit()); await ageUser();
  await interaction('shake', {}).then((b) => b.commit());
  const recent = (database, seconds = 60, count = 100) => query(collection(database, 'events'), where('at', '>', Timestamp.fromMillis(Date.now() - seconds * 1000)), orderBy('at'), limitToLast(count));
  expect((await assertSucceeds(getDocs(recent(db('screen'))))).size).toBe(3);
  await assertFails(getDocs(recent(env.unauthenticatedContext().firestore())));
  await assertFails(getDocs(recent(db(), 180)));
  await assertFails(getDocs(recent(db(), 60, 101)));
  await assertFails(getDocs(query(collection(db(), 'events'), orderBy('at'), limit(100))));
  await assertFails(getDocs(query(collection(db(), 'events'), where('at', '>', Timestamp.now()), orderBy('at'))));
  await assertFails(getDoc(doc(db(), 'events', 'event-shake')));
});
it('production recent-event subscription receives one copy across changes and stops cleanly', async () => {
  const seen = [], failures = [];
  const stop = listenRecentEvents(db('screen'), (events) => seen.push(...events), () => failures.push(true));
  try {
    await sendInteraction(db(), 'alice', 'comet', { dx: -.7, dy: .4 });
    await vi.waitFor(() => expect(seen.some((e) => e.type === 'comet')).toBe(true));
    await sendInteraction(db('bob'), 'bob', 'shootingStar', { messageKey: 'wish' });
    await vi.waitFor(() => expect(seen.filter((e) => e.type === 'shootingStar')).toHaveLength(1));
    expect(seen.filter((e) => e.type === 'comet')).toHaveLength(1);
    expect(failures).toEqual([]);
  } finally { stop(); }
});
it('admin controls update only allowed settings; scheduled meteor events respect the live switch and shutdown', async () => {
  const database = adminFirestore(admin);
  await applyControl(database, ['scene', 'bigQr']);
  expect((await database.doc('config/live').get()).data().screenScene).toBe('bigQr');
  expect(await writeMeteorShower(database)).toBe(false);
  await applyControl(database, ['flag', 'meteorShowers', 'on']);
  let fire, delay, timer, scheduled = 0;
  const stop = startMeteorScheduler(database, () => { throw new Error('Scheduler failed'); }, () => .5, {
    setTimeout: (callback, ms) => { fire = callback; delay = ms; scheduled++; timer = setTimeout(() => {}, 1_000_000); return timer; },
    clearTimeout: (handle) => clearTimeout(handle),
  });
  try {
    await vi.waitFor(() => expect(fire).toBeTypeOf('function'));
    expect(delay).toBe(630_000); fire();
    await vi.waitFor(async () => expect((await database.collection('events').where('type', '==', 'meteorShower').get()).size).toBe(1));
    await vi.waitFor(() => expect(scheduled).toBeGreaterThan(1));
    await applyControl(database, ['flag', 'meteorShowers', 'off']);
    expect(await writeMeteorShower(database)).toBe(false);
    const event = (await database.collection('events').where('type', '==', 'meteorShower').get()).docs[0].data();
    expect(event.at.toMillis()).toBeGreaterThan(Date.now() - 10_000); expect(event.payload.count).toBe(12);
    await assertFails(setDoc(doc(db(), 'config', 'live'), flags));
    await assertFails(setDoc(doc(db(), 'events', 'forged-meteor'), { ...event, uid: 'alice', at: serverTimestamp() }));
    await expect(applyControl(database, ['scene', 'assistant'])).rejects.toThrow();
    await expect(applyControl(database, ['timing', 'meteorMinSeconds', '1000'])).rejects.toThrow();
  } finally { await stop(); clearTimeout(timer); }
});

async function firstInteractionBatch(type, payload, { user = {}, event = {}, omit = [] } = {}) {
  const database = db(), at = serverTimestamp(), epoch = Timestamp.fromMillis(0), batch = writeBatch(database);
  const field = { shake: 'lastShakeAt', comet: 'lastCometAt', shootingStar: 'lastStarAt' }[type];
  const account = { schemaVersion: 1, activeObjectId: '', launchesToday: 0, launchDay: utcDay(Date.now()),
    action: type, writeId: 'first-interaction', lastWriteAt: at, lastShakeAt: epoch, lastCometAt: epoch, lastStarAt: epoch,
    [field]: at, interactionDay: utcDay(Date.now()), interactionsToday: 1, ...user };
  if (!omit.includes('user')) batch.set(doc(database, 'users', 'alice'), account);
  if (!omit.includes('event')) batch.set(doc(database, 'events', 'first-interaction'), { schemaVersion: 1, objectId: '', uid: 'alice', type, at, payload, ...event });
  return batch;
}
it.each(['shake','comets','shootingStars','seasonOpen'])('rules deny a complete pre-launch interaction batch with %s disabled', async (flag) => {
  await bypass((database) => updateDoc(doc(database, 'config', 'live'), { [flag]: false }));
  const type = flag === 'comets' ? 'comet' : flag === 'shootingStars' ? 'shootingStar' : 'shake';
  const payload = type === 'comet' ? { dx: 1, dy: 0 } : type === 'shootingStar' ? { messageKey: 'hello' } : {};
  await assertFails((await firstInteractionBatch(type, payload)).commit());
});
it.each([
  { omit: ['user'] }, { omit: ['event'] }, { user: { interactionsToday: 0 } }, { user: { interactionDay: '2000-01-01' } },
  { user: { launchesToday: 1 } }, { user: { activeObjectId: 'fake' } }, { user: { lastCometAt: Timestamp.fromMillis(100) } },
  { user: { lastShakeAt: Timestamp.fromMillis(0) } }, { event: { uid: 'bob' } }, { event: { schemaVersion: 2 } },
  { event: { objectId: 'fake' } }, { event: { text: 'free text' } }, { event: { at: Timestamp.fromMillis(0) } },
])('rejects invalid initial interaction batch %j', async (mutation) => {
  await assertFails((await firstInteractionBatch('shake', {}, mutation)).commit());
});
it('does not permit signing out to write a valid interaction batch', async () => {
  const database = env.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(database, 'users', 'alice'), { schemaVersion: 1, action: 'shake' }));
  await assertFails(setDoc(doc(database, 'events', 'anonymous'), { schemaVersion: 1, uid: 'alice', objectId: '', at: serverTimestamp(), type: 'shake', payload: {} }));
});
