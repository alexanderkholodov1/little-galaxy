import { afterEach, expect, it, vi } from 'vitest';
import { startStand } from './stand.js';

afterEach(() => vi.unstubAllEnvs());

it('starts without credentials and reports its version and shared language defaults', () => {
  vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS', undefined);
  expect(startStand('0.1.0')).toBe('Little Galaxy stand v0.1.0 | languages: en, es | default: en');
});
