import { expect, it } from 'vitest';
import {
  names,
  newName,
  nameKeys,
  objectName,
  presets,
  readObject,
  SEASON,
  validParams,
  orbitFromSwipe,
  starPosition,
  worldPosition,
  leastCrowdedHost,
  syntheticObjects,
} from './index.js';
it('provides 40 × 40 unique generated names in English and Spanish with stable keys', () => {
  const keys = nameKeys.filter((k) => k.startsWith('n'));
  expect(keys).toHaveLength(1600);
  for (const language of ['en', 'es'] as const)
    expect(new Set(keys.map((k) => objectName(k, language))).size).toBe(1600);
  expect(names[newName(() => 0)]).toBeDefined();
  expect(names[newName(() => 0.999999)]).toBeDefined();
  expect(objectName('quiet-aurora', 'es')).toBe('Aurora tranquila');
});
for (const type of ['planet', 'star', 'moon'] as const)
  for (const params of presets[type])
    it(`bounds every ${type} field including wrong types and unknown keys`, () => {
      expect(validParams(params, type, 2)).toBe(true);
      for (const field of Object.keys(params)) {
        const discrete = ['palette', 'atmosphere', 'colour'].includes(field),
          low = field === 'size' ? 0.2 : 0,
          high = field === 'size' ? 0.7 : discrete ? 3 : 1;
        for (const bad of [low - 0.01, high + 0.01, '0', null, NaN, Infinity, ...(discrete ? [1.5] : [])])
          expect(validParams({ ...params, [field]: bad }, type, 2), field).toBe(false);
        for (const bound of [low, high])
          expect(validParams({ ...params, [field]: bound }, type, 2), field).toBe(true);
      }
      expect(validParams({ ...params, extra: true }, type, 2)).toBe(false);
    });
it('defaults legacy planet fields and skips unsupported versions and invalid rich data', () => {
  const old = {
    type: 'planet',
    nameKey: 'quiet-aurora',
    ownerUid: 'uid',
    params: { size: 0.4, palette: 0, oceans: 0.5 },
    orbit: orbitFromSwipe(200, 0, 0.3, 0),
    season: SEASON,
    status: 'active',
  };
  expect(readObject(old)?.params).toMatchObject({ mountains: 0.3, clouds: 0.3, rings: 0, atmosphere: 0 });
  expect(readObject({ ...old, schemaVersion: 2 })).toBeNull();
  expect(readObject({ ...old, schemaVersion: 3 })).toBeNull();
});
it('places stars deterministically on spiral arms, balances hosts and preserves moon motion without a live parent', () => {
  expect(starPosition('visitor')).toEqual(starPosition('visitor'));
  expect(Math.hypot(...starPosition('visitor'))).toBeGreaterThan(18);
  const objects = syntheticObjects(500);
  expect(objects).toHaveLength(500);
  expect(leastCrowdedHost([])).toBe('central');
  const planet = { ...objects[1], orbit: { ...objects[1].orbit, hostId: 'visitor' } };
  const moon = { ...objects[2], type: 'moon' as const, hostOrbit: planet.orbit };
  const point = worldPosition(moon, 1000),
    center = worldPosition(planet, 1000);
  expect(Math.hypot(...point.map((v, i) => v - center[i]))).toBeCloseTo(
    Math.hypot(
      ...worldPosition({ ...moon, hostOrbit: undefined, orbit: { ...moon.orbit, hostId: 'central' } }, 1000),
    ) * 0.2,
  );
  expect(worldPosition(moon, 1000)).toEqual(point);
});
it('rejects v1 rich keys and non-planets, and handles names as own properties', () => {
  expect(validParams(presets.planet[0], 'planet', 1)).toBe(false);
  expect(validParams(presets.star[0], 'star', 1)).toBe(false);
  const body = { schemaVersion: 2, ownerUid: 'visitor', type: 'planet', params: presets.planet[0], orbit: orbitFromSwipe(200, 0, .3, 0), status: 'active', season: SEASON };
  for (const nameKey of ['__proto__', 'constructor', 'toString', 'n40-00']) expect(readObject({ ...body, nameKey })).toBeNull();
  expect(readObject({ ...body, nameKey: 'n39-39' })).not.toBeNull();
});
it('keeps Spanish names grammatical and avoids redundant solar and lunar pairs', () => {
  expect(objectName('n28-07', 'es')).toBe('Sol estival');
  expect(objectName('n29-08', 'es')).toBe('Rayo nocturno');
  for (const [key, value] of [['n13-35', 'Glaciar templado'], ['n14-07', 'Sol de invierno'], ['n27-35', 'Glaciar polar'], ['n29-07', 'Sol de medianoche'], ['n30-07', 'Sol del alba']]) expect(objectName(key, 'es')).toBe(value);
  for (const value of Object.values(names)) {
    expect(value.es).not.toMatch(/lunar lunar|Sol soleado|Cielo celeste|Universo cósmico|Sol fresco|Sol estelar|Glaciar helado|Glaciar cálido/);
    expect(value.es).not.toMatch(/undefined/);
  }
});
