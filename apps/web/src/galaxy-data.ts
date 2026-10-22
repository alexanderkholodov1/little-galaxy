import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import {
  MAX_LAUNCHES_PER_DAY,
  OBJECT_SCHEMA_VERSION,
  planetDefaults,
  readObject,
  SCHEMA_VERSION,
  SEASON,
  utcDay,
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
export interface Draft {
  type?: ObjectType;
  nameKey: NameKey;
  params: ObjectParams;
  hostId?: string;
}
export class LaunchError extends Error {
  constructor(public reason: 'limit' | 'cooldown' | 'closed') {
    super(reason);
  }
}
/** The same production batch is exercised by the rules/latency tests. No galaxy subscription on phones. */
export async function launchPlanet(
  database: Firestore,
  uid: string,
  draft: Draft,
  orbit: Orbit,
): Promise<string> {
  const target = doc(collection(database, 'objects'));
  const event = doc(collection(database, 'events'));
  await runTransaction(database, async (tx) => {
    const userRef = doc(database, 'users', uid);
    const userDoc = await tx.get(userRef);
    const old = userDoc.exists() ? (userDoc.data() as GalaxyUser<Timestamp>) : null;
    const previous = old ? await tx.get(doc(database, 'objects', old.activeObjectId)) : null;
    const host = draft.type === 'moon' ? await tx.get(doc(database, 'objects', orbit.hostId)) : null;
    const flags = await tx.get(doc(database, 'config', 'live'));
    if (!flags.exists() || !flags.data().seasonOpen || !flags.data().launches)
      throw new LaunchError('closed');
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
      lastWriteAt: at,
      lastShakeAt: old?.lastShakeAt ?? Timestamp.fromMillis(0),
      lastCometAt: old?.lastCometAt ?? Timestamp.fromMillis(0),
      lastStarAt: old?.lastStarAt ?? Timestamp.fromMillis(0),
      action: 'launch',
      writeId: event.id,
    };
    tx.set(target, object);
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
  });
  return target.id;
}
export async function ownActive(database: Firestore, uid: string): Promise<GalaxyObject | null> {
  const user = await getDoc(doc(database, 'users', uid));
  if (!user.exists()) return null;
  const active = await getDoc(doc(database, 'objects', user.data().activeObjectId as string));
  return readObject(active.data());
}
export function listenActive(
  database: Firestore,
  next: (objects: RenderObject[], fromCache: boolean) => void,
  error: () => void,
) {
  return onSnapshot(
    query(collection(database, 'objects'), where('status', '==', 'active')),
    { includeMetadataChanges: true },
    (snapshot) => {
      next(
        snapshot.docs.flatMap((document) => {
          const data = readObject(document.data());
          return data ? [renderObject(document.id, data)] : [];
        }),
        snapshot.metadata.fromCache,
      );
    },
    error,
  );
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
/** One small snapshot read on phones; no collection subscription. Host writes are checked again by rules. */
export async function availableHosts(database: Firestore): Promise<RenderObject[]> {
  const snapshot = await getDoc(doc(database, 'snapshots', 'live'));
  const objects = snapshot.data()?.objects;
  return Array.isArray(objects)
    ? objects.filter((o) => o && typeof o.id === 'string' && ['planet', 'star'].includes(o.type))
    : [];
}
export async function editObject(database: Firestore, uid: string, draft: Draft): Promise<void> {
  const event = doc(collection(database, 'events'));
  await runTransaction(database, async (tx) => {
    const userRef = doc(database, 'users', uid),
      user = await tx.get(userRef);
    if (!user.exists()) throw new LaunchError('closed');
    const u = user.data() as GalaxyUser<Timestamp>;
    const target = doc(database, 'objects', u.activeObjectId),
      current = await tx.get(target);
    if (Date.now() - u.lastWriteAt.toMillis() < 2000) throw new LaunchError('cooldown');
    if (draft.type && draft.type !== current.data()?.type) throw new Error('Immutable type');
    const at = serverTimestamp();
    const body = {
      ...current.data(),
      schemaVersion: OBJECT_SCHEMA_VERSION,
      params: draft.params,
      nameKey: draft.nameKey,
      updatedAt: at,
    };
    tx.update(userRef, { action: 'edit', writeId: event.id, lastWriteAt: at });
    tx.update(target, {
      schemaVersion: OBJECT_SCHEMA_VERSION,
      params: draft.params,
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
  });
}
export async function relaunchObject(database: Firestore, uid: string, objectId: string): Promise<void> {
  const event = doc(collection(database, 'events'));
  await runTransaction(database, async (tx) => {
    const userRef = doc(database, 'users', uid),
      user = await tx.get(userRef);
    if (!user.exists()) throw new LaunchError('closed');
    const u = user.data() as GalaxyUser<Timestamp>;
    const target = await tx.get(doc(database, 'objects', objectId));
    const previous = await tx.get(doc(database, 'objects', u.activeObjectId));
    const flags = await tx.get(doc(database, 'config', 'live'));
    if (!flags.data()?.launches || !flags.data()?.seasonOpen) throw new LaunchError('closed');
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
  });
}
