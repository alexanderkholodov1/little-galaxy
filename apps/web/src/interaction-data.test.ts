import { afterEach, expect, it, vi } from 'vitest';
import { onSnapshot, where, orderBy, limitToLast, Timestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { listenRecentEvents, readScreenEvent } from './interaction-data';
import { setUidProvider } from './session-uid';
vi.mock('firebase/firestore', async (original) => ({ ...await original<typeof import('firebase/firestore')>(),
  collection: vi.fn(), query: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limitToLast: vi.fn(), onSnapshot: vi.fn() }));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); setUidProvider(undefined); });
it('rebases the limited recent query, deduplicates events, ignores stale/cache/invalid rows and late callbacks', async () => {
  vi.useFakeTimers();
  setUidProvider(() => Promise.resolve('screen'));
  const callbacks: ((snapshot: unknown) => void)[] = [], stops: ReturnType<typeof vi.fn>[] = [];
  vi.mocked(onSnapshot).mockImplementation((...args: unknown[]) => { callbacks.push(args[2] as (snapshot: unknown) => void); const stop = vi.fn(); stops.push(stop); return stop; });
  const next = vi.fn(), error = vi.fn();
  const stop = listenRecentEvents({} as Firestore, next, error);
  await vi.advanceTimersByTimeAsync(0);
  expect(where).toHaveBeenCalledWith('type', 'in', ['launch', 'relaunch', 'shake', 'comet', 'shootingStar', 'meteorShower']);
  expect(limitToLast).toHaveBeenCalledWith(100); expect(orderBy).toHaveBeenCalledWith('at');
  expect(where).toHaveBeenCalledWith('at', '>', Timestamp.fromMillis(Date.now() - 15_000));
  const row = (id: string, ago = 0) => ({ id, data: () => ({ schemaVersion: 1, type: 'shake', objectId: '', at: Timestamp.fromMillis(Date.now() - ago), payload: {} }) });
  callbacks[0]({ metadata: { fromCache: true }, docs: [row('cached')] }); expect(next).not.toHaveBeenCalled();
  callbacks[0]({ metadata: { fromCache: false }, docs: [row('wave'), row('old', 11_000)] });
  expect(next.mock.calls[0][0].map((e: { id: string }) => e.id)).toEqual(['wave']);
  await vi.advanceTimersByTimeAsync(90_000);
  expect(stops[0]).toHaveBeenCalledOnce(); expect(onSnapshot).toHaveBeenCalledTimes(2);
  expect(where).toHaveBeenCalledWith('at', '>', Timestamp.fromMillis(Date.now() - 15_000));
  callbacks[0]({ metadata: { fromCache: false }, docs: [row('late-old-listener')] });
  callbacks[1]({ metadata: { fromCache: false }, docs: [row('wave'), row('fresh')] });
  expect(next.mock.calls[1][0].map((e: { id: string }) => e.id)).toEqual(['fresh']);
  stop(); callbacks[1]({ metadata: { fromCache: false }, docs: [row('after-stop')] });
  await vi.advanceTimersByTimeAsync(90_000);
  expect(next).toHaveBeenCalledTimes(2); expect(onSnapshot).toHaveBeenCalledTimes(2);
  expect(stops[1]).toHaveBeenCalledOnce(); expect(error).not.toHaveBeenCalled();
});
it('cancels pending authentication and reports authentication failure', async () => {
  vi.useFakeTimers(); let resolve!: (uid: string) => void;
  setUidProvider(() => new Promise((done) => { resolve = done; }));
  const error = vi.fn(), stop = listenRecentEvents({} as Firestore, vi.fn(), error);
  await vi.advanceTimersByTimeAsync(0); stop(); resolve('screen'); await vi.advanceTimersByTimeAsync(0);
  expect(onSnapshot).not.toHaveBeenCalled();
  setUidProvider(() => Promise.reject(new Error('offline')));
  const cleanup = listenRecentEvents({} as Firestore, vi.fn(), error); await vi.advanceTimersByTimeAsync(0);
  expect(error).toHaveBeenCalledOnce(); cleanup();
});
it('skips invalid schema, timestamps, free text and future event types', () => {
  const event = { schemaVersion: 1, type: 'shootingStar', objectId: '', at: Timestamp.now(), payload: { messageKey: 'hello' } };
  expect(readScreenEvent('star', event)?.type).toBe('shootingStar');
  for (const override of [{ schemaVersion: 2 },{ at: 1 },{ type: 'assistant' },{ payload: { messageKey: 'free text' } },{ payload: [] }]) expect(readScreenEvent('bad', { ...event, ...override })).toBeNull();
});

