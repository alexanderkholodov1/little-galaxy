import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  initialize: vi.fn(() => ({})), signIn: vi.fn(),
  auth: { authStateReady: vi.fn(), currentUser: null as object | null },
  connectAuth: vi.fn(), connectFirestore: vi.fn(),
}));
vi.mock('firebase/app', () => ({ initializeApp: mocks.initialize }));
vi.mock('firebase/auth', () => ({ initializeAuth: () => mocks.auth, indexedDBLocalPersistence:{},browserLocalPersistence:{},browserSessionPersistence:{}, browserPopupRedirectResolver:{}, signInAnonymously: mocks.signIn, connectAuthEmulator: mocks.connectAuth }));
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
afterEach(() => { vi.unstubAllEnvs(); history.replaceState(null, '', '/'); });

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

it('read-only smoke refuses identity creation and existing authenticated UIDs before any network call', async () => {
  history.replaceState(null, '', '/galaxy/create?smoke=readonly');
  mocks.auth.currentUser = { uid: 'existing' };
  const { startAnonymousSession, anonymousUid } = await import('./firebase');
  await expect(startAnonymousSession()).rejects.toThrow('Read-only smoke');
  await expect(anonymousUid()).rejects.toThrow('Read-only smoke');
  expect(mocks.signIn).not.toHaveBeenCalled();
  expect(mocks.auth.authStateReady).not.toHaveBeenCalled();
});
it('production rehearsal may connect only the explicit demo project on loopback', async () => {
  vi.stubEnv('DEV', false); vi.stubEnv('VITE_USE_EMULATORS', '');
  for (const [key, value] of Object.entries({ VITE_FIREBASE_API_KEY: 'demo-key', VITE_FIREBASE_AUTH_DOMAIN: 'demo-little-galaxy.firebaseapp.com', VITE_FIREBASE_PROJECT_ID: 'demo-little-galaxy', VITE_FIREBASE_STORAGE_BUCKET: 'demo', VITE_FIREBASE_MESSAGING_SENDER_ID: '0', VITE_FIREBASE_APP_ID: 'demo' })) vi.stubEnv(key, value);
  history.replaceState(null, '', '/galaxy/create?emulators=1');
  await import('./firebase');
  expect(mocks.connectAuth).toHaveBeenCalled(); expect(mocks.connectFirestore).toHaveBeenCalled();
  vi.resetModules(); vi.clearAllMocks(); vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'real-project');
  await import('./firebase');
  expect(mocks.initialize).toHaveBeenCalledWith(expect.objectContaining({projectId:'demo-little-galaxy'}));
  expect(mocks.connectAuth).toHaveBeenCalled(); expect(mocks.connectFirestore).toHaveBeenCalled();
});
it('allows production data helpers to import under Node without a browser window', async () => {
  vi.stubGlobal('window', undefined);
  try {
    const module = await import('./firebase');
    expect(module.isReadOnlySmoke).toBe(false);
    expect(mocks.signIn).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
