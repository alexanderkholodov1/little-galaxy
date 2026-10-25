import { doc, onSnapshot } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { screenScenes } from '../../packages/shared/src/index.js';
import type { LiveConfig } from '../../packages/shared/src/index.js';
import { anonymousUid } from '../../apps/web/src/firebase.ts';
export const closedConfig: LiveConfig = {
  schemaVersion: 1, appVersion: '', seasonOpen: false, launches: false, edits: false, comets: false,
  shake: false, shootingStars: false, assistantPublic: false, meteorShowers: false, soundOnScreen: false,
  sound: false, spotlight: false, screenScene: 'galaxy',
};
export function readConfig(data: Record<string, unknown> | undefined): LiveConfig {
  if (data?.schemaVersion !== 1) return closedConfig;
  const seconds = (key: string, fallback: number, min: number, max: number) =>
    typeof data[key] === 'number' && Number.isFinite(data[key])
      ? Math.max(min, Math.min(max, data[key] as number)) : fallback;
  const seasonOpen = data.seasonOpen === true;
  return { ...closedConfig, appVersion: typeof data.appVersion === 'string' ? data.appVersion : '',
    seasonOpen,
    launches: seasonOpen && data.launches === true,
    edits: seasonOpen && data.edits !== false,
    comets: seasonOpen && data.comets === true,
    shake: seasonOpen && data.shake === true,
    shootingStars: seasonOpen && data.shootingStars === true,
    meteorShowers: seasonOpen && data.meteorShowers === true,
    soundOnScreen: seasonOpen && data.soundOnScreen !== false && data.sound !== false,
    sound: seasonOpen && data.soundOnScreen !== false && data.sound !== false,
    spotlight: seasonOpen && data.spotlight !== false,
    screenScene: typeof data.screenScene === 'string' && screenScenes.includes(data.screenScene as LiveConfig['screenScene'])
      ? (data.screenScene as LiveConfig['screenScene'])
      : data.screenScene === 'qr'
        ? 'bigQr'
        : 'galaxy',
    idleSeconds: seconds('idleSeconds', 60, 10, 3600),
  };
}
export function listenConfig(database: Firestore, next: (config: LiveConfig) => void, error: () => void) {
  let stopped = false;
  let stop: (() => void) | undefined;
  void Promise.resolve().then(anonymousUid).then(() => {
    if (!stopped) stop = onSnapshot(doc(database, 'config', 'live'), { includeMetadataChanges: true },
      (snapshot) => { if (!stopped && !snapshot.metadata.fromCache) next(readConfig(snapshot.data())); }, () => { if (!stopped) error(); });
  }).catch(() => { if (!stopped) error(); });
  return () => { stopped = true; stop?.(); };
}
