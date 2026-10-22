import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import type { RenderObject } from '@little-galaxy/shared';
import { orbitFromVelocity } from '@little-galaxy/shared';
import type { Draft } from './galaxy-data';
import RichBodies from './RichBodies';
export default function ObjectPreview({
  draft,
  identity,
  departed,
}: {
  draft: Draft;
  identity: string;
  departed: RenderObject[];
}) {
  const objects = useMemo(
    () => [
      {
        id: identity,
        type: draft.type ?? 'planet',
        nameKey: draft.nameKey,
        params: draft.params,
        orbit: orbitFromVelocity(0, 2.58, 0, 0),
      },
    ],
    [draft, identity],
  );
  return (
    <Canvas dpr={1} camera={{ position: [0, 0, 5], fov: 48 }}>
      <color attach="background" args={['#050c16']} />
      <RichBodies objects={objects} departed={departed} preview />
    </Canvas>
  );
}
