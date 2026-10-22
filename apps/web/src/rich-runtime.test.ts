import { expect, it } from 'vitest';
import { InstancedBufferAttribute } from 'three';
import { syntheticObjects } from '@little-galaxy/shared';
import { BodyHistory, markLiveRange, RING_TILT, StarIndex } from './rich-runtime';
import type { Lamp, Point } from './rich-runtime';
it('starts 500 bodies at full size, tracks only arrivals, prunes births and keeps reconnects quiet', () => {
  const history = new BodyHistory(), objects = syntheticObjects(500);
  history.diff([], 0); history.diff(objects, 1);
  expect(history.births.size).toBe(0);
  history.diff([...objects], 2); expect(history.births.size).toBe(0);
  history.diff(objects.slice(0, 499), 3); history.diff(objects, 4);
  expect([...history.births.keys()]).toEqual([objects[499].id]);
  history.prune(1205); expect(history.births.size).toBe(0);
  history.diff(objects.slice(0, 499), 2000); history.diff(objects, 2001);
  history.diff([], 2002); expect(history.births.size).toBe(0);
  history.diff(objects, 2003); expect(history.births.size).toBe(0);
});
it('finds the exact nearest eligible star through spatial lookup', () => {
  const lamps: Lamp[] = Array.from({ length: 200 }, (_, i) => ({ id: String(i), position: [Math.sin(i) * 60, Math.cos(i) * 40, i % 7], colour: [1, 1, 1] }));
  const index = new StarIndex(lamps);
  for (let i = 0; i < 400; i++) {
    const p: Point = [Math.sin(i * .7) * 80, Math.cos(i * .4) * 50, i % 3];
    const distance = (lamp: Lamp) => lamp.position.reduce((sum, v, j) => sum + (v - p[j]) ** 2, 0);
    const expected = lamps.filter((l) => l.id !== String(i % 200)).sort((a, b) => distance(a) - distance(b))[0];
    expect(index.nearest(p, String(i % 200))).toBe(expected);
  }
  expect(new StarIndex([]).nearest([0, 0, 0], '')).toBeUndefined();
});
it('uploads only live instances and reuses the upload range object', () => {
  const attribute = new InstancedBufferAttribute(new Float32Array(8000 * 16), 16), range = { start: 0, count: 0 };
  markLiveRange(attribute, 500, range);
  expect(attribute.updateRanges).toEqual([{ start: 0, count: 8000 }]);
  attribute.clearUpdateRanges(); markLiveRange(attribute, 1, range);
  expect(attribute.updateRanges[0]).toBe(range); expect(range.count).toBe(16);
  attribute.clearUpdateRanges(); markLiveRange(attribute, 0, range); expect(attribute.updateRanges).toEqual([]);
  expect(RING_TILT).toBeGreaterThan(.7); expect(RING_TILT).toBeLessThan(1.4);
});
