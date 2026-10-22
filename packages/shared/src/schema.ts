import type { Orbit } from './orbit.js';
export const SCHEMA_VERSION = 1;
export const SEASON = 'bad-2026';
export const MAX_LAUNCHES_PER_DAY = 5;
export { names, nameKeys, objectName, newName } from './names.js';
import { nameKeys } from './names.js';
import type { NameKey } from './names.js';
export type { NameKey } from './names.js';
export const OBJECT_SCHEMA_VERSION = 2;
export const palette = ['#398cbd', '#c69860', '#76aa91', '#b1a1cd'] as const;
export type ObjectType = 'planet' | 'star' | 'moon';
export interface PlanetParams {
  size: number;
  palette: number;
  oceans: number;
  mountains?: number;
  clouds?: number;
  rings?: number;
  atmosphere?: number;
}
export interface StarParams {
  size: number;
  temperature: number;
  corona: number;
}
export interface MoonParams {
  size: number;
  craters: number;
  colour: number;
}
export type ObjectParams = PlanetParams | StarParams | MoonParams;
export const presets = {
  planet: [
    { size: 0.4, palette: 0, oceans: 0.65, mountains: 0.3, clouds: 0.4, rings: 0, atmosphere: 0 },
    { size: 0.5, palette: 1, oceans: 0.05, mountains: 0.7, clouds: 0.1, rings: 0.7, atmosphere: 1 },
  ],
  star: [
    { size: 0.55, temperature: 0.2, corona: 0.5 },
    { size: 0.7, temperature: 0.9, corona: 0.8 },
  ],
  moon: [
    { size: 0.25, craters: 0.7, colour: 0 },
    { size: 0.3, craters: 0.3, colour: 3 },
  ],
} satisfies Record<ObjectType, ObjectParams[]>;
export function planetDefaults(p: PlanetParams) {
  return { mountains: 0.3, clouds: 0.3, rings: 0, atmosphere: p.palette, ...p };
}
export interface GalaxyObject<T = unknown> {
  schemaVersion: 1 | 2;
  ownerUid: string;
  type: ObjectType;
  nameKey: NameKey;
  params: ObjectParams;
  hostOrbit?: Orbit;
  orbit: Orbit;
  status: 'active' | 'hangar';
  createdAt: T;
  updatedAt: T;
  season: typeof SEASON;
}
export type Action = 'launch' | 'relaunch' | 'edit' | 'shake' | 'comet' | 'shootingStar';
export interface GalaxyUser<T = unknown> {
  schemaVersion: 1;
  activeObjectId: string;
  launchesToday: number;
  launchDay: string;
  lastWriteAt: T;
  lastShakeAt: T;
  lastCometAt: T;
  lastStarAt: T;
  writeId: string;
  action: Action;
}
export interface GalaxyEvent<T = unknown> {
  schemaVersion: 1;
  uid: string;
  type: Action | 'create' | 'crumble' | 'meteorShower';
  objectId: string;
  at: T;
  payload: Record<string, unknown>;
}
export interface LiveConfig {
  schemaVersion: 1;
  appVersion: string;
  seasonOpen: boolean;
  ownerUid: string;
  launches: boolean;
  comets: boolean;
  shake: boolean;
  shootingStars: boolean;
  assistantPublic: boolean;
  screenScene: 'galaxy' | 'qr';
}
export interface RenderObject {
  id: string;
  type?: ObjectType;
  nameKey: NameKey;
  params: ObjectParams;
  orbit: Orbit;
  hostOrbit?: Orbit;
  updatedAt?: number;
  unclaimed?: boolean;
}
export interface LiveSnapshot<T = unknown> {
  schemaVersion: 1;
  at: T;
  objects: RenderObject[];
  creators: number;
  activeCount: number;
}
export function validParams(value: unknown, type: ObjectType = 'planet', version = 1): value is ObjectParams {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  const fields =
    type === 'planet'
      ? ['size', 'palette', 'oceans', 'mountains', 'clouds', 'rings', 'atmosphere']
      : type === 'star'
        ? ['size', 'temperature', 'corona']
        : ['size', 'craters', 'colour'];
  const required = type === 'planet' && version === 1 ? ['size', 'palette', 'oceans'] : fields;
  return (
    Object.keys(p).every((k) => fields.includes(k)) &&
    required.every((k) => k in p) &&
    Object.entries(p).every(
      ([k, v]) =>
        typeof v === 'number' &&
        Number.isFinite(v) &&
        (k === 'size'
          ? v >= 0.2 && v <= 0.7
          : ['palette', 'atmosphere', 'colour'].includes(k)
            ? Number.isInteger(v) && v >= 0 && v <= 3
            : v >= 0 && v <= 1),
    )
  );
}
export function validOrbit(value: unknown): value is Orbit {
  if (!value || typeof value !== 'object') return false;
  const o = value as Orbit;
  return (
    Object.keys(o).length === 9 &&
    typeof o.hostId === 'string' &&
    /^[A-Za-z0-9_-]{1,100}$/.test(o.hostId) &&
    typeof o.isComet === 'boolean' &&
    [o.a, o.e, o.inclination, o.omega, o.meanAnomaly, o.epoch].every(Number.isFinite) &&
    o.a >= 2 &&
    o.a <= 30 &&
    o.e >= 0 &&
    o.e <= 0.8 &&
    o.a * (1 - o.e) > 1 &&
    Math.abs(o.inclination) <= 0.35 &&
    Math.abs(o.omega) <= Math.PI &&
    Math.abs(o.meanAnomaly) <= Math.PI * 2 &&
    o.epoch >= 0 &&
    o.epoch <= 4102444800000 &&
    [1, -1].includes(o.direction)
  );
}
/** v0.1 wrote no domain docs. Missing version means v1; unknown future versions are skipped safely. */
export function readObject(value: unknown): GalaxyObject | null {
  if (!value || typeof value !== 'object') return null;
  const d = value as GalaxyObject;
  if (
    ![1, 2].includes(d.schemaVersion ?? 1) ||
    !['planet', 'star', 'moon'].includes(d.type) ||
    !nameKeys.includes(d.nameKey) ||
    !validParams(d.params, d.type, d.schemaVersion ?? 1) ||
    !validOrbit(d.orbit) ||
    !['active', 'hangar'].includes(d.status) ||
    typeof d.ownerUid !== 'string' ||
    d.season !== SEASON
  )
    return null;
  if (d.type === 'moon' && !validOrbit(d.hostOrbit)) return null;
  return {
    ...d,
    schemaVersion: d.schemaVersion ?? 1,
    params: d.type === 'planet' ? planetDefaults(d.params as PlanetParams) : d.params,
  };
}
export function utcDay(epoch: number): string {
  return new Date(epoch).toISOString().slice(0, 10);
}
