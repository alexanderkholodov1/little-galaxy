import type { ObjectSource } from './object-feed.js';
import { checkFence } from './lease.js';
import type { StandFence } from './lease.js';
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
export async function writeSnapshot(database: Firestore, state: Omit<LiveSnapshot, 'at'>, fence?: StandFence, observe?: (count: number) => void) {
  const ref = database.doc('snapshots/live');
  const unchanged = (old: Record<string, unknown> | undefined) => old?.schemaVersion === state.schemaVersion
    && old.creators === state.creators && old.activeCount === state.activeCount
    && JSON.stringify(old.objects) === JSON.stringify(state.objects);
  if (!fence) {
    observe?.(1);
    if (unchanged((await ref.get()).data())) return false;
    await ref.set({ ...state, at: FieldValue.serverTimestamp() }); return true;
  }
  return database.runTransaction(async (tx) => {
    observe?.(1); await checkFence(database, tx, fence);
    observe?.(1); const previous = await tx.get(ref);
    if (unchanged(previous.data())) return false;
    tx.set(ref, { ...state, at: FieldValue.serverTimestamp() }); return true;
  });
}
/** Publish only a healthy listener's state; reconnect with bounded exponential backoff. */
export const SNAPSHOT_DEBOUNCE_MS = 120_000;
export function startSnapshotWriter(database: Firestore, onError: () => void, interval = SNAPSHOT_DEBOUNCE_MS, observe?: (count: number) => void, onWrite?: (count: number) => void, fence?: StandFence, source?: (next: (docs: ObjectSource[]) => void) => (() => void)) {
  let latest: Omit<LiveSnapshot, 'at'> | undefined;
  let published: string | undefined;
  let initialized = false;
  let pending: Promise<void> | undefined;
  let stopped = false;
  let generation = 0;
  let failures = 0;
  let revision = 0;
  const hosts = new Map<string, { id: string; data(): unknown }>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe: (() => void) | undefined;
  async function flush() {
    if (stopped || !latest || pending) return;
    const state = latest;
    const content = JSON.stringify(state);
    if (content === published) return;
    pending = writeSnapshot(database, state, fence, observe).then((wrote) => { published = content; if (wrote) onWrite?.(1); }).catch(onError);
    await pending;
    pending = undefined;
    if (!stopped && latest && JSON.stringify(latest) !== published && !timer) {
      timer = setTimeout(() => { timer = undefined; void flush(); }, interval);
    }
  }
  function connect() {
    if (stopped) return;
    const current = ++generation;
    const failed = () => {
      if (stopped || current !== generation) return;
      generation++; latest = undefined;
      if (timer) clearTimeout(timer);
      timer = undefined;
      unsubscribe?.(); unsubscribe = undefined;
      onError();
      retry = setTimeout(connect, Math.min(30_000, 1000 * 2 ** Math.min(failures++, 5)));
    };
    try {
      const next = (snapshot: { docs: ObjectSource[]; docChanges(): unknown[]; empty: boolean }) => {
        if (stopped || current !== generation) return;
        if (!source) observe?.(snapshot.docChanges().length || (snapshot.empty ? 1 : 0));
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
          latest = compactSnapshot([...snapshot.docs, ...parents].sort((a, b) => a.id.localeCompare(b.id)));
          failures = 0;
          if (!initialized) { initialized = true; void flush(); }
          else if (!timer) timer = setTimeout(() => { timer = undefined; void flush(); }, interval);
        }).catch(() => { if (update === revision) failed(); });
      };
      unsubscribe = source
        ? source((docs) => next({ docs, empty: docs.length === 0, docChanges: () => [] }))
        : database.collection('objects').where('status', '==', 'active').onSnapshot(next, failed);
    } catch { failed(); }
  }
  connect();
  return async () => {
    stopped = true; generation++; latest = undefined;
    if (timer) clearTimeout(timer);
    if (retry) clearTimeout(retry);
    unsubscribe?.();
    await pending;
  };
}
