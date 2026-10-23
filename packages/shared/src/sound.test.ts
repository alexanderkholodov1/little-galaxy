import { describe, expect, it } from 'vitest';
import { allocateVoices, midiHz, petScale, soundFingerprint, SOUND_SCALE } from './sound.js';
import { presets, validParams } from './schema.js';
import type { ObjectType } from './schema.js';
describe('sound mapping', () => {
  it('has no fingerprint collisions in 30,000 deterministic valid designs; every pitch is in the single scale', () => {
    let seed = 7;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    const seen = new Set<string>();
    for (let i = 0; i < 30000; i++) {
      const type: ObjectType = ['planet', 'star', 'moon'][i % 3] as ObjectType;
      const params = Object.fromEntries(Object.keys(presets[type][0]).map((k) => [k,
        k === 'size' ? 0.2 + random() * 0.5 : ['palette', 'atmosphere', 'colour'].includes(k) ? Math.floor(random() * 4) : random()]));
      expect(validParams(params, type, 2)).toBe(true);
      const fp = soundFingerprint(type, params as typeof presets.planet[0]);
      const key = JSON.stringify(fp);
      expect(key).toBe(JSON.stringify(soundFingerprint(type, params as typeof presets.planet[0])));
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      for (const note of [fp.midi, fp.petMidi]) {
        expect(SOUND_SCALE).toContain(note % 12);
        expect(midiHz(note)).toBeGreaterThan(0);
      }
    }
  });
  it('every individual visual control changes the actual audio parameters', () => {
    for (const type of ['planet', 'star', 'moon'] as const) {
      const p = presets[type][0], before = soundFingerprint(type, p);
      for (const key of Object.keys(p)) {
        const value = (p as unknown as Record<string, number>)[key];
        expect(soundFingerprint(type, { ...p, [key]: value + (['palette', 'atmosphere', 'colour'].includes(key) ? 1 : 0.01) })).not.toEqual(before);
      }
    }
    const a = soundFingerprint('planet', presets.planet[0]), b = soundFingerprint('planet', presets.planet[1]);
    expect(b.midi).toBeLessThan(a.midi);
    expect(b.shimmer).toBeGreaterThan(a.shimmer);
    expect(b.partials[1]).toBeGreaterThan(a.partials[1]);
    expect(soundFingerprint('star', presets.star[1]).filterHz).toBeGreaterThan(soundFingerprint('star', presets.star[0]).filterHz);
  });
});
describe('voice allocator', () => {
  const candidates = Array.from({ length: 50 }, (_, i) => ({ id: `object-${i.toString().padStart(2, '0')}`, visible: true, distance: 20 + i * 0.1 }));
  it('caps 50 objects at eight and is independent of input order', () => {
    const selected = allocateVoices(candidates, [], 0);
    expect(selected).toHaveLength(8);
    expect(allocateVoices([...candidates].reverse(), [], 0)).toEqual(selected);
  });
  it('does not thrash as distances jitter or a new object appears without priority', () => {
    let selected = allocateVoices(candidates, [], 0);
    const first = [...selected].sort();
    for (let frame = 0; frame < 500; frame++) {
      selected = allocateVoices(candidates.map((c, i) => ({ ...c, distance: c.distance + Math.sin(i + frame) })), selected, frame * 100);
      expect([...selected].sort()).toEqual(first);
    }
  });
  it('lets a substantially nearer eligible candidate displace a distant incumbent', () => {
    const incumbents = candidates.slice(0, 8).map((c) => ({ ...c, distance: 60 }));
    const nearer = { id: 'nearer', visible: true, distance: 1 };
    const previous = incumbents.map((c) => c.id);
    expect(allocateVoices([...incumbents, nearer], previous, 5000)).toContain(nearer.id);
    // The margin scales with distance: tolerate 5%, replace at 20%, at both scales.
    for (const distance of [5, 60]) {
      const existing = incumbents.map((c) => ({ ...c, distance }));
      expect(allocateVoices([...existing, { ...nearer, distance: distance * .95 }], previous, 5000)).not.toContain(nearer.id);
      expect(allocateVoices([...existing, { ...nearer, distance: distance * .8 }], previous, 5000)).toContain(nearer.id);
    }
  });
  it('prioritises pets, focus and arrivals, releases invisible/departed objects and rejects invalid distances', () => {
    const previous = allocateVoices(candidates, [], 0);
    const selected = allocateVoices(candidates.map((c, i) => ({ ...c, visible: i > 0, focused: i === 49, newUntil: i === 48 ? 2000 : 0, pettedUntil: i === 47 ? 2000 : 0 })), previous, 1000);
    expect(selected.slice(0, 3)).toEqual(['object-47', 'object-49', 'object-48']);
    expect(selected).not.toContain('object-00');
    expect(allocateVoices([{ id: 'bad', visible: true, distance: NaN }], previous, 0)).toEqual([]);
    expect(allocateVoices([], previous, 0)).toEqual([]);
  });
});
it('pet spring squashes tenderly, overshoots and settles without negative scale or volume change', () => {
  expect(petScale(0)[1]).toBeLessThan(1);
  expect(petScale(0.18)[1]).toBeGreaterThan(1);
  for (let t = 0; t < 2; t += 0.01) {
    const [x, y, z] = petScale(t);
    expect(x * y * z).toBeCloseTo(1);
    expect(y).toBeGreaterThan(0.7);
  }
  expect(petScale(2)).toEqual([1, 1, 1]);
});
