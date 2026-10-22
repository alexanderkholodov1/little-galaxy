import { expect, it } from 'vitest';
import { GRAVITY, LAUNCH_RADIUS, orbitFromSwipe, orbitFromVelocity, orbitalPeriod, positionAt } from './orbit.js';
import { readObject, SEASON, validOrbit, validParams } from './schema.js';
const epoch = 1792627200000;
it('agrees on deterministic position without frame history and preserves the launch point', () => {
  for (const tangent of [1.5, 2, Math.sqrt(GRAVITY / LAUNCH_RADIUS), -2.7, 20]) {
    const o = orbitFromVelocity(0.2, tangent, 0.1, epoch);
    expect(validOrbit(o)).toBe(true);
    expect(positionAt(o, epoch)[0]).toBeCloseTo(6, 8);
    expect(positionAt(o, epoch)[1]).toBeCloseTo(0, 8);
    expect(positionAt(o, epoch + 1200)).toEqual(positionAt({ ...o }, epoch + 1200));
    expect(positionAt(o, epoch + orbitalPeriod(o) * 1000)[0]).toBeCloseTo(6, 6);
  }
});
it.each([[20, 20], [0, 0], [-10, 0.1]])('escape/fall (%s,%s) becomes a closed, returning comet', (r, t) => {
  const o = orbitFromVelocity(r, t, 100, epoch);
  expect(o.isComet).toBe(true);
  expect(o.e).toBeGreaterThan(0.7);
  expect(o.a * (1 - o.e)).toBeGreaterThan(1);
  expect(Number.isFinite(orbitalPeriod(o))).toBe(true);
  const start = positionAt(o, epoch);
  positionAt(o, epoch + 10000).forEach((v) => expect(Number.isFinite(v)).toBe(true));
  positionAt(o, epoch + orbitalPeriod(o) * 1000).forEach((v, i) => expect(v).toBeCloseTo(start[i], 6));
});
it('keeps a circular launch circular and translates swipe direction/strength', () => {
  expect(orbitFromVelocity(0, Math.sqrt(GRAVITY / 6), 0, epoch).e).toBeCloseTo(0);
  expect(orbitFromSwipe(100, 20, 0.3, epoch)).not.toEqual(orbitFromSwipe(-100, 20, 0.3, epoch));
  expect(orbitFromSwipe(0, 0, 0.3, epoch).isComet).toBe(true);
  expect(() => orbitFromVelocity(NaN, 0, 0, epoch)).toThrow();
});
it('validates schema bounds and reads missing-version legacy documents', () => {
  const d = { ownerUid: 'a', type: 'planet', nameKey: 'quiet-aurora', params: { size: 0.4, palette: 0, oceans: 0.5 }, orbit: orbitFromSwipe(200, 0, 0.3, epoch), status: 'active', season: SEASON };
  expect(readObject(d)?.schemaVersion).toBe(1);
  expect(readObject({ ...d, schemaVersion: 2 })).toBeNull();
  expect(readObject({ ...d, nameKey: 'free text' })).toBeNull();
  expect(validParams({ ...d.params, palette: 4 })).toBe(false);
  expect(validParams({ ...d.params, text: 'x' })).toBe(false);
  expect(validOrbit({ ...d.orbit, a: Infinity })).toBe(false);
});
