import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { verifyRelease } from './verify-release.js';

export const releaseMissMessage = 'this merge will not reach production: bump apps/web/package.json';
export const ships = file => /^(apps\/web\/|packages\/shared\/|firestore\.rules$)/u.test(file);

export function checkReleaseVersion(files, version, tags) {
  if (!files.some(ships)) return false;
  const tag = verifyRelease('v' + version, version);
  if (tags.includes(tag)) throw new Error(releaseMissMessage);
  return true;
}

export function changedFiles(base, cwd) {
  // Both refs come from the event/checkout; no shell interpolation or PR-provided commands.
  if (!base || !/^[a-f0-9]{40}$/u.test(base) || /^0+$/u.test(base)) throw new Error('A full base commit SHA is required for the release-miss check.');
  return execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', base + '...HEAD'], { cwd, encoding: 'utf8' }).split('\0').filter(Boolean);
}

async function main() {
  const files = changedFiles(process.env.RELEASE_BASE_SHA);
  const { version } = JSON.parse(await readFile(new URL('../apps/web/package.json', import.meta.url), 'utf8'));
  const tags = execFileSync('git', ['tag', '--list'], { encoding: 'utf8' }).trim().split(/\r?\n/u);
  const shipping = checkReleaseVersion(files, version, tags);
  console.log(shipping ? 'Shipping changes have an untagged package version.' : 'No shipped paths changed; no version bump required.');
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { await main(); }
  catch (error) { console.error('::error::' + error.message); process.exitCode = 1; }
}
