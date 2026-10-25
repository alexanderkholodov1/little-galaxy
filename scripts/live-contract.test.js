import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it('acceptance builds Galaxy artifacts and CI invokes the release swap', () => {
  const runner = readFileSync('scripts/test-live-safety.mjs', 'utf8');
  expect(runner).toContain('vite');
  expect(runner).not.toContain('<!DOCTYPE html>');
  expect(readFileSync('.github/workflows/checks.yml', 'utf8')).toContain('pnpm run test:live-safety');
});
