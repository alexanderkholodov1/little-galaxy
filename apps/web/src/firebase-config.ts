import type { FirebaseOptions } from 'firebase/app';

export function resolveFirebaseConfig(env: ImportMetaEnv): { config: FirebaseOptions | null; emulators: boolean } {
  const emulators = env.DEV && env.VITE_USE_EMULATORS === '1';
  if (emulators) return { emulators, config: {
    apiKey: 'demo-key', authDomain: 'demo-little-galaxy.firebaseapp.com', projectId: 'demo-little-galaxy',
    storageBucket: 'demo-little-galaxy.appspot.com', messagingSenderId: '000000000000', appId: 'demo-app',
  } };
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID, storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: env.VITE_FIREBASE_APP_ID,
  };
  return { emulators, config: Object.values(config).every((value) => value?.trim()) ? config : null };
}
