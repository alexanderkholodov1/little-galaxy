import { expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chooseReleaseVersion, compareAlphaTags, git, requireFullHistory, versionPrefix } from './release-version.js';
import { isPrerelease, verifyTaggedCommit } from './verify-release.js';

it.each([
  ['v1.0.0-alpha.9', 'v1.0.0-alpha.9'],
  ['v1.0.0-alpha.9-close', 'v1.0.0-alpha.9'],
  ['v1.0.0-alpha.9.4: Finish tests', 'v1.0.0-alpha.9.4'],
  ['v1.0.0-alpha.9.4.12/fix', 'v1.0.0-alpha.9.4.12'],
  ['v1.0.0-alpha.09', undefined], ['v1.0.0-alpha.9.04', undefined],
  ['v1.0.0-alpha.9.4oops', undefined], ['Fix v1.0.0-alpha.9', undefined],
])('reads only a complete leading numeric version from %s', (text, expected) => {
  expect(versionPrefix(text)).toBe(expected);
});

it.each([
  [['v1.0.0-alpha.8'], { branch: 'v1.0.0-alpha.9-close' }, 'v1.0.0-alpha.9'],
  [['v1.0.0-alpha.8'], { title: 'v1.0.0-alpha.9: Close the fair' }, 'v1.0.0-alpha.9'],
  [['v1.0.0-alpha.8'], { branch: 'v1.0.0-alpha.9.4', title: 'v1.0.0-alpha.10: Later' }, 'v1.0.0-alpha.9.4'],
  [['v1.0.0-alpha.9'], { branch: 'v1.0.0-alpha.9-close' }, 'v1.0.0-alpha.9.1'],
  [['v1.0.0-alpha.9', 'v1.0.0-alpha.9.1'], { branch: 'v1.0.0-alpha.9' }, 'v1.0.0-alpha.9.2'],
  [['v1.0.0-alpha.9', 'v1.0.0-alpha.9.1', 'v1.0.0-alpha.9.3.4'], { branch: 'v1.0.0-alpha.9' }, 'v1.0.0-alpha.9.4'],
  [['v1.0.0-alpha.9.4'], { branch: 'v1.0.0-alpha.9.4' }, 'v1.0.0-alpha.9.4.1'],
  [['v1.0.0-alpha.8'], {}, 'v1.0.0-alpha.8.1'],
  [['v1.0.0-alpha.8.1'], {}, 'v1.0.0-alpha.8.1.1'],
  [['v1.0.0-alpha.8', 'v1.0.0-alpha.9'], { branch: 'v1.0.0-alpha.8' }, 'v1.0.0-alpha.9.1'],
  [['v1.0.0-alpha.9.4'], { title: 'v1.0.0-alpha.9.2: Old work' }, 'v1.0.0-alpha.9.4.1'],
  [['v1.0.0-alpha.9.1'], { branch: 'v1.0.0-alpha.9' }, 'v1.0.0-alpha.9.1.1'],
  [[], {}, 'v1.0.0-alpha.1'],
  [['v1.0.1', 'v1.0.0', 'v1.0.0-alpha.2.60', 'v1.0.0-alpha.8'], {}, 'v1.0.0-alpha.8.1'],
])('allocates the milestone or its increasing dotted successor: %j %j', (tags, request, expected) => {
  const plan = chooseReleaseVersion(tags, request);
  expect(plan.tag).toBe(expected);
  for (const tag of tags.filter(tag => tag.startsWith('v1.0.0-alpha.'))) expect(compareAlphaTags(plan.tag, tag)).toBeGreaterThan(0);
});
it('explains a stale branch fallback in the forecast', () => {
  expect(chooseReleaseVersion(['v1.0.0-alpha.9'], { branch: 'v1.0.0-alpha.8' }).reason)
    .toContain('Requested v1.0.0-alpha.8 is lower than newest v1.0.0-alpha.9; fall back');
});
it.each([
  ['v1.0.0-alpha.9', 'v1.0.0-alpha.10'],
  ['v1.0.0-alpha.9.2', 'v1.0.0-alpha.9.10'],
  ['v1.0.0-alpha.9', 'v1.0.0-alpha.9.0'],
  ['v1.0.0-alpha.9.2.99', 'v1.0.0-alpha.9.3'],
  ['v1.0.0-alpha.9007199254740992', 'v1.0.0-alpha.9007199254740993'],
])('orders %s below %s using numeric semver precedence', (a, b) => {
  expect(compareAlphaTags(a, b)).toBe(-1);
  expect(compareAlphaTags(b, a)).toBe(1);
  expect(compareAlphaTags(a, a)).toBe(0);
});
it.each(['v1.0.0-alpha.1', 'v1.0.0-alpha.9.4.1', 'v2.3.0-beta.2'])('marks %s as a prerelease', tag => {
  expect(isPrerelease(tag)).toBe(true);
});
it.each(['v1.2.3', 'v0.0.1'])('marks %s as stable', tag => expect(isPrerelease(tag)).toBe(false));

it('rejects PR-side releases, non-increasing main tags and shallow history', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'galaxy-release-milestone-'));
  const run = (...args) => git(args, cwd);
  const commit = async name => {
    await writeFile(path.join(cwd, name), name);
    run('add', '.'); run('commit', '-m', name);
  };
  try {
    run('init', '-b', 'main'); run('config', 'user.name', 'Fixture'); run('config', 'user.email', 'fixture@example.invalid');
    await commit('base'); run('tag', 'v1.0.0-alpha.8');
    run('checkout', '-b', 'feature'); await commit('feature');
    const side = run('rev-parse', 'HEAD');
    run('checkout', 'main'); await commit('docs'); run('merge', '--no-ff', 'feature', '-m', 'merge');
    run('update-ref', 'refs/remotes/origin/main', 'HEAD');
    run('tag', 'v1.0.0-alpha.9', side); run('checkout', side);
    expect(() => verifyTaggedCommit('v1.0.0-alpha.9', cwd)).toThrow('first-parent history of main');
    run('checkout', 'main'); run('tag', 'v1.0.0-alpha.7');
    expect(() => verifyTaggedCommit('v1.0.0-alpha.7', cwd)).toThrow('NON-INCREASING RELEASE');
    run('tag', 'v1.0.0-alpha.10');
    expect(verifyTaggedCommit('v1.0.0-alpha.10', cwd)).toBe(run('rev-parse', 'HEAD'));
    run('tag', 'v1.0.1');
    expect(() => verifyTaggedCommit('v1.0.1', cwd)).toThrow('numeric milestone line');
    await writeFile(path.join(cwd, '.git/shallow'), run('rev-parse', 'HEAD') + '\n');
    expect(() => requireFullHistory(cwd)).toThrow('full git history');
  } finally { await rm(cwd, { recursive: true, force: true }); }
});
