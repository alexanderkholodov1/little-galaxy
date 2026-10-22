import { starPosition } from '@little-galaxy/shared';
import type { RenderObject } from '@little-galaxy/shared';
/** Account for fixed visitor stars and scaled moon paths, while capping the shared chart. */
export function chartRadius(objects: RenderObject[]): number {
  return objects.reduce((radius, object) => {
    const parent = object.hostOrbit;
    const origin = starPosition(object.type === 'star' ? object.id : parent?.hostId ?? object.orbit.hostId);
    const path = object.type === 'star' ? object.params.size :
      object.orbit.a * (1 + object.orbit.e) * (parent ? 0.2 : 1) + (parent ? parent.a * (1 + parent.e) : 0);
    const extent = Math.hypot(...origin) + path;
    return Number.isFinite(extent) ? Math.max(radius, Math.min(72, extent)) : radius;
  }, 9);
}
