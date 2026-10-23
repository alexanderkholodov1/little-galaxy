import type { RenderObject } from '@little-galaxy/shared';
/** Keep an outlier from shrinking the shared sky. Outer paths may extend beyond the chart. */
export function chartRadius(objects: RenderObject[]): number {
  return objects.reduce((radius, object) => {
    const extent = object.orbit.a * (1 + object.orbit.e);
    return Number.isFinite(extent) ? Math.max(radius, Math.min(21, extent)) : radius;
  }, 9);
}
