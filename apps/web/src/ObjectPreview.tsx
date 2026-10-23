import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import type { PlanetParams, RenderObject, StarParams } from '@little-galaxy/shared';
import { orbitFromVelocity } from '@little-galaxy/shared';
import type { Draft } from './galaxy-data';
import RichBodies from './RichBodies';
// Keep the largest rings/corona inside a narrow phone specimen without shrinking
// the default planet. The screen has its own galaxy-wide camera fit.
function FitSpecimen({ draft }: { draft: Draft }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const p = draft.params;
    const shell =
      draft.type === 'star'
        ? 1.2 + (p as StarParams).corona * 0.7
        : (!draft.type || draft.type === 'planet') && (p as PlanetParams).rings
          ? 1.9
          : 1;
    const extent = p.size * 3 * shell;
    camera.position.set(
      0,
      0,
      Math.max(5, (extent * 1.15) / Math.tan((24 * Math.PI) / 180) / Math.min(1, size.width / size.height)),
    );
    camera.updateProjectionMatrix();
  }, [draft, camera, size]);
  return null;
}
function Capture({ ready }: { ready: (canvas: HTMLCanvasElement) => void }) {
  const frames = useRef(0);
  useFrame(({ gl, scene, camera }) => {
    gl.render(scene, camera);
    if (++frames.current === 4) {
      const copy = document.createElement('canvas');
      copy.width = gl.domElement.width; copy.height = gl.domElement.height;
      copy.getContext('2d')!.drawImage(gl.domElement, 0, 0);
      ready(copy);
    }
  }, 1);
  return null;
}
export default function ObjectPreview({
  draft,
  identity,
  departed,
  pet,
  onPet,
  onCapture,
}: {
  draft: Draft;
  onCapture?: (canvas: HTMLCanvasElement) => void;
  identity: string;
  departed: RenderObject[];
  pet?: { id: string; at: number };
  onPet?: (id: string) => void;
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
    <Canvas dpr={1} gl={{ preserveDrawingBuffer: !!onCapture }} camera={{ position: [0, 0, 5], fov: 48 }}>
      <FitSpecimen draft={draft} />
      {onCapture && <Capture ready={onCapture}/>}
      <color attach="background" args={['#050c16']} />
      <RichBodies objects={objects} departed={departed} preview pet={pet} onPick={onPet} />
    </Canvas>
  );
}
