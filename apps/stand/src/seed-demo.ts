import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { LiveConfig } from '@little-galaxy/shared';
// This helper can never target the data project or load a credential file.
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || process.env.FIREBASE_PROJECT_ID !== 'demo-little-galaxy') {
  throw new Error('Demo seed requires FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 and FIREBASE_PROJECT_ID=demo-little-galaxy');
}
const app = initializeApp({ projectId: 'demo-little-galaxy' });
const config: LiveConfig = { schemaVersion: 1, appVersion: '0.2.0', seasonOpen: true, launches: true,
  comets: true, shake: false, shootingStars: false, assistantPublic: false, screenScene: 'galaxy' };
await getFirestore(app).doc('config/live').set(config);
await getFirestore(app).terminate();
console.log('Demo launch window opened. No live project was accessed.');
