import { starPosition } from '@little-galaxy/shared';
import type { RenderObject } from '@little-galaxy/shared';
function extent(object: RenderObject) {
  const parent = object.hostOrbit;
  return object.type === 'star' ? object.params.size :
    object.orbit.a * (1 + object.orbit.e) * (parent ? .2 : 1) + (parent ? parent.a * (1 + parent.e) : 0);
}
function percentile(values: number[], fraction: number) {
  const valid = values.filter(Number.isFinite).sort((a, b) => a - b);
  return Math.max(9, Math.min(72, valid[Math.floor((valid.length - 1) * fraction)] ?? 9));
}
/** At exhibition scale frame the busiest system; sparse outlying stars must not shrink every body. */
export function chartFrame(objects: RenderObject[]) {
  if (objects.length < 200) return { center: [0, 0, 0] as [number, number, number], radius: chartRadius(objects) };
  const groups = new Map<string, RenderObject[]>();
  groups.set('central', []);
  for (const o of objects) {
    const host = o.type === 'star' ? o.id : o.hostOrbit?.hostId ?? o.orbit.hostId;
    const group = groups.get(host) ?? [];
    group.push(o); groups.set(host, group);
  }
  let busiest = 'central';
  for (const [id, group] of groups) if (group.length > groups.get(busiest)!.length) busiest = id;
  return { center: starPosition(busiest), radius: percentile(groups.get(busiest)!.map(extent), .85) };
}
export function chartRadius(objects: RenderObject[]): number {
  return percentile(objects.map((o) => {
    const origin = starPosition(o.type === 'star' ? o.id : o.hostOrbit?.hostId ?? o.orbit.hostId);
    return Math.hypot(...origin) + extent(o);
  }), 1);
}
