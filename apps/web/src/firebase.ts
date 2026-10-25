import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { resolveFirebaseConfig } from './firebase-config';

const { config, emulators } = resolveFirebaseConfig(import.meta.env);
export const sessionConfigured = config !== null;
const app = config ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
export const firestore = app ? getFirestore(app) : null;

const browserLocation = typeof window === 'undefined' ? undefined : window.location;
const demoLoopback = config?.projectId === 'demo-little-galaxy' && ['127.0.0.1', 'localhost'].includes(browserLocation?.hostname ?? '') && new URLSearchParams(browserLocation?.search).get('emulators') === '1';
export const isReadOnlySmoke = new URLSearchParams(browserLocation?.search).get('smoke') === 'readonly';

if ((emulators || demoLoopback) && auth && firestore) {
  // The page hostname also lets phones on the LAN reach the local emulators.
  const host = browserLocation?.hostname ?? '127.0.0.1';
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(firestore, host, 8080);
}

let authentication: Promise<void> | undefined;
export function startAnonymousSession(): Promise<void> {
  if (isReadOnlySmoke) return Promise.reject(new Error('Read-only smoke: authentication and writes are disabled'));
  if (!auth) return Promise.reject(new Error('Session not configured'));
  authentication ??= auth.authStateReady().then(async () => {
    if (!auth.currentUser) await signInAnonymously(auth);
  }).catch(() => {
    authentication = undefined;
    throw new Error('Saving is unavailable right now');
  });
  return authentication;
}

export async function anonymousUid(): Promise<string> {
  await startAnonymousSession();
  if (!auth?.currentUser) throw new Error('Session unavailable');
  return auth.currentUser.uid;
}
