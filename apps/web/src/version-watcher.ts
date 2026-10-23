/**
 * Version awareness and update coordination for Collective Galaxy.
 * - Polls /galaxy/version.json without cache.
 * - Compares running version/commit against served metadata and Firestore live config.
 * - Provides safe-moment checking for phones and quiet-moment checking for screen.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { triggerStateSave } from './live-safety';

export interface VersionInfo {
  version: string;
  commit?: string | null;
  builtAt?: string;
}

export function isNewerVersion(
  current: { version: string; commit?: string | null },
  incoming: { version: string; commit?: string | null },
): boolean {
  if (!incoming.version) return false;
  if (incoming.version !== current.version) return true;
  if (incoming.commit && current.commit && incoming.commit !== current.commit) return true;
  return false;
}

export async function fetchServedVersion(
  fetchFn: typeof fetch = globalThis.fetch,
  origin = typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:4177',
): Promise<VersionInfo | null> {
  try {
    const url = new URL('/galaxy/version.json', origin).href;
    const response = await fetchFn(url, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) {
      return (await response.json()) as VersionInfo;
    }
  } catch {
    /* Fetch failed or offline. */
  }
  return null;
}

export function useVersionWatcher({
  appVersion,
  checkIntervalMs = 20_000,
}: {
  appVersion?: string;
  checkIntervalMs?: number;
} = {}) {
  const [target, setTarget] = useState<VersionInfo | null>(null);
  const current = useMemo(() => ({
    version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.7.0',
    commit: typeof __APP_COMMIT__ !== 'undefined' ? __APP_COMMIT__ : null,
  }), []);
  const key = (value: VersionInfo) => JSON.stringify([value.version, value.commit ?? null]);
  const attemptKey = (value: VersionInfo) => `galaxy.update.${key(current)}>${key(value)}`;
  const attempted = (value: VersionInfo) => {
    try { return sessionStorage.getItem(attemptKey(value)) === 'attempted'; }
    catch { return true; } // Automatic reload requires a durable loop guard.
  };
  const updateAvailable = target !== null && !attempted(target);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const served = await fetchServedVersion();
      if (alive) setTarget(served && isNewerVersion(current, served) ? served : null);
    };
    void check();
    const interval = setInterval(check, checkIntervalMs);
    return () => { alive = false; clearInterval(interval); };
    // Config is only a prompt to recheck Hosting, including stale and rollback hints.
  }, [current, checkIntervalMs, appVersion]);

  const reload = useCallback((navigate: () => void = () => window.location.reload()) => {
    if (!target || attempted(target)) return false;
    try { sessionStorage.setItem(attemptKey(target), 'attempted'); } catch { return false; }
    triggerStateSave();
    navigate();
    return true;
  });
  return { updateAvailable, current, target, reload };
}
