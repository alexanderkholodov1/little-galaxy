import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import OrbitTrails from './OrbitTrails';
import { chartFrame } from './chart-fit';
import { worldPosition } from '@little-galaxy/shared';
import type { RenderObject, SoundCandidate } from '@little-galaxy/shared';
import { Vector3 } from 'three';
import RichBodies from './RichBodies';
function FitChart({ objects, focused, cinematic }: { objects: RenderObject[]; focused?: string; cinematic?: boolean }) {
  const { camera, size } = useThree();
  const object = useMemo(() => objects.find((o) => o.id === focused), [objects, focused]);
  const chart = useMemo(() => chartFrame(objects), [objects]);
  const points = useMemo(() => ({ position: new Vector3(), target: new Vector3(), look: new Vector3() }), []);
  const reduced = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);
  useFrame(({ clock }, delta) => {
    const position = points.position;
    if (object) {
      position.set(...worldPosition(object, Date.now()));
      const distance = Math.max(4, object.params.size * 9) * Math.max(1, size.height / size.width);
      points.target.set(position.x, position.y - distance * .3, position.z + distance);
    } else {
      position.set(...chart.center);
      const distance = chart.radius * 1.8 * Math.max(1, size.height / size.width);
      const angle = cinematic && !reduced ? clock.elapsedTime * .035 : 0;
      points.target.set(position.x + Math.sin(angle) * distance * .6, position.y - distance * .4, position.z + Math.cos(angle) * distance);
    }
    const blend = reduced ? 1 : 1 - Math.exp(-delta * 2);
    camera.position.lerp(points.target, blend);
    points.look.lerp(position, blend);
    camera.lookAt(points.look);
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
  focused, pet, onPick, onSoundCandidates, cinematic,
}: {
  objects: RenderObject[];
  label: string;
  unavailable: string;
  onFps?: (fps: number) => void;
  focused?: string;
  cinematic?: boolean;
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
      <FitChart objects={objects} focused={focused} cinematic={cinematic} />
      <SoundSelection objects={objects} focused={focused} pet={pet} onUpdate={onSoundCandidates} />
      <Meter onFps={onFps} />
    </Canvas>
  );
}
