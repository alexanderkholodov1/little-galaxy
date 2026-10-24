import { afterEach, expect, it, vi } from 'vitest';
import { objectBucket, orbitFromVelocity, presets } from '@little-galaxy/shared';
import { loadHome, loadMemoryObject, loadSeason } from './season-data';
import { getDoc } from 'firebase/firestore';
vi.mock('./firebase', () => ({ firestore: {} }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn((...args) => args.slice(1).join('/')), getDoc: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
const manifest = { format: 1, season: 'bad-2026', title: 'BAD 2026', start: 1000, end: 1000, log: ['log-1'], objects: Array.from({ length: 16 }, (_, i) => `objects-${i.toString(16)}`), eventCount: 0 };
const body = { id: 'p', schemaVersion: 2, type: 'planet', nameKey: 'quiet-aurora', params: presets.planet[0], orbit: orbitFromVelocity(0, 2.58, 0, 0), status: 'hangar', createdAt: 1000, updatedAt: 2000, season: 'bad-2026' };
const response = (data: unknown, status = 200) => ({ status, ok: status === 200, headers: new Headers({ 'content-type': 'application/json' }), json: async () => data });
it('uses static JSON exclusively when present', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response(manifest)).mockResolvedValueOnce(response({ format: 1, states: [], events: [] }));
  vi.stubGlobal('fetch', fetcher);
  expect((await loadSeason()).frozen).toBe(true);
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/galaxy/season/bad-2026/manifest.json', '/galaxy/season/bad-2026/log-1.json']);
  expect(getDoc).not.toHaveBeenCalled();
});
it('reads a manifest plus chunks, never events or objects collections, when static files are absent', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(null, 404)));
  vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => true, data: () => manifest } as never).mockResolvedValueOnce({ exists: () => true, data: () => ({ format: 1, states: [], events: [] }) } as never);
  expect((await loadSeason()).frozen).toBe(false);
  expect(vi.mocked(getDoc).mock.calls.map(([ref]) => ref)).toEqual(['seasons/bad-2026/meta/manifest', 'seasons/bad-2026/log/log-1']);
});
it('finds hangared objects in one public shard read without authentication', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(null, 404)));
  vi.mocked(getDoc).mockResolvedValue({ exists: () => true, data: () => ({ format: 1, objects: [body] }) } as never);
  expect((await loadMemoryObject('p'))?.status).toBe('hangar');
  expect(getDoc).toHaveBeenCalledTimes(1);
  expect(getDoc).toHaveBeenCalledWith(`seasons/bad-2026/log/${objectBucket('p')}`);
});
it('does not spend Firestore reads for malformed static files or invalid IDs', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ format: 99 })));
  await expect(loadSeason()).rejects.toThrow();
  expect(await loadMemoryObject('../secret')).toBeNull();
  expect(getDoc).not.toHaveBeenCalled();
});

it('checks static memory without consulting a stand snapshot or authenticating', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(null, 404)));
  expect(await loadHome()).toEqual({ frozen: false });
  expect(getDoc).not.toHaveBeenCalled();
});
it('keeps frozen home static-only', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(manifest)));
  expect(await loadHome()).toEqual({ frozen: true });
  expect(getDoc).not.toHaveBeenCalled();
});
