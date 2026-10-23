import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import OrbitTrails from './OrbitTrails';
import { chartFrame } from './chart-fit';
import { worldPosition } from '@little-galaxy/shared';
import type { RenderObject, SoundCandidate } from '@little-galaxy/shared';
import { Vector3 } from 'three';
import RichBodies from './RichBodies';
function FitChart({ objects, focused }: { objects: RenderObject[]; focused?: string }) {
  const { camera, size } = useThree();
  const object = useMemo(() => objects.find((o) => o.id === focused), [objects, focused]);
  const points = useMemo(() => ({ position: new Vector3(), target: new Vector3() }), []);
  useEffect(() => {
    if (focused) return;
    const { radius, center } = chartFrame(objects);
    const distance = radius * 1.8 * Math.max(1, size.height / size.width);
    camera.position.set(center[0], center[1] - distance * .4, center[2] + distance);
    camera.lookAt(...center);
    camera.updateProjectionMatrix();
  }, [camera, objects, size, focused]);
  useFrame((_, delta) => {
    if (!object) return;
    const pos = points.position.set(...worldPosition(object, Date.now()));
    const distance = Math.max(4, object.params.size * 9) * Math.max(1, size.height / size.width);
    points.target.set(pos.x, pos.y - distance * .3, pos.z + distance);
    camera.position.lerp(points.target, 1 - Math.exp(-delta * 5));
    camera.lookAt(pos);
  });
  return null;
}
function SoundSelection({ objects, focused, pet, onUpdate }: {
  objects: RenderObject[]; focused?: string; pet?: { id: string; at: number };
  onUpdate?: (objects: RenderObject[], candidates: SoundCandidate[]) => void;
}) {
  const last = useRef(-1), births = useRef(new Map<string, number>());
  const point = useMemo(() => new Vector3(), []);
  useFrame(({ camera, clock }) => {
    if (clock.elapsedTime - last.current < 0.5) return;
    last.current = clock.elapsedTime;
    const now = Date.now();
    const ids = new Set(objects.map((o) => o.id));
    for (const id of births.current.keys()) if (!ids.has(id)) births.current.delete(id);
    const candidates = objects.map((o) => {
      if (!births.current.has(o.id)) births.current.set(o.id, now);
      point.set(...worldPosition(o, now));
      const distance = point.distanceTo(camera.position);
      point.project(camera);
      return { id: o.id, distance, visible: Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1 && point.z >= -1 && point.z <= 1,
        focused: o.id === focused, newUntil: births.current.get(o.id)! + 6000,
        pettedUntil: pet?.id === o.id ? pet.at + 3000 : 0 };
    });
    onUpdate?.(objects, candidates);
  });
  useEffect(() => () => onUpdate?.([], []), [onUpdate]);
  return null;
}
function Meter({ onFps }: { onFps?: (fps: number) => void }) {
  const sample = useRef({ time: 0, frames: 0 });
  useFrame(({ clock, gl }) => {
    sample.current.frames++;
    const elapsed = clock.elapsedTime - sample.current.time;
    if (elapsed >= 1) {
      onFps?.(sample.current.frames / elapsed);
      gl.domElement.dataset.drawCalls = String(gl.info.render.calls);
      sample.current.time = clock.elapsedTime; sample.current.frames = 0;
    }
  });
  return null;
}
export default function GalaxyScene({
  objects,
  label,
  unavailable,
  onFps,
  focused, pet, onPick, onSoundCandidates,
}: {
  objects: RenderObject[];
  label: string;
  unavailable: string;
  onFps?: (fps: number) => void;
  focused?: string;
  pet?: { id: string; at: number };
  onPick?: (id: string) => void;
  onSoundCandidates?: (objects: RenderObject[], candidates: SoundCandidate[]) => void;
}) {
  return (
    <Canvas
      dpr={1}
      camera={{ position: [0, -12, 25], fov: 60, far: 1000 }}
      onCreated={({ camera, gl }) => {
        camera.lookAt(0, 0, 0);
        gl.domElement.setAttribute('role', 'img');
        gl.domElement.setAttribute('aria-label', label);
      }}
      fallback={<p className="scene-message">{unavailable}</p>}
    >
      <color attach="background" args={['#050c16']} />
      <mesh>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial color="#fff0c3" />
      </mesh>
      <OrbitTrails objects={objects} />
      <RichBodies objects={objects} pet={pet} onPick={onPick} />
      <FitChart objects={objects} focused={focused} />
      <SoundSelection objects={objects} focused={focused} pet={pet} onUpdate={onSoundCandidates} />
      <Meter onFps={onFps} />
    </Canvas>
  );
}
