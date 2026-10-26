import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

let environment;
const projectId = 'demo-little-galaxy';
const paths = ['probe/existing', 'probe/existing/nested/existing', 'migrations/sky-v1', 'arbitrary/player-write', 'galaxies/g/unrecognized/document'];
// No domain document schemas exist yet. Exercise the existing shared VersionFile contract.
/** @type {import('../../packages/shared/src/index.ts').VersionFile} */
const fixture = { version: '0.1.0', commit: null, builtAt: '2026-10-15T00:00:00.000Z' };

beforeAll(async () => {
  const address = process.env.FIRESTORE_EMULATOR_HOST;
  if (!address) throw new Error('Run pnpm run test:rules to start the Firestore emulator.');
  const [host, port] = address.split(':');
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { host, port: Number(port), rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
  await environment.withSecurityRulesDisabled(async (context) => {
    for (const path of paths) await setDoc(doc(context.firestore(), path), fixture);
  });
});

afterAll(async () => { await environment?.cleanup(); });

describe.each(['signed out', 'signed in'])('%s: deny-all recursive match', (identity) => {
  it.each(paths)('denies get, list, create, update and delete at %s', async (path) => {
    const context = identity === 'signed in' ? environment.authenticatedContext('visitor', { firebase: { sign_in_provider: 'anonymous' } }) : environment.unauthenticatedContext();
    const database = context.firestore();
    const existing = doc(database, path);
    await assertFails(getDoc(existing));
    await assertFails(getDoc(doc(database, `${path}-missing`)));
    await assertFails(getDocs(collection(database, path.slice(0, path.lastIndexOf('/')))));
    await assertFails(getDocs(collectionGroup(database, 'nested')));
    await assertFails(setDoc(doc(database, `${path}-new`), fixture));
    await assertFails(setDoc(existing, { ...fixture, version: '0.1.1' }));
    await assertFails(updateDoc(existing, { version: '0.1.1' }));
    await assertFails(deleteDoc(existing));
  });
});
