import { runObservedTransaction } from './firestore-observer';
import {
  collection,
  FieldPath,
  limit,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import {
  MAX_LAUNCHES_PER_DAY,
  MAX_EDITS_PER_DAY,
  OBJECT_SCHEMA_VERSION,
  planetDefaults,
  readObject,
  SCHEMA_VERSION,
  SEASON,
  utcDay,
  skyBucket,
} from '@little-galaxy/shared';
import type {
  GalaxyObject,
  GalaxyUser,
  NameKey,
  Orbit,
  ObjectParams,
  ObjectType,
  PlanetParams,
  RenderObject,
} from '@little-galaxy/shared';
import { waitForAnonymousUid } from './session-uid';
export interface Draft {
  type?: ObjectType;
  nameKey: NameKey;
  params: ObjectParams;
  hostId?: string;
}
export class LaunchError extends Error {
  constructor(public reason: 'limit' | 'cooldown' | 'closed' | 'editLimit') {
    super(reason);
  }
}
/** Successful commits let rules read the switch once; only a denial needs a diagnostic read. */
async function launchFailure(database: Firestore, error: unknown, flag: 'launches' | 'edits'): Promise<never> {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'permission-denied') {
    const flags = await getDoc(doc(database, 'config', 'live'));
    if (!flags.data()?.seasonOpen || (flag === 'launches' && !flags.data()?.launches)) throw new LaunchError('closed');
  }
  throw error;
}
/** Replace exactly one owner entry without reading/contending on the whole shard. */
function mirror(tx: Parameters<Parameters<typeof runObservedTransaction>[1]>[0], database: Firestore, uid: string, id: string, data: object) {
  tx.set(doc(database, 'sky', skyBucket(uid)), { entries: { [uid]: { id, data } } },
    { mergeFields: [new FieldPath('entries', uid)] });
}
/** The production transaction is also exercised by rules/latency tests. */
export async function launchPlanet(
  database: Firestore,
  uid: string,
  draft: Draft,
  orbit: Orbit,
): Promise<string> {
  const target = doc(collection(database, 'objects'));
  const event = doc(collection(database, 'events'));
  await runObservedTransaction(database, async (tx) => {
    const userRef = doc(database, 'users', uid);
    const userDoc = await tx.get(userRef);
    const old = userDoc.exists() ? (userDoc.data() as GalaxyUser<Timestamp>) : null;
    const previous = old?.activeObjectId ? await tx.get(doc(database, 'objects', old.activeObjectId)) : null;
    const host = draft.type === 'moon' ? await tx.get(doc(database, 'objects', orbit.hostId)) : null;
    const now = Date.now();
    const day = utcDay(now);
    if (old && now - old.lastWriteAt.toMillis() < 2000) throw new LaunchError('cooldown');
    const count = old?.launchDay === day ? old.launchesToday + 1 : 1;
    if (count > MAX_LAUNCHES_PER_DAY) throw new LaunchError('limit');
    const at = serverTimestamp();
    const object: GalaxyObject<typeof at> = {
      schemaVersion: OBJECT_SCHEMA_VERSION,
      ownerUid: uid,
      type: draft.type ?? 'planet',
      nameKey: draft.nameKey,
      params:
        !draft.type || draft.type === 'planet' ? planetDefaults(draft.params as PlanetParams) : draft.params,
      orbit,
      status: 'active',
      ...(host?.exists() ? { hostOrbit: host.data().orbit as Orbit } : {}),
      createdAt: at,
      updatedAt: at,
      season: SEASON,
    };
    const user: GalaxyUser<typeof at | Timestamp> = {
      schemaVersion: SCHEMA_VERSION,
      activeObjectId: target.id,
      launchesToday: count,
      launchDay: day,
      editDay: day,
      editsToday: old?.editDay === day ? (old.editsToday ?? 0) : 0,
      ...(old?.interactionDay !== undefined ? { interactionDay: old.interactionDay, interactionsToday: old.interactionsToday ?? 0 } : {}),
      lastWriteAt: at,
      lastShakeAt: old?.lastShakeAt ?? Timestamp.fromMillis(0),
      lastCometAt: old?.lastCometAt ?? Timestamp.fromMillis(0),
      lastStarAt: old?.lastStarAt ?? Timestamp.fromMillis(0),
      action: 'launch',
      writeId: event.id,
    };
    tx.set(target, object);
    mirror(tx, database, uid, target.id, object);
    tx.set(userRef, user);
    const base = { schemaVersion: SCHEMA_VERSION, uid, at, objectId: target.id, payload: object };
    tx.set(event, { ...base, type: 'launch' });
    tx.set(doc(database, 'events', `${event.id}-create`), { ...base, type: 'create' });
    if (previous?.exists()) {
      const archived = { ...previous.data(), status: 'hangar', updatedAt: at };
      tx.update(previous.ref, { status: 'hangar', updatedAt: at });
      tx.set(doc(database, 'events', `${event.id}-crumble`), {
        ...base,
        type: 'crumble',
        objectId: previous.id,
        payload: archived,
      });
    }
  }).catch((error: unknown) => launchFailure(database, error, 'launches'));
  return target.id;
}
export async function ownActive(database: Firestore, uid: string): Promise<GalaxyObject | null> {
  const user = await getDoc(doc(database, 'users', uid));
  if (!user.exists() || !user.data().activeObjectId) return null;
  const active = await getDoc(doc(database, 'objects', user.data().activeObjectId as string));
  return readObject(active.data());
}
const skyCache = new WeakMap<Firestore, { at: number; hosts: RenderObject[] }>();
export function listenActive(
  database: Firestore,
  next: (objects: RenderObject[], fromCache: boolean) => void,
  error: () => void,
  observe?: (count: number) => void,
) {
  let stopped = false;
  let generation = 0;
  const hosts = new Map<string, RenderObject>();
  let receivedServer = false;
  let epoch = 0, authenticated = false;
  let resume: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe: (() => void) | undefined;
  const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
  function connect() {
    if (stopped || hidden() || !authenticated || unsubscribe) return;
    receivedServer = false;
    const subscription = ++epoch;
    unsubscribe = onSnapshot(
      query(collection(database, 'sky'), limit(16)),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (stopped || subscription !== epoch) return;
        if (!snapshot.metadata.fromCache) {
          observe?.(receivedServer ? snapshot.docChanges().length : Math.max(1, snapshot.size));
          receivedServer = true;
        }
        const current = ++generation;
        const active = snapshot.docs.flatMap((document) => Object.values(document.data().entries ?? {}).flatMap((value) => {
          const entry = value as { id: string; data: unknown };
          const data = readObject(entry.data);
          return data ? [renderObject(entry.id, data)] : [];
        }));
        if (!snapshot.metadata.fromCache) skyCache.set(database, { at: performance.now(), hosts: active.filter((o) => o.type === 'planet' || o.type === 'star') });
        const ids = new Set(active.map((o) => o.id));
        const missing = new Set(active.filter((o) => o.type === 'moon' && !ids.has(o.orbit.hostId)).map((o) => o.orbit.hostId));
        for (const id of hosts.keys()) if (!missing.has(id)) hosts.delete(id);
        void Promise.all([...missing].map(async (id) => {
          if (hosts.has(id)) return hosts.get(id)!;
          const document = await getDoc(doc(database, 'objects', id));
          const data = readObject(document.data());
          if (!data || data.type !== 'planet') throw new Error('Moon host unavailable');
          const host = { ...renderObject(id, data), moonHost: true };
          if (!stopped && current === generation) hosts.set(id, host);
          return host;
        })).then((parents) => {
          if (!stopped && current === generation) next([...active, ...parents], snapshot.metadata.fromCache);
        }).catch(() => { if (!stopped && current === generation) error(); });
      }, () => { if (!stopped && subscription === epoch) { generation++; error(); } },
    );
  }
  function visibility() {
    clearTimeout(resume);
    if (hidden()) { epoch++; generation++; unsubscribe?.(); unsubscribe = undefined; }
    else resume = setTimeout(connect, 1000);
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility);
  void waitForAnonymousUid().then(() => { authenticated = true; connect(); }).catch(() => { if (!stopped) error(); });
  return () => { stopped = true; epoch++; generation++; hosts.clear(); clearTimeout(resume); unsubscribe?.();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility); };
}

