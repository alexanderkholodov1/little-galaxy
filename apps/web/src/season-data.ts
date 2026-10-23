import { doc, getDoc } from 'firebase/firestore';
import { objectBucket, readLog, readManifest, readObjects, readObject, planetDefaults, SEASON, safeId } from '@little-galaxy/shared';
import type { LogChunk, MemoryObject, SeasonManifest, RenderObject, PlanetParams } from '@little-galaxy/shared';
import { firestore } from './firebase';
const base = `/galaxy/season/${SEASON}`;
/** A missing static file may be a Hosting SPA rewrite. HTML is absence, malformed JSON is an error. */
async function staticFile(name: string, signal?: AbortSignal): Promise<unknown | null> {
  const response = await fetch(`${base}/${name}.json`, { signal, headers: { Accept: 'application/json' } });
  if (response.status === 404 || response.headers.get('content-type')?.includes('text/html')) return null;
  if (!response.ok) throw new Error('Season unavailable');
  return response.json();
}
async function liveFile(collection: string, id: string) {
  if (!firestore) throw new Error('No season connection');
  const result = await getDoc(doc(firestore, 'seasons', SEASON, collection, id));
  return result.exists() ? result.data() : null;
}
export async function loadSeason(signal?: AbortSignal): Promise<{ manifest: SeasonManifest; chunks: LogChunk[]; frozen: boolean }> {
  const file = await staticFile('manifest', signal);
  const frozen = file !== null;
  const manifest = readManifest(file ?? await liveFile('meta', 'manifest'));
  const chunks: LogChunk[] = [];
  // Sequential reads avoid a burst on slow phones, and never query the events collection.
  for (const id of manifest.log) {
    if (signal?.aborted) throw new Error('Cancelled');
    chunks.push(readLog(frozen ? await staticFile(id, signal) : await liveFile('log', id)));
  }
  if (chunks.reduce((n, c) => n + c.events.length, 0) !== manifest.eventCount) throw new Error('Incomplete season');
  return { manifest, chunks, frozen };
}
export async function loadMemoryObject(id: string, signal?: AbortSignal): Promise<MemoryObject | null> {
  if (!safeId(id)) return null;
  const bucket = objectBucket(id);
  const file = await staticFile(bucket, signal);
  const data = file ?? await liveFile('log', bucket);
  if (data === null) return null;
  return readObjects(data).objects.find((o) => o.id === id) ?? null;
}

/** The ordinary fair entry reads one aggregate snapshot; replay is an explicit, bounded load. */
export async function loadHome(signal?: AbortSignal): Promise<{ frozen: boolean; objects?: RenderObject[]; at?: number }> {
  const manifest = await staticFile('manifest', signal);
  if (manifest !== null) { readManifest(manifest); return { frozen: true }; }
  if (!firestore) throw new Error('No live connection');
  const result = await getDoc(doc(firestore, 'snapshots', 'live'));
  const snapshot = result.data();
  if (!snapshot || snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.objects)) throw new Error('No live snapshot');
  const objects = snapshot.objects.map((value: RenderObject) => {
    const type = value.type ?? 'planet';
    const object = readObject({ ...value, type, params: type === 'planet' ? planetDefaults(value.params as PlanetParams) : value.params, ownerUid: 'public', status: 'active', schemaVersion: 2, season: SEASON });
    if (!safeId(value.id) || !object) throw new Error('Invalid snapshot object');
    return { ...value, type, params: object.params };
  });
  const at = snapshot.at?.toMillis?.();
  if (!Number.isFinite(at)) throw new Error('No snapshot timestamp');
  return { frozen: false, objects, at };
}
