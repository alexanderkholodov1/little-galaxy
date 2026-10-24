import { checkFence } from './lease.js';
import type { StandFence } from './lease.js';
import { createHash } from 'node:crypto';
import { CHUNK_BYTES, compareIds, objectBucket, readLog, readManifest, readMemoryObject, readObject, readObjects, SEASON } from '@little-galaxy/shared';
import type { LogChunk, MemoryEvent, MemoryObject, ObjectChunk, SeasonData } from '@little-galaxy/shared';
import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
type Source = { id: string; data(): unknown };
function millis(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'toMillis' in value) return (value as { toMillis(): number }).toMillis();
  throw new Error('Missing server timestamp');
}
export function publicObject(id: string, value: unknown): MemoryObject {
  const o = readObject(value);
  if (!o) throw new Error('Invalid source object');
  const { ownerUid, ...body } = o;
  const result = readMemoryObject({ ...body, schemaVersion: 2, id, createdAt: millis(o.createdAt), updatedAt: millis(o.updatedAt), ...(ownerUid === '' ? { unclaimed: true } : {}) });
  if (!result) throw new Error('Invalid public object');
  return result;
}
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
/** Stable content-addressed log chunks let a reader finish a coherent revision during live writes. */
export function buildSeason(objects: Source[], events: Source[]): SeasonData {
  const files: SeasonData['files'] = {};
  let all = objects.map((d) => publicObject(d.id, d.data())).sort((a, b) => compareIds(a.id, b.id));
  const referenced = new Set<string>();
  const rows = events.map((d) => {
    const e = d.data() as { schemaVersion: number; at: unknown; type: string; objectId: string; payload: Record<string, unknown> };
    if (e.schemaVersion !== 1) throw new Error('Unknown event schema');
    const objectEvent = ['create', 'launch', 'edit', 'crumble', 'relaunch'].includes(e.type);
    if (objectEvent) referenced.add(e.objectId);
    return { id: d.id, at: millis(e.at), type: e.type, objectId: e.objectId, state: objectEvent ? publicObject(e.objectId, e.payload) : e.payload };
  });
  // Operator-seeded bodies have no visitor event. Their immutable creation becomes a baseline.
  for (const o of all) if (!referenced.has(o.id)) rows.push({ id: `seed-${o.id}`, at: o.createdAt, type: 'create', objectId: o.id, state: o });
  rows.sort((a, b) => a.at - b.at || compareIds(a.id, b.id));
  let chunk: LogChunk = { format: 1, states: [], events: [] };
  let states = new Map<string, number>();
  let estimatedBytes = 40;
  const log: string[] = [];
  function finish() {
    if (!chunk.events.length) return;
    readLog(chunk);
    if (bytes(chunk) > CHUNK_BYTES) throw new Error('Log exceeds capacity');
    const name = `log-${createHash('sha256').update(JSON.stringify(chunk)).digest('hex').slice(0, 24)}`;
    const stored = { format: 1 as const, states: chunk.states, events: JSON.stringify(chunk.events) };
    if (bytes(stored) > CHUNK_BYTES) throw new Error('Stored log exceeds capacity');
    files[name] = stored; log.push(name);
    chunk = { format: 1, states: [], events: [] }; states = new Map(); estimatedBytes = 40;
  }
  for (const row of rows) {
    // A conservative row bound allows packing without serializing the entire chunk per event.
    const rowBytes = bytes(row) * 2;
    if (estimatedBytes + rowBytes > CHUNK_BYTES) finish();
    estimatedBytes += rowBytes;
    let state: MemoryEvent[4] = row.state;
    if ('createdAt' in row.state) {
      const key = JSON.stringify(row.state);
      let index = states.get(key);
      if (index === undefined) { index = chunk.states.length; states.set(key, index); chunk.states.push(row.state as MemoryObject); }
      state = index;
    }
    chunk.events.push([row.id, row.at, row.type, row.objectId, state]);

  }
  finish();
  // Event snapshots are authoritative even while the two live listeners catch up separately.
  const latest = new Map(all.map((o) => [o.id, o]));
  for (const row of rows) if ('createdAt' in row.state) latest.set(row.objectId, row.state as MemoryObject);
  all = [...latest.values()].sort((a, b) => compareIds(a.id, b.id));
  const shards = Array.from({ length: 16 }, (_, i) => `objects-${i.toString(16)}`);
  for (const name of shards) {
    const shard: ObjectChunk = { format: 1, objects: all.filter((o) => objectBucket(o.id) === name) };
    if (bytes(shard) > CHUNK_BYTES) throw new Error('Object shard exceeds capacity');
    files[name] = readObjects(shard);
  }
  const times = rows.map((e) => e.at);
  const manifest = readManifest({ format: 1, season: SEASON, title: 'BAD 2026', start: times[0] ?? 0, end: times.at(-1) ?? 0, log, objects: shards, eventCount: rows.length });
  return { manifest, files };
}
export async function readSeason(database: Firestore): Promise<SeasonData> {
  return database.runTransaction(async (tx) => {
    const objects = await tx.get(database.collection('objects'));
    const events = await tx.get(database.collection('events'));
    return buildSeason(objects.docs, events.docs);
  }, { readOnly: true });
}
export async function publishSeason(database: Firestore, season: SeasonData, observe?: (count: number) => void, onWrite?: (count: number) => void, fence?: StandFence) {
  // Only changed mutable shards are rewritten. Log chunks are immutable and reusable across revisions.
  const manifestRef = database.doc(`seasons/${SEASON}/meta/manifest`);
  observe?.(1);
  return database.runTransaction(async (batch) => {
  if (fence) { observe?.(1); await checkFence(database, batch, fence); }
  const previous = await batch.get(manifestRef);
  const old = previous.data();
  const hashes = Object.fromEntries(Object.entries(season.files).map(([id, data]) => [id, createHash('sha256').update(JSON.stringify(data)).digest('hex')]));
  let writes = 0;
  for (const [id, data] of Object.entries(season.files)) if (old?.hashes?.[id] !== hashes[id]) {
    batch.set(database.doc(`seasons/${SEASON}/log/${id}`), data); writes++;
  }
  if (writes || JSON.stringify(old?.manifest) !== JSON.stringify(season.manifest)) {
    if (writes > 450) throw new Error('Archive needs a larger publish strategy');
    batch.set(manifestRef, { ...season.manifest, manifest: season.manifest, hashes });
    return writes + 1;
  }
  return 0;
  }).then((writes) => { if (writes) onWrite?.(writes); });
}
/** Hydrate one coherent public revision rather than rereading the private source history. */
async function archivedSources(database: Firestore, observe?: (count: number) => void) {
  return database.runTransaction(async (tx) => {
    observe?.(1);
    const snapshot = await tx.get(database.doc(`seasons/${SEASON}/meta/manifest`));
    const objects = new Map<string, Source>(), events = new Map<string, Source>();
    let objectAt = 0, eventAt = 0;
    if (snapshot.exists) {
      const manifest = readManifest(snapshot.data());
      const ids = [...manifest.objects, ...manifest.log];
      observe?.(ids.length);
      const files = await tx.getAll(...ids.map((id) => database.doc(`seasons/${SEASON}/log/${id}`)));
      const restore = (o: MemoryObject) => ({ ...o, ownerUid: o.unclaimed ? '' : 'archived', schemaVersion: 2 });
      for (const file of files.slice(0, manifest.objects.length)) for (const o of readObjects(file.data()).objects) {
        objects.set(o.id, { id: o.id, data: () => restore(o) }); objectAt = Math.max(objectAt, o.updatedAt);
      }
      for (const file of files.slice(manifest.objects.length)) {
        const chunk = readLog(file.data());
        for (const [id, at, type, objectId, state] of chunk.events) {
          if (id === `seed-${objectId}`) continue;
          const payload = typeof state === 'number' ? restore(chunk.states[state]) : state;
          events.set(id, { id, data: () => ({ schemaVersion: 1, at, type, objectId, payload }) });
          eventAt = Math.max(eventAt, at);
        }
      }
    }
    return { objects, events, objectAt, eventAt };
  }, { readOnly: true });
}
/** Inclusive timestamp boundaries retain simultaneous commits; IDs deduplicate overlap. */
export function startMemoryWriter(database: Firestore, onError: () => void, delay = 30_000, observe?: (count: number) => void, onWrite?: (count: number) => void, fence?: StandFence) {
  let timer: ReturnType<typeof setTimeout> | undefined, stopped = false;
  let pending = Promise.resolve();
  const stops: (() => void)[] = [];
  const ready = archivedSources(database, observe).then(({ objects, events, objectAt, eventAt }) => {
    if (stopped) return;
    let gotObjects = false, gotEvents = false;
    const schedule = () => {
      if (!gotObjects || !gotEvents || timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (stopped) return;
        const a = [...objects.values()], b = [...events.values()];
        pending = pending.then(() => publishSeason(database, buildSeason(a, b), observe, onWrite, fence)).catch(onError);
      }, delay);
    };
    const a = database.collection('objects').where('updatedAt', '>=', Timestamp.fromMillis(objectAt));
    const b = database.collection('events').where('at', '>=', Timestamp.fromMillis(eventAt));
    stops.push(a.onSnapshot((s) => {
      observe?.(s.docChanges().length || (s.empty ? 1 : 0));
      for (const d of s.docs) objects.set(d.id, d);
      gotObjects = true; schedule();
    }, onError));
    stops.push(b.onSnapshot((s) => {
      observe?.(s.docChanges().length || (s.empty ? 1 : 0));
      for (const d of s.docs) events.set(d.id, d);
      gotEvents = true; schedule();
    }, onError));
  }).catch(onError);
  return async () => { stopped = true; clearTimeout(timer); stops.forEach((stop) => stop()); await ready; await pending; };
}
