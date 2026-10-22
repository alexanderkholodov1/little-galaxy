import { readFileSync } from 'node:fs';
import { getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { startStand } from './stand.js';
import { startSnapshotWriter } from './snapshots.js';
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
try {
  console.log(startStand(version));
  if (getApps().length) {
    const stop = startSnapshotWriter(getFirestore(), () => console.error('Snapshot unavailable. Check connection or snapshot capacity.'));
    const shutdown = () => { void stop().then(() => process.exit(0)); };
    process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
  }
} catch {
  console.error('Stand could not initialize. Check the project ID and credential file path.');
  process.exitCode = 1;
}
