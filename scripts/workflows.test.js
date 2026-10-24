import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

it('hands the preview credential only to the locked firebase-tools version', async () => {
  const locked = (await read('pnpm-lock.yaml')).match(/^ {2}firebase-tools@(\d+\.\d+\.\d+):\r?$/mu)?.[1];
  const pinned = (await read('.github/workflows/ci.yml')).match(/^ +firebaseToolsVersion: (\d+\.\d+\.\d+)\r?$/mu)?.[1];
  expect(locked).toMatch(/^\d+\.\d+\.\d+$/u);
  expect(pinned).toBe(locked);
});

it('requires the portfolio credential and dispatches only after publication', async () => {
  const workflow = await read('.github/workflows/release.yml');
  const notification = workflow.split('      - name: Notify portfolio of the published release\n')[1].split('\n  deploy-rules:')[0];
  expect(workflow.indexOf('      - name: Publish GitHub Release')).toBeLessThan(workflow.indexOf('      - name: Notify portfolio'));
  expect(notification).toContain('GH_TOKEN: ${{ secrets.PORTFOLIO_DISPATCH_TOKEN }}');
  const script = notification.split('        run: |\n')[1].replace(/^ {10}/gmu, '');
  const { spawnSync } = await import('node:child_process');
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const dir = await mkdtemp(`${tmpdir()}/galaxy-dispatch-`);
  try {
    const capture = `${dir}/request.json`;
    await writeFile(`${dir}/gh`, '#!/usr/bin/env node\nrequire("node:fs").writeFileSync(process.env.CAPTURE, JSON.stringify(process.argv.slice(2)));\nprocess.exit(Number(process.env.API_EXIT || 0));\n', { mode: 0o755 });
    const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, CAPTURE: capture, GH_TOKEN: '', GITHUB_REF_NAME: 'v1.0.2' };
    const missing = spawnSync('bash', ['-e', '-c', script], { env, encoding: 'utf8' });
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('PORTFOLIO_DISPATCH_TOKEN is required');
    await expect(readFile(capture)).rejects.toMatchObject({ code: 'ENOENT' });
    env.GH_TOKEN = 'test-token';
    expect(spawnSync('bash', ['-e', '-c', script], { env }).status).toBe(0);
    expect(JSON.parse(await readFile(capture, 'utf8'))).toEqual([
      'api', '--method', 'POST', 'repos/alexanderkholodov1/portfolio/dispatches',
      '-f', 'event_type=galaxy-released', '-f', 'client_payload[tag]=v1.0.2',
    ]);
    expect(spawnSync('bash', ['-e', '-c', script], { env: { ...env, API_EXIT: '1' } }).status).toBe(1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
