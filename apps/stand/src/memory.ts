import { createHash } from 'node:crypto';
import { CHUNK_BYTES, compareIds, objectBucket, readLog, readManifest, readMemoryObject, readObject, readObjects, SEASON } from '@little-galaxy/shared';
import type { LogChunk, MemoryEvent, MemoryObject, ObjectChunk, SeasonData } from '@little-galaxy/shared';
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
export async function publishSeason(database: Firestore, season: SeasonData) {
  // Only changed mutable shards are rewritten. Log chunks are immutable and reusable across revisions.
  const manifestRef = database.doc(`seasons/${SEASON}/meta/manifest`);
  const previous = await manifestRef.get();
  const old = previous.data();
  const hashes = Object.fromEntries(Object.entries(season.files).map(([id, data]) => [id, createHash('sha256').update(JSON.stringify(data)).digest('hex')]));
  const batch = database.batch();
  let writes = 0;
  for (const [id, data] of Object.entries(season.files)) if (old?.hashes?.[id] !== hashes[id]) {
    batch.set(database.doc(`seasons/${SEASON}/log/${id}`), data); writes++;
  }
  if (writes || JSON.stringify(old?.manifest) !== JSON.stringify(season.manifest)) {
    if (writes > 450) throw new Error('Archive needs a larger publish strategy');
    batch.set(manifestRef, { ...season.manifest, manifest: season.manifest, hashes });
    await batch.commit();
  }
}
/** One cached listener per source; serialize/debounce publication and stop all work on shutdown. */
export function startMemoryWriter(database: Firestore, onError: () => void, delay = 30_000) {
  let objects: Source[] | undefined, events: Source[] | undefined, timer: ReturnType<typeof setTimeout> | undefined;
  let pending = Promise.resolve(), stopped = false;
  const flush = () => {
    if (stopped || !objects || !events) return;
    const a = objects, b = events;
    pending = pending.then(() => publishSeason(database, buildSeason(a, b))).catch(onError);
  };
  const schedule = () => { if (!timer) timer = setTimeout(() => { timer = undefined; flush(); }, delay); };
  const a = database.collection('objects').onSnapshot((s) => { objects = s.docs; schedule(); }, onError);
  const b = database.collection('events').onSnapshot((s) => { events = s.docs; schedule(); }, onError);
  return async () => { stopped = true; clearTimeout(timer); a(); b(); await pending; };
}