it('meters server result sets on each rebase even after a cache-only initial snapshot', async () => {
  vi.useFakeTimers();
  setUidProvider(() => Promise.resolve('screen'));
  const callbacks: ((snapshot: unknown) => void)[] = [];
  vi.mocked(onSnapshot).mockImplementation((...args: unknown[]) => {
    callbacks.push(args[2] as (snapshot: unknown) => void);
    return vi.fn();
  });
  const meter = vi.fn();
  const stop = listenRecentEvents({} as Firestore, vi.fn(), vi.fn(), meter);
  try {
    await vi.advanceTimersByTimeAsync(0);
    const row = { id: 'wave', data: () => ({ schemaVersion: 1, type: 'shake', objectId: '', at: Timestamp.now(), payload: {} }) };
    const snapshot = { docs: [row], size: 1, docChanges: () => [], metadata: { fromCache: true } };
    callbacks[0](snapshot);
    expect(meter).not.toHaveBeenCalled();
    callbacks[0]({ ...snapshot, metadata: { fromCache: false } });
    expect(meter).toHaveBeenLastCalledWith(1);
    callbacks[0]({ ...snapshot, metadata: { fromCache: false } });
    expect(meter).toHaveBeenLastCalledWith(0);
    await vi.advanceTimersByTimeAsync(90_000);
    callbacks[1]({ ...snapshot, metadata: { fromCache: false } });
    expect(meter).toHaveBeenLastCalledWith(1);
    await vi.advanceTimersByTimeAsync(90_000);
    callbacks[2]({ ...snapshot, docs: [], size: 0, metadata: { fromCache: false } });
    expect(meter.mock.calls.map(([n]) => n)).toEqual([1, 0, 1, 1]);
  } finally { stop(); }
});

it('rebases a busy window before limit churn and includes equal-timestamp arrivals', async () => {
  setUidProvider(() => Promise.resolve('screen'));
  vi.mocked(onSnapshot).mockReturnValue(vi.fn());
  const next = vi.fn(), stop = listenRecentEvents({} as Firestore, next, vi.fn());
  try {
    await Promise.resolve(); await Promise.resolve();
    const at = Timestamp.now();
    const row = (id: string) => ({ id, data: () => ({ schemaVersion: 1, type: 'shake', objectId: '', at, payload: {} }) });
    const callback = vi.mocked(onSnapshot).mock.calls[0][2] as unknown as (s: unknown) => void;
    callback({ docs: Array.from({ length: 80 }, (_, i) => row(`wave-${i}`)), size: 80, metadata: { fromCache: false } });
    await Promise.resolve(); expect(onSnapshot).toHaveBeenCalledTimes(2);
    expect(where).toHaveBeenCalledWith('at', '>=', at);
    const resumed = vi.mocked(onSnapshot).mock.calls[1][2] as unknown as (s: unknown) => void;
    resumed({ docs: [row('wave-0'), row('equal-time-new')], size: 2, metadata: { fromCache: false } });
    expect(next.mock.calls[1][0].map((e: { id: string }) => e.id)).toEqual(['equal-time-new']);
  } finally { stop(); }
});
