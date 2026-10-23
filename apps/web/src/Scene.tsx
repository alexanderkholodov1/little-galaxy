import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';

function ReferenceStars() {
  const positions = useMemo(() => {
    const values = new Float32Array(120 * 3);
    for (let index = 0; index < 120; index++) {
      // A repeatable reference field, not visitor objects or a live galaxy snapshot.
      values[index * 3] = Math.sin(index * 127.1) * 9;
      values[index * 3 + 1] = Math.cos(index * 311.7) * 5;
      values[index * 3 + 2] = -2 - (index % 9);
    }
    return values;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#c4d9ea" size={0.025} sizeAttenuation />
    </points>
  );
}

export default function Scene({ unavailable, label }: { unavailable: string; label: string }) {
  const fallback = <p className="scene-message">{unavailable}</p>;
  return (
    <Canvas onCreated={({ gl }) => {
      gl.domElement.setAttribute('role', 'img');
      gl.domElement.setAttribute('aria-label', label);
    }} frameloop="demand" dpr={[1, 1.5]} camera={{ position: [0, 0, 5] }} fallback={fallback}>
      <color attach="background" args={['#050c16']} />
      <ReferenceStars />
    </Canvas>
  );
}
