// Browser-only verification harness. Never imported by the application.
import * as Tone from 'tone';
import { allocateVoices, presets, soundFingerprint, syntheticObjects } from '@little-galaxy/shared';
import type { SoundFingerprint } from '@little-galaxy/shared';
import { createSoundGraph } from './sound-engine';
const sampleRate = 44100;
function levels(samples: Float32Array) {
  let peak = 0, squares = 0, clipped = 0;
  for (const v of samples) { peak = Math.max(peak, Math.abs(v)); squares += v * v; if (Math.abs(v) >= 1) clipped++; }
  const rms = Math.sqrt(squares / samples.length);
  return { peak, rms, peakDbfs: 20 * Math.log10(peak), rmsDbfs: 20 * Math.log10(rms), clipped };
}
/** Windowed power spectrum, summed over multiple windows of the actual rendered tone. */
function spectrum(samples: Float32Array) {
  const n = 2048, power = new Float64Array(n / 2);
  for (const offset of [0.4, 0.8, 1.2]) {
    const start = Math.floor(offset * sampleRate);
    for (let k = 0; k < n / 2; k++) {
      let real = 0, imaginary = 0;
      for (let i = 0; i < n; i++) {
        const sample = samples[start + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)));
        const angle = 2 * Math.PI * k * i / n;
        real += sample * Math.cos(angle); imaginary -= sample * Math.sin(angle);
      }
      power[k] += real * real + imaginary * imaginary;
    }
  }
  const total = power.reduce((a, b) => a + b, 0);
  return Array.from(power, (v) => v / total);
}
async function render(fingerprints: SoundFingerprint[], duration: number, stress = false) {
  let graph: ReturnType<typeof createSoundGraph> | undefined;
  const buffer = await Tone.Offline(() => {
    graph = createSoundGraph(fingerprints.length);
    // Full user volume for a conservative headroom check, through the real master bus.
    graph.volume.gain.value = 1;
    fingerprints.forEach((fp, i) => {
      graph!.play(i, fp, 0.2);
      if (stress) { graph!.play(i, fp, 4, true); graph!.play(i, fp, 6.5); }
    });
  }, duration, 2, sampleRate);
  graph?.dispose();
  return buffer;
}
export async function renderSoundEvidence() {
  const objects = syntheticObjects(50);
  const selected = allocateVoices(objects.map((o) => ({ id: o.id, distance: 10, visible: true })), [], 0);
  const fingerprints = selected.map((id) => { const o = objects.find((o) => o.id === id)!; return soundFingerprint(o.type ?? 'planet', o.params); });
  const mixed = await render(fingerprints, 12, true);
  const a = await render([soundFingerprint('planet', presets.planet[0])], 3);
  const b = await render([soundFingerprint('planet', presets.planet[1])], 3);
  const sameRegister = await render([soundFingerprint('planet', { ...presets.planet[1], size: presets.planet[0].size })], 3);
  const sameSpectrum = spectrum(sameRegister.getChannelData(0));
  const sa = spectrum(a.getChannelData(0)), sb = spectrum(b.getChannelData(0));
  const cosineSimilarity = sa.reduce((sum, v, i) => sum + v * sb[i], 0)
    / Math.sqrt(sa.reduce((sum, v) => sum + v * v, 0) * sb.reduce((sum, v) => sum + v * v, 0));
  const sameRegisterSimilarity = sa.reduce((sum, v, i) => sum + v * sameSpectrum[i], 0)
    / Math.sqrt(sa.reduce((sum, v) => sum + v * v, 0) * sameSpectrum.reduce((sum, v) => sum + v * v, 0));
  const centroid = (s: number[]) => s.reduce((sum, v, i) => sum + v * i * sampleRate / 2048, 0);
  return { sampleRate, duration: 12, activeObjects: objects.length, voices: selected.length, selected,
    mix: [levels(mixed.getChannelData(0)), levels(mixed.getChannelData(1))],
    difference: { sameRegisterSpectralDistance: 1 - sameRegisterSimilarity, cosineSimilarity, spectralDistance: 1 - cosineSimilarity, centroidHz: [centroid(sa), centroid(sb)],
      levels: [levels(a.getChannelData(0)), levels(b.getChannelData(0))] } };
}
