import {PROTOTYPE_KERNEL} from '@little-galaxy/shared';
import { fairMutationLimit } from '../../../scripts/galaxy-quota.js';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import {
  canonicalHash,
  initialGalaxy,
  initialHead,
  initialMember,
  MASSES,
  quotaWindow,
} from '@little-galaxy/shared';
import type { BodyKind, Json, Member } from '@little-galaxy/shared';

export const galaxyMigrationPath = 'migrations/galaxies-v1';
// Provisioned once into config/admins; that document is the sole runtime allowlist.
export const DEFAULT_ADMIN_EMAIL = 'kholodov.alexander1@gmail.com';
type Row = { id: string; data: Record<string, unknown> };
function plain(value: unknown): Json {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === 'object' && value !== null) {
    if ('toMillis' in value && typeof value.toMillis === 'function')
      return value.toMillis() as number;
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  }
  throw new Error('Unsupported legacy value');
}
export async function planGalaxyImport(objects: Row[], sky: Row[], at: number) {
  const head = initialHead(at),
    members = new Map<string, Member>(),
    bodies: Row[] = [],
    legacyObjects = objects.map((r) => ({ id: r.id, data: plain(r.data) })),
    chunks: { id: string; data: { bodies: Json[] }; hash: string }[] = [];
  const sorted = [...objects].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const row of sorted) {
    if (row.data.status !== 'active') continue;
    const kind = row.data.type as BodyKind,
      mass = MASSES[kind];
    if (!mass || !row.data.orbit || !row.data.params || typeof row.data.ownerUid !== 'string')
      throw new Error(`Unsupported source object ${row.id}`);
    const owner = row.data.ownerUid,
      label =
        'm-' +
        createHash('sha256')
          .update('bad-2026:' + owner)
          .digest('hex')
          .slice(0, 24);
    const count = kind === 'binary' ? 2 : 1,
      compact = ['star', 'binary', 'pulsar', 'blackhole'].includes(kind) ? count : 0;
    const hole = kind === 'blackhole' ? 1 : 0,
      stellar = ['star', 'binary', 'pulsar'].includes(kind) ? 1 : 0;
    if (owner) {
      const m = members.get(owner) ?? initialMember(label, at);
      m.mass += mass;
      m.blackholes += hole;
      m.stellar += stellar;
      m.bodyIds.push(row.id);
      if (count === 2) m.bodyIds.push(row.id + ':b');
      m.launches++;
      if (m.bodyIds.length > 3 || m.mass > 3100000 || m.blackholes > 1 || m.stellar > 1)
        throw new Error('Legacy player capacity exceeded');
      members.set(owner, m);
    }
    let system = Object.entries(head.systems).find(
      ([, s]) =>
        s.bodies + count <= 32 &&
        s.mass + mass <= 3200000 &&
        s.compact + compact <= 2 &&
        s.blackholes + hole <= 1,
    );
    if (!system) {
      const id = String(Object.keys(head.systems).length);
      if (Number(id) >= 32) throw new Error('Legacy system capacity exceeded');
      const nursery = compact ? 0 : 1;
      head.systems[id] = {
        bodies: nursery,
        mass: nursery * 1000000,
        compact: nursery,
        giants: 0,
        blackholes: 0,
        ordinaryMass: 0,
      };
      head.bodies += nursery;
      head.mass += nursery * 1000000;
      system = [id, head.systems[id]];
    }
    const [systemId, s] = system;
    s.bodies += count;
    s.mass += mass;
    s.compact += compact;
    s.blackholes += hole;
    s.giants += kind === 'giant' ? 1 : 0;
    s.ordinaryMass += compact ? 0 : mass;
    head.bodies += count;
    head.mass += mass;
    head.blackholes += hole;
    if (
      head.bodies > 1024 ||
      head.mass > 96000000 ||
      head.blackholes > 4 ||
      s.ordinaryMass > 200000 ||
      s.giants > 6
    )
      throw new Error('Legacy galaxy capacity exceeded');
    const { ownerUid: _owner, ...publicLegacy } = row.data;
    void _owner;
    bodies.push({
      id: row.id,
      data: {
        id: row.id,
        memberId: label,
        displayName: 'Anonymous',
        kind,
        system: systemId,
        parent: '',
        moons: 0,
        design: plain(row.data.params),
        tombstone: false,
        lastAction: '',
        legacy: plain(publicLegacy),
      },
    });
  }
  let chunkBodies: Json[] = [],
    chunkBytes = Buffer.byteLength(JSON.stringify({ bodies: [] }));
  const flush = async () => {
    if (!chunkBodies.length) return;
    const data = { bodies: chunkBodies };
    chunks.push({ id: String(chunks.length), data, hash: await canonicalHash(data) });
    chunkBodies = [];
    chunkBytes = Buffer.byteLength(JSON.stringify({ bodies: [] }));
  };
  for (const body of bodies) {
    const value = plain(body.data),
      bytes = Buffer.byteLength(JSON.stringify(value));
    if (bytes + 13 > 60000) throw new Error('Legacy genesis chunk capacity exceeded');
    if (chunkBytes + bytes + (chunkBodies.length ? 1 : 0) > 60000) await flush();
    chunkBytes += bytes + (chunkBodies.length ? 1 : 0);
    chunkBodies.push(value);
  }
  await flush();
  // Keep the exact private source separately; public genesis excludes technical UID mappings.
  return {
    head,
    bodies,
    members: [...members].map(([id, data]) => ({ id, data })),
    chunks,
    legacyObjects,
    legacySky: sky.map((r) => ({ id: r.id, data: plain(r.data) })),
  };
}

