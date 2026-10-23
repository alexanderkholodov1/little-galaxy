import { useCallback, useEffect, useRef, useState } from 'react';
import type { RenderObject, SoundCandidate } from '@little-galaxy/shared';
import { createSoundController, savedSoundMute, savedSoundVolume } from './sound-controller';
import type { AudioState } from './sound-controller';
export function useSound(count: number) {
  const controller = useRef<ReturnType<typeof createSoundController> | null>(null);
  const [state, setState] = useState<AudioState>('locked');
  const [muted, setMuted] = useState(savedSoundMute);
  const [volume, setVolume] = useState(savedSoundVolume);
  const volumeRef = useRef(volume);
  const latest = useRef<{ objects: RenderObject[]; candidates: SoundCandidate[] }>({ objects: [], candidates: [] });
  useEffect(() => {
    const sound = createSoundController(count, setState);
    controller.current = sound;
    sound.update(latest.current.objects, latest.current.candidates);
    const unlock = (event: Event) => {
      // The sound button owns its click, so automatic tap unlock cannot invert its action.
      if (event.target instanceof Element && event.target.closest('.sound-controls button')) return;
      if (event.isTrusted) void sound.unlock();
    };
    const visibility = () => { sound.setVolume(document.hidden ? 0 : volumeRef.current, false); };
    document.addEventListener('pointerup', unlock);
    document.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('pointerup', unlock);
      document.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', visibility);
      sound.dispose(); controller.current = null;
    };
  }, [count]);
  const update = useCallback((objects: RenderObject[], candidates: SoundCandidate[]) => {
    latest.current = { objects, candidates }; controller.current?.update(objects, candidates);
  }, []);
  const pet = useCallback((id: string) => controller.current?.pet(id), []);
  const toggle = () => {
    if (state !== 'ready' && !muted) { void controller.current?.unlock(); return; }
    controller.current?.setMute(!muted); setMuted(!muted);
  };
  return { state, muted, volume, update, pet, toggle, setVolume(value: number) {
    volumeRef.current = value;
    setVolume(value);
    try { localStorage.setItem('galaxy.sound.volume', String(value)); } catch { /* Storage optional. */ }
    controller.current?.setVolume(value);
  } };
}
