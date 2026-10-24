import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('keeps the retired profile integration out of the game and memory fixtures', () => {
  expect(existsSync('apps/web/src/profile.ts')).toBe(false);
  expect(existsSync('apps/web/src/profile.test.ts')).toBe(false);
  expect(readFileSync('apps/web/src/copy.ts', 'utf8')).not.toMatch(/\bnav:/);
  expect(readFileSync('tests/ui/memory-fixture.js', 'utf8')).not.toContain('/profile.json');
});
