import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute } from 'three';
import type { Mesh } from 'three';
import { orbitalPeriod, palette, positionAt } from '@little-galaxy/shared';
import type { RenderObject } from '@little-galaxy/shared';
function Body({ object }: { object: RenderObject }) {
  const mesh = useRef<Mesh>(null);
  const trail = useMemo(() => {
    const points: number[] = [];
    for (let i = 0; i <= 120; i++) points.push(...positionAt(object.orbit, object.orbit.epoch + i / 120 * orbitalPeriod(object.orbit) * 1000));
    return new BufferGeometry().setAttribute('position', new Float32BufferAttribute(points, 3));
  }, [object.orbit]);
  useEffect(() => () => trail.dispose(), [trail]);
  useFrame(() => { mesh.current?.position.set(...positionAt(object.orbit, Date.now())); });
  return <><lineLoop geometry={trail}><lineBasicMaterial color={object.orbit.isComet ? '#d5b675' : '#426681'} transparent opacity={0.45}/></lineLoop>
    <mesh ref={mesh}><sphereGeometry args={[object.params.size, 16, 12]}/><meshStandardMaterial color={palette[object.params.palette]} roughness={0.6}/>
      {object.orbit.isComet && <mesh position={[-0.6, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.18, 1.6, 12]}/><meshBasicMaterial color="#d5b675" transparent opacity={0.45}/></mesh>}
    </mesh></>;
}
function FitChart({ objects }: { objects: RenderObject[] }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const radius = Math.max(9, ...objects.map((object) => object.orbit.a * (1 + object.orbit.e)));
    const distance = radius * 1.9 * Math.max(1, size.height / size.width);
    camera.position.set(0, -distance * 0.4, distance); camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, objects, size]);
  return null;
}
function Star() {
  return <><pointLight intensity={140} decay={1.5} color="#fff0c3"/>
    <mesh><sphereGeometry args={[1, 32, 24]}/><meshBasicMaterial color="#fff0c3"/></mesh>
    {[1.15, 1.4, 1.8, 2.4].map((radius, i) => <mesh key={radius}><sphereGeometry args={[radius, 24, 16]}/><meshBasicMaterial color="#ffd482" blending={AdditiveBlending} transparent opacity={0.09 / (i + 1)} depthWrite={false}/></mesh>)}
  </>;
}
export default function GalaxyScene({ objects, label, unavailable }: { objects: RenderObject[]; label: string; unavailable: string }) {
  return <Canvas dpr={[1, 1.5]} camera={{ position: [0, -12, 25], fov: 60, far: 200 }} onCreated={({ camera, gl }) => {
    camera.lookAt(0, 0, 0); gl.domElement.setAttribute('role', 'img'); gl.domElement.setAttribute('aria-label', label);
  }} fallback={<p className="scene-message">{unavailable}</p>}>
    <color attach="background" args={['#050c16']}/><ambientLight intensity={0.6}/><Star/><FitChart objects={objects}/>
    {objects.map((object) => <Body key={object.id} object={object}/>)}
  </Canvas>;
}
