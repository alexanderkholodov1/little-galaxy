import type { RenderObject, SoundCandidate } from '@little-galaxy/shared';
import type { createSoundEngine } from './sound-engine';
export type AudioState = 'locked' | 'loading' | 'ready' | 'failed';
export function savedSoundMute() {
  try { return localStorage.getItem('galaxy.sound.muted') === 'true'; } catch { return false; }
}
export function savedSoundVolume(): number {
  try {
    const raw = localStorage.getItem('galaxy.sound.volume');
    if (raw !== null) {
      const v = Number(raw);
      if (Number.isFinite(v) && v >= 0 && v <= 1) return v;
    }
  } catch { /* Storage optional. */ }
  return 0.32;
}
/** Native resume happens synchronously inside the gesture, before any await/import.
 * A silent one-frame buffer also primes iOS's audio output during that gesture. */
export function createSoundController(count: number, notify: (state: AudioState) => void) {
  let context: AudioContext | undefined, engine: ReturnType<typeof createSoundEngine> | undefined;
  let pending: Promise<void> | undefined, disposed = false, allowed = true, muted = savedSoundMute(), volume = savedSoundVolume();
  let objects: RenderObject[] = [], candidates: SoundCandidate[] = [];
  function unlock(): Promise<void> {
    if (disposed || muted || !allowed) return Promise.resolve();
    if (pending) {
      // A second trusted gesture can release a browser's still-pending resume request.
      if (context?.state === 'suspended') void context.resume().catch(() => {});
      return pending;
    }
    if (engine && context?.state === 'running') return Promise.resolve();
    notify('loading');
    try {
      context ??= new AudioContext();
      const resume = context.resume();
      const silent = context.createBufferSource();
      silent.buffer = context.createBuffer(1, 1, context.sampleRate);
      silent.connect(context.destination); silent.start();
      pending = Promise.all([resume, import('./sound-engine')]).then(([, module]) => {
        if (disposed) return;
        if (context!.state !== 'running') throw new Error('Audio remains suspended');
        engine ??= module.createSoundEngine(context!, count);
        engine.update(objects, allowed ? candidates : []); engine.setMix(muted || !allowed, volume);
        notify('ready');
      }).catch(() => { if (!disposed) notify('failed'); }).finally(() => { pending = undefined; });
      return pending;
    } catch { notify('failed'); return Promise.resolve(); }
  }
  return {
    unlock,
    setAllowed(value: boolean) {
      allowed = value;
      engine?.setMix(muted || !allowed, volume);
      engine?.update(objects, allowed ? candidates : []);
    },
    update(next: RenderObject[], eligible: SoundCandidate[]) {
      objects = next; candidates = eligible; engine?.update(objects, allowed ? candidates : []);
    },
    event(id?: string) { if (!disposed && allowed && !muted) engine?.event(id); },
    pet(id: string) { void unlock().then(() => { if (!disposed && allowed && !muted) engine?.pet(id); }); },
    setMute(value: boolean) {
      muted = value;
      try { localStorage.setItem('galaxy.sound.muted', String(value)); } catch { /* Storage optional. */ }
      engine?.setMix(muted || !allowed, volume);
      if (!muted) void unlock();
    },
    setVolume(value: number, persist = true) {
      volume = value;
      if (persist) {
        try { localStorage.setItem('galaxy.sound.volume', String(value)); } catch { /* Storage optional. */ }
      }
      engine?.setMix(muted || !allowed, volume);
    },
    dispose() { disposed = true; engine?.dispose(); if (context) void context.close().catch(() => {}); },
  };
}
