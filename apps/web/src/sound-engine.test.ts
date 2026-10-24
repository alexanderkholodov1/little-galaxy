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

it('stays silent across initial delivery, parameter/camera updates and elapsed minutes', () => {
  vi.useFakeTimers(); audio.notes.mockClear(); audio.time = 0;
  const engine = createSoundEngine({} as AudioContext, 8), objects = syntheticObjects(50);
  try {
    engine.update(objects, objects.map((o) => ({ id: o.id, visible: true, distance: 1 })));
    for (const time of [6, 12, 60, 300]) {
      audio.time = time; vi.advanceTimersByTime(60_000);
      engine.update(objects.slice().reverse(), [{ id: objects[0].id, visible: true, distance: 2, focused: true }]);
    }
    expect(audio.notes).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
    engine.pet(objects[0].id); expect(audio.notes).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(60_000); expect(audio.notes).toHaveBeenCalledOnce();
  } finally { engine.dispose(); vi.useRealTimers(); }
});
it('plays sparse arrival/comet events once, suppresses muted events and expires pending arrivals', () => {
  vi.useFakeTimers(); audio.notes.mockClear(); audio.time = 0;
  const engine = createSoundEngine({} as AudioContext, 8), objects = syntheticObjects(2);
  try {
    engine.event(objects[0].id); expect(audio.notes).not.toHaveBeenCalled();
    engine.update(objects, []); expect(audio.notes).toHaveBeenCalledOnce();
    engine.event(objects[1].id); engine.event(); expect(audio.notes).toHaveBeenCalledOnce();
    audio.time = 4; engine.event(); expect(audio.notes).toHaveBeenCalledTimes(2);
    audio.time = 8; engine.setMix(true, .32); engine.event(); engine.pet(objects[0].id);
    expect(audio.notes).toHaveBeenCalledTimes(2);
    engine.setMix(false, .32); engine.event('late'); vi.advanceTimersByTime(2100);
    engine.update([...objects, { ...objects[0], id: 'late' }], []);
    expect(audio.notes).toHaveBeenCalledTimes(2);
  } finally { engine.dispose(); vi.useRealTimers(); }
});
