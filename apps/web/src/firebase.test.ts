import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  initialize: vi.fn(() => ({})), signIn: vi.fn(),
  auth: { authStateReady: vi.fn(), currentUser: null as object | null },
  connectAuth: vi.fn(), connectFirestore: vi.fn(),
}));
vi.mock('firebase/app', () => ({ initializeApp: mocks.initialize }));
vi.mock('firebase/auth', () => ({ getAuth: () => mocks.auth, signInAnonymously: mocks.signIn, connectAuthEmulator: mocks.connectAuth }));
vi.mock('firebase/firestore', () => ({ getFirestore: () => ({}), connectFirestoreEmulator: mocks.connectFirestore }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.auth.currentUser = null;
  mocks.auth.authStateReady.mockResolvedValue(undefined);
  mocks.signIn.mockResolvedValue({});
  vi.stubEnv('VITE_USE_EMULATORS', '1');
  vi.stubEnv('DEV', true);
});
afterEach(() => vi.unstubAllEnvs());

it('makes one sign-in across concurrent calls', async () => {
  const { startAnonymousSession } = await import('./firebase');
  const first = startAnonymousSession();
  expect(startAnonymousSession()).toBe(first);
  await Promise.all([first, startAnonymousSession()]);
  expect(mocks.signIn).toHaveBeenCalledTimes(1);
});
it('resets the memoized session after failure', async () => {
  mocks.signIn.mockRejectedValueOnce(new Error('SDK detail'));
  const { startAnonymousSession } = await import('./firebase');
  await expect(startAnonymousSession()).rejects.toThrow('Saving is unavailable right now');
  await expect(startAnonymousSession()).resolves.toBeUndefined();
  expect(mocks.signIn).toHaveBeenCalledTimes(2);
});
it('reuses an existing authenticated user', async () => {
  mocks.auth.currentUser = {};
  const { startAnonymousSession } = await import('./firebase');
  await startAnonymousSession();
  expect(mocks.signIn).not.toHaveBeenCalled();
});
it('does not initialize Firebase when configuration is absent', async () => {
  vi.stubEnv('VITE_USE_EMULATORS', '');
  vi.stubEnv('VITE_FIREBASE_API_KEY', '');
  const { startAnonymousSession, sessionConfigured } = await import('./firebase');
  expect(sessionConfigured).toBe(false);
  expect(mocks.initialize).not.toHaveBeenCalled();
  await expect(startAnonymousSession()).rejects.toThrow('Session not configured');
});
