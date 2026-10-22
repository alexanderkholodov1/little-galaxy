import { expect, it } from 'vitest';
import { orbitFromSwipe } from '@little-galaxy/shared';
import type { RenderObject } from '@little-galaxy/shared';
import { chartRadius } from './chart-fit';
const body: RenderObject = { id: 'one', nameKey: 'quiet-aurora', params: { size: 0.4, palette: 0, oceans: 0.5 }, orbit: orbitFromSwipe(250, 0, 0.3, 0) };
it('caps the actual camera fit for outliers and ignores invalid extents', () => {
  expect(chartRadius([])).toBe(9);
  const extreme = { ...body, orbit: { ...body.orbit, a: 1000, e: 0.99 } };
  expect(chartRadius([body, extreme])).toBe(72);
  expect(chartRadius([{ ...body, orbit: { ...body.orbit, a: NaN } }])).toBe(9);
  expect(chartRadius(Array.from({ length: 10000 }, () => extreme))).toBe(72);
});

it('fits hosted planets and moons using bounded parent paths and fixed visitor star positions', () => {
  const star = { ...body, id: 'visitor-star', type: 'star' as const };
  const planet = { ...body, orbit: { ...body.orbit, hostId: star.id } };
  const moon = { ...body, type: 'moon' as const, hostOrbit: planet.orbit, orbit: { ...body.orbit, hostId: 'planet' } };
  expect(chartRadius([star, planet, moon])).toBeGreaterThan(chartRadius([body]));
  expect(chartRadius([star, planet, moon])).toBeLessThanOrEqual(72);
  expect(chartRadius([{ ...moon, hostOrbit: { ...planet.orbit, a: 10000 } }])).toBe(72);
});
