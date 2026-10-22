import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry } from 'three';
import { positionAt } from '@little-galaxy/shared';
import type { RenderObject } from '@little-galaxy/shared';
import { orbitTrails } from './orbit-trails';
function makeLayer(objects: RenderObject[], time: number) {
    const segments = objects.length >= 200 ? 24 : 64;
    const attribute = new BufferAttribute(orbitTrails(objects, time), 3);
    const geometry = new BufferGeometry().setAttribute('position', attribute);
    let offset = 0;
    const moons: { orbit: NonNullable<RenderObject['hostOrbit']>; previous: [number, number, number]; range: { start: number; count: number } }[] = [];
    for (const o of objects) {
      if (o.type === 'star' || (objects.length >= 200 && o.hostOrbit)) continue;
      const start = offset; offset += segments * 6;
      if (o.hostOrbit) moons.push({ orbit: o.hostOrbit, previous: positionAt(o.hostOrbit, time), range: { start, count: segments * 6 } });
    }
    return { geometry, attribute, moons, point: [0, 0, 0] as [number, number, number] };
}
export default function OrbitTrails({ objects }: { objects: RenderObject[] }) {
  const layer = useMemo(() => makeLayer(objects, 0), [objects]);
  const layerRef = useRef(layer);
  useEffect(() => { layerRef.current = layer; }, [layer]);
  useEffect(() => () => layer.geometry.dispose(), [layer]);
  useFrame(() => advanceTrails(layerRef.current, Date.now()));
  return <lineSegments geometry={layer.geometry} frustumCulled={false}><lineBasicMaterial color="#7890aa" transparent opacity={.075} depthWrite={false}/></lineSegments>;
}

function advanceTrails(layer: ReturnType<typeof makeLayer>, now: number) {
    if (!layer.moons.length) return;
    layer.attribute.clearUpdateRanges();
    const array = layer.attribute.array, point = layer.point;
    for (const moon of layer.moons) {
      positionAt(moon.orbit, now, point);
      for (let i = moon.range.start; i < moon.range.start + moon.range.count; i += 3)
        for (let axis = 0; axis < 3; axis++) array[i + axis] += point[axis] - moon.previous[axis];
      moon.previous[0] = point[0]; moon.previous[1] = point[1]; moon.previous[2] = point[2];
      layer.attribute.updateRanges.push(moon.range);
    }
    layer.attribute.needsUpdate = true;
}
