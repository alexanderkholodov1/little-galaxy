import { afterEach, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase/firestore';
import { listenActive, availableHosts } from './galaxy-data';
import { setUidProvider } from './session-uid';
import { onSnapshot, getDocs } from 'firebase/firestore';
vi.mock('firebase/firestore', async (original) => ({
  ...await original<typeof import('firebase/firestore')>(),
  collection: vi.fn(), query: vi.fn(), where: vi.fn(), onSnapshot: vi.fn(), getDocs: vi.fn(),
}));
afterEach(() => { setUidProvider(undefined); });
it('waits for anonymous auth before subscribing and cancels a pending subscription on cleanup', async () => {
  let resolve!: (uid: string) => void;
  setUidProvider(() => new Promise((done) => { resolve = done; }));
  const unsubscribe = vi.fn();
  vi.mocked(onSnapshot).mockReset().mockReturnValue(unsubscribe);
  const error = vi.fn();
  const stop = listenActive({} as Firestore, vi.fn(), error);
  expect(onSnapshot).not.toHaveBeenCalled();
  resolve('screen'); await Promise.resolve(); await Promise.resolve();
  expect(onSnapshot).toHaveBeenCalledOnce();
  stop(); expect(unsubscribe).toHaveBeenCalledOnce();
  const cancel = listenActive({} as Firestore, vi.fn(), error);
  cancel(); resolve('screen'); await Promise.resolve(); await Promise.resolve();
  expect(onSnapshot).toHaveBeenCalledOnce(); expect(error).not.toHaveBeenCalled();
});
it('reports authentication failure without starting the object listener', async () => {
  vi.mocked(onSnapshot).mockClear();
  setUidProvider(() => Promise.reject(new Error('offline')));
  const error = vi.fn();
  const stop = listenActive({} as Firestore, vi.fn(), error);
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(onSnapshot).not.toHaveBeenCalled(); expect(error).toHaveBeenCalledOnce(); stop();
});

it('pauses hidden tabs immediately, debounces resume and cancels stale callbacks', async () => {
  vi.useFakeTimers();
  const visibility = new EventTarget();
  let hidden = false;
  vi.stubGlobal('document', Object.assign(visibility, { get visibilityState() { return hidden ? 'hidden' : 'visible'; } }));
  Object.defineProperty(document, 'visibilityState', { get: () => hidden ? 'hidden' : 'visible' });
  setUidProvider(() => Promise.resolve('phone'));
  const unsubscribe = vi.fn(); vi.mocked(onSnapshot).mockReset().mockReturnValue(unsubscribe);
  const stop = listenActive({} as Firestore, vi.fn(), vi.fn());
  try {
    await vi.advanceTimersByTimeAsync(0); expect(onSnapshot).toHaveBeenCalledTimes(1);
    hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3_600_000); expect(onSnapshot).toHaveBeenCalledTimes(1);
    hidden = false; document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(999); expect(onSnapshot).toHaveBeenCalledTimes(1);
    hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    hidden = false; document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(1000); expect(onSnapshot).toHaveBeenCalledTimes(2);
    hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    hidden = false; document.dispatchEvent(new Event('visibilitychange')); stop();
    await vi.advanceTimersByTimeAsync(1000); expect(onSnapshot).toHaveBeenCalledTimes(2);
  } finally { stop(); vi.useRealTimers(); vi.unstubAllGlobals(); }
});

it('reuses a recent server sky for workshop choices and expires the cache', async () => {
  vi.useFakeTimers();
  setUidProvider(() => Promise.resolve('phone'));
  vi.mocked(onSnapshot).mockReset().mockReturnValue(vi.fn());
  vi.mocked(getDocs).mockResolvedValue({ docs: [], size: 0 } as never);
  const database = {} as Firestore;
  const stop = listenActive(database, vi.fn(), vi.fn());
  try {
    await vi.advanceTimersByTimeAsync(0);
    const callback = vi.mocked(onSnapshot).mock.calls[0][2] as unknown as (snapshot: unknown) => void;
    callback({ docs: [], size: 0, metadata: { fromCache: false }, docChanges: () => [] });
    await availableHosts(database); expect(getDocs).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300_001);
    await availableHosts(database); expect(getDocs).toHaveBeenCalledTimes(1);
  } finally { stop(); vi.useRealTimers(); }
});
