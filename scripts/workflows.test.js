import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

it('hands the preview credential only to the locked firebase-tools version', async () => {
  const locked = (await read('pnpm-lock.yaml')).match(/^ {2}firebase-tools@(\d+\.\d+\.\d+):\r?$/mu)?.[1];
  const pinned = (await read('.github/workflows/ci.yml')).match(/^ +firebaseToolsVersion: (\d+\.\d+\.\d+)\r?$/mu)?.[1];
  expect(locked).toMatch(/^\d+\.\d+\.\d+$/u);
  expect(pinned).toBe(locked);
});
