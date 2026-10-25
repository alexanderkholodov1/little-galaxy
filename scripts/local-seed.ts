// Seeds the local emulators with one open galaxy so phones on the same Wi-Fi share a sky without Firebase.
// Idempotent: an existing galaxy, head or selection is kept, so restarting with saved data never resets the sky.
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { initialGalaxy, initialHead, quotaWindow } from '../packages/shared/src/galaxy-store.js';
import { PROTOTYPE_KERNEL } from '../packages/shared/src/index.js';

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is required: this script only seeds the emulators');
const id = process.env.LOCAL_GALAXY_ID ?? 'local-bad-2026';
const name = process.env.LOCAL_GALAXY_NAME ?? 'BAD 2026 (local)';
const admin = process.env.LOCAL_ADMIN_EMAIL ?? 'kholodov.alexander1@gmail.com';
const app = initializeApp({ projectId: 'demo-little-galaxy' });
const db = getFirestore(app);
try {
  const now = Date.now(), window = quotaWindow(now);
  const create = async (path: string, data: Record<string, unknown>) => {
    const ref = db.doc(path);
    if (!(await ref.get()).exists) await ref.set(data);
  };
  await create(`galaxies/${id}`, initialGalaxy(id, 'operator', name, now, PROTOTYPE_KERNEL) as unknown as Record<string, unknown>);
  await create(`galaxies/${id}/control/head`, initialHead(now) as unknown as Record<string, unknown>);
  await create('config/admins', { emails: [admin] });
  await create('config/live', { dataLayerVersion: 2, seasonOpen: true, launches: true, activePublicGalaxyId: id, boothGalaxyId: id });
  await db.doc(`quotaWindows/${window.id}`).set(window);
  console.log(`Local galaxy "${name}" (${id}) is open.`);
} finally { await db.terminate(); await deleteApp(app); }
