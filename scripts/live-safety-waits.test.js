import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it('gives every page wait in the live-safety journey the same 30 s budget', () => {
  const source = readFileSync(new URL('./test-live-safety.mjs', import.meta.url), 'utf8');
  const waits = source.match(/await expect\([^;]*?\)\.(toBeVisible|toHaveAttribute)\([^;]*?\);/g);
  expect(waits.length).toBeGreaterThan(5);
  for (const wait of waits) expect(wait).toContain('timeout:30000');
});
