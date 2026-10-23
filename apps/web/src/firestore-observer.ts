import { runTransaction } from 'firebase/firestore';
import type { DocumentReference, Firestore, Transaction } from 'firebase/firestore';

export interface TransactionObserver {
  attempt(): void;
  read(path: string): void;
  request(paths: string[]): void;
}
const observers = new WeakMap<Firestore, TransactionObserver>();
/** Optional load-test instrumentation; the observer sees every retry, including failed gets. */
export function observeTransactions(database: Firestore, observer: TransactionObserver) {
  observers.set(database, observer);
  return () => observers.delete(database);
}
export function runObservedTransaction<T>(database: Firestore, update: (tx: Transaction) => Promise<T>) {
  return runTransaction(database, async (tx) => {
    const observer = observers.get(database);
    if (!observer) return update(tx);
    observer.attempt();
    const writes = new Set<string>();
    const measured = new Proxy(tx, {
      get(target, key) {
        if (key === 'get') return (ref: DocumentReference) => {
          observer.read(ref.path);
          return target.get(ref);
        };
        if (key === 'set' || key === 'update' || key === 'delete') return (...args: unknown[]) => {
          writes.add((args[0] as DocumentReference).path);
          Reflect.apply(Reflect.get(target, key), target, args);
          return measured;
        };
        const value = Reflect.get(target, key);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const result = await update(measured);
    // The callback completed and will submit this write set; a later retry can submit it again.
    observer.request([...writes]);
    return result;
  });
}
