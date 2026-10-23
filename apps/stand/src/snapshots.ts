import { Buffer } from 'node:buffer';
import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { readObject, SCHEMA_VERSION } from '@little-galaxy/shared';
import type { LiveSnapshot, RenderObject } from '@little-galaxy/shared';
export function compactSnapshot(documents: { id: string; data(): unknown }[]): Omit<LiveSnapshot, 'at'> {
  const parsed = documents.map((document) => ({ id: document.id, object: readObject(document.data()) }));
  const hosts = new Set(parsed.filter(({ object }) => object?.status === 'active' && object.type === 'moon').map(({ object }) => object!.orbit.hostId));
  const objects: RenderObject[] = parsed.flatMap(({ id, object }) => {
    return object && (object.status === 'active' || (object.type === 'planet' && hosts.has(id)))
      ? [
          {
            id,
            ...(object.status === 'hangar' ? { moonHost: true } : {}),
            nameKey: object.nameKey,
            type: object.type,
            ...(object.type === 'planet' && object.ownerUid === '' ? { unclaimed: true } : {}),
            params: object.params,
            orbit: object.orbit,
            ...(object.hostOrbit ? { hostOrbit: object.hostOrbit } : {}),
          },
        ]
      : [];
  });
  const snapshot: Omit<LiveSnapshot, 'at'> = {
    schemaVersion: SCHEMA_VERSION,
    objects,
    creators: objects.filter((object) => !object.unclaimed && !object.moonHost).length,
    activeCount: objects.filter((o) => !o.moonHost).length,
  };
  if (Buffer.byteLength(JSON.stringify(snapshot)) > 900_000)
    throw new Error('Snapshot needs sharding before the next write');
  return snapshot;
}
/** Publish only a healthy listener's state; reconnect with bounded exponential backoff. */
export function startSnapshotWriter(database: Firestore, onError: () => void, interval = 30_000, observe?: (count: number) => void) {
  let latest: Omit<LiveSnapshot, 'at'> | undefined;
  let pending: Promise<void> | undefined;
  let stopped = false;
  let generation = 0;
  let failures = 0;
  let revision = 0;
  const hosts = new Map<string, { id: string; data(): unknown }>();
  let timer: ReturnType<typeof setInterval> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe: (() => void) | undefined;
  async function flush() {
    if (stopped || !latest || pending) return;
    const state = latest;
    pending = database.doc('snapshots/live').set({ ...state, at: FieldValue.serverTimestamp() }).then(() => undefined).catch(onError);
    await pending;
    pending = undefined;
  }
  function connect() {
    if (stopped) return;
    const current = ++generation;
    const failed = () => {
      if (stopped || current !== generation) return;
      generation++; latest = undefined;
      if (timer) clearInterval(timer);
      timer = undefined;
      unsubscribe?.(); unsubscribe = undefined;
      onError();
      retry = setTimeout(connect, Math.min(30_000, 1000 * 2 ** Math.min(failures++, 5)));
    };
    try {
      unsubscribe = database.collection('objects').where('status', '==', 'active').onSnapshot((snapshot) => {
        if (stopped || current !== generation) return;
        observe?.(snapshot.docChanges().length || (snapshot.empty ? 1 : 0));
        const update = ++revision;
        const ids = new Set(snapshot.docs.map((d) => d.id));
        const missing = new Set(snapshot.docs.flatMap((d) => {
          const o = readObject(d.data());
          return o?.type === 'moon' && !ids.has(o.orbit.hostId) ? [o.orbit.hostId] : [];
        }));
        for (const id of hosts.keys()) if (!missing.has(id)) hosts.delete(id);
        void Promise.all([...missing].map(async (id) => {
          if (!hosts.has(id)) observe?.(1);
          const document = hosts.get(id) ?? await database.doc(`objects/${id}`).get();
          if (readObject(document.data())?.type !== 'planet') throw new Error('Moon host unavailable');
          if (!stopped && current === generation && update === revision) hosts.set(id, document);
          return document;
        })).then((parents) => {
          if (stopped || current !== generation || update !== revision) return;
          latest = compactSnapshot([...snapshot.docs, ...parents]);
          failures = 0;
          if (!timer) { void flush(); timer = setInterval(() => { void flush(); }, interval); }
        }).catch(() => { if (update === revision) failed(); });
      }, failed);
    } catch { failed(); }
  }
  connect();
  return async () => {
    stopped = true; generation++; latest = undefined;
    if (timer) clearInterval(timer);
    if (retry) clearTimeout(retry);
    unsubscribe?.();
    await pending;
  };
}
