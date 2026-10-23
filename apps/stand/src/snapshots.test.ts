import type { Firestore } from 'firebase-admin/firestore';
import { expect, it, vi } from 'vitest';
import { compactSnapshot, startSnapshotWriter } from './snapshots.js';
import { orbitFromSwipe, SEASON } from '@little-galaxy/shared';
it('strips owner IDs and timestamps, ignores incompatible versions and never includes hangar', () => {
  const object = { ownerUid: 'private-id', type: 'planet', nameKey: 'quiet-aurora', season: SEASON,
    params: { size: 0.4, oceans: 0.5, palette: 0 }, orbit: orbitFromSwipe(200, 0, 0.3, 1000), status: 'active' };
  const snapshot = compactSnapshot([{ id: 'one', data: () => object }, { id: 'old', data: () => ({ ...object, status: 'hangar' }) }, { id: 'future', data: () => ({ ...object, schemaVersion: 2 }) }]);
  expect(snapshot.creators).toBe(1);
  expect(snapshot.objects[0].id).toBe('one');
  expect(JSON.stringify(snapshot)).not.toContain('private-id');
  expect(compactSnapshot([]).creators).toBe(0);
});

it('invalidates failed listeners, backs off and publishes only new listener state', async () => {
  vi.useFakeTimers();
  const listeners: { next: (s: { docs: [] }) => void; fail: () => void }[] = [];
  const unsubscribe = vi.fn();
  const set = vi.fn().mockResolvedValue(undefined);
  const database = { doc: () => ({ set }), collection: () => ({ where: () => ({ onSnapshot: (next: typeof listeners[number]['next'], fail: () => void) => { listeners.push({ next, fail }); return unsubscribe; } }) }) };
  const error = vi.fn();
  const stop = startSnapshotWriter(database as unknown as Firestore, error, 100);
  try {
    listeners[0].next({ docs: [] }); await vi.advanceTimersByTimeAsync(100);
    expect(set).toHaveBeenCalledTimes(2);
    listeners[0].fail();
    await vi.advanceTimersByTimeAsync(999);
    expect(listeners).toHaveLength(1); expect(set).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1); expect(listeners).toHaveLength(2);
    listeners[0].next({ docs: [] }); // A late callback cannot restore stale state.
    listeners[1].fail();
    await vi.advanceTimersByTimeAsync(1999); expect(listeners).toHaveLength(2);
    expect(set).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1); expect(listeners).toHaveLength(3);
    listeners[2].next({ docs: [] }); await vi.advanceTimersByTimeAsync(100);
    expect(set).toHaveBeenCalledTimes(4);
    listeners[2].fail(); await stop();
    await vi.advanceTimersByTimeAsync(60000); expect(listeners).toHaveLength(3);
    expect(set).toHaveBeenCalledTimes(4); expect(error).toHaveBeenCalledTimes(3);
    expect(unsubscribe).toHaveBeenCalledTimes(3);
  } finally { await stop(); vi.useRealTimers(); }
});
