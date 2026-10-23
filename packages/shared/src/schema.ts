import type { Language } from './index.js';
import type { Orbit } from './orbit.js';
export const SCHEMA_VERSION = 1;
export const SEASON = 'bad-2026';
export const MAX_LAUNCHES_PER_DAY = 5;
export const names = {
  'quiet-aurora': { en: 'Quiet Aurora', es: 'Aurora tranquila' },
  'bright-tide': { en: 'Bright Tide', es: 'Marea brillante' },
  'gentle-horizon': { en: 'Gentle Horizon', es: 'Horizonte suave' },
  'distant-garden': { en: 'Distant Garden', es: 'Jardín lejano' },
} as const;
export type NameKey = keyof typeof names;
export const nameKeys = Object.keys(names) as NameKey[];
export const palette = ['#398cbd', '#c69860', '#76aa91', '#b1a1cd'] as const;
export interface PlanetParams { size: number; palette: number; oceans: number }
export interface GalaxyObject<T = unknown> {
  schemaVersion: 1; ownerUid: string; type: 'planet'; nameKey: NameKey; params: PlanetParams;
  orbit: Orbit; status: 'active' | 'hangar'; createdAt: T; updatedAt: T; season: typeof SEASON;
}
export type Action = 'launch' | 'relaunch' | 'edit' | 'shake' | 'comet' | 'shootingStar';
export interface GalaxyUser<T = unknown> {
  schemaVersion: 1; activeObjectId: string; launchesToday: number; launchDay: string;
  lastWriteAt: T; lastShakeAt: T; lastCometAt: T; lastStarAt: T; writeId: string; action: Action;
}
export interface GalaxyEvent<T = unknown> {
  schemaVersion: 1; uid: string; type: Action | 'create' | 'crumble' | 'meteorShower';
  objectId: string; at: T; payload: Record<string, unknown>;
}
export interface LiveConfig {
  schemaVersion: 1; appVersion: string; seasonOpen: boolean;
  launches: boolean; comets: boolean; shake: boolean; shootingStars: boolean; assistantPublic: boolean;
  screenScene: 'galaxy' | 'qr';
}
export interface RenderObject { id: string; nameKey: NameKey; params: PlanetParams; orbit: Orbit }
export interface LiveSnapshot<T = unknown> {
  schemaVersion: 1; at: T; objects: RenderObject[]; creators: number; activeCount: number;
}
export function objectName(key: NameKey, language: Language): string { return names[key][language]; }
export function validParams(value: unknown): value is PlanetParams {
  if (!value || typeof value !== 'object') return false;
  const p = value as PlanetParams;
  return Object.keys(p).length === 3 && Number.isFinite(p.size) && p.size >= 0.2 && p.size <= 0.7 &&
    Number.isInteger(p.palette) && p.palette >= 0 && p.palette < palette.length && Number.isFinite(p.oceans) && p.oceans >= 0 && p.oceans <= 1;
}
export function validOrbit(value: unknown): value is Orbit {
  if (!value || typeof value !== 'object') return false;
  const o = value as Orbit;
  return Object.keys(o).length === 9 && o.hostId === 'central' && typeof o.isComet === 'boolean' &&
    [o.a, o.e, o.inclination, o.omega, o.meanAnomaly, o.epoch].every(Number.isFinite) &&
    o.a >= 3.5 && o.a <= 20.05 && o.e >= 0 && o.e <= 0.755 && o.a * (1 - o.e) > 1 && o.a * (1 + o.e) <= 34.1 &&
    Math.abs(o.inclination) <= 0.35 && Math.abs(o.omega) <= Math.PI && Math.abs(o.meanAnomaly) <= Math.PI &&
    o.epoch >= 0 && o.epoch <= 4102444800000 && [1, -1].includes(o.direction);
}
/** v0.1 wrote no domain docs. Missing version means v1; unknown future versions are skipped safely. */
export function readObject(value: unknown): GalaxyObject | null {
  if (!value || typeof value !== 'object') return null;
  const d = value as GalaxyObject;
  if ((d.schemaVersion ?? 1) !== 1 || d.type !== 'planet' || !nameKeys.includes(d.nameKey) ||
    !validParams(d.params) || !validOrbit(d.orbit) || !['active', 'hangar'].includes(d.status) ||
    typeof d.ownerUid !== 'string' || d.season !== SEASON) return null;
  return { ...d, schemaVersion: 1 };
}
export function utcDay(epoch: number): string { return new Date(epoch).toISOString().slice(0, 10); }
