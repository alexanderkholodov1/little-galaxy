import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { expect, it } from 'vitest';
import { migrateSky } from '../../apps/stand/src/sky.ts';

it('does not rewrite a completed migration even when the season stays closed', async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Demo emulator required');
  const app = initializeApp({ projectId: 'demo-little-galaxy' }, 'sky-idempotency'); const db = getFirestore(app);
  try {
    await db.recursiveDelete(db.collection('objects'));
    await db.doc('migrations/sky-v1').delete();
    await db.doc('config/live').set({ seasonOpen: false });
    await migrateSky(db);
    await db.doc('sky/0').update({ entries: { subsequent: { id: 'visitor-after-migration' } } });
    const before = (await db.collection('sky').get()).docs.map((doc) => doc.updateTime);
    await migrateSky(db);
    expect((await db.collection('sky').get()).docs.map((doc) => doc.updateTime)).toEqual(before);
  } finally { await db.terminate(); await deleteApp(app); }
});
