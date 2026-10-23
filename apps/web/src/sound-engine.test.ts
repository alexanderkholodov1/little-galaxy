import { afterEach, expect, it, vi } from 'vitest';
import { midiHz, soundFingerprint, syntheticObjects } from '@little-galaxy/shared';
import { createSoundEngine } from './sound-engine';
const audio = vi.hoisted(() => ({ time: .23, notes: vi.fn() }));
vi.mock('tone', () => {
  // Replace the browser audio nodes only; exercise the production scheduler and graph.play.
  class Node {
    gain = { rampTo: vi.fn(), setValueAtTime: vi.fn() };
    frequency = { setValueAtTime: vi.fn() };
    wet = { setValueAtTime: vi.fn() };
    chain() {} connect() { return this; } start() { return this; } toDestination() { return this; }
    set() {} dispose() {} triggerRelease() {}
    triggerAttackRelease = audio.notes;
  }
  return { Gain: Node, Compressor: Node, Limiter: Node, Convolver: Node, Synth: Node, Filter: Node, Chorus: Node,
    Context: Node, setContext() {}, now: () => audio.time,
    getContext: () => ({ sampleRate: 10, createBuffer: () => ({ getChannelData: () => new Float32Array(14) }) }) };
});
afterEach(() => vi.restoreAllMocks());
it('plays the first pet below 0.25s context age and throttles only subsequent rapid pets', () => {
  vi.spyOn(window, 'setInterval').mockReturnValue(1);
  vi.spyOn(window, 'clearInterval').mockImplementation(() => {});
  audio.notes.mockClear(); audio.time = .23;
  const object = syntheticObjects(2)[1], fp = soundFingerprint(object.type ?? 'planet', object.params);
  const engine = createSoundEngine({} as AudioContext, 1);
  try {
    engine.update([object], [{ id: object.id, visible: true, distance: 1 }]);
    engine.pet(object.id);
    expect(audio.notes).toHaveBeenCalledWith(midiHz(fp.petMidi), .14, .23 + .01, .85);
    const pets = () => audio.notes.mock.calls.filter((call) => call[1] === .14);
    expect(pets()).toHaveLength(1);
    for (const time of [.24, .30, .47]) { audio.time = time; engine.pet(object.id); }
    expect(pets()).toHaveLength(1);
    audio.time = .49; engine.pet(object.id);
    expect(pets()).toHaveLength(2);
  } finally { engine.dispose(); }
});
