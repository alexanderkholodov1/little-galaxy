import { Buffer } from 'node:buffer';
import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { readObject, SCHEMA_VERSION } from '@little-galaxy/shared';
import type { LiveSnapshot, RenderObject } from '@little-galaxy/shared';
export function compactSnapshot(documents: { id: string; data(): unknown }[]): Omit<LiveSnapshot, 'at'> {
  const objects: RenderObject[] = documents.flatMap((document) => {
    const object = readObject(document.data());
    return object?.status === 'active' ? [{ id: document.id, nameKey: object.nameKey, params: object.params, orbit: object.orbit }] : [];
  });
  const snapshot: Omit<LiveSnapshot, 'at'> = { schemaVersion: SCHEMA_VERSION, objects, creators: objects.length, activeCount: objects.length };
  if (Buffer.byteLength(JSON.stringify(snapshot)) > 900_000) throw new Error('Snapshot needs sharding before the next write');
  return snapshot;
}
/** Publish only a healthy listener's state; reconnect with bounded exponential backoff. */
export function startSnapshotWriter(database: Firestore, onError: () => void, interval = 30_000) {
  let latest: Omit<LiveSnapshot, 'at'> | undefined;
  let pending: Promise<void> | undefined;
  let stopped = false;
  let generation = 0;
  let failures = 0;
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
        try { latest = compactSnapshot(snapshot.docs); } catch { failed(); return; }
        failures = 0;
        if (!timer) { void flush(); timer = setInterval(() => { void flush(); }, interval); }
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
