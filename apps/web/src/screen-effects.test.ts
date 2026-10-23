import { expect, it } from 'vitest';
import { addEffects } from './screen-effects';
it('combines a crowd shake window into one stronger wave and bounds lifetime and density', () => {
  const shake = (id: number) => ({ id: `${id}`, type: 'shake', objectId: '', at: 1000, payload: {} });
  const first = addEffects([], Array.from({ length: 100 }, (_, i) => shake(i)), 1000);
  expect(first).toHaveLength(1); expect(first[0].strength).toBe(20);
  const later = addEffects(first, [shake(200)], 3000);
  expect(later).toHaveLength(2);
  expect(first[0].strength).toBe(20);
  const comets = Array.from({ length: 100 }, (_, i) => ({ ...shake(i), type: 'comet', payload: { dx: -.5, dy: .5 } }));
  expect(addEffects(later, comets, 4000)).toHaveLength(48);
  expect(addEffects(later, [], 10_000)).toEqual([]);
});
