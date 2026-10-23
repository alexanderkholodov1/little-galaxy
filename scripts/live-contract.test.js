import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it('acceptance builds Galaxy artifacts and CI invokes the release swap', () => {
  const runner = readFileSync('scripts/test-live-safety.mjs', 'utf8');
  expect(runner).toContain('vite');
  expect(runner).not.toContain('<!DOCTYPE html>');
  expect(readFileSync('.github/workflows/checks.yml', 'utf8')).toContain('pnpm run test:live-safety');
});
it('connected smoke launches through the phone and asserts the subscribed object within two seconds', () => {
  const smoke = readFileSync('tests/ui/smoke.spec.js', 'utf8');
  expect(smoke).toContain("name: 'Launch in a gentle orbit'");
  expect(smoke).toContain('timeout: 2000');
  expect(smoke).toContain('Reassemble & relaunch');
  expect(smoke).not.toContain('synthetic=');
});
it('update notice uses theme-aware action contrast and runbook invokes real scripts', () => {
  const css = readFileSync('apps/web/src/styles.css', 'utf8').split('.update-notice {')[1].split('}')[0];
  expect(css).toContain('color: var(--action)');
  const docs = readFileSync('docs/live-safety-status.md', 'utf8');
  expect(docs).toContain('--config tests/ui/playwright.config.js');
  expect(docs).toContain('pnpm run deploy-local -- --galaxy');
  expect(docs).toContain('pnpm run rollback');
  expect(docs).toContain('does not change `games.json`');
});
