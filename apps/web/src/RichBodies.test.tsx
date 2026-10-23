import { act, useLayoutEffect } from 'react';
import type { ReactElement, RefObject } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IcosahedronGeometry, InstancedMesh, PerspectiveCamera, Raycaster, RingGeometry, SphereGeometry, Vector3 } from 'three';
import type { BufferGeometry, ShaderMaterial } from 'three';
import type { RootState, ThreeEvent } from '@react-three/fiber';
import { syntheticObjects, worldPosition } from '@little-galaxy/shared';
import RichBodies from './RichBodies';
const frame = vi.hoisted(() => ({ current: undefined as undefined | ((state: RootState) => void) }));
vi.mock('@react-three/fiber', () => ({ useFrame: (callback: typeof frame.current) => { frame.current = callback; } }));
type MeshProps = { ref: RefObject<InstancedMesh | null>; material: ShaderMaterial; onClick?: (event: ThreeEvent<MouseEvent>) => void;
  children: ReactElement<{ args: number[] }>; };
let container: HTMLDivElement, root: ReturnType<typeof createRoot>;
let batches: { mesh: InstancedMesh; pick: MeshProps['onClick'] }[];
const camera = new PerspectiveCamera();
function Harness(props: Parameters<typeof RichBodies>[0]) {
  // Run the production hooks/frame loop; replace only the R3F host with real CPU Three meshes.
  const tree = RichBodies(props);
  useLayoutEffect(() => {
    for (const [i, child] of (tree.props.children as ReactElement<MeshProps>[]).entries()) {
      const p = child.props;
      if (p.ref.current) continue;
      const geometry: BufferGeometry = i === 2
        ? new RingGeometry(...p.children.props.args as [number, number, number])
        : i === 4 ? new IcosahedronGeometry(...p.children.props.args as [number, number])
        : new SphereGeometry(...p.children.props.args as [number, number, number]);
      const mesh = new InstancedMesh(geometry, p.material, 8000);
      p.ref.current = mesh;
      batches.push({ mesh, pick: p.onClick });
    }
  }, [tree]);
  return null;
}
function step() { frame.current!({ camera, clock: { elapsedTime: 0 } } as RootState); }
function tap(x: number, y = 0, z = 0) {
  const ray = new Raycaster(new Vector3(x, y, z + 10), new Vector3(0, 0, -1));
  const hits = ray.intersectObjects(batches.map((b) => b.mesh));
  const hit = hits.find((h) => batches.find((b) => b.mesh === h.object)?.pick);
  if (hit) batches.find((b) => b.mesh === hit.object)!.pick!({ ...hit, stopPropagation() {} } as ThreeEvent<MouseEvent>);
  return hits;
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(Date, 'now').mockReturnValue(10000);
  batches = []; camera.position.set(0, 0, 10);
  container = document.createElement('div'); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  for (const { mesh } of batches) mesh.geometry.dispose();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});
it('picks the enlarged phone preview outside its previously cached sphere', async () => {
  const object = { ...syntheticObjects(2)[1], params: { size: .4, oceans: 0, palette: 0 } }, onPick = vi.fn();
  await act(async () => root.render(<Harness objects={[object]} preview onPick={onPick} />));
  step(); tap(0); expect(onPick).toHaveBeenLastCalledWith(object.id); onPick.mockClear();
  await act(async () => root.render(<Harness objects={[{ ...object, params: { ...object.params, size: .7 } }]} preview onPick={onPick} />));
  step(); tap(1.8);
  expect(onPick).toHaveBeenCalledWith(object.id);
});
it('picks a moved screen body outside its earlier bounds', async () => {
  const original = syntheticObjects(2)[1], onPick = vi.fn();
  const moved = { ...original, orbit: { ...original.orbit, a: 18 } };
  await act(async () => root.render(<Harness objects={[original]} onPick={onPick} />));
  step(); tap(0); // Establish all bounds, including the empty far batch.
  await act(async () => root.render(<Harness objects={[moved]} onPick={onPick} />));
  step();
  const pos = worldPosition(moved, Date.now()); tap(...pos);
  expect(onPick).toHaveBeenCalledWith(moved.id);
});
it('picks a new screen instance in a batch previously raycast while empty', async () => {
  const original = syntheticObjects(2)[1], onPick = vi.fn();
  await act(async () => root.render(<Harness objects={[original]} onPick={onPick} />));
  step(); tap(0); onPick.mockClear();
  const arrival = { ...original, id: 'arriving-body', orbit: { ...original.orbit, a: 45 } };
  await act(async () => root.render(<Harness objects={[original, arrival]} onPick={onPick} />));
  vi.mocked(Date.now).mockReturnValue(11300); step();
  tap(...worldPosition(arrival, Date.now()));
  expect(onPick).toHaveBeenCalledWith(arrival.id);
});
