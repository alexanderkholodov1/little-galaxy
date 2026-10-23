import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fetchServedVersion, isNewerVersion } from './version-watcher';

describe('version-watcher', () => {
  it('detects when an incoming version or commit differs', () => {
    expect(isNewerVersion({ version: '0.7.0', commit: 'abc' }, { version: '0.7.1', commit: 'abc' })).toBe(true);
    expect(isNewerVersion({ version: '0.7.0', commit: 'abc' }, { version: '0.7.0', commit: 'def' })).toBe(true);
    expect(isNewerVersion({ version: '0.7.0', commit: 'abc' }, { version: '0.7.0', commit: 'abc' })).toBe(false);
    expect(isNewerVersion({ version: '0.7.0' }, { version: '0.7.0' })).toBe(false);
    expect(isNewerVersion({ version: '0.7.0' }, { version: '' })).toBe(false);
  });

  it('fetches version metadata with no-cache headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: '0.7.0', commit: 'head', builtAt: '2026-10-23T00:00:00Z' }),
    });

    const info = await fetchServedVersion(fetchMock as unknown as typeof fetch, 'http://localhost:4177');
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:4177/galaxy/version.json', expect.objectContaining({
      headers: expect.objectContaining({ 'Cache-Control': expect.stringContaining('no-cache') }),
    }));
    expect(info).toEqual({ version: '0.7.0', commit: 'head', builtAt: '2026-10-23T00:00:00Z' });
  });

  it('fails gracefully when offline or fetch fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
    const info = await fetchServedVersion(fetchMock as unknown as typeof fetch, 'http://localhost:4177');
    expect(info).toBeNull();
  });
});


it('uses Hosting as authority and remembers attempted upgrade and rollback targets across reloads', async () => {
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { useVersionWatcher } = await import('./version-watcher');
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  sessionStorage.clear();
  const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';
  let served = { version: currentVersion, commit: null as string | null };
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => served })));
  let watcher!: ReturnType<typeof useVersionWatcher>;
  function Probe() { watcher = useVersionWatcher({ appVersion: '0.6.0' }); return null; }
  const host = document.createElement('div');
  let root = createRoot(host);
  try {
    await act(async () => root.render(createElement(Probe)));
    expect(watcher.updateAvailable).toBe(false);
    await act(async () => root.unmount());
    served = { version: '1.0.1', commit: 'b' };
    root = createRoot(host);
    await act(async () => root.render(createElement(Probe)));
    expect(watcher.updateAvailable).toBe(true);
    const reload = vi.fn();
    watcher.reload(reload);
    expect(reload).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
    root = createRoot(host);
    await act(async () => root.render(createElement(Probe)));
    expect(watcher.updateAvailable).toBe(false);
    await act(async () => root.unmount());
    served = { version: '0.7.0', commit: 'rollback' };
    root = createRoot(host);
    await act(async () => root.render(createElement(Probe)));
    expect(watcher.updateAvailable).toBe(true);
    watcher.reload(reload);
    expect(reload).toHaveBeenCalledTimes(2);
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
