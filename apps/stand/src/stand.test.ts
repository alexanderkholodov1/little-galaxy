import { afterEach, expect, it, vi } from 'vitest';
import { startStand } from './stand.js';
import { applicationDefault, initializeApp } from 'firebase-admin/app';

vi.mock('firebase-admin/app', () => ({ applicationDefault: vi.fn(), initializeApp: vi.fn() }));

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it('starts without credentials and reports its version and shared language defaults', () => {
  vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS', undefined);
  expect(startStand('0.1.0')).toBe('Little Galaxy stand v0.1.0 | languages: en, es | default: en');
  expect(initializeApp).not.toHaveBeenCalled();
});

it('refuses credentialed startup without an explicit project before loading credentials', () => {
  vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS', '/synthetic/unused.json');
  vi.stubEnv('FIREBASE_PROJECT_ID', ' ');
  expect(() => startStand('0.1.0')).toThrow('Set FIREBASE_PROJECT_ID');
  expect(applicationDefault).not.toHaveBeenCalled();
  expect(initializeApp).not.toHaveBeenCalled();
});

it('uses the configured project ID without assuming the project display name', () => {
  vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS', '/synthetic/unused.json');
  vi.stubEnv('FIREBASE_PROJECT_ID', ' demo-galaxy-suffix ');
  startStand('0.1.0');
  expect(applicationDefault).toHaveBeenCalledOnce();
  expect(initializeApp).toHaveBeenCalledWith({ credential: undefined, projectId: 'demo-galaxy-suffix' });
});

it('uses the demo emulator without loading application-default credentials', () => {
  vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080');
  vi.stubEnv('FIREBASE_PROJECT_ID', 'demo-little-galaxy');
  startStand('0.2.0');
  expect(applicationDefault).not.toHaveBeenCalled();
  expect(initializeApp).toHaveBeenCalledWith({ projectId: 'demo-little-galaxy' });
});
it('refuses a non-demo project in emulator mode', () => {
  vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080');
  vi.stubEnv('FIREBASE_PROJECT_ID', 'production-like');
  expect(() => startStand('0.2.0')).toThrow('demo-');
  expect(initializeApp).not.toHaveBeenCalled();
});
