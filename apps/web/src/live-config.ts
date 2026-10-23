import { doc, onSnapshot } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { screenScenes } from '@little-galaxy/shared';
import type { LiveConfig } from '@little-galaxy/shared';
import { anonymousUid } from './firebase';
export const closedConfig: LiveConfig = {
  schemaVersion: 1, appVersion: '', seasonOpen: false, launches: false, comets: false,
  shake: false, shootingStars: false, assistantPublic: false, meteorShowers: false, screenScene: 'galaxy',
};
export function readConfig(data: Record<string, unknown> | undefined): LiveConfig {
  if (data?.schemaVersion !== 1) return closedConfig;
  const seconds = (key: string, fallback: number, min: number, max: number) =>
    typeof data[key] === 'number' && Number.isFinite(data[key])
      ? Math.max(min, Math.min(max, data[key] as number)) : fallback;
  return { ...closedConfig, appVersion: typeof data.appVersion === 'string' ? data.appVersion : '',
    seasonOpen: data.seasonOpen === true, launches: data.launches === true, comets: data.comets === true,
    shake: data.shake === true, shootingStars: data.shootingStars === true, meteorShowers: data.meteorShowers === true,
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
