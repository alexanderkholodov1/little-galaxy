import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { isReadOnlyRequest } from '../tests/ui/read-only.js';
it('permits normal Firebase POST reads but blocks auth creation and all mutation transports', () => {
  const firestore = 'https://firestore.googleapis.com';
  for (const path of ['/google.firestore.v1.Firestore/Listen/channel', '/v1/projects/p/databases/(default)/documents:batchGet', '/v1/projects/p/databases/(default)/documents:runQuery']) {
    expect(isReadOnlyRequest('POST', firestore + path)).toBe(true);
  }
  for (const url of [firestore + '/google.firestore.v1.Firestore/Write/channel', firestore + '/v1/projects/p/databases/(default)/documents:commit', 'https://identitytoolkit.googleapis.com/v1/accounts:signUp', 'https://example.test/save']) {
    expect(isReadOnlyRequest('POST', url)).toBe(false);
  }
});
it('preview mode selects only the guarded spec and suppresses anonymous authentication in application code', () => {
  expect(readFileSync('tests/ui/playwright.config.js', 'utf8')).toContain("isPreview ? 'smoke-preview.spec.js'");
  expect(readFileSync('apps/web/src/firebase.ts', 'utf8')).toContain('isReadOnlySmoke');
});
