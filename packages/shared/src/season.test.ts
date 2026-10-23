import { expect, it } from 'vitest';
import { objectBucket, readManifest, readMemoryObject, readLog, replayScene } from './season.js';
import { orbitFromVelocity } from './orbit.js';
import { presets } from './schema.js';
const object = { schemaVersion: 2, id: 'parent', type: 'planet', nameKey: 'quiet-aurora', params: presets.planet[0], orbit: orbitFromVelocity(0, 2.58, 0, 0), status: 'hangar', createdAt: 1000, updatedAt: 2000, season: 'bad-2026' };
it('validates public memory objects and drops unknown identity fields', () => {
  const result = readMemoryObject({ ...object, ownerUid: 'secret', extra: 'private' });
  expect(result).not.toHaveProperty('ownerUid'); expect(result).not.toHaveProperty('extra');
  expect(readMemoryObject({ ...object, schemaVersion: 99 })).toBeNull();
  expect(readMemoryObject({ ...object, updatedAt: 999 })).toBeNull();
  expect(readMemoryObject({ ...object, id: '../bad' })).toBeNull();
  expect(() => readManifest({ format: 99 })).toThrow();
  expect(() => readLog({ format: 1, states: [object], events: JSON.stringify([['event', 1000, 'launch', 'wrong-id', 0]]) })).toThrow();
});
it('keeps a hangared moon parent in the historical scene without counting it as active', () => {
  const parent = readMemoryObject(object)!;
  const moon = readMemoryObject({ ...object, id: 'moon', type: 'moon', params: presets.moon[0], hostOrbit: object.orbit, orbit: { ...object.orbit, hostId: 'parent' }, status: 'active' })!;
  const scene = replayScene([parent, moon]);
  expect(scene.find((o) => o.id === 'parent')?.moonHost).toBe(true);
  expect(scene.filter((o) => !o.moonHost)).toHaveLength(1);
  expect(objectBucket('memory-planet')).toBe('objects-4');
});