export function renderObject(id: string, data: GalaxyObject): RenderObject {
  return {
    id,
    type: data.type,
    ...(data.type === 'planet' && data.ownerUid === '' ? { unclaimed: true } : {}),
    nameKey: data.nameKey,
    params: data.params,
    orbit: data.orbit,
    ...(data.hostOrbit ? { hostOrbit: data.hostOrbit } : {}),
    ...((data.updatedAt as Timestamp)?.toMillis
      ? { updatedAt: (data.updatedAt as Timestamp).toMillis() }
      : {}),
  };
}
export async function ownObjects(
  database: Firestore,
  uid: string,
): Promise<(GalaxyObject & { id: string })[]> {
  const result = await getDocs(query(collection(database, 'objects'), where('ownerUid', '==', uid)));
  return result.docs.flatMap((d) => {
    const object = readObject(d.data());
    return object ? [{ ...object, id: d.id }] : [];
  });
}
/** A finite shard read for workshop host choices; rules still validate the selected host. */
export async function availableHosts(database: Firestore, observe?: (count: number) => void): Promise<RenderObject[]> {
  await waitForAnonymousUid();
  const cached = skyCache.get(database);
  if (cached && performance.now() - cached.at < 300_000) return cached.hosts;
  return readHostCatalog(database, observe);
}
export async function readHostCatalog(database: Firestore, observe?: (count: number) => void): Promise<RenderObject[]> {
  const snapshot = await getDocs(query(collection(database, 'sky'), limit(16)));
  observe?.(Math.max(1, snapshot.size));
  return snapshot.docs.flatMap((shard) => Object.values(shard.data().entries ?? {}).flatMap((value) => {
    const entry = value as { id: string; data: unknown }, data = readObject(entry.data);
    return data && ['planet', 'star'].includes(data.type) ? [renderObject(entry.id, data)] : [];
  }));
}
export async function editObject(database: Firestore, uid: string, draft: Draft): Promise<void> {
  const event = doc(collection(database, 'events'));
  await runObservedTransaction(database, async (tx) => {
    const userRef = doc(database, 'users', uid),
      user = await tx.get(userRef);
    if (!user.exists()) throw new LaunchError('closed');
    const u = user.data() as GalaxyUser<Timestamp>;
    if (!u.activeObjectId) throw new LaunchError('closed');
    const target = doc(database, 'objects', u.activeObjectId),
      current = await tx.get(target);
    if (Date.now() - u.lastWriteAt.toMillis() < 2000) throw new LaunchError('cooldown');
    if (draft.type && draft.type !== current.data()?.type) throw new Error('Immutable type');
    const day = utcDay(Date.now());
    const editsToday = u.editDay === day ? (u.editsToday ?? 0) + 1 : 1;
    if (editsToday > MAX_EDITS_PER_DAY) throw new LaunchError('editLimit');
    const at = serverTimestamp();
    const body = {
      ...current.data(),
      schemaVersion: OBJECT_SCHEMA_VERSION,
      params: (!draft.type || draft.type === 'planet') ? planetDefaults(draft.params as PlanetParams) : draft.params,
      nameKey: draft.nameKey,
      updatedAt: at,
    };
    mirror(tx, database, uid, target.id, body);
    tx.update(userRef, { action: 'edit', writeId: event.id, lastWriteAt: at, editDay: day, editsToday });
    tx.update(target, {
      schemaVersion: OBJECT_SCHEMA_VERSION,
      params: (!draft.type || draft.type === 'planet') ? planetDefaults(draft.params as PlanetParams) : draft.params,
      nameKey: draft.nameKey,
      updatedAt: at,
    });
    tx.set(event, {
      schemaVersion: SCHEMA_VERSION,
      uid,
      type: 'edit',
      objectId: target.id,
      at,
      payload: body,
    });
  }).catch((error: unknown) => launchFailure(database, error, 'edits'));
}
export async function relaunchObject(database: Firestore, uid: string, objectId: string): Promise<void> {
  const event = doc(collection(database, 'events'));
  await runObservedTransaction(database, async (tx) => {
    const userRef = doc(database, 'users', uid),
      user = await tx.get(userRef);
    if (!user.exists()) throw new LaunchError('closed');
    const u = user.data() as GalaxyUser<Timestamp>;
    if (!u.activeObjectId) throw new LaunchError('closed');
    const target = await tx.get(doc(database, 'objects', objectId));
    const previous = await tx.get(doc(database, 'objects', u.activeObjectId));
    const now = Date.now(),
      day = utcDay(now),
      count = u.launchDay === day ? u.launchesToday + 1 : 1;
    if (now - u.lastWriteAt.toMillis() < 2000) throw new LaunchError('cooldown');
    if (count > MAX_LAUNCHES_PER_DAY) throw new LaunchError('limit');
    if (target.data()?.status !== 'hangar' || target.data()?.ownerUid !== uid)
      throw new Error('Invalid hangar object');
    const at = serverTimestamp(),
      active = { ...target.data(), status: 'active', updatedAt: at },
      archived = { ...previous.data(), status: 'hangar', updatedAt: at };
    tx.update(userRef, {
      action: 'relaunch',
      writeId: event.id,
      lastWriteAt: at,
      activeObjectId: objectId,
      launchDay: day,
      launchesToday: count,
    });
    mirror(tx, database, uid, objectId, active);
    tx.update(target.ref, { status: 'active', updatedAt: at });
    tx.update(previous.ref, { status: 'hangar', updatedAt: at });
    tx.set(event, { schemaVersion: SCHEMA_VERSION, uid, type: 'relaunch', objectId, at, payload: active });
    tx.set(doc(database, 'events', `${event.id}-crumble`), {
      schemaVersion: SCHEMA_VERSION,
      uid,
      type: 'crumble',
      objectId: previous.id,
      at,
      payload: archived,
    });
  }).catch((error: unknown) => launchFailure(database, error, 'launches'));
}
