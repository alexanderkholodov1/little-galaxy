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
