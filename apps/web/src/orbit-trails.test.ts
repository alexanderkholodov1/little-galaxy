import { expect, it } from 'vitest';
import { syntheticObjects } from '@little-galaxy/shared';
import { orbitTrails } from './orbit-trails';
it('merges closed orbit loops with bounded segment LOD for 500 objects', () => {
  const objects = syntheticObjects(500), data = orbitTrails(objects, 1000);
  const paths = objects.filter((o) => o.type !== 'star' && !o.hostOrbit).length;
  expect(data.length).toBe(paths * 24 * 6);
  expect(data.length).toBeLessThan(60000);
  expect([...data].every(Number.isFinite)).toBe(true);
  for (let path = 0; path < paths; path++) {
    const start = path * 24 * 6, end = start + 24 * 6 - 3;
    for (let axis = 0; axis < 3; axis++) expect(data[start + axis]).toBeCloseTo(data[end + axis], 4);
  }
  expect(orbitTrails(objects.slice(0, 10), 1000).length).toBe(9 * 64 * 6);
});
