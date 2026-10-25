import { expect, it, vi } from 'vitest';

it('installs a version-4 randomUUID where the context is not secure', async () => {
  const original = globalThis.crypto.randomUUID;
  const fake = { getRandomValues: a => { for (let i = 0; i < a.length; i++) a[i] = (i * 37 + 11) & 255; return a; } };
  vi.stubGlobal('crypto', fake);
  await import('./uuid.js?insecure');
  const id = fake.randomUUID();
  expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  vi.unstubAllGlobals();
  expect(globalThis.crypto.randomUUID).toBe(original);
});
