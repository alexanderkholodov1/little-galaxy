import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
export function meteorInterval(config: Record<string, unknown> | undefined, random = Math.random): number | null {
  if (config?.schemaVersion !== 1 || config.seasonOpen !== true || config.meteorShowers !== true) return null;
  const min = config.meteorMinSeconds ?? 360, max = config.meteorMaxSeconds ?? 900;
  if (typeof min !== 'number' || typeof max !== 'number' || !Number.isFinite(min) || !Number.isFinite(max)
    || min < 60 || max > 3600 || max < min) return null;
  return (min + Math.max(0, Math.min(1, random())) * (max - min)) * 1000;
}
/** Recheck the switch at commit; one append-only event per shower, no client can write these. */
export async function writeMeteorShower(database: Firestore): Promise<boolean> {
  const event = database.collection('events').doc();
  return database.runTransaction(async (tx) => {
    const config = await tx.get(database.doc('config/live'));
    if (meteorInterval(config.data(), () => 0) === null) return false;
    tx.create(event, { schemaVersion: 1, type: 'meteorShower', uid: 'stand', objectId: '',
      at: FieldValue.serverTimestamp(), payload: { count: 12 } });
    return true;
  });
}
export function startMeteorScheduler(database: Firestore, error: () => void, random = Math.random, clock = { setTimeout, clearTimeout }) {
  let stopped = false, config: Record<string, unknown> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined, pending: Promise<unknown> | undefined;
  function schedule() {
    clock.clearTimeout(timer);
    const delay = meteorInterval(config, random);
    if (stopped || delay === null || pending) return;
    timer = clock.setTimeout(() => {
      pending = writeMeteorShower(database).catch(error).finally(() => { pending = undefined; schedule(); });
    }, delay);
  }
  const unsubscribe = database.doc('config/live').onSnapshot((snapshot) => {
    config = snapshot.data(); schedule();
  }, () => { config = undefined; clock.clearTimeout(timer); error(); });
  return async () => { stopped = true; clock.clearTimeout(timer); unsubscribe(); await pending; };
}
