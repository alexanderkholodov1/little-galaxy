import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { collection, connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocs, getFirestore, onSnapshot, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { launchPlanet } from '../../apps/web/src/galaxy-data.ts';
import { orbitFromVelocity, SCHEMA_VERSION, SEASON, utcDay } from '../../packages/shared/src/index.ts';
import { initializeApp as adminApp, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getFirestore as adminFirestore } from 'firebase-admin/firestore';
import { startSnapshotWriter } from '../../apps/stand/src/snapshots.ts';
let env;
let admin;
const projectId = 'demo-little-galaxy';
const draft = { nameKey: 'quiet-aurora', params: { size: 0.4, palette: 0, oceans: 0.5 } };
const orbit = () => orbitFromVelocity(0, Math.sqrt(40 / 6), 0, Date.now());
const flags = { schemaVersion: SCHEMA_VERSION, appVersion: '0.2.0', seasonOpen: true, launches: true, comets: true, shake: true, shootingStars: true, assistantPublic: false, screenScene: 'galaxy' };
const db = (uid = 'alice') => env.authenticatedContext(uid).firestore();
async function bypass(callback) { return env.withSecurityRulesDisabled((ctx) => callback(ctx.firestore())); }
async function ageUser(uid = 'alice', overrides = {}) {
  await bypass((database) => updateDoc(doc(database, 'users', uid), { lastWriteAt: Timestamp.fromMillis(Date.now() - 3000), ...overrides }));
}
/** Schema fixtures come from the shared domain contract; mutations below probe the rules boundary. */
async function launchBatch(database, { uid = 'alice', objectId = 'planet', writeId = 'launch', object = {}, user = {}, omit = [] } = {}) {
  const old = (await getDoc(doc(database, 'users', uid))).data();
  const previous = old ? (await getDoc(doc(database, 'objects', old.activeObjectId))).data() : null;
  const at = serverTimestamp();
  /** @type {import('../../packages/shared/src/index.ts').GalaxyObject} */
  const body = { schemaVersion: SCHEMA_VERSION, ownerUid: uid, type: 'planet', ...draft, orbit: orbit(), status: 'active', createdAt: at, updatedAt: at, season: SEASON, ...object };
  const day = utcDay(Date.now());
  const account = { schemaVersion: SCHEMA_VERSION, activeObjectId: objectId, launchDay: day,
    launchesToday: old?.launchDay === day ? old.launchesToday + 1 : 1, lastWriteAt: at,
    lastShakeAt: old?.lastShakeAt ?? Timestamp.fromMillis(0), lastCometAt: old?.lastCometAt ?? Timestamp.fromMillis(0),
    lastStarAt: old?.lastStarAt ?? Timestamp.fromMillis(0), writeId, action: 'launch', ...user };
  const batch = writeBatch(database);
  if (!omit.includes('object')) batch.set(doc(database, 'objects', objectId), body);
  if (!omit.includes('user')) batch.set(doc(database, 'users', uid), account);
  const base = { schemaVersion: SCHEMA_VERSION, uid, at, objectId, payload: body };
  if (!omit.includes('launch')) batch.set(doc(database, 'events', writeId), { ...base, type: 'launch' });
  if (!omit.includes('create')) batch.set(doc(database, 'events', `${writeId}-create`), { ...base, type: 'create' });
  if (previous) {
    const archived = { ...previous, status: 'hangar', updatedAt: at };
    if (!omit.includes('archive')) batch.update(doc(database, 'objects', old.activeObjectId), { status: 'hangar', updatedAt: at });
    if (!omit.includes('crumble')) batch.set(doc(database, 'events', `${writeId}-crumble`), { ...base, type: 'crumble', objectId: old.activeObjectId, payload: archived });
  }
  return batch;
}
async function interaction(type, payload, { account = {}, id = `event-${type}`, objectId, at = serverTimestamp() } = {}) {
  const database = db();
  const old = (await getDoc(doc(database, 'users', 'alice'))).data();
  const batch = writeBatch(database);
  const cooldown = { shake: 'lastShakeAt', comet: 'lastCometAt', shootingStar: 'lastStarAt' }[type];
  batch.update(doc(database, 'users', 'alice'), { action: type, writeId: id, lastWriteAt: at, ...(cooldown ? { [cooldown]: at } : {}), ...account });
  batch.set(doc(database, 'events', id), { schemaVersion: SCHEMA_VERSION, uid: 'alice', at, type, objectId: objectId ?? old.activeObjectId, payload });
  return batch;
}
beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Use test:rules; both demo emulators required');
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  env = await initializeTestEnvironment({ projectId, firestore: { host, port: Number(port), rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') } });
  admin = adminApp({ projectId }, 'snapshot-test');
});
beforeEach(async () => {
  await env.clearFirestore();
  await bypass((database) => setDoc(doc(database, 'config', 'live'), flags));
});
afterAll(async () => { await env?.cleanup(); if (admin) await deleteAdminApp(admin); });
it('launches, archives the previous object, and keeps all immutable event snapshots', async () => {
  const database = db();
  const first = await launchPlanet(database, 'alice', draft, orbit());
  await ageUser();
  const second = await launchPlanet(database, 'alice', draft, orbitFromVelocity(100, 100, 0, Date.now()));
  expect((await getDoc(doc(database, 'objects', first))).data().status).toBe('hangar');
  expect((await getDoc(doc(database, 'objects', second))).data().orbit.isComet).toBe(true);
  expect((await getDoc(doc(database, 'users', 'alice'))).data().launchesToday).toBe(2);
  await bypass(async (database) => { expect((await getDocs(collection(database, 'events'))).size).toBe(5); });
});
it.each(['object','user','launch','create'])('rejects an incomplete first launch missing %s', async (part) => {
  await assertFails((await launchBatch(db(), { omit: [part] })).commit());
});
it.each(['archive','crumble'])('rejects replacement missing %s', async (part) => {
  await launchPlanet(db(), 'alice', draft, orbit()); await ageUser();
  await assertFails((await launchBatch(db(), { omit: [part] })).commit());
});
it.each([
  { ownerUid: 'other' }, { type: 'star' }, { nameKey: 'arbitrary text' }, { extra: true },
  { schemaVersion: 2 }, { season: 'other' }, { status: 'hangar' }, { createdAt: Timestamp.fromMillis(0) }, { updatedAt: Timestamp.fromMillis(0) },
  { params: { size: 20, palette: 0, oceans: 0.5 } }, { params: { size: 0.4, palette: 1.2, oceans: 0.5 } },
  { params: { size: 0.4, palette: 0, oceans: -0.1 } }, { params: { size: 0.4, palette: 0, oceans: 0.5, text: 'x' } },
  { orbit: { ...orbit(), e: 1 } }, { orbit: { ...orbit(), inclination: 1 } }, { orbit: { ...orbit(), a: 0 } },
  { orbit: { ...orbit(), epoch: -1 } }, { orbit: { ...orbit(), hostId: 'visitor' } }, { orbit: { ...orbit(), isComet: 'yes' } },
])('rejects malformed object %#', async (object) => { await assertFails((await launchBatch(db(), { object })).commit()); });
it('enforces ownership, immutable fields, no direct edits, no deletes', async () => {
  const objectId = await launchPlanet(db(), 'alice', draft, orbit());
  await ageUser();
  await assertFails(updateDoc(doc(db('bob'), 'objects', objectId), { nameKey: 'bright-tide' }));
  await assertFails(updateDoc(doc(db(), 'objects', objectId), { nameKey: 'bright-tide', updatedAt: serverTimestamp() }));
  for (const path of [`objects/${objectId}`, 'users/alice']) await assertFails(deleteDoc(doc(db(), path)));
  await assertFails(updateDoc(doc(db('bob'), 'users', 'alice'), { launchesToday: 1 }));
});
it('enforces cooldown, exact daily increments, daily reset and the five-launch maximum', async () => {
  const database = db(); await launchPlanet(database, 'alice', draft, orbit());
  await assertFails((await launchBatch(database)).commit());
  await ageUser();
  for (const user of [{ launchesToday: 0 }, { launchesToday: 1.5 }, { launchesToday: 3 }, { extra: true }, { launchDay: 'tomorrow' }, { lastWriteAt: Timestamp.fromMillis(0) }, { lastShakeAt: Timestamp.now() }]) {
    await assertFails((await launchBatch(database, { user })).commit());
  }
  for (let count = 2; count <= 5; count++) { await ageUser(); await launchPlanet(database, 'alice', draft, orbit()); }
  await ageUser(); await assertFails((await launchBatch(database)).commit());
  await ageUser('alice', { launchDay: '2026-01-01' });
  await assertSucceeds((await launchBatch(database)).commit());
  expect((await getDoc(doc(database, 'users', 'alice'))).data().launchesToday).toBe(1);
});
it.each([['shake', {}, 10], ['comet', { dx: 0.4, dy: -0.3 }, 10], ['shootingStar', { messageKey: 'together' }, 20]])('validates %s cooldown and append-only event', async (type, payload, seconds) => {
  await launchPlanet(db(), 'alice', draft, orbit()); await ageUser();
  await assertSucceeds((await interaction(type, payload)).commit()); await ageUser();
  await assertFails((await interaction(type, payload, { id: 'too-soon' })).commit());
  const field = { shake: 'lastShakeAt', comet: 'lastCometAt', shootingStar: 'lastStarAt' }[type];
  await ageUser('alice', { [field]: Timestamp.fromMillis(Date.now() - (seconds + 1) * 1000) });
  await assertFails((await interaction(type, { ...payload, text: 'free text' }, { id: 'bad-payload' })).commit());
  await assertSucceeds((await interaction(type, payload, { id: 'later' })).commit());
  await assertFails(updateDoc(doc(db(), 'events', `event-${type}`), { payload: {} }));
  await assertFails(deleteDoc(doc(db(), 'events', `event-${type}`)));
});
it('rejects spoofed, backdated, standalone and admin-only events', async () => {
  const id = await launchPlanet(db(), 'alice', draft, orbit()); await ageUser();
  const event = { schemaVersion: 1, uid: 'alice', at: serverTimestamp(), type: 'shake', objectId: id, payload: {} };
  await assertFails(setDoc(doc(db(), 'events', 'alone'), event));
  for (const [type, payload] of [['meteorShower', {}], ['comet', { dx: 4, dy: 0 }], ['shootingStar', { messageKey: 'free text' }]]) {
    await assertFails((await interaction(type, payload)).commit());
  }
  await assertFails((await interaction('shake', {}, { at: Timestamp.fromMillis(0) })).commit());
  await assertFails((await interaction('shake', {}, { objectId: 'someone-else' })).commit());
});
it('allows owner edits with exact event snapshots, and relaunches from hangar', async () => {
  const database = db();
  const first = await launchPlanet(database, 'alice', draft, orbit()); await ageUser();
  const original = (await getDoc(doc(database, 'objects', first))).data();
  const at = serverTimestamp();
  const edited = { ...original, nameKey: 'bright-tide', updatedAt: at };
  const batch = writeBatch(database);
  batch.update(doc(database, 'users', 'alice'), { action: 'edit', writeId: 'edit', lastWriteAt: at });
  batch.update(doc(database, 'objects', first), { nameKey: 'bright-tide', updatedAt: at });
  batch.set(doc(database, 'events', 'edit'), { schemaVersion: 1, uid: 'alice', type: 'edit', at, objectId: first, payload: edited });
  await assertSucceeds(batch.commit());
  await ageUser();
  const second = await launchPlanet(database, 'alice', draft, orbit()); await ageUser();
  const old = (await getDoc(doc(database, 'objects', first))).data();
  const current = (await getDoc(doc(database, 'objects', second))).data();
  const relaunch = writeBatch(database);
  relaunch.update(doc(database, 'objects', first), { status: 'active', updatedAt: at });
  relaunch.update(doc(database, 'objects', second), { status: 'hangar', updatedAt: at });
  relaunch.update(doc(database, 'users', 'alice'), { action: 'relaunch', writeId: 'return', activeObjectId: first, launchesToday: 3, lastWriteAt: at });
  for (const [key, type, objectId, payload] of [['return', 'relaunch', first, { ...old, status: 'active', updatedAt: at }], ['return-crumble', 'crumble', second, { ...current, status: 'hangar', updatedAt: at }]]) {
    relaunch.set(doc(database, 'events', key), { schemaVersion: 1, uid: 'alice', type, at, objectId, payload });
  }
  await assertSucceeds(relaunch.commit());
});
it('keeps public reads minimal and all client admin writes denied', async () => {
  const id = await launchPlanet(db(), 'alice', draft, orbit());
  await ageUser(); await launchPlanet(db(), 'alice', draft, orbit());
  const publicDb = env.unauthenticatedContext().firestore();
  await assertFails(getDocs(query(collection(publicDb, 'objects'), where('status', '==', 'active'))));
  await assertSucceeds(getDocs(query(collection(db('screen'), 'objects'), where('status', '==', 'active'))));
  await assertSucceeds(getDocs(query(collection(db(), 'objects'), where('ownerUid', '==', 'alice'))));
  await assertFails(getDocs(collection(db('screen'), 'objects')));
  await assertFails(getDoc(doc(db('bob'), 'objects', id)));
  await assertFails(getDocs(query(collection(db('bob'), 'objects'), where('ownerUid', '==', 'alice'))));
  await assertFails(getDocs(collection(publicDb, 'objects')));
  await assertFails(getDoc(doc(publicDb, 'objects', id)));
  await assertSucceeds(getDoc(doc(db(), 'objects', id)));
  await assertFails(getDoc(doc(publicDb, 'config', 'live')));
  await assertSucceeds(getDoc(doc(db(), 'config', 'live')));
  await bypass((database) => setDoc(doc(database, 'snapshots', 'live'), { schemaVersion: 1 }));
  await assertSucceeds(getDoc(doc(publicDb, 'snapshots', 'live')));
  for (const path of ['config/live', 'config/secret', 'snapshots/live', 'snapshots/other', 'assistant/inbox/messages/one', 'assistant/outbox/messages/one', 'unknown/one']) {
    await assertFails(setDoc(doc(db(), path), { value: true }));
    await assertFails(deleteDoc(doc(db(), path)));
  }
  for (const path of ['users/alice', 'events/anything', 'config/secret', 'snapshots/other', 'assistant/inbox']) await assertFails(getDoc(doc(publicDb, path)));
  await assertFails(getDocs(collection(publicDb, 'config')));
  await assertFails(getDocs(collection(db(), 'users')));
  await assertFails(setDoc(doc(publicDb, 'objects', 'unauthenticated'), { ownerUid: 'anonymous', status: 'active' }));
});
it('honours season and launch/interaction kill switches', async () => {
  await bypass((database) => updateDoc(doc(database, 'config', 'live'), { launches: false }));
  await assertFails((await launchBatch(db())).commit());
  await bypass((database) => updateDoc(doc(database, 'config', 'live'), { launches: true }));
  await launchPlanet(db(), 'alice', draft, orbit()); await ageUser();
  for (const [flag, type, payload] of [['shake', 'shake', {}], ['comets', 'comet', { dx: 0, dy: 1 }], ['shootingStars', 'shootingStar', { messageKey: 'hello' }]]) {
    await bypass((database) => updateDoc(doc(database, 'config', 'live'), { [flag]: false }));
    await assertFails((await interaction(type, payload)).commit());
  }
  await bypass((database) => updateDoc(doc(database, 'config', 'live'), { seasonOpen: false }));
  await assertFails((await launchBatch(db())).commit());
});
it('two real anonymous Auth clients launch; a third screen listener receives both within two seconds', async () => {
  const apps = [];
  let stop;
  try {
    const clients = [];
    for (let i = 0; i < 3; i++) {
      const app = initializeApp({ projectId, apiKey: 'demo-key', appId: `demo-${i}` }, `latency-${i}`); apps.push(app);
      const database = getFirestore(app);
      const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
      connectFirestoreEmulator(database, host, Number(port));
      const auth = getAuth(app); connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
      await signInAnonymously(auth);
      clients.push({ database, auth });
    }
    let ready;
    const initial = new Promise((resolve) => { ready = resolve; });
    let arrived;
    const both = new Promise((resolve, reject) => {
      stop = onSnapshot(query(collection(clients[2].database, 'objects'), where('status', '==', 'active')), (snapshot) => {
        ready(); if (snapshot.size === 2) resolve(performance.now());
      }, reject);
      arrived = reject;
    });
    await initial;
    const start = performance.now();
    const timeout = setTimeout(() => arrived(new Error('Screen exceeded 2 seconds')), 2000);
    try {
      await Promise.all(clients.slice(0, 2).map(({ database, auth }) => launchPlanet(database, auth.currentUser.uid, draft, orbit())));
      const elapsed = await both - start;
      console.log(`Two anonymous launches → third screen listener: ${elapsed.toFixed(0)} ms`);
      expect(elapsed).toBeLessThanOrEqual(2000);
    } finally { clearTimeout(timeout); }
  } finally { stop?.(); for (const app of apps) await deleteApp(app); }
});
it('admin snapshot writer publishes compact state on its interval against the demo emulator', async () => {
  const id = await launchPlanet(db(), 'alice', draft, orbit());
  let errors = 0;
  const stop = startSnapshotWriter(adminFirestore(admin), () => { errors++; }, 150);
  try {
    await expect.poll(async () => (await adminFirestore(admin).doc('snapshots/live').get()).data()?.activeCount).toBe(1);
    const first = (await adminFirestore(admin).doc('snapshots/live').get()).data();
    expect(first.objects[0].id).toBe(id);
    expect(first.objects[0].ownerUid).toBeUndefined();
    await expect.poll(async () => (await adminFirestore(admin).doc('snapshots/live').get()).data()?.at.toMillis()).toBeGreaterThan(first.at.toMillis());
    await launchPlanet(db('bob'), 'bob', draft, orbit());
    await expect.poll(async () => (await adminFirestore(admin).doc('snapshots/live').get()).data()?.activeCount).toBe(2);
    expect(errors).toBe(0);
  } finally { await stop(); }
});

it.each([
  { a: 20.1 }, { a: 3.4 }, { e: 0.76 }, { a: 20, e: 0.755 },
  { inclination: 0.351 }, { omega: 3.142 }, { meanAnomaly: 3.142 },
  { epoch: Date.now() - 180000 }, { epoch: Date.now() + 180000 },
])('rejects orbit bounds outside the generated envelope: %j', async (patch) => {
  await assertFails((await launchBatch(db(), { object: { orbit: { ...orbit(), ...patch } } })).commit());
});
it.each([-90000, 90000])('accepts new epochs within two minutes (%s ms)', async (offset) => {
  await assertSucceeds((await launchBatch(db(), { object: { orbit: { ...orbit(), epoch: Date.now() + offset } } })).commit());
});
it.each(['orbit', 'params', 'event'])('rejects invalid edit %s with an otherwise complete batch', async (invalid) => {
  const database = db();
  const id = await launchPlanet(database, 'alice', draft, orbit()); await ageUser();
  const old = (await getDoc(doc(database, 'objects', id))).data();
  const at = serverTimestamp();
  const object = { ...old, nameKey: 'bright-tide', updatedAt: at,
    ...(invalid === 'orbit' ? { orbit: { ...old.orbit, a: 7 } } : {}),
    ...(invalid === 'params' ? { params: { ...old.params, size: 5 } } : {}) };
  const batch = writeBatch(database);
  batch.set(doc(database, 'objects', id), object);
  batch.update(doc(database, 'users', 'alice'), { action: 'edit', writeId: 'bad-edit', lastWriteAt: at });
  batch.set(doc(database, 'events', 'bad-edit'), { schemaVersion: 1, uid: 'alice', type: 'edit', at, objectId: id,
    payload: invalid === 'event' ? { ...object, nameKey: 'distant-garden' } : object });
  await assertFails(batch.commit());
});
it.each(['counter', 'crumble', 'owner'])('rejects invalid relaunch %s with an otherwise complete batch', async (invalid) => {
  const database = db();
  const first = await launchPlanet(database, 'alice', draft, orbit()); await ageUser();
  const second = await launchPlanet(database, 'alice', draft, orbit()); await ageUser();
  if (invalid === 'owner') await bypass((d) => updateDoc(doc(d, 'objects', first), { ownerUid: 'bob' }));
  const old = await bypass(async (d) => (await getDoc(doc(d, 'objects', first))).data());
  const current = (await getDoc(doc(database, 'objects', second))).data();
  const at = serverTimestamp();
  const batch = writeBatch(database);
  const active = { ...old, status: 'active', updatedAt: at };
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
  batch.update(doc(database, 'users', 'alice'), { action: 'edit', writeId: 'historic-edit', lastWriteAt: at });
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
