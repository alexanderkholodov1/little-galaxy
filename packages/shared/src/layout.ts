import { positionAt } from './orbit.js';
import type { RenderObject } from './schema.js';
export function starPosition(id: string): [number, number, number] {
  if (id === 'central') return [0, 0, 0];
  let hash = 2166136261;
  for (const c of id) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  const t = (hash % 10000) / 10000,
    arm = hash % 3;
  const r = 18 + t * 38,
    angle = t * 4 + (arm * Math.PI * 2) / 3;
  return [Math.cos(angle) * r, Math.sin(angle) * r, Math.sin(hash) * 2];
}
export function worldPosition(object: RenderObject, time: number): [number, number, number] {
  if (object.type === 'star') return starPosition(object.id);
  const parent = object.hostOrbit;
  const origin = starPosition(parent?.hostId ?? object.orbit.hostId);
  const host = parent ? positionAt(parent, time) : [0, 0, 0];
  const local = positionAt(object.orbit, time);
  return local.map((v, i) => origin[i] + host[i] + v * (parent ? 0.2 : 1)) as [number, number, number];
}
export function leastCrowdedHost(objects: RenderObject[]): string {
  const hosts = [
    'central',
    ...objects
      .filter((o) => o.type === 'star')
      .map((o) => o.id)
      .sort(),
  ];
  const crowd = (id: string) =>
    objects.filter((o) => (!o.type || o.type === 'planet') && o.orbit.hostId === id).length;
  return hosts.reduce((best, id) => (crowd(id) < crowd(best) ? id : best));
}
export function syntheticObjects(count: number): RenderObject[] {
  const orbit = (i: number) => ({
    hostId: i < 20 ? 'central' : `synthetic-${Math.floor(i / 20) * 20}`,
    a: 3 + (i % 14),
    e: 0.05,
    inclination: 0.1,
    omega: Math.sin(i) * Math.PI,
    meanAnomaly: 0,
    epoch: 0,
    direction: 1 as const,
    isComet: false,
  });
  return Array.from({ length: Math.min(2000, Math.max(0, Math.floor(count))) }, (_, i) => {
    const type = i % 20 === 0 ? 'star' : i % 5 === 4 ? 'moon' : 'planet';
    return {
      id: `synthetic-${i}`,
      type,
      nameKey: 'quiet-aurora',
      params:
        type === 'star'
          ? { size: 0.5, temperature: (i % 7) / 7, corona: 0.5 }
          : type === 'moon'
            ? { size: 0.2, craters: 0.7, colour: i % 4 }
            : {
                size: 0.2 + (i % 5) * 0.1,
                palette: i % 4,
                oceans: (i % 9) / 9,
                mountains: 0.5,
                clouds: 0.3,
                rings: i % 8 === 0 ? 0.7 : 0,
                atmosphere: i % 4,
              },
      orbit: type === 'moon' ? { ...orbit(i), hostId: `synthetic-${i - 1}` } : orbit(i),
      ...(type === 'moon' ? { hostOrbit: orbit(i - 1) } : {}),
    };
  });
}
