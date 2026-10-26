import { expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { automaticTag, git, tagForHeight } from './release-version.js';
import { isPrerelease, verifyTaggedCommit } from './verify-release.js';

it('chooses the same automatic version for a commit on retries, without a package version', () => {
  expect(tagForHeight(20)).toBe('v1.0.0-alpha.20');
  expect(tagForHeight(21n)).toBe('v1.0.0-alpha.21');
});
it.each(['v1.0.0-alpha.1', 'v1.0.0-alpha.9.4.1', 'v2.3.0-beta.2'])('marks %s as a prerelease', tag => {
  expect(isPrerelease(tag)).toBe(true);
});
it.each(['v1.2.3', 'v0.0.1'])('marks %s as stable', tag => expect(isPrerelease(tag)).toBe(false));
it.each([0, -1, 1.5, '01', 'main\ncreate=true'])('rejects invalid history height %s', height => {
  expect(() => tagForHeight(height)).toThrow();
});

it('counts main first parents, rejects PR-side releases and refuses shallow history', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'galaxy-release-height-'));
  const run = (...args) => git(args, cwd);
  const commit = async name => {
    await writeFile(path.join(cwd, name), name);
    run('add', '.'); run('commit', '-m', name);
  };
  try {
    run('init', '-b', 'main'); run('config', 'user.name', 'Fixture'); run('config', 'user.email', 'fixture@example.invalid');
    await commit('base');
    run('checkout', '-b', 'feature'); await commit('feature1'); await commit('feature2');
    const side = run('rev-parse', 'HEAD');
    run('checkout', 'main'); await commit('docs'); run('merge', '--no-ff', 'feature', '-m', 'merge');
    run('update-ref', 'refs/remotes/origin/main', 'HEAD');
    expect(run('rev-list', '--count', 'HEAD')).toBe('5');
    expect(automaticTag('HEAD', cwd)).toBe('v1.0.0-alpha.3');
    run('tag', 'v1.0.0-alpha.3', side); run('checkout', side);
    expect(() => verifyTaggedCommit('v1.0.0-alpha.3', cwd)).toThrow('first-parent history of main');
    run('checkout', 'main');
    await writeFile(path.join(cwd, '.git/shallow'), run('rev-parse', 'HEAD') + '\n');
    expect(() => automaticTag('HEAD', cwd)).toThrow('full git history');
  } finally { await rm(cwd, { recursive: true, force: true }); }
});
