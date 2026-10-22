import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { worldPosition } from '@little-galaxy/shared';
import type { RenderObject } from '@little-galaxy/shared';
import RichBodies from './RichBodies';
function FitChart({ objects }: { objects: RenderObject[] }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const radius = Math.max(
      9,
      ...objects.map((o) => Math.hypot(...worldPosition(o, Date.now())) + o.orbit.a),
    );
    const distance = radius * 1.8 * Math.max(1, size.height / size.width);
    camera.position.set(0, -distance * 0.4, distance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, objects, size]);
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
      sample.current = { time: clock.elapsedTime, frames: 0 };
    }
  });
  return null;
}
export default function GalaxyScene({
  objects,
  label,
  unavailable,
  onFps,
}: {
  objects: RenderObject[];
  label: string;
  unavailable: string;
  onFps?: (fps: number) => void;
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
      <RichBodies objects={objects} />
      <FitChart objects={objects} />
      <Meter onFps={onFps} />
    </Canvas>
  );
}
