import { describe, expect, it } from 'vitest';
import { resolveFirebaseConfig } from './firebase-config';

const env = {
  DEV: true, VITE_FIREBASE_API_KEY: 'public-key', VITE_FIREBASE_AUTH_DOMAIN: 'example.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'example', VITE_FIREBASE_STORAGE_BUCKET: 'example.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '123', VITE_FIREBASE_APP_ID: 'app',
} as ImportMetaEnv;

describe('Firebase configuration', () => {
  it('reads all six environment values', () => {
    expect(resolveFirebaseConfig(env)).toEqual({ emulators: false, config: {
      apiKey: 'public-key', authDomain: 'example.firebaseapp.com', projectId: 'example',
      storageBucket: 'example.appspot.com', messagingSenderId: '123', appId: 'app',
    } });
  });
  it('returns an unconfigured state for every missing or empty value', () => {
    for (const key of Object.keys(env).filter((key) => key.startsWith('VITE_FIREBASE_'))) {
      for (const value of [undefined, '', ' ']) expect(resolveFirebaseConfig({ ...env, [key]: value }).config).toBeNull();
    }
  });
  it('forces a demo project and dummy config only in dev emulator mode', () => {
    const demo = resolveFirebaseConfig({ ...env, VITE_USE_EMULATORS: '1' });
    expect(demo.emulators).toBe(true);
    expect(demo.config?.projectId).toBe('demo-little-galaxy');
    expect(demo.config?.apiKey).toBe('demo-key');
    expect(resolveFirebaseConfig({ ...env, DEV: false, VITE_USE_EMULATORS: '1' }).emulators).toBe(false);
    expect(resolveFirebaseConfig({ ...env, DEV: false, VITE_USE_EMULATORS: '1' }).config?.projectId).toBe('example');
  });
});
