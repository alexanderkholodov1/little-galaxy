import { expect, it } from 'vitest';
import { Mesh, Vector3 } from 'three';
import { orientComet } from './comet-tail';
it('points the cone away from the star throughout the orbit without changing the body position', () => {
  for (const coordinates of [[6, 0, 0], [-5, 3, 1], [0, -4, -2]]) {
    const body = new Mesh(); body.position.set(...coordinates as [number, number, number]);
    orientComet(body);
    const tail = new Vector3(0, 0.8, 0).applyQuaternion(body.quaternion);
    expect(tail.clone().normalize().dot(body.position.clone().normalize())).toBeCloseTo(1);
    expect(body.position.toArray()).toEqual(coordinates);
  }
});
