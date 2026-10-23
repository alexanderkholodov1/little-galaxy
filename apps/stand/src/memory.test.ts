import { expect, it } from 'vitest';
import { CHUNK_BYTES, objectBucket, orbitFromVelocity, presets, readLog, replay } from '@little-galaxy/shared';
import { validateFreeze } from './freeze-season.js';
import { buildSeason, publicObject } from './memory.js';
const body = (updatedAt: number, status = 'active') => ({ schemaVersion: 2, ownerUid: 'secret-owner', type: 'planet', nameKey: 'quiet-aurora', params: presets.planet[0], orbit: orbitFromVelocity(0, 2.58, 0, 1000), createdAt: 1000, updatedAt, season: 'bad-2026', status });
const source = (id: string, value: unknown) => ({ id, data: () => value });
it('packs deterministic, bounded, owner-free chunks and replays each exact transition', () => {
  const events = [
    source('a-create', { schemaVersion: 1, type: 'create', objectId: 'a', at: 1000, payload: body(1000) }),
    source('a', { schemaVersion: 1, type: 'launch', objectId: 'a', at: 1000, payload: body(1000) }),
    source('b', { schemaVersion: 1, type: 'edit', objectId: 'a', at: 2000, payload: { ...body(2000), params: presets.planet[1] } }),
    source('c', { schemaVersion: 1, type: 'crumble', objectId: 'a', at: 3000, payload: body(3000, 'hangar') }),
    source('d', { schemaVersion: 1, type: 'relaunch', objectId: 'a', at: 4000, payload: body(4000) }),
  ];
  const objects = [source('a', body(4000))];
  const season = buildSeason(objects, events);
  expect(buildSeason([...objects].reverse(), [...events].reverse())).toEqual(season);
  const chunks = season.manifest.log.map((id) => readLog(season.files[id]));
  expect(replay(chunks, 999)).toEqual([]);
  expect(replay(chunks, 1000)).toEqual([publicObject('a', body(1000))]);
  expect(replay(chunks, 2500)[0].params).toEqual(presets.planet[1]);
  expect(replay(chunks, 3000)[0].status).toBe('hangar');
  expect(replay(chunks, 4000)[0]).toEqual(publicObject('a', body(4000)));
  expect(JSON.stringify(season)).not.toContain('secret-owner');
  expect(JSON.stringify(season)).not.toContain('ownerUid');
  for (const file of Object.values(season.files)) expect(Buffer.byteLength(JSON.stringify(file))).toBeLessThan(CHUNK_BYTES);
  expect(season.manifest.objects).toContain(objectBucket('a'));
});
it('splits a fair-sized session into a handful of reads and deduplicates create/launch snapshots', () => {
  const objects = Array.from({ length: 300 }, (_, i) => source(`p-${i}`, body(1000)));
  const events = objects.flatMap((o) => ['create', 'launch', 'edit', 'crumble', 'relaunch'].map((type, n) => source(`${o.id}-${n}`, { schemaVersion: 1, type, objectId: o.id, at: 1000 + n, payload: body(1000 + n, type === 'crumble' ? 'hangar' : 'active') })));
  const data = buildSeason(objects, events);
  expect(data.manifest.log.length + 1).toBeLessThanOrEqual(5);
  for (const file of Object.values(data.files)) expect(Buffer.byteLength(JSON.stringify(file))).toBeLessThan(CHUNK_BYTES);
});
it('fails closed for unknown event or invalid source data', () => {
  expect(() => buildSeason([source('a', { ...body(1), type: 'future' })], [])).toThrow();
  expect(() => buildSeason([], [source('x', { schemaVersion: 1, type: 'future', objectId: '', at: 2, payload: {} })])).toThrow();
});

it('refuses freeze without a loopback demo emulator before any admin connection', () => {
  expect(() => validateFreeze(['output'], { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_PROJECT_ID: 'demo-little-galaxy' })).not.toThrow();
  for (const env of [{}, { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_PROJECT_ID: 'not-demo' }, { FIRESTORE_EMULATOR_HOST: 'external:8080', FIREBASE_PROJECT_ID: 'demo-little-galaxy' }]) expect(() => validateFreeze(['output'], env)).toThrow();
});