export async function prepareGalaxies(database: Firestore) {
  return database.runTransaction(async (tx) => {
    const markerRef = database.doc(galaxyMigrationPath),
      liveRef = database.doc('config/live');
    const [marker, live] = await tx.getAll(markerRef, liveRef);
    if (marker.data()?.complete) return false;
    if (!live.exists || typeof live.data()?.seasonOpen !== 'boolean')
      throw new Error('Missing or invalid config/live; initialize alpha.1 first');
    if (!marker.exists)
      tx.create(markerRef, {
        seasonOpenBefore: live.data()!.seasonOpen,
        createdAt: live.readTime.toMillis(),
        deploymentStarted: false,
      });
    // A failed earlier run restored the season and cleared this; record it again before closing.
    else if (marker.data()?.seasonOpenBefore === undefined)
      tx.update(markerRef, { seasonOpenBefore: live.data()!.seasonOpen });
    tx.update(liveRef, { seasonOpen: false });
    return true;
  });
}
async function sourcePlan(database: Firestore) {
  const [marker, live, objects, sky] = await Promise.all([
    database.doc(galaxyMigrationPath).get(),
    database.doc('config/live').get(),
    database.collection('objects').get(),
    database.collection('sky').get(),
  ]);
  if (live.data()?.seasonOpen !== false) throw new Error('Close season before galaxy migration');
  if (!marker.exists) throw new Error('Prepare galaxy migration first');
  const plan = await planGalaxyImport(
    objects.docs.map((d) => ({ id: d.id, data: d.data() })),
    sky.docs.map((d) => ({ id: d.id, data: d.data() })),
    marker.data()!.createdAt,
  );
  const fairLimit = fairMutationLimit(plan.chunks.length);
  if (fairLimit === null)
    throw new Error(
      'Imported genesis exceeds the fair quota envelope; archive or split the source before release.',
    );
  return { marker: marker.data()!, plan, fairLimit };
}
export async function migrateGalaxies(database: Firestore) {
  if ((await database.doc(galaxyMigrationPath).get()).data()?.complete) return false;
  const { marker, plan, fairLimit } = await sourcePlan(database),
    root = 'galaxies/bad-2026';
  const markerHash = await canonicalHash({ objects: plan.legacyObjects, sky: plan.legacySky });
  await database.runTransaction(async (tx) => {
    const ref = database.doc(galaxyMigrationPath),
      snap = await tx.get(ref),
      existing = await tx.get(database.doc(root));
    if (snap.data()?.sourceHash && snap.data()!.sourceHash !== markerHash)
      throw new Error('Migration source changed during recovery');
    if (existing.exists && !snap.data()?.sourceHash)
      throw new Error('Destination galaxy already exists');
    tx.update(ref, { sourceHash: markerHash });
  });
  const rows: { path: string; data: object }[] = [];
  for (const r of plan.bodies) rows.push({ path: `${root}/objects/${r.id}`, data: r.data });
  for (const r of plan.members)
    rows.push({
      path: `${root}/members/${r.id}`,
      data: { ...r.data, updatedTime: FieldValue.serverTimestamp(), mutationTime: null },
    });
  for (const r of plan.chunks) rows.push({ path: `${root}/genesis/${r.id}`, data: r.data });
  for (const r of plan.legacyObjects)
    rows.push({ path: `${root}/legacyObjects/${r.id}`, data: { value: r.data } });
  for (const r of plan.legacySky)
    rows.push({ path: `${root}/legacySky/${r.id}`, data: { value: r.data } });
  // A rolling year includes Pacific DST windows. Provisioned by the release, never by a phone.
  let day = quotaWindow(marker.createdAt).start;
  for (let i = 0; i < 370; i++) {
    const w = quotaWindow(day);
    rows.push({ path: `quotaWindows/${w.id}`, data: w });
    day = w.end + 1;
  }
  for (let start = 0; start < rows.length; start += 350) {
    const copied = await database.runTransaction(async (tx) => {
      const state = await tx.get(database.doc(galaxyMigrationPath));
      if (state.data()?.complete) return false;
      if (state.data()?.sourceHash !== markerHash)
        throw new Error('Migration source changed during copy');
      for (const r of rows.slice(start, start + 350)) tx.set(database.doc(r.path), r.data);
      return true;
    });
    if (!copied) return false;
  }
  // Read back the immutable public genesis before publishing its authenticated manifest.
  for (const r of plan.chunks)
    if (
      (await canonicalHash((await database.doc(`${root}/genesis/${r.id}`).get()).data())) !== r.hash
    )
      throw new Error('Genesis read-back failed');
  await database.runTransaction(async (tx) => {
    const ref = database.doc(galaxyMigrationPath),
      liveRef = database.doc('config/live'),
      adminsRef = database.doc('config/admins');
    const [state, live, admins] = await tx.getAll(ref, liveRef, adminsRef);
    if (state.data()?.complete) return;
    if (live.data()?.seasonOpen !== false) throw new Error('Migration window changed');
    const g = {
      ...initialGalaxy('bad-2026', 'operator', 'BAD 2026', marker.createdAt, PROTOTYPE_KERNEL),
      dailyLimit: fairLimit,
      genesis: plan.chunks.map((c) => ({ id: c.id, hash: c.hash })),
    };
    tx.set(database.doc(root), g);
    tx.set(database.doc(`${root}/control/head`), {
      ...plan.head,
      updatedTime: FieldValue.serverTimestamp(),
    });
    if (!admins.exists) tx.create(adminsRef, { emails: [DEFAULT_ADMIN_EMAIL] });
    tx.update(liveRef, {
      activePublicGalaxyId: 'bad-2026',
      boothGalaxyId: 'bad-2026',
      dataLayerVersion: 2,
    });
    tx.update(ref, { complete: true });
  });
  return true;
}
export async function restoreGalaxySeason(database: Firestore) {
  await database.runTransaction(async (tx) => {
    const ref = database.doc(galaxyMigrationPath),
      liveRef = database.doc('config/live'),
      [state, live] = await tx.getAll(ref, liveRef),
      m = state.data();
    if (!m || m.seasonOpenBefore === undefined) return;
    if (m.deploymentStarted && !m.complete)
      throw new Error('SEASON KEPT CLOSED: galaxy migration incomplete; rerun release-sky');
    if (live.data()?.seasonOpen !== m.seasonOpenBefore)
      tx.update(liveRef, { seasonOpen: m.seasonOpenBefore });
    tx.update(ref, { seasonOpenBefore: FieldValue.delete() });
  });
}
export async function releaseGalaxies(
  database: Firestore,
  deploy: () => Promise<void>,
  preflight: () => Promise<void>,
) {
  await preflight();
  let failure: unknown;
  try {
    if (await prepareGalaxies(database)) await sourcePlan(database);
    await database.doc(galaxyMigrationPath).set({ deploymentStarted: true }, { merge: true });
    await deploy();
    await migrateGalaxies(database);
  } catch (error) {
    failure = error;
  }
  try {
    await restoreGalaxySeason(database);
  } catch (error) {
    throw new Error(
      `${failure instanceof Error ? failure.message : ''}\n${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  if (failure) throw failure;
}
