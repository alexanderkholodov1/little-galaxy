import { Vector3 } from 'three';
import type { Mesh } from 'three';
const radial = new Vector3();
/** The child cone lies along local +y, away from the central star. */
export function orientComet(body: Mesh) {
  body.quaternion.setFromUnitVectors(body.up, radial.copy(body.position).normalize());
}
