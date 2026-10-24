import { randomUUID } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
export const LEASE_MS = 360_000;
export const HEARTBEAT_MS = 90_000;
export type StandFence = { owner: string; fencingToken: number };
/** readTime is supplied by Firestore, independent of either contender's host clock. */
export async function claimLease(database: Firestore, owner: string, duration = LEASE_MS): Promise<StandFence | false> {
  return database.runTransaction(async (tx) => {
    const ref = database.doc('leases/stand'), snapshot = await tx.get(ref), lease = snapshot.data();
    const now = snapshot.readTime.toMillis();
    if (lease?.owner && lease.owner !== owner && lease.expiresAt.toMillis() > now) return false;
    const fencingToken = (lease?.fencingToken ?? 0) + (lease?.owner === owner && lease.expiresAt.toMillis() > now ? 0 : 1);
    tx.set(ref, { owner, fencingToken, heartbeatAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromMillis(now + duration) });
    return { owner, fencingToken };
  });
}
/** Read this in the SAME transaction as every enrichment write: takeover conflicts and retries reject stale work. */
export async function checkFence(database: Firestore, tx: Transaction, fence: StandFence) {
  const snapshot = await tx.get(database.doc('leases/stand')), lease = snapshot.data();
  if (!lease || lease.owner !== fence.owner || lease.fencingToken !== fence.fencingToken
    || lease.expiresAt.toMillis() <= snapshot.readTime.toMillis()) throw new Error('Stand lease lost');
}
/** Only a leader creates listeners/timers. Cleanup finishes before another local generation starts. */
export function startLeasedStand(database: Firestore, start: (fence: StandFence) => (() => Promise<void>), failed: () => void,
  options: { owner?: string; heartbeatMs?: number; leaseMs?: number } = {}) {
  const owner = options.owner ?? randomUUID(), heartbeat = options.heartbeatMs ?? HEARTBEAT_MS, duration = options.leaseMs ?? LEASE_MS;
  let stopped = false, services: (() => Promise<void>) | undefined, activeToken: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined, deadline: ReturnType<typeof setTimeout> | undefined;
  let cleanup = Promise.resolve();
  function demote() {
    clearTimeout(deadline);
    const stop = services; services = undefined; activeToken = undefined;
    if (stop) cleanup = cleanup.then(stop).catch(failed);
    return cleanup;
  }
  let pending: Promise<void>;
  async function tick() {
    const began = performance.now();
    try {
      const acquired = await claimLease(database, owner, duration);
      if (stopped) return;
      // A monotonic local deadline is conservative; all authority checks use server readTime.
      const remaining = duration - (performance.now() - began);
      if (!acquired || remaining <= 0) await demote();
      else {
        if (services && activeToken !== acquired.fencingToken) await demote();
        clearTimeout(deadline);
        deadline = setTimeout(() => { void demote(); }, remaining);
        await cleanup;
        if (!stopped && performance.now() - began < duration) {
          services ??= start(acquired); activeToken = acquired.fencingToken;
        }
      }
    } catch { if (!stopped) failed(); } // Keep the last confirmed deadline through transient errors.
    if (!stopped) timer = setTimeout(() => { pending = tick(); }, heartbeat);
  }
  pending = tick();
  return async () => {
    stopped = true; clearTimeout(timer); clearTimeout(deadline);
    await demote(); await pending;
    // Preserve the generation forever, including graceful releases (no token reuse).
    await database.runTransaction(async (tx) => {
      const ref = database.doc('leases/stand'), snapshot = await tx.get(ref);
      if (snapshot.data()?.owner === owner) tx.update(ref, { owner: null, expiresAt: Timestamp.fromMillis(0) });
    }).catch(failed);
  };
}
