import { expect, it } from 'vitest';
import { orbitFromSwipe, starPosition, worldPosition } from '@little-galaxy/shared';
import type { RenderObject } from '@little-galaxy/shared';
import { cometTailPosition } from './comet-tail';
it('points existing tail instances away from central and visitor stars, including moons', () => {
  const body: RenderObject = { id: 'one', nameKey: 'quiet-aurora', params: { size: 0.4, palette: 0, oceans: 0.5 }, orbit: orbitFromSwipe(1000, 0, 0.1, 0) };
  for (const object of [body, { ...body, orbit: { ...body.orbit, hostId: 'visitor-star' } },
    { ...body, type: 'moon' as const, hostOrbit: { ...body.orbit, hostId: 'visitor-star' } }]) {
    for (const time of [0, 1000, 20000]) {
      const start = worldPosition(object, time);
      const end = cometTailPosition(object, time, 2);
      const star = starPosition(object.hostOrbit?.hostId ?? object.orbit.hostId);
      expect(Math.hypot(...end.map((v, i) => v - start[i]))).toBeCloseTo(2);
      expect(Math.hypot(...end.map((v, i) => v - star[i]))).toBeCloseTo(Math.hypot(...start.map((v, i) => v - star[i])) + 2);
    }
  }
});
