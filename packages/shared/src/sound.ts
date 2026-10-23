import { planetDefaults } from './schema.js';
import type { MoonParams, ObjectParams, ObjectType, PlanetParams, StarParams } from './schema.js';

/** D minor pentatonic, shared by ambient tones and pets. MIDI pitch classes. */
export const SOUND_SCALE = [2, 5, 7, 9, 0] as const;
export const MAX_SOUND_VOICES = 8;
export interface SoundFingerprint {
  midi: number;
  petMidi: number;
  partials: number[];
  filterHz: number;
  chorus: number;
  shimmer: number;
  attack: number;
  release: number;
}
const notes = Array.from({ length: 4 }, (_, octave) =>
  SOUND_SCALE.map((pitch) => 36 + octave * 12 + (pitch === 0 ? 12 : pitch)),
).flat().sort((a, b) => a - b);
/** Pure mapping of validated params; legacy planets use the same defaults as their visual. */
export function soundFingerprint(type: ObjectType, params: ObjectParams): SoundFingerprint {
  const size = (params.size - 0.2) / 0.5;
  const midi = notes[Math.min(notes.length - 1, Math.max(0, Math.floor((1 - size) * notes.length)))];
  const common = { midi, petMidi: midi + 12, release: 0.6 + size * 0.8 };
  if (type === 'planet') {
    const p = planetDefaults(params as PlanetParams);
    return { ...common, partials: [1, 0.05 + p.mountains * 0.6, 0.02 + p.palette * 0.04, p.mountains * 0.2],
      filterHz: 650 + p.atmosphere * 500, chorus: p.oceans * 0.35, shimmer: p.rings * 0.28,
      attack: 0.35 + p.clouds * 0.7 };
  }
  if (type === 'star') {
    const p = params as StarParams;
    return { ...common, partials: [1, 0.15 + p.temperature * 0.45, 0.04, 0.08],
      filterHz: 850 + p.temperature * 2300, chorus: 0, shimmer: p.corona * 0.28, attack: 0.6 };
  }
  const p = params as MoonParams;
  return { ...common, partials: [1, p.craters * 0.4, 0.02, p.craters * 0.25],
    filterHz: 550 + p.colour * 400, chorus: 0, shimmer: 0.03, attack: 0.25 };
}
export function midiHz(midi: number) { return 440 * 2 ** ((midi - 69) / 12); }

export interface SoundCandidate {
  id: string;
  visible: boolean;
  distance: number;
  focused?: boolean;
  newUntil?: number;
  pettedUntil?: number;
}
/** Incumbents get a 10% relative-distance margin against orbit/frame jitter.
 * Interaction priority wins immediately; a substantially nearer peer replaces an incumbent. */
export function allocateVoices(candidates: SoundCandidate[], previous: string[], now: number): string[] {
  const retained = new Set(previous);
  return candidates.filter((c) => c.visible && Number.isFinite(c.distance) && c.distance >= 0)
    .map((c) => ({ id: c.id, priority: (c.focused ? 10000 : 0) + ((c.pettedUntil ?? 0) > now ? 20000 : 0)
      + ((c.newUntil ?? 0) > now ? 1000 : 0), distance: c.distance * (retained.has(c.id) ? .9 : 1) }))
    .sort((a, b) => b.priority - a.priority || a.distance - b.distance || a.id.localeCompare(b.id))
    .filter((c, i, all) => all.findIndex((v) => v.id === c.id) === i)
    .slice(0, MAX_SOUND_VOICES).map((c) => c.id);
}

/** Damped spring, volume-preserving stretch. Elapsed seconds; settled after ~1.5 s. */
export function petScale(elapsed: number, out: [number, number, number] = [1, 1, 1]): [number, number, number] {
  const y = elapsed < 0 || elapsed > 1.5 ? 1 : 1 - 0.22 * Math.exp(-elapsed * 4.5) * Math.cos(elapsed * 17);
  out[0] = out[2] = 1 / Math.sqrt(y);
  out[1] = y;
  return out;
}
