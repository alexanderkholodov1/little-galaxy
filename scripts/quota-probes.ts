import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase/firestore';
import type { SeasonData } from '../packages/shared/src/index.js';
import { SEASON } from '../packages/shared/src/index.js';
import { availableHosts, listenActive, readHostCatalog } from '../apps/web/src/galaxy-data';
import { loadSeason, loadMemoryObject } from '../apps/web/src/season-data';
import { startMemoryWriter } from '../apps/stand/src/memory';
import { startSnapshotWriter } from '../apps/stand/src/snapshots';
import { writeMeteorShower } from '../apps/stand/src/meteors';
import { objectFeed } from '../apps/stand/src/object-feed';
import type { StandFence } from '../apps/stand/src/lease';
export type QuotaProbes = {
  home: number; reconnect: number; hiddenDeliveries: number; cachedCatalog: number; coldCatalog: number;
  liveReplay: number; staticChunksReplay: number; frozenReplay: number; objectAndPostcard: number;
  restartReads: number; restartWrites: number; restartBacklog: number; logChunks: number;
};
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(done: () => boolean) {
  const began = performance.now();
  while (!done()) { if (performance.now() - began > 15_000) throw new Error('Quota probe timed out'); await pause(20); }
}
/** Real production helpers and emulator documents; fixture/setup/verification calls are not workload reads. */
export async function measureQuotaProbes(admin: AdminFirestore, phone: Firestore, fence: StandFence, archive: SeasonData, objectId: string): Promise<QuotaProbes> {
  const result: QuotaProbes = { home: 0, reconnect: 0, hiddenDeliveries: 0, cachedCatalog: 0, coldCatalog: 0,
    liveReplay: 0, staticChunksReplay: 0, frozenReplay: 0, objectAndPostcard: 0,
    restartReads: 0, restartWrites: 0, restartBacklog: 20, logChunks: archive.manifest.log.length };
  // Exercise the production cache-miss path, then the actual Home-to-workshop cache hit.
  await readHostCatalog(phone, (n) => { result.coldCatalog += n; });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const visibility = new EventTarget(); let hidden = false;
  Object.defineProperty(visibility, 'visibilityState', { get: () => hidden ? 'hidden' : 'visible' });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: visibility });
  const errors: string[] = [];
  let delivered = 0, confirmed = false;
  const stop = listenActive(phone, (_objects, cache) => { if (!cache) confirmed = true; }, () => errors.push('phone'), (n) => { delivered += n; });
  try {
    await until(() => confirmed); result.home = delivered;
    await availableHosts(phone, (n) => { result.cachedCatalog += n; });
    hidden = true; visibility.dispatchEvent(new Event('visibilitychange'));
    const before = delivered;
    const shard = admin.doc('sky/f');
    await shard.update({ quotaProbe: true });
    await pause(100); result.hiddenDeliveries = delivered - before;
    confirmed = false; hidden = false; visibility.dispatchEvent(new Event('visibilitychange'));
    await until(() => confirmed); result.reconnect = delivered - before;
    await shard.update({ quotaProbe: FieldValue.delete() });
  } finally {
    stop();
    if (descriptor) Object.defineProperty(globalThis, 'document', descriptor);
    else Reflect.deleteProperty(globalThis, 'document');
  }
  if (result.hiddenDeliveries || result.cachedCatalog) throw new Error('Background/cache reduction failed');
  let reads = 0;
  const liveFile = async (collection: string, id: string) => {
    reads++;
    const snapshot = await admin.doc(`seasons/${SEASON}/${collection}/${id}`).get();
    return snapshot.exists ? snapshot.data()! : null;
  };
  const absent = async () => null;
  await loadSeason(undefined, { staticFile: absent, liveFile }); result.liveReplay = reads;
  reads = 0;
  await loadSeason(undefined, { staticFile: async (name) => archive.files[name] ?? null, liveFile }); result.staticChunksReplay = reads;
  reads = 0;
  await loadSeason(undefined, { staticFile: async (name) => name === 'manifest' ? archive.manifest : archive.files[name] ?? null, liveFile }); result.frozenReplay = reads;
  reads = 0;
  for (let i = 0; i < 2; i++) if (!await loadMemoryObject(objectId, undefined, { staticFile: absent, liveFile })) throw new Error('Public object probe missing');
  result.objectAndPostcard = reads;
  for (let i = 0; i < result.restartBacklog; i++) await writeMeteorShower(admin, undefined, undefined, fence);
  const feed = objectFeed();
  const observe = (n: number) => { result.restartReads += n; };
  const onWrite = (n: number) => { result.restartWrites += n; };
  const stopSnapshot = startSnapshotWriter(admin, () => errors.push('snapshot'), 10, observe, onWrite, fence, feed.subscribe);
  const stopMemory = startMemoryWriter(admin, () => errors.push('memory'), 10, observe, onWrite, fence, feed.publish);
  try {
    await until(() => result.restartWrites >= 2 || errors.length > 0);
    const manifest = (await admin.doc(`seasons/${SEASON}/meta/manifest`).get()).data();
    if (manifest?.eventCount !== archive.manifest.eventCount + result.restartBacklog) throw new Error('Restart lost archive history or backlog');
  } finally { await stopMemory(); await stopSnapshot(); }
  if (errors.length) throw new Error(`Quota probe services failed: ${errors.join(', ')}`);
  return result;
}
