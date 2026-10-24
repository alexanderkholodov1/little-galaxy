import { expect, it, vi } from 'vitest';
import type { DocumentReference, Firestore, Transaction } from 'firebase/firestore';
import { runTransaction } from 'firebase/firestore';
import { runObservedTransaction, observeTransactions } from './firestore-observer';

vi.mock('firebase/firestore', () => ({
  runTransaction: vi.fn(async (_db: unknown, update: (tx: Transaction) => Promise<unknown>) => {
    const tx = { get: vi.fn().mockRejectedValueOnce(new Error('retry')).mockResolvedValue({}), set: vi.fn() };
    try { await update(tx as unknown as Transaction); } catch { /* emulate an SDK retry */ }
    return update(tx as unknown as Transaction);
  }),
}));
it('counts reads from failed and retried callbacks before each get settles', async () => {
  const db = {} as Firestore;
  const observer = { attempt: vi.fn(), read: vi.fn(), request: vi.fn() };
  const stop = observeTransactions(db, observer);
  try {
    await runObservedTransaction(db, async (tx) => {
      await tx.get({ path: 'users/one' } as DocumentReference);
      tx.set({ path: 'events/event' } as DocumentReference, {});
    });
    expect(runTransaction).toHaveBeenCalledWith(db, expect.any(Function), { maxAttempts: 10 });
    expect(observer.attempt).toHaveBeenCalledTimes(2);
    expect(observer.read.mock.calls).toEqual([['users/one'], ['users/one']]);
    expect(observer.request.mock.calls).toEqual([[['events/event']]]);
  } finally { stop(); }
});
