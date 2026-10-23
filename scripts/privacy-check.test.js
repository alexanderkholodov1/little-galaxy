import { gzipSync } from 'node:zlib';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { checkPrivacy } from './privacy-lib.js';

let root;
let output;

beforeEach(async () => {
  root = await mkdtemp(path.join(process.env.CASPIAN_TMP || os.tmpdir(), 'galaxy-privacy-'));
  output = path.join(root, 'apps/web/dist');
  await mkdir(output, { recursive: true });
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

it('loads the production Vite env files for the public-key allowlist', async () => {
  vi.stubEnv('VITE_FIREBASE_API_KEY', undefined);
  const key = `AIza${'C'.repeat(35)}`;
  await writeFile(path.join(root, 'apps/web/.env'), `VITE_FIREBASE_API_KEY=AIza${'A'.repeat(35)}\n`);
  await writeFile(path.join(root, 'apps/web/.env.production.local'), `VITE_FIREBASE_API_KEY=${key}\n`);
  await writeFile(path.join(output, 'app.js'), key);
  await expect(checkPrivacy(root)).resolves.toBe(1);
  vi.stubEnv('VITE_FIREBASE_API_KEY', `AIza${'B'.repeat(35)}`);
  await expect(checkPrivacy(root)).rejects.toThrow('rule: firebase-api-key');
  await writeFile(path.join(output, 'app.js'), `AIza${'B'.repeat(35)}`);
  await expect(checkPrivacy(root)).resolves.toBe(1);
});

it('allows only the configured public Firebase API key', async () => {
  const publicKey = `AIza${'A'.repeat(35)}`;
  await writeFile(path.join(output, 'app.js'), `const config={apiKey:"${publicKey}"}`);
  await expect(checkPrivacy(root, { VITE_FIREBASE_API_KEY: publicKey })).resolves.toBe(1);
  await expect(checkPrivacy(root, {})).rejects.toThrow(/rule: firebase-api-key/u);
});

it('rejects a different Firebase API key', async () => {
  const configuredKey = `AIza${'A'.repeat(35)}`;
  await writeFile(path.join(output, 'app.js'), `const config={apiKey:"AIza${'B'.repeat(35)}"}`);
  await expect(checkPrivacy(root, { VITE_FIREBASE_API_KEY: configuredKey }))
    .rejects.toThrow(/rule: firebase-api-key/u);
});

it('rejects a Vite-minified service-account object without printing its secret', async () => {
  const distinctiveSecret = `very-distinctive-secret-${'Z'.repeat(120)}`;
  const bundle = `const a={type:"service_account",private_key_id:"id",private_key:"${distinctiveSecret}",client_email:"robot@demo.iam.gserviceaccount.com"};`;
  await writeFile(path.join(output, 'app.js'), bundle);

  let message = '';
  try {
    await checkPrivacy(root, {});
  } catch (error) {
    message = error.message;
  }
  expect(message).toContain('app.js');
  expect(message).toMatch(/rule: [a-z-]+/u);
  expect(message).not.toContain(distinctiveSecret);
});

it.each([
  '/home/runner/work/x/x/private/key.json',
  'C:/My Files/AKLabs/Fawns/little-galaxy/private/key.json',
])('rejects an absolute private path without echoing it (%s)', async (privatePath) => {
  await writeFile(path.join(output, 'app.js'), `const source=${JSON.stringify(privatePath)}`);
  await expect(checkPrivacy(root, {})).rejects.toThrow('rule: private-path');
});

it.each(['RSA', 'OPENSSH'])('rejects a %s private-key header', async (kind) => {
  await writeFile(path.join(output, 'app.js'), `-----BEGIN ${kind} PRIVATE KEY-----`);
  await expect(checkPrivacy(root, {})).rejects.toThrow('rule: private-key-header');
});

it.each(['base64', 'base64url'])('rejects a %s-encoded private key', async (encoding) => {
  const secret = `-----BEGIN ENCRYPTED PRIVATE KEY-----\n${'X'.repeat(100)}`;
  await writeFile(path.join(output, 'app.js'), Buffer.from(secret).toString(encoding));
  await expect(checkPrivacy(root, {})).rejects.toThrow('rule: base64-private-key-header');
});

it.each(['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_', 'github_pat_', 'GOCSPX-'])(
  'rejects the %s token prefix', async (prefix) => {
    await writeFile(path.join(output, 'app.js'), `${prefix}${'q'.repeat(100)}`);
    await expect(checkPrivacy(root, {})).rejects.toThrow(/rule: (github-token|google-oauth-token)/u);
  },
);

it('rejects a gzip-compressed copy of a private source file', async () => {
  const privateDirectory = path.join(root, 'apps/stand/private');
  const content = Buffer.from(`distinct-private-file-${'Q'.repeat(80)}`);
  await mkdir(privateDirectory, { recursive: true });
  await writeFile(path.join(privateDirectory, 'credentials.bin'), content);
  await writeFile(path.join(output, 'renamed.js.gz'), gzipSync(content));
  await expect(checkPrivacy(root, {})).rejects.toThrow('rule: gzip-private-file-copy');
});

it('rejects a renamed copy of a private file but ignores private files shorter than 32 bytes', async () => {
  const privateDirectory = path.join(root, 'private');
  const longContent = Buffer.from(`private-binary-${'L'.repeat(40)}`);
  await mkdir(privateDirectory, { recursive: true });
  await writeFile(path.join(privateDirectory, 'long.bin'), longContent);
  await writeFile(path.join(privateDirectory, 'short.bin'), 'short');
  await writeFile(path.join(output, 'safe.js'), 'short');
  await expect(checkPrivacy(root, {})).resolves.toBe(1);
  await writeFile(path.join(output, 'renamed.bin'), longContent);
  await expect(checkPrivacy(root, {})).rejects.toThrow('rule: private-file-copy');
});

it('rejects a copy of a private file kept elsewhere behind a linked private directory, despite link loops', async () => {
  const elsewhere = await mkdtemp(path.join(process.env.CASPIAN_TMP || os.tmpdir(), 'galaxy-private-'));
  try {
    const content = `kept-elsewhere-${'K'.repeat(40)}`;
    await writeFile(path.join(elsewhere, 'note.txt'), content);
    await symlink(elsewhere, path.join(elsewhere, 'again'), 'junction');
    await symlink(elsewhere, path.join(root, 'private'), 'junction');
    await writeFile(path.join(output, 'app.js'), `const note="${content}"`);
    await expect(checkPrivacy(root, {})).rejects.toThrow('rule: private-file-copy');
  } finally {
    await rm(elsewhere, { recursive: true, force: true });
  }
});

it('fails closed on missing and empty output', async () => {
  await expect(checkPrivacy(root, {})).rejects.toThrow('rule: empty-output');
  await rm(output, { recursive: true, force: true });
  await expect(checkPrivacy(root, {})).rejects.toThrow('rule: missing-output');
});

it('rejects private output paths', async () => {
  await mkdir(path.join(output, 'private'), { recursive: true });
  await writeFile(path.join(output, 'private/anything.txt'), 'safe content');
  await expect(checkPrivacy(root, {})).rejects.toThrow('rule: private-path');
});
