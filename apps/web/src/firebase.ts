import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { resolveFirebaseConfig } from './firebase-config';

const { config, emulators } = resolveFirebaseConfig(import.meta.env);
export const sessionConfigured = config !== null;
const app = config ? initializeApp(config) : null;
const auth = app ? getAuth(app) : null;
export const firestore = app ? getFirestore(app) : null;

if (emulators && auth && firestore) {
  // The page hostname also lets phones on the LAN reach the local emulators.
  const host = window.location.hostname;
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(firestore, host, 8080);
}

let authentication: Promise<void> | undefined;
export function startAnonymousSession(): Promise<void> {
  if (!auth) return Promise.reject(new Error('Session not configured'));
  authentication ??= auth.authStateReady().then(async () => {
    if (!auth.currentUser) await signInAnonymously(auth);
  }).catch(() => {
    authentication = undefined;
    throw new Error('Saving is unavailable right now');
  });
  return authentication;
}
