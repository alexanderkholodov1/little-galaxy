import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { changedFiles, checkReleaseVersion, releaseMissMessage } from './check-release-version.js';

it.each(['apps/web/js/main.js', 'packages/shared/src/galaxy-store.ts', 'firestore.rules'])(
  'rejects an existing release tag when %s changes', file => {
    expect(() => checkReleaseVersion([file], '1.0.0-alpha.9', ['v1.0.0-alpha.9'])).toThrow(releaseMissMessage);
  },
);
it('requires no bump for docs-only changes and accepts an untagged shipping version', () => {
  expect(checkReleaseVersion(['README.md', '.github/workflows/ci.yml'], '1.0.0-alpha.9', ['v1.0.0-alpha.9'])).toBe(false);
  expect(checkReleaseVersion(['apps/web/package.json'], '1.0.0-alpha.10', ['v1.0.0-alpha.9'])).toBe(true);
});
it('detects deleted shipping files in the real PR diff, including paths with spaces', async () => {
  await mkdir('.tmp', { recursive: true });
  const cwd = await mkdtemp('.tmp/release-diff-');
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
  try {
    git('init');
    await mkdir(cwd + '/apps/web', { recursive: true });
    await writeFile(cwd + '/apps/web/old file.js', 'old');
    git('add', '.');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'base');
    const base = git('rev-parse', 'HEAD');
    await rm(cwd + '/apps/web/old file.js');
    git('add', '.');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'delete');
    expect(changedFiles(base, cwd)).toEqual(['apps/web/old file.js']);
    expect(() => checkReleaseVersion(changedFiles(base, cwd), '1.0.0', ['v1.0.0'])).toThrow(releaseMissMessage);
    // Renaming a shipping file out of the app still removes shipped code.
    await mkdir(cwd + '/docs');
    await writeFile(cwd + '/docs/old file.js', 'old');
    git('add', '.');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'move outside shipping paths');
    expect(changedFiles(base, cwd)).toEqual(['apps/web/old file.js', 'docs/old file.js']);
    expect(() => checkReleaseVersion(changedFiles(base, cwd), '1.0.0', ['v1.0.0'])).toThrow(releaseMissMessage);
  } finally { await rm(cwd, { recursive: true, force: true }); }
});
it('fails closed when the base SHA is missing or malformed', () => {
  for (const base of ['', '--all', '0'.repeat(40)]) expect(() => changedFiles(base)).toThrow('base commit SHA');
});
