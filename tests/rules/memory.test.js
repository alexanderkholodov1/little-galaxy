import { execFileSync } from 'node:child_process';
import { readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { launchPlanet, editObject, relaunchObject } from '../../apps/web/src/galaxy-data.ts';
import { buildSeason, publicObject, readSeason, startMemoryWriter } from '../../apps/stand/src/memory.ts';
import { freezeSeason } from '../../apps/stand/src/freeze-season.ts';
import { compareIds, objectBucket, orbitFromVelocity, presets, readLog, replay, replayScene, worldPosition } from '../../packages/shared/src/index.ts';
let env, app, admin, publicLog;
beforeAll(async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  env = await initializeTestEnvironment({ projectId: 'demo-little-galaxy', firestore: { host, port: Number(port), rules: await readFile('firestore.rules', 'utf8') } });
  await env.clearFirestore();
  app = initializeApp({ projectId: 'demo-little-galaxy' }, 'memory-test'); admin = getFirestore(app);
});
afterAll(async () => { await env?.cleanup(); if (admin) await admin.terminate(); if (app) await deleteApp(app); });
it('replays a recorded emulator session exactly, publishes cheaply, and exports the same deterministic format', async () => {
  const database = env.authenticatedContext('memory-visitor').firestore();
  await admin.doc('config/live').set({ schemaVersion: 1, seasonOpen: true, launches: true });
  const records = [];
  const record = async () => {
    const source = await admin.collection('objects').get();
    const events = await admin.collection('events').get();
    const at = Math.max(...events.docs.map((d) => d.data().at.toMillis()));
    records.push({ at, state: source.docs.map((d) => publicObject(d.id, d.data())).sort((a, b) => compareIds(a.id, b.id)) });
  };
  const age = () => admin.doc('users/memory-visitor').update({ lastWriteAt: Timestamp.fromMillis(Date.now() - 3000) });
  const draft = { type: 'planet', nameKey: 'quiet-aurora', params: presets.planet[0] };
  const first = await launchPlanet(database, 'memory-visitor', draft, orbitFromVelocity(0, 2.58, 0, Date.now())); await record();
  await age(); await editObject(database, 'memory-visitor', { ...draft, nameKey: 'bright-tide', params: presets.planet[1] }); await record();
  await age(); await launchPlanet(database, 'memory-visitor', { type: 'star', nameKey: 'quiet-aurora', params: presets.star[1] }, orbitFromVelocity(0, 8, 0, Date.now())); await record();
  await age(); await relaunchObject(database, 'memory-visitor', first); await record();
  const data = await readSeason(admin), chunks = data.manifest.log.map((id) => readLog(data.files[id]));
  expect(replay(chunks, records[0].at - 1)).toEqual([]);
  for (const [index, { at, state }] of records.entries()) {
    const next = records[index + 1];
    if (next) expect(replay(chunks, (at + next.at) / 2)).toEqual(state);
    expect(replay(chunks, at)).toEqual(state);
    // Orbit phase is computed at historical time, including between actions.
    const active = replayScene(state);
    expect(replayScene(replay(chunks, at)).map((o) => worldPosition(o, at + 1234))).toEqual(active.map((o) => worldPosition(o, at + 1234)));
  }
  const errors = [];
  const stop = startMemoryWriter(admin, () => errors.push('failed'), 10);
  try {
    await expect.poll(async () => (await admin.doc('seasons/bad-2026/meta/manifest').get()).data()?.eventCount, { timeout: 10000 }).toBe(data.manifest.eventCount);
    expect(errors).toEqual([]);
    const publicDb = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(publicDb, 'seasons/bad-2026/meta/manifest')));
    publicLog = data.manifest.log[0];
    const publishedLog = await assertSucceeds(getDoc(doc(publicDb, `seasons/bad-2026/log/${publicLog}`)));
    expect(readLog(publishedLog.data())).toEqual(chunks[0]);
    const shard = (await assertSucceeds(getDoc(doc(publicDb, `seasons/bad-2026/log/${objectBucket(first)}`)))).data();
    expect(shard.objects.find((o) => o.id === first).status).toBe('active');
    expect(JSON.stringify(shard)).not.toContain('memory-visitor');
    expect(data.manifest.log.length + 1).toBeLessThanOrEqual(3);
  } finally { await stop(); }
  // CI uses its workspace scratch directory; local acceptance may opt into the designated task scratch.
  const base = process.env.GALAXY_MEMORY_EXPORT_DIR ?? join(process.cwd(), '.memory-test');
  const a = `${base}-${Date.now()}-a`, b = `${base}-${Date.now()}-b`, c = `${base}-${Date.now()}-cli`;
  try {
    const firstExport = await freezeSeason(admin, a); await freezeSeason(admin, b);
    const output = execFileSync('pnpm', ['--filter', '@little-galaxy/stand', 'freeze-season', c], { encoding: 'utf8', timeout: 30000, env: { ...process.env, FIREBASE_PROJECT_ID: 'demo-little-galaxy' } });
    expect(output).toContain('Season exported; live configuration unchanged.');
    expect(firstExport).toEqual(data);
    const names = await readdir(a);
    for (const name of names) {
      expect(await readFile(join(a, name), 'utf8')).toBe(await readFile(join(b, name), 'utf8'));
      expect(await readFile(join(a, name), 'utf8')).toBe(await readFile(join(c, name), 'utf8'));
    }
    expect(JSON.parse(await readFile(join(a, 'manifest.json'), 'utf8'))).toEqual(data.manifest);
    expect((await admin.doc('config/live').get()).data().seasonOpen).toBe(true);
    const objects = await admin.collection('objects').get(), events = await admin.collection('events').get();
    expect(buildSeason(objects.docs, events.docs)).toEqual(data);
  } finally {
    await rm(a, { recursive: true, force: true });
    await rm(b, { recursive: true, force: true });
    await rm(c, { recursive: true, force: true });
  }
});
it.each(['public', 'signed'])('%s season surface permits gets only and denies every client mutation', async (identity) => {
  const db = identity === 'public' ? env.unauthenticatedContext().firestore() : env.authenticatedContext('reader').firestore();
  for (const path of ['seasons/bad-2026/meta/manifest', 'seasons/bad-2026/log/objects-0', `seasons/bad-2026/log/${publicLog}`]) {
    await assertSucceeds(getDoc(doc(db, path)));
    await assertFails(setDoc(doc(db, path), { format: 1 }));
    await assertFails(updateDoc(doc(db, path), { format: 2 }));
    await assertFails(deleteDoc(doc(db, path)));
    await assertFails(getDocs(collection(db, path.slice(0, path.lastIndexOf('/')))));
  }
  await assertFails(getDocs(collection(db, 'seasons')));
  await assertFails(getDocs(collectionGroup(db, 'log')));
  await assertFails(getDoc(doc(db, 'seasons/other/log/objects-0')));
  await assertFails(getDoc(doc(db, 'seasons/bad-2026/meta/other')));
  await assertFails(getDoc(doc(db, 'seasons/bad-2026/log/internal')));
});
