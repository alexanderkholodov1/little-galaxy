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
/** Keeps one active-object listener; avoids rereading the galaxy every thirty seconds. */
export function startSnapshotWriter(database: Firestore, onError: () => void, interval = 30_000) {
  let latest: Omit<LiveSnapshot, 'at'> | undefined;
  let pending: Promise<void> | undefined;
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  async function flush() {
    if (stopped || !latest || pending) return;
    const state = latest;
    pending = database.doc('snapshots/live').set({ ...state, at: FieldValue.serverTimestamp() }).then(() => undefined).catch(onError);
    await pending;
    pending = undefined;
  }
  const unsubscribe = database.collection('objects').where('status', '==', 'active').onSnapshot((snapshot) => {
    try { latest = compactSnapshot(snapshot.docs); } catch { onError(); return; }
    if (!timer && !stopped) { void flush(); timer = setInterval(() => { void flush(); }, interval); }
  }, onError);
  return async () => {
    stopped = true;
    if (timer) clearInterval(timer);
    unsubscribe();
    await pending;
  };
}
