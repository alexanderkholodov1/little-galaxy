// This entire module (including Tone) is fetched only after the native gesture unlock.
import * as Tone from 'tone';
import { midiHz, presets, soundFingerprint, MAX_SOUND_VOICES } from '@little-galaxy/shared';
import type { RenderObject, SoundCandidate, SoundFingerprint } from '@little-galaxy/shared';

/** One monophonic oscillator per slot, including pets. No extra pet synth or effect tail voices. */
export function createSoundGraph(count = MAX_SOUND_VOICES) {
  const volume = new Tone.Gain(0.32);
  const compressor = new Tone.Compressor({ threshold: -24, ratio: 3, attack: 0.015, release: 0.3 });
  const limiter = new Tone.Limiter(-6).toDestination();
  volume.chain(compressor, limiter);
  // One deterministic shared impulse avoids eight independent worklet reverbs on phones/TVs.
  const rate = Tone.getContext().sampleRate;
  const impulse = Tone.getContext().createBuffer(2, Math.ceil(rate * 1.4), rate);
  let seed = 17;
  for (let channel = 0; channel < 2; channel++) {
    const samples = impulse.getChannelData(channel);
    for (let i = 0; i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      samples[i] = (seed / 2 ** 31 - 1) * Math.exp(-i / rate * 5);
    }
  }
  const reverb = new Tone.Convolver({ url: impulse, normalize: true }).connect(volume);
  const slots = Array.from({ length: count }, () => {
    const synth = new Tone.Synth({ volume: -32, oscillator: { type: 'custom', partials: [1, 0.1] },
      envelope: { attack: 0.5, decay: 0.5, sustain: 0.35, release: 1 } });
    const filter = new Tone.Filter(1200, 'lowpass', -24);
    const chorus = new Tone.Chorus({ frequency: 0.3, delayTime: 3.5, depth: 0.3, wet: 0 }).start();
    const send = new Tone.Gain(0).connect(reverb);
    synth.chain(filter, chorus, volume);
    chorus.connect(send);
    return { synth, filter, chorus, send };
  });
  return {
    slots,
    volume,
    play(index: number, fp: SoundFingerprint, time: number, pet = false) {
      const s = slots[index];
      s.synth.set({ oscillator: { type: 'custom', partials: fp.partials },
        envelope: { attack: pet ? 0.025 : fp.attack, release: pet ? 0.5 : fp.release } });
      s.filter.frequency.setValueAtTime(fp.filterHz, time);
      s.chorus.wet.setValueAtTime(fp.chorus, time);
      s.send.gain.setValueAtTime(fp.shimmer, time);
      // Pet responses reuse a slot; they never add a ninth voice.
      s.synth.triggerAttackRelease(midiHz(pet ? fp.petMidi : fp.midi), pet ? 0.14 : 1.6, time, pet ? 0.85 : 0.45);
    },
    dispose() {
      for (const s of slots) { s.synth.dispose(); s.filter.dispose(); s.chorus.dispose(); s.send.dispose(); }
      reverb.dispose(); volume.dispose(); compressor.dispose(); limiter.dispose();
    },
  };
}
export function createSoundEngine(context: AudioContext, count: number) {
  const toneContext = new Tone.Context(context);
  Tone.setContext(toneContext);
  const graph = createSoundGraph(count);
  let objects: RenderObject[] = [];
  const slots = Array.from({ length: count }, () => ({ id: '', petAt: -Infinity }));
  let muted = false, level = 0.32, cursor = 0, lastEvent = -Infinity;
  let pending: { id: string; until: number } | undefined;
  function play(id: string | undefined, pet: boolean) {
    if (muted || level <= 0) return;
    const object = objects.find((o) => o.id === id);
    if (id && !object) return;
    const time = Tone.now();
    if (!pet && time - lastEvent < 4) return;
    let index = slots.findIndex((s) => s.id === id);
    if (index < 0) { index = cursor++ % count; slots[index] = { id: id ?? '', petAt: -Infinity }; }
    const slot = slots[index];
    if (pet && time - slot.petAt < .25) return;
    const fingerprint = object ? soundFingerprint(object.type ?? 'planet', object.params)
      : soundFingerprint('star', presets.star[0]);
    graph.play(index, fingerprint, time + .01, pet);
    if (pet) slot.petAt = time; else lastEvent = time;
  }
  return {
    // Rendering, camera changes, edits and initial object delivery never schedule notes.
    update(next: RenderObject[], _eligible: SoundCandidate[]) {
      objects = next;
      if (pending && (pending.until < Date.now() || objects.some((o) => o.id === pending!.id))) {
        const cue = pending; pending = undefined;
        if (cue.until >= Date.now()) play(cue.id, false);
      }
    },
    setMix(mute: boolean, value: number) {
      muted = mute; level = Math.min(1, Math.max(0, value));
      if (muted || level <= 0) pending = undefined;
      graph.volume.gain.rampTo(muted ? 0 : level, 0.15);
    },
    pet(id: string) { play(id, true); },
    // Booth events are explicit and globally spaced. No history playback after unlock.
    event(id?: string) {
      if (muted || level <= 0) return;
      if (id && !objects.some((o) => o.id === id)) pending = { id, until: Date.now() + 2000 };
      else play(id, false);
    },
    dispose() { pending = undefined; graph.dispose(); void toneContext.dispose(); },
  };
}
