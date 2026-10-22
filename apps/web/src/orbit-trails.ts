import { orbitalPeriod, positionAt, starPosition } from '@little-galaxy/shared';
import type { RenderObject } from '@little-galaxy/shared';
/** One merged static finding-chart layer; tiny moon tracks are omitted at exhibition LOD. */
export function orbitTrails(objects: RenderObject[], time: number): Float32Array {
  const segments = objects.length >= 200 ? 24 : 64;
  const paths = objects.filter((o) => o.type !== 'star' && (objects.length < 200 || !o.hostOrbit));
  const vertices = new Float32Array(paths.length * segments * 6);
  const p: [number, number, number] = [0, 0, 0], host: [number, number, number] = [0, 0, 0];
  let offset = 0;
  for (const o of paths) {
    const origin = starPosition(o.hostOrbit?.hostId ?? o.orbit.hostId);
    if (o.hostOrbit) positionAt(o.hostOrbit, time, host);
    const period = orbitalPeriod(o.orbit) * 1000;
    for (let i = 0; i < segments; i++) for (let endpoint = 0; endpoint < 2; endpoint++) {
      positionAt(o.orbit, time + period * (i + endpoint) / segments, p);
      for (let j = 0; j < 3; j++) vertices[offset++] = origin[j] + (o.hostOrbit ? host[j] + p[j] * .2 : p[j]);
    }
  }
  return vertices;
}
