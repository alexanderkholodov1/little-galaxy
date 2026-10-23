/**
 * Version awareness and update coordination for Collective Galaxy.
 * - Polls /galaxy/version.json without cache.
 * - Compares running version/commit against served metadata and Firestore live config.
 * - Provides safe-moment checking for phones and quiet-moment checking for screen.
 */

import { useEffect, useMemo, useState } from 'react';

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
  const [polledUpdate, setPolledUpdate] = useState(false);
  const current = useMemo(() => ({
    version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0',
    commit: typeof __APP_COMMIT__ !== 'undefined' ? __APP_COMMIT__ : null,
  }), []);

  const configUpdate = Boolean(appVersion && appVersion !== current.version);
  const updateAvailable = configUpdate || polledUpdate;

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const served = await fetchServedVersion();
      if (!alive || !served) return;
      if (isNewerVersion(current, served)) {
        setPolledUpdate(true);
      }
    };

    void check();
    const interval = setInterval(check, checkIntervalMs);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [current, checkIntervalMs]);

  return { updateAvailable, current };
}
