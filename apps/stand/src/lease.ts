import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
export const LEASE_MS = 90_000;
export const HEARTBEAT_MS = 30_000;
/** Firestore transaction time is bounded locally as well: a stalled renewal stops work. */
export async function claimLease(database: Firestore, owner: string, now = Date.now(), duration = LEASE_MS): Promise<boolean> {
  return database.runTransaction(async (tx) => {
    const ref = database.doc('leases/stand'), snapshot = await tx.get(ref), lease = snapshot.data();
    if (lease && lease.owner !== owner && lease.expiresAt.toMillis() > now) return false;
    tx.set(ref, { owner, heartbeatAt: Timestamp.fromMillis(now), expiresAt: Timestamp.fromMillis(now + duration) });
    return true;
  });
}
/** Only a leader creates listeners/timers. Cleanup finishes before another local generation starts. */
export function startLeasedStand(database: Firestore, start: () => (() => Promise<void>), failed: () => void,
  options: { owner?: string; heartbeatMs?: number; leaseMs?: number } = {}) {
  const owner = options.owner ?? randomUUID(), heartbeat = options.heartbeatMs ?? HEARTBEAT_MS, duration = options.leaseMs ?? LEASE_MS;
  let stopped = false, services: (() => Promise<void>) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined, deadline: ReturnType<typeof setTimeout> | undefined;
  let cleanup = Promise.resolve();
  function demote() {
    clearTimeout(deadline);
    const stop = services; services = undefined;
    if (stop) cleanup = cleanup.then(stop).catch(failed);
    return cleanup;
  }
  let pending: Promise<void>;
  async function tick() {
    const began = Date.now();
    try {
      const acquired = await claimLease(database, owner, began, duration);
      if (stopped) return;
      // Never start work with a lease that expired while the transaction was pending.
      const remaining = began + duration - Date.now();
      if (!acquired || remaining <= 0) await demote();
      else {
        clearTimeout(deadline);
        deadline = setTimeout(() => { void demote(); }, remaining);
        await cleanup;
        if (!stopped && Date.now() < began + duration) services ??= start();
      }
    } catch { await demote(); if (!stopped) failed(); }
    if (!stopped) timer = setTimeout(() => { pending = tick(); }, heartbeat);
  }
  pending = tick();
  return async () => {
    stopped = true; clearTimeout(timer); clearTimeout(deadline);
    await demote(); await pending;
    // Graceful shutdown releases only our own lease. Crashes rely on expiry.
    await database.runTransaction(async (tx) => {
      const ref = database.doc('leases/stand'), snapshot = await tx.get(ref);
      if (snapshot.data()?.owner === owner) tx.delete(ref);
    }).catch(failed);
  };
}
