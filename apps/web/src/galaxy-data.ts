import { collection, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp, Timestamp, where } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { MAX_LAUNCHES_PER_DAY, readObject, SCHEMA_VERSION, SEASON, utcDay } from '@little-galaxy/shared';
import type { GalaxyObject, GalaxyUser, NameKey, Orbit, PlanetParams, RenderObject } from '@little-galaxy/shared';
export interface Draft { nameKey: NameKey; params: PlanetParams }
export class LaunchError extends Error {
  constructor(public reason: 'limit' | 'cooldown' | 'closed') { super(reason); }
}
/** The same production batch is exercised by the rules/latency tests. No galaxy subscription on phones. */
export async function launchPlanet(database: Firestore, uid: string, draft: Draft, orbit: Orbit): Promise<string> {
  const target = doc(collection(database, 'objects'));
  const event = doc(collection(database, 'events'));
  await runTransaction(database, async (tx) => {
    const userRef = doc(database, 'users', uid);
    const userDoc = await tx.get(userRef);
    const old = userDoc.exists() ? userDoc.data() as GalaxyUser<Timestamp> : null;
    const previous = old ? await tx.get(doc(database, 'objects', old.activeObjectId)) : null;
    const flags = await tx.get(doc(database, 'config', 'live'));
    if (!flags.exists() || !flags.data().seasonOpen || !flags.data().launches) throw new LaunchError('closed');
    const now = Date.now();
    const day = utcDay(now);
    if (old && now - old.lastWriteAt.toMillis() < 2000) throw new LaunchError('cooldown');
    const count = old?.launchDay === day ? old.launchesToday + 1 : 1;
    if (count > MAX_LAUNCHES_PER_DAY) throw new LaunchError('limit');
    const at = serverTimestamp();
    const object: GalaxyObject<typeof at> = { schemaVersion: SCHEMA_VERSION, ownerUid: uid,
      type: 'planet', nameKey: draft.nameKey, params: draft.params, orbit, status: 'active',
      createdAt: at, updatedAt: at, season: SEASON };
    const user: GalaxyUser<typeof at | Timestamp> = { schemaVersion: SCHEMA_VERSION,
      activeObjectId: target.id, launchesToday: count, launchDay: day, lastWriteAt: at,
      lastShakeAt: old?.lastShakeAt ?? Timestamp.fromMillis(0), lastCometAt: old?.lastCometAt ?? Timestamp.fromMillis(0),
      lastStarAt: old?.lastStarAt ?? Timestamp.fromMillis(0), action: 'launch', writeId: event.id };
    tx.set(target, object);
    tx.set(userRef, user);
    const base = { schemaVersion: SCHEMA_VERSION, uid, at, objectId: target.id, payload: object };
    tx.set(event, { ...base, type: 'launch' });
    tx.set(doc(database, 'events', `${event.id}-create`), { ...base, type: 'create' });
    if (previous?.exists()) {
      const archived = { ...previous.data(), status: 'hangar', updatedAt: at };
      tx.update(previous.ref, { status: 'hangar', updatedAt: at });
      tx.set(doc(database, 'events', `${event.id}-crumble`), { ...base, type: 'crumble', objectId: previous.id, payload: archived });
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
export function listenActive(database: Firestore, next: (objects: RenderObject[], fromCache: boolean) => void, error: () => void) {
  return onSnapshot(query(collection(database, 'objects'), where('status', '==', 'active')), { includeMetadataChanges: true }, (snapshot) => {
    next(snapshot.docs.flatMap((document) => {
      const data = readObject(document.data());
      return data ? [{ id: document.id, nameKey: data.nameKey, params: data.params, orbit: data.orbit }] : [];
    }), snapshot.metadata.fromCache);
  }, error);
}
