/** Two acceleration peaks within 800ms reject an isolated bump. Gravity is removed by differences. */
export class ShakeDetector {
  private previous?: [number, number, number];
  private peak = -Infinity;
  private last = -Infinity;
  sample(x: number | null, y: number | null, z: number | null, at: number) {
    if (![x, y, z].every((n) => typeof n === 'number' && Number.isFinite(n))) return false;
    const values: [number, number, number] = [x!, y!, z!];
    const change = this.previous ? Math.hypot(...values.map((n, i) => n - this.previous![i])) : 0;
    this.previous = values;
    if (change < 16 || at - this.last < 10_000 || at - this.peak < 100) return false;
    if (at - this.peak <= 800) { this.last = at; this.peak = -Infinity; return true; }
    this.peak = at;
    return false;
  }
}
/** Called from a trusted tap. A denial never prevents use of the visible manual wave control. */
export async function enableMotion(onShake: () => void, onUnavailable: () => void): Promise<() => void> {
  const motion = window.DeviceMotionEvent as (typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> }) | undefined;
  if (!motion || !window.isSecureContext) { onUnavailable(); return () => {}; }
  if (motion.requestPermission && await motion.requestPermission() !== 'granted') { onUnavailable(); return () => {}; }
  const detector = new ShakeDetector();
  let detected = false;
  const listener = (event: DeviceMotionEvent) => {
    const a = event.accelerationIncludingGravity ?? event.acceleration;
    if (!a || ![a.x, a.y, a.z].every((n) => typeof n === 'number' && Number.isFinite(n))) return;
    detected = true;
    if (document.visibilityState !== 'hidden' && detector.sample(a.x, a.y, a.z, performance.now())) onShake();
  };
  window.addEventListener('devicemotion', listener);
  const timer = window.setTimeout(() => { if (!detected) onUnavailable(); }, 4000);
  return () => { clearTimeout(timer); window.removeEventListener('devicemotion', listener); };
}
