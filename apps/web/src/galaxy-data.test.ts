import { afterEach, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase/firestore';
import { listenActive } from './galaxy-data';
import { setUidProvider } from './session-uid';
import { onSnapshot } from 'firebase/firestore';
vi.mock('firebase/firestore', async (original) => ({
  ...await original<typeof import('firebase/firestore')>(),
  collection: vi.fn(), query: vi.fn(), where: vi.fn(), onSnapshot: vi.fn(),
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
