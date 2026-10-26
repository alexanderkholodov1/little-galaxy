import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { allocateMergeRelease, changedFiles, mergedRequest, planMergeRelease, ships } from './check-release-version.js';

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
    expect(planMergeRelease(base, { cwd, branch: 'v1.0.0-alpha.9-close' })).toMatchObject({ shipping: true, tag: 'v1.0.0-alpha.9', create: true, tagExists: false });
    expect(planMergeRelease(base, { cwd, preview: true }).tag).toBe('v1.0.0-alpha.1.1');
    git('tag', 'v1.0.0-alpha.9');
    expect(planMergeRelease(base, { cwd }).create).toBe(true); // Retry must release again.
    expect(planMergeRelease(base, { cwd }).tagExists).toBe(true);
    await mkdir(cwd + '/docs');
    await writeFile(cwd + '/docs/old file.js', 'old');
    commit('move outside shipping paths');
    expect(changedFiles(base, cwd)).toEqual(['apps/web/old file.js', 'docs/old file.js']);
    expect(planMergeRelease(base, { cwd }).tag).toBe('v1.0.0-alpha.9.1');
    expect(planMergeRelease(base, { cwd, branch: 'v1.0.0-alpha.8' }).reason).toContain('fall back');
    const beforeDocs = git('rev-parse', 'HEAD');
    await writeFile(cwd + '/README.md', 'docs only'); commit('docs');
    expect(planMergeRelease(beforeDocs, { cwd })).toEqual({ shipping: false, tag: '', create: false });
  } finally { await rm(cwd, { recursive: true, force: true }); }
});
it('fails closed when the base SHA is missing or malformed', () => {
  for (const base of ['', '--all', '0'.repeat(40)]) expect(() => changedFiles(base)).toThrow('base commit SHA');
});

it('uses only the merged PR for the exact SHA and main base, and fails malformed lookups', () => {
  const sha = 'a'.repeat(40);
  const pr = { merged_at: '2026-10-25', merge_commit_sha: sha, base: { ref: 'main' }, head: { ref: 'v1.0.0-alpha.9-close' }, title: 'v1.0.0-alpha.9: Close' };
  expect(mergedRequest([{ ...pr, merged_at: null }, { ...pr, merge_commit_sha: 'other' }, { ...pr, base: { ref: 'other' } }, pr], sha))
    .toEqual({ branch: pr.head.ref, title: pr.title });
  expect(mergedRequest([], sha)).toEqual({});
  expect(() => mergedRequest({}, sha)).toThrow('Invalid merged PR lookup');
  expect(() => mergedRequest([pr, pr], sha)).toThrow('Ambiguous');
  expect(() => mergedRequest([{ ...pr, head: null }], sha)).toThrow('Missing merged PR');
});

it('reserves the exact commit, retries concurrent collisions and resumes a successful reservation', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'galaxy-reserve-'));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git('init'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid');
    await mkdir(cwd + '/apps/web', { recursive: true });
    await writeFile(cwd + '/apps/web/game.js', 'base'); git('add', '.'); git('commit', '-m', 'base');
    const base = git('rev-parse', 'HEAD'); git('tag', 'v1.0.0-alpha.8');
    await writeFile(cwd + '/apps/web/game.js', 'new'); git('add', '.'); git('commit', '-m', 'ship');
    const sha = git('rev-parse', 'HEAD');
    const calls = [];
    const options = { cwd, refresh: async () => {}, createTag: async (tag, commit) => {
      calls.push([tag, commit]);
      if (calls.length === 1) { git('tag', tag, base); throw new Error('HTTP 422 concurrent reservation'); }
      git('tag', tag, commit);
    } };
    const result = await allocateMergeRelease(base, { branch: 'v1.0.0-alpha.9-close' }, options);
    expect(calls).toEqual([['v1.0.0-alpha.9', sha], ['v1.0.0-alpha.9.1', sha]]);
    expect(result.tag).toBe('v1.0.0-alpha.9.1');
    expect((await allocateMergeRelease(base, {}, options)).tagExists).toBe(true);
    expect(calls).toHaveLength(2);
    git('tag', '-d', 'v1.0.0-alpha.9.1');
    await expect(allocateMergeRelease(base, {}, { ...options, createTag: async () => { throw new Error('HTTP 403 denied'); } }))
      .rejects.toThrow('HTTP 403 denied');
  } finally { await rm(cwd, { recursive: true, force: true }); }
});
