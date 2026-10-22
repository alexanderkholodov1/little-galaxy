/** Display units: distances in stellar radii, time in seconds, epoch in Unix milliseconds. */
export const GRAVITY = 40;
export const LAUNCH_RADIUS = 6;
export const STAR_RADIUS = 1;
export interface Orbit {
  hostId: 'central'; a: number; e: number; inclination: number; omega: number;
  meanAnomaly: number; epoch: number; direction: 1 | -1; isComet: boolean;
}
const TAU = Math.PI * 2;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export function orbitalPeriod(orbit: Orbit): number { return TAU * Math.sqrt(orbit.a ** 3 / GRAVITY); }
export function positionAt(orbit: Orbit, time: number): [number, number, number] {
  const mean = ((orbit.meanAnomaly + (time - orbit.epoch) / 1000 * Math.sqrt(GRAVITY / orbit.a ** 3)) % TAU + TAU) % TAU;
  let eccentric = mean;
  for (let i = 0; i < 16; i++) eccentric -= (eccentric - orbit.e * Math.sin(eccentric) - mean) / (1 - orbit.e * Math.cos(eccentric));
  const x = orbit.a * (Math.cos(eccentric) - orbit.e);
  const y = orbit.a * Math.sqrt(1 - orbit.e ** 2) * Math.sin(eccentric);
  const px = x * Math.cos(orbit.omega) - y * Math.sin(orbit.omega);
  const py = (x * Math.sin(orbit.omega) + y * Math.cos(orbit.omega)) * orbit.direction;
  return [px, py * Math.cos(orbit.inclination), py * Math.sin(orbit.inclination)];
}
/** Analytic energy/angular-momentum conversion in the launch plane, then readable element bounds. */
export function orbitFromVelocity(radial: number, tangent: number, inclination: number, epoch: number): Orbit {
  if (![radial, tangent, inclination, epoch].every(Number.isFinite)) throw new Error('Finite launch values required');
  const r = LAUNCH_RADIUS;
  const speed = Math.abs(tangent);
  const energy = (radial ** 2 + speed ** 2) / 2 - GRAVITY / r;
  const ex = r * speed ** 2 / GRAVITY - 1;
  const ey = -r * radial * speed / GRAVITY;
  const rawE = Math.hypot(ex, ey);
  const rawA = -GRAVITY / (2 * energy);
  const isComet = energy >= 0 || rawA * (1 - rawE) <= STAR_RADIUS || !Number.isFinite(rawA);
  let e = clamp(rawE, 0, 0.7);
  let omega = rawE < 1e-10 ? 0 : Math.atan2(ey, ex);
  let anomaly = -omega;
  let a = r * (1 + e * Math.cos(anomaly)) / (1 - e ** 2);
  if (isComet) {
    e = 0.75; a = 12;
    const eccentric = Math.acos((1 - r / a) / e);
    anomaly = Math.atan2(Math.sqrt(1 - e ** 2) * Math.sin(eccentric), Math.cos(eccentric) - e);
    omega = -anomaly;
  }
  const eccentric = Math.atan2(Math.sqrt(1 - e ** 2) * Math.sin(anomaly), e + Math.cos(anomaly));
  return { hostId: 'central', a, e, inclination: clamp(inclination, -0.35, 0.35), omega,
    meanAnomaly: eccentric - e * Math.sin(eccentric), epoch, direction: tangent < 0 ? -1 : 1, isComet };
}
/** Pixels and seconds. A normal flick adds tangential motion in every direction;
 * speed sets energy, vertical motion tilts the plane and adds a small radial component.
 * Stalls and clearly extreme flicks retain the physical fall/escape comet path. */
export function orbitFromSwipe(dx: number, dy: number, seconds: number, epoch: number): Orbit {
  if (![dx, dy, seconds, epoch].every(Number.isFinite)) throw new Error('Finite launch values required');
  const length = Math.hypot(dx, dy);
  const speed = length / Math.max(0.05, seconds);
  const circular = Math.sqrt(GRAVITY / LAUNCH_RADIUS);
  const inclination = clamp(dy / 900, -0.35, 0.35);
  if (speed < 80 - 1e-9 || speed > 3500 + 1e-9) return orbitFromVelocity(0, speed < 80 ? 0 : circular * 2, inclination, epoch);
  return orbitFromVelocity(-dy / length * circular * 0.1,
    (dx < 0 ? -1 : 1) * circular * (0.6 + 0.7 * Math.min(speed / 3000, 1)), inclination, epoch);
}
