import { readObject, SEASON } from './schema.js';
import type { GalaxyObject, RenderObject } from './schema.js';
export const SEASON_FORMAT = 1;
export const CHUNK_BYTES = 600_000;
export const compareIds = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export const safeId = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(id);
export type MemoryObject = Omit<GalaxyObject<number>, 'ownerUid'> & { id: string; unclaimed?: boolean };
export type MemoryEvent = [id: string, at: number, type: string, objectId: string, state: number | Record<string, unknown>];
export interface LogChunk { format: 1; states: MemoryObject[]; events: MemoryEvent[] }
export interface StoredLogChunk { format: 1; states: MemoryObject[]; events: string }
export interface ObjectChunk { format: 1; objects: MemoryObject[] }
export interface SeasonManifest { format: 1; season: typeof SEASON; title: 'BAD 2026'; start: number; end: number; log: string[]; objects: string[]; eventCount: number }
export interface SeasonData { manifest: SeasonManifest; files: Record<string, StoredLogChunk | ObjectChunk> }
export function objectBucket(id: string): string {
  let hash = 0;
  for (const c of id) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
  return `objects-${(hash % 16).toString(16)}`;
}
export function readMemoryObject(value: unknown): MemoryObject | null {
  if (!value || typeof value !== 'object') return null;
  const d = value as MemoryObject;
  // readObject normalizes legacy params; memory always stores that normalized shape as v2.
  if (d.schemaVersion !== 2 || !safeId(d.id) || !Number.isFinite(d.createdAt) || !Number.isFinite(d.updatedAt) || d.createdAt < 0 || d.updatedAt < d.createdAt) return null;
  const object = readObject({ ...d, ownerUid: d.unclaimed ? '' : 'public', schemaVersion: 2 });
  if (!object) return null;
  const publicObject = object;
  return { schemaVersion: 2, id: d.id, type: publicObject.type, nameKey: publicObject.nameKey, params: publicObject.params, orbit: publicObject.orbit, ...(publicObject.hostOrbit ? { hostOrbit: publicObject.hostOrbit } : {}), status: publicObject.status, season: SEASON, createdAt: d.createdAt, updatedAt: d.updatedAt, ...(d.unclaimed === true ? { unclaimed: true } : {}) };
}
export function memoryRender(object: MemoryObject): RenderObject {
  const { status: _status, createdAt: _created, schemaVersion: _schema, season: _season, ...render } = object;
  void _status; void _created; void _schema; void _season;
  return render;
}
export function readManifest(value: unknown): SeasonManifest {
  const d = value as SeasonManifest;
  if (!d || d.format !== 1 || d.season !== SEASON || d.title !== 'BAD 2026' || !Number.isFinite(d.start) || !Number.isFinite(d.end) || d.end < d.start
    || !Number.isInteger(d.eventCount) || d.eventCount < 0 || !Array.isArray(d.log) || !Array.isArray(d.objects)
    || d.log.length > 1000 || d.objects.length !== 16 || ![...d.log, ...d.objects].every(safeId)) throw new Error('Unsupported season manifest');
  return d;
}
export function readLog(value: unknown): LogChunk {
  const raw = value as LogChunk | StoredLogChunk;
  const d = raw && { ...raw, events: typeof raw.events === 'string' ? JSON.parse(raw.events) : raw.events } as LogChunk;
  if (!d || d.format !== 1 || !Array.isArray(d.states) || !Array.isArray(d.events) || d.states.some((o) => !readMemoryObject(o))) throw new Error('Invalid log');
  for (const e of d.events) if (!Array.isArray(e) || e.length !== 5 || !safeId(e[0]) || !Number.isFinite(e[1]) || !safeId(e[3] || 'global')
    || !['create', 'launch', 'edit', 'crumble', 'relaunch', 'shake', 'comet', 'shootingStar', 'meteorShower'].includes(e[2])
    || (['create', 'launch', 'edit', 'crumble', 'relaunch'].includes(e[2]) !== (typeof e[4] === 'number'))
    || (typeof e[4] === 'number' ? !Number.isInteger(e[4]) || !d.states[e[4]] || d.states[e[4]].id !== e[3] : !e[4] || typeof e[4] !== 'object' || Array.isArray(e[4]))) throw new Error('Invalid memory event');
  return d;
}
export function readObjects(value: unknown): ObjectChunk {
  const d = value as ObjectChunk;
  if (!d || d.format !== 1 || !Array.isArray(d.objects) || d.objects.some((o) => !readMemoryObject(o))) throw new Error('Invalid object shard');
  return d;
}
export function replay(chunks: LogChunk[], at: number): MemoryObject[] {
  const objects = new Map<string, MemoryObject>();
  const rows = chunks.flatMap((chunk) => chunk.events.map((event) => ({ event, chunk })));
  rows.sort((a, b) => a.event[1] - b.event[1] || compareIds(a.event[0], b.event[0]));
  for (const { event: [, time, , id, state], chunk } of rows) {
    if (time > at) break;
    if (typeof state === 'number') objects.set(id, chunk.states[state]);
  }
  return [...objects.values()].sort((a, b) => compareIds(a.id, b.id));
}
export function replayScene(objects: MemoryObject[]): RenderObject[] {
  const hosts = new Set(objects.filter((o) => o.status === 'active' && o.type === 'moon').map((o) => o.orbit.hostId));
  return objects.filter((o) => o.status === 'active' || hosts.has(o.id)).map((o) => ({ ...memoryRender(o), ...(o.status === 'hangar' ? { moonHost: true } : {}) }));
}
