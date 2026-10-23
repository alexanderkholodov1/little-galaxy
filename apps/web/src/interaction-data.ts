import { collection, doc, limitToLast, onSnapshot, orderBy, query, runTransaction, serverTimestamp, Timestamp, where } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { interactionClock, interactionCooldown, interactionFlag, MAX_INTERACTIONS_PER_DAY, utcDay, validInteraction } from '@little-galaxy/shared';
import type { GalaxyUser, InteractionType } from '@little-galaxy/shared';
import { waitForAnonymousUid } from './session-uid';
export class InteractionError extends Error {
  constructor(public reason: 'cooldown' | 'closed' | 'limit' | 'offline', public retryAfter = 2200) { super(reason); }
}
/** Exactly two writes; no galaxy reads, event reads, object writes or offline gesture queue. */
export async function sendInteraction(database: Firestore, uid: string, type: InteractionType, payload: Record<string, unknown>) {
  if (!validInteraction(type, payload)) throw new Error('Invalid interaction');
  const event = doc(collection(database, 'events'));
  await runTransaction(database, async (tx) => {
    const ref = doc(database, 'users', uid), user = await tx.get(ref);
    const config = await tx.get(doc(database, 'config', 'live'));
    if (!config.data()?.seasonOpen || config.data()?.[interactionFlag[type]] !== true) throw new InteractionError('closed');
    const old = user.data() as GalaxyUser<Timestamp> | undefined;
    const now = Date.now(), day = utcDay(now), clock = interactionClock[type];
    const remaining = old ? Math.max(2000 - (now - old.lastWriteAt.toMillis()), interactionCooldown[type] - (now - old[clock].toMillis())) : 0;
    if (remaining > 0) throw new InteractionError('cooldown', remaining + 300);
    const count = old?.interactionDay === day ? (old.interactionsToday ?? 0) + 1 : 1;
    if (count > MAX_INTERACTIONS_PER_DAY) throw new InteractionError('limit');
    const at = serverTimestamp();
    const base = old ?? { schemaVersion: 1, activeObjectId: '', launchesToday: 0, launchDay: day,
      lastShakeAt: Timestamp.fromMillis(0), lastCometAt: Timestamp.fromMillis(0), lastStarAt: Timestamp.fromMillis(0) };
    tx.set(ref, { ...base, lastWriteAt: at, [clock]: at, interactionDay: day, interactionsToday: count, action: type, writeId: event.id });
    tx.set(event, { schemaVersion: 1, uid, objectId: base.activeObjectId, type, at, payload });
  });
}
export interface ScreenEvent { id: string; type: string; objectId: string; at: number; payload: Record<string, unknown> }
export function readScreenEvent(id: string, data: Record<string, unknown>): ScreenEvent | null {
  const at = data.at instanceof Timestamp ? data.at.toMillis() : NaN;
  if (data.schemaVersion !== 1 || !Number.isFinite(at) || typeof data.type !== 'string' || typeof data.objectId !== 'string'
    || !data.payload || typeof data.payload !== 'object' || Array.isArray(data.payload)) return null;
  const payload = data.payload as Record<string, unknown>;
  if (['shake', 'comet', 'shootingStar'].includes(data.type) && !validInteraction(data.type as InteractionType, payload)) return null;
  if (!['shake', 'comet', 'shootingStar', 'launch', 'relaunch', 'edit', 'meteorShower'].includes(data.type)) return null;
  return { id, type: data.type, objectId: data.objectId, at, payload };
}
/** Rebase every 45s; cursor from the last seen event to eliminate overlapping re-queries. Query reads at most 100 rows, never the season log. */
export function listenRecentEvents(database: Firestore, next: (events: ScreenEvent[]) => void, error: () => void) {
  let stopped = false, unsubscribe: (() => void) | undefined, timer: ReturnType<typeof setInterval> | undefined;
  let generation = 0;
  let lastSeenAt: number | undefined;
  const seen = new Map<string, number>();
  void waitForAnonymousUid().then(() => {
    if (stopped) return;
    const attach = () => {
      unsubscribe?.();
      const current = ++generation;
      const now = Date.now();
      const floor = now - 60_000;
      const cursor = lastSeenAt !== undefined && lastSeenAt > floor ? lastSeenAt : floor;
      for (const [id, at] of seen) if (at < now - 120_000) seen.delete(id);
      unsubscribe = onSnapshot(query(collection(database, 'events'), where('at', '>', Timestamp.fromMillis(cursor)),
        orderBy('at'), limitToLast(100)), { includeMetadataChanges: true }, (snapshot) => {
        if (stopped || current !== generation || snapshot.metadata.fromCache) return;
        const fresh: ScreenEvent[] = [];
        for (const document of snapshot.docs) {
          const data = document.data();
          const atMillis = data?.at?.toMillis?.();
          if (typeof atMillis === 'number' && (lastSeenAt === undefined || atMillis > lastSeenAt)) {
            lastSeenAt = atMillis;
          }
          if (seen.has(document.id)) continue;
          seen.set(document.id, now);
          const event = readScreenEvent(document.id, data);
          if (event && event.at > Date.now() - 10_000 && event.at <= Date.now() + 5000) fresh.push(event);
        }
        next(fresh);
      }, () => { if (!stopped && current === generation) error(); });
    };
    attach(); timer = setInterval(attach, 45_000);
  }).catch(() => { if (!stopped) error(); });
  return () => { stopped = true; generation++; unsubscribe?.(); clearInterval(timer); seen.clear(); lastSeenAt = undefined; };
}
