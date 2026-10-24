import { readFile, mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { isPrerelease } from './verify-release.js';

const workflow = await readFile(process.env.RELEASE_WORKFLOW_SOURCE || new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
function step(name) {
  const block = workflow.split(`      - name: ${name}\n`)[1].split(/\n {6}- name:/u)[0];
  return block.split('        run: |\n')[1].split('\n').map((line) => line.replace(/^ {10}/u, '')).join('\n');
}

it.each(['v1.0.0-alpha.1', 'v2.1.0-beta.2', 'v2.1.0'])('publishes exact %s even when the caller ref is main', async (tag) => {
  const root = await mkdtemp(path.join(tmpdir(), 'galaxy-publish-'));
  try {
    const stub = path.join(root, 'gh');
    await writeFile(stub, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.RECORD, JSON.stringify(args) + '\\n');
if (args[0] === 'release' && args[1] === 'view') process.exit(process.env.EXISTING === 'true' ? 0 : 1);
if (args[0] === 'release' && args[1] === 'download') {
  for (const name of ['galaxy-dist-' + process.env.RELEASE_TAG + '.tar.gz', 'version.json', 'SHA256SUMS']) fs.copyFileSync(name, 'published/' + name);
}
`);
    await chmod(stub, 0o700);
    const record = path.join(root, 'calls.jsonl');
    const env = { ...process.env, PATH: `${root}:${process.env.PATH}`, RECORD: record,
      GITHUB_REF_NAME: 'main', RELEASE_TAG: tag, PRERELEASE: String(isPrerelease(tag)),
      GITHUB_REPOSITORY: 'fixture/galaxy', GH_TOKEN: 'test-only' };
    const runStep = (name, extra = {}) => spawnSync('bash', ['-e', '-o', 'pipefail', '-c', step(name)], { cwd: root, env: { ...env, ...extra }, encoding: 'utf8' });
    expect(runStep('Publish GitHub Release').status).toBe(0);
    const calls = (await readFile(record, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
    const create = calls.find((args) => args[1] === 'create');
    expect(create).toContain(tag); expect(create).toContain(`galaxy-dist-${tag}.tar.gz`);
    expect(create.includes('--prerelease')).toBe(isPrerelease(tag));
    expect(create.includes('--latest=false')).toBe(isPrerelease(tag));
    // Re-running a failed publish job reuses verified bytes and repeats no create/upload.
    await writeFile(path.join(root, `galaxy-dist-${tag}.tar.gz`), 'checked bytes');
    await writeFile(path.join(root, 'version.json'), '{}');
    const sums = execFileSync('sha256sum', [`galaxy-dist-${tag}.tar.gz`, 'version.json'], { cwd: root });
    await writeFile(path.join(root, 'SHA256SUMS'), sums);
    const retry = runStep('Publish GitHub Release', { EXISTING: 'true' });
    expect(retry.stderr).toBe(''); expect(retry.status).toBe(0);
    const retries = (await readFile(record, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
    expect(retries.filter((args) => args[1] === 'create')).toHaveLength(1);
    // A corrupt published artifact fails verification and cannot reach dispatch.
    await rm(path.join(root, 'published'), { recursive: true });
    await writeFile(path.join(root, `galaxy-dist-${tag}.tar.gz`), 'corrupt');
    expect(runStep('Publish GitHub Release', { EXISTING: 'true' }).status).not.toBe(0);
  } finally { await rm(root, { recursive: true, force: true }); }
});
