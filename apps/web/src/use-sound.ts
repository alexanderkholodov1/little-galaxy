import { useCallback, useEffect, useRef, useState } from 'react';
import type { RenderObject, SoundCandidate } from '@little-galaxy/shared';
import { createSoundController, savedSoundMute, savedSoundVolume } from './sound-controller';
import type { AudioState } from './sound-controller';
export function useSound(count: number, allowed = true) {
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
    const visibility = () => { sound.setVolume(document.hidden ? 0 : volumeRef.current, false); };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      sound.dispose(); controller.current = null;
    };
  }, [count]);
  useEffect(() => { controller.current?.setAllowed(allowed); }, [allowed, count]);
  const update = useCallback((objects: RenderObject[], candidates: SoundCandidate[]) => {
    latest.current = { objects, candidates }; controller.current?.update(objects, candidates);
  }, []);
  const pet = useCallback((id: string) => controller.current?.pet(id), []);
  const event = useCallback((id?: string) => controller.current?.event(id), []);
  const toggle = () => {
    if (state !== 'ready' && !muted) { void controller.current?.unlock(); return; }
    controller.current?.setMute(!muted); setMuted(!muted);
  };
  return { state, muted, volume, update, pet, event, toggle, setVolume(value: number) {
    volumeRef.current = value;
    setVolume(value);
    try { localStorage.setItem('galaxy.sound.volume', String(value)); } catch { /* Storage optional. */ }
    controller.current?.setVolume(value);
  } };
}
