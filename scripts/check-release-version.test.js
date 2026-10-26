import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { changedFiles, planMergeRelease, ships } from './check-release-version.js';

it.each(['apps/web/js/main.js', 'packages/shared/src/galaxy-store.ts', 'apps/stand/src/galaxies.ts',
  'firestore.rules', 'firestore.indexes.json', 'firebase.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
  'package.json', 'turbo.json', 'tsconfig.base.json', '.npmrc', 'scripts/privacy-check', '.github/workflows/release.yml'])(
  'includes release input %s', file => expect(ships(file)).toBe(true),
);
it.each(['README.md', 'docs/RUNBOOK.md', 'CHANGELOG.md'])(
  'keeps %s outside the shipping filter', file => expect(ships(file)).toBe(false),
);
it('automatically releases unchanged package versions, resumes tags, and detects deletions/moves', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'galaxy-release-diff-'));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = message => {
    git('add', '.');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', message);
    return git('rev-parse', 'HEAD');
  };
  try {
    git('init');
    await mkdir(cwd + '/apps/web', { recursive: true });
    await writeFile(cwd + '/apps/web/package.json', '{"version":"1.0.0-alpha.1"}');
    await writeFile(cwd + '/apps/web/old file.js', 'old');
    const base = commit('base');
    git('tag', 'v1.0.0-alpha.1');
    await rm(cwd + '/apps/web/old file.js');
    commit('delete without package bump');
    expect(changedFiles(base, cwd)).toEqual(['apps/web/old file.js']);
    expect(planMergeRelease(base, { cwd })).toEqual({ shipping: true, tag: 'v1.0.0-alpha.2', create: true, tagExists: false });
    expect(planMergeRelease(base, { cwd, preview: true }).tag).toBe('v1.0.0-alpha.2');
    git('tag', 'v1.0.0-alpha.2');
    expect(planMergeRelease(base, { cwd }).create).toBe(true); // Retry must release again.
    expect(planMergeRelease(base, { cwd }).tagExists).toBe(true);
    await mkdir(cwd + '/docs');
    await writeFile(cwd + '/docs/old file.js', 'old');
    commit('move outside shipping paths');
    expect(changedFiles(base, cwd)).toEqual(['apps/web/old file.js', 'docs/old file.js']);
    expect(planMergeRelease(base, { cwd }).tag).toBe('v1.0.0-alpha.3');
    git('tag', 'v1.0.0-alpha.3', base);
    expect(() => planMergeRelease(base, { cwd })).toThrow('collision');
    const beforeDocs = git('rev-parse', 'HEAD');
    await writeFile(cwd + '/README.md', 'docs only'); commit('docs');
    expect(planMergeRelease(beforeDocs, { cwd })).toEqual({ shipping: false, tag: '', create: false });
  } finally { await rm(cwd, { recursive: true, force: true }); }
});
it('fails closed when the base SHA is missing or malformed', () => {
  for (const base of ['', '--all', '0'.repeat(40)]) expect(() => changedFiles(base)).toThrow('base commit SHA');
});
