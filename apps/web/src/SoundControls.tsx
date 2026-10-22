import type { Language } from '@little-galaxy/shared';
import type { useSound } from './use-sound';
export default function SoundControls({ sound, language, screen = false }: {
  sound: ReturnType<typeof useSound>; language: Language; screen?: boolean;
}) {
  const es = language === 'es';
  const label = sound.muted ? (es ? 'Activar sonido' : 'Unmute sound')
    : sound.state === 'ready' ? (es ? 'Silenciar' : 'Mute sound') : (es ? 'Activar sonido' : 'Enable sound');
  return <div className="sound-controls">
    <button onClick={sound.toggle} aria-pressed={sound.state === 'ready' && !sound.muted}>{label}</button>
    {screen && <label>{es ? 'Volumen' : 'Volume'}<input aria-label={es ? 'Volumen' : 'Volume'} type="range"
      min="0" max="1" step="0.01" value={sound.volume} onChange={(e) => sound.setVolume(Number(e.target.value))}/></label>}
    <span role="status">{sound.state === 'loading' ? (es ? 'Cargando sonido…' : 'Loading sound…')
      : sound.state === 'failed' ? (es ? 'Audio no disponible. Toca para reintentar.' : 'Audio unavailable. Tap to retry.')
      : sound.state === 'locked' ? (es ? 'Toca para escuchar.' : 'Tap to listen.') : ''}</span>
  </div>;
}
