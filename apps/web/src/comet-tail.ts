import { starPosition, worldPosition } from '@little-galaxy/shared';
import type { RenderObject } from '@little-galaxy/shared';
/** Place each existing tail instance radially away from its host star. */
export function cometTailPosition(object: RenderObject, time: number, distance: number): [number, number, number] {
  const position = worldPosition(object, time);
  const star = starPosition(object.hostOrbit?.hostId ?? object.orbit.hostId);
  const radial = position.map((value, index) => value - star[index]);
  const radius = Math.hypot(...radial) || 1;
  return position.map((value, index) => value + radial[index] / radius * distance) as [number, number, number];
}
