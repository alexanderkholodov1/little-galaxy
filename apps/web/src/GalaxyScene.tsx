import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import OrbitTrails from './OrbitTrails';
import { chartFrame } from './chart-fit';
import { worldPosition } from '@little-galaxy/shared';
import type { RenderObject, SoundCandidate } from '@little-galaxy/shared';
import { Vector3 } from 'three';
import RichBodies from './RichBodies';
function savedCameraPosition(): [number, number, number] {
  try {
    const raw = localStorage.getItem('galaxy.screen.camera');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === 3 && parsed.every(Number.isFinite)) {
        return parsed as [number, number, number];
      }
    }
  } catch { /* Storage optional. */ }
  return [0, -12, 25];
}

function savedCameraLook(): [number, number, number] {
  try {
    const raw = localStorage.getItem('galaxy.screen.look');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === 3 && parsed.every(Number.isFinite)) {
        return parsed as [number, number, number];
      }
    }
  } catch { /* Storage optional. */ }
  return [0, 0, 0];
}

function FitChart({ objects, focused, cinematic, historicalAt, ready }: { objects: RenderObject[]; focused?: string; cinematic?: boolean; historicalAt?: number; ready: boolean }) {
  const { camera, size } = useThree();
  const object = useMemo(() => objects.find((o) => o.id === focused), [objects, focused]);
  const chart = useMemo(() => chartFrame(objects), [objects]);
  const initialCam = useMemo(() => savedCameraPosition(), []);
  const initialLook = useMemo(() => savedCameraLook(), []);
  const points = useMemo(() => ({ position: new Vector3(), target: new Vector3(...initialCam), look: new Vector3(...initialLook) }), [initialCam, initialLook]);
  const reduced = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);
  const lastSave = useRef(0);
  const phase = useRef((() => { try { return Number(localStorage.getItem('galaxy.screen.phase')) || 0; } catch { return 0; } })());

  useEffect(() => {
    const saveState = () => {
      try {
        localStorage.setItem('galaxy.screen.phase', String(phase.current));
        localStorage.setItem('galaxy.screen.camera', JSON.stringify([camera.position.x, camera.position.y, camera.position.z]));
        localStorage.setItem('galaxy.screen.look', JSON.stringify([points.look.x, points.look.y, points.look.z]));
      } catch { /* Storage optional. */ }
    };
    window.addEventListener('galaxy:save-state', saveState);
    window.addEventListener('beforeunload', saveState);
    return () => {
      window.removeEventListener('galaxy:save-state', saveState);
      window.removeEventListener('beforeunload', saveState);
    };
  }, [camera, points.look]);

  useFrame(({ clock }, delta) => {
    if (!ready) return;
    const position = points.position;
    if (cinematic && !reduced) phase.current += delta * .035;
    if (object) {
      position.set(...worldPosition(object, historicalAt ?? Date.now()));
      const distance = Math.max(4, object.params.size * 9) * Math.max(1, size.height / size.width);
      points.target.set(position.x, position.y - distance * .3, position.z + distance);
    } else {
      position.set(...chart.center);
      const distance = chart.radius * 1.8 * Math.max(1, size.height / size.width);
      const angle = cinematic && !reduced ? phase.current : 0;
      points.target.set(position.x + Math.sin(angle) * distance * .6, position.y - distance * .4, position.z + Math.cos(angle) * distance);
    }
    const blend = reduced ? 1 : 1 - Math.exp(-delta * 2);
    camera.position.lerp(points.target, blend);
    points.look.lerp(position, blend);
    camera.lookAt(points.look);
    if (clock.elapsedTime - lastSave.current > 0.5) {
      lastSave.current = clock.elapsedTime;
      try {
        localStorage.setItem('galaxy.screen.phase', String(phase.current));
        localStorage.setItem('galaxy.screen.camera', JSON.stringify([camera.position.x, camera.position.y, camera.position.z]));
        localStorage.setItem('galaxy.screen.look', JSON.stringify([points.look.x, points.look.y, points.look.z]));
      } catch { /* Storage optional. */ }
    }
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
  focused, pet, onPick, onSoundCandidates, cinematic, historicalAt, departed, births, ready = true,
}: {
  objects: RenderObject[];
  ready?: boolean;
  label: string;
  unavailable: string;
  onFps?: (fps: number) => void;
  focused?: string;
  historicalAt?: number;
  departed?: RenderObject[];
  births?: Map<string, number>;
  cinematic?: boolean;
  pet?: { id: string; at: number };
  onPick?: (id: string) => void;
  onSoundCandidates?: (objects: RenderObject[], candidates: SoundCandidate[]) => void;
}) {
  const initialCam = useMemo(() => savedCameraPosition(), []);
  const initialLook = useMemo(() => savedCameraLook(), []);
  return (
    <Canvas
      dpr={1}
      camera={{ position: initialCam, fov: 60, far: 1000 }}
      onCreated={({ camera, gl }) => {
        camera.lookAt(...initialLook);
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
      <OrbitTrails objects={objects} historicalAt={historicalAt} />
      <RichBodies objects={objects} pet={pet} onPick={onPick} historicalAt={historicalAt} departed={departed} births={births} />
      <FitChart ready={ready} objects={objects} focused={focused} cinematic={cinematic} historicalAt={historicalAt} />
      <SoundSelection objects={objects} focused={focused} pet={pet} onUpdate={onSoundCandidates} />
      <Meter onFps={onFps} />
    </Canvas>
  );
}
