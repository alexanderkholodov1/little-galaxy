import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const sourceRoot = process.env.RELEASE_SOURCE_ROOT || fileURLToPath(new URL('../', import.meta.url));
const workflow = await readFile(path.join(sourceRoot, '.github/workflows/release.yml'), 'utf8');
const merge = await readFile(path.join(sourceRoot, '.github/workflows/release-on-merge.yml'), 'utf8');
function step(source, name) {
  const block = source.split(`      - name: ${name}\n`)[1]?.split(/\n {6}- /u)[0];
  if (!block) throw new Error(`Missing step: ${name}`);
  const run = block.split('        run: ')[1];
  if (!run) throw new Error(`No command: ${name}`);
  return run.startsWith('|\n') ? run.slice(2).split('\n').map((line) => line.replace(/^ {10}/u, '')).join('\n') : run.split('\n')[0].trim();
}
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

it('checks fresh main at deployment, publication and dispatch boundaries without sorting historical tags', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'galaxy-current-main-'));
  try {
    const remote = path.join(root, 'remote'), runner = path.join(root, 'runner');
    await mkdir(remote); git(remote, 'init', '-b', 'main');
    git(remote, 'config', 'user.name', 'Fixture'); git(remote, 'config', 'user.email', 'fixture@example.invalid');
    await mkdir(path.join(remote, 'apps/web'), { recursive: true });
    const setVersion = async (version) => {
      await writeFile(path.join(remote, 'apps/web/package.json'), JSON.stringify({ version }));
      git(remote, 'add', '.'); git(remote, 'commit', '-m', version);
    };
    await setVersion('1.0.0-alpha.1');
    for (const tag of ['v1.0.0-alpha.1', 'v1.0.0', 'v1.0.1']) git(remote, 'tag', tag);
    git(root, 'clone', remote, runner);
    await mkdir(path.join(runner, 'scripts'));
    await writeFile(path.join(runner, 'scripts/verify-release.js'), await readFile(path.join(sourceRoot, 'scripts/verify-release.js')));
    await writeFile(path.join(runner, 'package.json'), '{"type":"module"}');
    const run = (command, tag) => spawnSync('bash', ['-e', '-o', 'pipefail', '-c', command], {
      cwd: runner, env: { ...process.env, RELEASE_TAG: tag }, encoding: 'utf8',
    });
    const names = ['Refuse stale release before deployment', 'Refuse stale release before publication', 'Recheck current main before portfolio dispatch'];
    for (const name of names) expect(run(step(workflow, name), 'v1.0.0-alpha.1').status).toBe(0);
    // The runner is still on alpha.1. The guard must fetch again on a retry.
    await setVersion('1.0.0-alpha.2');
    for (const name of names) {
      const rejected = run(step(workflow, name), 'v1.0.0-alpha.1');
      expect(rejected.status).not.toBe(0); expect(rejected.stderr).toContain('STALE RELEASE REFUSED');
      expect(run(step(workflow, name), 'v1.0.0-alpha.2').status).toBe(0);
    }
    const publish = workflow.split('\n  publish:')[1].split('\n  deploy-rules:')[0];
    expect(publish.indexOf(names[1])).toBeLessThan(publish.indexOf('gh release create'));
    expect(publish.indexOf(names[2])).toBeLessThan(publish.indexOf('portfolio/dispatches'));
    const deploy = workflow.split('\n  deploy-rules:')[1];
    expect(deploy.indexOf(names[0])).toBeLessThan(deploy.indexOf('src/index.ts release-sky'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

it('writes a visible summary for a same-version merge and creates tags on the exact merge SHA', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'galaxy-merge-'));
  try {
    git(root, 'init', '-b', 'main'); git(root, 'config', 'user.name', 'Fixture'); git(root, 'config', 'user.email', 'fixture@example.invalid');
    await mkdir(path.join(root, 'apps/web'), { recursive: true }); await mkdir(path.join(root, 'scripts'));
    await writeFile(path.join(root, 'package.json'), '{"type":"module"}');
    await writeFile(path.join(root, 'apps/web/package.json'), '{"version":"1.0.0-alpha.1"}');
    await writeFile(path.join(root, 'scripts/verify-release.js'), await readFile(path.join(sourceRoot, 'scripts/verify-release.js')));
    git(root, 'add', '.'); git(root, 'commit', '-m', 'fixture'); git(root, 'tag', 'v1.0.0-alpha.1');
    const env = { ...process.env, GITHUB_OUTPUT: path.join(root, 'outputs'), GITHUB_STEP_SUMMARY: path.join(root, 'summary'),
      GITHUB_SHA: git(root, 'rev-parse', 'HEAD'), GITHUB_REPOSITORY: 'fixture/galaxy', RELEASE_TAG: 'v1.0.0-alpha.1' };
    const plan = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', step(merge, 'Decide from the merged package version and existing tags')], { cwd: root, env, encoding: 'utf8' });
    expect(plan.status).toBe(0);
    expect(await readFile(env.GITHUB_OUTPUT, 'utf8')).toContain('create=false');
    expect(await readFile(env.GITHUB_STEP_SUMMARY, 'utf8')).toContain('This merge will NOT release');
    expect(plan.stdout).toContain('::notice');
    await writeFile(path.join(root, 'gh'), '#!/bin/sh\nprintf "%s\\n" "$@" > "$GITHUB_STEP_SUMMARY"\n');
    await chmod(path.join(root, 'gh'), 0o700);
    const tagged = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', step(merge, 'Tag the exact merge commit')], { cwd: root, env: { ...env, PATH: `${root}:${env.PATH}` }, encoding: 'utf8' });
    expect(tagged.status).toBe(0);
    const args = (await readFile(env.GITHUB_STEP_SUMMARY, 'utf8')).trim().split('\n');
    expect(args).toEqual(['api', '--method', 'POST', 'repos/fixture/galaxy/git/refs', '-f', 'ref=refs/tags/v1.0.0-alpha.1', '-f', `sha=${env.GITHUB_SHA}`]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

it.each([0, 1])('always-run recovery propagates exit=%s and leaves credential removal after recovery', async (code) => {
  const root = await mkdtemp(path.join(tmpdir(), 'galaxy-recovery-'));
  const summary = path.join(root, 'summary');
  try {
    await writeFile(path.join(root, 'pnpm'), `#!/bin/sh\nexit ${code}\n`); await chmod(path.join(root, 'pnpm'), 0o700);
    const command = step(workflow, 'Recover the prior season setting even after cancellation or failure');
    const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', command], { env: { ...process.env, GITHUB_STEP_SUMMARY: summary, PATH: `${root}:${process.env.PATH}` }, encoding: 'utf8' });
    expect(result.status).toBe(code);
    if (code) expect(result.stdout).toContain('Operate the sky');
    expect(workflow.indexOf('src/index.ts restore-season')).toBeLessThan(workflow.indexOf('rm -f'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

it('never queues emergency controls in the release pending slot', async () => {
  const operate = await readFile(path.join(sourceRoot, '.github/workflows/operate-sky.yml'), 'utf8');
  expect(operate).not.toMatch(/^\s*concurrency:/mu);
  expect(workflow.split('\n  deploy-rules:')[1]).toMatch(/group: galaxy-sky-releases\n\s+cancel-in-progress: false/u);
});
